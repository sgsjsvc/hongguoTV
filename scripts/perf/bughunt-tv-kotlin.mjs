// 第七轮：TV Kotlin 模块的静态边界排查
import fs from "node:fs";
import path from "node:path";

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

const dir = "apps/tv-android/app/src/main/java/com/hongguotv/tv";
console.log("=== TV Kotlin 模块排查 ===\n");

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".kt"));
console.log(`  文件数: ${files.length}\n`);

// 1. 危险模式扫描
console.log("  --- 1. 危险模式扫描 ---");
const patterns = [
  { name: "!! 非空断言", re: /[a-zA-Z0-9_\)\]]!!/g, severity: "中" },
  { name: "lateinit（未初始化风险）", re: /lateinit\s+var/g, severity: "低" },
  { name: "runBlocking（主线程阻塞）", re: /runBlocking/g, severity: "高" },
  { name: "Thread.sleep", re: /Thread\.sleep/g, severity: "中" },
  { name: ".get() 阻塞调用", re: /\.get\(\)/g, severity: "中" },
  { name: "GlobalScope", re: /GlobalScope/g, severity: "中" },
  { name: "catch 空实现", re: /catch\s*\([^)]*\)\s*\{\s*\}/g, severity: "低" },
  { name: "printStackTrace", re: /printStackTrace/g, severity: "低" },
];

for (const p of patterns) {
  const hits = [];
  for (const f of files) {
    const c = fs.readFileSync(path.join(dir, f), "utf8");
    const m = [...c.matchAll(p.re)];
    if (m.length) hits.push({ f, n: m.length });
  }
  const total = hits.reduce((a, b) => a + b.n, 0);
  if (total > 0) {
    console.log(`  ⚠ ${p.name} [${p.severity}] 共 ${total} 处`);
    for (const h of hits.slice(0, 4)) console.log(`      ${h.f}: ${h.n}`);
  } else {
    console.log(`  ✓ ${p.name}: 0 处`);
  }
}

// 2. 协程作用域与取消
console.log("\n  --- 2. 协程作用域与生命周期 ---");
{
  const main = fs.readFileSync(path.join(dir, "MainActivity.kt"), "utf8");
  const hasScope = /private\s+val\s+scope\s*=\s*CoroutineScope/.test(main);
  const cancelsOnDestroy = /onDestroy[\s\S]{0,300}scope\.cancel\(\)/.test(main);
  note("MainActivity 有协程作用域", hasScope, "");
  note("onDestroy 取消协程", cancelsOnDestroy, cancelsOnDestroy ? "" : "⚠ 可能泄漏");

  const jobs = [...main.matchAll(/(\w+Job)\??\s*=\s*scope\.launch/g)].map((m) => m[1]);
  console.log(`     launch 的 Job 变量: ${[...new Set(jobs)].join(", ") || "无"}`);
}

// 3. 播放器生命周期
console.log("\n  --- 3. 播放器释放 ---");
{
  const main = fs.readFileSync(path.join(dir, "MainActivity.kt"), "utf8");
  const releasesPlayer = /player\?\.release\(\)/.test(main);
  const inOnDestroy = /onDestroy[\s\S]{0,400}player\?\.release\(\)/.test(main);
  note("有 player.release()", releasesPlayer, "");
  note("onDestroy 中释放播放器", inOnDestroy, inOnDestroy ? "" : "⚠ 可能泄漏 ExoPlayer");
}

// 4. 内存缓存上限
console.log("\n  --- 4. 缓存上限 ---");
{
  for (const f of files) {
    const c = fs.readFileSync(path.join(dir, f), "utf8");
    const lru = /LruCache|maxSize|evictAll/.test(c);
    if (lru) {
      const sizes = [...c.matchAll(/(\d+)\s*\*\s*1024\s*\*\s*1024|maxSize\s*=\s*([^;\n]+)/g)].map((m) => m[0]);
      console.log(`  ${f}: 有缓存控制  ${sizes.slice(0, 2).join(", ")}`);
    }
  }
}

// 5. TV 单元测试覆盖
console.log("\n  --- 5. TV 单元测试文件 ---");
{
  const testDir = "apps/tv-android/app/src/test/java/com/hongguotv/tv";
  if (fs.existsSync(testDir)) {
    const tests = fs.readdirSync(testDir).filter((f) => f.endsWith(".kt"));
    console.log(`     单元测试文件 (${tests.length}): ${tests.join(", ")}`);
  } else {
    console.log("     未找到单元测试目录");
  }
  const androidTestDir = "apps/tv-android/app/src/androidTest/java/com/hongguotv/tv";
  if (fs.existsSync(androidTestDir)) {
    const tests = fs.readdirSync(androidTestDir).filter((f) => f.endsWith(".kt"));
    console.log(`     instrumentation 测试 (${tests.length}): ${tests.join(", ")}`);
  }
}

// 6. 未处理的异常路径
console.log("\n  --- 6. 异常处理完整性 ---");
{
  const main = fs.readFileSync(path.join(dir, "MainActivity.kt"), "utf8");
  const tryCount = (main.match(/\btry\s*\{/g) || []).length;
  const catchCount = (main.match(/\bcatch\s*\(/g) || []).length;
  console.log(`     MainActivity: try=${tryCount} catch=${catchCount}`);
  note("try/catch 配对", catchCount >= tryCount, catchCount < tryCount ? "⚠ 有 try 无 catch" : "");

  const catchesCancellation = /catch\s*\(\s*cancelled\s*:\s*CancellationException\s*\)\s*\{\s*throw\s+cancelled/.test(main);
  note("正确重抛 CancellationException", catchesCancellation, catchesCancellation ? "" : "⚠ 协程取消可能被吞");

  const emptyCatches = (main.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || []).length;
  console.log(`     空 catch: ${emptyCatches} 处`);
}

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
