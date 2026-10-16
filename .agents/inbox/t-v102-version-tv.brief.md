# T2 v1.0.2 版本号统一（Android TV）

- **任务ID**: `t-v102-version-tv`
- **assignee**: `qoder`（apps/tv-android 主责）
- **依赖**: 无
- **上游依据**: `.agents/shared/dsh-release-plan-20261016.md` 步骤 4；用户 2026-10-16 已定版本号 **v1.0.2**

## 背景（DSH 实测）

`apps/tv-android/app/build.gradle.kts:24-25` 当前为：

```
versionCode = 1
versionName = "1.0.0"
```

APK 的 `versionName` 会显示给用户，须与 Release 版本 **v1.0.2** 一致；`versionCode` 用于升级覆盖，必须单调递增。

## 唯一写者范围（只允许改这一个文件）

- `apps/tv-android/app/build.gradle.kts`

## 必须做

1. `versionName = "1.0.2"`
2. `versionCode` 改为**大于此前所有已发布 APK** 的值——此前已发布值为 `1`，若无法确证历史更大值，**取 `3`**
3. **仅改这两行**：不动 `minSdk`(22)、`targetSdk`(35)、ABI、依赖、签名配置、`local.properties` 指向
4. 自测：静态核对改动（确认两行新值、文件其余部分未变）；**不要运行 Gradle 构建**（见互斥）
5. 报告写 `.agents/shared/t-v102-version-tv-qoder.md`，结果写 `.agents/outbox/t-v102-version-tv.json`

## 明确不做 / 互斥（重要）

- 🔴 **禁止运行任何 Android Gradle 构建**。APK 由 opencode 在 `t-v102-rebuild` 统一构建并做 `aapt badging` 校验。依据 RESPONSIBILITIES 边界 7：**同一工作副本只允许一次 Android Gradle 构建**，避免与 T3 冲突
- 不声明、不连接任何设备（用前须 `mumu declare`，本次不需要）
- 不读取或输出 `keystore.properties` 内容
- **不提交、不推送**（由 DSH 统一提交）

## 验收

- `build.gradle.kts` 中 `versionName == "1.0.2"`，`versionCode > 1`
- 文件其余配置逐项未变
- 报告含实际命令、原始输出、明确声明"本轮未运行构建"
- 完成后通知 DSH，以解除 `t-v102-rebuild` 的阻塞
