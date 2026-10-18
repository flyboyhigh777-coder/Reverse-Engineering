package tools.fastloop;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * FastLoop shell: the built web app from assets, plus the one thing a browser
 * cannot do — read the phone's hardware step counter.
 */
public class MainActivity extends Activity {

  private static final int REQ_ACTIVITY_RECOGNITION = 11;

  private WebView web;
  private StepCounter steps;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    steps = new StepCounter(this);

    web = new WebView(this);
    web.setLayoutParams(new ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setDatabaseEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(true);
    // Let the page's own prefers-color-scheme rules follow the system theme
    // instead of having WebView invert the pixels.
    if (Build.VERSION.SDK_INT >= 33) {
      settings.setAlgorithmicDarkeningAllowed(true);
    }

    web.setWebViewClient(new WebViewClient());
    web.addJavascriptInterface(new Bridge(), "FastLoopNative");
    setContentView(web);
    web.loadUrl("file:///android_asset/index.html");

    // Ask first, resolve the sensor afterwards: on API 29+ the step counter
    // is behind ACTIVITY_RECOGNITION, so gating the request on "is there a
    // sensor" can deadlock — the lookup may come back empty precisely because
    // the permission has not been granted yet.
    if (!hasActivityPermission()) {
      requestActivityPermission();
    } else {
      steps.start();
    }
  }

  private boolean hasActivityPermission() {
    if (Build.VERSION.SDK_INT < 29) return true;
    return checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)
        == PackageManager.PERMISSION_GRANTED;
  }

  private void requestActivityPermission() {
    if (Build.VERSION.SDK_INT < 29) return;
    requestPermissions(new String[] { Manifest.permission.ACTIVITY_RECOGNITION },
        REQ_ACTIVITY_RECOGNITION);
  }

  @Override
  public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(code, permissions, results);
    if (code == REQ_ACTIVITY_RECOGNITION && hasActivityPermission()) {
      steps.start();
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (hasActivityPermission()) steps.start();
  }

  @Override
  protected void onPause() {
    steps.stop();
    super.onPause();
  }

  @Override
  public void onBackPressed() {
    // The app navigates by state, not by history, so back leaves the app.
    finish();
  }

  /** Exposed to the page as window.FastLoopNative. */
  private final class Bridge {

    @JavascriptInterface
    public int getStepsToday() {
      return steps.stepsToday();
    }

    @JavascriptInterface
    public boolean hasStepSensor() {
      return steps.hasSensor();
    }

    @JavascriptInterface
    public boolean hasPermission() {
      return hasActivityPermission();
    }

    @JavascriptInterface
    public void requestPermission() {
      runOnUiThread(new Runnable() {
        @Override
        public void run() {
          requestActivityPermission();
        }
      });
    }

    @JavascriptInterface
    public String appVersion() {
      return "0.5.0";
    }

    /** Plain-text state for the diagnostics block in the steps sheet. */
    @JavascriptInterface
    public String diagnostics() {
      long since = steps.lastEventAt() == 0 ? -1 : (System.currentTimeMillis() - steps.lastEventAt()) / 1000;
      return "Android API " + Build.VERSION.SDK_INT
          + "; датчик: " + (steps.hasSensor() ? "есть" : "нет")
          + "; разрешение: " + (hasActivityPermission() ? "выдано" : "нет")
          + "; подписка: " + (steps.listening() ? "активна" : "нет")
          + "; шагов: " + steps.stepsToday()
          + "; последнее событие: " + (since < 0 ? "не было" : since + " с назад")
          + (steps.lastError().isEmpty() ? "" : "; ошибка: " + steps.lastError());
    }
  }
}
