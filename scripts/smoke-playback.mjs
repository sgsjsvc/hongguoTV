// 发布前播放冒烟测试（门禁）
//
// 目的：在打包/发布之前，用真实上游验证「确实能播」。
// 背景：2026-10-15 事故中，代码与测试全绿，但三端都播不了——
//       因为没有任何环节真正去上游取过流。
//       本脚本把「能不能播」变成发布前的硬性检查。
//
// 判定：任一项失败 -> 退出码 1，阻止发布。
//
// 用法:
//   node scripts/smoke-playback.mjs              # 自动起服务并检查
//   BRIDGE_URL=http://127.0.0.1:8789 node ...    # 检查已运行的服务
//   SMOKE_SAMPLES=5 node ...                     # 增加样本数（默认 3）

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samples = Math.max(1, Number(process.env.SMOKE_SAMPLES || 3));
const external = Boolean(process.env.BRIDGE_URL);

const results = { at: new Date().toISOString(), samples, checks: [], pass: false };

function record(name, ok, note) {
  results.checks.push({ name, ok, note });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${note ? "  " + note : ""}`);
}

async function waitForHealth(base, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(base + "/health", { signal: AbortSignal.timeout(3000) });
      if (r.ok) return true;
    } catch { /* 继续等 */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  console.log("=== 播放冒烟测试（发布门禁）===\n");

  let base = process.env.BRIDGE_URL || "http://127.0.0.1:8788";
  let child = null;

  if (!external) {
    // 用一个不常见的端口，避免与开发中的实例冲突
    const port = Number(process.env.SMOKE_PORT || 8899);
    base = `http://127.0.0.1:${port}`;
    console.log(`  启动临时服务于 ${base} …`);
    child = spawn(process.execPath, [path.join(root, "custom-server", "index.mjs")], {
      cwd: root,
      env: { ...process.env, PORT: String(port), HG_HOST: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", () => {});
    child.stderr.on("data", () => {});
    const ready = await waitForHealth(base);
    if (!ready) {
      record("临时服务启动", false, `${base} 未就绪`);
      return finish(child);
    }
    record("临时服务启动", true, base);
  } else {
    console.log(`  使用已运行的服务: ${base}`);
  }

  // 1. 健康检查必须如实反映播放能力
  try {
    const h = await (await fetch(base + "/health", { signal: AbortSignal.timeout(10000) })).json();
    const p = h.playback || {};
    record("健康检查含 playback 段", Boolean(h.playback), p.stats ? JSON.stringify(p.stats) : "");
  } catch (e) {
    record("健康检查含 playback 段", false, e.message.slice(0, 60));
  }

  // 2. 取若干真实剧集，逐个验证 qualities 与 stream
  let items = [];
  try {
    // 推荐接口要求每个客户端携带私有 session（^[-_A-Za-z0-9]{16,128}$）。
    // 冒烟测试是合成客户端，必须自造合法 session，否则服务端按无效会话返回 400。
    const session = randomUUID().replace(/-/g, "");
    const rec = await (await fetch(base + "/api/recommend?page=1&session=" + session, { signal: AbortSignal.timeout(60000) })).json();
    items = (rec.items || []).slice(0, samples);
    record("推荐接口", items.length > 0, `${items.length} 条`);
  } catch (e) {
    record("推荐接口", false, e.message.slice(0, 60));
    return finish(child);
  }

  let qualitiesOk = 0;
  let streamOk = 0;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const title = String(item.title || "").slice(0, 14);
    let ep = null;
    try {
      const det = await (await fetch(`${base}/api/series/${item.id}`, { signal: AbortSignal.timeout(60000) })).json();
      ep = (det.episodes || [])[0];
    } catch { /* 下面统一记失败 */ }

    if (!ep) {
      record(`样本${i + 1} ${title} 详情`, false, "无剧集");
      continue;
    }

    // qualities：这是「上游是否静默降级」的第一道真实信号
    try {
      const q = await (await fetch(
        `${base}/api/episodes/${ep.id}/qualities?seriesId=${item.id}`,
        { signal: AbortSignal.timeout(60000) }
      )).json();
      const n = (q.qualities || []).length;
      if (n > 0) {
        qualitiesOk += 1;
        record(`样本${i + 1} ${title} 清晰度`, true, `${n} 个，默认 ${q.defaultQuality}`);
      } else {
        record(`样本${i + 1} ${title} 清晰度`, false, `${q.code || "无清晰度"} ${q.error || ""}`);
      }
    } catch (e) {
      record(`样本${i + 1} ${title} 清晰度`, false, e.message.slice(0, 50));
    }

    // stream：真正取一段 MP4 并校验文件头
    try {
      const res = await fetch(
        `${base}/api/episodes/${ep.id}/stream?quality=720P&seriesId=${item.id}`,
        { headers: { Range: "bytes=0-65535" }, signal: AbortSignal.timeout(120000) }
      );
      const buf = Buffer.from(await res.arrayBuffer());
      const ftyp = buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp";
      if (res.status === 206 && buf.length === 65536 && ftyp) {
        streamOk += 1;
        record(`样本${i + 1} ${title} 取流`, true, `HTTP 206 / 65536B / ftyp`);
      } else {
        record(`样本${i + 1} ${title} 取流`, false, `HTTP ${res.status} / ${buf.length}B / ftyp=${ftyp}`);
      }
    } catch (e) {
      record(`样本${i + 1} ${title} 取流`, false, e.message.slice(0, 50));
    }
  }

  // 3. 汇总：要求全部样本都通过，避免「偶尔能播」被当作可用
  record("清晰度全部通过", qualitiesOk === items.length, `${qualitiesOk}/${items.length}`);
  record("取流全部通过", streamOk === items.length, `${streamOk}/${items.length}`);

  // 4. 收尾：健康检查应显示上游健康
  try {
    const h = await (await fetch(base + "/health", { signal: AbortSignal.timeout(10000) })).json();
    const healthy = h.playback?.upstreamHealthy === true;
    record("健康检查报告上游健康", healthy, JSON.stringify(h.playback?.stats || {}));
  } catch (e) {
    record("健康检查报告上游健康", false, e.message.slice(0, 50));
  }

  return finish(child);
}

function finish(child) {
  results.pass = results.checks.length > 0 && results.checks.every((c) => c.ok);
  console.log("\n  === 结论 ===");
  console.log(`  ${results.pass ? "✓ 播放冒烟测试通过" : "✗ 播放冒烟测试失败，不应发布"}`);
  fs.mkdirSync(path.join(root, "outputs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "outputs", "smoke-playback.json"),
    JSON.stringify(results, null, 2) + "\n"
  );
  console.log(`  报告: outputs/smoke-playback.json`);
  if (child) {
    try { child.kill(); } catch { /* 已退出 */ }
  }
  if (!results.pass) process.exitCode = 1;
}

main().catch((e) => {
  console.error("冒烟测试异常:", e.message);
  process.exitCode = 1;
});
