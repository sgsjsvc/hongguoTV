# T1 v1.0.2 版本号统一（Web / 桌面端）

- **任务ID**: `t-v102-version-web`
- **assignee**: `antigravity`（apps/web-pc 主责）
- **依赖**: 无
- **上游依据**: `.agents/shared/dsh-release-plan-20261016.md` 步骤 4；用户 2026-10-16 已定版本号 **v1.0.2**

## 背景（DSH 实测）

桌面安装包/便携版的文件名与内嵌版本由 electron-builder 依据 `apps/web-pc/package.json` 的 `version` 生成：

```
artifactName: "${productName}-${version}-${arch}-setup.${ext}"      (electron-builder.config.cjs:152)
artifactName: "${productName}-${version}-${arch}-portable.${ext}"   (electron-builder.config.cjs:156)
```

当前 `apps/web-pc/package.json` 的 `version = 1.0.0`。本次发布为 **v1.0.2** —— 若不修改，产物内嵌与命名为 `1.0.0`，与 Release 版本号不一致（即 DSH 裁决定义的 P5 阻塞）。

## 唯一写者范围（只允许改这两个文件）

- `apps/web-pc/package.json`
- `apps/web-pc/package-lock.json`

## 必须做

1. `apps/web-pc/package.json` 的 `version` → `"1.0.2"`
2. `apps/web-pc/package-lock.json` 的 `version` 字段同步为 `"1.0.2"`（顶层 `version` 与 `packages[""].version` 两处）；**不得**手工改动依赖树中其它包的 `version`
3. 依赖列表保持不变（不增删任何依赖）
4. 自测（记录实际命令与输出）：
   - `node -p "require('./apps/web-pc/package.json').version"` → `1.0.2`
   - `npm --prefix apps/web-pc exec -- tsc --noEmit -p apps/web-pc/tsconfig.json` → 退出 0
5. 报告写 `.agents/shared/t-v102-version-web-antigravity.md`，结果写 `.agents/outbox/t-v102-version-web.json`

## 明确不做

- **不改根 `package.json`**（其 `version = 0.1.1` 非产品版本，DSH 决定保留不动）
- 不改 `apps/web-pc/electron-builder.config.cjs`
- 不改任何业务源码；**不构建桌面 EXE**（桌面打包由 opencode 在 `t-v102-rebuild` 执行）
- **不提交、不推送**（由 DSH 统一提交，以维持"确定代码版本"的单一来源）
- 不声明或使用任何设备

## 验收

- `apps/web-pc/package.json` 与 `package-lock.json` 的版本一致为 `1.0.2`
- typecheck 退出 0
- 报告含实际命令、原始输出与"未验证项"
- 完成后通知 DSH，以解除 `t-v102-rebuild` 的阻塞
