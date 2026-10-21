package app.fastloop;


/** Scenarios for the step baseline. Run with the class on the classpath. */
public final class StepTest {
  static int failures = 0;

  static void check(String name, float actual, float expected) {
    boolean ok = Math.abs(actual - expected) < 0.001f;
    if (!ok) failures += 1;
    System.out.println((ok ? "ok   " : "FAIL ") + name + " → " + actual + " (ожидалось " + expected + ")");
  }

  public static void main(String[] args) {
    final String today = "2026-10-21";
    final String yest = "2026-10-20";

    check("первый запуск: сегодня начинается отсюда",
        StepCounter.nextBaseline(5000f, today, yest, null, -1f, -1f, false), 5000f);

    check("тот же день: база не двигается",
        StepCounter.nextBaseline(5400f, today, yest, today, 5000f, 5300f, false), 5000f);

    check("следующий день: база = последнее вчерашнее показание",
        StepCounter.nextBaseline(9000f, today, yest, yest, 5000f, 8200f, false), 8200f);

    check("пропущено несколько дней: переносить нечего",
        StepCounter.nextBaseline(40000f, today, yest, "2026-10-15", 5000f, 9000f, false), 40000f);

    check("перезагрузка сегодня: считаем всё с момента загрузки",
        StepCounter.nextBaseline(120f, today, yest, today, 9000f, 9500f, true), 0f);

    check("перезагрузка вчера: начинаем от текущего показания",
        StepCounter.nextBaseline(120f, today, yest, yest, 9000f, 9500f, false), 120f);

    check("новый день без прошлого показания: берём текущее",
        StepCounter.nextBaseline(7000f, today, yest, yest, 5000f, -1f, false), 7000f);

    // The bug this fixes, end to end: app opened only in the evening.
    float morning = 6000f;      // walked before opening the app
    float atOpen = 6000f;       // counter when the app is finally opened
    float yesterdayLast = 0f;   // last reading taken last night, before the walk
    float base = StepCounter.nextBaseline(atOpen, today, yest, yest, 0f, yesterdayLast, false);
    check("вечернее открытие: утренние шаги не теряются", atOpen - base, morning);

    System.out.println(failures == 0 ? "ВСЁ ПРОШЛО" : failures + " ПРОВАЛЕНО");
    if (failures > 0) System.exit(1);
  }
}
