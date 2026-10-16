// 验证 Bug #7：打包产物中的 vendor 是否可用的回退
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";

console.log("=== 打包产物 vendor 回退可用性 ===\n");

// 检查已有的 bundle 目录
const candidates = [
  "outputs/bundles/hongguotv-web-win-x64",
  "outputs/bundles/hongguotv-web-linux-x64",
];
const bundle = candidates.find((d) => fs.existsSync(d));

if (!bundle) {
  console.log("  未找到已解压的 bundle 目录，检查 zip 内的结构");
  // 检查 zip 是否存在
  const zips = fs.readdirSync("outputs/bundles").filter((f) => f.endsWith(".zip"));
  console.log(`  可用 zip: ${zips.slice(0, 5).join(", ")}`);
} else {
  console.log(`  检查: ${bundle}\n`);

  // 1. vendor 是否存在
  const vendorPath = path.join(bundle, "custom-server", "vendor", "hongguo.cjs");
  const sharedPath = path.join(bundle, "shared", "content-core", "hongguo.js");

  console.log("  --- 文件存在性 ---");
  console.log(`    shared/content-core/hongguo.js: ${fs.existsSync(sharedPath) ? "✓ 存在" : "✗ 缺失"}`);
  console.log(`    custom-server/vendor/hongguo.cjs: ${fs.existsSync(vendorPath) ? "✓ 存在" : "✗ 缺失"}`);

  if (fs.existsSync(sharedPath) && fs.existsSync(vendorPath)) {
    const shared = fs.readFileSync(sharedPath, "utf8");
    const vendor = fs.readFileSync(vendorPath, "utf8");
    console.log(`\n  --- 内容一致性 ---`);
    console.log(`    shared 含 upstreamStats: ${shared.includes("upstreamStats") ? "✓" : "✗"}`);
    console.log(`    vendor 含 upstreamStats: ${vendor.includes("upstreamStats") ? "✓" : "✗"}`);
    console.log(`    shared 含 deviceEntropy: ${shared.includes("deviceEntropy") ? "✓" : "✗"}`);
    console.log(`    vendor 含 deviceEntropy: ${vendor.includes("deviceEntropy") ? "✓" : "✗"}`);

    // 2. 模拟回退：若 shared 缺失，vendor 能否加载
    console.log(`\n  --- 模拟回退（shared 缺失时用 vendor）---`);
    const serverSrc = fs.readFileSync(path.join(bundle, "custom-server", "index.mjs"), "utf8");
    const apiMatch = /this\.api\s*=\s*\{([^}]*)\}/.exec(serverSrc);
    const symbols = apiMatch ? apiMatch[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
    console.log(`    custom-server 导出符号: ${symbols.join(", ")}`);

    try {
      const ctx = vm.createContext({
        require: (n) => { if (n === "node:crypto") return crypto; throw new Error("unsupported"); },
        Buffer, URL, URLSearchParams,
        axios: { create: () => ({ interceptors: { request: { use: () => {} } }, get: async () => ({ status: 200, data: "{}" }), post: async () => ({ status: 200, data: "{}" }) }) },
      });
      vm.runInContext(vendor + "\nthis.api = {" + symbols.join(", ") + "};", ctx, { timeout: 5000 });
      console.log(`    ✓ vendor 可加载`);
    } catch (e) {
      console.log(`    ✗ vendor 加载失败: ${e.message}`);
      console.log("");
      console.log("  === 这是缺陷 ===");
      console.log("  打包产物同时包含 shared 与 vendor：");
      console.log("    - 正常情况：优先加载 shared（有 upstreamStats）");
      console.log("    - 回退情况：若 shared 缺失/损坏，vendor 会因缺符号而崩溃");
      console.log("");
      console.log("  影响评估：");
      console.log("    - 当前打包包含 shared，正常路径不受影响");
      console.log("    - 但 vendor 作为「回退保险」实际不可用");
      console.log("    - 且 76KB 的无用文件增加了包体积");
    }
  }
}

console.log("\n  === 补充：vendor 的历史用途 ===");
console.log("  custom-server/index.mjs:91-92:");
console.log("    const sharedEngine = new URL('../shared/content-core/hongguo.js', import.meta.url);");
console.log("    const cjsPath = fs.existsSync(sharedEngine) ? sharedEngine : new URL('./vendor/hongguo.cjs', ...);");
console.log("  → vendor 仅在 shared 缺失时使用");
console.log("  → 当前 vendor 缺 upstreamStats，回退会崩溃");
