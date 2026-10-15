# W1 端口自动递增（避免占用导致启动失败）

**任务 ID**: `t-w1-port-autoincrement`
**负责人**: codex
**依赖**: 无
**协调者**: dsh
**范围**: 后端服务端口处理（3 个服务）

---

## 一、用户需求

> 在之前先解决端口问题，要解决避免端口被占用无法启动服务的问题，怎么解决最好

**已确认方案**：**自动递增端口**，**覆盖三个服务**。

---

## 二、现状问题

### 问题 1：`custom-server` 端口占用即崩溃

`custom-server/index.mjs:801`：

```javascript
server.listen(PORT, process.env.HG_HOST || "0.0.0.0", () => { ... });
```

**没有 `error` 事件处理** → 端口被占用时 Node 抛 `EADDRINUSE` 并**直接崩溃**，用户看到难懂的堆栈。

### 问题 2：`sync-server` 同样问题

`apps/sync-server/index.mjs:14`：

```javascript
server.listen(Number(process.env.PORT||8791), ..., () => { ... });
```

**同样无 `error` 处理。**

### 问题 3：`service-launcher.mjs` 端口写死

`scripts/service-launcher.mjs:38,46`：

```javascript
PORT: process.env.HG_PORT || (remote ? '8791' : '8788')
port: Number(process.env.HG_PORT || (remote ? '8791' : '8788'))
```

**端口在启动前就写死**，若被占用则子进程崩溃，launcher 等待超时后报错：

> 启动未就绪，请查看 .../service-errors.log；如端口占用，设置 HG_PORT 后重试。

**用户需手动设 `HG_PORT`** —— 不符合「自动递增」要求。

### 问题 4：Vite 开发页

`apps/web-pc/vite.config.ts:15` 固定 `port: 3000`。

Vite 默认在端口占用时会**询问或递增**，但行为不确定（`strictPort` 未设）。

---

## 三、参考：Electron 已有的正确做法

`apps/web-pc/electron/main.cjs:16`：

```javascript
env: { ..., PORT: '0', ... }
```

**`PORT=0` 让操作系统分配空闲端口**，然后通过 IPC 回传实际端口（第 18、20 行）：

```javascript
const port = await new Promise((resolve, reject) => {
    ...
    backend.on('message', message => {
        if (message?.type === 'ready') { clearTimeout(timeout); resolve(message.port); }
    });
});
backendOrigin = `http://127.0.0.1:${port}`;
```

**这是最可靠的方案** —— 但 `PORT=0` 每次端口都变，对**需要固定地址**的场景（如用户手动访问、Web 端代理）不适用。

---

## 四、要求

### 4.1 自动递增

端口被占用时，**自动尝试下一个**（最多 N 次），成功后打印实际端口。

**建议**：

| 服务 | 基准端口 | 递增范围 |
| --- | --- | --- |
| 本地内容服务 | 8788 | 8788–8798（11 次） |
| 家庭共享服务 | 8791 | 8791–8801（11 次） |
| Vite 开发页 | 3000 | 3000–3010（11 次） |

### 4.2 行为要求

| # | 要求 |
| --- | --- |
| 1 | 端口被占时**自动尝试下一个**，不崩溃 |
| 2 | 成功后**明确打印实际端口**（便于用户访问） |
| 3 | 全部尝试失败时给出**清晰错误**（含释放指引） |
| 4 | **`HG_PORT` 显式指定时优先**（不递增，尊重用户意图） |
| 5 | 递增后**通过 IPC 回传实际端口**（Electron / launcher 依赖） |
| 6 | **不破坏现有行为**（`PORT=0` 的随机分配仍可用） |

### 4.3 关键：端口协商链

**launcher 与子进程需协调**。现状：

```
launcher 写死 PORT=8788 → 子进程 listen(8788) → 崩溃
```

**改为**：

```
launcher 传 PORT=8788（基准）
  → 子进程尝试 8788，被占则试 8789...
  → 成功后 process.send({type:'ready', port:实际端口})
  → launcher 用回传端口写 state.json
```

**注意**：`service-launcher.mjs:46` 已读回传端口（`state.port = message.port`），
但第 38 行的 `PORT` 传入仍是写死值 —— **需确认递增逻辑落在子进程**。

---

## 五、实现建议

### 5.1 抽出通用函数

建议在 `shared/` 下新增（或内联）：

```javascript
/**
 * 尝试在 basePort 起的范围内监听，返回实际端口
 * @param {http.Server} server
 * @param {number} basePort  基准端口（0 = 系统分配）
 * @param {string} host
 * @param {number} attempts  最大尝试次数
 */
export function listenWithFallback(server, basePort, host, attempts = 11) {
    return new Promise((resolve, reject) => {
        let port = basePort, tried = 0;
        const onError = (err) => {
            if (err.code === 'EADDRINUSE' && basePort !== 0 && ++tried < attempts) {
                server.removeListener('error', onError);
                port += 1;
                console.warn(`端口 ${port - 1} 被占用，尝试 ${port}…`);
                server.listen(port, host);
                return;
            }
            reject(err);
        };
        server.on('error', onError);
        server.once('listening', () => resolve(server.address().port));
        server.listen(port, host);
    });
}
```

**注意**：`server.on('error')` 需在重试时正确处理监听器（避免泄漏）。

### 5.2 三个服务的改法

| 文件 | 改法 |
| --- | --- |
| `custom-server/index.mjs:801` | 用 `listenWithFallback`；失败时打印释放指引 |
| `apps/sync-server/index.mjs:14` | 同上 |
| `scripts/service-launcher.mjs:38,46` | 传入**基准端口**而非固定值；用回传端口写 state |
| `apps/web-pc/vite.config.ts` | 设 `strictPort: false`，或自定义递增逻辑 |

### 5.3 错误提示（全部失败时）

```
错误：端口 8788–8798 均被占用，无法启动服务。

请检查占用进程：
  Windows: netstat -ano | findstr :8788
           taskkill /PID <PID> /F
  Linux/macOS: lsof -i :8788

或指定其他端口：
  HG_PORT=9000 npm run server
```

---

## 六、硬性约束

1. **可改文件**：
   - `custom-server/index.mjs`
   - `apps/sync-server/index.mjs`
   - `scripts/service-launcher.mjs`
   - `apps/web-pc/vite.config.ts`
   - `shared/` 下新增工具文件（如需）
2. **不要改** `apps/web-pc/electron/main.cjs`（`PORT=0` 已是最优，且改动风险高）
3. **不要改** `apps/tv-android/`（TV 端不走这些服务）
4. **不要回退**任何已完成改动
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 七、验收标准

| # | 项 | 验证方式 |
| --- | --- | --- |
| 1 | 8788 被占时自动用 8789 | 手动占用 8788 后启动，检查日志与实际端口 |
| 2 | 端口被占时**不崩溃** | 同上，进程存活 |
| 3 | 打印实际端口 | 日志中出现实际端口 |
| 4 | `HG_PORT` 指定时不递增 | 设 `HG_PORT=8899` 验证 |
| 5 | 连续占用多个端口仍能启动 | 占用 8788-8790 后启动 |
| 6 | 全部占用时错误清晰 | 占用 8788-8798，检查错误信息含释放指引 |
| 7 | Electron 的 `PORT=0` 仍工作 | 启动桌面版验证 |
| 8 | `service-launcher` 正常工作 | `start.cmd` 启动验证 |
| 9 | 现有测试通过 | `npm test` |
| 10 | 报告写入 `.agents/shared/t-w1-port-autoincrement-codex.md` | |

---

## 八、证据要求

**必须提供**：

1. **端口占用场景的实测**：
   - 先占用 8788（如用 `node -e "require('http').createServer().listen(8788)"`）
   - 再启动服务，验证自动递增到 8789
   - 附日志输出
2. **不崩溃的证据**：进程存活
3. **`HG_PORT` 优先的证据**
4. **全部占用时的错误信息**
5. **`npm test` 结果**

**注意**：测试后**清理占用的测试进程**。

---

## 九、已知陷阱

| 陷阱 | 说明 |
| --- | --- |
| 端口测试残留 | 测试用的占位进程必须清理，否则影响后续 |
| `server.on('error')` 泄漏 | 重试时需正确移除监听器 |
| `PORT=0` 语义 | 0 表示系统分配，**不要**递增 |
| launcher 双重写端口 | `:38` 传 PORT 与 `:46` 写 state 需一致 |
| Vite 的 `strictPort` | 设 true 会失败，设 false 会自动递增（但提示可能被忽略） |

---

## 十、提交方式

```powershell
node .agents/cli.mjs done t-w1-port-autoincrement codex "结论及报告路径"
```
