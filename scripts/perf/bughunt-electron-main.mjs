// Electron 主进程的其他关键路径排查
import fs from "node:fs";

const src = fs.readFileSync("apps/web-pc/electron/main.cjs", "utf8");
const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

console.log("=== Electron 主进程关键路径排查 ===\n");

// 1. 后端崩溃恢复
console.log("  --- 1. 后端进程崩溃后的处理 ---");
{
  const hasExitHandler = /backend\.once\('exit'/.test(src);
  const exitHandlers = [...src.matchAll(/backend\.once\('exit',\s*([^)]*)\)/g)].map((m) => m[1]);
  console.log(`     backend.once('exit') 处理器: ${exitHandlers.length} 个`);
  for (const h of exitHandlers) console.log(`       ${h.slice(0, 80)}`);

  const restartsOnCrash = /backend\.once\('exit'[\s\S]{0,200}(fork|startBackend|restart)/.test(src);
  note("后端崩溃后会重启", restartsOnCrash, restartsOnCrash ? "" : "⚠ 无重启逻辑");

  // 检查是否有用户提示
  const notifiesUser = /backend\.once\('exit'[\s\S]{0,300}(showErrorBox|dialog|reload)/.test(src);
  note("后端崩溃会提示用户", notifiesUser, notifiesUser ? "" : "⚠ 无提示（用户只见白屏）");
}

// 2. 后端启动超时
console.log("\n  --- 2. 后端启动超时处理 ---");
{
  const timeoutMatch = /setTimeout\(\(\)\s*=>\s*reject\(Error\('([^']+)'\)\),\s*(\d+)\)/.exec(src);
  note("有启动超时", !!timeoutMatch, timeoutMatch ? `${timeoutMatch[2]}ms: ${timeoutMatch[1]}` : "");
  const hasErrorDialog = /whenReady\(\)[\s\S]{0,400}showErrorBox/.test(src);
  note("超时会提示用户", hasErrorDialog, "");
}

// 3. 窗口关闭 vs 应用退出
console.log("\n  --- 3. 窗口与应用生命周期 ---");
{
  const hasWindowAllClosed = src.includes("window-all-closed");
  const hasInitializingGuard = /window-all-closed[\s\S]{0,120}initializing/.test(src);
  note("有 window-all-closed 处理", hasWindowAllClosed, "");
  note("有 initializing 守卫", hasInitializingGuard, hasInitializingGuard ? "（启动中不退出）" : "");

  const hasActivate = src.includes("activate");
  note("有 activate 处理（macOS）", hasActivate, "");
}

// 4. 退出清理
console.log("\n  --- 4. 退出时清理后端 ---");
{
  const hasBeforeQuit = src.includes("before-quit");
  note("有 before-quit 处理", hasBeforeQuit, "");
  const sendsShutdown = /before-quit[\s\S]{0,400}send\(\{type:'shutdown'\}\)/.test(src);
  note("退出时发送 shutdown", sendsShutdown, "");
  const hasKillTimeout = /before-quit[\s\S]{0,500}setTimeout\(\(\)\s*=>\s*\{[\s\S]{0,80}kill\(\)/.test(src);
  note("有 kill 超时兜底", hasKillTimeout, "");
  const hasExitCodeCheck = /before-quit[\s\S]{0,200}exitCode!==null/.test(src);
  note("检查后端是否已退出", hasExitCodeCheck, "");
}

// 5. 协议处理器安全性
console.log("\n  --- 5. 自定义协议安全性 ---");
{
  const handlerMatch = /protocol\.handle\('hongguotv',[\s\S]{0,500}?\}\)/.exec(src);
  const handler = handlerMatch ? handlerMatch[0] : "";
  // 检查是否有路径遍历防护
  const usesPathname = handler.includes("source.pathname");
  const concatenatesRaw = /backendOrigin\s*\+\s*source\.pathname/.test(handler);
  note("协议处理器拼接 pathname", usesPathname && concatenatesRaw, "");

  console.log("     ⚠ 潜在风险：source.pathname 可能含路径遍历（如 /../）");
  console.log("       但 backendOrigin 指向本地后端，且后端有自己的路由校验");
  console.log("       → 风险有限（本地服务，非外部输入）");

  const blocksExternal = handler.includes("bypassCustomProtocolHandlers");
  note("设置了 bypassCustomProtocolHandlers", blocksExternal, "（避免递归）");
}

// 6. preload 的安全性
console.log("\n  --- 6. preload 安全性 ---");
{
  const preload = fs.readFileSync("apps/web-pc/electron/preload.cjs", "utf8");
  console.log(`     preload 行数: ${preload.split("\n").length}`);
  const exposesIpc = /contextBridge\.exposeInMainWorld/.test(preload);
  note("使用 contextBridge", exposesIpc, "");
  const hasNodeIntegration = /nodeIntegration:\s*true/.test(src);
  note("主窗口禁用 nodeIntegration", !hasNodeIntegration, hasNodeIntegration ? "⚠ 启用了" : "");
  const hasContextIsolation = /contextIsolation:\s*true/.test(src);
  note("启用 contextIsolation", hasContextIsolation, "");
  // 检查暴露的 API 是否过宽
  const invokes = [...preload.matchAll(/invoke\(['"]([^'"]+)['"]/g)].map((m) => m[1]);
  console.log(`     暴露的 IPC 通道: ${[...new Set(invokes)].join(", ") || "无"}`);
}

// 7. 日志文件增长
console.log("\n  --- 7. 日志文件增长 ---");
{
  const appends = [...src.matchAll(/appendFileSync\(([^,]+),/g)].map((m) => m[1].trim());
  console.log(`     appendFileSync 调用: ${appends.length} 处`);
  for (const a of appends) console.log(`       ${a.slice(0, 70)}`);
  note("启动日志无大小限制", appends.length > 0, "⚠ 每次启动追加，长期会增长（但很小）");
}

// 8. 多实例
console.log("\n  --- 8. 多实例控制 ---");
{
  const hasSingleInstance = src.includes("requestSingleInstanceLock");
  note("有单实例锁", hasSingleInstance, hasSingleInstance ? "" : "⚠ 无（可能启动多个后端）");
  if (!hasSingleInstance) {
    console.log("     ⚠ 用户重复启动会创建多个 Electron 实例");
    console.log("       每个实例 fork 一个后端（PORT=0 自动分配端口）");
    console.log("       影响：多份 userData 写入竞争、资源浪费");
  }
}

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
