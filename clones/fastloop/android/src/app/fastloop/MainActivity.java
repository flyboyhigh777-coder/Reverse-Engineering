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
import android.webkit.WebResourceRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;
import org.json.JSONObject;

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
    // The page is served from file://, and the recipe photographs come from
    // https. That is not mixed content, but WebView's default on a non-secure
    // origin is strict enough that some builds drop the images anyway.
    settings.setBlockNetworkImage(false);
    settings.setLoadsImagesAutomatically(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
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

      /**
       * Links leave the app instead of replacing it.
       *
       * The page is the app: letting a tap load some other site into this
       * WebView would navigate the app away with nothing to come back to.
       * And the one link that matters is the page that issues a Google API
       * key, which Google refuses to serve inside a WebView at all — it
       * answers a sign-in there with disallowed_useragent. So http(s) goes
       * to whichever browser the phone uses, and everything else stays here.
       */
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return openExternally(request.getUrl());
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

  /**
   * Hands an http(s) address to the system browser.
   *
   * Returns true when the WebView should not load it itself — which includes
   * the case where no browser took it, because loading the app away from its
   * own page is worse than a tap that does nothing.
   */
  private boolean openExternally(Uri url) {
    if (url == null) return false;
    String scheme = url.getScheme();
    if (scheme == null) return false;
    if (!"http".equals(scheme) && !"https".equals(scheme)) return false;
    try {
      Intent view = new Intent(Intent.ACTION_VIEW, url);
      view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      startActivity(view);
    } catch (Exception ignored) {
      // No browser, or none that would take it. Staying put is the safe end.
    }
    return true;
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

  private static final int HTTP_LIMIT = 2 * 1024 * 1024;

  /** Reads a response body, refusing one large enough to choke the WebView. */
  private static String readBody(InputStream in) throws Exception {
    if (in == null) return "";
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] chunk = new byte[8192];
    int read;
    while ((read = in.read(chunk)) > 0) {
      out.write(chunk, 0, read);
      if (out.size() > HTTP_LIMIT) throw new IllegalStateException("ответ слишком большой");
    }
    return out.toString("UTF-8");
  }

  /** Hands the result back to the page as a JSON string literal. */
  private void deliverHttp(final String payload) {
    runOnUiThread(new Runnable() {
      @Override
      public void run() {
        if (web == null) return;
        web.evaluateJavascript(
            "window.__fastloopHttp && window.__fastloopHttp(" + JSONObject.quote(payload) + ")", null);
      }
    });
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

    /**
     * Makes a request on the page's behalf.
     *
     * The page is served from file://, an opaque origin, so a browser refuses
     * its cross-origin requests before sending them — no header the server
     * returns can change that. Performed here instead, where no origin rule
     * applies. Runs off the UI thread and answers through a callback,
     * because a @JavascriptInterface method blocks the page while it runs.
     */
    @JavascriptInterface
    public void httpRequest(
        final String id, final String method, final String url, final String headers, final String body) {
      new Thread(new Runnable() {
        @Override
        public void run() {
          JSONObject result = new JSONObject();
          HttpURLConnection connection = null;
          try {
            result.put("id", id);
            connection = (HttpURLConnection) new URL(url).openConnection();
            // 15 + 45 stays under the page's 75s backstop, so a request
            // that fails here reports why instead of being cut off blind.
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(45000);
            connection.setRequestMethod(method == null || method.isEmpty() ? "GET" : method);
            connection.setInstanceFollowRedirects(true);

            if (headers != null && headers.length() > 2) {
              JSONObject parsed = new JSONObject(headers);
              for (Iterator<String> keys = parsed.keys(); keys.hasNext(); ) {
                String key = keys.next();
                connection.setRequestProperty(key, parsed.getString(key));
              }
            }

            if (body != null && body.length() > 0) {
              connection.setDoOutput(true);
              OutputStream out = connection.getOutputStream();
              out.write(body.getBytes("UTF-8"));
              out.close();
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            result.put("status", status);
            result.put("body", readBody(stream));
          } catch (Exception failure) {
            try {
              result.put("id", id);
              result.put("status", 0);
              result.put("error", String.valueOf(failure.getMessage()));
            } catch (Exception ignored) {
              // Nothing can be reported if even the envelope fails to build.
            }
          } finally {
            if (connection != null) connection.disconnect();
          }
          deliverHttp(result.toString());
        }
      }).start();
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
