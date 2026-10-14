# R6 Web 静态资源 404 修复报告（D3-F5）

**责任人**: antigravity  
**任务 ID**: `t-r6-web-assets`  
**完成时间**: 2026-10-14  
**修改范围**: `apps/web-pc/index.html`、`apps/web-pc/public/` (严守约束：仅修改此两处，未改动 `App.tsx`)

---

## 一、修复目标与排查定位

- **缺陷编号**: D3-F5（low）
- **现象**: Web PC 端访问页面时，浏览器控制台持续出现 404 静态资源加载错误：
  ```
  [error] Failed to load resource: the server responded with a status of 404 (Not Found) [2 times]
  ```
- **排查定位**:
  1. 通过 DevTools 及 HTTP 请求分析：浏览器打开页面时自动请求 `/favicon.ico`。
  2. `apps/web-pc/` 下甚至未创建 `public/` 静态目录，导致 `http://127.0.0.1:3000/favicon.ico` 始终返回 404 Not Found。
  3. `apps/web-pc/index.html` 中未定义 `<link rel="icon">` 标头标签。

---

## 二、修复方案

1. **新建 public 静态资源目录并生成品牌图标**:
   - `apps/web-pc/public/favicon.svg`: 标准 SVG 矢量红果播放图标。
   - `apps/web-pc/public/favicon.ico`: 32bpp 标准尺寸 ICO 文件，支持全主流浏览器。
2. **在 `apps/web-pc/index.html` 中配置规范 Icon 链接**:
   ```html
   <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
   <link rel="alternate icon" href="/favicon.ico" />
   ```

---

## 三、构建与静态类型验证

执行命令：
```bash
npm --prefix apps/web-pc run build
```
**结果**:
- `tsc && vite build`: BUILD SUCCESSFUL
- 1650 模块构建完成，无任何错误与警告。

---

## 四、浏览器实测证据（Chrome DevTools）

1. **修复前状态**:
   - 控制台出现 404 资源加载错误：`msgid=4 [error] Failed to load resource: the server responded with a status of 404 (Not Found) [2 times]`。
   - `http://127.0.0.1:3000/favicon.ico` 响应状态码为 `404`。
2. **修复后状态**:
   - `http://127.0.0.1:3000/favicon.ico` 响应状态码为 `200`。
   - `http://127.0.0.1:3000/favicon.svg` 响应状态码为 `200`。
   - 浏览器控制台 `list_console_messages` 错误完全归零（仅有 debug 与 info 正常连接信息，0 个 error）。
   - 页面截图证据：`.agents/shared/t-r6-web-assets-fixed-20261014.png` (2,104,580 字节)。
