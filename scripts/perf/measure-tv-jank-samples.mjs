// 多次采样：分类页滚动的 Janky 率是否稳定？
// 目的：确认 11.98% 是真实瓶颈还是测量噪声
import { execSync } from "node:child_process";

const adb = process.env.LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe";
const env = { ...process.env, ANDROID_ADB_SERVER_PORT: "15037" };
const DEVICE = process.argv[2] || "127.0.0.1:16384";
const PKG = "com.hongguotv.tv";
const TRIALS = Number(process.argv[3] || 5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, t = 40000) => {
  try { return execSync(`"${adb}" -s ${DEVICE} shell ${cmd}`, { encoding: "utf8", env, timeout: t, stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch { return ""; }
};

console.log(`=== 分类页滚动多次采样 (${DEVICE}, ${TRIALS} 次) ===\n`);
console.log("  试验  总帧  Janky%  p50  p99  >16ms  SlowBitmap  SlowDraw  SlowUI");
console.log("  " + "-".repeat(76));

const samples = [];

for (let t = 1; t <= TRIALS; t += 1) {
  sh(`dumpsys gfxinfo ${PKG} reset`);
  await sleep(400);

  // 滚动：每次从当前位置继续
  for (let i = 0; i < 30; i += 1) {
    sh("input keyevent 20");
    await sleep(70);
  }
  await sleep(2000);

  const gfx = sh(`dumpsys gfxinfo ${PKG}`);
  const total = Number(/Total frames rendered:\s*(\d+)/.exec(gfx)?.[1] || 0);
  const jm = /Janky frames \(legacy\):\s*(\d+)\s*\(([\d.]+)%\)/.exec(gfx);
  const p50 = Number(/50th percentile:\s*(\d+)ms/.exec(gfx)?.[1] || 0);
  const p99 = Number(/99th percentile:\s*(\d+)ms/.exec(gfx)?.[1] || 0);
  const slowBitmap = Number(/Number Slow bitmap uploads:\s*(\d+)/.exec(gfx)?.[1] || 0);
  const slowDraw = Number(/Number Slow issue draw commands:\s*(\d+)/.exec(gfx)?.[1] || 0);
  const slowUi = Number(/Number Slow UI thread:\s*(\d+)/.exec(gfx)?.[1] || 0);

  // 直方图 >16ms
  const hist = /HISTOGRAM:\s*(.+)/.exec(gfx)?.[1] || "";
  const buckets = [...hist.matchAll(/(\d+)ms=(\d+)/g)].map((m) => ({ ms: Number(m[1]), n: Number(m[2]) }));
  const over16 = buckets.filter((b) => b.ms > 16).reduce((a, b) => a + b.n, 0);

  const jankyPct = jm ? Number(jm[2]) : -1;
  samples.push({ t, total, jankyPct, p50, p99, over16, slowBitmap, slowDraw, slowUi });

  console.log(
    `  ${String(t).padStart(4)}  ${String(total).padStart(4)}  ${String(jankyPct).padStart(5)}%  ` +
      `${String(p50).padStart(3)}  ${String(p99).padStart(3)}  ${String(over16).padStart(5)}  ` +
      `${String(slowBitmap).padStart(10)}  ${String(slowDraw).padStart(8)}  ${String(slowUi).padStart(6)}`
  );
}

console.log("\n  === 统计 ===");
const pcts = samples.map((s) => s.jankyPct).filter((p) => p >= 0);
const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
const min = Math.min(...pcts);
const max = Math.max(...pcts);
console.log(`  Janky% 平均=${avg.toFixed(2)}%  最小=${min}%  最大=${max}%`);
console.log(`  波动范围: ${(max - min).toFixed(2)} 个百分点`);

console.log("\n  === 判定 ===");
if (max - min > 5) {
  console.log("  ⚠ 采样波动大（>5 个百分点）");
  console.log("     → 11.98% 可能是噪声，或与滚动位置/内容有关");
  console.log("     → 需要更严格的测量方法（固定滚动路径、预热、排除首帧）");
} else {
  console.log(`  ✓ 采样稳定，Janky 约 ${avg.toFixed(1)}%`);
}

const allSlowZero = samples.every((s) => s.slowBitmap === 0 && s.slowDraw === 0 && s.slowUi === 0);
console.log(`  ${allSlowZero ? "✓" : "⚠"} SlowBitmap/SlowDraw/SlowUI ${allSlowZero ? "全部为 0（P4 问题 B/C 未造成瓶颈）" : "有非零值"}`);
