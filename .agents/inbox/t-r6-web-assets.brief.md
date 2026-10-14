# R6 Web 静态资源 404 修复

**任务 ID**: `t-r6-web-assets`
**负责人**: antigravity
**依赖**: 无（可并行）
**协调者**: dsh

---

## 一、修复目标

修复 **D3-F5**（low）：静态资源缺失导致控制台持续抛出 404 资源加载错误。

**详见**：`.agents/shared/t-d3-web-ui-discovery-antigravity.md`

---

## 二、问题

**位置**：`apps/web-pc/index.html` / `public/`

**现象**：浏览器控制台持续出现 404 资源加载错误。

---

## 三、排查要求

**先定位**：D3 报告未给出具体缺失文件，请先用 `list_network_requests` 找出所有 404 的资源。

常见原因：

1. `index.html` 中引用了不存在的 favicon / manifest
2. `public/` 下缺少被引用的静态文件
3. 路径大小写或前缀错误

---

## 四、硬性约束

1. **只改 `apps/web-pc/index.html` 与 `apps/web-pc/public/` 下的文件**
2. 不要改 `App.tsx`（R5/R7 负责）
3. **不要回退**工作区其他改动
4. 当前 shell 是 **Windows PowerShell 5.1**

---

## 五、验收标准

1. **列出所有 404 资源**（修复前，附 DevTools 输出）
2. 修复后**控制台无 404 错误**（DevTools 证明）
3. `npm run build` 通过
4. 报告写入 `.agents/shared/t-r6-web-assets-antigravity.md`

---

## 六、证据要求

- 修复前后的 `list_network_requests` 对比（筛选 4xx）
- `list_console_messages` 修复前后的错误数对比
- 证据三件套

---

## 七、提交方式

```powershell
node .agents/cli.mjs done t-r6-web-assets antigravity "结论及报告路径"
```
