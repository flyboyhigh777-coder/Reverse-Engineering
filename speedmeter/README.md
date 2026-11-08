# SpeedMeter

An independent Android internet speed test, written from an analysis of Speedtest by Ookla 7.1.4
rather than from its code. The analysis is in
[docs/REVERSE_ENGINEERING.md](docs/REVERSE_ENGINEERING.md); this file is about the result.

It measures download, upload, idle latency, jitter, probe loss and latency under load, against
either Cloudflare's public speed endpoints or any [LibreSpeed](https://github.com/librespeed/speedtest)
server - including one you host. Three permissions, no account, no ads, no analytics, no location.

## What it does

- A dial with a compressed scale, so a 10 Mbps link uses a quarter of the sweep instead of 1% of it.
- Live readout driven by a responsive moving average; a peak mark stays behind when the needle falls.
- Multiple connections, grown during a stage while throughput is still climbing.
- Stages end when the rate settles, instead of always running the clock down.
- A warm-up window that is measured but excluded, so TCP slow start does not drag the figure down.
- Latency measured again *during* the transfer - the bufferbloat number that an idle ping cannot show.
- Server selection by latency, probing candidates under a concurrency cap so they do not measure
  each other.
- History kept on the device in one JSON file, and a plain-text share.
- Three profiles: low-data, standard, thorough. Low-data caps a run at ~120 MB down / 60 MB up.

## Layout

```
speedmeter/
├── engine/   pure Kotlin/JVM measurement engine - no Android dependency, unit tested
└── app/      Jetpack Compose UI, settings, history
```

`engine` is deliberately free of Android types. That is what lets the measurement logic be tested
against a real HTTP server on the JVM, which is where the figures in
[the engine tests](engine/src/test/kotlin/io/github/flyboyhigh777/speedmeter/engine/SpeedtestEngineTest.kt)
are checked against a server whose throughput is capped at a known rate.

Dependencies flow one way: `app` → `engine` → nothing but the Kotlin and coroutines runtime. The
engine speaks HTTP through `java.net.HttpURLConnection` rather than an HTTP library, because a
speed test must not inherit connection pooling, transparent retries or response buffering it did
not ask for - any of which quietly corrupts a measurement.

### Engine pieces

| File | Responsibility |
| --- | --- |
| `SpeedtestEngine` | runs the stages, reports a `Flow<TestEvent>` |
| `TransferStage` | one download or upload: connections, byte counting, sampling, stop decision |
| `ThroughputCalculator` | byte counter → samples, instantaneous rate, fast and slow EMA, windowed aggregate |
| `StableStop` | early-stop rule over the two averages |
| `LatencyStage`, `LoadedLatencyProbe` | idle and under-load latency |
| `LatencyCalculator` | samples → one representative value, by a declared ranking, plus jitter |
| `ServerSelector` | concurrency-capped candidate probing |
| `backend/*` | per-server URL shapes and metadata parsing |

## Adding a backend

Implement `SpeedtestBackend` - four URL builders (latency, download, upload, metadata) and a
metadata parser - and add a `BackendKind`. No measurement code changes; `SpeedtestBackend.create`
is the only place that has to learn about it.

## Building

Needs a JDK (17 or newer), the Android SDK with platform 36 and build-tools 36, and Gradle 8.13+.
This project has no committed Gradle wrapper jar, because the repository does not carry binaries;
use a local Gradle or let the IDE provide one.

```sh
export ANDROID_HOME=/path/to/android-sdk

gradle :engine:test          # engine unit and integration tests
gradle :app:testDebugUnitTest # app unit tests
gradle :app:lintDebug        # lint, errors are fatal
gradle :app:assembleDebug    # debug APK
gradle :app:assembleRelease  # release APK, R8 + resource shrinking
```

`gradle wrapper --gradle-version 8.14.3` will generate a wrapper locally if you want one.

### Signing a release

A release builds unsigned unless four Gradle properties are supplied, so a clone of this repository
can never pick up someone else's key and no keystore or password belongs in version control:

```sh
gradle :app:assembleRelease \
  -PspeedmeterStoreFile=/path/to/keystore.jks \
  -PspeedmeterStorePassword=... \
  -PspeedmeterKeyAlias=... \
  -PspeedmeterKeyPassword=...
```

The same properties can come from `~/.gradle/gradle.properties` or `ORG_GRADLE_PROJECT_*`
environment variables. With them the build signs with v1, v2 and v3 schemes; without them it
produces `app-release-unsigned.apk` as before.

### Real-network checks

Three engine tests talk to the live public backends. They are skipped unless opted in, because
their figures depend on whoever runs them:

```sh
SPEEDMETER_REAL_NETWORK=1 gradle :engine:test --tests '*RealBackendTest*'
```

## Verified

On a Linux container, Gradle 8.14.3, JDK 21, AGP 8.13.2, Kotlin 2.2.21, Compose BOM 2026.02.01:

- 47 engine tests and 8 app tests pass; 3 further engine tests hit the live backends and are
  skipped unless `SPEEDMETER_REAL_NETWORK=1`. With it set, all 50 pass.
- The engine's end-to-end tests run full test suites against a local LibreSpeed-compatible server
  with a shared token-bucket cap, and assert the reported rate lands near the served rate, that a
  stable link stops the stage early, that connection scaling opens more connections than it started
  with, that the byte allowance caps a stage, that a refused metadata endpoint costs the run its
  ISP label and nothing else, that the reported connection count is the peak used, and that a
  failing endpoint fails the run with the stage that broke rather than reporting zero.
- `:app:lintDebug` is clean with `abortOnError`.
- Debug and release APKs build; release is 1.4 MB, signed with v1, v2 and v3 schemes.
- The release APK's manifest and signing block were read back with the same binary-XML reader used
  on the Ookla APK, confirming the three permissions, the single activity and all three signature
  schemes.

### On a real device

The signed APK was installed and run on an Android phone over Wi-Fi, in Russian. One complete run
against the Cloudflare backend reported 72.4 Mbps down, 86.7 Mbps up, 138 ms ping, 43.9 ms jitter,
0.0% loss, 106 ms loaded latency, 11 connections at peak and 209.54 MB used. The dial, the stage
colour change between download and upload, the progress bar, the result detail card, the bottom
navigation and the Russian localisation all behaved as intended.

That run also exposed two UI defects, both since fixed: the detail card printed the English unit
`ms` next to tiles reading `мс`, and the banner's second line fell back to the idle label, so a
test in progress briefly read "Ready".

### Against the live backends

Measured against `speed.cloudflare.com`, and the reason two engine fixes exist:

- `__down` refuses `bytes=100000000` and above with a **403**, and serves `99999999`. The backend
  now clamps the request, and the chunk size sits at 90 MB. Before this, every run against the real
  endpoint failed instantly - the fake-server suite could not have caught it, because the fake
  server had no such limit.
- `__up` accepted a 100 MB body with no limit observed.
- `meta` answers **403** to non-browser clients from some networks, including the one used here.
  Metadata is optional by design, so the run completes and the ISP and IP lines are simply empty;
  the LibreSpeed backend's `getIP.php` does report them. A regression test pins this behaviour.
- The public LibreSpeed list parsed into 22 usable servers.

Still not verified: the LibreSpeed transfer path against a real LibreSpeed server (only its server
list and the local fake server were exercised), and accuracy against a link whose true capacity is
known - a public endpoint can only show that the protocol works, not that the number is right. The
figure the fake-server suite checks against a known rate remains the accuracy evidence.

## Licensing and provenance

No code, resource, asset, string or icon from the Ookla APK is present here. The icon, palette,
strings and layout are this project's own. "Speedtest" and "Ookla" are trademarks of Ookla, LLC,
used here only to name the app that was analysed.

The app does not talk to Ookla's servers and does not implement their encrypted control protocol;
see section 6 of the analysis for why.
