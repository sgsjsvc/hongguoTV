// 防回归：设备标识必须每次请求随机，且不得硬编码。
//
// 背景（2026-10-15 事故）：
//   引擎把 device_id 硬编码为常量，上游封禁该值后返回 HTTP 200 + 空响应体，
//   导致 Web / Windows / TV 三端同时无法播放。
//   更隐蔽的是：即使随机化，同一 device_id 也只能用一次——
//   上游对每个 device_id 只放行一次 video_model 请求。
//
// 这些测试用静态检查 + 运行时行为锁定该契约，避免同类事故复发。

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = path.join(root, "shared", "content-core", "hongguo.js");
const VENDORS = [
  path.join(root, "custom-server", "vendor", "hongguo.cjs"),
  path.join(root, "server", "vendor", "hongguo.cjs"),
];

function loadEngine(file = ENGINE) {
  const source = fs.readFileSync(file, "utf8");
  const context = vm.createContext({
    require: (name) => {
      if (name === "node:crypto") return crypto;
      throw new Error("Unsupported module: " + name);
    },
    Buffer,
    URL,
    URLSearchParams,
    axios: { create: () => async () => ({ status: 200, data: "{}" }) },
  });
  vm.runInContext(
    source + "\nthis.api = { DEVICE, freshDevice, randomDeviceId, signedVideoRequest };",
    context,
    { timeout: 5000 }
  );
  return { api: context.api, source };
}

// ---------- 静态检查：不得出现硬编码设备标识 ----------

test("engine: 不得硬编码 device_id / iid 常量", () => {
  const { source } = loadEngine();
  // 匹配 device_id: '1234567890123456' 这类字面量
  const hardcodedDevice = /device_id\s*:\s*['"]\d{10,}['"]/.test(source);
  const hardcodedIid = /\biid\s*:\s*['"]\d{10,}['"]/.test(source);
  assert.equal(hardcodedDevice, false, "发现硬编码 device_id，上游封禁后会导致全线不可播");
  assert.equal(hardcodedIid, false, "发现硬编码 iid，应与 device_id 一同随机化");
});

test("engine: 事故中的具体 ID 不得再出现", () => {
  const { source } = loadEngine();
  assert.equal(source.includes("1905892595378490"), false, "被封禁的 device_id 仍在代码中");
  assert.equal(source.includes("1905892595382586"), false, "被封禁的 iid 仍在代码中");
});

test("vendors: 两个 vendor 副本同样不得硬编码", () => {
  for (const file of VENDORS) {
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    assert.equal(
      /device_id\s*:\s*['"]\d{10,}['"]/.test(source),
      false,
      `${path.relative(root, file)} 含硬编码 device_id`
    );
    assert.equal(
      source.includes("1905892595378490"),
      false,
      `${path.relative(root, file)} 含被封禁的 device_id`
    );
  }
});

// ---------- 运行时检查：设备标识必须一次性 ----------

test("engine: freshDevice 每次返回不同的 device_id 与 iid", () => {
  const { api } = loadEngine();
  assert.equal(typeof api.freshDevice, "function", "缺少 freshDevice");

  const ids = new Set();
  const iids = new Set();
  for (let i = 0; i < 20; i += 1) {
    const dev = api.freshDevice();
    ids.add(dev.device_id);
    iids.add(dev.iid);
  }
  assert.equal(ids.size, 20, "device_id 出现重复，无法满足「每个设备只用一次」");
  assert.equal(iids.size, 20, "iid 出现重复");
});

test("engine: device_id 落在真实量级（16 位十进制）", () => {
  const { api } = loadEngine();
  for (let i = 0; i < 10; i += 1) {
    const id = api.freshDevice().device_id;
    assert.match(id, /^\d{16}$/, `device_id 格式异常: ${id}`);
    const n = BigInt(id);
    assert.ok(n >= 1000000000000000n && n < 10000000000000000n, `device_id 越界: ${id}`);
  }
});

test("engine: 设备画像字段保持不变（机型等不应随机）", () => {
  const { api } = loadEngine();
  const a = api.freshDevice();
  const b = api.freshDevice();
  for (const key of ["device_type", "device_brand", "os_version", "version_name", "aid", "resolution"]) {
    assert.equal(a[key], b[key], `${key} 不应随请求变化`);
  }
});

// ---------- 签名契约：medusa 必须使用传入的设备 ----------

test("engine: signedVideoRequest 的 URL 使用传入的 device_id", () => {
  const { api } = loadEngine();
  const dev = api.freshDevice();
  const payload = JSON.stringify({ video_id: "1", biz_param: {} });
  const signed = api.signedVideoRequest(payload, dev);
  const urlDev = new URL(signed.url).searchParams.get("device_id");
  assert.equal(urlDev, dev.device_id, "URL 中的 device_id 与传入设备不一致");
});

test("engine: medusa 签名不得回落到全局 DEVICE（曾因此导致换设备无效）", () => {
  // 事故修复过程中发现：buildMedusa 内部硬编码引用全局 DEVICE，
  // 导致即使传入了新设备，签名仍用旧 id，上游照样返回空体。
  const { source } = loadEngine();
  const start = source.indexOf("function buildMedusa(");
  assert.ok(start > 0, "未找到 buildMedusa");
  const end = source.indexOf("\nfunction ", start + 10);
  const body = source.slice(start, end > 0 ? end : undefined);

  assert.equal(
    /DEVICE\./.test(body),
    false,
    "buildMedusa 内仍引用全局 DEVICE，传入 device 参数会被忽略"
  );
  assert.ok(
    /const\s+DEV\s*=\s*device\s*\|\|\s*DEVICE/.test(body),
    "buildMedusa 应接受 device 参数并回落到 DEVICE"
  );
});

// ---------- 服务层：空体必须被识别为可重试，而非静默成功 ----------

test("engine: 空响应体不被当作成功", () => {
  const { source } = loadEngine();
  // requestVideoModel 必须显式处理「HTTP 200 + 空体」
  assert.ok(
    /!data\s*&&\s*resp\.status\s*===\s*200/.test(source) ||
      /!data[\s\S]{0,80}空响应/.test(source),
    "requestVideoModel 未显式处理空响应体"
  );
});

test("engine: requestVideoModel 会在空体时换设备重试", () => {
  const { source } = loadEngine();
  const start = source.indexOf("async function requestVideoModel(");
  assert.ok(start > 0, "未找到 requestVideoModel");
  const end = source.indexOf("\nfunction ", start + 10);
  const body = source.slice(start, end > 0 ? end : undefined);

  assert.ok(/freshDevice\(\)/.test(body), "requestVideoModel 应每次调用 freshDevice()");
  assert.ok(/attempts/.test(body), "requestVideoModel 应包含重试次数上限");
  assert.ok(/for\s*\(/.test(body), "requestVideoModel 应包含重试循环");
});

// ---------- 端口契约：探针默认端口必须与服务一致 ----------

test("probe: 默认端口与服务默认端口一致", () => {
  const probe = fs.readFileSync(path.join(root, "scripts", "probe.mjs"), "utf8");
  const server = fs.readFileSync(path.join(root, "custom-server", "index.mjs"), "utf8");

  const probePort = /BRIDGE_URL\s*\|\|\s*"http:\/\/127\.0\.0\.1:(\d+)"/.exec(probe)?.[1];
  // 端口由 serviceListenOptions(8788) 决定（W1 引入的自动递增工具）
  const serverPort =
    /serviceListenOptions\((\d+)\)/.exec(server)?.[1] ??
    /process\.env\.PORT\s*\|\|\s*(\d+)/.exec(server)?.[1];

  assert.ok(probePort, "未能解析 probe.mjs 的默认端口");
  assert.ok(serverPort, "未能解析 custom-server 的默认端口");
  assert.equal(probePort, serverPort, `探针端口 ${probePort} 与服务端口 ${serverPort} 不一致`);
});
