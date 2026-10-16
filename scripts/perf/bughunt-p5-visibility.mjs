// 验证 P5 的 visibilitychange 是否绕过了 isVideoPlaying 检查
import fs from "node:fs";

const src = fs.readFileSync("apps/web-pc/src/api.ts", "utf8");

console.log("=== P5 visibilitychange 逻辑分析 ===\n");

// 提取 visibilitychange 处理
const idx = src.indexOf('document.addEventListener("visibilitychange"');
const block = src.slice(idx, idx + 600);
console.log("  代码片段：");
block.split("\n").slice(0, 16).forEach((l) => console.log("    " + l.trim()));

console.log("\n  === 分析 ===");
const hasHiddenCheck = block.includes("document.hidden");
const callsRefreshUnconditionally = /if \(!document\.hidden\) \{[\s\S]{0,200}?void refreshLibrary\(\)/.test(block);
const checksVideoPlaying = block.includes("isVideoPlaying");

console.log(`  有 document.hidden 检查: ${hasHiddenCheck ? "✓" : "✗"}`);
console.log(`  恢复前台时无条件 refreshLibrary: ${callsRefreshUnconditionally ? "⚠ 是" : "否"}`);
console.log(`  恢复前台时检查 isVideoPlaying: ${checksVideoPlaying ? "✓" : "✗ 否"}`);

console.log("\n  === 潜在问题 ===");
if (callsRefreshUnconditionally && !checksVideoPlaying) {
  console.log("  ⚠ visibilitychange 恢复前台时，未检查视频是否在播放");
  console.log("     场景：用户切到其他窗口 -> 切回 -> 立即发起 refreshLibrary");
  console.log("     若此时视频在播放，会与视频流争用连接");
  console.log("");
  console.log("     对比：scheduleNextPoll 内部有 isVideoPlaying() 检查（95-98 行）");
  console.log("     但 visibilitychange 路径绕过了该检查");
  console.log("");
  console.log("     严重性：低-中");
  console.log("       - 只发生一次（不是每秒）");
  console.log("       - 单次 14KB 请求，影响有限");
  console.log("       - 但与设计意图（播放时不争用）不一致");
} else {
  console.log("  ✓ 无此问题");
}

// 检查 online 事件是否也有同样问题
console.log("\n  === 其他事件路径 ===");
const onlineIdx = src.indexOf('window.addEventListener("online"');
if (onlineIdx > 0) {
  const onlineBlock = src.slice(onlineIdx, onlineIdx + 300);
  console.log("  online 事件：");
  onlineBlock.split("\n").slice(0, 8).forEach((l) => console.log("    " + l.trim()));
  const onlineChecksVideo = onlineBlock.includes("isVideoPlaying");
  console.log(`\n  online 事件检查 isVideoPlaying: ${onlineChecksVideo ? "✓" : "✗ 否"}`);
  if (!onlineChecksVideo) {
    console.log("  ⚠ 同样未检查（但 online 事件频率低，影响更小）");
  }
}
