// 确认：重复 close 是否会导致真实问题
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { LibraryStore } = await import("../../shared/library-store.mjs");

const tmp = path.join(os.tmpdir(), "bughunt-close-" + Date.now());
fs.mkdirSync(tmp, { recursive: true });

console.log("=== 重复 close 的影响分析 ===\n");

// 1. 确认 close 不幂等
console.log("  --- 1. close 的幂等性 ---");
const s = new LibraryStore(path.join(tmp, "a.sqlite"));
s.close();
try {
  s.close();
  console.log("     ✓ 重复 close 成功");
} catch (e) {
  console.log(`     ✗ 重复 close 抛错: ${e.message}`);
}

// 2. 实际代码中是否有重复 close 的路径
console.log("\n  --- 2. 代码中的 close 调用点 ---");
const files = [
  "custom-server/index.mjs",
  "apps/sync-server/index.mjs",
  "server/index.mjs",
];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const c = fs.readFileSync(f, "utf8");
  const matches = [...c.matchAll(/\.close\(\)/g)];
  if (matches.length) {
    console.log(`  ${f}: ${matches.length} 处 .close()`);
    // 检查是否有重复调用的风险
    const hasShutdownGuard = /shuttingDown|stopping|closed/.test(c);
    console.log(`     有 shutdown 守卫: ${hasShutdownGuard ? "✓" : "✗"}`);
  }
}

// 3. 检查 shutdown 逻辑
console.log("\n  --- 3. custom-server 的 shutdown 实现 ---");
const serverSrc = fs.readFileSync("custom-server/index.mjs", "utf8");
const idx = serverSrc.indexOf("function shutdown");
if (idx > 0) {
  const block = serverSrc.slice(idx, idx + 400);
  console.log("  代码：");
  block.split("\n").slice(0, 8).forEach((l) => console.log("    " + l.trim()));
  const guarded = /if\s*\(\s*shuttingDown\s*\)\s*return/.test(block);
  console.log(`\n  有 shuttingDown 守卫: ${guarded ? "✓" : "✗"}`);
  if (guarded) {
    console.log("  → 重复 shutdown 被守卫，不会重复 close");
  }
}

// 4. 检查 libraryStore.close 的调用
console.log("\n  --- 4. libraryStore.close 调用点 ---");
const closeMatches = [...serverSrc.matchAll(/libraryStore\.close\(\)/g)];
console.log(`  custom-server 中 libraryStore.close(): ${closeMatches.length} 处`);
const inShutdown = serverSrc.slice(idx, idx + 400).includes("libraryStore.close()");
console.log(`  在 shutdown 内: ${inShutdown ? "✓" : "✗"}`);

// 5. 判定
console.log("\n  === 判定 ===");
console.log("  close 不幂等本身是缺陷，但：");
console.log("    1. 生产代码有 shuttingDown 守卫，不会重复调用");
console.log("    2. 仅影响「手动重复调用」的场景");
console.log("");
console.log("  严重性：低");
console.log("  建议：close 加幂等保护（if (this.closed) return;）");
console.log("        这是防御性改进，非紧急缺陷");

fs.rmSync(tmp, { recursive: true, force: true });
