// 核实打包覆盖：custom-server 的依赖是否真的都被打包
import fs from "node:fs";
import path from "node:path";

console.log("=== 打包覆盖核实 ===\n");

const bundle = "outputs/bundles/hongguotv-web-win-x64";
const deps = ["history-store.mjs", "history-routes.mjs", "library-sync.mjs", "library-routes.mjs", "recommendation-service.mjs"];

console.log("  custom-server 的本地依赖是否在打包产物中：");
const missing = [];
for (const d of deps) {
  const p = path.join(bundle, "custom-server", d);
  const exists = fs.existsSync(p);
  console.log(`    ${exists ? "✓" : "✗"} custom-server/${d}`);
  if (!exists) missing.push(d);
}

console.log("\n  === 我的检测逻辑问题 ===");
console.log("  我的脚本只匹配了「显式 for(const name of [...]) 复制」与「目录级复制」，");
console.log("  但 build-bundles.mjs 第 49 行是：");
console.log("    for(const name of fs.readdirSync(path.join(root,'custom-server')).filter(name=>name.endsWith('.'");
console.log("  即「复制 custom-server 下所有 .mjs」—— 我的正则没匹配到这种动态复制。");

// 验证动态复制
const src = fs.readFileSync("scripts/build-bundles.mjs", "utf8");
const dynamicCopy = /readdirSync\(path\.join\(root,'custom-server'\)\)/.test(src);
console.log(`\n  存在动态复制 custom-server 下所有文件: ${dynamicCopy ? "✓ 是" : "✗ 否"}`);

console.log("\n  === 判定 ===");
if (missing.length === 0 && dynamicCopy) {
  console.log("  ✓ 发现 2 是误报 —— 我的正则未覆盖动态复制");
  console.log("     build-bundles.mjs 通过 readdirSync 复制所有 .mjs，依赖已覆盖");
} else if (missing.length > 0) {
  console.log(`  ⚠ 确实缺失 ${missing.length} 个文件: ${missing.join(", ")}`);
} else {
  console.log("  ✓ 依赖已覆盖");
}

console.log("\n  === 但发现一个真实的设计问题 ===");
console.log("  sync-server 模块在 import 时立即启动服务（顶层副作用）");
console.log("  证据：我的排查脚本仅 import 就启动了 8791 端口的服务");
console.log("");
console.log("  影响：");
console.log("    - 无法在不启动服务的情况下导入（测试困难）");
console.log("    - 无法在测试中隔离");
console.log("    - 意外 import 会产生副作用");
console.log("");
console.log("  严重性：低（生产入口是直接运行，不是 import）");
console.log("  建议：导出 start() 函数，仅在直接运行时启动");
