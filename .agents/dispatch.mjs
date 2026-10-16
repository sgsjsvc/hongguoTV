// 任务派发器（2026-10-16 六领域版，DSH 同步）
//
//   node .agents/cli.mjs route <文件...>       这些文件该给谁
//   node .agents/cli.mjs board                 身份 × 负载 × 冲突 一览
//   node .agents/cli.mjs plan                  当前待办的并行执行计划
//
// 核心用法（在写任务前先跑一次）：
//   import { routeFiles, clashWith, plan } from "./dispatch.mjs";
//   const r = routeFiles(["apps/web-pc/src/App.tsx"]);
//   r.primary  -> 主责身份
//   r.reviews  -> 应评审身份（跨领域影响）
//   r.clash    -> 与现有未完成任务的冲突
//
// 变更（相对旧版）：旧版按「18 岗位」路由，把 TV 与 Electron 都算到 workbuddy 名下，
// 并对 tests 根目录下的 *.test.mjs 匹配失败。本版按 RESPONSIBILITIES.md 的六身份路由，
// glob 翻译同时支持 ** 与 *（见 team.mjs globToRegExp）。

import { TEAM, byId, resolveRole, matchScope, globOverlapPair, backends } from "./team.mjs";
import * as bus from "./bus.mjs";

const norm = (s) => String(s).replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/+$/, "");

// 该文件归属哪些身份（可能多个 -> 需 DSH 指定主责）
export function routeFiles(files) {
  const list = (files || []).map(norm).filter(Boolean);
  const owners = [];
  for (const role of TEAM) {
    const hits = role.fileScope.filter((scope) => list.some((f) => matchScope(scope, f)));
    if (hits.length) owners.push({ role, hits });
  }
  owners.sort((a, b) => b.hits.length - a.hits.length);
  const primary = owners[0]?.role ?? null;
  return {
    primary,
    all: owners.map((o) => o.role),
    // 其余涉及方作为「应评审/应知会」，排除主责自身
    reviews: owners.filter((o) => o.role.id !== primary?.id).map((o) => o.role),
    unmatched: list.filter((f) => !owners.some((o) => o.hits.some((h) => matchScope(h, f)))),
  };
}

function scopeOf(assignee) {
  return resolveRole(assignee)?.fileScope ?? [];
}

// 当前是否有未完成任务与这些文件冲突
export function clashWith(files) {
  const list = (files || []).map(norm).filter(Boolean);
  const pending = bus.listTasks().filter((t) => ["pending", "claimed"].includes(t.status));
  const out = [];
  for (const t of pending) {
    const role = resolveRole(t.assignee);
    if (!role) continue;
    const hit = role.fileScope.some((s) => list.some((f) => matchScope(s, f)));
    if (hit) out.push({ id: t.id, title: t.title, assignee: t.assignee, role: role.id, status: t.status });
  }
  return out;
}

// 全局负载：按现行六身份统计（历史任务里的旧岗位 id 会被归并到对应身份）
export function board() {
  const all = bus.listTasks();
  return TEAM.map((r) => {
    const ids = new Set([r.id, r.backend]);
    const mine = all.filter((t) => ids.has(t.assignee) || resolveRole(t.assignee)?.id === r.id);
    const open = mine.filter((t) => ["pending", "claimed"].includes(t.status));
    return {
      身份: r.id,
      领域: r.title,
      波次: r.waves,
      进行中: mine.filter((t) => t.status === "claimed").length,
      待办: mine.filter((t) => t.status === "pending").length,
      已完成: mine.filter((t) => t.status === "done").length,
      失败: mine.filter((t) => t.status === "failed").length,
      在途: open.length,
    };
  });
}

// 并行执行计划：按波次分组
export function plan() {
  const open = bus.listTasks().filter((t) => ["pending", "claimed"].includes(t.status));
  const byWave = {};
  for (const t of open) {
    const r = resolveRole(t.assignee);
    const w = r?.waves ?? 99;
    (byWave[w] ??= []).push({
      id: t.id,
      身份: r?.id ?? t.assignee,
      领域: r?.title ?? "（未识别身份）",
      状态: t.status,
      标题: t.title,
    });
  }
  // 同波次内不同身份的文件范围是否重叠
  const clashes = [];
  const owners = [...new Set(open.map((t) => resolveRole(t.assignee)?.id).filter(Boolean))];
  for (let i = 0; i < owners.length; i += 1) {
    for (let j = i + 1; j < owners.length; j += 1) {
      const A = byId(owners[i])?.fileScope ?? [];
      const B = byId(owners[j])?.fileScope ?? [];
      if (A.some((a) => B.some((b) => globOverlapPair(a, b)))) clashes.push([owners[i], owners[j]]);
    }
  }
  return {
    并行波次: byWave,
    冲突对: clashes,
    // 诚实口径：身份数 != 可并发执行数。只有存在自动适配器的身份能被自动触发，
    // qoder / opencode 当前无适配器（doctor 实测），须人工交接，不计入自动并发。
    并发上限: `${backends().length} 个身份；其中可自动触发的后端数见 node .agents/cli.mjs doctor（qoder/opencode 无适配器，需人工）`,
  };
}

// 唯一写者检查：给定文件，列出覆盖它的所有身份
export function writersFor(file) {
  return TEAM.filter((r) => r.fileScope.some((s) => matchScope(s, norm(file)))).map((r) => r.id);
}

export { TEAM, byId, resolveRole, matchScope };
