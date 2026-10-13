# 项目目录与首次推送清单

## 当前公开仓库

2026-10-13 已上传到 [sgsjsvc/hongguoTV](https://github.com/sgsjsvc/hongguoTV)，公开可见，远端默认分支为 `main`。第一次源码导入包含 230 个文件，是独立的根提交，未带入旧提交历史。

本机项目的 `origin` 已关联新仓库，当前分支 `codex/public-source-import` 跟踪远端 `main`。后续更新可以直接在项目根目录执行：

```sh
git add .
git diff --cached --stat
git commit -m "说明本次修改"
git push origin HEAD:main
```

旧本地分支仍保留，不能把它们作为新仓库的初次推送来源。以下初始化说明仅适用于另建仓库，不需要在当前项目重复执行。

2026-10-13 初次整理移除旧 `origin` 和全部工作流，随后按用户要求关联上述公开仓库。后端目录已统一为 `server/`，内容适配器移入 `shared/`；旧本地历史仍保留在原有分支，没有上传到新仓库。

## 应推送内容

| 路径 | 用途 |
| --- | --- |
| `apps/web-pc/` | Web 源码、Electron 主进程、依赖锁文件与配置 |
| `apps/tv-android/` | TV 源码、资源、测试、QuickJS 源码与许可证、Gradle Wrapper |
| `apps/sync-server/` | 共享服务、管理平台 |
| `server/` | 本地资料、推荐及播放后端 |
| `shared/` | 共用内容引擎与适配器、推荐算法、分类契约、资料模型、第三方来源说明 |
| `assets/branding/` | 图标原始素材与设计说明 |
| `scripts/`、`tests/` | 构建、迁移、启动、验证脚本及自动化测试 |
| `docs/`、`HANDOVER.md`、`README.md` | 当前说明、交接、验收及历史设计记录 |
| 根目录配置 | `package.json`、`package-lock.json`、`.env.example`、`.gitignore`、`.gitattributes`、`LICENSE` |

`vendor/`、QuickJS 的 C 源码、Android 图片资源以及 `gradle/wrapper/gradle-wrapper.jar` 是构建所需材料，必须保留。第三方 GitHub 来源链接是许可证追溯资料，继续保留。

早期根目录 `plan.md` 已归档为 `docs/plans/legacy-feature-plan.md`；当前实施状态优先阅读 `HANDOVER.md`。

## 本地保留、不推送

| 路径或类型 | 内容 |
| --- | --- |
| 所有 `node_modules/` | 可通过依赖锁文件重新安装 |
| `outputs/` | APK、分发压缩包、下载的运行环境、实机截图与本次源码清单 |
| `dist-win/`、所有 `dist/` 和 `build/` | 桌面程序目录及 Web/Android 构建产物 |
| `.gradle/`、`.kotlin/`、`.cxx/` | 构建缓存与中间文件 |
| `.workbuddy-ai/`、IDE 配置 | 本机助手记录与编辑器设置 |
| `server/data/`、`apps/sync-server/data/`、`server/.local/` | 本地业务资料、配置、运行日志和密钥 |
| `.env`、`local.properties`、数据库、日志、签名文件和 `shared-key.txt` | 机器路径、运行数据及凭据 |

本机用户目录中的应用资料也不属于源码仓库。可安装包以后单独作为 Release 附件分发，不提交到源码历史。不要使用强制添加绕过忽略规则。

本次按 `.gitignore` 生成的实际文件清单位于 `outputs/source-files-to-push.txt`，仅供本地检查。

## 重新创建仓库

如需全新历史，先在资源管理器显示隐藏文件，手动删除项目根目录的 `.git` 和已经清空的 `.github`。这会丢弃旧本地提交历史，当前源码文件保留。然后创建空仓库，不预置 README 或许可证，在项目根目录执行；用真实仓库地址替换占位地址：

```sh
git init -b main
git add .
git status --short
git diff --cached --stat
git commit -m "Initial source import"
git remote add origin <新仓库地址>
git push -u origin main
```

提交前检查暂存清单不含密钥、数据库、`node_modules`、`outputs` 和 `dist-win`。旧工作流已经移除，新仓库不会继承旧自动发布规则。

如希望保留旧本地提交历史，只需添加新的 `origin`，不要执行上面的初始化流程；旧历史中可能仍含已经删除的旧文件，推送前应审查历史。

## 本地检查

```sh
npm ci
npm --prefix apps/web-pc ci
npm test
npm run typecheck
npm run build
```

Android 构建、环境要求与实机操作见 [TV 工程](../apps/tv-android/README.md)。平台验收状态见 [交付验证](DELIVERY_VERIFICATION.md)。
