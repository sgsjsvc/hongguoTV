// B8 防回归：前端构建产物精简契约。
//
// 锁定两项已落地的优化，防止被回退：
//   1. vite.config.ts 开启生产 tree-shaking 与框架/依赖分包
//   2. App.tsx 对非首屏组件做 code-splitting（React.lazy + Suspense），
//      且不再静态导入这些组件；首屏必需的 Header / HomePanel 保持同步加载
//
// 这些是「源码契约」测试：与包体积相关的构建结果由构建门禁单独核对，
// 这里只保证配置与拆分方式不被无意改回。

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vite = fs.readFileSync("apps/web-pc/vite.config.ts", "utf8");
const app = fs.readFileSync("apps/web-pc/src/App.tsx", "utf8");

const LAZY = [
  "PlayerModal",
  "RecommendStream",
  "SearchPanel",
  "LibraryPanel",
  "RankPanel",
  "CategoryPanel",
  "SettingsPanel",
];

test("B8: vite.config 开启生产 tree-shaking 与分包", () => {
  assert.match(vite, /treeshake:\s*["']smallest["']/, "应开启 treeshake: smallest");
  assert.ok(vite.includes("manualChunks"), "应有 manualChunks 分包配置");
  assert.match(vite, /react:\s*\[/, "react/react-dom 应单独成 chunk");
});

test("B8: 非首屏组件使用 React.lazy 动态加载", () => {
  for (const c of LAZY) {
    assert.ok(
      new RegExp(`React\\.lazy\\(\\(\\)\\s*=>\\s*import\\("\\./components/${c}"\\)`).test(app),
      `${c} 应为 React.lazy 动态导入`
    );
    assert.ok(
      !app.includes(`import { ${c} } from "./components/${c}"`),
      `${c} 不应再静态导入`
    );
  }
  assert.ok(app.includes("<React.Suspense"), "应有 Suspense 边界");
  assert.ok(app.includes("PanelFallback"), "应有加载占位组件");
});

test("B8: 首屏必需组件保持同步加载", () => {
  assert.ok(
    app.includes('import { HomePanel } from "./components/HomePanel"'),
    "HomePanel 应同步加载（默认首屏 tab）"
  );
  assert.ok(
    app.includes('import { Header, NavTab } from "./components/Header"'),
    "Header 应同步加载"
  );
});
