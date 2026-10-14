// 各 agent 的可编程适配器。
// 设计原则：所有动态参数（端口、token、project id）运行时自动发现，绝不硬编码。
import { execFile, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();

// ---------- 通用 ----------

function run(cmd, args, { timeout = 300000, env = {}, closeStdin = false } = {}) {
  return new Promise((resolve) => {
    // .bat/.cmd 在 Windows 上必须经 shell 执行，否则 spawn 报 EINVAL。
    const needsShell = /\.(bat|cmd)$/i.test(cmd);
    const child = execFile(
      cmd,
      args,
      {
        timeout,
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, ...env },
        windowsHide: true,
        shell: needsShell,
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error?.code ?? 0,
          killed: error?.killed ?? false,
          signal: error?.signal ?? null,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          error: error?.message ?? "",
        });
      }
    );
    // codex exec 从 stdin 读补充输入；不关闭会一直等 EOF 直到超时。
    if (closeStdin) child.stdin?.end();
  });
}

function firstExisting(candidates) {
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  return null;
}

// ---------- Codex (ChatGPT) ----------

export const codex = {
  name: "codex",
  label: "ChatGPT / Codex",

  locate() {
    const base = path.join(HOME, "AppData", "Local", "OpenAI", "Codex", "bin");
    if (!fs.existsSync(base)) return null;
    for (const dir of fs.readdirSync(base)) {
      const exe = path.join(base, dir, "codex.exe");
      if (fs.existsSync(exe)) return exe;
    }
    return null;
  },

  async available() {
    const exe = this.locate();
    if (!exe) return { ok: false, reason: "codex.exe not found" };
    const r = await run(exe, ["--version"], { timeout: 30000 });
    return r.ok
      ? { ok: true, version: (r.stdout + r.stderr).trim(), exe }
      : { ok: false, reason: r.error, exe };
  },

  async exec(prompt, { timeout = 900000 } = {}) {
    const exe = this.locate();
    if (!exe) throw new Error("codex.exe not found");
    const r = await run(exe, ["exec", "--skip-git-repo-check", prompt], { timeout, closeStdin: true });
    return {
      ok: r.ok,
      text: r.stdout.trim(),
      stderr: r.stderr.trim(),
      code: r.code,
      killed: r.killed,
      error: r.error,
    };
  },
};

// ---------- Antigravity ----------

export const antigravity = {
  name: "antigravity",
  label: "Antigravity",

  // 动态发现 LS 地址 / CSRF / project id。Antigravity 重启后这些都会变。
  discover() {
    const result = { address: null, csrf: null, projectId: null, api: null, errors: [] };

    result.api = firstExisting([
      path.join(HOME, ".gemini", "antigravity", "bin", "agentapi.bat"),
      path.join(HOME, ".gemini", "antigravity-ide", "bin", "agentapi.bat"),
    ]);
    if (!result.api) result.errors.push("agentapi.bat not found");

    // 从 language_server 进程取 csrf 与监听端口。
    // gRPC 是较小的端口；较大的是 HTTPS，会对 gRPC 报 server preface 错误。
    let lsPid = null;
    try {
      const out = execSync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'language_server.exe\'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"',
        { encoding: "utf8", timeout: 30000 }
      );
      const parsed = JSON.parse(out.trim() || "[]");
      for (const p of Array.isArray(parsed) ? parsed : [parsed]) {
        const m = /--csrf_token\s+(\S+)/.exec(p.CommandLine || "");
        if (m) {
          result.csrf = m[1];
          lsPid = p.ProcessId;
          break;
        }
      }
    } catch (e) {
      result.errors.push("read language_server failed: " + e.message);
    }

    if (lsPid) {
      try {
        const out = execSync(
          'powershell -NoProfile -Command "Get-NetTCPConnection -State Listen | Where-Object { $_.OwningProcess -eq ' +
            lsPid +
            ' } | Select-Object -ExpandProperty LocalPort"',
          { encoding: "utf8", timeout: 30000 }
        );
        result.ports = out
          .split(/\r?\n/)
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n > 0)
          .sort((a, b) => a - b);
        // 不靠端口大小猜测：2729 是 HTTPS、2730 是 gRPC，顺序不保证。
        // 由 probe() 实测决定，这里只保留候选。
        if (result.ports.length) result.address = "127.0.0.1:" + result.ports[0];
      } catch (e) {
        result.errors.push("read listen ports failed: " + e.message);
      }
    }

    try {
      const storage = path.join(HOME, "AppData", "Roaming", "Antigravity", "app_storage.json");
      if (fs.existsSync(storage)) {
        const m = /"lastCreatedProjectId"\s*:\s*"([^"]+)"/.exec(fs.readFileSync(storage, "utf8"));
        if (m) result.projectId = m[1];
      }
    } catch (e) {
      result.errors.push("read project id failed: " + e.message);
    }

    return result;
  },

  async available() {
    const d = this.discover();
    const ok = Boolean(d.api && d.address && d.csrf);
    return {
      ok,
      api: d.api,
      address: d.address,
      csrf: d.csrf ? d.csrf.slice(0, 8) + "..." : null,
      projectId: d.projectId,
      reason: ok ? null : d.errors.join("; ") || "missing api/address/csrf",
    };
  },

  env() {
    const d = this.discover();
    if (!d.api || !d.address || !d.csrf) throw new Error("Antigravity params incomplete: " + d.errors.join("; "));
    return {
      ANTIGRAVITY_LS_ADDRESS: d.address,
      ANTIGRAVITY_CSRF_TOKEN: d.csrf,
      ...(d.projectId ? { ANTIGRAVITY_PROJECT_ID: d.projectId } : {}),
    };
  },

  // 实测每个候选端口，返回第一个能接受 gRPC 调用的地址。
  // 缓存结果，避免每次调用都探测（Antigravity 重启后端口会变，故带 TTL）。
  _probeCache: { at: 0, address: null, pid: null },

  async probe({ force = false, timeout = 60000 } = {}) {
    const d = this.discover();
    if (!d.api || !d.csrf) throw new Error("Antigravity params incomplete: " + d.errors.join("; "));
    const ports = d.ports?.length ? d.ports : d.address ? [Number(d.address.split(":")[1])] : [];
    if (!ports.length) throw new Error("no candidate ports for Antigravity");

    const cache = this._probeCache;
    const fresh = Date.now() - cache.at < 120000 && cache.address && ports.includes(Number(cache.address.split(":")[1]));
    if (fresh && !force) return cache.address;

    // 逐个端口试一次最小调用，谁不报传输层错误谁就是 gRPC。
    for (const port of ports) {
      const address = "127.0.0.1:" + port;
      const r = await run(
        d.api,
        ["get-conversation-metadata", "00000000-0000-0000-0000-000000000000"],
        {
          timeout,
          env: {
            ANTIGRAVITY_LS_ADDRESS: address,
            ANTIGRAVITY_CSRF_TOKEN: d.csrf,
            ...(d.projectId ? { ANTIGRAVITY_PROJECT_ID: d.projectId } : {}),
          },
        }
      );
      const blob = r.stdout + r.stderr;
      // HTTPS 端口会回 "server preface" / "forcibly closed"；gRPC 端口回业务错误（找不到会话等）。
      const transportFailure = /server preface|forcibly closed|connection refused|Unavailable/i.test(blob);
      if (!transportFailure) {
        cache.at = Date.now();
        cache.address = address;
        return address;
      }
    }
    throw new Error("no working gRPC port among: " + ports.join(", "));
  },

  // 启动新会话，返回 conversationId（异步，需再轮询元数据取结果）。
  async start(prompt, { model = "flash_lite", title = "", timeout = 180000 } = {}) {
    const d = this.discover();
    const address = await this.probe();
    const args = ["new-conversation", "--model=" + model];
    if (title) args.push("--title=" + title);
    args.push(prompt);
    const r = await run(d.api, args, {
      timeout,
      env: {
        ANTIGRAVITY_LS_ADDRESS: address,
        ANTIGRAVITY_CSRF_TOKEN: d.csrf,
        ...(d.projectId ? { ANTIGRAVITY_PROJECT_ID: d.projectId } : {}),
      },
    });
    let parsed = null;
    try {
      parsed = JSON.parse(r.stdout.trim());
    } catch {}
    const id = parsed?.response?.newConversation?.conversationId ?? null;
    return { ok: Boolean(id), conversationId: id, raw: r.stdout.trim(), stderr: r.stderr.trim(), parsed, address };
  },

  async metadata(conversationId, { timeout = 120000 } = {}) {
    const d = this.discover();
    const address = await this.probe();
    const r = await run(d.api, ["get-conversation-metadata", conversationId], {
      timeout,
      env: {
        ANTIGRAVITY_LS_ADDRESS: address,
        ANTIGRAVITY_CSRF_TOKEN: d.csrf,
        ...(d.projectId ? { ANTIGRAVITY_PROJECT_ID: d.projectId } : {}),
      },
    });
    return { ok: r.ok, raw: r.stdout.trim(), stderr: r.stderr.trim() };
  },

  // 读取会话的实际回复。
  // get-conversation-metadata 只给元数据；真正的对话落在
  // brain/<cid>/.system_generated/logs/transcript.jsonl，
  // 其中 source=MODEL 且带 content 的行才是模型回复。
  transcriptPath(conversationId) {
    return path.join(
      HOME,
      ".gemini",
      "antigravity",
      "brain",
      conversationId,
      ".system_generated",
      "logs",
      "transcript.jsonl"
    );
  },

  async readReply(conversationId, { waitMs = 0, pollMs = 2000 } = {}) {
    const file = this.transcriptPath(conversationId);
    const deadline = Date.now() + waitMs;

    const parse = () => {
      if (!fs.existsSync(file)) return null;
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
      const entries = [];
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {}
      }
      // 取最后一条带 content 的模型消息作为最终答复。
      const replies = entries.filter((e) => e.source === "MODEL" && typeof e.content === "string" && e.content.trim());
      const last = replies[replies.length - 1];
      const running = entries.some((e) => e.status === "RUNNING" || e.status === "IN_PROGRESS");
      return {
        ok: true,
        file,
        steps: entries.length,
        running,
        text: last?.content ?? "",
        toolCalls: entries.flatMap((e) => e.tool_calls ?? []).map((t) => t.name),
      };
    };

    let result = parse();
    while (waitMs > 0 && Date.now() < deadline) {
      if (result && result.text && !result.running) break;
      await new Promise((r) => setTimeout(r, pollMs));
      result = parse();
    }
    return result ?? { ok: false, reason: "transcript not found", file };
  },
};

// ---------- WorkBuddy ----------
// 闭源 Electron 应用，IPC 是私有协议（命名管道 + 动态 ticket）。
// 因此不走 IPC：WorkBuddy 通过文件总线协作 —— 它自己的 memory/ 目录就是写入点。

export const workbuddy = {
  name: "workbuddy",
  label: "WorkBuddy AI",

  async available() {
    const appDir = path.join(HOME, ".workbuddy-ai");
    if (!fs.existsSync(appDir)) return { ok: false, reason: ".workbuddy-ai not found" };

    let running = false;
    try {
      const out = execSync(
        'powershell -NoProfile -Command "(Get-Process -Name WorkBuddyAI -ErrorAction SilentlyContinue | Measure-Object).Count"',
        { encoding: "utf8", timeout: 20000 }
      );
      running = Number(out.trim()) > 0;
    } catch {}

    let endpoint = null;
    try {
      const ep = path.join(appDir, "wbipc", "endpoint.json");
      if (fs.existsSync(ep)) endpoint = JSON.parse(fs.readFileSync(ep, "utf8")).endpoint ?? null;
    } catch {}

    return { ok: true, running, endpoint, mode: "file-bus", appDir };
  },
};

export const adapters = { codex, antigravity, workbuddy };
export default adapters;
