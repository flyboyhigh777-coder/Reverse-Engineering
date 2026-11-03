package app.fastloop.health

import android.app.Activity
import android.content.Intent
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/**
 * Sleep, read off the watch through Health Connect.
 *
 * The watch does not talk to this app and never will. It talks to its own
 * companion app, which — if its owner turns the integration on — writes what
 * it recorded into Health Connect, the store Android keeps for exactly this.
 * So this reads from the store, not from a device: whatever wrote it, and
 * whether it carried stages or only a span, is the store's business and is
 * reported rather than assumed.
 *
 * It is Kotlin because the API is: every read is a suspend function with no
 * blocking or future-returning twin, so there is no calling it from Java.
 * That is the whole reason the build had to move.
 *
 * Registered on the page by reflection from MainActivity, because the
 * hand-rolled build has neither Kotlin nor AndroidX and this class simply is
 * not in it. The page feature-detects for the same reason.
 */
class SleepBridge(private val activity: Activity, private val web: WebView) {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

  private val permissions = setOf(HealthPermission.getReadPermission(SleepSessionRecord::class))

  /**
   * What stands between here and the data, as one word.
   *
   * Four different situations look identical from the page — no Health
   * Connect, one too old to talk to, one that has it but has not been
   * allowed, and one ready to read — and each needs a different sentence and
   * a different button. Collapsing them into "не получилось" is what sent
   * somebody looking at their wifi last time.
   */
  @JavascriptInterface
  fun status(): String = when (HealthConnectClient.getSdkStatus(activity)) {
    HealthConnectClient.SDK_UNAVAILABLE -> "unavailable"
    HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "needs_update"
    else -> if (granted()) "ready" else "no_permission"
  }

  /** Why the last permission check said no, for the probe to report. */
  @Volatile
  private var lastRefusal: String = ""

  private fun granted(): Boolean = try {
    val client = HealthConnectClient.getOrCreate(activity)
    kotlinx.coroutines.runBlocking {
      val held = client.permissionController.getGrantedPermissions()
      lastRefusal = if (held.containsAll(permissions)) "" else "выдано: ${held.size} разрешений, нашего среди них нет"
      held.containsAll(permissions)
    }
  } catch (unavailable: Throwable) {
    // Swallowing this is what made the screen say "нет разрешения" for
    // every possible failure, for ever, with nothing to go on. It is still
    // not granted as far as the caller is concerned, but the reason is kept.
    lastRefusal = describe(unavailable)
    false
  }

  /**
   * The whole chain, walked one link at a time.
   *
   * Four things have to be true before a night appears here — Health
   * Connect installed, reachable, readable by this app, and written to by
   * the watch's app — and from the screen all four failures look like
   * nothing happening. Each is asked separately and reports what it found,
   * including which apps wrote the nights that are there, because "пусто"
   * and "есть, но не от часов" need different fixing.
   */
  @JavascriptInterface
  fun diagnose(id: String, days: String) {
    scope.launch {
      val steps = JSONArray()
      fun note(name: String, ok: Boolean, detail: String) {
        steps.put(JSONObject().put("name", name).put("ok", ok).put("detail", detail))
      }

      val sdk = HealthConnectClient.getSdkStatus(activity)
      val sdkOk = sdk == HealthConnectClient.SDK_AVAILABLE
      note(
        "Health Connect на телефоне",
        sdkOk,
        when (sdk) {
          HealthConnectClient.SDK_AVAILABLE -> "есть"
          HealthConnectClient.SDK_UNAVAILABLE -> "не установлен"
          HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "устарел, нужно обновить"
          else -> "неизвестное состояние: $sdk"
        },
      )
      if (!sdkOk) return@launch deliver(JSONObject().put("id", id).put("steps", steps))

      val client = try {
        HealthConnectClient.getOrCreate(activity).also { note("Подключение", true, "ок") }
      } catch (failure: Throwable) {
        note("Подключение", false, describe(failure))
        return@launch deliver(JSONObject().put("id", id).put("steps", steps))
      }

      val held = try {
        client.permissionController.getGrantedPermissions()
      } catch (failure: Throwable) {
        note("Разрешение на чтение сна", false, describe(failure))
        return@launch deliver(JSONObject().put("id", id).put("steps", steps))
      }
      val allowed = held.containsAll(permissions)
      note(
        "Разрешение на чтение сна",
        allowed,
        if (allowed) "выдано" else "не выдано. Всего разрешений у приложения: ${held.size}",
      )
      if (!allowed) return@launch deliver(JSONObject().put("id", id).put("steps", steps))

      try {
        val from = Instant.now().minusSeconds(days.toLong() * 86_400L)
        val found = client.readRecords(
          ReadRecordsRequest(
            recordType = SleepSessionRecord::class,
            timeRangeFilter = TimeRangeFilter.between(from, Instant.now()),
          ),
        ).records
        val writers = found.map { it.metadata.dataOrigin.packageName }.distinct()
        val withStages = found.count { it.stages.isNotEmpty() }
        note(
          "Ночи в хранилище за $days дней",
          found.isNotEmpty(),
          if (found.isEmpty()) {
            "ни одной — значит приложение часов туда ещё ничего не записало"
          } else {
            "${found.size}, из них с фазами ${withStages}. Записали: ${writers.joinToString(", ")}"
          },
        )
      } catch (failure: Throwable) {
        note("Ночи в хранилище", false, describe(failure))
      }
      deliver(JSONObject().put("id", id).put("steps", steps))
    }
  }

  /**
   * Opens Health Connect's own permission screen.
   *
   * Returns what went wrong, or an empty string. It used to return nothing
   * and push failures into the same channel the reads use, under an id
   * nothing was waiting for — so every failure here was dropped on the
   * floor, and a button that could not open anything looked like a button
   * that did nothing. Whether permission was *granted* still cannot be
   * returned: that answer is given to Health Connect, not to this app, and
   * the page re-reads the status when its owner comes back.
   *
   * Started on the main thread: a method called over the JavaScript bridge
   * runs on a binder thread, and an activity has no business being launched
   * from one.
   */
  @JavascriptInterface
  fun requestPermission(): String = onMain {
    activity.startActivity(
      PermissionController.createRequestPermissionResultContract().createIntent(activity, permissions),
    )
  }

  /**
   * The apps a watch writes through, in the order they are worth trying.
   *
   * There is no connecting to a watch app directly: none of them exposes
   * anything to a third party. The only road is the one already built —
   * their app writes to Health Connect and this reads from it — so the help
   * this can offer is to open the place where that is switched on, rather
   * than describing a menu whose wording differs between versions.
   */
  private val watchApps = listOf(
    "com.xiaomi.wearable" to "Mi Fitness",
    "com.xiaomi.hm.health" to "Zepp Life",
    "com.huami.watch.hmwatchmanager" to "Zepp",
  )

  /** "com.xiaomi.wearable|Mi Fitness" for the first one installed, else "". */
  @JavascriptInterface
  fun watchApp(): String {
    for ((id, name) in watchApps) {
      if (activity.packageManager.getLaunchIntentForPackage(id) != null) return "$id|$name"
    }
    return ""
  }

  /** Opens the watch's own app, where writing to Health Connect is turned on. */
  @JavascriptInterface
  fun openWatchApp(): String = onMain {
    val found = watchApps.firstOrNull {
      activity.packageManager.getLaunchIntentForPackage(it.first) != null
    } ?: throw IllegalStateException("приложение часов не найдено на телефоне")
    activity.startActivity(activity.packageManager.getLaunchIntentForPackage(found.first))
  }

  /**
   * Opens Health Connect itself.
   *
   * Two actions, because it moved: from Android 14 it is part of the system
   * and answers the platform action, and before that it is an app of its own
   * with an action of its own. Trying one and falling back to the other is
   * shorter than deciding by version which of them this phone is.
   */
  @JavascriptInterface
  fun openHealthConnect(): String = onMain {
    val actions = listOf(
      "android.health.connect.action.HEALTH_HOME_SETTINGS",
      "androidx.health.ACTION_HEALTH_CONNECT_SETTINGS",
    )
    val opened = actions.any { action ->
      val intent = Intent(action)
      if (intent.resolveActivity(activity.packageManager) == null) false
      else {
        activity.startActivity(intent)
        true
      }
    }
    if (!opened) throw IllegalStateException("Health Connect не отвечает на запрос открытия")
  }

  /**
   * Runs on the main thread and reports what went wrong, or an empty string.
   *
   * A method called over the JavaScript bridge arrives on a binder thread,
   * which is no place to start an activity from; and a failure that is not
   * returned here is a button that does nothing and says nothing, which is
   * how the permission screen hid its own absence for a day.
   */
  private fun onMain(work: () -> Unit): String {
    val failed = arrayOfNulls<String>(1)
    val done = java.util.concurrent.CountDownLatch(1)
    activity.runOnUiThread {
      try {
        work()
      } catch (failure: Throwable) {
        failed[0] = describe(failure)
      } finally {
        done.countDown()
      }
    }
    done.await(5, java.util.concurrent.TimeUnit.SECONDS)
    return failed[0].orEmpty()
  }

  /** Reads the nights between two instants and hands them to the page. */
  @JavascriptInterface
  fun read(id: String, fromMillis: String, toMillis: String) {
    scope.launch {
      val answer = JSONObject().put("id", id)
      try {
        val client = HealthConnectClient.getOrCreate(activity)
        val response = client.readRecords(
          ReadRecordsRequest(
            recordType = SleepSessionRecord::class,
            timeRangeFilter = TimeRangeFilter.between(
              Instant.ofEpochMilli(fromMillis.toLong()),
              Instant.ofEpochMilli(toMillis.toLong()),
            ),
          ),
        )
        answer.put("nights", nights(response.records))
      } catch (failure: Throwable) {
        answer.put("error", describe(failure))
      }
      deliver(answer)
    }
  }

  private fun nights(records: List<SleepSessionRecord>): JSONArray {
    val out = JSONArray()
    for (record in records) {
      val stages = JSONArray()
      for (stage in record.stages) {
        stages.put(
          JSONObject()
            .put("type", nameOf(stage.stage))
            .put("start", stage.startTime.toEpochMilli())
            .put("end", stage.endTime.toEpochMilli()),
        )
      }
      out.put(
        JSONObject()
          .put("start", record.startTime.toEpochMilli())
          .put("end", record.endTime.toEpochMilli())
          // Which app wrote it. Worth showing: it is the difference between
          // "the watch is not syncing" and "nothing was recorded last night".
          .put("source", record.metadata.dataOrigin.packageName)
          .put("stages", stages),
      )
    }
    return out
  }

  private fun nameOf(stage: Int): String = when (stage) {
    SleepSessionRecord.STAGE_TYPE_DEEP -> "deep"
    SleepSessionRecord.STAGE_TYPE_LIGHT -> "light"
    SleepSessionRecord.STAGE_TYPE_REM -> "rem"
    SleepSessionRecord.STAGE_TYPE_AWAKE,
    SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED,
    -> "awake"
    SleepSessionRecord.STAGE_TYPE_OUT_OF_BED -> "out_of_bed"
    SleepSessionRecord.STAGE_TYPE_SLEEPING -> "asleep"
    else -> "unknown"
  }

  /** The thrower's own words, which a translated message would throw away. */
  private fun describe(failure: Throwable): String {
    val said = failure.message?.trim().orEmpty()
    return if (said.isEmpty()) failure.javaClass.simpleName else "${failure.javaClass.simpleName}: $said"
  }

  private fun deliver(payload: JSONObject) {
    val quoted = JSONObject.quote(payload.toString())
    web.post {
      web.evaluateJavascript("window.__fastloopSleep && window.__fastloopSleep($quoted)", null)
    }
  }
}
