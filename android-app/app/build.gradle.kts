plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "fi.tiitus.yllapito"
    compileSdk = 35
    defaultConfig {
        applicationId = "fi.tiitus.yllapito"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }
}
