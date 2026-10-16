// 验证片尾倒计时的定时器清理
import fs from "node:fs";

const src = fs.readFileSync("apps/web-pc/src/App.tsx", "utf8");
const idx = src.indexOf("5秒倒计时引擎");
const block = src.slice(idx, idx + 900);

console.log("=== 片尾倒计时实现分析 ===\n");
console.log("  代码：");
block.split("\n").slice(0, 26).forEach((l) => console.log("    " + l.trim()));

console.log("\n  === 清理机制检查 ===");
const hasClearInterval = block.includes("clearInterval(timer)");
const hasCleanupReturn = /return\s*\(\)\s*=>\s*\{[\s\S]{0,120}clearInterval/.test(block);
const clearsOnCountdownEnd = block.includes("if (prev <= 1)") && block.includes("clearInterval(timer)");

console.log(`    有 clearInterval(timer): ${hasClearInterval ? "✓" : "✗"}`);
console.log(`    有 useEffect 清理函数 return () => clearInterval: ${hasCleanupReturn ? "✓" : "✗"}`);
console.log(`    倒计时结束时清理: ${clearsOnCountdownEnd ? "✓" : "✗"}`);

console.log("\n  === 场景分析 ===");
console.log("  场景 A：倒计时正常走完");
console.log(`    -> ${clearsOnCountdownEnd ? "✓ 会 clearInterval" : "✗ 不会清理"}`);
console.log("");
console.log("  场景 B：用户中途关闭弹窗（点「留在本剧」或 Esc）");
if (!hasCleanupReturn) {
  console.log("    ⚠ useEffect 无清理函数");
  console.log("       -> 弹窗关闭后，定时器继续运行");
  console.log("       -> 每 1 秒调用 setSeriesEndCountdown，直到 prev <= 1 才停");
  console.log("       -> 最多泄漏 5 秒（因为 prev<=1 时会自清）");
  console.log("");
  console.log("    严重性：低");
  console.log("      - 定时器最多存活 5 秒");
  console.log("      - 且会调用 setState（可能导致 React 警告）");
  console.log("      - 不会无限泄漏");
  console.log("");
  console.log("    但仍是缺陷：应在弹窗关闭时清理");
} else {
  console.log("    ✓ 有清理函数");
}

// 检查 useEffect 的依赖
const depsMatch = /\[playback\.showSeriesEndModal[^\]]*\]/.exec(block);
console.log(`\n    useEffect 依赖: ${depsMatch ? depsMatch[0] : "?"}`);

console.log("\n  === 判定 ===");
if (!hasCleanupReturn) {
  console.log("  ⚠ Bug #4：片尾倒计时的 useEffect 缺少清理函数");
  console.log("     影响：弹窗中途关闭时定时器继续运行（最多 5 秒）");
  console.log("     严重性：低（自限性，不会无限泄漏）");
  console.log("     建议：加 return () => clearInterval(timer)");
} else {
  console.log("  ✓ 无此问题");
}
