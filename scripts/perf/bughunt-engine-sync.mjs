// 对比 shared 引擎与 vendor 副本的实际差异
import fs from "node:fs";

const shared = fs.readFileSync("shared/content-core/hongguo.js", "utf8");
const vendor = fs.readFileSync("custom-server/vendor/hongguo.cjs", "utf8");

console.log("=== shared vs vendor 差异分析 ===\n");
console.log(`  shared: ${shared.length} 字符, ${shared.split("\n").length} 行`);
console.log(`  vendor: ${vendor.length} 字符, ${vendor.split("\n").length} 行`);
console.log(`  差异:   ${shared.length - vendor.length} 字符, ${shared.split("\n").length - vendor.split("\n").length} 行`);

// 检查关键修复是否两边都有
console.log("\n=== 关键修复点是否两边都有 ===");
const features = [
  ["deviceEntropy（跨端随机源）", "deviceEntropy"],
  ["randomBytes 能力探测", "typeof crypto.randomBytes"],
  ["freshDevice", "freshDevice"],
  ["无硬编码 device_id", "1905892595378490", true], // 期望不存在
  ["signedVideoRequest 守卫", "需要一次性设备标识"],
  ["buildMedusa device 参数", "function buildMedusa(url, body, khronos, device)"],
  ["requestVideoModel 空体重试", "空响应体"],
  ["upstreamStats 观测", "upstreamStats"],
];
for (const [name, needle, negate] of features) {
  const inShared = shared.includes(needle);
  const inVendor = vendor.includes(needle);
  const ok = negate ? !inShared && !inVendor : inShared && inVendor;
  console.log(`  ${ok ? "✓" : "✗"} ${name}`);
  if (!ok) {
    console.log(`      shared=${negate ? !inShared : inShared}  vendor=${negate ? !inVendor : inVendor}`);
  }
}

// 找出 shared 有但 vendor 没有的关键行（按行对比）
console.log("\n=== shared 独有的代码行（前 20 条，排除空行）===");
const sLines = new Set(shared.split("\n").map((l) => l.trim()).filter((l) => l.length > 10));
const vLines = new Set(vendor.split("\n").map((l) => l.trim()).filter((l) => l.length > 10));
let count = 0;
for (const line of sLines) {
  if (!vLines.has(line)) {
    count += 1;
    if (count <= 20) console.log(`  + ${line.slice(0, 110)}`);
  }
}
console.log(`\n  shared 独有行合计: ${count}`);

console.log("\n=== vendor 独有的代码行（前 10 条）===");
let vcount = 0;
for (const line of vLines) {
  if (!sLines.has(line)) {
    vcount += 1;
    if (vcount <= 10) console.log(`  - ${line.slice(0, 110)}`);
  }
}
console.log(`\n  vendor 独有行合计: ${vcount}`);

console.log("\n=== 判定 ===");
if (count > 50 || vcount > 50) {
  console.log("  ⚠ 差异较大，需确认 vendor 是否为过期副本");
  console.log("     注意：custom-server/index.mjs:90-91 优先加载 shared，vendor 仅作回退");
} else {
  console.log("  ✓ 差异较小，可能是格式差异（vendor 为打包产物）");
}
