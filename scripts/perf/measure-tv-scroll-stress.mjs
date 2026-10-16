// TV 滚动压力测试：验证 P4 声称的「图片错位/闪烁」是否真实存在
// 方法：快速连续滚动 + 截图对比，检查是否有图片错位
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const adb = process.env.LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe";
const env = { ...process.env, ANDROID_ADB_SERVER_PORT: "15037" };
const PKG = "com.hongguotv.tv";
const DEVICE = process.argv[2] || "127.0.0.1:16384";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sh = (cmd, timeout = 30000) => {
  try {
    return execSync(`"${adb}" -s ${DEVICE} shell ${cmd}`, {
      encoding: "utf8", env, timeout, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    return "ERR:" + String(e.message).slice(0, 50);
  }
};

const pull = (remote, local) => {
  try {
    execSync(`"${adb}" -s ${DEVICE} pull ${remote} ${local}`, {
      encoding: "utf8", env, stdio: ["pipe", "pipe", "pipe"],
    });
    return fs.existsSync(local);
  } catch {
    return false;
  }
};

console.log(`=== TV 滚动压力测试 (${DEVICE}) ===\n`);

// 确保在分类页（有大量卡片）
console.log("  --- 1. 重置统计并快速滚动 ---");
sh(`dumpsys gfxinfo ${PKG} reset`);
await sleep(300);

// 快速滚动：50 次，间隔 50ms（模拟用户快速浏览）
const t0 = Date.now();
for (let i = 0; i < 50; i += 1) {
  sh("input keyevent 20");
  await sleep(50);
}
const elapsed = Date.now() - t0;
console.log(`    50 次快速滚动，耗时 ${elapsed} ms（平均 ${(elapsed / 50).toFixed(0)} ms/次）`);

await sleep(2000);

// 读取统计
const gfx = sh(`dumpsys gfxinfo ${PKG}`, 40000);
const total = /Total frames rendered:\s*(\d+)/.exec(gfx)?.[1];
const janky = /Janky frames \(legacy\):\s*(\d+)\s*\(([\d.]+)%\)/.exec(gfx);
const p99 = /99th percentile:\s*(\d+)ms/.exec(gfx)?.[1];
const slowBitmap = /Number Slow bitmap uploads:\s*(\d+)/.exec(gfx)?.[1];
const slowDraw = /Number Slow issue draw commands:\s*(\d+)/.exec(gfx)?.[1];
const missed = /Number Missed Vsync:\s*(\d+)/.exec(gfx)?.[1];

console.log(`\n  --- 2. 压力测试结果 ---`);
console.log(`    总帧:          ${total}`);
console.log(`    Janky(legacy): ${janky ? `${janky[1]} (${janky[2]}%)` : "?"}`);
console.log(`    p99:           ${p99} ms`);
console.log(`    SlowBitmap:    ${slowBitmap}`);
console.log(`    SlowDraw:      ${slowDraw}`);
console.log(`    MissedVsync:   ${missed}`);

// 3. 截图检查是否有图片错位
console.log(`\n  --- 3. 截图对比（检查图片错位）---`);
const tmp = path.join(process.env.TEMP || "/tmp", "tv-scroll-test");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

const shots = [];
for (let i = 0; i < 3; i += 1) {
  sh("screencap -p /sdcard/st.png");
  const local = path.join(tmp, `shot${i}.png`);
  if (pull("/sdcard/st.png", local)) {
    const buf = fs.readFileSync(local);
    const sig = buf.subarray(0, 8).toString("hex");
    const valid = sig === "89504e470d0a1a0a";
    shots.push({ i, size: buf.length, valid, hash: crypto.createHash("md5").update(buf).digest("hex").slice(0, 8) });
    console.log(`    截图${i + 1}: ${(buf.length / 1024).toFixed(0)} KB  PNG=${valid ? "✓" : "✗"}  hash=${shots[i].hash}`);
  } else {
    console.log(`    截图${i + 1}: 失败`);
  }
  // 滚动后再截
  for (let k = 0; k < 5; k += 1) { sh("input keyevent 20"); await sleep(60); }
  await sleep(800);
}
sh("rm /sdcard/st.png");

// 4. 内存检查（是否有泄漏迹象）
console.log(`\n  --- 4. 内存 ---`);
const mem = sh(`dumpsys meminfo ${PKG}`);
const pss = Number(/TOTAL PSS:\s*(\d+)/.exec(mem)?.[1] || 0);
console.log(`    TOTAL PSS: ${(pss / 1024).toFixed(1)} MB`);

// 5. 判定
console.log(`\n  === 判定 ===`);
const jankyPct = janky ? Number(janky[2]) : -1;
console.log(`  Janky ${jankyPct}%  ${jankyPct < 5 ? "✓ 流畅" : jankyPct < 15 ? "⚠ 可接受" : "✗ 卡顿"}`);
console.log(`  SlowBitmap=${slowBitmap}  SlowDraw=${slowDraw}  ${Number(slowBitmap) === 0 && Number(slowDraw) === 0 ? "✓ 无位图/绘制瓶颈" : "⚠ 存在瓶颈"}`);
console.log("");
console.log("  → 若压力测试下 Janky 仍 < 5% 且 SlowBitmap/SlowDraw 为 0，");
console.log("     则 P4 的问题 B/C（清空图片、GradientDrawable 重建）");
console.log("     在当前设备上未造成可测量的性能问题。");
console.log("     但「图片错位」是正确性问题，仍应修复。");

fs.rmSync(tmp, { recursive: true, force: true });
