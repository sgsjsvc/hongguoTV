// TV 渲染性能对比测量：三台设备 + 切集场景
import { execSync } from "node:child_process";

const adb = process.env.LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe";
const env = { ...process.env, ANDROID_ADB_SERVER_PORT: "15037" };
const PKG = "com.hongguotv.tv";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sh = (device, cmd, timeout = 30000) => {
  try {
    return execSync(`"${adb}" -s ${device} shell ${cmd}`, {
      encoding: "utf8", env, timeout, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    return "ERR:" + String(e.message).slice(0, 50);
  }
};

const parseGfx = (gfx) => ({
  total: Number(/Total frames rendered:\s*(\d+)/.exec(gfx)?.[1] || 0),
  jankyLegacy: Number(/Janky frames \(legacy\):\s*(\d+)/.exec(gfx)?.[1] || 0),
  jankyLegacyPct: Number(/Janky frames \(legacy\):\s*\d+\s*\(([\d.]+)%\)/.exec(gfx)?.[1] || 0),
  p50: Number(/50th percentile:\s*(\d+)ms/.exec(gfx)?.[1] || 0),
  p90: Number(/90th percentile:\s*(\d+)ms/.exec(gfx)?.[1] || 0),
  p99: Number(/99th percentile:\s*(\d+)ms/.exec(gfx)?.[1] || 0),
  missedVsync: Number(/Number Missed Vsync:\s*(\d+)/.exec(gfx)?.[1] || 0),
  slowUi: Number(/Number Slow UI thread:\s*(\d+)/.exec(gfx)?.[1] || 0),
  slowBitmap: Number(/Number Slow bitmap uploads:\s*(\d+)/.exec(gfx)?.[1] || 0),
  slowDraw: Number(/Number Slow issue draw commands:\s*(\d+)/.exec(gfx)?.[1] || 0),
});

const devices = [
  ["D1 (720p/API32)", "127.0.0.1:16384"],
  ["D2 (1080p/API35)", "127.0.0.1:16416"],
  ["D3 (1080p/API32)", "127.0.0.1:16448"],
];

console.log("=== TV 渲染性能对比（三设备）===\n");

const results = [];

for (const [label, dev] of devices) {
  const pid = sh(dev, `pidof ${PKG}`);
  if (!pid || pid.startsWith("ERR")) {
    console.log(`  ${label}: 应用未运行，跳过`);
    continue;
  }
  const model = sh(dev, "getprop ro.product.model");
  const sdk = sh(dev, "getprop ro.build.version.sdk");

  // 重置
  sh(dev, `dumpsys gfxinfo ${PKG} reset`);
  await sleep(500);

  // 滚动 15 次
  for (let i = 0; i < 15; i += 1) {
    sh(dev, "input keyevent 20");
    await sleep(100);
  }
  await sleep(2000);

  const gfx = sh(dev, `dumpsys gfxinfo ${PKG}`, 40000);
  const m = parseGfx(gfx);

  // 内存
  const mem = sh(dev, `dumpsys meminfo ${PKG}`);
  const pss = Number(/TOTAL PSS:\s*(\d+)/.exec(mem)?.[1] || 0);

  results.push({ label, model, sdk, ...m, pssMb: pss / 1024 });

  console.log(`  ${label}  model=${model} API${sdk}`);
  console.log(`    总帧=${m.total}  Janky(legacy)=${m.jankyLegacy} (${m.jankyLegacyPct}%)`);
  console.log(`    p50=${m.p50}ms  p90=${m.p90}ms  p99=${m.p99}ms`);
  console.log(`    MissedVsync=${m.missedVsync}  SlowUI=${m.slowUi}  SlowBitmap=${m.slowBitmap}  SlowDraw=${m.slowDraw}`);
  console.log(`    内存=${(pss / 1024).toFixed(1)} MB`);
  console.log("");
}

console.log("  === 汇总判定 ===");
console.log("  设备                  Janky%   p99    SlowBitmap  SlowDraw  内存");
for (const r of results) {
  const verdict = r.jankyLegacyPct < 5 ? "流畅" : r.jankyLegacyPct < 15 ? "可接受" : "卡顿";
  console.log(
    `  ${r.label.padEnd(20)} ${String(r.jankyLegacyPct).padStart(5)}%  ${String(r.p99).padStart(3)}ms  ` +
      `${String(r.slowBitmap).padStart(9)}  ${String(r.slowDraw).padStart(7)}  ${r.pssMb.toFixed(0).padStart(4)}MB  ${verdict}`
  );
}

console.log("\n  === 关键观察 ===");
const anySlowBitmap = results.some((r) => r.slowBitmap > 0);
const anySlowDraw = results.some((r) => r.slowDraw > 0);
console.log(`  Slow bitmap uploads > 0: ${anySlowBitmap ? "⚠ 是（P4 问题 B 相关）" : "✓ 否"}`);
console.log(`  Slow issue draw commands > 0: ${anySlowDraw ? "⚠ 是（P4 问题 C 相关）" : "✓ 否"}`);
console.log("");
console.log("  说明：若 Slow bitmap/draw 均为 0，则 P4 的问题 B/C 在当前设备上");
console.log("        未造成可测量的卡顿（但快速滚动时仍可能出现，需更大样本）。");
