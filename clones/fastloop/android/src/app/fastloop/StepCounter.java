package app.fastloop;

import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Today's step count from TYPE_STEP_COUNTER.
 *
 * The sensor reports steps since boot and keeps counting while the app is
 * closed, so the day's figure is the current reading minus a baseline taken
 * at the first reading of that day. The baseline is persisted; a reading
 * below it means the device rebooted, and the baseline is retaken.
 *
 * The limit worth knowing: if the app is not opened at all on a given day,
 * the baseline for that day is first set when it is opened, so steps taken
 * before that are not attributed to it. The UI does not claim otherwise.
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

  private static String today() {
    return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
  }

  @Override
  public void onSensorChanged(SensorEvent event) {
    if (event.values == null || event.values.length == 0) return;
    float total = event.values[0];
    String day = today();
    String savedDay = prefs.getString(KEY_DAY, null);
    float baseline = prefs.getFloat(KEY_BASELINE, -1f);

    boolean newDay = !day.equals(savedDay);
    boolean rebooted = total < baseline;
    if (newDay || baseline < 0f || rebooted) {
      baseline = total;
      prefs.edit().putString(KEY_DAY, day).putFloat(KEY_BASELINE, baseline).apply();
    }
    stepsToday = Math.max(0, Math.round(total - baseline));
    lastEventAt = System.currentTimeMillis();
  }

  @Override
  public void onAccuracyChanged(Sensor sensor, int accuracy) {
    // Step counts are integers; accuracy hints carry nothing to act on here.
  }
}
