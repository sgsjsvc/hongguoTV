// 第八轮修正：用合法的候选数据测试 RecommendationSession
import fs from "node:fs";

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

const { RecommendationSession } = await import("../../shared/recommendation-core.cjs");

console.log("=== RecommendationSession 边界（修正版）===\n");

// 合法候选：必须有 id/title/contentType
const makeCandidates = (n) => Array.from({ length: n }, (_, i) => ({
  id: "id" + i, title: "标题" + i, contentType: "real-drama", tags: "tag" + (i % 5),
}));

console.log("  --- 1. 基本过滤 ---");
{
  const s = new RecommendationSession({ seed: "t" });
  const mixed = [
    { id: "ok1", title: "t1", contentType: "real-drama" },
    { id: "noTitle", contentType: "real-drama" },              // 缺 title
    { id: "badType", title: "t2", contentType: "bogus" },      // 非法 type
    { id: "", title: "t3", contentType: "real-drama" },        // 空 id
    null,                                                       // null
    { id: "ok2", title: "t4", contentType: "comic-drama" },
  ];
  const r = s.append(mixed, 10);
  note("过滤非法候选，保留合法", r.length === 2, `${r.length} 项: ${r.map((x) => x.id).join(",")}`);
}

console.log("\n  --- 2. 边界输入 ---");
{
  const s = new RecommendationSession({ seed: "t" });
  for (const [name, input, limit] of [
    ["null", null, undefined],
    ["undefined", undefined, undefined],
    ["空数组", [], undefined],
    ["limit=0", makeCandidates(5), 0],
    ["limit=负数", makeCandidates(5), -1],
    ["limit=超大", makeCandidates(5), 1e9],
  ]) {
    try {
      const r = limit !== undefined ? s.append(input, limit) : s.append(input);
      console.log(`     ${name.padEnd(12)} -> ${r.length} 项`);
    } catch (e) {
      console.log(`     ${name.padEnd(12)} -> ✗ ${e.message.slice(0, 50)}`);
    }
  }
}

console.log("\n  --- 3. 去重（emitted 集合）---");
{
  const s = new RecommendationSession({ seed: "t" });
  const c = makeCandidates(3);
  const r1 = s.append(c, 10);
  const r2 = s.append(c, 10);
  note("已发出的候选不再重复", r2.length === 0, `第一次 ${r1.length} 项，第二次 ${r2.length} 项`);
}

console.log("\n  --- 4. 模式过滤 ---");
{
  const s = new RecommendationSession({ seed: "t", mode: "real-drama" });
  const mixed = [
    { id: "r1", title: "t", contentType: "real-drama" },
    { id: "c1", title: "t", contentType: "comic-drama" },
  ];
  const r = s.append(mixed, 10);
  note("mode 过滤非目标类型", r.length === 1 && r[0].id === "r1", `保留 ${r.map((x) => x.id).join(",")}`);
}

console.log("\n  --- 5. 确定性 ---");
{
  const run = () => {
    const s = new RecommendationSession({ seed: "fixed", now: 1000 });
    return s.append(makeCandidates(50), 10).map((x) => x.id).join(",");
  };
  const a = run(), b = run();
  note("同 seed 同 now 产生同结果", a === b, a === b ? `${a.slice(0, 50)}` : `\n       a=${a}\n       b=${b}`);
}

console.log("\n  --- 6. 不同 seed 产生不同结果 ---");
{
  const run = (seed) => {
    const s = new RecommendationSession({ seed, now: 1000 });
    return s.append(makeCandidates(50), 10).map((x) => x.id).join(",");
  };
  const a = run("seedA"), b = run("seedB");
  note("不同 seed 产生不同结果", a !== b, a === b ? "⚠ 相同（可能是设计如此）" : "✓");
}

console.log("\n  --- 7. limit 生效 ---");
{
  const s = new RecommendationSession({ seed: "t" });
  const r = s.append(makeCandidates(100), 5);
  note("limit=5 返回 5 项", r.length === 5, `实际 ${r.length}`);
}

console.log("\n  --- 8. 大批量性能 ---");
{
  const s = new RecommendationSession({ seed: "t" });
  const big = makeCandidates(1000);
  const t0 = performance.now();
  const r = s.append(big, 24);
  const ms = performance.now() - t0;
  note("1000 候选不卡顿", ms < 100, `${ms.toFixed(1)}ms，返回 ${r.length} 项`);
}

console.log("\n  --- 9. score 方法 ---");
{
  const s = new RecommendationSession({ seed: "t" });
  try {
    const row = { id: "x", title: "t", contentType: "real-drama", tags: "a" };
    const sc = s.score(row);
    note("score 返回数值", typeof sc === "number" && Number.isFinite(sc), `score=${sc}`);
  } catch (e) {
    note("score 可用", false, e.message.slice(0, 60));
  }
  // 边界
  for (const [name, row] of [["null", null], ["无 tags", { id: "y", title: "t", contentType: "real-drama" }]]) {
    try {
      const sc = s.score(row);
      console.log(`     score(${name}) = ${sc}`);
    } catch (e) {
      console.log(`     score(${name}) -> ✗ ${e.message.slice(0, 50)}`);
    }
  }
}

console.log("\n  --- 10. size 方法 ---");
{
  const s = new RecommendationSession({ seed: "t" });
  s.append(makeCandidates(10), 5);
  const sz = typeof s.size === "function" ? s.size() : s.size;
  console.log(`     size = ${sz}`);
  note("size 可用", sz !== undefined, "");
}

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
if (bugs.length === 0) console.log("  ✓ RecommendationSession 边界处理正确");
