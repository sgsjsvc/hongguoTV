// 第八轮：推荐核心、工具函数、TV 引擎的边界测试
import fs from "node:fs";
import path from "node:path";

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

console.log("=== 第八轮：推荐核心与工具函数 ===\n");

// 1. RecommendationSession 边界
console.log("  --- 1. RecommendationSession 边界 ---");
{
  const { RecommendationSession } = await import("../../shared/recommendation-core.cjs");
  const fns = Object.getOwnPropertyNames(RecommendationSession.prototype);
  console.log(`     原型方法: ${fns.join(", ")}`);

  // append 的边界
  if (fns.includes("append")) {
    const s = new RecommendationSession({ id: "t" });
    const cases = [
      ["空数组", []],
      ["null", null],
      ["undefined", undefined],
      ["单元素", [{ id: "1", tags: "" }]],
      ["无 id 元素", [{ tags: "" }]],
      ["limit=0", [{ id: "1", tags: "" }], 0],
      ["limit=负数", [{ id: "1", tags: "" }], -1],
      ["limit 超大", [{ id: "1", tags: "" }], 1e9],
    ];
    for (const [name, items, limit] of cases) {
      try {
        const r = limit !== undefined ? s.append(items, limit) : s.append(items);
        console.log(`       ${name}: ✓ 返回 ${Array.isArray(r) ? r.length + " 项" : typeof r}`);
      } catch (e) {
        console.log(`       ${name}: ✗ ${e.message.slice(0, 55)}`);
      }
    }
  }
}

// 2. 推荐算法的稳定性（同输入同输出）
console.log("\n  --- 2. 推荐算法确定性 ---");
{
  const { RecommendationSession } = await import("../../shared/recommendation-core.cjs");
  const make = () => {
    const s = new RecommendationSession({ id: "det" });
    const pool = Array.from({ length: 50 }, (_, i) => ({
      id: String(i), title: "t" + i, tags: "tag" + (i % 5), contentType: "real-drama",
    }));
    return s.append(pool, 10).map((x) => x.id).join(",");
  };
  const a = make(), b = make();
  note("同输入产生同输出（确定性）", a === b, a === b ? "" : `\n       a=${a.slice(0, 60)}\n       b=${b.slice(0, 60)}`);
}

// 3. utils 的边界（如果可导入）
console.log("\n  --- 3. shared/utils.ts 静态检查 ---");
{
  const p = "shared/utils.ts";
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, "utf8");
    const exports = [...c.matchAll(/export\s+(?:function|const)\s+(\w+)/g)].map((m) => m[1]);
    console.log(`     导出: ${exports.join(", ")}`);
    // 检查危险模式
    const hasNonEmptyCheck = /if\s*\(\s*!?\w+\s*\)/.test(c);
    const usesOptionalChaining = /\?\./.test(c);
    console.log(`     使用可选链: ${usesOptionalChaining ? "✓" : "否"}`);
    const hasTypeAny = /:\s*any\b/.test(c);
    console.log(`     使用 any 类型: ${hasAnyCount(c)} 处`);
    function hasAnyCount(src) { return (src.match(/:\s*any\b/g) || []).length; }
  } else {
    console.log("     文件不存在");
  }
}

// 4. TV StandaloneEngine 的静态检查
console.log("\n  --- 4. TV StandaloneEngine 静态检查 ---");
{
  const p = "apps/tv-android/app/src/main/java/com/hongguotv/tv/StandaloneEngine.kt";
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, "utf8");
    console.log(`     行数: ${c.split("\n").length}`);

    // 检查 Thread.sleep 上下文
    const idx = c.indexOf("Thread.sleep");
    if (idx >= 0) {
      const block = c.slice(Math.max(0, idx - 250), idx + 120);
      console.log("     Thread.sleep 上下文：");
      block.split("\n").filter((l) => l.trim()).slice(-6).forEach((l) => console.log("       " + l.trim().slice(0, 95)));
      const inCoroutine = /suspend|coroutineScope|withContext/.test(block);
      const onIoDispatcher = /Dispatchers\.IO/.test(block);
      console.log(`\n     在协程内: ${inCoroutine ? "✓" : "?"}  用 IO 调度器: ${onIoDispatcher ? "✓" : "?"}`);
    }

    // 检查 !! 使用
    const bangs = [...c.matchAll(/[a-zA-Z0-9_\)\]]!!/g)];
    if (bangs.length) {
      console.log(`     !! 非空断言: ${bangs.length} 处`);
      for (const m of bangs.slice(0, 3)) {
        const line = c.slice(0, m.index).split("\n").length;
        const lineText = c.split("\n")[line - 1];
        console.log(`       行 ${line}: ${lineText.trim().slice(0, 85)}`);
      }
    }
  }
}

// 5. CencIndex 边界
console.log("\n  --- 5. CencIndex 静态检查 ---");
{
  const p = "apps/tv-android/app/src/main/java/com/hongguotv/tv/CencIndex.kt";
  if (fs.existsSync(p)) {
    const c = fs.readFileSync(p, "utf8");
    console.log(`     行数: ${c.split("\n").length}`);
    const bangs = [...c.matchAll(/[a-zA-Z0-9_\)\]]!!/g)];
    console.log(`     !! 非空断言: ${bangs.length} 处`);
    for (const m of bangs.slice(0, 3)) {
      const line = c.slice(0, m.index).split("\n").length;
      const lineText = c.split("\n")[line - 1];
      console.log(`       行 ${line}: ${lineText.trim().slice(0, 85)}`);
    }
    // 检查是否有测试
    const hasTest = fs.existsSync("apps/tv-android/app/src/test/java/com/hongguotv/tv/CencIndexTest.kt");
    note("CencIndex 有单元测试", hasTest, "");
  }
}

// 6. MainActivity 的空 catch
console.log("\n  --- 6. MainActivity 空 catch 上下文 ---");
{
  const p = "apps/tv-android/app/src/main/java/com/hongguotv/tv/MainActivity.kt";
  const c = fs.readFileSync(p, "utf8");
  const emptyCatches = [...c.matchAll(/catch\s*\([^)]*\)\s*\{\s*\}/g)];
  console.log(`     空 catch: ${emptyCatches.length} 处`);
  for (const m of emptyCatches) {
    const line = c.slice(0, m.index).split("\n").length;
    const lines = c.split("\n");
    console.log(`       行 ${line}: ${lines[line - 1]?.trim().slice(0, 90)}`);
    console.log(`       上下文: ${lines[line - 2]?.trim().slice(0, 90)}`);
  }
}

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
if (bugs.length === 0) console.log("  ✓ 本轮未发现缺陷");
