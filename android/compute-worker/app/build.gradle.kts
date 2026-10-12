plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "ai.aivault.compute"
    compileSdk = 35
    defaultConfig {
        applicationId = "ai.aivault.compute"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        externalNativeBuild { cmake { cppFlags += "-std=c++17" } }
    }
    externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt") } }
}
kotlin { jvmToolchain(17) }
