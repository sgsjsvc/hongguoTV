// 抓取 TV 滚动中的截图，用于人工检查图片错位
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const adb = process.env.LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe";
const env = { ...process.env, ANDROID_ADB_SERVER_PORT: "15037" };
const DEVICE = process.argv[2] || "127.0.0.1:16384";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sh = (cmd) => {
  try {
    return execSync(`"${adb}" -s ${DEVICE} shell ${cmd}`, { encoding: "utf8", env, stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch { return ""; }
};
const pull = (remote, local) => {
  try {
    execSync(`"${adb}" -s ${DEVICE} pull ${remote} ${local}`, { encoding: "utf8", env, stdio: ["pipe", "pipe", "pipe"] });
    return fs.existsSync(local);
  } catch { return false; }
};

const outDir = path.join("outputs", "debug");
fs.mkdirSync(outDir, { recursive: true });

console.log(`=== 抓取 TV 滚动截图 (${DEVICE}) ===\n`);

// 回到顶部
for (let i = 0; i < 30; i += 1) { sh("input keyevent 19"); await sleep(30); }
await sleep(1500);

// 抓取不同滚动位置的截图
const positions = [0, 5, 10, 20, 35];
for (const pos of positions) {
  // 滚动到目标位置
  const current = positions[positions.indexOf(pos) - 1] || 0;
  const steps = pos - current;
  for (let i = 0; i < steps; i += 1) { sh("input keyevent 20"); await sleep(80); }
  await sleep(1200);

  sh("screencap -p /sdcard/scroll.png");
  const local = path.join(outDir, `tv-scroll-${String(pos).padStart(2, "0")}.png`);
  if (pull("/sdcard/scroll.png", local)) {
    const buf = fs.readFileSync(local);
    const valid = buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
    console.log(`  位置 ${String(pos).padStart(2)}: ${(buf.length / 1024).toFixed(0)} KB  ${valid ? "✓" : "✗"}  ${local}`);
  }
}
sh("rm /sdcard/scroll.png");
console.log("\n  完成。截图可用于人工检查是否有图片错位。");
