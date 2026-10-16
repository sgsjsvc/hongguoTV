// 导航到分类页并测试卡片列表滚动性能
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const adb = process.env.LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe";
const env = { ...process.env, ANDROID_ADB_SERVER_PORT: "15037" };
const DEVICE = process.argv[2] || "127.0.0.1:16384";
const PKG = "com.hongguotv.tv";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sh = (cmd, timeout = 30000) => {
  try {
    return execSync(`"${adb}" -s ${DEVICE} shell ${cmd}`, { encoding: "utf8", env, timeout, stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch { return ""; }
};
const pull = (r, l) => {
  try { execSync(`"${adb}" -s ${DEVICE} pull ${r} ${l}`, { encoding: "utf8", env, stdio: ["pipe", "pipe", "pipe"] }); return fs.existsSync(l); }
  catch { return false; }
};

const outDir = path.join("outputs", "debug");
fs.mkdirSync(outDir, { recursive: true });

console.log(`=== 分类页滚动性能测试 (${DEVICE}) ===\n`);

// 1. 重启应用并用 route 参数直接进分类页（Q5 加的深层链接）
console.log("  1. 启动到分类页");
sh(`am force-stop ${PKG}`);
await sleep(2000);
sh(`am start -n ${PKG}/.MainActivity --es route category`);
await sleep(25000);

// 2. 确认当前页面
sh("uiautomator dump /sdcard/nav.xml");
const navLocal = path.join(outDir, "tv-nav.xml");
if (pull("/sdcard/nav.xml", navLocal)) {
  const xml = fs.readFileSync(navLocal, "utf8");
  const hasCategory = xml.includes("类型") || xml.includes("题材");
  const hasFeed = xml.includes("滚轮") || xml.includes("切剧");
  console.log(`     含「类型/题材」（分类页）: ${hasCategory ? "✓" : "✗"}`);
  console.log(`     含「滚轮/切剧」（推荐流）: ${hasFeed ? "✓" : "✗"}`);
  console.log(`     → 当前在: ${hasCategory ? "分类页" : hasFeed ? "推荐流" : "未知"}`);
}

// 3. 重置统计
sh(`dumpsys gfxinfo ${PKG} reset`);
await sleep(500);

// 4. 滚动卡片列表（分类页的 DOWN 会滚卡片）
console.log("\n  2. 滚动 40 次");
for (let i = 0; i < 40; i += 1) {
  sh("input keyevent 20");
  await sleep(80);
}
await sleep(2500);

// 5. 读取统计
const gfx = sh(`dumpsys gfxinfo ${PKG}`, 40000);
const total = /Total frames rendered:\s*(\d+)/.exec(gfx)?.[1];
const janky = /Janky frames \(legacy\):\s*(\d+)\s*\(([\d.]+)%\)/.exec(gfx);
const p50 = /50th percentile:\s*(\d+)ms/.exec(gfx)?.[1];
const p99 = /99th percentile:\s*(\d+)ms/.exec(gfx)?.[1];
const slowBitmap = /Number Slow bitmap uploads:\s*(\d+)/.exec(gfx)?.[1];
const slowDraw = /Number Slow issue draw commands:\s*(\d+)/.exec(gfx)?.[1];
const slowUi = /Number Slow UI thread:\s*(\d+)/.exec(gfx)?.[1];

console.log(`\n  3. 结果`);
console.log(`     总帧:          ${total}`);
console.log(`     Janky(legacy): ${janky ? `${janky[1]} (${janky[2]}%)` : "?"}`);
console.log(`     p50 / p99:     ${p50} / ${p99} ms`);
console.log(`     SlowUI:        ${slowUi}`);
console.log(`     SlowBitmap:    ${slowBitmap}   ← P4 问题 B 相关`);
console.log(`     SlowDraw:      ${slowDraw}   ← P4 问题 C 相关`);

// 6. 截图
console.log("\n  4. 截图");
for (let i = 0; i < 2; i += 1) {
  sh("screencap -p /sdcard/cat.png");
  const local = path.join(outDir, `tv-category-${i}.png`);
  if (pull("/sdcard/cat.png", local)) {
    const buf = fs.readFileSync(local);
    console.log(`     截图${i + 1}: ${(buf.length / 1024).toFixed(0)} KB  ${local}`);
  }
  for (let k = 0; k < 8; k += 1) { sh("input keyevent 20"); await sleep(70); }
  await sleep(1000);
}
sh("rm /sdcard/cat.png /sdcard/nav.xml");

// 7. 判定
console.log("\n  === 判定 ===");
const pct = janky ? Number(janky[2]) : -1;
console.log(`  Janky ${pct}%  →  ${pct < 5 ? "✓ 流畅" : pct < 15 ? "⚠ 可接受" : "✗ 卡顿"}`);
console.log(`  SlowBitmap=${slowBitmap} SlowDraw=${slowDraw} SlowUI=${slowUi}`);
