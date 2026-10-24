package app.fastloop;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** The middle widget: the fast, and the day's counters where they fit. */
public final class TimerWidget extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    for (int id : ids) manager.updateAppWidget(id, Widgets.timer(context, id, manager));
  }

  /**
   * Resizing is a reason to rebuild.
   *
   * What fits is decided from the height the host reports, and that height
   * only changes here: without this the counters would stay hidden after
   * the widget was made taller, or stay clipped after it was made shorter,
   * until something else happened to trigger an update.
   */
  @Override
  public void onAppWidgetOptionsChanged(
      Context context, AppWidgetManager manager, int id, Bundle options) {
    super.onAppWidgetOptionsChanged(context, manager, id, options);
    manager.updateAppWidget(id, Widgets.timer(context, id, manager));
  }
}
