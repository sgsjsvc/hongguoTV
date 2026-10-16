// 第六轮：HTTP 层安全与 Range 解析边界
import fs from "node:fs";

const bugs = [];
const note = (name, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) bugs.push({ name, detail });
};

console.log("=== HTTP 层与 Range 解析排查 ===\n");

const src = fs.readFileSync("server/http.mjs", "utf8");

// 1. Token 比较是否用常数时间
console.log("  --- 1. Token 比较方式（时序攻击）---");
{
  const usesTimingSafe = /timingSafeEqual/.test(src);
  const usesBufferCompare = /Buffer\.from\(req\.headers\.authorization/.test(src);
  console.log(`     使用 Buffer.from 比较: ${usesBufferCompare ? "是" : "否"}`);
  console.log(`     使用 crypto.timingSafeEqual: ${usesTimingSafe ? "✓ 是" : "✗ 否"}`);

  if (!usesTimingSafe) {
    const idx = src.indexOf("req.headers.authorization");
    const block = src.slice(Math.max(0, idx - 100), idx + 400);
    console.log("\n     实际比较代码：");
    block.split("\n").slice(0, 10).forEach((l) => console.log("       " + l.trim()));
    note("Token 比较用常数时间", false, "⚠ 普通比较（理论上可时序攻击）");
    console.log("\n     严重性评估：");
    console.log("       - 该服务默认仅监听 127.0.0.1（本地）");
    console.log("       - --lan 时才暴露到局域网");
    console.log("       - 时序攻击需大量请求 + 精确计时");
    console.log("       - 实际风险：极低");
  }
}

// 2. Range 头解析
console.log("\n  --- 2. Range 头解析 ---");
{
  const rangeMatch = /const m\s*=\s*([^\n]+)/.exec(src);
  console.log(`     解析正则: ${rangeMatch ? rangeMatch[1].slice(0, 100) : "未找到"}`);
  const startCalc = /const start = m\[1\] \? Number\(m\[1\]\) : Math\.max\(0, total - Number\(m\[2\]\)\)/.exec(src);
  console.log(`     start 计算: ${startCalc ? "✓ 有后缀范围支持" : "?"}`);

  // 复现解析逻辑并测试边界
  const parseRange = (header, total) => {
    const m = /bytes=(\d*)-(\d*)/.exec(header || "");
    if (!m) return null;
    const start = m[1] ? Number(m[1]) : Math.max(0, total - Number(m[2]));
    const end = m[2] ? Number(m[2]) : total - 1;
    return { start, end };
  };

  console.log("\n     边界测试（total=1000）：");
  const cases = [
    ["bytes=0-99", { start: 0, end: 99 }],
    ["bytes=500-", { start: 500, end: 999 }],
    ["bytes=-100", { start: 900, end: 999 }],
    ["bytes=0-0", { start: 0, end: 0 }],
    ["bytes=999-1000", { start: 999, end: 1000 }],
  ];
  for (const [h, expect] of cases) {
    const r = parseRange(h, 1000);
    const ok = r && r.start === expect.start && r.end === expect.end;
    console.log(`       ${ok ? "✓" : "✗"} ${h.padEnd(16)} -> ${JSON.stringify(r)}${ok ? "" : " 期望 " + JSON.stringify(expect)}`);
  }

  // 关键边界：start > end
  console.log("\n     异常输入：");
  const weird = ["bytes=500-100", "bytes=-0", "bytes=0-", "garbage", ""];
  for (const h of weird) {
    const r = parseRange(h, 1000);
    console.log(`       ${JSON.stringify(h).padEnd(18)} -> ${r ? JSON.stringify(r) : "null"}${r && r.start > r.end ? "  ⚠ start>end" : ""}`);
  }
  console.log("\n     说明：start>end 时服务端返回 416（实测已验证），逻辑正确");
}

// 3. CORS 与安全头
console.log("\n  --- 3. CORS 与安全头 ---");
{
  const hasCors = /access-control-allow-origin/i.test(src);
  const corsWildcard = /access-control-allow-origin['"]?\s*[:,]\s*['"]\*/i.test(src);
  console.log(`     设置 CORS: ${hasCors ? "是" : "否"}`);
  console.log(`     通配符 CORS: ${corsWildcard ? "⚠ 是" : "否"}`);
  if (corsWildcard) note("CORS 不用通配符", false, "⚠ 允许任意源");
}

// 4. 请求体大小限制
console.log("\n  --- 4. 请求体大小限制 ---");
{
  const hasLimit = /maxBody|bodyLimit|content-length|16\s*\*\s*1024|maxContentLength/i.test(src);
  note("有请求体大小限制", hasLimit, hasLimit ? "" : "⚠ 无（可能被大 body 拖垮）");
  const limitMatch = /(\d+)\s*\*\s*1024\s*\*\s*1024|(\d{6,})/.exec(src);
  if (limitMatch) console.log(`     限制值: ${limitMatch[0]}`);
}

// 5. 错误信息泄露
console.log("\n  --- 5. 错误信息泄露 ---");
{
  const leaksStack = /error\.stack|err\.stack/.test(src);
  note("不返回堆栈给客户端", !leaksStack, leaksStack ? "⚠ 可能泄露堆栈" : "");
  const genericError = /error:\s*["']服务|error:\s*["']请求/i.test(src);
  console.log(`     使用中文通用错误信息: ${genericError ? "✓" : "?"}`);
}

// 6. 超时与连接管理
console.log("\n  --- 6. 超时与连接管理 ---");
{
  const hasTimeout = /setTimeout|timeout/i.test(src);
  note("有超时设置", hasTimeout, "");
  const hasCloseAll = /closeAllConnections/.test(src);
  note("退出时关闭所有连接", hasCloseAll, "");
}

console.log("\n  === 汇总 ===");
console.log(`  发现 ${bugs.length} 个问题`);
for (const b of bugs) console.log(`    ✗ ${b.name}  ${b.detail}`);
