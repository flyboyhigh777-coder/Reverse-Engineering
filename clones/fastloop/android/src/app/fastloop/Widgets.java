package app.fastloop;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
  }

  private static void push(Context context, AppWidgetManager manager, Class<?> provider) {
    int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
    if (ids == null || ids.length == 0) return;
    for (int id : ids) {
      manager.updateAppWidget(id, provider == TimerWidget.class ? timer(context) : summary(context));
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

  static RemoteViews timer(Context context) {
    JSONObject state = read(context);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_timer);
    views.setOnClickPendingIntent(R.id.root, openApp(context));

    views.setTextViewText(R.id.plan, state == null ? "FastLoop" : state.optString("plan", "FastLoop"));
    views.setTextViewText(R.id.caption, applyClock(views, state));

    int done = state == null ? 0 : percent(state.optDouble("elapsedHours", 0), state.optDouble("planHours", 0));
    views.setProgressBar(R.id.bar, 100, done, false);
    return views;
  }

  static RemoteViews summary(Context context) {
    JSONObject state = read(context);
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_summary);
    views.setOnClickPendingIntent(R.id.root, openApp(context));

    views.setTextViewText(R.id.plan, state == null ? "FastLoop" : state.optString("plan", "FastLoop"));
    views.setTextViewText(R.id.caption, applyClock(views, state));

    long water = state == null ? 0 : state.optLong("waterMl", 0);
    long waterGoal = state == null ? 0 : state.optLong("waterGoalMl", 0);
    views.setTextViewText(R.id.row1, "Вода  " + water + " / " + waterGoal + " мл");
    views.setProgressBar(R.id.bar1, 100, percent(water, waterGoal), false);

    long steps = state == null ? 0 : state.optLong("steps", 0);
    long stepGoal = state == null ? 0 : state.optLong("stepGoal", 0);
    views.setTextViewText(R.id.row2, "Шаги  " + steps + " / " + stepGoal);
    views.setProgressBar(R.id.bar2, 100, percent(steps, stepGoal), false);

    long kcal = state == null ? 0 : state.optLong("kcal", 0);
    long kcalGoal = state == null ? 0 : state.optLong("kcalGoal", 0);
    if (kcalGoal > 0) {
      views.setTextViewText(R.id.row3, "Калории  " + kcal + " / " + kcalGoal);
      views.setProgressBar(R.id.bar3, 100, percent(kcal, kcalGoal), false);
    } else {
      views.setTextViewText(R.id.row3, "Калории  " + kcal);
      views.setProgressBar(R.id.bar3, 100, 0, false);
    }
    return views;
  }
}
