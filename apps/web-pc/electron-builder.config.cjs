// electron-builder 配置
// 目标：产出 NSIS 安装包 + 便携版，且免环境（内置 Node 运行时与后端）
//
// 目录约定（与 electron/main.cjs 一致）：
//   resources/app/         Electron 代码（dist + electron/main.cjs + package.json）
//   resources/hongguotv/   本地后端（custom-server + shared + runtime/node.exe + scripts）
//
// main.cjs 通过 process.resourcesPath/hongguotv 定位后端，并优先使用其中的 runtime/node.exe。
const path = require("node:path");
const fs = require("node:fs");

const root = path.resolve(__dirname, "../..");
const webBundle = path.join(root, "outputs", "bundles", "hongguotv-web-win-x64");

// 便携版与安装包都需要这份后端；若尚未生成，明确报错而不是产出残缺包
if (!fs.existsSync(path.join(webBundle, "custom-server", "index.mjs"))) {
  throw new Error(
    `缺少 Web 包后端：${webBundle}\n请先运行 npm run build:bundles -- --platforms=win-x64`
  );
}

module.exports = {
  appId: "com.hongguotv.desktop",
  productName: "红果短剧",
  copyright: "GPL-3.0-only",

  directories: {
    output: path.join(root, "outputs", "windows"),
    buildResources: "build",
  },

  // Electron 代码：只打 dist 与 electron，不打源码与 node_modules
  files: [
    "dist/**/*",
    "electron/**/*",
    "package.json",
    "!**/*.map",
    "!**/node_modules/**/*",
  ],

  // 本地后端随包分发（含 Node 运行时，实现免环境）
  extraResources: [
    {
      from: webBundle,
      to: "hongguotv",
      filter: ["**/*"],
    },
  ],

  // 只打 Windows
  win: {
    target: [
      { target: "nsis", arch: ["x64", "arm64"] },
      { target: "portable", arch: ["x64", "arm64"] },
    ],
    icon: path.join(root, "assets", "branding", "hongguotv-icon-v2.png"),
  },

  // NSIS 安装包：可选目录、创建快捷方式、可卸载
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "红果短剧",
    deleteAppDataOnUninstall: false,
    artifactName: "${productName}-${version}-${arch}-setup.${ext}",
  },

  portable: {
    artifactName: "${productName}-${version}-${arch}-portable.${ext}",
  },

  // 打包阶段不需要额外下载 Electron（已装为 devDependency）
  electronVersion: "40.0.0",
  npmRebuild: false,
  asar: true,
};
