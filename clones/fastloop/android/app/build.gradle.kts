plugins {
  id("com.android.application")
  // Health Connect's API is suspend functions with no blocking twin, so
  // there is no reading sleep from Java. This is why the build moved.
  id("org.jetbrains.kotlin.android")
}

/*
 * One manifest, read by two builds.
 *
 * AGP 8 refuses a source manifest carrying `package`, and takes the version
 * from the build script instead — while aapt2, driven straight by
 * build-apk.sh, needs both in the manifest. Rather than keep two manifests
 * to drift apart, the one in android/ stays authoritative: the version is
 * read out of it here, and a copy with those three attributes removed is
 * written for AGP to consume.
 *
 * It is done while the build is configured, not in a task, because AGP reads
 * the manifest as it configures: a task would not have run yet.
 */
val sourceManifest = file("../AndroidManifest.xml")
val manifestText = sourceManifest.readText()

fun manifestAttribute(name: String): String =
  Regex("""$name="([^"]+)"""").find(manifestText)?.groupValues?.get(1)
    ?: throw GradleException("В ${sourceManifest.name} нет атрибута $name")

val appVersionCode = manifestAttribute("android:versionCode").toInt()
val appVersionName = manifestAttribute("android:versionName")
val appNamespace = manifestAttribute("package")

val generatedManifest = layout.buildDirectory.file("generated/manifest/AndroidManifest.xml").get().asFile
generatedManifest.parentFile.mkdirs()
generatedManifest.writeText(
  manifestText
    .replace(Regex("""\n?\s*package="[^"]*""""), "")
    .replace(Regex("""\n?\s*android:versionCode="[^"]*""""), "")
    .replace(Regex("""\n?\s*android:versionName="[^"]*""""), ""),
)

/*
 * The page is the app, and it is built by Vite, not by Gradle.
 *
 * Gradle is told to depend on the file rather than to produce it: whoever
 * runs this build runs `npm run build` first, and a missing page should stop
 * the build with that sentence rather than ship an APK whose only screen is
 * blank.
 */
val webApp = file("../../dist/index.html")
val assetsDir = layout.buildDirectory.dir("generated/assets")

val copyWebApp by tasks.registering(Copy::class) {
  description = "Копирует собранную страницу в assets."
  doFirst {
    if (!webApp.isFile) {
      throw GradleException("Нет ../../dist/index.html — сначала `npm run build`")
    }
  }
  from(webApp)
  into(assetsDir)
}

/*
 * The signing key is rebuilt, never stored.
 *
 * Android will not install an update signed by a different certificate, and
 * the way out of that is to uninstall — which destroys the diary. The script
 * derives the one key from a fixed seed and refuses to return a different
 * fingerprint, so this build and build-apk.sh sign identically and each can
 * update what the other installed.
 */
val keystore = layout.buildDirectory.file("signing/debug.p12").get().asFile

val makeKeystore by tasks.registering(Exec::class) {
  description = "Собирает детерминированный ключ подписи и сверяет отпечаток."
  commandLine("../tools/make-keystore.sh", keystore.absolutePath, "android", "fastloop")
  // The seed is the key: if KeyGen changes, the certificate changes, and
  // Gradle must not hand back a cached keystore built from the old one.
  inputs.files("../tools/KeyGen.java", "../tools/make-keystore.sh")
  outputs.file(keystore)
}

android {
  namespace = appNamespace
  compileSdk = 36

  defaultConfig {
    applicationId = appNamespace
    // 26, not 24, because Health Connect requires it — and so does the
    // java.time the bridge reads instants with. Android 8.0 is from 2017;
    // what is given up is Android 7, which no phone that can run Health
    // Connect is on anyway. Forcing the library past its own floor was the
    // other option and buys nothing but a crash on a device that could not
    // have used the feature regardless.
    minSdk = 26
    targetSdk = 36
    versionCode = appVersionCode
    versionName = appVersionName
  }

  sourceSets.named("main") {
    // Everything stays where build-apk.sh already expects it.
    manifest.srcFile(generatedManifest)
    // ../src is shared with build-apk.sh, which has neither Kotlin nor
    // AndroidX; ../src-health is this build's alone and is why it exists.
    java.setSrcDirs(listOf("../src", "../src-health"))
    kotlin.setSrcDirs(listOf("../src", "../src-health"))
    res.setSrcDirs(listOf("../res"))
    assets.setSrcDirs(listOf(assetsDir))
  }

  signingConfigs {
    create("fastloop") {
      storeFile = keystore
      storePassword = "android"
      keyAlias = "fastloop"
      keyPassword = "android"
      storeType = "PKCS12"
    }
  }

  buildTypes {
    release {
      signingConfig = signingConfigs.getByName("fastloop")
      // Nothing is shrunk yet. The migration is the change being made here;
      // changing what reaches the phone at the same time would make a
      // regression impossible to attribute.
      isMinifyEnabled = false
    }
    debug {
      signingConfig = signingConfigs.getByName("fastloop")
    }
  }

  compileOptions {
    // dx capped this at 8. d8 does not, and nothing here depends on that cap.
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  // The old build has no unit tests to run and the one file under test/ is a
  // main() rather than a JUnit case. Wiring it up belongs to its own change.
  sourceSets.named("test") { java.setSrcDirs(emptyList<String>()) }
  sourceSets.named("androidTest") { java.setSrcDirs(emptyList<String>()) }
}

/*
 * Kotlin aims where javac aims.
 *
 * Left alone, the Kotlin compiler targets whatever JVM is running the build
 * — 21 on the runner — while javac is pinned at 17 above, and Gradle refuses
 * a module whose two halves disagree. Saying it once here beats moving javac
 * to match a JDK that will change under us.
 */
kotlin {
  compilerOptions {
    jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
  }
}

val healthConnect = "1.1.0-alpha07"

dependencies {
  implementation("androidx.core:core:1.13.1")
  implementation("androidx.health.connect:connect-client:$healthConnect")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}

/*
 * Prints which Health Connect versions exist.
 *
 * maven.google.com is unreachable from the container this is written in, so
 * the version above is a guess made blind. This resolves the open range on
 * a machine that can see the repository and says what it found, which turns
 * the guess into a fact on the next run rather than a build that fails with
 * nothing to go on.
 */
val reportHealthConnect by tasks.registering {
  description = "Печатает версию Health Connect, которую видит репозиторий."
  doLast {
    val open = configurations.detachedConfiguration(
      dependencies.create("androidx.health.connect:connect-client:+"),
    )
    open.isTransitive = false
    val resolved = runCatching { open.resolvedConfiguration.firstLevelModuleDependencies.map { it.moduleVersion } }
    logger.lifecycle("Health Connect: закреплено $healthConnect, в репозитории свежая " + resolved.getOrElse { listOf("— не удалось: ${'$'}{it.message}") })
  }
}

tasks.named("preBuild") {
  dependsOn(copyWebApp, makeKeystore)
}

/*
 * The certificate is checked on the APK itself, not only on the keystore.
 *
 * make-keystore.sh asserts what it produced; this asserts what was actually
 * signed, which is the thing the phone compares.
 *
 * Read with apksigner rather than keytool: from minSdk 24 the APK carries
 * only the v2/v3 signature, which lives in a block of its own rather than in
 * META-INF, and `keytool -printcert -jarfile` — which knows only the old JAR
 * signature — answers "Not a signed jar file" for a perfectly signed APK.
 */
val sdkBuildTools = android.sdkDirectory.resolve("build-tools")

val verifySigning by tasks.registering {
  description = "Сверяет отпечаток сертификата в собранном APK."
  dependsOn("assembleRelease")
  doLast {
    val apk = layout.buildDirectory.dir("outputs/apk/release").get().asFile
      .listFiles { file -> file.extension == "apk" }
      ?.firstOrNull()
      ?: throw GradleException("APK не найден")

    val apksigner = sdkBuildTools.listFiles()
      ?.sortedBy { it.name }
      ?.mapNotNull { dir -> dir.resolve("apksigner").takeIf { it.canExecute() } }
      ?.lastOrNull()
      ?: throw GradleException("apksigner не найден в $sdkBuildTools")

    val run = ProcessBuilder(apksigner.absolutePath, "verify", "--print-certs", apk.absolutePath)
      .redirectErrorStream(true).start()
    val printed = run.inputStream.bufferedReader().readText()
    run.waitFor()

    val expected = "7A6C9128ABAA5E064D496416605C87853F33553D25D20130EECFF56D22C1BEDE"
    val found = Regex("""certificate SHA-?256 digest:\s*([0-9a-fA-F]{64})""")
      .find(printed)?.groupValues?.get(1)?.uppercase()
      ?: throw GradleException("Не удалось прочитать сертификат APK:\n$printed")
    if (found != expected) {
      throw GradleException("Сертификат APK не тот — обновление не встанет поверх установленного.\n  ожидался: $expected\n  получен:  $found")
    }
    logger.lifecycle("APK: ${'$'}{apk.name}, сертификат совпадает: $found")
  }
}
