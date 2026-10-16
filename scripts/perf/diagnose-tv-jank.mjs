// 定位分类页滚动 Janky 11.98% 的真实原因
import { execSync } from "node:child_process";

const adb = process.env.LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe";
const env = { ...process.env, ANDROID_ADB_SERVER_PORT: "15037" };
const DEVICE = process.argv[2] || "127.0.0.1:16384";
const PKG = "com.hongguotv.tv";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, t = 40000) => {
  try { return execSync(`"${adb}" -s ${DEVICE} shell ${cmd}`, { encoding: "utf8", env, timeout: t, stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch { return ""; }
};

console.log(`=== 分类页 Janky 原因定位 (${DEVICE}) ===\n`);

// 1. 获取完整 gfxinfo，看所有瓶颈计数器
sh(`dumpsys gfxinfo ${PKG} reset`);
await sleep(500);
for (let i = 0; i < 30; i += 1) { sh("input keyevent 20"); await sleep(80); }
await sleep(2500);

const gfx = sh(`dumpsys gfxinfo ${PKG}`);

console.log("  完整瓶颈计数器：");
const counters = [
  ["Total frames rendered", /Total frames rendered:\s*(\d+)/],
  ["Janky frames", /Janky frames:\s*(\d+)/],
  ["Janky frames (legacy)", /Janky frames \(legacy\):\s*(\d+)\s*\(([\d.]+)%\)/],
  ["Number Missed Vsync", /Number Missed Vsync:\s*(\d+)/],
  ["Number High input latency", /Number High input latency:\s*(\d+)/],
  ["Number Slow UI thread", /Number Slow UI thread:\s*(\d+)/],
  ["Number Slow bitmap uploads", /Number Slow bitmap uploads:\s*(\d+)/],
  ["Number Slow issue draw commands", /Number Slow issue draw commands:\s*(\d+)/],
  ["Number Frame deadline missed", /Number Frame deadline missed:\s*(\d+)/],
  ["Number Frame deadline missed (legacy)", /Number Frame deadline missed \(legacy\):\s*(\d+)/],
];
for (const [name, re] of counters) {
  const m = re.exec(gfx);
  console.log(`    ${name.padEnd(42)} ${m ? (m[2] ? `${m[1]} (${m[2]}%)` : m[1]) : "(未找到)"}`);
}

// 2. 直方图分析：看帧时间分布
console.log("\n  帧时间直方图（关键区间）：");
const hist = /HISTOGRAM:\s*(.+)/.exec(gfx)?.[1] || "";
const buckets = [...hist.matchAll(/(\d+)ms=(\d+)/g)].map((m) => ({ ms: Number(m[1]), n: Number(m[2]) }));
const total = buckets.reduce((a, b) => a + b.n, 0);
const over16 = buckets.filter((b) => b.ms > 16).reduce((a, b) => a + b.n, 0);
const over32 = buckets.filter((b) => b.ms > 32).reduce((a, b) => a + b.n, 0);
const over100 = buckets.filter((b) => b.ms > 100).reduce((a, b) => a + b.n, 0);
console.log(`    总帧:        ${total}`);
console.log(`    >16ms:       ${over16} (${((over16 / total) * 100).toFixed(1)}%)`);
console.log(`    >32ms:       ${over32} (${((over32 / total) * 100).toFixed(1)}%)`);
console.log(`    >100ms:      ${over100} (${((over100 / total) * 100).toFixed(1)}%)`);

// 显示非零的慢帧
const slow = buckets.filter((b) => b.ms > 16 && b.n > 0);
if (slow.length) {
  console.log(`\n    慢帧分布（>16ms，非零项）：`);
  for (const b of slow.slice(0, 15)) console.log(`      ${String(b.ms).padStart(4)}ms: ${b.n} 帧`);
}

// 3. 内存与 GC
console.log("\n  内存状态：");
const mem = sh(`dumpsys meminfo ${PKG}`);
for (const key of ["TOTAL PSS", "TOTAL RSS", "Java Heap", "Native Heap", "Graphics"]) {
  const m = new RegExp(`${key}:?\\s*(\\d+)`).exec(mem);
  if (m) console.log(`    ${key.padEnd(14)} ${(Number(m[1]) / 1024).toFixed(1)} MB`);
}

// 4. 结论
console.log("\n  === 分析 ===");
const missedVsync = Number(/Number Missed Vsync:\s*(\d+)/.exec(gfx)?.[1] || 0);
const highInput = Number(/Number High input latency:\s*(\d+)/.exec(gfx)?.[1] || 0);
const slowUi = Number(/Number Slow UI thread:\s*(\d+)/.exec(gfx)?.[1] || 0);
const slowBitmap = Number(/Number Slow bitmap uploads:\s*(\d+)/.exec(gfx)?.[1] || 0);
const slowDraw = Number(/Number Slow issue draw commands:\s*(\d+)/.exec(gfx)?.[1] || 0);
const deadline = Number(/Number Frame deadline missed:\s*(\d+)/.exec(gfx)?.[1] || 0);

console.log(`  SlowBitmap=${slowBitmap}  SlowDraw=${slowDraw}  →  P4 问题 B/C ${slowBitmap === 0 && slowDraw === 0 ? "未造成瓶颈" : "有影响"}`);
console.log(`  SlowUI=${slowUi}  MissedVsync=${missedVsync}  HighInputLatency=${highInput}  DeadlineMissed=${deadline}`);
console.log("");
if (slowBitmap === 0 && slowDraw === 0 && slowUi === 0) {
  console.log("  → 所有「Slow xxx」计数器均为 0，但 Janky 仍较高。");
  console.log("     说明 Janky 来自帧时间超过 16ms 的「正常但偏慢」的帧，");
  console.log("     而非某个明确的慢操作。");
  console.log("     可能原因：滚动本身的计算量（布局/测量）+ 60fps 目标下的余量不足。");
} else {
  console.log("  → 存在明确的慢操作，见上述计数器。");
}
