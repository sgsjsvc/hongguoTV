// 测量 TV 端渲染性能：滚动流畅度、切集耗时
// 这是基线中缺失的一环（先前设备离线，只有代码审查）
import { execSync } from "node:child_process";

const adb = process.env.LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe";
const env = { ...process.env, ANDROID_ADB_SERVER_PORT: "15037" };
const DEVICE = process.argv[2] || "127.0.0.1:16384";
const PKG = "com.hongguotv.tv";

const sh = (cmd, timeout = 30000) => {
  try {
    return execSync(`"${adb}" -s ${DEVICE} shell ${cmd}`, {
      encoding: "utf8", env, timeout, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    return "ERR:" + String(e.message).slice(0, 60);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`=== TV 渲染性能测量 (${DEVICE}) ===\n`);

// 1. 设备信息
const model = sh("getprop ro.product.model");
const sdk = sh("getprop ro.build.version.sdk");
console.log(`  设备: ${model}  API ${sdk}`);

// 2. 应用状态
const pid = sh(`pidof ${PKG}`);
console.log(`  应用 PID: ${pid || "未运行"}`);
if (!pid || pid.startsWith("ERR")) {
  console.log("  ✗ 应用未运行，无法测量");
  process.exit(1);
}

// 3. 重置 gfxinfo 统计
console.log("\n  --- 1. 重置 gfxinfo ---");
const resetOut = sh(`dumpsys gfxinfo ${PKG} reset`);
console.log(`    ${resetOut.startsWith("ERR") ? "重置失败" : "✓ 已重置"}`);

// 4. 滚动操作（模拟用户浏览分类页）
console.log("\n  --- 2. 执行滚动（20 次 DOWN）---");
const t0 = Date.now();
for (let i = 0; i < 20; i += 1) {
  sh("input keyevent 20");
  await sleep(120);
}
const scrollMs = Date.now() - t0;
console.log(`    ${scrollMs} ms（20 次滚动）`);

// 5. 等待渲染稳定
await sleep(2000);

// 6. 读取 gfxinfo
console.log("\n  --- 3. gfxinfo 统计 ---");
const gfx = sh(`dumpsys gfxinfo ${PKG}`);

// 解析关键指标
const totalFrames = /Total frames rendered:\s*(\d+)/.exec(gfx)?.[1];
const jankyFrames = /Janky frames:\s*(\d+)/.exec(gfx)?.[1];
const jankyPercent = /Janky frames \(legacy\):\s*\d+\s*\(([\d.]+)%\)/.exec(gfx)?.[1];
const p50 = /50th percentile:\s*(\d+)ms/.exec(gfx)?.[1];
const p90 = /90th percentile:\s*(\d+)ms/.exec(gfx)?.[1];
const p95 = /95th percentile:\s*(\d+)ms/.exec(gfx)?.[1];
const p99 = /99th percentile:\s*(\d+)ms/.exec(gfx)?.[1];
const missedVsync = /Number Missed Vsync:\s*(\d+)/.exec(gfx)?.[1];
const slowUi = /Number Slow UI thread:\s*(\d+)/.exec(gfx)?.[1];
const slowBitmap = /Number Slow bitmap uploads:\s*(\d+)/.exec(gfx)?.[1];
const slowDraw = /Number Slow issue draw commands:\s*(\d+)/.exec(gfx)?.[1];

if (totalFrames) {
  console.log(`    总帧数:          ${totalFrames}`);
  console.log(`    Janky frames:    ${jankyFrames ?? "?"} (${jankyPercent ?? "?"}%)`);
  console.log(`    50th percentile: ${p50 ?? "?"} ms`);
  console.log(`    90th percentile: ${p90 ?? "?"} ms`);
  console.log(`    95th percentile: ${p95 ?? "?"} ms`);
  console.log(`    99th percentile: ${p99 ?? "?"} ms`);
  console.log(`    Missed Vsync:    ${missedVsync ?? "?"}`);
  console.log(`    Slow UI thread:  ${slowUi ?? "?"}`);
  console.log(`    Slow bitmap:     ${slowBitmap ?? "?"}`);
  console.log(`    Slow draw:       ${slowDraw ?? "?"}`);
} else {
  console.log("    ⚠ 未能解析 gfxinfo（可能设备不支持）");
  console.log("    原始输出片段:");
  console.log(gfx.slice(0, 600).split("\n").map((l) => "      " + l).join("\n"));
}

// 7. 内存
console.log("\n  --- 4. 内存 ---");
const mem = sh(`dumpsys meminfo ${PKG}`);
const totalPss = /TOTAL PSS:\s*(\d+)/.exec(mem)?.[1] || /TOTAL\s+(\d+)/.exec(mem)?.[1];
const totalHeap = /TOTAL:\s*(\d+)/.exec(mem)?.[1];
console.log(`    TOTAL PSS: ${totalPss ? (Number(totalPss) / 1024).toFixed(1) + " MB" : "?"}`);

console.log("\n  === 判定标准 ===");
console.log("    Janky < 5%   -> 流畅");
console.log("    Janky 5-15%  -> 可接受但有优化空间");
console.log("    Janky > 15%  -> 明显卡顿");
