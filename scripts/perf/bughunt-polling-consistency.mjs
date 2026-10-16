// 验证 Bug #3：App.tsx 的追剧页轮询缺 isVideoPlaying 检查
import fs from "node:fs";

console.log("=== App.tsx 追剧页轮询分析 ===\n");

const appSrc = fs.readFileSync("apps/web-pc/src/App.tsx", "utf8");
const apiSrc = fs.readFileSync("apps/web-pc/src/api.ts", "utf8");

// 提取 App.tsx 的 favorites 轮询
const idx = appSrc.indexOf('tab !== "favorites"');
const block = appSrc.slice(idx, idx + 400);
console.log("  App.tsx 的追剧页轮询：");
block.split("\n").slice(0, 10).forEach((l) => console.log("    " + l.trim()));

const hasHidden = block.includes("document.hidden");
const hasVideoCheck = block.includes("isVideoPlaying") || block.includes("querySelectorAll('video')") || block.includes('querySelectorAll("video")');
const interval = /(\d+)\)/.exec(block)?.[1];

console.log("\n  检查项：");
console.log(`    有 document.hidden 检查: ${hasHidden ? "✓" : "✗"}`);
console.log(`    有 isVideoPlaying 检查: ${hasVideoCheck ? "✓" : "✗"}`);
console.log(`    间隔: ${interval ? interval + "ms" : "?"}`);

console.log("\n  === api.ts 的对照实现 ===");
const apiHasVideo = apiSrc.includes("isVideoPlaying");
console.log(`    api.ts 有 isVideoPlaying 函数: ${apiHasVideo ? "✓" : "✗"}`);

console.log("\n  === 判定 ===");
if (hasHidden && !hasVideoCheck && apiHasVideo) {
  console.log("  ⚠ Bug #3：两处轮询实现不一致");
  console.log("");
  console.log("    api.ts（主轮询）:    有 document.hidden + isVideoPlaying 检查");
  console.log("    App.tsx（追剧页）:   有 document.hidden，但缺 isVideoPlaying");
  console.log("");
  console.log("    影响场景：");
  console.log("      用户停留在追剧页并播放视频 -> 每 10 秒仍会 refreshHistory");
  console.log("      而 api.ts 的轮询在播放时完全跳过");
  console.log("");
  console.log("    严重性：低");
  console.log("      - 间隔 10 秒（非 1 秒），影响有限");
  console.log("      - 但违背了「播放时不争用」的设计意图");
  console.log("      - 且两处实现不一致，维护性差");
  console.log("");
  console.log("    修复建议：");
  console.log("      1. 把 isVideoPlaying 提取为共享工具函数");
  console.log("      2. App.tsx 复用该函数");
  console.log("      3. 或让追剧页也走 api.ts 的统一轮询");
} else {
  console.log("  ✓ 无此问题");
}

// 检查是否还有其他 setInterval
console.log("\n  === 全仓库的 setInterval 排查 ===");
const files = [
  "apps/web-pc/src/App.tsx",
  "apps/web-pc/src/api.ts",
  "apps/web-pc/src/hooks/useLibrary.ts",
  "apps/web-pc/src/hooks/usePlayback.ts",
  "apps/web-pc/src/hooks/useStreamFeed.ts",
];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const c = fs.readFileSync(f, "utf8");
  const matches = [...c.matchAll(/setInterval\s*\(([^,]+),\s*(\d+)\)/g)];
  if (matches.length) {
    console.log(`  ${f}:`);
    for (const m of matches) {
      const interval = Number(m[2]);
      const flag = interval <= 2000 ? "  ⚠ 高频" : "";
      console.log(`    间隔 ${interval}ms${flag}`);
    }
  }
}
