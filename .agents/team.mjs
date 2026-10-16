// 团队花名册（2026-10-16 六领域版，DSH 同步）
//
// 依据：.agents/RESPONSIBILITIES.md（六领域分工，现行唯一依据）。
// 本文件取代旧「18 岗位 / 3 物理后端」映射。旧版把 TV 与 Electron 都挂在 workbuddy 名下，
// 与现行分工不符（TV→qoder，Electron→antigravity，打包测试→opencode，手机→workbuddy）。
// 旧版快照保留在 .agents/archive/（如需），不覆盖历史报告。
//
// 设计约束（诚实说明）：
//   1. 任务的 assignee 使用「实际身份」：dsh / antigravity / qoder / workbuddy / codex / opencode。
//   2. 每个身份一个岗位角色，fileScope 用负责任务范围做唯一写者冲突检测。
//   3. 岗位不再拆成多个「角色」，因为角色拆分只对同一后端内部的上下文隔离有意义，
//      而现行分工是「一个身份一个领域」——再拆只会让 route/board 把任务算到错误的人头上。
//   4. 历史任务里可能残留旧岗位 id（如 be-api / tv-play）。byId 仍可解析它们，
//      解析顺序：按 id 精确匹配 → 按 backend 匹配（见 resolveRole）。

// 各领域的内容根：以目录前缀为界，避免把「同名文件」误算成同一写者。
const contentRoots = {
  antigravity: ["apps/web-pc/", "apps/sync-server/public/"],
  qoder: ["apps/tv-android/"],
  workbuddy: ["apps/mobile/"],
  codex: ["shared/", "server/", "custom-server/", "apps/sync-server/"],
  opencode: ["scripts/", "tests/", "release/", "outputs/"],
  dsh: [".agents/"],
};

export const TEAM = [
  {
    id: "dsh",
    title: "统筹协调",
    backend: "dsh",
    duties: "需求拆分、优先级与架构、接口/唯一写者/交接协调、整合、最终验收与发布安排",
    fileScope: [
      ".agents/inbox/**",
      ".agents/outbox/**",
      ".agents/state/**",
      ".agents/logs/**",
      ".agents/archive/**",
      ".agents/team.mjs",
      ".agents/dispatch.mjs",
      ".agents/README.md",
      ".agents/QUICKSTART.md",
      ".agents/RESPONSIBILITIES.md",
      ".agents/START_HERE.md",
      ".agents/mumu-device-allocation.md",
    ],
    // 说明：刻意不含 .agents/shared/** —— 该目录是各方共用的报告落点，不能算 dsh 独占。
    skills: ["需求拆分", "优先级", "架构", "验收", "发布门禁"],
    waves: 0,
  },
  {
    id: "antigravity",
    title: "Web / 电脑端",
    backend: "antigravity",
    duties: "Web与桌面界面与播放、Electron窗口/进程/IPC/单实例、远程管理平台界面、端侧自测",
    fileScope: ["apps/web-pc/**", "apps/sync-server/public/**"],
    skills: ["React", "TypeScript", "Electron", "端侧自测"],
    waves: 1,
  },
  {
    id: "qoder",
    title: "TV 端",
    backend: "qoder",
    duties: "Android5.1.1(API22)+、遥控器/焦点、Media3、JNI与本地服务宿主、存储适配、TV问题修复与自测",
    fileScope: ["apps/tv-android/**"],
    skills: ["Kotlin", "Media3", "Android TV", "JNI"],
    waves: 1,
  },
  {
    id: "workbuddy",
    title: "手机端",
    backend: "workbuddy",
    duties: "手机界面、触控播放、横竖屏、生命周期、本地存储与共享服务接入（平台/技术栈/目录待明确，未验证前不派实现）",
    fileScope: ["apps/mobile/**"],
    skills: ["移动端", "触控交互", "生命周期"],
    waves: 1,
  },
  {
    id: "codex",
    title: "后端：短剧后端服务 + 远程服务",
    backend: "codex",
    duties: "内容解析/签名/解密、清晰度与媒体Range、推荐算法/缓存、本地资料库、远程同步、鉴权/密钥和迁移",
    fileScope: [
      "shared/**",
      "server/**",
      "custom-server/**",
      // 远程管理的后端路由/数据/鉴权；public/ 界面归 antigravity，故此处不写 apps/sync-server/**
      "apps/sync-server/*.mjs",
      "apps/sync-server/data/**",
    ],
    skills: ["Node", "SQLite", "加密签名", "同步协议", "QuickJS"],
    waves: 1,
  },
  {
    id: "opencode",
    title: "打包与测试",
    backend: "opencode",
    duties: "统一各端打包、依赖与运行环境整合、产物/版本/校验和验证、功能/接口/回归/兼容/性能测试与发布门禁",
    fileScope: ["scripts/**", "tests/**", "release/**", "outputs/**"],
    skills: ["构建打包", "产物校验", "回归/兼容/性能测试", "发布门禁"],
    waves: 2,
  },
];

// 旧岗位 id → 现行身份（仅用于解析历史任务，不作为派单依据）
const LEGACY_ROLE_ALIAS = {
  pm: "dsh",
  lead: "codex",
  "fe-player": "antigravity",
  "fe-ui": "antigravity",
  "fe-state": "antigravity",
  "be-engine": "codex",
  "be-api": "codex",
  "be-sync": "codex",
  "tv-play": "qoder",
  "tv-list": "qoder",
  "tv-data": "qoder",
  "qa-unit": "opencode",
  "qa-integration": "opencode",
  "qa-device": "opencode",
  perf: "codex",
  sec: "codex",
  ops: "opencode",
  docs: "dsh",
};

const norm = (s) => String(s).replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/+$/, "");

export const byId = (id) => TEAM.find((r) => r.id === id) || null;

// 解析任意 assignee 到现行身份：精确 id → backend → 旧岗位别名。
export const resolveRole = (x) => {
  if (!x) return null;
  const exact = byId(x);
  if (exact) return exact;
  const byBackend = TEAM.find((r) => r.backend === x);
  if (byBackend) return byBackend;
  const alias = LEGACY_ROLE_ALIAS[x];
  return alias ? byId(alias) : null;
};

export const rolesFor = (backend) => TEAM.filter((r) => r.backend === backend);

export const backends = () => [...new Set(TEAM.map((r) => r.backend))];

export const byBackend = () => {
  const out = {};
  for (const r of TEAM) (out[r.backend] ??= []).push(r);
  return out;
};

export const byWave = () => {
  const out = {};
  for (const r of TEAM) (out[r.waves] ??= []).push(r);
  return out;
};

// glob → 正则：正确处理 **（跨目录）与 *（不跨目录）。
// 旧实现把 tests/**/*.test.mjs 翻译成 ^tests/.*/.*\.test\.mjs$，导致 tests 根下的
// *.test.mjs 无法匹配（route tests/perf-measurement.test.mjs 实测未匹配）。此处修正。
export function globToRegExp(glob) {
  const s = norm(glob);
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === "*" && s[i + 1] === "*") {
      i += 1;
      if (s[i + 1] === "/") {
        i += 1;
        out += "(?:.*/)?";
      } else if (out.endsWith("/")) {
        out = out.slice(0, -1) + "(?:/.*)?";
      } else {
        out += ".*";
      }
    } else if (c === "*") {
      out += "[^/]*";
    } else if (c === "?") {
      out += "[^/]";
    } else {
      out += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp("^" + out + "$");
}

export function matchScope(scope, file) {
  return globToRegExp(scope).test(norm(file));
}

// 两个 glob 是否存在重叠（用于同波次冲突检测）。
// 保守策略：比较两者的静态前缀（第一个通配符之前，截到最后一个 /），前缀互相包含即视为可能重叠。
function staticPrefix(glob) {
  const s = norm(glob);
  const i = s.search(/[*?]/);
  const head = i === -1 ? s : s.slice(0, i);
  const cut = head.lastIndexOf("/");
  return cut === -1 ? head : head.slice(0, cut + 1);
}

export function globOverlapPair(a, b) {
  const A = norm(a), B = norm(b);
  if (A === B) return true;
  const pa = staticPrefix(A), pb = staticPrefix(B);
  if (!pa || !pb) return false;
  return pa.startsWith(pb) || pb.startsWith(pa);
}

export const conflicts = (a, b) => {
  const A = resolveRole(a), B = resolveRole(b);
  if (!A || !B || A.backend === B.backend) return false;
  return A.fileScope.some((x) => B.fileScope.some((y) => globOverlapPair(x, y)));
};

// 某身份的领域是否覆盖该文件（供 route/唯一写者判断）
export const covers = (identity, file) => {
  const r = resolveRole(identity);
  return Boolean(r && r.fileScope.some((s) => matchScope(s, file)));
};

export { contentRoots };
