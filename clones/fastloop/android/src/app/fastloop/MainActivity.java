package app.fastloop;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * FastLoop shell: the built web app from assets, plus the one thing a browser
 * cannot do — read the phone's hardware step counter.
 */
public class MainActivity extends Activity {

  private static final int REQ_ACTIVITY_RECOGNITION = 11;
  private static final int REQ_PICK_IMAGE = 12;

  private WebView web;
  private StepCounter steps;
  /** Held between opening the picker and the result coming back. */
  private ValueCallback<Uri[]> pendingFiles;
  /** Where the camera was told to write, when the camera was offered. */
  private Uri cameraOutput;

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

    web.setWebViewClient(new WebViewClient() {
      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        syncTheme();
      }
    });
    // Without this a file input inside a WebView does nothing at all: the
    // tap is delivered to the page, the page opens a picker, and the host has
    // to be the one that actually shows it.
    web.setWebChromeClient(new WebChromeClient() {
      @Override
      public boolean onShowFileChooser(
          WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        return openImagePicker(callback);
      }
    });
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

  /**
   * Whether the system is in night mode.
   *
   * WebView only reports prefers-color-scheme: dark reliably on recent API
   * levels and recent WebView builds, so the page is told directly instead.
   * The page applies it through its own data-theme attribute, which works on
   * every version this app supports.
   */
  private boolean isNightMode() {
    int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
    return mode == Configuration.UI_MODE_NIGHT_YES;
  }

  private void syncTheme() {
    if (web == null) return;
    web.evaluateJavascript("window.__fastloopSystemTheme && window.__fastloopSystemTheme()", null);
  }

  @Override
  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    // uiMode is in configChanges, so the activity survives the switch and
    // only has to tell the page about it.
    syncTheme();
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

  /**
   * Shows the camera and the gallery in one chooser.
   *
   * The camera needs somewhere to write, and a file:// path handed to another
   * app throws on API 24+. A MediaStore row gives a content:// destination
   * with no permission and no FileProvider, which this build has no way to
   * declare — but only from API 29. Below that the gallery is offered alone
   * rather than asking for storage access the app would otherwise never need.
   */
  private boolean openImagePicker(ValueCallback<Uri[]> callback) {
    if (pendingFiles != null) {
      pendingFiles.onReceiveValue(null);
    }
    pendingFiles = callback;
    cameraOutput = null;

    Intent gallery = new Intent(Intent.ACTION_GET_CONTENT);
    gallery.addCategory(Intent.CATEGORY_OPENABLE);
    gallery.setType("image/*");

    Intent chooser = Intent.createChooser(gallery, "Снимок блюда");

    if (Build.VERSION.SDK_INT >= 29) {
      try {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, "fastloop-" + System.currentTimeMillis() + ".jpg");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        cameraOutput = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (cameraOutput != null) {
          Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
          camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutput);
          camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
          chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] {camera});
        }
      } catch (Exception unavailable) {
        cameraOutput = null;
      }
    }

    try {
      startActivityForResult(chooser, REQ_PICK_IMAGE);
      return true;
    } catch (Exception noPicker) {
      pendingFiles = null;
      callback.onReceiveValue(null);
      return false;
    }
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    if (requestCode != REQ_PICK_IMAGE) {
      super.onActivityResult(requestCode, resultCode, data);
      return;
    }
    ValueCallback<Uri[]> callback = pendingFiles;
    pendingFiles = null;
    if (callback == null) return;

    // The gallery answers with a uri in the intent; the camera wrote to the
    // row we created and returns nothing. Cancelling must still answer, or
    // the file input stays stuck and never opens again.
    Uri picked = resultCode == RESULT_OK && data != null ? data.getData() : null;
    if (picked == null && resultCode == RESULT_OK) picked = cameraOutput;
    callback.onReceiveValue(picked == null ? null : new Uri[] {picked});
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

    /**
     * The page hands over a small summary for the home-screen widgets.
     *
     * The widgets cannot read the WebView's storage, so this is the only way
     * their numbers exist outside the app. Stored as the page sent it and
     * parsed when a widget is drawn — storing it already parsed would mean
     * migrating the stored shape every time a field is added.
     */
    @JavascriptInterface
    public void publishWidgetState(String json) {
      if (json == null || json.length() > 8192) return;
      Widgets.store(MainActivity.this, json);
    }

    @JavascriptInterface
    public boolean isNightMode() {
      return MainActivity.this.isNightMode();
    }

    @JavascriptInterface
    public String appVersion() {
      try {
        return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
      } catch (Exception unavailable) {
        return "?";
      }
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
          + "; " + steps.state()
          + "; последнее событие: " + (since < 0 ? "не было" : since + " с назад")
          + (steps.lastError().isEmpty() ? "" : "; ошибка: " + steps.lastError());
    }
  }
}
