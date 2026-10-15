# W1/W3 验收报告（协调者 dsh）

**验收方**: dsh
**日期**: 2026-10-15
**结论**: ✅ **两项全部通过**

---

## 一、W1 端口自动递增

### 交付内容

| 文件 | 变化 |
| --- | --- |
| `shared/listen-port.mjs` | **新增** —— `listenWithFallback()` + `serviceListenOptions()` |
| `custom-server/index.mjs` | 用 `listenWithFallback` |
| `apps/sync-server/index.mjs` | 同上 |
| `scripts/service-launcher.mjs` | 传基准端口 |
| `apps/web-pc/vite.config.ts` | 配置调整 |
| `tests/listen-port.test.mjs` | **新增测试** |

### 关键设计（符合要求）

```javascript
export function serviceListenOptions(defaultPort, env = process.env) {
    return {
        port: Number(env.HG_PORT ?? env.PORT ?? defaultPort),
        attempts: env.HG_PORT === undefined ? 11 : 1,   // ← 显式指定时不递增
    };
}
```

**`HG_PORT` 显式指定时 `attempts=1`** —— 尊重用户意图，不自动递增。

### 协调者独立实测

| 场景 | 结果 | 判定 |
| --- | --- | --- |
| 基准端口空闲 | 用 18788 | ✅ |
| 被占 1 个 | **递增到 18790** | ✅ |
| 连续占 3 个 | **递增到 18794** | ✅ |
| **`HG_PORT` 指定且被占** | **不递增，报错** | ✅ **符合要求** |
| `PORT=0` | 系统分配 7377 | ✅ |

**错误信息质量**（第 4 项）：

```
无法监听端口 18795（EADDRINUSE）。请检查并释放所属端口：
Windows 使用 netstat -ano；Linux/macOS 使用 lsof -i :18795。
也可设置 HG_PORT 指定其他端口。
```

**含释放指引** —— 符合要求。

---

## 二、W3 Electron 窗口级全屏

### 交付内容

| 文件 | 变化 |
| --- | --- |
| `apps/web-pc/electron/preload.cjs` | **新增** —— `contextBridge` 暴露 5 个方法 |
| `apps/web-pc/electron/main.cjs` | IPC handler + `win.setFullScreen` |
| `tests/desktop-fullscreen.test.mjs` | **新增测试** |
| `scripts/build-bundles.mjs` | 补复制 `listen-port.mjs` 与 `preload.cjs` |

### 协调者独立实测（CDP 驱动打包后的 exe）

| 验证项 | 结果 |
| --- | --- |
| 桥接暴露 | ✅ `object`，5 个方法齐全 |
| **反复切换 10 次** | ✅ **10/10 成功** |
| **窗口失焦后仍能全屏** | ✅ `actual: true` |
| **屏幕级全屏** | ✅ `winSize [2304,1536] === scrSize [2304,1536]` |

**关键对比**（我的原始诊断 vs W3 修复后）：

| | 修复前（我实测） | **修复后** |
| --- | --- | --- |
| 第 1 次全屏 | 成功 | 成功 |
| **第 2-10 次** | ❌ **全部失败** | ✅ **全部成功** |
| 失焦后 | ❌ 失败 | ✅ **成功** |

**`window.innerWidth === screen.width`** 证明这是**真·屏幕全屏**（非窗口最大化）—— 符合用户要求。

### W3 发现的一个真实设备差异（值得记录）

W3 报告称：

> 本 Windows 实测 `enter-full-screen` 触发时 `isFullScreen()` 仍为 false，
> 随后的 resize 才为 true。最初仅等事件的实现超时；
> 将该顺序写入测试先复现失败，再实现事件后的短间隔状态确认。

**这是真实的平台行为差异**，W3 用「先写测试复现失败，再实现修复」的方式处理 —— 方法正确。

---

## 三、测试结果

| 套件 | 结果 |
| --- | --- |
| W1/W3 新增测试 | **6 项通过** |
| **完整测试套件** | **119 项通过**（此前 109 项） |

---

## 四、用户需求的达成情况

| 需求 | 状态 |
| --- | --- |
| 端口被占用时不再启动失败 | ✅ 自动递增 |
| `HG_PORT` 显式指定时优先 | ✅ 不递增 |
| 全部失败时错误清晰 | ✅ 含释放指引 |
| Electron 全屏可用 | ✅ 10/10 |
| 窗口失焦后仍能全屏 | ✅ |
| **整个屏幕全屏（非窗口全屏）** | ✅ `winWidth === screen.width` |

---

## 五、遗留

| # | 项 | 说明 |
| --- | --- | --- |
| 1 | Vite 端口递增 | W1 改了 `vite.config.ts`，但我未独立实测（Vite 有自身机制） |
| 2 | 旧桌面 ZIP 路径 | W3 报告称「未重建旧 dist-win ZIP」，最终交付为 electron-builder 产物 |

**均不影响交付。**

---

## 六、待办

| 任务 | 负责方 | 状态 |
| --- | --- | --- |
| **W5** 详情页全屏（验证 + 补齐） | **codex** | 待认领 |
| **W4** 推荐流全屏 | **antigravity** | 待认领 |
