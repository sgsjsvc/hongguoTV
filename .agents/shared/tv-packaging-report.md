# TV 端打包与全设备测试报告

**执行方**: dsh
**日期**: 2026-10-15
**任务**: 提交全部改动 + 重新打包 TV 端 + 测试

---

## 一、提交汇总

**commit `2836803`** —— 36 个文件，401 行新增

| 工作 | 内容 |
| --- | --- |
| **TV 剧集快捷键** | `PlaybackPolicy`、`MainActivity`、`CatalogScreenView` + 测试 |
| **全屏下剧集快捷键** | `useKeyboardShortcuts` + `tests/episode-shortcuts.test.mjs` |
| **推荐流全屏头部** | `App.tsx`、`PlayerModal.tsx` |
| **B1/W5 脚本微调** | `.agents/shared/` 下两个检查脚本 |

**推送**：`e2957b2..2836803 → main`

---

## 二、构建产物

### 两个变体

| 变体 | 大小 | 说明 |
| --- | --- | --- |
| **release** | **6.58 MB** | 已签名（`CN=HongguoTV`） |
| debug | 8.42 MB | 调试证书 |

### 关键属性验证

| 属性 | 值 | 判定 |
| --- | --- | --- |
| **minSdk** | **22** | ✅ 兼容 Android 5.1+ |
| targetSdk | 35 | |
| versionName | 1.0.0 | |
| **签名 v1（JAR）** | **true** | ✅ **API 22/23 必需** |
| **签名 v2** | **true** | ✅ |
| 原生库架构 | arm64-v8a / **armeabi-v7a** / x86 / x86_64 | ✅ 含 32 位 |
| 引擎版本 | 74.3 KB，与源码**完全一致** | ✅ |
| 含 `deviceEntropy` | ✅ | 跨端随机源 |
| 含 `randomBytes` 能力探测 | ✅ | |
| 被封禁的旧 `device_id` | ✅ **不存在** | |

---

## 三、全设备测试

### 四台设备全部安装成功

| 设备 | 系统 | ABI | 安装 |
| --- | --- | --- | --- |
| **D1** `127.0.0.1:16384` | Android 12 | — | ✅ |
| **D2** `127.0.0.1:16416` | Android 15 | — | ✅ |
| **D3** `127.0.0.1:16448` | Android 12 | — | ✅ |
| **REAL** `192.168.1.120:5555` | **Android 5.1.1 / API 22** | **armeabi-v7a** | ✅ |

### D1 实测（release 版）

| 项 | 结果 |
| --- | --- |
| MD5 与本地一致 | ✅ `4A996A7B...` |
| 启动 | ✅ |
| 截图 | ✅ **视频画面 + 字幕「带着她」** |
| 间隔 10 秒两张截图 | ✅ **内容不同 → 播放推进** |
| 日志错误 | ✅ **无** |

### REAL 真机实测（API 22，最关键的兼容性验证）

| 项 | 结果 |
| --- | --- |
| 安装 | ✅ **成功**（证明 v1 签名 + 32 位库有效） |
| 启动 | ✅ |
| 首屏 | 「精彩内容加载中…」**无 TypeError** |
| 30 秒后截图 | ✅ **视频画面渲染**（28312 → 314533 字节） |
| 日志错误 | ✅ **无**（对比修复前有 `TypeError: not a function`） |

**这是本次修复的核心验证** —— 修复前真机报 `randomDeviceId` 的 TypeError，现在正常播放。

---

## 四、发布门禁

```
=== 播放冒烟测试（发布门禁）===
  ✓ 临时服务启动  http://127.0.0.1:8899
  ✓ 健康检查含 playback 段
  ✓ 样本1 禁止闪婚：甜桃烈酒 清晰度  1 个，默认 1080P
  ✓ 样本1 禁止闪婚：甜桃烈酒 取流  HTTP 206 / 65536B / ftyp
  ✓ 样本2 人到中年，系统逼我年少轻狂 清晰度  5 个，默认 1080P
  ✓ 样本2 人到中年，系统逼我年少轻狂 取流  HTTP 206 / 65536B / ftyp
  ✓ 样本3 雾锁情迷 清晰度  5 个，默认 1080P
  ✓ 样本3 雾锁情迷 取流  HTTP 206 / 65536B / ftyp
  ✓ 清晰度全部通过  3/3
  ✓ 取流全部通过  3/3
  ✓ 健康检查报告上游健康  {"total":3,"ok":3,"empty":0,"error":0}
  === 结论 ===
  ✓ 播放冒烟测试通过
```

---

## 五、测试套件

| 套件 | 结果 |
| --- | --- |
| `npm test` | **144 项通过** |
| `npm run typecheck` | exit 0 |
| TV `testDebugUnitTest` | BUILD SUCCESSFUL |
| TV `assembleDebug` / `assembleRelease` | BUILD SUCCESSFUL |
| 播放冒烟门禁 | 通过 |

---

## 六、交付产物

### `release/tv/`

| 文件 | 大小 | 校验和（SHA256 前 16 位） |
| --- | --- | --- |
| `hongguotv-android5.1-release-signed.apk` | 6.58 MB | `906B7BC11B359EE7` |
| `hongguotv-android5.1-debug.apk` | 8.42 MB | `A8E43A21DFC7B18C` |
| `hongguotv-rank-fix-debug.apk` | 8.42 MB | `A596BBEE61DBCB8A` |
| `hongguotv-android5.1-release-unsigned.apk` | 6.54 MB | `905E2A5BFD7C48BC` |
| `hongguotv-android5.1.1-debug.apk` | 8.26 MB | `0FDE6EDB5F1ABDC4` |

**推荐安装**：`hongguotv-android5.1-release-signed.apk`（已签名，兼容 5.1+）

### 汇总

`release/SHA256SUMS.txt` —— 19 个文件，合计 1200.22 MB

---

## 七、遗留

| # | 项 | 说明 |
| --- | --- | --- |
| 1 | `release/tv` 中两个旧 APK 未删除 | `android5.1-release-unsigned`（10-14）与 `android5.1.1-debug`（10-13）是历史产物 |
| 2 | D2/D3 仅验证安装 | 未逐台实测播放（D1 与真机已覆盖） |
| 3 | 真机播放验证用截图差异 | 该设备无 uiautomator dump 支持 |

**均不阻断交付。**
