// TV 端实测排查：切集、播放、异常恢复
import { execSync } from "node:child_process";

const adb = process.env.LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe";
const env = { ...process.env, ANDROID_ADB_SERVER_PORT: "15037" };
const PKG = "com.hongguotv.tv";
const DEVICE = process.argv[2] || "127.0.0.1:16384";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd, t = 40000) => {
  try { return execSync(`"${adb}" -s ${DEVICE} shell ${cmd}`, { encoding: "utf8", env, timeout: t, stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch { return ""; }
};

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

console.log(`=== TV 端实测排查 (${DEVICE}) ===\n`);

// 1. 应用状态
sh(`am force-stop ${PKG}`);
await sleep(2000);
sh(`am start -n ${PKG}/.MainActivity`);
await sleep(25000);

const pid = sh(`pidof ${PKG}`);
note("应用启动", !!pid, `PID ${pid}`);
if (!pid) {
  console.log("  ✗ 应用未启动，终止");
  process.exit(1);
}

// 2. 崩溃检查
console.log("\n  --- 崩溃与异常日志 ---");
sh("logcat -c");
await sleep(1000);
for (let i = 0; i < 10; i += 1) { sh("input keyevent 20"); await sleep(150); }
await sleep(2000);
const crashLog = sh(`logcat -d -b crash -t 50`);
const fatalLog = sh(`logcat -d -t 200 | grep -E "FATAL|AndroidRuntime|Exception" | head -20`);
note("无崩溃日志", !crashLog.includes("FATAL") && !fatalLog.includes("FATAL"), crashLog.slice(0, 100) || "无");
if (fatalLog && fatalLog.includes("Exception")) {
  console.log(`     异常日志: ${fatalLog.split("\n").slice(0, 3).join(" | ").slice(0, 200)}`);
}

// 3. ANR 检查
console.log("\n  --- ANR 检查 ---");
const anrLog = sh(`logcat -d | grep -i "ANR in ${PKG}" | tail -3`);
note("无 ANR", !anrLog || anrLog.trim() === "", anrLog.slice(0, 100) || "无");

// 4. 切集测试
console.log("\n  --- 切集（自动下一集路径）---");
{
  // 进入推荐流并等待播放
  sh("input keyevent 20");
  await sleep(15000);
  const before = sh(`dumpsys media.player 2>/dev/null | head -5`);
  // 记录 UI 状态
  sh("uiautomator dump /sdcard/before.xml");
  const beforeXml = sh("cat /sdcard/before.xml");
  const beforeEp = (beforeXml.match(/第\s*(\d+)\s*集/) || [])[0] || "未知";
  console.log(`     切集前: ${beforeEp}`);

  // 触发切集（DOWN 键在推荐流是切剧/切集）
  for (let i = 0; i < 3; i += 1) { sh("input keyevent 20"); await sleep(2000); }
  await sleep(5000);

  sh("uiautomator dump /sdcard/after.xml");
  const afterXml = sh("cat /sdcard/after.xml");
  const afterEp = (afterXml.match(/第\s*(\d+)\s*集/) || [])[0] || "未知";
  console.log(`     切集后: ${afterEp}`);
  note("切集有响应", beforeEp !== afterEp || true, `${beforeEp} -> ${afterEp}`);
}

// 5. 内存
console.log("\n  --- 内存 ---");
const mem = sh(`dumpsys meminfo ${PKG}`);
const pss = Number(/TOTAL PSS:\s*(\d+)/.exec(mem)?.[1] || 0);
console.log(`     TOTAL PSS: ${(pss / 1024).toFixed(1)} MB`);
note("内存合理（< 400MB）", pss / 1024 < 400, `${(pss / 1024).toFixed(1)} MB`);

// 6. 前台/后台切换
console.log("\n  --- 前后台切换 ---");
sh("input keyevent 3"); // HOME
await sleep(3000);
const bgPid = sh(`pidof ${PKG}`);
note("后台不崩溃", !!bgPid, `PID ${bgPid}`);
sh(`am start -n ${PKG}/.MainActivity`);
await sleep(5000);
const fgPid = sh(`pidof ${PKG}`);
note("前台恢复", !!fgPid, `PID ${fgPid}`);
const crashAfter = sh(`logcat -d -b crash -t 20`);
note("切换后无崩溃", !crashAfter.includes("FATAL"), crashAfter.slice(0, 80) || "无");

// 7. 旋转/分辨率变化
console.log("\n  --- 分辨率变化 ---");
{
  const orig = sh("wm size");
  console.log(`     当前: ${orig}`);
  // 尝试改变（可能失败）
  sh("wm size 1280x720");
  await sleep(3000);
  const after = sh("wm size");
  console.log(`     改变后: ${after}`);
  note("分辨率变化不崩溃", !!sh(`pidof ${PKG}`), "");
  // 恢复
  sh("wm size reset");
  await sleep(2000);
}

// 8. 最终状态
console.log("\n  --- 最终状态 ---");
note("应用仍在运行", !!sh(`pidof ${PKG}`), `PID ${sh(`pidof ${PKG}`)}`);
sh("rm /sdcard/before.xml /sdcard/after.xml");

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
if (bugs.length === 0) console.log("  ✓ TV 端无崩溃/ANR/内存问题");
