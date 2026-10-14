// electron-builder 配置
// 目标：产出 NSIS 安装包 + 便携版，且免环境（内置 Node 运行时与后端）
//
// 目录约定（与 electron/main.cjs 一致）：
//   resources/app/         Electron 代码（dist + electron/main.cjs + package.json）
//   resources/hongguotv/   本地后端（custom-server + shared + runtime/node.exe + scripts）
//
// main.cjs 通过 process.resourcesPath/hongguotv 定位后端，并优先使用其中的 runtime/node.exe。
//
// 代码签名：
//   证书与密码不写入本文件，通过环境变量提供：
//     HG_CODESIGN_PFX       .pfx 文件绝对路径
//     HG_CODESIGN_PASSWORD  .pfx 密码
//   未提供时跳过签名（构建仍成功），便于无证书环境（CI 或新克隆）使用。
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const webBundle = path.join(root, "outputs", "bundles", "hongguotv-web-win-${arch}");

// signtool 定位：优先环境变量，其次常见 Windows SDK 路径
function findSignTool() {
  if (process.env.HG_SIGNTOOL && fs.existsSync(process.env.HG_SIGNTOOL)) return process.env.HG_SIGNTOOL;
  const bases = [
    "C:\\Program Files (x86)\\Windows Kits\\10\\bin",
    "C:\\Program Files\\Windows Kits\\10\\bin",
  ];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    const versions = fs.readdirSync(base).filter((n) => /^10\./.test(n)).sort().reverse();
    for (const v of versions) {
      const p = path.join(base, v, "x64", "signtool.exe");
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const pfxPath = process.env.HG_CODESIGN_PFX;
const pfxPassword = process.env.HG_CODESIGN_PASSWORD;
const signTool = pfxPath ? findSignTool() : null;
const canSign = Boolean(pfxPath && pfxPassword && signTool && fs.existsSync(pfxPath));

if (pfxPath && !canSign) {
  // 明确告知而非静默跳过：用户以为在签名但实际没有，风险更大
  console.warn(
    `[codesign] 已提供 HG_CODESIGN_PFX 但无法签名：` +
      `pfx存在=${fs.existsSync(pfxPath)} 密码=${Boolean(pfxPassword)} signtool=${Boolean(signTool)}`
  );
}


module.exports = {
  beforePack(context) {
    const arch = { 1: "x64", 3: "arm64" }[context.arch];
    if (!arch) throw new Error("不支持的 Windows 架构");
    const bundle = webBundle.replace("${arch}", arch);
    if (!fs.existsSync(path.join(bundle, "custom-server", "index.mjs"))) throw new Error(`缺少 ${arch} 后端包：${bundle}`);
    const binary = fs.readFileSync(path.join(bundle, "runtime", "node.exe"));
    const machine = binary.readUInt16LE(binary.readUInt32LE(0x3c) + 4);
    if (machine !== { x64: 0x8664, arm64: 0xaa64 }[arch]) throw new Error(`内置 Node 与目标 ${arch} 架构不一致`);
  },
  afterPack(context) {
    const expected = { 1: 0x8664, 3: 0xaa64 }[context.arch];
    for (const file of [path.join(context.appOutDir, "红果短剧.exe"), path.join(context.appOutDir, "resources", "hongguotv", "runtime", "node.exe")]) {
      const data = fs.readFileSync(file);
      if (data.readUInt16LE(data.readUInt32LE(0x3c) + 4) !== expected) throw new Error(`产物架构错误：${file}`);
    }
  },
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
  //
  // ⚠️ node_modules 必须用 extraFiles 单独打包，不能用 extraResources。
  // 原因（见 app-builder-lib/out/util/filter.js 的 createFilter）：
  //   对 extraResources 的根级 "node_modules" 目录存在硬编码排除，
  //   在应用自定义 filter 之前就 return false，filter 无法覆盖。
  // 而 custom-server/index.mjs 需要 import "axios"，缺它会导致
  // 后端启动即报 ERR_MODULE_NOT_FOUND，应用完全不可用。
  extraResources: [
    {
      from: webBundle,
      to: "hongguotv",
      filter: ["**/*", "!node_modules/**/*", "!**/*.log", "!**/*.map"],
    },
  ],
  extraFiles: [
    {
      from: path.join(webBundle, "node_modules"),
      to: "resources/hongguotv/node_modules",
      filter: ["**/*"],
    },
  ],

  // 只打 Windows
  win: {
    target: ["nsis", "portable"],
    icon: path.join(root, "assets", "branding", "hongguotv-icon-v2.png"),
    // 证书缺失时不设置该字段，electron-builder 跳过签名
    ...(canSign
      ? {
          signtoolOptions: {
            sign: async (configuration) => {
              const files = configuration.path ? [configuration.path] : [];
              for (const file of files) {
                execFileSync(
                  signTool,
                  [
                    "sign",
                    "/f", pfxPath,
                    "/p", pfxPassword,
                    "/fd", "SHA256",
                    "/tr", "http://timestamp.digicert.com",
                    "/td", "SHA256",
                    file,
                  ],
                  { stdio: "inherit" }
                );
              }
            },
          },
        }
      : {}),
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
  // Build callers may use a verified local distribution to avoid a network download.
  electronDist: process.env.HG_ELECTRON_DIST || undefined,
  npmRebuild: false,
  // The external Node backend reads HG_WEB_DIR with ordinary fs, outside Electron's ASAR support.
  asar: false,
};
