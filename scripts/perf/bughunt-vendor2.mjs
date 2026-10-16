// 修正版：准确提取 custom-server 的导出符号并验证 vendor
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

console.log("=== vendor 回退路径可用性验证（修正版）===\n");

const serverSrc = fs.readFileSync("custom-server/index.mjs", "utf8");

// 找到 vm.runInContext 的 source + "..." 部分
const idx = serverSrc.indexOf("source + ");
const snippet = serverSrc.slice(idx, idx + 400);
console.log("  custom-server 的导出语句片段：");
console.log("    " + snippet.split("\n")[0].slice(0, 180));

// 提取 this.api = { ... } 中的符号
const apiMatch = /this\.api\s*=\s*\{([^}]*)\}/.exec(serverSrc);
const symbols = apiMatch
  ? apiMatch[1].split(",").map((s) => s.trim()).filter(Boolean)
  : [];
console.log(`\n  导出符号 (${symbols.length} 个):`);
console.log(`    ${symbols.join(", ")}`);

// 检查 vendor 是否定义每个符号
const vendorSrc = fs.readFileSync("custom-server/vendor/hongguo.cjs", "utf8");
const sharedSrc = fs.readFileSync("shared/content-core/hongguo.js", "utf8");

console.log("\n  === 符号定义检查 ===");
console.log("  符号                 shared  vendor");
const missing = [];
for (const sym of symbols) {
  const re = new RegExp(`(function\\s+${sym}\\b|(?:const|let|var)\\s+${sym}\\s*=)`);
  const inShared = re.test(sharedSrc);
  const inVendor = re.test(vendorSrc);
  if (!inVendor) missing.push(sym);
  console.log(`  ${sym.padEnd(20)} ${inShared ? "✓" : "✗"}      ${inVendor ? "✓" : "✗"}`);
}

console.log("\n  === 实际加载 vendor（复现回退路径）===");
try {
  const context = vm.createContext({
    require: (name) => {
      if (name === "node:crypto") return crypto;
      throw new Error("Unsupported module: " + name);
    },
    Buffer, URL, URLSearchParams,
    axios: {
      create: () => ({
        interceptors: { request: { use: () => {} } },
        get: async () => ({ status: 200, data: "{}" }),
        post: async () => ({ status: 200, data: "{}" }),
      }),
    },
  });
  vm.runInContext(vendorSrc + "\nthis.api = {" + symbols.join(", ") + "};", context, { timeout: 5000 });
  console.log("    ✓ vendor 加载成功");
  console.log(`    API 键: ${Object.keys(context.api).join(", ")}`);
  const undef = Object.entries(context.api).filter(([, v]) => v === undefined).map(([k]) => k);
  if (undef.length) console.log(`    ⚠ undefined 的键: ${undef.join(", ")}`);
} catch (e) {
  console.log(`    ✗ vendor 加载失败: ${e.message}`);
}

console.log("\n  === 汇总 ===");
if (missing.length) {
  console.log(`  vendor 缺失 ${missing.length} 个符号: ${missing.join(", ")}`);
  console.log("");
  console.log("  影响：");
  console.log("    - 当前 custom-server 优先加载 shared，不受影响");
  console.log("    - 若 shared 缺失而回退到 vendor，vm.runInContext 会抛 ReferenceError");
  console.log("    - 即「回退路径在最需要时不可用」");
} else {
  console.log("  ✓ vendor 符号完整");
}
