plugins {
  id("com.android.application")
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
  compileSdk = 35

  defaultConfig {
    applicationId = appNamespace
    minSdk = 24
    targetSdk = 34
    versionCode = appVersionCode
    versionName = appVersionName
  }

  sourceSets.named("main") {
    // Everything stays where build-apk.sh already expects it.
    manifest.srcFile(generatedManifest)
    java.setSrcDirs(listOf("../src"))
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

dependencies {
  // One AndroidX artifact, carried for a reason: it is the proof that this
  // build can resolve AndroidX at all, which the hand-rolled one cannot do
  // and which everything else — Health Connect above all — waits on.
  implementation("androidx.core:core:1.13.1")
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
