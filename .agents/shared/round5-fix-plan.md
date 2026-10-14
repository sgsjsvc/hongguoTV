# 第五轮修复任务规划

**协调者**: dsh
**日期**: 2026-10-14
**前置**: 第四轮发现 30 项问题（见 `discovery-round4-synthesis.md`）
**入库状态**: 已完成（`3af5e82` 业务代码、`a056538` 协作记录）

---

## 一、修复范围（用户指令：派发全部任务）

第四轮 30 项发现**全部派发修复**。按严重度与文件归属编排。

---

## 二、关键约束：文件归属唯一

**每个文件同一时间只有一个修改者**（QUICKSTART 第 13 行）。

### 文件冲突分析

| 文件 | 被哪些发现涉及 |
| --- | --- |
| `shared/content-core/hongguo.js` | D1-F1, F4, F5, F6, F7, F8, F9, F10 |
| `custom-server/vendor/hongguo.cjs` | 同上（副本，需同步） |
| `server/vendor/hongguo.cjs` | 同上（副本，需同步） |
| `custom-server/index.mjs` | D1-F2, F3, F7, D4-F2 |
| `apps/tv-android/.../MainActivity.kt` | D2-F1, F2, F3, F6 |
| `apps/tv-android/.../ui/EpisodeDrawerView.kt` | D2-F4 |
| `apps/tv-android/app/src/main/AndroidManifest.xml` | D2-F5 |
| `apps/web-pc/src/App.tsx` | D3-F1, F2, F3, F4 |
| `apps/web-pc/index.html` / `public/` | D3-F5 |
| `shared/library-store.mjs` | D4-F4, F5, F6, F8, F9 |
| `custom-server/history-store.mjs` | D4-F1, F7 |
| `custom-server/library-routes.mjs` | D4-F3 |
| `shared/content-core/`（引擎） | D1 全部 |

**结论**：`hongguo.js` 三方副本 + `MainActivity.kt` + `App.tsx` 是三个**必须串行**的热点。

---

## 三、任务编排（按批次）

### 批次 1：播放链路 P0（codex）

| 任务 | 内容 | 文件 |
| --- | --- | --- |
| **R1** | 修 D1-F1（并发清空 URL）+ D1-F2（中途失败不终止） | `hongguo.js` 三副本 + `custom-server/index.mjs` |

**理由**：P0 两项，D1-F1 是协调者引入的回归。两处都在播放链路，同属 codex 范围。

### 批次 2：TV UI（antigravity）

| 任务 | 内容 | 文件 |
| --- | --- | --- |
| **R2** | 修 D2-F1（BACK 退出整页）+ D2-F2（夺焦）+ D2-F3（白屏闪烁）+ D2-F6（寻焦映射） | `MainActivity.kt` |
| **R3** | 修 D2-F4（抽屉 Tab 抢焦） | `ui/EpisodeDrawerView.kt` |
| **R4** | 修 D2-F5（Manifest 屏幕配置） | `AndroidManifest.xml` |

**串行要求**：R2 → R3 → R4（R2 独占 `MainActivity.kt`；R3/R4 改其他文件，但需 R2 定稿避免焦点逻辑冲突）。

### 批次 3：Web/PC（antigravity）

| 任务 | 内容 | 文件 |
| --- | --- | --- |
| **R5** | 修 D3-F2（API 重复请求）+ D3-F3（Escape 退出）+ D3-F4（搜索竞态） | `App.tsx` |
| **R6** | 修 D3-F5（静态资源 404） | `index.html` / `public/` |
| **R7** | 拆 D3-F1（App.tsx 4053 行） | `App.tsx` + 新建组件文件 |

**串行要求**：R5 → R7（R7 是大重构，须在 R5 修复后做，避免重复劳动）。R6 独立可并行。

### 批次 4：同步与资料库（workbuddy）

| 任务 | 内容 | 文件 |
| --- | --- | --- |
| **R8** | 修 D4-F1（水位线无视时间）+ D4-F7（未来时间戳） | `history-store.mjs` |
| **R9** | 修 D4-F2（循环内 snapshot）+ D4-F3（外层事务） | `custom-server/index.mjs`、`library-routes.mjs` |
| **R10** | 优化 D4-F4（ack 无界）+ F5（热路径）+ F6（at 回退） | `library-store.mjs` |

**串行要求**：R8 → R9（R9 涉及 `custom-server/index.mjs`，与 R1 也有交叉 —— 见下）。

### 批次 5：D1 剩余（codex）

| 任务 | 内容 | 文件 |
| --- | --- | --- |
| **R11** | 修 D1-F3（虚构 1080P）+ F4（不校验偏移） | `custom-server/index.mjs`、`hongguo.js` |
| **R12** | 优化 D1-F6（CENC 跨轨道）+ F7（缓存无界）+ F8（请求未合并）+ F9（线性扫描）+ F5（Range 解析） | `hongguo.js` 三副本 |

**注意**：D1-F10 是 `verified: false`（推测），**需先验证再修**。

---

## 四、跨批次文件冲突

**`custom-server/index.mjs` 被三方涉及**：

| 来源 | 改动 |
| --- | --- |
| R1（codex） | D1-F2 中途失败终止 |
| R9（workbuddy） | D4-F2 循环 snapshot、D4-F3 事务 |
| R11（codex） | D1-F3 虚构 1080P |

**必须串行**：R1 → R9 → R11。

---

## 五、串行依赖总图

```
R1 (codex, 播放 P0)
 ├─> R9 (workbuddy, index.mjs)
 │    └─> R11 (codex, index.mjs + 引擎)
 ├─> R11 (codex, 引擎)
 └─> R12 (codex, 引擎优化)   ← 与 R11 同文件，需串行

R2 (antigravity, MainActivity)
 └─> R3 (antigravity, DrawerView)
      └─> R4 (antigravity, Manifest)

R5 (antigravity, App.tsx)
 └─> R7 (antigravity, App.tsx 拆分)
R6 (antigravity, index.html)  ← 独立可并行

R8 (workbuddy, history-store)
 └─> R9
R10 (workbuddy, library-store)  ← 与 R8/R9 不同文件，可并行
```

---

## 六、统一验收标准

每个修复任务：

1. **修复前有失败证据**（引用第四轮发现编号 + 探针/截图）
2. **修复后有通过证据**（同一场景复测）
3. 构建/lint/测试全绿
4. **不引入新回归**（跑现有测试）
5. 报告写入 `.agents/shared/<任务ID>-<身份>.md`
6. **证据三件套**（截图两步法 + dump 落盘 + 命令原文）

---

## 七、特别要求

### 7.1 引擎三方副本必须同步

`shared/content-core/hongguo.js` 的任何改动，**必须同步**到：

- `custom-server/vendor/hongguo.cjs`
- `server/vendor/hongguo.cjs`

但注意：三方**并非字节相同**（第 138 行 `category_$` 兼容分支不同），**不能直接覆盖**。

### 7.2 共享引擎影响三端

改动 `hongguo.js` 会**同时影响 Web / Windows / TV**。修复后需在 TV 上验证播放未回归。

### 7.3 D1-F10 需先验证

该发现 `verified: false`（静态推断）。**修复前必须先取得真实 AVC 加密样本验证**，否则可能修错方向。

---

## 八、状态

**待派发。** 用户已确认「派发全部任务」。
