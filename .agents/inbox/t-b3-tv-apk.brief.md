# B3 TV 端 APK 打包（兼容 Android 5.1+ 与全架构）

**任务 ID**: `t-b3-tv-apk`
**负责人**: codex
**依赖**: 无（可与 B1/B2 并行）
**协调者**: dsh

---

## 一、任务目标

产出 TV 端 APK，**兼容 Android 5.1 以上**，覆盖**全部 CPU 架构**。

**用户需求原文**：

> 要兼容所有cpu架构，tv端要兼容5.1以上

---

## 二、当前配置（已核实，无需修改）

`apps/tv-android/app/build.gradle.kts`：

```kotlin
compileSdk = 35
minSdk = 22          // ← Android 5.1，已满足要求
targetSdk = 35
ndkVersion = "28.2.13676358"

ndk {
    abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")
}
```

**结论**：

- `minSdk = 22` = **Android 5.1**，已满足「兼容 5.1 以上」✅
- `abiFilters` 已含 **4 种架构**（`armeabi-v7a`、`arm64-v8a`、`x86`、`x86_64`）✅

**所以配置本身已符合要求**，任务重点是**实际构建出 APK 并验证**。

---

## 三、要做的事

### 3.1 构建 Debug APK

```powershell
cd apps/tv-android
.\gradlew.bat :app:assembleDebug --console=plain
```

**注意**：需要 NDK。项目 `local.properties` 已配置：

```
sdk.dir=C\:\\Users\\AnLin\\AppData\\Local\\Android\\Sdk
cmake.dir=G\:\\_sofetwar\\androdsdk\\cmake\\3.22.1
ndk.dir=G\:\\_sofetwar\\androdsdk\\ndk\\28.2.13676358
```

**已知坑**：若设置 `ANDROID_NDK_HOME` 环境变量会与 `ndk.dir` 冲突，报 `CXX1100`。**不要设置该变量**。

### 3.2 构建 Release APK（若可行）

```powershell
.\gradlew.bat :app:assembleRelease --console=plain
```

**注意**：项目**没有正式签名配置**。Release 构建可能失败或产出未签名 APK。

- 若无法签名，**如实报告**，Debug APK 可满足「能安装运行」的需求
- 不要为了签名而引入新的密钥文件（会涉及凭据）

### 3.3 验证 APK 的架构与 SDK 兼容性

**必须验证**（不能只看 build.gradle）：

```powershell
# 用 aapt 或 apkanalyzer 查看 APK 实际包含的 ABI
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\<版本>\aapt.exe" dump badging <apk> | Select-String "native-code|sdkVersion"
```

**或**用 Node 解压 APK 检查 `lib/` 目录：

```
lib/armeabi-v7a/libhongguo_quickjs.so
lib/arm64-v8a/libhongguo_quickjs.so
lib/x86/libhongguo_quickjs.so
lib/x86_64/libhongguo_quickjs.so
```

### 3.4 产出位置

把 APK 复制到 `outputs/tv-android/`，命名规范：

```
hongguotv-android<version>-<buildtype>.apk
```

参考现有命名：`hongguotv-android5.1.1-debug.apk`

---

## 四、验收标准

1. **APK 产出成功**，位于 `outputs/tv-android/`
2. **验证 4 种 ABI 全部包含**（解压检查 `lib/` 目录，附证据）
3. **验证 minSdk = 22**（`aapt dump badging` 或 `AndroidManifest` 反编译）
4. `./gradlew :app:lintDebug` 通过
5. `./gradlew :app:testDebugUnitTest` 通过
6. 报告写入 `.agents/shared/t-b3-tv-apk-codex.md`

---

## 五、免环境说明

TV APK 本身是**自包含**的：

- Kotlin/Java 代码编译进 DEX
- QuickJS 引擎编译为 **native .so**（4 种 ABI）
- 共享内容引擎（`hongguo.js`）由 Gradle `preBuild` 复制进 `assets/`

**不需要用户安装任何环境**。请验证 `assets/hongguo.js` 确实在 APK 内。

---

## 六、硬性约束

1. **不要改** `apps/tv-android/` 的源码（除非构建确实需要）
2. **不要改** `shared/content-core/hongguo.js`
3. **不要设置** `ANDROID_NDK_HOME`（会与 ndk.dir 冲突）
4. 当前 shell 是 **Windows PowerShell 5.1**
5. 不要 `git commit` / `git push`

---

## 七、报告要求

- 构建命令原文与**真实输出**
- APK 的**文件名、大小、SHA256**
- **4 种 ABI 的验证证据**（解压后的 `lib/` 列表）
- minSdk 的验证证据
- `assets/hongguo.js` 存在的证据
- 若 Release 构建失败，说明原因

---

## 八、提交方式

```powershell
node .agents/cli.mjs done t-b3-tv-apk codex "结论及报告路径"
```
