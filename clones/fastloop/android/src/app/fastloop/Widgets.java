package app.fastloop;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.SweepGradient;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

/**
 * What the home-screen widgets draw, and where their numbers come from.
 *
 * The app's records live in the WebView's own storage, which no other
 * process can read. So the page hands a small summary to the host whenever
 * it changes, the host keeps it in SharedPreferences, and the widgets render
 * from there. Nothing is computed twice: the widget shows what the app
 * already decided.
 *
 * The countdown is a Chronometer rather than a number the host refreshes.
 * It ticks by itself in the launcher's process, so a running fast stays
 * correct to the second without waking this app at all — which is why the
 * provider asks for no update period.
 */
final class Widgets {

  private static final String PREFS = "fastloop.widget";
  private static final String KEY_STATE = "state";

  private Widgets() {}

  static void store(Context context, String json) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_STATE, json).apply();
    refresh(context);
  }

  private static JSONObject read(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    String raw = prefs.getString(KEY_STATE, null);
    if (raw == null) return null;
    try {
      return new JSONObject(raw);
    } catch (Exception malformed) {
      return null;
    }
  }

  /** Redraws every placed widget of both kinds. */
  static void refresh(Context context) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    push(context, manager, TimerWidget.class);
    push(context, manager, SummaryWidget.class);
    push(context, manager, RingWidget.class);
  }

  private static void push(Context context, AppWidgetManager manager, Class<?> provider) {
    int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
    if (ids == null || ids.length == 0) return;
    for (int id : ids) {
      RemoteViews views =
          provider == TimerWidget.class
              ? timer(context)
              : provider == SummaryWidget.class ? summary(context) : ring(context);
      manager.updateAppWidget(id, views);
    }
  }

  private static PendingIntent openApp(Context context) {
    Intent intent = new Intent(context, MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);
  }

  /** Percent of a goal, clamped — a bar past its end tells nobody anything. */
  private static int percent(double value, double goal) {
    if (goal <= 0) return 0;
    return (int) Math.max(0, Math.min(100, Math.round(value / goal * 100)));
  }

  private static String hoursLabel(double hours) {
    long whole = Math.round(hours);
    return whole + " ч";
  }

  /**
   * Points the chronometer at the end of the window, or at how far past it
   * the fast has run. Returns the caption that belongs with it.
   */
  private static String applyClock(RemoteViews views, JSONObject state) {
    boolean running = state != null && state.optBoolean("running", false);
    if (!running) {
      views.setViewVisibility(R.id.clock, View.GONE);
      views.setViewVisibility(R.id.idle, View.VISIBLE);
      double planHours = state == null ? 0 : state.optDouble("planHours", 0);
      views.setTextViewText(R.id.idle, planHours > 0 ? hoursLabel(planHours) : "—");
      return state == null ? "откройте приложение" : "голодание не запущено";
    }

    long targetEndAt = state.optLong("targetEndAt", 0);
    long now = System.currentTimeMillis();
    views.setViewVisibility(R.id.idle, View.GONE);
    views.setViewVisibility(R.id.clock, View.VISIBLE);

    if (targetEndAt > now) {
      views.setChronometerCountDown(R.id.clock, true);
      views.setChronometer(R.id.clock, SystemClock.elapsedRealtime() + (targetEndAt - now), null, true);
      return "осталось";
    }
    views.setChronometerCountDown(R.id.clock, false);
    views.setChronometer(R.id.clock, SystemClock.elapsedRealtime() - (now - targetEndAt), null, true);
    return "цель пройдена на";
  }

  /**
   * Height, in dp, below which the three counters are dropped.
   *
   * The clock, its caption and the fast's own rail need about ninety; each
   * counter adds thirty. Under this the block would be clipped mid-rail,
   * and a cut-off gauge reads worse than a widget that simply shows the
   * fast.
   */
  private static final int EXTRAS_MIN_DP = 200;

  static RemoteViews timer(Context context) {
    return timer(context, 0, null);
  }

  static RemoteViews timer(Context context, int widgetId, AppWidgetManager manager) {
    JSONObject state = read(context);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_timer);
    views.setOnClickPendingIntent(R.id.root, openApp(context));

    views.setViewVisibility(R.id.extras, tallEnough(widgetId, manager) ? View.VISIBLE : View.GONE);

    views.setTextViewText(R.id.plan, state == null ? "FastLoop" : state.optString("plan", "FastLoop"));
    views.setTextViewText(R.id.caption, applyClock(views, state));
    counters(views, state);

    int done = state == null ? 0 : percent(state.optDouble("elapsedHours", 0), state.optDouble("planHours", 0));
    views.setProgressBar(R.id.bar, 100, done, false);
    return views;
  }

  private static final int RING_PX = 240;

  /**
   * The progress arc, drawn rather than laid out.
   *
   * RemoteViews can only inflate a fixed set of views, and none of them is a
   * circular progress indicator. A bitmap sidesteps that: the host draws it
   * here, in this app's process, and hands the result to the launcher.
   */
  private static Bitmap ringBitmap(Context context, double ratio) {
    Bitmap bitmap = Bitmap.createBitmap(RING_PX, RING_PX, Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(bitmap);

    Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    paint.setStyle(Paint.Style.FILL);
    paint.setColor(context.getColor(R.color.w_surface));
    canvas.drawCircle(RING_PX / 2f, RING_PX / 2f, RING_PX / 2f - 2f, paint);

    float stroke = 18f;
    RectF box = new RectF(stroke, stroke, RING_PX - stroke, RING_PX - stroke);
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(stroke);

    // The unfilled ring is a dimmed sweep of the widget's own three hues
    // rather than one flat grey. Before a fast is started the arc is empty,
    // and an empty grey donut is the whole widget: this way the thing still
    // reads as lit, and starting a fast brightens a circle that was already
    // there rather than drawing one from nothing.
    Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
    track.setStyle(Paint.Style.STROKE);
    track.setStrokeWidth(stroke);
    track.setShader(new SweepGradient(
        RING_PX / 2f,
        RING_PX / 2f,
        new int[] {0x4DC6F94F, 0x4D27E0C4, 0x4D8E6BFF, 0x4DC6F94F},
        null));
    canvas.drawArc(box, -90f, 360f, false, track);

    if (ratio > 0) {
      int lit = context.getColor(ratio >= 1 ? R.color.w_warm : R.color.w_accent);
      float sweep = (float) (360 * Math.min(1, ratio));

      // The glow is a second, blurred pass under the sharp arc. A widget
      // cannot carry a shadow layer, so the light has to be painted.
      Paint halo = new Paint(Paint.ANTI_ALIAS_FLAG);
      halo.setStyle(Paint.Style.STROKE);
      halo.setStrokeWidth(stroke * 1.5f);
      halo.setStrokeCap(Paint.Cap.ROUND);
      halo.setColor(lit);
      halo.setAlpha(110);
      halo.setMaskFilter(new BlurMaskFilter(stroke * 0.9f, BlurMaskFilter.Blur.NORMAL));
      canvas.drawArc(box, -90f, sweep, false, halo);

      paint.setStrokeCap(Paint.Cap.ROUND);
      paint.setColor(lit);
      canvas.drawArc(box, -90f, sweep, false, paint);
    }
    return bitmap;
  }

  static RemoteViews ring(Context context) {
    JSONObject state = read(context);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_ring);
    views.setOnClickPendingIntent(R.id.root, openApp(context));

    boolean running = state != null && state.optBoolean("running", false);
    double planHours = state == null ? 0 : state.optDouble("planHours", 0);
    double elapsed = state == null ? 0 : state.optDouble("elapsedHours", 0);
    double ratio = planHours > 0 ? elapsed / planHours : 0;

    views.setImageViewBitmap(R.id.ring, ringBitmap(context, running ? ratio : 0));
    views.setTextViewText(R.id.plan, state == null ? "FastLoop" : state.optString("plan", "FastLoop"));

    if (!running) {
      views.setViewVisibility(R.id.clock, View.GONE);
      views.setViewVisibility(R.id.idle, View.VISIBLE);
      views.setTextViewText(R.id.idle, planHours > 0 ? hoursLabel(planHours) : "—");
      views.setTextViewText(R.id.caption, state == null ? "откройте приложение" : "не запущено");
      return views;
    }

    // Counts up from the start of the fast: what the person asked to see is
    // how long they have held it, not how long is left.
    long startedAt = state.optLong("targetEndAt", 0) - Math.round(planHours * 3_600_000d);
    long since = Math.max(0, System.currentTimeMillis() - startedAt);
    views.setViewVisibility(R.id.idle, View.GONE);
    views.setViewVisibility(R.id.clock, View.VISIBLE);
    views.setChronometerCountDown(R.id.clock, false);
    views.setChronometer(R.id.clock, SystemClock.elapsedRealtime() - since, null, true);
    views.setTextViewText(R.id.caption, ratio >= 1 ? "цель взята" : "идёт голодание");
    return views;
  }

  /**
   * Whether the host has given this widget enough height for the counters.
   *
   * Without a manager there is nothing to ask — an update that did not come
   * from the host, or a device that does not report it — and the counters
   * are kept: the declared default is four cells by two, which is tall
   * enough, and hiding them on a guess would lose them for everyone.
   */
  private static boolean tallEnough(int widgetId, AppWidgetManager manager) {
    if (manager == null || widgetId == 0) return true;
    Bundle options = manager.getAppWidgetOptions(widgetId);
    if (options == null) return true;
    int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
    return height == 0 || height >= EXTRAS_MIN_DP;
  }

  static RemoteViews summary(Context context) {
    JSONObject state = read(context);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_summary);
    views.setOnClickPendingIntent(R.id.root, openApp(context));

    views.setTextViewText(R.id.plan, state == null ? "FastLoop" : state.optString("plan", "FastLoop"));
    views.setTextViewText(R.id.caption, applyClock(views, state));

    counters(views, state);
    return views;
  }

  /**
   * The three daily counters, bound the same way wherever they appear.
   *
   * Both the wide and the middle widget carry them, and they are laid out
   * with the same ids in both, so one method fills either: a second copy of
   * this would be a second place for the goal handling to drift.
   */
  private static void counters(RemoteViews views, JSONObject state) {
    long water = state == null ? 0 : state.optLong("waterMl", 0);
    long waterGoal = state == null ? 0 : state.optLong("waterGoalMl", 0);
    views.setTextViewText(R.id.row1, "Вода");
    views.setTextViewText(R.id.val1, goalText(water, waterGoal, " мл"));
    views.setProgressBar(R.id.bar1, 100, percent(water, waterGoal), false);

    long steps = state == null ? 0 : state.optLong("steps", 0);
    long stepGoal = state == null ? 0 : state.optLong("stepGoal", 0);
    views.setTextViewText(R.id.row2, "Шаги");
    views.setTextViewText(R.id.val2, goalText(steps, stepGoal, ""));
    views.setProgressBar(R.id.bar2, 100, percent(steps, stepGoal), false);

    long kcal = state == null ? 0 : state.optLong("kcal", 0);
    long kcalGoal = state == null ? 0 : state.optLong("kcalGoal", 0);
    views.setTextViewText(R.id.row3, "Калории");
    views.setTextViewText(R.id.val3, goalText(kcal, kcalGoal, ""));
    views.setProgressBar(R.id.bar3, 100, kcalGoal > 0 ? percent(kcal, kcalGoal) : 0, false);
  }

  /**
   * "0 / 1900 мл", or just the count where there is no goal to measure it
   * against — a denominator of zero is not a target, it is a blank.
   */
  private static String goalText(long value, long goal, String unit) {
    return goal > 0 ? value + " / " + goal + unit : value + unit;
  }
}
