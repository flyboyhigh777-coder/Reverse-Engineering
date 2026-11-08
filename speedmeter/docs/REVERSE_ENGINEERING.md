# Reverse engineering Speedtest by Ookla 7.1.4

Analysis of `SpeedtestbyOokla_7.1.4_APKPure_1.apk` (29.7 MB, `arm64-v8a` split), done to work out
what a speed test app actually has to do, and then to build an independent one. Nothing from the
APK is redistributed, reused, or linked against: only the *findings* feed the implementation in
this directory.

Claims below are labelled so the next reader does not have to re-derive them:

- **Observed** - read directly out of the package.
- **Derived** - follows from several observations put together.
- **Inferred** - the most plausible reading; stated as such because it was not confirmed on the wire.
- **Unknown** - looked at, not established.

## 1. Tooling

No decompiler was used. Three small read-only readers were written for the job, because the facts
needed here are structural, and a parser whose behaviour is fully known beats a decompiler whose
output has to be second-guessed:

| Reader | Reads | Used for |
| --- | --- | --- |
| `axml.py` | Android binary XML (`RES_XML` chunks, string pool, resource map) | manifest |
| `dex.py` | DEX headers, `string_ids`, `type_ids`, `method_ids`, `field_ids`, `class_defs` | class, method, field and string inventory |
| `readelf`/`strings` | ELF dynamic symbols and `.rodata` | native engine surface |

The same `axml.py` was later pointed at this project's own release APK, which is how the permission
set in section 7 was checked rather than asserted.

## 2. Package facts (observed)

| Property | Value |
| --- | --- |
| Package | `org.zwanoo.android.speedtest` |
| Version | `7.1.4`, versionCode `265370` |
| `minSdk` / `targetSdk` / `compileSdk` | 24 / 36 / 36 |
| DEX files | 6, 42.3 MB uncompressed |
| Classes | 48,644 total, of which 9,642 are `com.ookla.*` |
| Native libraries | 7, 15.4 MB |
| Manifest components | 19 activities, 25 services, 16 receivers, 4 providers |
| Declared permissions | 25 |

Native libraries, by purpose:

| Library | Size | Role |
| --- | --- | --- |
| `libandroidsharedsuite.so` | 2.99 MB | the measurement engine |
| `libmapbox-maps.so`, `libmapbox-common.so` | 9.21 MB | coverage maps |
| `libcomScore.so` | 1.84 MB | audience measurement |
| `libc++_shared.so` | 1.37 MB | C++ runtime |
| `libandroidx.graphics.path.so`, `libdatastore_shared_counter.so` | 17 KB | AndroidX support |

**Derived:** the measured functionality is a small fraction of the package. 309 classes implement
the engine; the remaining ~48,300 are UI, maps, ads, analytics, consent, accounts, billing and
Downdetector. The largest non-Ookla packages by class count are `com.google` (14,397),
`androidx.compose` (2,959), `com.mapbox` (2,234), `com.amplifyframework` (1,488), `io.reactivex`
(1,349), `com.onetrust` (1,087) and `com.cellrebel` (1,047).

## 3. The engine

**Observed:** `com.ookla.sharedsuite.internal` is a SWIG-generated JNI binding - every class carries
`swigCPtr`/`swigCMemOwn`, and `libooklasuiteJNI` exports 1,640 `Java_com_ookla_sharedsuite_internal_*`
entry points. Build paths left in `.rodata` name the C++ sources, e.g.
`.../speedtest-sharedsuite/suite/OoklaSuite/StageUploadTCP.cpp`.

**Derived:** the measurement logic lives entirely in portable C++ (`Ookla::Suite`), with Android as
one host among several. The Java layer configures it, starts stages and receives callbacks.

### 3.1 Stages (observed, from `StageType`)

`StageTypeNone`, `StageTypePrimer`, `StageTypeMetadata`, `StageTypeLatency`, `StageTypeDownload`,
`StageTypeHttpDownload`, `StageTypeUpload`, `StageTypeLoadedLatencyTcp`, `StageTypeLoadedLatencyUdp`,
`StageTypePacketLoss`, `StageTypeTraceroute`, `StageTypeCpuMetrics`.

**Inferred** stage order for a normal run, from the stage names and the config tree in 3.3:
server selection → primer → metadata → latency → download → upload, with loaded-latency sampling
running inside the two transfer stages and packet loss alongside them.

`StageTypePrimer` is the detail worth copying: a warm-up pass whose bytes are not part of the
reported figure, which is what keeps TCP slow start and TLS setup out of the result.

### 3.2 Configuration surface (observed, from JNI accessors)

`Ookla::Config::Engine`:

```
threadCount                       testDurationSeconds        minTestDurationSeconds
downloadMaxBytes                  downloadMaxBytesPerConnection
uploadMaxBytes                    uploadMaxBytesPerConnection
packetSizeBytes                   tcpDownloadBufferSizeBytes tcpUploadBufferSizeBytes
networkTimeout                    latencyTestCount           isUploadFirst
isIPv6Enabled                     isSuperSpeedEnabled        isSimpleProgressEnabled
tcpInfoEnabled                    usePlatformSockets         clientAuthToken
```

`Ookla::Config::Stage`: `type`, `numThreads`, `numPings`, `testDuration`, `minTestDuration`,
`blockSize`, `minBlockSizeKiB`, `maxBlockSizeKiB`, `bytesPerStage`, `bytesPerConnection`,
`desiredNumberOfSamples`, `throughputMinUpdateFrequency`, `latencyMethod`, `primaryMeasureMethod`,
`rcvBufferSize`, `sndBufferSize`, `packetSize`, `packetLossDelay`,
`packetLossSendCutoffPercentage`, `transferFlags`, `failureTrigger`, `connectionStrategies`,
`traceHost`, `enableThroughputStats`, `enableServerUpload`, `enableUploadZeroCopy`,
`enableKernelModule`, `enableCpuMetrics`, `enableBroadcomTcpDiscard`, `useSuperspeed`.

`Ookla::Config::StableStop`: `isEnabled`, `fastEmaPeriod`, `slowEmaPeriod`, `stopDelta`,
`stopCount`, `isAverageUsedForStop`, `isReportEnabled`, `isLoggingEnabled`.

`Ookla::Config::ServerSelection`: `serverCount`, `maxConcurrency`, `pingCount`, `latencyMethod`.

`Ookla::Config::LoadedLatency`: `enableTcp`, `enableUdp`, `minBurstCount`, `maxBurstCount`,
`minDelay`, `maxDelay`, `reportSamples`.

`ConnectionScaling`: `enabled`, `factor`, `maxConnections`.

Enumerations: `RankingMethod` ∈ {`Minimum`, `Average`, `Median`, `AvgMedian`};
`BandwidthMeasureMethod` ∈ {`Client`, `Server`}; `TestProtocol` ∈ {`Tcp`, `Http`};
`ThroughputClockType` ∈ {`Monotonic`, `TimeOfDay`}; `ConnectionStrategy` ∈ {single-server,
same-server, round-robin}.

### 3.3 Config tree (observed string constants)

```
suite.global.engine        suite.global.dns          suite.global.dynamic
suite.global.loadedLatency suite.global.deviceDiscovery
suite.stages
suite.testStage.serverSelection  suite.testStage.latency[.pingCount]
suite.testStage.download         suite.testStage.upload
suite.testStage.packetLoss
```

**Derived:** configuration arrives as a serialised tree. `boost::property_tree` JSON *and* XML
parsers are both linked in, and `SuiteConfig` exposes `getConfigJson`, so the engine can be
reconfigured from the server side without an app update - which is also why hard-coding one set of
constants from this APK would be a poor way to imitate it.

### 3.4 Wire protocol

**Observed** command tokens in `libandroidsharedsuite.so`: `HI`, `CAPABILITIES`, `PING `,
`DOWNLOAD `, `UPLOAD `, `UPLOAD_STATS`, `INITPLOSS`, `LOSS %d %d %s %lld`.

**Derived:** a line-oriented TCP control protocol (the classic Ookla scheme) with an HTTP
alternative (`StageTypeHttpDownload`, `ErrorHttpDownloadFailed`, an `Ookla::Http::ISession`
abstraction bridged back to Java). Packet loss runs over UDP: a send stage emits sequenced packets
and a separate report stage asks the server what arrived - hence the two source files
`PacketLossSendStage.cpp` and `PacketLossGetReportStage.cpp`.

**Observed:** `CommandEncryptor`, `AESEncryptor`, `Suite.createCommandEncryptor`,
`Suite.enableSoftwareAESEncryptor`, `Suite.setEncryptionUnsupported`, `Suite.setRotNUnsupported`,
`SuiteConfig.getEnableRotN`, and `Engine.clientAuthToken`.

**Derived:** the control channel is encrypted (AES) with a ROT-N fallback and the client
authenticates itself. **Inferred:** this is there to keep third-party clients off the server fleet.
Either way it settles a design question for this project: the protocol is not a public interface,
and an independent app has no business speaking it to Ookla's servers. See section 6.

**Unknown:** key derivation, the `CAPABILITIES` grammar, and the exact `UPLOAD_STATS` payload. Not
pursued - they are only needed to talk to servers this project deliberately does not use.

### 3.5 Instrumentation (observed)

`TcpInfoStats`/`TcpInfoConverter` read the kernel's `tcp_info` (`last_data_recv`, `rcv_ssthresh`
appear as field names), `Performance::CpuMetrics` samples CPU during a run, `DnsQueryRecorder`
times resolution, and `TraceRoute` runs a full traceroute with per-hop state.

**Derived:** the app does not only measure throughput; it collects enough context to explain a bad
result (CPU-bound client, slow DNS, a specific hop) and to report it upstream.

### 3.6 Endpoints (observed)

`https://www.speedtest.net/api/android.php` (config), `https://mobileapi.speedtest.net/androidextra`,
`https://results.speedtest.net/reports`, `https://mapi.speedtest.net/reports`,
`https://user-api.speedtest.net/v1`, `https://consumer-downdetector-api.speedtest.net/v1`,
`https://intelligence-maps-tiles.speedtest.net/`.

## 4. What the engine does that a naive implementation does not

Collected because these are the differences between a number and a measurement:

1. **Multiple connections, grown during the run.** One TCP connection cannot fill a fast link;
   `ConnectionScaling(factor, maxConnections)` adds connections while throughput is still climbing.
2. **A warm-up that is excluded.** `StageTypePrimer` plus `minTestDuration` keeps slow start out of
   the figure.
3. **Stop when the answer stops changing.** Two EMAs over the sample stream, compared against
   `stopDelta` for `stopCount` samples. Saves time and data on a link that has clearly settled.
4. **A declared choice of representative latency.** `RankingMethod` is configuration, not an
   accident of implementation.
5. **Latency under load, separately.** `LoadedLatencyTcp`/`Udp` in bursts during transfer: the
   bufferbloat figure, which idle ping cannot show.
6. **Server selection as a measurement.** `serverCount` candidates, `maxConcurrency` at a time -
   bounded so the probes do not contend and measure each other.
7. **Client or server byte counts.** `BandwidthMeasureMethod` exists because bytes written locally
   are not bytes delivered.
8. **A monotonic clock.** `ThroughputClockType.Clock_Monotonic` - a wall-clock step would otherwise
   corrupt a sample.
9. **Incompressible payloads.** `RandomBuffer.cpp`, `/dev/urandom`, `get_random_bytes`; a
   compressible body would measure the peer's gzip.
10. **Expected failures are modelled.** 36 `OoklaErrorType` values distinguish "no server", "latency
    failed", "upload failed", "protocol error" - no silent zero.

## 5. What this project reimplemented

`speedmeter/engine` is written from the findings above, in Kotlin, against open backends. The
mapping, including where it deliberately stops:

| Finding | This project | Note |
| --- | --- | --- |
| `Ookla::Config::Engine` | `EngineConfig` | socket buffer sizes dropped: see below |
| `Config::StableStop` | `StableStopConfig` + `StableStop` | same two-EMA rule |
| `ConnectionScaling` | `ConnectionScalingConfig` + scaling in `TransferStage` | |
| `Config::ServerSelection` | `ServerSelectionConfig` + `ServerSelector` | concurrency-capped probing |
| `Config::LoadedLatency` | `LoadedLatencyConfig` + `LoadedLatencyProbe` | HTTP bursts; no UDP |
| `RankingMethod` | `LatencyRanking` | all four reductions |
| `BandwidthMeasureMethod` | `MeasureMethod` | `CLIENT` only is implemented |
| `StageTypePrimer` | `EngineConfig.warmupSeconds` | excluded from the aggregate window |
| `ThroughputCalculator` | `ThroughputCalculator` | monotonic clock, fast + slow EMA |
| `OoklaErrorType` | `TestFailure` | typed failures, never a zero |
| `StageTypePacketLoss` | not implemented | needs a UDP server protocol; loss is reported from probe timeouts instead |
| `StageTypeTraceroute`, `CpuMetrics`, `tcp_info`, DNS timing | not implemented | diagnostics, not measurement |
| Encrypted command channel, `clientAuthToken` | not implemented | section 6 |
| Ads, analytics, consent, maps, accounts, billing, Downdetector | not implemented | not part of measuring a link |

Three places where the reimplementation knowingly differs:

- **`socketReceiveBufferBytes`/`socketSendBufferBytes` were dropped**, not ported. The reference
  engine owns raw sockets and can set `SO_RCVBUF`/`SO_SNDBUF`; this engine goes through
  `HttpURLConnection`, which exposes no socket handle. Keeping the fields would have been a
  configuration knob that silently did nothing.
- **Upload is measured client-side only.** Bytes handed to the socket are not bytes acknowledged by
  the peer, so a short upload stage over a long fat pipe reads slightly high - the socket buffer is
  counted as delivered. The reference engine's `BandwidthMeasureMethodServer` is the fix, and it
  needs a server that reports back. `LibreSpeedBackend` could carry this over `/results`; it is not
  wired up, so the limitation stands and is stated rather than hidden.
- **Packet loss is probe loss.** The reported loss percentage is the share of latency probes that
  timed out, not a sequenced UDP measurement. It answers a narrower question and is labelled as
  loss on probes.

## 6. Why the protocol was not cloned

The control channel is encrypted and the client authenticates with a token. Implementing that would
mean extracting a key out of someone else's binary in order to use someone else's server fleet
against its terms. The measurement *technique* in section 4 is engineering knowledge and is fair to
learn from; the key and the fleet are not.

So this project speaks two documented protocols instead:

- **Cloudflare's public speed endpoints** (`__down`, `__up`, `meta`) - anycast, so the nearest edge
  answers and a first test needs no server list at all. This is the default.
- **LibreSpeed** (`garbage.php`, `empty.php`, `getIP.php`) - open source and self-hostable, so a
  user can point the app at the public list or at their own box.

A new backend is one interface (`SpeedtestBackend`: four URL builders and a metadata parser). No
measurement code changes.

Two things the live endpoints taught that no amount of reading the Ookla APK would have:

- Cloudflare's `__down` refuses `bytes` at or above 100,000,000 with a 403. A backend owns what its
  server will accept, so the request is clamped there - the same rule that already applied to
  LibreSpeed's `ckSize`. This is exactly the class of bug a fake server cannot surface, because the
  fake server is written to the implementation's own assumptions.
- Cloudflare's `meta` answers 403 to non-browser clients from some networks. Because metadata is
  informational, the run completes without an ISP label rather than failing - which is the
  behaviour `OoklaErrorType` implies for its own `ErrorMetadataFailed`, and is now pinned by a
  regression test.

## 7. Result: the two packages side by side

| | Speedtest by Ookla 7.1.4 | SpeedMeter 1.0.0 |
| --- | --- | --- |
| APK size | 29.7 MB (per-ABI split) | 1.4 MB (release, universal) |
| DEX | 6 files, 42.3 MB | 1 file, 2.4 MB |
| Native code | 15.4 MB | none |
| Classes | 48,644 | engine + UI only |
| Permissions | 25, incl. `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `READ_PHONE_STATE`, `READ/WRITE_EXTERNAL_STORAGE`, `AD_ID` | 3: `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` |
| Activities / services / receivers | 19 / 25 / 16 | 1 / 0 / 0 |
| Analytics, ads, consent SDKs | Google Ads, Amazon APS, Prebid, GA, Firebase, comScore, CellRebel, OneTrust, Tag Manager | none |
| Account, billing | yes | none |
| Server fleet | Ookla, encrypted protocol | Cloudflare edge or any LibreSpeed server, incl. self-hosted |

Both permission sets were read with the same `axml.py`, from each APK's own `AndroidManifest.xml`.

## 8. Open questions

- Whether `isSuperSpeedEnabled` changes the measurement or only the UI. **Unknown.**
- What `enableKernelModule` and `enableBroadcomTcpDiscard` switch on. Chipset-specific fast paths,
  **inferred** from the names only.
- `desiredNumberOfSamples` versus `throughputMinUpdateFrequency` - two ways to express a sample
  rate, and which one wins was not established.
- Whether `StageTypeHttpDownload` is a fallback for restricted networks or the primary path on some
  platforms. **Unknown**; both code paths exist.
