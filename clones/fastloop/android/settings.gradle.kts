/*
 * The Gradle build, standing beside the hand-rolled one rather than
 * replacing it yet.
 *
 * build-apk.sh exists because dl.google.com is unreachable from the
 * container this app is written in, so the Android SDK and every AndroidX
 * artifact are out of reach and the APK is assembled from what Maven Central
 * happens to carry: aapt2 out of apktool, a Robolectric jar as the compile
 * classpath, and dx — a dexer from 2016 that accepts nothing newer than Java
 * 8 bytecode. It works, and it is a ceiling: no library can be added to it,
 * Kotlin cannot be used, and Health Connect — which is how sleep gets off
 * the watch — is a Kotlin API behind AndroidX.
 *
 * This project is the way out. It reads the same manifest, the same sources
 * and the same resources from where they already are, and derives the same
 * signing certificate from the same seed, so both builds produce an APK that
 * installs over the other. Nothing is moved until this one is green.
 */
pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
}

dependencyResolutionManagement {
  repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
  repositories {
    google()
    mavenCentral()
  }
}

rootProject.name = "fastloop"
include(":app")
