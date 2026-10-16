// 验证 Electron 后端崩溃的影响（关键缺陷）
import fs from "node:fs";

const src = fs.readFileSync("apps/web-pc/electron/main.cjs", "utf8");

console.log("=== Electron 后端崩溃影响分析 ===\n");

console.log("  --- 后端退出处理器的实际内容 ---");
const handlers = [...src.matchAll(/backend\.once\('exit',\s*\(?([^)]*)\)?\s*=>\s*\{([\s\S]{0,200}?)\}\)/g)];
handlers.forEach((m, i) => {
  console.log(`  处理器 ${i + 1}:`);
  console.log(`    ${m[2].trim().slice(0, 150)}`);
});

console.log("\n  --- 三个 exit 处理器的用途 ---");
console.log("  1. startBackend 内（第 61 行）：启动阶段，用于拒绝 ready Promise");
console.log("  2. startBackend 内（第 60 行）：关闭日志流");
console.log("  3. before-quit 内（第 90 行）：退出流程");
console.log("");
console.log("  ⚠ 关键：这三个都是 'once'，且启动完成后就没有存活的崩溃处理器");
console.log("     -> 运行期后端崩溃后，无任何处理");

console.log("\n  --- 运行期崩溃的后果 ---");
console.log("  1. 后端进程死亡");
console.log("  2. Electron 主进程无感知（无 exit 监听）");
console.log("  3. 渲染进程继续发请求到 backendOrigin");
console.log("  4. 请求全部失败（ECONNREFUSED）");
console.log("  5. 用户看到：页面空白/所有操作失败/无错误提示");
console.log("");
console.log("  恢复方式：只能重启应用");

console.log("\n  --- 严重性评估 ---");
console.log("  触发概率：低-中");
console.log("    - 后端是 Node 进程，稳定性较高");
console.log("    - 但 OOM、未捕获异常、用户强杀都会导致崩溃");
console.log("  影响：高（应用完全不可用，且无提示）");
console.log("  综合：中");

console.log("\n  --- 修复建议 ---");
console.log("  1. 在 createWindow 后注册持久崩溃监听：");
console.log("     backend.once('exit', (code) => {");
console.log("       if (quitting) return;");
console.log("       dialog.showErrorBox('服务异常', '内置服务已停止，请重启应用');");
console.log("       // 或尝试重启后端");
console.log("     });");
console.log("  2. 可选：自动重启（带次数上限，防无限重启）");
console.log("  3. 可选：渲染进程显示友好错误页");

// 检查渲染进程是否有错误处理
console.log("\n  --- 渲染进程是否有网络错误处理 ---");
const apiSrc = fs.readFileSync("apps/web-pc/src/api.ts", "utf8");
const hasErrorEvent = apiSrc.includes("history-storage-error") || apiSrc.includes("addEventListener");
console.log(`     api.ts 有错误事件: ${hasErrorEvent ? "✓" : "✗"}`);
const hasRetry = /retry|重试/i.test(apiSrc);
console.log(`     api.ts 有重试逻辑: ${hasRetry ? "✓" : "✗"}`);
