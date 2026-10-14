// 汇总所有打包产物到 release/，并生成校验文件与说明
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const release = path.join(root, "release");

// 只汇总最终交付物，排除中间产物（blockmap、unpacked、测试截图等）
const plan = [
  {
    group: "windows",
    title: "Windows 桌面端",
    source: path.join(root, "outputs", "windows"),
    include: (name) => /^红果短剧-.*\.(exe)$/.test(name) && !name.includes("__uninstaller"),
  },
  {
    group: "web",
    title: "Web 服务端（脚本启动）",
    source: path.join(root, "outputs", "bundles"),
    include: (name) => /^hongguotv-(web|sync)-.*\.(zip|tar\.gz)$/.test(name),
  },
  {
    group: "tv",
    title: "Android TV 客户端",
    source: path.join(root, "outputs", "tv-android"),
    include: (name) => /\.apk$/.test(name),
  },
];

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function human(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// 重建产物子目录（保持幂等），但保留 README.md 等说明文件
for (const sub of ["windows", "web", "tv"]) {
  fs.rmSync(path.join(release, sub), { recursive: true, force: true });
}
fs.mkdirSync(release, { recursive: true });

const manifest = [];
const sums = [];

for (const { group, title, source, include } of plan) {
  if (!fs.existsSync(source)) {
    console.warn(`  跳过（源目录不存在）: ${source}`);
    continue;
  }
  const dir = path.join(release, group);
  fs.mkdirSync(dir, { recursive: true });
  const files = fs.readdirSync(source).filter(include).sort();
  console.log(`\n${title} → release/${group}/`);
  for (const name of files) {
    const from = path.join(source, name);
    if (!fs.statSync(from).isFile()) continue;
    const to = path.join(dir, name);
    fs.copyFileSync(from, to);
    const size = fs.statSync(to).size;
    const hash = sha256(to);
    sums.push(`${hash}  ${group}/${name}`);
    manifest.push({ group, name, size, hash });
    console.log(`  ${name}  (${human(size)})`);
  }
}

// 校验文件
fs.writeFileSync(path.join(release, "SHA256SUMS.txt"), sums.join("\n") + "\n", "utf8");
console.log(`\n已生成 SHA256SUMS.txt（${sums.length} 个文件）`);

// 清单 JSON（便于自动化消费）
fs.writeFileSync(
  path.join(release, "manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
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
