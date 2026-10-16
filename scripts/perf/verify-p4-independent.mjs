// P4 独立复测：验证修复后的实际渲染表现
// 目的：不采信 agent 报告，独立测量
import { execSync } from "node:child_process";

const adb = process.env.LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe";
const env = { ...process.env, ANDROID_ADB_SERVER_PORT: "15037" };
const DEVICE = process.argv[2] || "127.0.0.1:16416";
const PKG = "com.hongguotv.tv";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, t = 40000) => {
  try { return execSync(`"${adb}" -s ${DEVICE} shell ${cmd}`, { encoding: "utf8", env, timeout: t, stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch { return ""; }
};

console.log(`=== P4 独立复测 (${DEVICE}) ===\n`);

const pid = sh(`pidof ${PKG}`);
console.log(`  应用 PID: ${pid || "未运行"}`);
if (!pid) { console.log("  ✗ 应用未运行"); process.exit(1); }

// 1. 确认在分类页
sh(`am force-stop ${PKG}`);
await sleep(2000);
sh(`am start -n ${PKG}/.MainActivity --es route category`);
await sleep(25000);

sh("uiautomator dump /sdcard/v.xml");
const xml = sh("cat /sdcard/v.xml");
const inCategory = xml.includes("类型") || xml.includes("题材");
console.log(`  当前页面: ${inCategory ? "分类页 ✓" : "非分类页 ⚠"}`);

// 2. 多次采样滚动
console.log("\n  --- 滚动采样（5 次，每次 30 次滚动）---");
const samples = [];
for (let t = 1; t <= 5; t += 1) {
  sh(`dumpsys gfxinfo ${PKG} reset`);
  await sleep(400);
  for (let i = 0; i < 30; i += 1) { sh("input keyevent 20"); await sleep(70); }
  await sleep(2000);

  const gfx = sh(`dumpsys gfxinfo ${PKG}`);
  const total = Number(/Total frames rendered:\s*(\d+)/.exec(gfx)?.[1] || 0);
  const jm = /Janky frames \(legacy\):\s*(\d+)\s*\(([\d.]+)%\)/.exec(gfx);
  const p90 = Number(/90th percentile:\s*(\d+)ms/.exec(gfx)?.[1] || 0);
  const p99 = Number(/99th percentile:\s*(\d+)ms/.exec(gfx)?.[1] || 0);
  const sb = Number(/Number Slow bitmap uploads:\s*(\d+)/.exec(gfx)?.[1] || 0);
  const sd = Number(/Number Slow issue draw commands:\s*(\d+)/.exec(gfx)?.[1] || 0);
  const su = Number(/Number Slow UI thread:\s*(\d+)/.exec(gfx)?.[1] || 0);
  samples.push({ t, total, pct: jm ? Number(jm[2]) : -1, p90, p99, sb, sd, su });
  console.log(`    ${t}: ${String(total).padStart(4)} 帧  Janky ${String(jm?.[2] ?? "?").padStart(5)}%  p90=${p90} p99=${p99}  SlowBitmap=${sb} SlowDraw=${sd} SlowUI=${su}`);
}

// 3. 统计
const pcts = samples.map((s) => s.pct).filter((p) => p >= 0);
const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
console.log("\n  --- 统计 ---");
console.log(`  Janky% 平均=${avg.toFixed(2)}%  范围=${Math.min(...pcts)}–${Math.max(...pcts)}%`);
const allSlowZero = samples.every((s) => s.sb === 0 && s.sd === 0 && s.su === 0);
console.log(`  SlowBitmap/SlowDraw/SlowUI ${allSlowZero ? "全部为 0 ✓" : "有非零值 ⚠"}`);

// 4. 内存
console.log("\n  --- 内存 ---");
const mem = sh(`dumpsys meminfo ${PKG}`);
const pss = Number(/TOTAL PSS:\s*(\d+)/.exec(mem)?.[1] || 0);
console.log(`  TOTAL PSS: ${(pss / 1024).toFixed(1)} MB`);

// 5. 判定
console.log("\n  === 判定 ===");
console.log(`  Janky ${avg.toFixed(2)}%  →  ${avg < 5 ? "✓ 流畅" : avg < 15 ? "⚠ 可接受" : "✗ 卡顿"}`);
console.log("");
console.log("  对照（P4 报告声称的分类页前后中位数）:");
console.log("    Janky%: 2.04 -> 1.92");
console.log("    P90:    10 -> 12 ms");
console.log("    P99:    18 -> 20 ms");
console.log("  → codex 明确说明「不足以声称整体帧率显著提升」，与我的判断一致");
