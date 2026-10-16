// 汇总所有打包产物到 release/ 根目录（扁平结构），统一命名并生成校验文件。
//
// 命名规则（用户要求，2026-10-16 起生效）：
//   hongguotv-web-<平台>-<架构>.<zip|tar.gz>        例 hongguotv-web-win-x64.zip
//   hongguotv-desktop-win-<架构>-<形态>.exe          例 hongguotv-desktop-win-x64-setup.exe
//   hongguotv-tv-android5.1-<类型>.apk               例 hongguotv-tv-android5.1-release.apk
//   hongguotv-sync-<平台>-<架构>.tar.gz              例 hongguotv-sync-linux-x64.tar.gz
//
// 说明：
//   - 不再创建 windows/ web/ tv/ 子目录，全部平铺在 release/ 下
//   - 重命名只发生在 release/ 内，构建产物与源码保持原名
//   - 保留 release/ 下的说明文档（*.md），其余文件每次重建

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const release = path.join(root, "release");

// ---------- 命名映射 ----------

// Windows：红果短剧-1.0.0-x64-setup.exe -> hongguotv-desktop-win-x64-setup.exe
// 无架构后缀的为双架构通用版，标记为 universal
function renameWindows(name) {
  const m = /^红果短剧-[\d.]+-(?:(x64|arm64)-)?(setup|portable)\.exe$/.exec(name);
  if (!m) return null;
  const arch = m[1] || "universal";
  const form = m[2];
  return `hongguotv-desktop-win-${arch}-${form}.exe`;
}

// TV：hongguotv-android5.1-release-signed.apk -> hongguotv-tv-android5.1-release.apk
function renameTv(name) {
  if (!/\.apk$/.test(name)) return null;
  if (/release-signed/.test(name)) return "hongguotv-tv-android5.1-release.apk";
  if (/release-unsigned/.test(name)) return null; // 已有签名版，跳过未签名版
  if (/debug/.test(name)) return "hongguotv-tv-android5.1-debug.apk";
  return null;
}

// Web / sync：命名已符合规则，仅排除测试与中间产物
function keepWeb(name) {
  return /^hongguotv-(web|sync)-[a-z0-9]+-(x64|arm64)\.(zip|tar\.gz)$/.test(name);
}

const plan = [
  {
    title: "Windows 桌面端",
    source: path.join(root, "outputs", "windows"),
    rename: renameWindows,
  },
  {
    title: "Web 服务端",
    source: path.join(root, "outputs", "bundles"),
    rename: (name) => (keepWeb(name) ? name : null),
  },
  {
    title: "Android TV 客户端",
    source: path.join(root, "outputs", "tv-android"),
    rename: renameTv,
  },
];

// ---------- 工具 ----------

const sha256 = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const human = (b) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB`
  : b >= 1024 ? `${(b / 1024).toFixed(1)} KB`
  : `${b} B`;

// ---------- 清理：移除旧结构（子目录与旧产物），保留说明文档 ----------

fs.mkdirSync(release, { recursive: true });

// 旧的分类子目录（windows/ web/ tv/）整体删除
for (const sub of ["windows", "web", "tv"]) {
  const dir = path.join(release, sub);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  移除旧子目录: release/${sub}/`);
  }
}

// 根目录下的旧产物与派生文件（保留 *.md 说明文档）
const KEEP = /\.md$/i;
for (const name of fs.readdirSync(release)) {
  const full = path.join(release, name);
  if (fs.statSync(full).isDirectory()) {
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`  移除残留目录: release/${name}/`);
    continue;
  }
  if (KEEP.test(name)) continue;
  fs.rmSync(full, { force: true });
}

// ---------- 收集 ----------

const manifest = [];
const sums = [];

for (const { title, source, rename } of plan) {
  if (!fs.existsSync(source)) {
    console.warn(`  跳过（源目录不存在）: ${source}`);
    continue;
  }
  console.log(`\n${title}`);
  const files = fs.readdirSync(source).filter((n) => fs.statSync(path.join(source, n)).isFile()).sort();
  let count = 0;
  for (const name of files) {
    const target = rename(name);
    if (!target) continue;
    const from = path.join(source, name);
    const to = path.join(release, target);
    if (fs.existsSync(to)) {
      console.warn(`    ⚠ 目标已存在，跳过: ${target}`);
      continue;
    }
    fs.copyFileSync(from, to);
    const size = fs.statSync(to).size;
    const hash = sha256(to);
    sums.push(`${hash}  ${target}`);
    manifest.push({ name: target, source: name, size, hash });
    console.log(`    ${name}\n      -> ${target}  (${human(size)})`);
    count += 1;
  }
  if (!count) console.log("    （无可收集文件）");
}

// ---------- 校验与清单 ----------

sums.sort();
fs.writeFileSync(path.join(release, "SHA256SUMS.txt"), sums.join("\n") + "\n", "utf8");
console.log(`\n已生成 SHA256SUMS.txt（${sums.length} 个文件）`);

fs.writeFileSync(
  path.join(release, "manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      layout: "flat",
      naming: {
        web: "hongguotv-web-<platform>-<arch>.<zip|tar.gz>",
        desktop: "hongguotv-desktop-win-<arch>-<form>.exe",
        tv: "hongguotv-tv-android5.1-<type>.apk",
        sync: "hongguotv-sync-<platform>-<arch>.tar.gz",
      },
      totalFiles: manifest.length,
      totalBytes: manifest.reduce((n, m) => n + m.size, 0),
      files: manifest,
    },
    null,
    2
  ) + "\n",
  "utf8"
);

const totalBytes = manifest.reduce((n, m) => n + m.size, 0);
console.log(`合计 ${manifest.length} 个文件，${human(totalBytes)}`);
