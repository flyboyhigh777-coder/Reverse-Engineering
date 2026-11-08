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

The release APK is unsigned; sign it with your own key before installing it anywhere that matters.

## Verified

On a Linux container, Gradle 8.14.3, JDK 21, AGP 8.13.2, Kotlin 2.2.21, Compose BOM 2026.02.01:

- 44 engine tests and 8 app tests pass.
- The engine's end-to-end tests run full test suites against a local LibreSpeed-compatible server
  with a shared token-bucket cap, and assert the reported rate lands near the served rate, that a
  stable link stops the stage early, that connection scaling opens more connections than it started
  with, that the byte allowance caps a stage, and that a failing endpoint fails the run with the
  stage that broke rather than reporting zero.
- `:app:lintDebug` is clean with `abortOnError`.
- Debug and release APKs build; release is 1.4 MB.
- The release APK's manifest was read back with the same binary-XML reader used on the Ookla APK,
  confirming the three permissions and the single activity.

Not verified: behaviour on a physical device, and the figures against a real wide-area link. No
Android device or emulator was available in the build environment, so every statement about
on-device behaviour is untested. Real-network accuracy against the public Cloudflare and LibreSpeed
endpoints is likewise unverified - the test suite proves the engine measures a known rate
correctly, not that any particular public server is well provisioned.

## Licensing and provenance

No code, resource, asset, string or icon from the Ookla APK is present here. The icon, palette,
strings and layout are this project's own. "Speedtest" and "Ookla" are trademarks of Ookla, LLC,
used here only to name the app that was analysed.

The app does not talk to Ookla's servers and does not implement their encrypted control protocol;
see section 6 of the analysis for why.
