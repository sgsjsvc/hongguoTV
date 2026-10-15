# TV 端 Release 打包发布报告

**执行方**: dsh
**日期**: 2026-10-15
**任务**: 打包 TV 端 release 版发布版

---

## 一、构建

### 干净重建

```
gradlew :app:clean :app:assembleRelease
BUILD SUCCESSFUL in 1m 28s
61 actionable tasks: 60 executed, 1 up-to-date
```

**60 个任务全部重新执行**（非增量），确保产物来自当前源码。

### 单元测试

```
gradlew :app:testDebugUnitTest
测试数: 32   失败: 0
```

---

## 二、发布校验（29 项全部通过）

### 引擎正确性

| 检查项 | 结果 |
| --- | --- |
| 与 `shared/content-core/hongguo.js` **逐字节一致** | ✅ 74.3 KB |
| 含 `deviceEntropy`（跨端随机源） | ✅ |
| 含 `typeof crypto.randomBytes` 能力探测 | ✅ |
| **不含被封禁的 `1905892595378490`** | ✅ |
| 含 `freshDevice` | ✅ |
| **无模块级 `DEVICE` 常量** | ✅ |

### 资源完整性

| 文件 | 大小 |
| --- | --- |
| `assets/hongguo.js` | 74.3 KB |
| `assets/category-contract.cjs` | 2.2 KB |
| `assets/recommendation-core.cjs` | 5.6 KB |
| `assets/content-api.js` | 8.0 KB |
| `assets/engine-host.js` | 2.7 KB |

**`engine-host.js` 验证**（TV 的 QuickJS 桥）：

- ✅ 提供 `createHash`
- ✅ 提供 `createDecipheriv`
- ✅ **未提供 `randomBytes`**（预期，引擎已做能力探测）

### 原生库（全架构）

| 架构 | QuickJS 库 |
| --- | --- |
| arm64-v8a | 831 KB |
| **armeabi-v7a** | **596 KB** ← API 22 需要 |
| x86 | 901 KB |
| x86_64 | 904 KB |

### 签名

| 项 | 结果 |
| --- | --- |
| **v1（JAR signing）** | ✅ **true** ← API 22/23 必需 |
| **v2** | ✅ true |
| 证书主体 | `CN=HongguoTV, OU=TV Client, O=HongguoTV, C=CN` |

### SDK 与包信息

| 项 | 值 |
| --- | --- |
| **minSdk** | **22**（兼容 Android 5.1+） |
| targetSdk | 35 |
| compileSdk | 35 |
| 包名 | `com.hongguotv.tv` |
| versionName | 1.0.0 |

**注**：`aapt2 dump badging` 不输出 `minSdkVersion`，需用 `aapt2 dump xmltree --file AndroidManifest.xml` 读取。这是本次发现的一个校验陷阱。

---

## 三、全设备安装验证

| 设备 | 系统 | 安装 | MD5 一致 |
| --- | --- | --- | --- |
| **D1** `127.0.0.1:16384` | Android 12 | ✅ | ✅ |
| **D2** `127.0.0.1:16416` | Android 15 | ✅ | ✅ |
| **D3** `127.0.0.1:16448` | Android 12 | ✅ | ✅ |
| **REAL** `192.168.1.120:5555` | **Android 5.1.1 / API 22 / armeabi-v7a** | ✅ | ✅ |

**四台设备 MD5 全部等于本地** `6194F2F7333350D5D189CF9889FCCFAA`。

### 真机实测（API 22，核心兼容性验证）

| 项 | 结果 |
| --- | --- |
| 安装 | ✅ 成功（证明 v1 签名 + 32 位库有效） |
| 启动 | ✅ |
| 截图 1（40 秒后） | ✅ **视频画面渲染**（409 KB） |
| 截图 2（12 秒后） | ✅ 画面变化（96 KB，转场） |
| **画面推进** | ✅ **两张截图内容不同** |
| 日志错误 | ✅ **无**（无 `TypeError` / `randomDevice` / `FATAL`） |

---

## 四、交付产物

### `release/tv/`

| 文件 | 大小 | SHA256（前 32 位） |
| --- | --- | --- |
| **`hongguotv-android5.1-release-signed.apk`** | **6.58 MB** | `3b41438c740e343eac561ba06b490c85` |
| `hongguotv-android5.1-debug.apk` | 8.16 MB | `9fe881e77535278c739a6f33c29aeec6` |

**推荐安装**：`hongguotv-android5.1-release-signed.apk`

### 全局

`release/SHA256SUMS.txt` —— 16 个文件，1177.29 MB

---

## 五、过程中发现并修正的问题

### 1. `collect-release.mjs` 从过期的源目录复制

**现象**：我删除 `release/tv/` 里的旧 APK 后，运行 collect 脚本它们**又出现了**。

**根因**：`collect-release.mjs:26` 从 **`outputs/tv-android/`** 收集，而那里全是 10-13/10-14 的过期 APK：

| 源目录文件 | 时间 |
| --- | --- |
| `hongguotv-android5.1-debug.apk` | 10-14 22:51 |
| `hongguotv-android5.1-release-signed.apk` | 10-15 02:01 |
| `hongguotv-android5.1-release-unsigned.apk` | 10-14 22:53 |
| `hongguotv-android5.1.1-debug.apk` | 10-13 15:26 |
| `hongguotv-rank-fix-debug.apk` | 10-15 10:54 |

**修复**：更新源目录为最新构建产物，删除 3 个历史文件，再运行 collect。

**教训**：`collect-release.mjs` 只是**搬运工**，不负责构建。必须先更新源目录。

### 2. `aapt2 dump badging` 不输出 minSdkVersion

最初校验脚本报 `minSdk=undefined`，我一度以为构建有问题。

**实际**：该子命令的输出格式不含 `sdkVersion`。改用 `aapt2 dump xmltree` 后正确读到 `minSdkVersion=22`。

### 3. 冗余产物清理

| 文件 | 处置 |
| --- | --- |
| `hongguotv-android5.1-release-unsigned.apk` | 删除（已有签名版） |
| `hongguotv-android5.1.1-debug.apk` | 删除（10-13 过期） |
| `hongguotv-rank-fix-debug.apk` | 删除（与标准 debug **SHA256 完全相同**，纯冗余命名） |

---

## 六、验收结论

| 维度 | 结论 |
| --- | --- |
| 构建 | ✅ 干净重建成功 |
| 单元测试 | ✅ 32/32 |
| 发布校验 | ✅ 29/29 |
| 签名 | ✅ v1 + v2 |
| 兼容性 | ✅ minSdk 22 + 全架构库 |
| 设备安装 | ✅ 4/4 |
| 真机播放 | ✅ API 22 实测正常 |
| 产物收集 | ✅ 已修正源目录问题 |

**TV 端 release 版已就绪。**
