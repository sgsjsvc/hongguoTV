// 第九轮：剩余未排查模块
import fs from "node:fs";
import path from "node:path";

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

console.log("=== 第九轮：剩余模块 ===\n");

// 1. LocalContentService / StandaloneEngine（TV 本地内容）
console.log("  --- 1. TV LocalContentService ---");
{
  const p = "apps/tv-android/app/src/main/java/com/hongguotv/tv/LocalContentService.kt";
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, "utf8");
    console.log(`     行数: ${c.split("\n").length}`);
    // 检查 HTTP 服务的安全
    const bindsLocalhost = /127\.0\.0\.1|localhost|InetAddress\.getLoopbackAddress/.test(c);
    note("本地服务仅绑定回环地址", bindsLocalhost, bindsLocalhost ? "" : "⚠ 可能暴露到网络");
    const hasPort = /ServerSocket\((\d+)\)|port\s*=\s*(\d+)/.exec(c);
    console.log(`     端口: ${hasPort ? hasPort[0] : "动态"}`);
    const closesSocket = /\.close\(\)/.test(c);
    note("有关闭逻辑", closesSocket, "");
  }
}

// 2. TvRepository（数据层）
console.log("\n  --- 2. TvRepository ---");
{
  const p = "apps/tv-android/app/src/main/java/com/hongguotv/tv/TvRepository.kt";
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, "utf8");
    console.log(`     行数: ${c.split("\n").length}`);
    const hasCache = /cache|Cache/i.test(c);
    note("有缓存机制", hasCache, "");
    const hasTimeout = /timeout|Timeout/.test(c);
    note("有超时设置", hasTimeout, "");
    const hasRetry = /retry|重试/i.test(c);
    note("有重试逻辑", hasRetry, "");
    // 检查是否所有网络调用都有异常处理
    const calls = (c.match(/\.(get|post)\s*\(/g) || []).length;
    const catches = (c.match(/catch\s*\(/g) || []).length;
    console.log(`     网络调用: ${calls}, catch: ${catches}`);
  }
}

// 3. TvStore（持久化）
console.log("\n  --- 3. TvStore ---");
{
  const p = "apps/tv-android/app/src/main/java/com/hongguotv/tv/TvStore.kt";
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, "utf8");
    console.log(`     行数: ${c.split("\n").length}`);
    const hasRequire = /require\(/.test(c);
    note("有输入校验（require）", hasRequire, "");
    const hasTry = /try\s*\{/.test(c);
    note("有异常处理", hasTry, "");
    // 检查 JSON 解析
    const parsesJson = /JSONObject|JSONArray/.test(c);
    const guardsParse = /runCatching|try/.test(c);
    if (parsesJson) note("JSON 解析有保护", guardsParse, "");
  }
}

// 4. HistorySync（TV 同步）
console.log("\n  --- 4. TV HistorySync ---");
{
  const p = "apps/tv-android/app/src/main/java/com/hongguotv/tv/HistorySync.kt";
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, "utf8");
    console.log(`     行数: ${c.split("\n").length}`);
    const hasBackoff = /backoff/i.test(c);
    note("有退避逻辑", hasBackoff, "");
    const backoffMatch = /backoff\s*=\s*\(backoff\s*\*\s*2\)\.coerceAtMost\((\d+)\)/.exec(c);
    console.log(`     退避上限: ${backoffMatch ? backoffMatch[1] + "ms" : "?"}`);
    const hasForegroundCheck = /foreground/.test(c);
    note("有前台检查", hasForegroundCheck, "");
    const hasBang = /[a-zA-Z0-9_\)\]]!!/.test(c);
    if (hasBang) {
      const m = /[a-zA-Z0-9_\)\]]!!/.exec(c);
      const line = c.slice(0, m.index).split("\n").length;
      console.log(`     !! 位置: 行 ${line}: ${c.split("\n")[line - 1].trim().slice(0, 80)}`);
    }
  }
}

// 5. 前端其他 hooks
console.log("\n  --- 5. 前端 hooks 静态检查 ---");
{
  const dir = "apps/web-pc/src/hooks";
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".ts") || x.endsWith(".tsx"))) {
      const c = fs.readFileSync(path.join(dir, f), "utf8");
      const effects = (c.match(/useEffect\s*\(/g) || []).length;
      const cleanups = (c.match(/return\s*\(\s*\)\s*=>/g) || []).length;
      const timers = (c.match(/setInterval|setTimeout/g) || []).length;
      const listeners = (c.match(/addEventListener/g) || []).length;
      const removers = (c.match(/removeEventListener/g) || []).length;
      const flag = (timers > cleanups || listeners > removers) ? "  ⚠" : "";
      console.log(`     ${f.padEnd(24)} useEffect=${effects} cleanup=${cleanups} timer=${timers} listener=${listeners}/${removers}${flag}`);
      if (listeners > removers) {
        note(`${f} 的监听器成对移除`, false, `add=${listeners} remove=${removers}`);
      }
    }
  }
}

// 6. 前端组件的事件监听
console.log("\n  --- 6. 组件事件监听配对 ---");
{
  const dir = "apps/web-pc/src/components";
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
      const c = fs.readFileSync(path.join(dir, f), "utf8");
      const listeners = (c.match(/addEventListener/g) || []).length;
      const removers = (c.match(/removeEventListener/g) || []).length;
      if (listeners > 0) {
        const flag = listeners > removers ? "  ⚠ 不成对" : "  ✓";
        console.log(`     ${f.padEnd(26)} add=${listeners} remove=${removers}${flag}`);
        if (listeners > removers) note(`${f} 监听器配对`, false, `add=${listeners} remove=${removers}`);
      }
    }
  }
}

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
if (bugs.length === 0) console.log("  ✓ 本轮未发现缺陷");
