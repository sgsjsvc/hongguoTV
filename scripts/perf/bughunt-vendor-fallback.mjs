// 验证：vendor 回退路径是否会因缺 upstreamStats 而崩溃
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

console.log("=== vendor 回退路径可用性验证 ===\n");

const vendorPath = "custom-server/vendor/hongguo.cjs";
const src = fs.readFileSync(vendorPath, "utf8");

// 复现 custom-server/index.mjs:113-114 的导出语句
const exportLine = fs.readFileSync("custom-server/index.mjs", "utf8");
const m = /source \+ "\\nthis\.api = \{([^}]+)\}"/.exec(exportLine);
const exportedSymbols = m ? m[1].split(",").map((s) => s.trim()) : [];
console.log(`  custom-server 导出的符号 (${exportedSymbols.length} 个):`);
console.log(`    ${exportedSymbols.join(", ")}`);

// 检查 vendor 中是否定义了每个符号
console.log("\n  === 逐个检查 vendor 是否定义 ===");
const missing = [];
for (const sym of exportedSymbols) {
  if (!sym) continue;
  // 检查 function/const/let/var 定义
  const re = new RegExp(`(function\\s+${sym}\\b|(?:const|let|var)\\s+${sym}\\s*=)`);
  const defined = re.test(src);
  if (!defined) missing.push(sym);
  console.log(`    ${defined ? "✓" : "✗"} ${sym}`);
}

console.log("\n  === 尝试实际加载 vendor ===");
try {
  const context = vm.createContext({
    require: (name) => {
      if (name === "node:crypto") return crypto;
      throw new Error("Unsupported module: " + name);
    },
    Buffer, URL, URLSearchParams,
    axios: { create: () => ({ interceptors: { request: { use: () => {} } }, get: async () => ({ status: 200, data: "{}" }), post: async () => ({ status: 200, data: "{}" }) }) },
  });
  vm.runInContext(src + "\nthis.api = {" + exportedSymbols.join(", ") + "};", context, { timeout: 5000 });
  console.log("    ✓ vendor 加载成功");
  console.log(`    导出的 API 键: ${Object.keys(context.api).join(", ")}`);
} catch (e) {
  console.log(`    ✗ vendor 加载失败: ${e.message}`);
  console.log("");
  console.log("  === 这是严重缺陷 ===");
  console.log("  custom-server/index.mjs 优先加载 shared，vendor 仅作回退。");
  console.log("  若 shared 缺失（如打包遗漏），回退到 vendor 会因缺符号而崩溃。");
}

console.log("\n  === 汇总 ===");
if (missing.length) {
  console.log(`  vendor 缺失 ${missing.length} 个被导出的符号: ${missing.join(", ")}`);
  console.log("");
  console.log("  影响评估：");
  console.log("    - 当前：custom-server 优先加载 shared，不受影响");
  console.log("    - 回退时：vendor 缺符号 -> vm.runInContext 抛错 -> 引擎加载失败");
  console.log("    - 严重性：中（只在 shared 缺失时触发，但那时正是需要回退的时候）");
} else {
  console.log("  ✓ vendor 符号完整");
}
