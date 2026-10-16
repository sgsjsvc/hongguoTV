// 用真实 byteRange 函数做边界测试
import { byteRange } from "../../server/http.mjs";

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

console.log("=== byteRange 真实函数边界测试 ===\n");

const total = 1000;
const cases = [
  // [输入, 期望, 说明]
  [null, [0, 999], "无 Range 头 -> 全量"],
  ["", [0, 999], "空字符串 -> 全量"],
  ["bytes=0-99", [0, 99], "正常范围"],
  ["bytes=0-0", [0, 0], "单字节"],
  ["bytes=500-", [500, 999], "开放结尾"],
  ["bytes=-100", [900, 999], "后缀范围"],
  ["bytes=-0", null, "后缀 0 -> 无效"],
  ["bytes=0-", [0, 999], "全量"],
  ["bytes=999-1000", [999, 999], "结尾裁剪"],
  ["bytes=1000-", null, "起点越界 -> 无效"],
  ["bytes=500-100", null, "起点>终点 -> 无效"],
  ["bytes=-2000", [0, 999], "后缀超长 -> 从 0 开始"],
  ["bytes=999999999999999999999-", null, "超大数字 -> 无效"],
  ["bytes=abc-def", null, "非数字 -> 无效"],
  ["garbage", null, "非法格式 -> 无效"],
  ["bytes=0-99,200-299", null, "多范围 -> 无效（不支持）"],
  ["Bytes=0-99", null, "大小写敏感 -> 无效"],
  ["bytes= 0-99", null, "含空格 -> 无效"],
  ["bytes=-", null, "两个都空 -> 无效"],
  ["bytes=1-1", [1, 1], "单字节中间"],
];

let pass = 0, fail = 0;
for (const [input, expect, desc] of cases) {
  const got = byteRange(input, total);
  const same = JSON.stringify(got) === JSON.stringify(expect);
  if (same) pass += 1; else fail += 1;
  console.log(`  ${same ? "✓" : "✗"} ${String(JSON.stringify(input)).padEnd(32)} -> ${JSON.stringify(got).padEnd(12)} ${desc}`);
  if (!same) console.log(`      期望: ${JSON.stringify(expect)}`);
}

console.log("\n  --- 其他 total 值 ---");
for (const t of [0, 1, 2, 100]) {
  console.log(`  total=${t}:`);
  console.log(`    null       -> ${JSON.stringify(byteRange(null, t))}`);
  console.log(`    bytes=0-0  -> ${JSON.stringify(byteRange("bytes=0-0", t))}`);
  console.log(`    bytes=0-99 -> ${JSON.stringify(byteRange("bytes=0-99", t))}`);
}

console.log("\n  === 汇总 ===");
console.log(`  ${pass} 通过 / ${fail} 失败（共 ${cases.length} 项）`);
if (fail === 0) {
  console.log("  ✓ byteRange 边界处理完全正确");
  console.log("");
  console.log("  特别值得肯定：");
  console.log("    - 严格校验 start<=end、start<total、isSafeInteger");
  console.log("    - 后缀范围超长时正确从 0 开始（bytes=-2000 -> [0,999]）");
  console.log("    - 结尾越界时正确裁剪（bytes=999-1000 -> [999,999]）");
  console.log("    - 非法输入一律返回 null（调用方转 416）");
} else {
  for (const b of bugs) console.log(`    ✗ ${b.name}`);
}
