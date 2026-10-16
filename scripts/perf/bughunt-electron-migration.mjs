// 验证：全新安装时 Electron 的迁移调用是否会失败
import { fork } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const out = path.resolve("outputs/testing/bughunt-electron-migration");
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = fs.createWriteStream(path.join(out, "server.log"));
const child = fork(path.resolve("custom-server/index.mjs"), [], {
  env: { ...process.env, HG_PORT: "0", HG_HOST: "127.0.0.1", HG_DATA_DIR: path.join(out, "data") },
  stdio: ["ignore", "pipe", "pipe", "ipc"],
});
child.stdout.pipe(log); child.stderr.pipe(log);
const port = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("timeout")), 30000);
  child.on("message", (m) => { if (m?.type === "ready") { clearTimeout(t); res(m.port); } });
  child.once("exit", (c) => { clearTimeout(t); rej(new Error("exit " + c)); });
});
const BASE = `http://127.0.0.1:${port}`;
console.log(`=== Electron 全新安装迁移路径验证 (${BASE}) ===\n`);

const post = async (url, body) => {
  const r = await fetch(BASE + url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j, ok: r.ok };
};

// 复现 main.cjs:72 的调用
console.log("  --- main.cjs:72 的调用（全新安装，snapshot 为空对象）---");
const { legacyOperations } = await import("../../shared/legacy-migration.mjs");
const snapshot = {};  // 全新安装：localStorage 为空
const operations = legacyOperations(snapshot);
console.log(`     legacyOperations({}) = ${JSON.stringify(operations)}`);

const r = await post("/api/library/import", { migrationId: "desktop-file-origin-v1", operations });
console.log(`     POST /api/library/import -> HTTP ${r.status}`);
console.log(`     响应: ${JSON.stringify(r.body).slice(0, 120)}`);

console.log("\n  --- main.cjs:73 的判断 ---");
console.log(`     if(!response.ok) throw Error('旧桌面数据迁移未成功，已保留原数据')`);
if (!r.ok) {
  console.log(`     ⚠ response.ok = false -> 会抛错`);
  console.log(`     -> catch 分支 -> dialog.showErrorBox('启动失败') -> app.quit()`);
  console.log("");
  console.log("  === 这是严重缺陷 ===");
  console.log("  全新安装（无旧数据）时：");
  console.log("    1. localStorage 为空 -> legacyOperations 返回 []");
  console.log("    2. POST /api/library/import 带空数组 -> 返回 400");
  console.log("    3. main.cjs:73 判断 !response.ok -> 抛错");
  console.log("    4. 被 whenReady 的 catch 捕获 -> 显示错误框 -> app.quit()");
  console.log("");
  console.log("  结果：全新安装的桌面版无法启动！");
} else {
  console.log(`     ✓ response.ok = true -> 不抛错，正常启动`);
  console.log("");
  console.log("  判定：空数组被接受，无缺陷");
}

// 对照：带数据的调用
console.log("\n  --- 对照：有旧数据时 ---");
const withData = { hg_pref_quality: "1080P", hg_favorites_v1: JSON.stringify([{ id: "1", title: "t" }]) };
const ops2 = legacyOperations(withData);
console.log(`     legacyOperations(有数据) = ${ops2.length} 个操作`);
const r2 = await post("/api/library/import", { migrationId: "desktop-file-origin-v1", operations: ops2 });
console.log(`     POST -> HTTP ${r2.status}  ok=${r2.ok}`);

child.send({ type: "shutdown" });
await Promise.race([new Promise((r) => child.once("exit", r)), sleep(6000)]);
if (child.exitCode === null) child.kill();
log.end();
