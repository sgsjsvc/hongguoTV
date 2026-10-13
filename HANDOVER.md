# 当前恢复状态（2026-10-13）

已按用户要求恢复 c476053 的 Web／Node 代码和 custom-server、server 目录结构。当前版本 ce5398c 及交付包已单独保存，详见 docs/ROLLBACK_STATUS.md。保留脚本部署方式、用户数据库和远程密钥，电脑端保持关闭。以下为该版本的历史交接记录。

# 红果短剧项目交接

更新日期：2026-10-13。Web、Windows 桌面、Android TV 均可独立获取内容、处理播放和保存资料，不需要其他设备开机。完整说明见 [本地服务与家庭同步](docs/LOCAL_REMOTE_SERVICES.md)。

## 架构和目录

- apps/web-pc：共用 React / TypeScript 界面；Electron 使用稳定的 hongguotv://app/ 地址，管理只监听本机动态端口的独立后端。
- custom-server：Node 本地后端直接调用 server/provider.mjs 和 shared/content-core/hongguo.js，不依赖固定 192.168.1.21:8787。
- shared/library-store.mjs：SQLite 完整资料库、事务事件队列、删除标记与幂等接收。
- custom-server/library-sync.mjs：远程校时、上传、增量下载、重试和实例隔离。
- apps/sync-server：仅存家庭资料的远程服务，包含 启动脚本与独立包。
- apps/tv-android：Kotlin / Views / Media3，minSdk 22；QuickJS 2025-09-13 自编译 JNI 执行共享内容引擎，网络、加密、Range 媒体及 SQLite 使用原生实现，不再要求首次填写本地后端地址。
- scripts/service-launcher.mjs：启动、所属进程管理、重复启动和端口占用检查。
- scripts/build-bundles.mjs：校验并打包各平台运行环境、Web / 远程 / Windows 桌面。
- scripts/migrate-library.mjs：幂等迁移数据库，保留源数据与删除标记。

## 开发与运行

开发需要 Node 22.13+；交付一体包自带 Node 22.20.0。

```powershell
npm ci
npm --prefix apps/web-pc ci
npm run server
npm run dev
npm test
npm run typecheck
npm run build
npm run build:bundles
```

本地服务默认 8788，开发页面 3000。npm run bridge 保留兼容基础服务入口，独立包无需运行它。

## 数据规则

每个端的 SQLite 始终保存完整资料。未配置远程时仅本地使用；配置后同步收藏、历史、搜索及默认画质／倍速。地址、密钥和设备设置不共享。

每秒记录播放，暂停、跳转、切剧、结束和离开立即记录；操作与待同步事件事务落盘。历史允许快退和重看，迟到事件不能覆盖新进度，删除标记防止旧离线记录复活。游标按远程实例隔离。

历史统一按最近观看排列，每部剧一张续播卡，不再分类。Web / 电脑保留删除及清空确认；TV 没有这些操作。远程播放偏好在下一次播放生效，自动降级不回写偏好。

旧数据成功确认后才完成迁移。原开发机 custom-server/data 的八条历史已迁入 Windows 用户资料 HongguoTV/web-service。当前运行独立 Web 包的 8788 服务，3000 保留开发页面。测试家庭密钥不属于交付配置。

## 交付和验收

outputs/bundles 提供五平台 Web 包、Windows 桌面 ZIP、Linux x64 / arm64 远程包。TV APK 为 outputs/tv-android/hongguotv-android5.1.1-debug.apk。最终实例保护修正版已安装至 192.168.1.120，保留数据，实机启动、HEVC 解码和播放进度复查通过。旧 dist-win/hongguoTV-Windows-x64.zip 不作为本轮交付。

Node 39 项、Web 类型检查和构建通过；Windows Web / 桌面生命周期与实际远程跨端资料同步通过。Android JVM 19 项、lint、构建、模拟器最终 14 项通过；API 22 电视独立内容签名／解密／播放／seek 和真实 Node 远程同步通过。详见 [TV 验证](docs/TV_ANDROID_VERIFICATION.md)。

Linux / macOS 包已生成并校验归档权限，尚未在对应宿主启动。API 35 TV、长时间连播和更多厂商遥控器仍待验收。未提供公网主机，远程尚未部署公网。

保留此前大量未提交迁移及旧端删除，避免重置工作区或恢复 RN / iOS / kotlin-tv。首版不含账号、离线下载、自动更新、正式签名或应用商店发布。





## 远程管理平台（2026-10-13）

共享服务 8791 首页新增家庭密钥登录的管理界面，支持概览、设备活动、收藏／历史／搜索删除与清空、播放偏好。管理操作走既有事件协议，删除标记同步到各端。电视已配置 http://192.168.1.67:8791 并显示已同步，密钥保留在本地设置，不写入文档。新增四项管理测试，Node 共43项通过；浏览器登录、确认、清空、偏好、筛选与手机布局通过。


## 密钥设置（2026-10-13）

管理平台新增密钥设置，支持自定义／随机生成、显示／复制、确认与文件原子持久化。新密钥立即生效，旧密钥失效，资料保留；环境变量托管密钥不允许页面改写。当前家庭密钥未更换，只有实际保存时才轮换。新增4项测试，Node共47项通过；浏览器更换、当前会话、重新登录和手机布局通过。


## TV 卡死修复（2026-10-13）

远程同步原有外部SQLite事务与TvLibrary同步读锁发生倒序死锁；现统一通过先获取资料库锁的transaction入口。新增真实SQLite并发回归，旧版确定失败、修复通过。模拟器15项、API22实机5项通过，JVM19项、lint和构建通过。最终修正版已安装并保留资料，APK更新于outputs/tv-android，详细线程证据与SHA256见docs/TV_ANDROID_VERIFICATION.md。


### 2026-10-13 TV 分类空列表修复

- 实机 192.168.1.120（Android 5.1.1/API 22）原分类请求稳定返回 0 条；日志显示 App 分类无数据后回退旧榜单，报“榜单页面没有数据”，随后被吞成空列表。
- TV 改为直接读取官网 `/category/{type}/{tag}?page=N`，与正常工作的 Web 分类入口保持一致。统一真人剧、漫剧、AI 剧类型及 24 个官方题材标签；保留字符串 ID。网络及结构错误向页面重试入口传播，不伪装为空成功。
- 回归测试 `tests/tv-content-api.test.mjs` 在旧实现失败、新实现通过；覆盖类型、题材、分页、字符串 ID 和网络错误传播。Node 22.20.0 全部 48 项测试通过，Web 构建通过；Android JVM 测试、lint、Debug APK 构建通过。
- 修正版已通过 `adb install -r` 安装实机，保留用户数据。实机独立服务：真人剧、漫剧、AI 剧、爱情筛选及第 2 页各返回 24 条；分类页面已显示剧集卡片和加载更多入口。
- 最新交付 APK：`outputs/tv-android/hongguotv-android5.1.1-debug.apk`，SHA256：`D6BD5FA0301E683A5556649732CC8E9D8BA7E3AAB0903E9877464BA311ACE5BA`。包含前述 SQLite 死锁修复。

### 2026-10-13 TV 分类筛选平铺

- 按用户参考截图，分类顶部直接展示真人剧／漫剧／AI 剧和全部题材＋24 个官方题材。删除“内容类型”和“题材筛选”的弹窗入口，标签根据可用宽度自动换行。
- 红色标识已选筛选，白色边框表示遥控器焦点。筛选重新加载第一页，并恢复当前标签焦点；详情返回仍恢复海报位置。网络错误保留重试。
- 新交互用例在旧版因标签未展开而失败，修复后通过；覆盖全部标签可见、换行、按确定键筛选、选中状态及焦点恢复。模拟器 TV 交互 8 项通过，Android JVM 测试、lint 和 Debug APK 构建通过。
- Android 5.1.1 实机 192.168.1.120 已保留数据更新：720p 顶部类型一行、题材两行，无截断。截图：outputs/debug/tv-category-expanded.png。
- 最新 APK SHA256：3cc0608f7d8a8190fd487365fb371ce5c7cc75936aeca8726a84e507bfc58973


### 2026-10-13 多端混合推荐

实施了共用推荐核心、三类候选混合、近期观看降权、全剧完成排除、兴趣排序及20%探索。每次新会话换序，同会话分页重试稳定且不重复；新增可同步的实际观看/曝光/主动快跳信号。Web/电脑/TV/远程管理设置支持推荐模式与重置兴趣，保留历史收藏。详情见 docs/RECOMMENDATIONS.md。

76项Node/TV JS、26项Android JVM测试通过，lint与构建通过；14项模拟器交互资料同步回归+1项真实网络原生混合测试通过。真实源首批12真人/7漫剧/5AI；浏览器模式与重置、Windows桌面内置后端生命周期、Windows一体包验证通过。全部独立包已重打，本机8788与8791已更新，3000保持运行。

官网最新排序当前不可用，探索来自深页与未看/新发现题材，不把热门伪称最新。TV新APK已就绪，SHA256 bf5ddb12bdda62900c2f03d99b28b5c0787b277382bfcd04d7dd63d46722a237；实机安装等待电视ADB握手恢复，不应宣称已在API22安装新版。

### 2026-10-13 混合推荐 API 22 实机完成与连播修复

192.168.1.120 重启后 ADB 恢复，已保留数据安装最终 APK。实机确认三类混合、同会话重试稳定、第二页无重复及新会话换序。发现并修复清空/替换播放列表产生的 ENDED 被误认为正常完播：该重入会加载第二集却保留第一集索引，从而漏记历史及推荐时长。只允许当前有效分集的媒体结束触发连播。

回归用例旧版 expected 9101 / actual 9102 失败，修复后保持 9101；TV 交互9项、JVM26项、lint和APK构建通过。最终实机第一部AI剧“药香满院，种田采药赚万金”有效观看47509ms；切到“无人似你”仍是第一集，视频00:19、历史19229ms、推荐有效观看19140ms，均已在8791确认，跳过计数为0。全程没有清除历史收藏；调试器已断开，测试端口转发移除。

最新APK SHA256：6b70d3cf82df56242f995ca322176aaafc14966bef2ce4be56645d1bbec8c1a0（替代此前bf5d...版本）。路径：outputs/tv-android/hongguotv-android5.1.1-debug.apk。此前“待安装”的记录已完成。

### 2026-10-13 分类真实来源修正

用户指出分类需以官网三个类型入口为准。核对官网SSR：真人剧24题材；漫剧与AI剧各8题材（脑洞、玄幻、剧情、末世、豪门、奇幻、科幻、冒险）。修正此前把真人24题材套用于全部类型的问题。

新增共享 shared/category-contract.cjs，从官网selectorList读取题材与category_json_ids；校验categoryRoute.contentType、canonicalPath、所选题材ID和pagination.pageNum。Node/TV分类API均使用当前类型真实元数据，错误显示重试，不回退其他类型。Web/电脑/TV切换类型重置题材、隔离旧响应；分页遵循官网totalPages。TV推荐候选也校验类型来源，兴趣题材使用当前类型支持的标签。

79项Node/TV JS测试、26项Android JVM测试、lint、Web/APK构建通过；Android交互与真实原生推荐共10项通过。官网实测三个类型基础页及各自第一个题材第二页均返回正确类型和24条，漫剧错误爱情筛选返回400。浏览器实际验证24/8/8与筛选重置；API22电视已安装，原生接口及页面同样24/8/8，漫剧完整显示8个真实题材加全部。截图outputs/debug/official-tv-ai.png、official-ai-category.png。

8788已更新，独立Web五架构、Windows桌面及远程Linux包已重新生成，Windows包启动/持久化/所属停止验证通过。新TV APK保留用户数据，SHA256：54464612e9582621e7345ba1d21392e6f8b71acea0068121ba01c243ff57f5bd。
# 2026-10-13 项目整理与重新建仓

已按用户要求移除旧 Git 远程 `origin` 和全部 GitHub 工作流文件。旧 GHCR 镜像引用改为本地源码构建，第三方来源链接和许可证保留。早期根目录 `plan.md` 已归档为 `docs/plans/legacy-feature-plan.md`。

推送清单和步骤见 `docs/PUSH_GUIDE.md`；`.gitignore` 排除依赖、`dist-win`、`outputs`、缓存、数据库、日志、密钥及本机助手记录。实际源码清单位于 `outputs/source-files-to-push.txt`。旧远端仓库未操作；自动审批审查拒绝删除 `.git` 和空工作流目录，故旧本地历史仍保留，目录已没有远程推送地址。如需全新历史，按推送说明手动删除 `.git` 后重新初始化。

# 2026-10-13 公开仓库提交

用户指定使用 sgsjsvc 账号，并明确要求公开。已创建 `https://github.com/sgsjsvc/hongguoTV`，默认分支 `main`；首次源码提交包含 230 个文件，是全新根提交，不包含旧仓库历史、安装包、本地资料或密钥。本机 `origin` 已改为新仓库，当前 `codex/public-source-import` 跟踪远端 `main`，后续推送使用 `git push origin HEAD:main`。旧本地分支仍保留，不向新仓库推送；本次整理的测试记录为 75 项 Node 测试通过、Web 构建通过、Compose 配置检查通过。

