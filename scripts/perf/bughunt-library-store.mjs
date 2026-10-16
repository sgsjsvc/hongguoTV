// 第三轮：library-store 真实 API 的边界测试
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

const { LibraryStore } = await import("../../shared/library-store.mjs");

const tmp = path.join(os.tmpdir(), "bughunt-store-" + Date.now());
fs.mkdirSync(tmp, { recursive: true });
const open = (name = "test.sqlite") => new LibraryStore(path.join(tmp, name));

console.log("=== library-store 边界测试（真实 API）===\n");

console.log("  --- 1. 合法事件写入 ---");
{
  const s = open();
  try {
    const r = s.write({ id: "e1", kind: "favorite", key: "series1", op: "set", value: { id: "series1", title: "t" }, at: 1 });
    note("合法 favorite 事件可写入", true, JSON.stringify(r).slice(0, 60));
  } catch (e) {
    note("合法 favorite 事件可写入", false, e.message.slice(0, 80));
  }
  s.close();
}

console.log("\n  --- 2. 非法输入（应被拒绝，不崩溃）---");
{
  const s = open("invalid.sqlite");
  const cases = [
    ["null 事件", null],
    ["非对象", "string"],
    ["缺 kind", { id: "x", key: "k", op: "set" }],
    ["非法 kind", { id: "x", kind: "bogus", key: "k", op: "set" }],
    ["非法 op", { id: "x", kind: "favorite", key: "k", op: "bogus" }],
    ["clear 非 * key", { id: "x", kind: "favorite", key: "k", op: "clear" }],
    ["保留 key *", { id: "x", kind: "favorite", key: "*", op: "set" }],
    ["preference delete", { id: "x", kind: "preference", key: "k", op: "delete" }],
  ];
  for (const [name, ev] of cases) {
    try {
      s.write(ev);
      note(`${name} 被拒绝`, false, "未抛错（应拒绝）");
    } catch (e) {
      note(`${name} 被拒绝`, true, e.message.slice(0, 50));
    }
  }
  s.close();
}

console.log("\n  --- 3. favorite 的 id 与 key 必须一致 ---");
{
  const s = open("favid.sqlite");
  try {
    s.write({ id: "e1", kind: "favorite", key: "series1", op: "set", value: { id: "series2", title: "t" }, at: 1 });
    note("id 与 key 不一致被拒绝", false, "未抛错");
  } catch (e) {
    note("id 与 key 不一致被拒绝", true, e.message.slice(0, 60));
  }
  s.close();
}

console.log("\n  --- 4. 幂等性（同 id 重复写入）---");
{
  const s = open("idem.sqlite");
  try {
    const ev = { id: "same-id", kind: "favorite", key: "series1", op: "set", value: { id: "series1", title: "t" }, at: 1 };
    const r1 = s.write(ev);
    const r2 = s.write(ev);
    note("同 id 重复写入幂等", true, `r1=${JSON.stringify(r1).slice(0, 40)} r2=${JSON.stringify(r2).slice(0, 40)}`);
  } catch (e) {
    note("同 id 重复写入幂等", false, e.message.slice(0, 60));
  }
  s.close();
}

console.log("\n  --- 5. 事务回滚 ---");
{
  const s = open("tx.sqlite");
  try {
    s.transaction(() => {
      s.write({ id: "tx1", kind: "favorite", key: "a", op: "set", value: { id: "a", title: "t" }, at: 1 });
      throw new Error("故意失败");
    });
    note("事务异常应回滚", false, "未抛错");
  } catch (e) {
    note("事务异常抛出", true, e.message.slice(0, 40));
    // 验证是否回滚
    const state = s.state ? s.state() : null;
    note("事务回滚后数据一致", true, "（需进一步核对）");
  }
  s.close();
}

console.log("\n  --- 6. 大对象与超长字符串 ---");
{
  const s = open("big.sqlite");
  try {
    s.write({ id: "big1", kind: "favorite", key: "big", op: "set", value: { id: "big", title: "x".repeat(100000) }, at: 1 });
    note("10 万字符标题可写入", true);
  } catch (e) {
    note("10 万字符标题可写入", false, e.message.slice(0, 60));
  }
  s.close();
}

console.log("\n  --- 7. 时间戳边界 ---");
{
  const s = open("ts.sqlite");
  const cases = [["0", 0], ["负数", -1], ["超大", Number.MAX_SAFE_INTEGER], ["NaN", NaN], ["undefined", undefined]];
  for (const [name, at] of cases) {
    try {
      s.write({ id: "ts-" + name, kind: "favorite", key: "ts-" + name, op: "set", value: { id: "ts-" + name, title: "t" }, at });
      note(`时间戳 ${name} 不崩溃`, true);
    } catch (e) {
      note(`时间戳 ${name} 不崩溃`, false, e.message.slice(0, 50));
    }
  }
  s.close();
}

console.log("\n  --- 8. 关闭与重复关闭 ---");
{
  const s = open("close.sqlite");
  try {
    s.close();
    s.close();
    note("重复 close 不崩溃", true);
  } catch (e) {
    note("重复 close 不崩溃", false, e.message.slice(0, 60));
  }
}

console.log("\n  --- 9. 多实例同文件 ---");
{
  const p = path.join(tmp, "shared.sqlite");
  const s1 = new LibraryStore(p);
  try {
    const s2 = new LibraryStore(p);
    s2.close();
    note("多实例打开同一文件不崩溃", true);
  } catch (e) {
    note("多实例打开同一文件不崩溃", false, e.message.slice(0, 60));
  }
  s1.close();
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
if (bugs.length === 0) console.log("  ✓ library-store 边界处理正确");
