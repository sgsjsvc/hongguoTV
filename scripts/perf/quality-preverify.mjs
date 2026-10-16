// 端到端预验证：临时把 device_level 改为 5，确认 quality-diff 改善
// 做法：备份 → 改 → 测 → 还原（不留下改动，交给 agent 正式实施）
import fs from "node:fs";
import { fork } from "node:child_process";
import path from "node:path";

const FILE = "shared/content-core/hongguo.js";
const VENDOR1 = "custom-server/vendor/hongguo.cjs";
const VENDOR2 = "server/vendor/hongguo.cjs";

const backups = new Map();
for (const f of [FILE, VENDOR1, VENDOR2]) backups.set(f, fs.readFileSync(f, "utf8"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("=== 端到端预验证：device_level 3 -> 5 ===\n");

// 1. 改文件
let changed = 0;
for (const f of [FILE, VENDOR1, VENDOR2]) {
  const c = backups.get(f);
  const next = c.replace("device_level: 3,", "device_level: 5,");
  if (next !== c) { fs.writeFileSync(f, next, "utf8"); changed += 1; }
}
console.log(`  已临时修改 ${changed} 个文件\n`);

const out = path.resolve("outputs/testing/quality-preverify");
fs.mkdirSync(out, { recursive: true });
const log = fs.createWriteStream(path.join(out, "server.log"));

let child;
try {
  // 2. 启动服务
  child = fork(path.resolve("custom-server/index.mjs"), [], {
    env: { ...process.env, HG_PORT: "0", HG_HOST: "127.0.0.1", HG_DATA_DIR: path.join(out, "data"), HG_PREFETCH_ENABLED: "0" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  child.stdout.pipe(log); child.stderr.pipe(log);
  const port = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("timeout")), 30000);
    child.on("message", (m) => { if (m?.type === "ready") { clearTimeout(t); res(m.port); } });
    child.once("exit", (c) => { clearTimeout(t); rej(new Error("exit " + c)); });
  });
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`  服务端口: ${port}\n`);

  const get = async (url) => {
    const r = await fetch(BASE + url, { signal: AbortSignal.timeout(60000) });
    let j = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
  };

  // 3. 检查推荐流前 8 部
  const rec = await get("/api/recommend?page=1");
  const items = (rec.body?.items || []).slice(0, 8);

  console.log("  === 修复后：推荐流前 8 部清晰度 ===");
  let only1080 = 0, full = 0;
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const det = await get(`/api/series/${it.id}`);
    const ep = (det.body?.episodes || [])[0];
    if (!ep) continue;
    const q = await get(`/api/episodes/${ep.id}/qualities?seriesId=${it.id}`);
    const qualities = q.body?.qualities || [];
    const keys = qualities.map((x) => x.key).join("/");
    if (qualities.length === 1) only1080 += 1; else full += 1;
    console.log(`  ${String(i + 1).padStart(2)}  ${(it.title || "").slice(0, 24).padEnd(26)} ${keys}`);
  }

  console.log("\n  === 同剧不同集（修复前有 1 档的集）===");
  for (const it of items.slice(0, 4)) {
    const det = await get(`/api/series/${it.id}`);
    const eps = (det.body?.episodes || []).slice(0, 5);
    const line = [];
    for (const ep of eps) {
      const q = await get(`/api/episodes/${ep.id}/qualities?seriesId=${it.id}`);
      line.push(`${(q.body?.qualities || []).length}档`);
    }
    console.log(`  ${(it.title || "").slice(0, 22).padEnd(24)} 第1-5集: ${line.join(" / ")}`);
  }

  console.log("\n  === 汇总 ===");
  console.log(`  仅 1080P: ${only1080} 部    全部清晰度: ${full} 部`);
  console.log("");
  if (only1080 === 0) {
    console.log("  ✅ 修复完全生效：所有剧集都有完整清晰度");
  } else {
    console.log(`  ⚠️ 仍有 ${only1080} 部仅 1080P（可能是真的只有 bytevc2）`);
  }

  child.send({ type: "shutdown" });
  await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
} finally {
  if (child && child.exitCode === null) child.kill();
  log.end();
  // 4. 还原
  let restored = 0;
  for (const [f, c] of backups) {
    if (fs.readFileSync(f, "utf8") !== c) { fs.writeFileSync(f, c, "utf8"); restored += 1; }
  }
  console.log(`\n  已还原 ${restored} 个文件（工作区保持干净，交给 agent 正式实施）`);
}
