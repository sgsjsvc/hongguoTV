import java.util.Properties

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

// 发布签名：凭据来自 apps/tv-android/keystore.properties（已被 .gitignore 排除）。
// 该文件缺失时（如 CI 或新克隆）不影响 debug 构建，仅跳过 release 签名。
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}
val releaseStorePath = keystoreProperties.getProperty("storeFile")
val hasReleaseSigning = releaseStorePath != null && rootProject.file(releaseStorePath).exists()

android {
    namespace = "com.hongguotv.tv"
    compileSdk = 35
    ndkVersion = "28.2.13676358"
    System.getenv("ANDROID_NDK_HOME")?.let { ndkPath = it }
    defaultConfig {
        applicationId = "com.hongguotv.tv"
        minSdk = 22
        targetSdk = 35
        versionCode = 3
        versionName = "1.0.2"
        ndk { abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64") }
        externalNativeBuild { cmake { arguments += "-DANDROID_STL=c++_static" } }
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                // 同时启用 v1 与 v2 签名：v1 兼容 Android 5.1/6.0（API 22/23）
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isReturnDefaultValues = true }
    lint { abortOnError = true }
    externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt"); version = "3.22.1" } }
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/content-assets"))
}
val bundledContentCore by tasks.registering(Copy::class) {
    from(rootProject.file("../../shared/category-contract.cjs"))
    from(rootProject.file("../../shared/content-core/hongguo.js"))
    from(rootProject.file("../../shared/recommendation-core.cjs"))
    into(layout.buildDirectory.dir("generated/content-assets"))
}
tasks.named("preBuild") { dependsOn(bundledContentCore) }
dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.media3:media3-exoplayer:1.8.0")
    implementation("androidx.media3:media3-ui:1.8.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test:core-ktx:1.6.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
