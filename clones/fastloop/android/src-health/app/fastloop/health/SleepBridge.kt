package app.fastloop.health

import android.app.Activity
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

  private fun granted(): Boolean = try {
    val client = HealthConnectClient.getOrCreate(activity)
    kotlinx.coroutines.runBlocking {
      client.permissionController.getGrantedPermissions().containsAll(permissions)
    }
  } catch (unavailable: Throwable) {
    false
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
  fun requestPermission(): String {
    val failed = arrayOfNulls<String>(1)
    val done = java.util.concurrent.CountDownLatch(1)
    activity.runOnUiThread {
      try {
        val intent = PermissionController.createRequestPermissionResultContract()
          .createIntent(activity, permissions)
        activity.startActivity(intent)
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
