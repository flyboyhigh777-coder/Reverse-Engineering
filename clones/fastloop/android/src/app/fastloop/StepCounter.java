package app.fastloop;

import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Today's step count from TYPE_STEP_COUNTER.
 *
 * The sensor counts steps since boot and keeps counting while the app is
 * closed, but Android keeps no per-day history and the listener only runs
 * while the app is in the foreground. So the day's figure is the current
 * reading minus a baseline for that day, and the whole question is what the
 * baseline should be.
 *
 * Taking it at the first foreground reading of the day — the obvious choice,
 * and what this did until 0.11.3 — throws away every step between midnight
 * and the moment the app was opened. For anyone who opens the app in the
 * evening that is the entire day: real exports showed 235 steps for a full
 * day, then 0.
 *
 * The baseline is therefore carried over: it becomes the last reading taken
 * yesterday, so the steps walked while the app was shut are credited to
 * today. The error that remains is the mirror image and much smaller — steps
 * taken yesterday after the app was last closed land on today. The carry-over
 * is only applied across a single night; after a longer gap there is nothing
 * honest to carry, and the baseline is retaken from the current reading.
 *
 * The sensor is resolved lazily rather than in the constructor. On API 29+
 * the step counter sits behind ACTIVITY_RECOGNITION, so a lookup made before
 * the permission is granted can come back empty and must not be cached as
 * "this phone has no pedometer".
 */
final class StepCounter implements SensorEventListener {

  private static final String PREFS = "fastloop.steps";
  private static final String KEY_DAY = "day";
  private static final String KEY_BASELINE = "baseline";
  private static final String KEY_LAST_TOTAL = "lastTotal";

  private final SensorManager sensors;
  private final SharedPreferences prefs;
  private Sensor stepSensor;
  private volatile int stepsToday;
  private volatile boolean listening;
  private volatile long lastEventAt;
  private volatile String lastError = "";

  StepCounter(Context context) {
    this.sensors = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
    this.prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  private Sensor sensor() {
    if (stepSensor == null && sensors != null) {
      stepSensor = sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    }
    return stepSensor;
  }

  boolean hasSensor() {
    return sensor() != null;
  }

  int stepsToday() {
    return stepsToday;
  }

  boolean listening() {
    return listening;
  }

  long lastEventAt() {
    return lastEventAt;
  }

  String lastError() {
    return lastError;
  }

  void start() {
    Sensor target = sensor();
    if (target == null) {
      lastError = "датчик не найден";
      return;
    }
    if (listening) return;
    try {
      listening = sensors.registerListener(this, target, SensorManager.SENSOR_DELAY_NORMAL);
      lastError = listening ? "" : "система отклонила подписку";
    } catch (SecurityException denied) {
      listening = false;
      lastError = "нет разрешения: " + denied.getMessage();
    }
  }

  void stop() {
    if (!listening || sensors == null) return;
    sensors.unregisterListener(this);
    listening = false;
  }

  private static String format(Date date) {
    return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date);
  }

  private static String today() {
    return format(new Date());
  }

  private static String yesterday() {
    Calendar calendar = Calendar.getInstance();
    calendar.add(Calendar.DAY_OF_YEAR, -1);
    return format(calendar.getTime());
  }

  /** True when the device booted after midnight, so the counter restarted today. */
  private static boolean bootedToday() {
    long bootAt = System.currentTimeMillis() - SystemClock.elapsedRealtime();
    return today().equals(format(new Date(bootAt)));
  }

  @Override
  public void onSensorChanged(SensorEvent event) {
    if (event.values == null || event.values.length == 0) return;
    float total = event.values[0];
    String day = today();
    String savedDay = prefs.getString(KEY_DAY, null);
    float baseline = prefs.getFloat(KEY_BASELINE, -1f);
    float lastTotal = prefs.getFloat(KEY_LAST_TOTAL, -1f);

    float next = nextBaseline(total, day, yesterday(), savedDay, baseline, lastTotal, bootedToday());

    if (next != baseline || !day.equals(savedDay) || lastTotal != total) {
      baseline = next;
      prefs
          .edit()
          .putString(KEY_DAY, day)
          .putFloat(KEY_BASELINE, baseline)
          .putFloat(KEY_LAST_TOTAL, total)
          .apply();
    }
    stepsToday = Math.max(0, Math.round(total - baseline));
    lastEventAt = System.currentTimeMillis();
  }

  /**
   * Where today's count should start from, given what was stored.
   *
   * Pure on purpose: every branch here is a decision about attribution, and
   * decisions about attribution are the kind of thing that must be testable
   * without a phone, a sensor or a clock.
   */
  static float nextBaseline(
      float total,
      String day,
      String yesterday,
      String savedDay,
      float baseline,
      float lastTotal,
      boolean bootedToday) {
    // The counter restarted, so the device rebooted. Steps taken before the
    // reboot are gone from the sensor; only a boot that happened today lets
    // the reading be used whole.
    if (lastTotal >= 0f && total < lastTotal) return bootedToday ? 0f : total;
    // Nothing stored yet: today starts here, and the morning is lost once.
    if (savedDay == null || baseline < 0f) return total;
    // Same day: keep counting from where the day started.
    if (day.equals(savedDay)) return baseline;
    // One night across: credit today with what was walked while the app slept.
    if (savedDay.equals(yesterday) && lastTotal >= 0f) return lastTotal;
    // A longer gap holds days we never observed; there is nothing to carry.
    return total;
  }

  /** Baseline and raw counter, for the diagnostics block. */
  String state() {
    return "база " + Math.round(prefs.getFloat(KEY_BASELINE, -1f))
        + ", счётчик " + Math.round(prefs.getFloat(KEY_LAST_TOTAL, -1f))
        + ", день " + prefs.getString(KEY_DAY, "—");
  }

  @Override
  public void onAccuracyChanged(Sensor sensor, int accuracy) {
    // Step counts are integers; accuracy hints carry nothing to act on here.
  }
}
