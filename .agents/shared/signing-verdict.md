# Android 签名配置验收报告（协调者 dsh）

**范围**: TV 端 APK 发布签名
**验收方**: dsh
**时间**: 2026-10-15 02:30
**结论**: ✅ **配置完成并实测验证**

---

## 一、交付内容

| 项 | 路径 | 说明 |
| --- | --- | --- |
| **签名配置** | `apps/tv-android/app/build.gradle.kts` | signingConfigs + buildTypes |
| **凭据文件** | `apps/tv-android/keystore.properties` | **已被 .gitignore 排除** |
| **配置模板** | `apps/tv-android/keystore.properties.example` | 供其他开发者参考 |
| **密钥文件** | `%USERPROFILE%\.hongguotv\hongguotv-release.jks` | **项目外**，不入库 |
| **签名 APK** | `outputs/tv-android/hongguotv-android5.1-release-signed.apk` | 6.58 MB |

---

## 二、密钥信息

| 项 | 值 |
| --- | --- |
| 算法 | RSA **4096** 位 |
| 有效期 | **10000 天**（约 27 年） |
| 别名 | `hongguotv` |
| DN | `CN=HongguoTV, OU=TV Client, O=HongguoTV, L=Unknown, ST=Unknown, C=CN` |
| 证书 SHA-256 | `c6251a0572ec731dba9f99aea5efb2f8e1c003ecc106ecbd1b1e8ca99dadb151` |
| 证书 SHA-1 | `b6e9e2055fcb4ef4548afef22a62748176644979` |

---

## 三、安全设计

### 3.1 密钥不进仓库

| 检查 | 结果 |
| --- | --- |
| `keystore.properties` 被 gitignore | ✅ `.gitignore:30` |
| `*.jks` 被 gitignore | ✅ `.gitignore` |
| 项目内是否存在 `.jks` | ✅ 无（密钥在 `%USERPROFILE%\.hongguotv\`） |
| `git status` 是否跟踪凭据 | ✅ 未跟踪 |

### 3.2 密码不硬编码

`build.gradle.kts` 从 `keystore.properties` 读取，**代码中无明文密码**：

```kotlin
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}
```

### 3.3 缺凭据时不影响 debug

```kotlin
val hasReleaseSigning = releaseStorePath != null && rootProject.file(releaseStorePath).exists()
```

**新克隆的仓库（无 `keystore.properties`）仍可正常 `assembleDebug`**，仅 release 跳过签名。

---

## 四、签名算法配置（针对 Android 5.1）

```kotlin
signingConfigs {
    if (hasReleaseSigning) {
        create("release") {
            storeFile = ...
            enableV1Signing = true    // ← Android 5.1/6.0（API 22/23）必需
            enableV2Signing = true    // ← Android 7.0+（API 24+）
        }
    }
}
```

**为什么同时启用 v1 与 v2**：

| 签名方案 | 适用版本 |
| --- | --- |
| **v1（JAR signing）** | **Android 5.0+（API 21+）** |
| v2（APK Signature Scheme v2） | Android 7.0+（API 24+） |

**用户要求「兼容 5.1 以上」→ v1 是必需的**，否则 API 22/23 设备会拒绝安装。

---

## 五、实测验证（协调者独立执行）

### 5.1 apksigner 验证签名

```
Verifies
Verified using v1 scheme (JAR signing): true          ← 关键
Verified using v2 scheme (APK Signature Scheme v2): true
Number of signers: 1
Signer #1 certificate DN: CN=HongguoTV, OU=TV Client, O=HongguoTV, ...
Signer #1 key algorithm: RSA
Signer #1 key size (bits): 4096
```

### 5.2 兼容性复核（签名后未受影响）

```
package: name='com.hongguotv.tv' versionName='1.0.0'
sdkVersion:'22'                                        ← Android 5.1 ✅
targetSdkVersion:'35'
native-code: 'arm64-v8a' 'armeabi-v7a' 'x86' 'x86_64'  ← 4 种架构 ✅
```

**4 种 ABI 的 native 库与 `assets/hongguo.js` 均在签名后保留。**

### 5.3 实机安装验证（API 35）

```
$ adb -s emulator-5556 install hongguotv-android5.1-release-signed.apk
Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package
  com.hongguotv.tv signatures do not match newer version; ignoring!]
```

**这个「失败」恰恰证明签名有效** —— 设备上的旧 debug 签名与新 release 签名身份不同，系统正确拒绝覆盖。

卸载旧版后重新安装：

```
uninstall: Success
install: Success
```

**签名身份变更确认**：

| | 签名摘要 |
| --- | --- |
| 旧（debug） | `130830a2` |
| **新（release）** | **`b0f3fe64`** |

### 5.4 运行验证

| 检查 | 结果 |
| --- | --- |
| 进程存活 | ✅ `com.hongguotv.tv` PID 3819 |
| 崩溃日志 | ✅ 无 |
| 界面渲染 | ✅ 视频正常播放（截图见 `t-signed-apk-run.png`） |

**截图**：`.agents/shared/t-signed-apk-run.png`（PNG 签名 `89-50-4E-47-0D-0A-1A-0A` 有效，1920×1080）

### 5.5 第二台设备验证（API 32）

```
install: Success
进程: com.hongguotv.tv 存活
```

**API 32 与 API 35 均安装运行成功。**

---

## 六、未完成的验证（如实说明）

### Android 5.1（API 22）实机未测

**原因**：环境无 API 22 系统镜像。我尝试创建 **API 21**（比 5.1 更严格）的 TV AVD，但模拟器**启动后立即退出**（该镜像较老，与本机虚拟化不兼容）。

**已做的替代验证**：

| 层面 | 证据 |
| --- | --- |
| 声明层面 | `aapt` 确认 `sdkVersion:'22'` |
| **签名层面** | `apksigner` 确认 **v1 签名有效**（API 22/23 的必需项） |
| 架构层面 | 4 种 ABI 的 `.so` 均在包内 |
| 运行时层面 | API 32 / API 35 实测安装运行成功 |

**结论**：从签名、SDK 声明、ABI 三个层面均已满足 Android 5.1 要求。**但未在真实 API 22 设备上实测**，如需绝对确认，建议在真实 Android 5.1 电视盒子上安装验证。

---

## 七、遗留事项

### 7.1 密钥备份（重要）

密钥位于 `%USERPROFILE%\.hongguotv\`，**必须离线备份**：

- `hongguotv-release.jks`（密钥文件）
- 密码

**丢失后果**：无法为已安装用户推送更新（签名不匹配会被系统拒绝），用户必须卸载重装。

**建议**：复制到加密 U 盘或密码管理器，不要放在同一台机器。

### 7.2 Windows 代码签名未配置

用户本次只选择 TV APK 签名。Windows 产物（NSIS/便携版）**仍未签名**，用户安装时会看到 SmartScreen 警告。

若需配置，需要代码签名证书（`.pfx`），可购买或自签名。

---

## 八、验收决定

**TV APK 签名配置通过。**

| 需求 | 状态 |
| --- | --- |
| 配置签名 | ✅ |
| 密钥不进仓库 | ✅ |
| 兼容 Android 5.1（v1 签名） | ✅ |
| 4 种架构保留 | ✅ |
| 实机安装运行 | ✅（API 32 / API 35） |
| API 22 实机 | ⚠️ 未测（环境限制，已用替代验证） |
