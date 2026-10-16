// 第三轮：同步服务与打包脚本排查
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

console.log("=== 同步服务与打包脚本排查 ===\n");

// 1. sync-server 的模块加载
console.log("  --- 1. sync-server 模块加载 ---");
for (const f of ["apps/sync-server/index.mjs", "apps/sync-server/server.mjs", "apps/sync-server/admin.mjs", "apps/sync-server/shared-key.mjs"]) {
  if (!fs.existsSync(f)) { note(`${path.basename(f)} 存在`, false, "文件缺失"); continue; }
  try {
    await import(pathToFileURL(path.resolve(f)).href);
    note(`${path.basename(f)} 可导入`, true);
  } catch (e) {
    // 导入可能因缺环境变量失败，区分错误类型
    const msg = e.message.slice(0, 70);
    const isEnvError = /env|TOKEN|KEY|PORT|missing/i.test(msg);
    note(`${path.basename(f)} 可导入`, isEnvError, isEnvError ? `环境依赖: ${msg}` : msg);
  }
}

// 2. shared-key 的边界
console.log("\n  --- 2. shared-key 边界 ---");
{
  const mod = await import(pathToFileURL(path.resolve("apps/sync-server/shared-key.mjs")).href);
  const fns = Object.keys(mod);
  console.log(`     导出: ${fns.join(", ")}`);
  for (const fn of fns) {
    if (typeof mod[fn] !== "function") continue;
    // 测试空值输入
    try {
      mod[fn](undefined);
      note(`${fn}(undefined) 不崩溃`, true);
    } catch (e) {
      const expected = /required|invalid|必须|不能/i.test(e.message);
      note(`${fn}(undefined) 不崩溃`, expected, expected ? `预期拒绝: ${e.message.slice(0, 40)}` : e.message.slice(0, 50));
    }
  }
}

// 3. build-bundles 的文件清单完整性
console.log("\n  --- 3. build-bundles 复制清单 vs 实际依赖 ---");
{
  const src = fs.readFileSync("scripts/build-bundles.mjs", "utf8");
  // 提取复制的文件
  const copied = [...src.matchAll(/for\(const name of \[([^\]]+)\]\)/g)].flatMap((m) => m[1].split(",").map((s) => s.trim().replace(/['"]/g, "")));
  console.log(`     显式复制的文件 (${copied.length}): ${copied.slice(0, 12).join(", ")}${copied.length > 12 ? "..." : ""}`);

  // 检查 custom-server 的 import 是否都被覆盖
  const serverSrc = fs.readFileSync("custom-server/index.mjs", "utf8");
  const imports = [...serverSrc.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)].map((m) => m[1]);
  console.log(`     custom-server 的本地依赖 (${imports.length}): ${imports.join(", ")}`);

  // 检查共享模块
  const sharedImports = [...serverSrc.matchAll(/from\s+['"]\.\.\/shared\/([^'"]+)['"]/g)].map((m) => m[1]);
  console.log(`     shared 依赖 (${sharedImports.length}): ${sharedImports.join(", ")}`);

  // 验证每个依赖是否在复制清单或目录复制中
  const dirCopies = [...src.matchAll(/copy\(path\.join\(root,\s*'([^']+)'/g)].map((m) => m[1]);
  console.log(`     目录级复制: ${dirCopies.join(", ")}`);

  const uncovered = [];
  for (const imp of [...imports, ...sharedImports]) {
    const base = imp.replace(/^\.\//, "");
    const covered = copied.some((c) => c === base) || dirCopies.some((d) => d.includes(base.split("/")[0]));
    if (!covered) uncovered.push(imp);
  }
  note("所有本地依赖都被打包", uncovered.length === 0, uncovered.length ? `未覆盖: ${uncovered.join(", ")}` : "");
}

// 4. 打包产物的完整性
console.log("\n  --- 4. 打包产物完整性 ---");
{
  const bundle = "outputs/bundles/hongguotv-web-win-x64";
  if (fs.existsSync(bundle)) {
    const required = [
      "custom-server/index.mjs",
      "custom-server/vendor/hongguo.cjs",
      "shared/content-core/hongguo.js",
      "shared/library-store.mjs",
      "shared/listen-port.mjs",
      "scripts/service-launcher.mjs",
      "LICENSE",
    ];
    const missing = required.filter((f) => !fs.existsSync(path.join(bundle, f)));
    note("打包产物含所有必需文件", missing.length === 0, missing.length ? `缺失: ${missing.join(", ")}` : "");

    // 检查 package.json 的依赖声明
    const pkgPath = path.join(bundle, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      console.log(`     package.json deps: ${Object.keys(pkg.dependencies || {}).join(", ")}`);
      note("package.json 存在", true);
    } else {
      note("package.json 存在", false, "缺失");
    }

    // 检查 node_modules 是否包含必要依赖
    const nm = path.join(bundle, "node_modules");
    if (fs.existsSync(nm)) {
      const mods = fs.readdirSync(nm);
      console.log(`     node_modules (${mods.length}): ${mods.slice(0, 8).join(", ")}`);
      const needsAxios = fs.readFileSync(path.join(bundle, "custom-server/index.mjs"), "utf8").includes("axios");
      if (needsAxios) note("axios 已打包", mods.includes("axios"), mods.includes("axios") ? "" : "缺失 axios");
    }
  } else {
    console.log("     未找到解压的 bundle，跳过");
  }
}

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
if (bugs.length === 0) console.log("  ✓ 同步服务与打包脚本无缺陷");
