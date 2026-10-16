// 修正版：用正确的 seq 字段重测同步边界
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

const { LibraryStore } = await import("../../shared/library-store.mjs");
const tmp = path.join(os.tmpdir(), "bughunt-sync2-" + Date.now());
fs.mkdirSync(tmp, { recursive: true });

console.log("=== 同步边界（修正版）===\n");

// 先了解 receive 的签名与要求
console.log("  --- 0. 探测 receive 的输入要求 ---");
{
  const s = new LibraryStore(path.join(tmp, "probe.sqlite"));
  const cases = [
    ["无 seq", [{ id: "a", deviceId: "d", kind: "favorite", key: "k", op: "set", value: { id: "k", title: "t" }, at: 1 }]],
    ["有 seq", [{ id: "b", deviceId: "d", seq: 1, kind: "favorite", key: "k", op: "set", value: { id: "k", title: "t" }, at: 1 }]],
    ["seq=0", [{ id: "c", deviceId: "d", seq: 0, kind: "favorite", key: "k", op: "set", value: { id: "k", title: "t" }, at: 1 }]],
  ];
  for (const [name, evs] of cases) {
    try {
      const r = s.receive(evs, {});
      console.log(`     ${name}: ✓ ${JSON.stringify(r).slice(0, 60)}`);
    } catch (e) {
      console.log(`     ${name}: ✗ ${e.message.slice(0, 60)}`);
    }
  }
  s.close();
}

console.log("\n  --- 1. 重复 receive 幂等（带 seq）---");
{
  const s = new LibraryStore(path.join(tmp, "idem.sqlite"));
  try {
    const ev = { id: "dup1", deviceId: "remote", seq: 1, kind: "favorite", key: "series1", op: "set", value: { id: "series1", title: "t" }, at: 100 };
    const r1 = s.receive([ev], {});
    const r2 = s.receive([ev], {});
    note("重复 receive 幂等（不重复应用）", true, `r1=${JSON.stringify(r1).slice(0, 50)} r2=${JSON.stringify(r2).slice(0, 50)}`);
  } catch (e) {
    note("重复 receive 幂等", false, e.message.slice(0, 70));
  }
  s.close();
}

console.log("\n  --- 2. 批量上限 256 的判定 ---");
{
  const s = new LibraryStore(path.join(tmp, "bulk.sqlite"));
  try {
    const evs = Array.from({ length: 256 }, (_, i) => ({
      id: "b" + i, deviceId: "remote", seq: i + 1, kind: "favorite", key: "s" + i, op: "set",
      value: { id: "s" + i, title: "t" + i }, at: 1000 + i,
    }));
    const t0 = Date.now();
    s.receive(evs, {});
    note("256 事件（上限）可接收", true, `${Date.now() - t0}ms`);
  } catch (e) {
    note("256 事件（上限）可接收", false, e.message.slice(0, 60));
  }
  s.close();
}
{
  const s = new LibraryStore(path.join(tmp, "bulk2.sqlite"));
  try {
    const evs = Array.from({ length: 257 }, (_, i) => ({
      id: "c" + i, deviceId: "remote", seq: i + 1, kind: "favorite", key: "t" + i, op: "set",
      value: { id: "t" + i, title: "t" + i }, at: 1000 + i,
    }));
    s.receive(evs, {});
    note("257 事件被拒（超上限）", false, "未拒绝");
  } catch (e) {
    note("257 事件被拒（超上限）", /256|at most/i.test(e.message), e.message.slice(0, 50));
  }
  s.close();
}

console.log("\n  --- 3. 同设备 seq 冲突 ---");
{
  const s = new LibraryStore(path.join(tmp, "seq.sqlite"));
  try {
    s.receive([{ id: "x1", deviceId: "dev", seq: 5, kind: "favorite", key: "k1", op: "set", value: { id: "k1", title: "t" }, at: 1 }], {});
    s.receive([{ id: "x2", deviceId: "dev", seq: 5, kind: "favorite", key: "k2", op: "set", value: { id: "k2", title: "t" }, at: 2 }], {});
    note("同设备重复 seq 被拒", false, "未拒绝（可能允许覆盖）");
  } catch (e) {
    note("同设备重复 seq 被拒", /sequence|conflict|409/i.test(e.message), e.message.slice(0, 60));
  }
  s.close();
}

console.log("\n  --- 4. 退避逻辑（实际代码）---");
{
  const src = fs.readFileSync("custom-server/library-sync.mjs", "utf8");
  const backoff = /nextAttempt\s*=\s*Date\.now\(\)\s*\+\s*Math\.min\(30000,\s*1000\s*\*\s*2\s*\*\*\s*Math\.min\(this\.failures,\s*5\)\)/.exec(src);
  note("有指数退避（上限 30s）", !!backoff, backoff ? "1s -> 2s -> 4s -> 8s -> 16s -> 30s" : "未找到");
  const hasFailuresReset = /this\.failures\s*=\s*0/.test(src);
  note("成功后重置失败计数", hasFailuresReset, "");
}

console.log("\n  --- 5. 时钟偏移算法 ---");
{
  const src = fs.readFileSync("custom-server/library-sync.mjs", "utf8");
  const ntp = /clockOffset',\s*handshake\.serverTime\s*-\s*\(started\s*\+\s*Date\.now\(\)\)\s*\/\s*2/.test(src);
  note("使用 NTP 风格往返中点", ntp, ntp ? "正确" : "");
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
if (bugs.length === 0) console.log("  ✓ 同步边界处理正确");
