plugins {
  id("com.android.application") version "8.7.3" apply false
  // Paired with AGP 8.7.3 rather than taken at its newest: the Kotlin plugin
  // supports a window of AGP versions, and the two have to be chosen together.
  id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}
