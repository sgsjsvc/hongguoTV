// TV PlaybackPolicy 边界测试（用 Node 复现 Kotlin 逻辑，找逻辑缺陷）
// 目的：验证边界处理是否正确

console.log("=== PlaybackPolicy 边界逻辑验证 ===\n");

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

// 复现 Kotlin 逻辑
const remoteEpisodeIndex = (index, count, direction, repeatCount) => {
  if (repeatCount !== 0 || ![-1, 1].includes(direction) || !(index >= 0 && index < count)) return null;
  const next = index + direction;
  return next >= 0 && next < count ? next : null;
};
const seek = (positionMs, deltaMs, durationMs) => {
  const target = deltaMs > 0 && positionMs > Number.MAX_SAFE_INTEGER - deltaMs ? Number.MAX_SAFE_INTEGER : positionMs + deltaMs;
  return Math.max(0, durationMs > 0 ? Math.min(target, durationMs) : target);
};
const mergeUnique = (existing, incoming) => {
  const seen = new Set();
  const out = [];
  for (const r of [...existing, ...incoming]) {
    if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
  }
  return out;
};
const restoredIndex = (items, id) => {
  const i = items.findIndex((x) => x.id === id);
  return Math.max(0, i);
};
const resumeIndex = (episodes, progress) => {
  if (!progress) return 0;
  const i = episodes.findIndex((e) => e.id === progress.episodeId);
  if (i < 0) return 0;
  return progress.completed && i < episodes.length - 1 ? i + 1 : i;
};

console.log("  --- 1. remoteEpisodeIndex ---");
note("末尾向后 -> null", remoteEpisodeIndex(4, 5, 1, 0) === null);
note("开头向前 -> null", remoteEpisodeIndex(0, 5, -1, 0) === null);
note("中间向后 -> +1", remoteEpisodeIndex(2, 5, 1, 0) === 3);
note("长按（repeatCount≠0）-> null", remoteEpisodeIndex(2, 5, 1, 3) === null);
note("越界 index -> null", remoteEpisodeIndex(10, 5, 1, 0) === null);
note("负数 index -> null", remoteEpisodeIndex(-1, 5, 1, 0) === null);
note("空列表 -> null", remoteEpisodeIndex(0, 0, 1, 0) === null);
note("direction=0 -> null", remoteEpisodeIndex(2, 5, 0, 0) === null);

console.log("\n  --- 2. seek 边界 ---");
note("正常前进", seek(1000, 5000, 60000) === 6000);
note("正常后退", seek(10000, -3000, 60000) === 7000);
note("退到负数 -> 0", seek(1000, -5000, 60000) === 0);
note("前进超出时长 -> 时长", seek(59000, 5000, 60000) === 60000);
note("durationMs=0 时不限制", seek(1000, 5000, 0) === 6000);
note("溢出保护", seek(Number.MAX_SAFE_INTEGER, 1000, 0) === Number.MAX_SAFE_INTEGER);
note("positionMs 为负 -> 0", seek(-100, 0, 60000) === 0);

console.log("\n  --- 3. mergeUnique ---");
{
  const a = [{ id: "1" }, { id: "2" }];
  const b = [{ id: "2" }, { id: "3" }];
  const m = mergeUnique(a, b);
  note("去重且保持顺序", m.length === 3 && m[0].id === "1" && m[2].id === "3", JSON.stringify(m.map((x) => x.id)));
}
{
  const m = mergeUnique([], [{ id: "1" }]);
  note("空 existing", m.length === 1);
}
{
  const m = mergeUnique([{ id: "1" }], []);
  note("空 incoming", m.length === 1);
}
{
  // 重复 ID 在同一数组内
  const m = mergeUnique([{ id: "1" }, { id: "1" }], []);
  note("同数组内重复也被去重", m.length === 1, `实际 ${m.length}`);
}

console.log("\n  --- 4. restoredIndex ---");
note("找到 -> 正确索引", restoredIndex([{ id: "a" }, { id: "b" }], "b") === 1);
note("未找到 -> 0", restoredIndex([{ id: "a" }], "z") === 0);
note("id 为 null -> 0", restoredIndex([{ id: "a" }], null) === 0);
note("空列表 -> 0", restoredIndex([], "a") === 0);

console.log("\n  --- 5. resumeIndex ---");
{
  const eps = [{ id: "e1" }, { id: "e2" }, { id: "e3" }];
  note("无进度 -> 0", resumeIndex(eps, null) === 0);
  note("未完成 -> 同集", resumeIndex(eps, { episodeId: "e2", completed: false }) === 1);
  note("已完成 -> 下一集", resumeIndex(eps, { episodeId: "e2", completed: true }) === 2);
  note("已完成且在末集 -> 保持末集", resumeIndex(eps, { episodeId: "e3", completed: true }) === 2);
  note("找不到集 -> 0", resumeIndex(eps, { episodeId: "zzz", completed: false }) === 0);
  note("空剧集 -> 0", resumeIndex([], { episodeId: "e1", completed: false }) === 0);
}

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个逻辑缺陷`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
if (bugs.length === 0) console.log("  ✓ PlaybackPolicy 边界处理全部正确");
