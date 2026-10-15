# A2 抽样统计 HEVC Level 分布与编码格式

**任务 ID**: `t-a2-hevc-survey`
**负责人**: codex
**设备**: 无需设备（纯服务端/引擎层分析）
**依赖**: 无
**协调者**: dsh

---

## 一、背景

已确认上游视频把 **HEVC Level 标成了 6.2**（应为 4.0），导致硬解器拒绝、回退软解、音画不同步。

**dsh 已实测的单个样本**：

```
视频 ID 7503780574541122622
  含 hvc1: true（HEVC）
  含 mp4a: true（AAC）
  HEVC profile_idc = 1 (Main)
  HEVC level_idc   = 186 → Level 6.2
```

**所有画质档位（360P~1080P）都是 6.2**。

---

## 二、任务目标

**回答三个问题**：

1. **Level 6.2 有多普遍？** 抽样多部剧集，统计分布
2. **是否存在 AVC（H.264）内容？** 若有，可作为规避方案
3. **Level 与分辨率是否相关？** 360P 也是 6.2 是否正常

---

## 三、具体要求

### 3.1 抽样规模

**至少 20 部不同剧集**（越多越好）。

来源建议：

- `GET /api/recommend?page=N` 获取推荐流
- `GET /api/rank?type=...` 获取榜单
- `GET /api/category?type=...` 获取分类

### 3.2 每部剧的检查项

| 项 | 方法 |
| --- | --- |
| 视频 ID | 从 API 获取 |
| 编码格式 | 解析 MP4 的 `stsd` box（`hvc1`/`hev1`/`avc1`） |
| HEVC profile_idc | `hvcC` box offset +9 的低 5 位 |
| **HEVC level_idc** | `hvcC` box offset +20（dsh 验证的公式：`hvcC_offset + 4 + 12`） |
| 分辨率 | 从 `video_list` 的 quality 字段 |
| 音频编码 | `mp4a` 是否存在 |

### 3.3 解析脚本（dsh 已验证）

```javascript
const fs = require('fs');
const b = fs.readFileSync(file);
const s = b.toString('latin1');
const hasHvc = s.includes('hvc1') || s.includes('hev1');
const hasAvc = s.includes('avc1');
const j = s.indexOf('hvcC');
let profile = null, level = null;
if (j > 0) {
  const p1 = b[j + 4 + 1];
  profile = p1 & 0x1f;          // 1=Main, 2=Main10
  level = b[j + 4 + 12];        // 120=Level4.0, 186=Level6.2
}
```

**取样本命令**：

```powershell
curl.exe -s -H "Range: bytes=0-262143" `
  "http://127.0.0.1:8788/api/episodes/<episodeId>/stream?quality=720P&seriesId=<seriesId>" `
  --max-time 60 -o "$env:TEMP\s.bin"
```

### 3.4 跨档位检查

**至少对 3 部剧**，检查全部画质档位（360P/480P/540P/720P/1080P），
确认「所有档位都是同一 Level」是否普遍。

---

## 四、交付格式

报告写入 `.agents/shared/t-a2-hevc-survey-codex.md`，包含：

### 4.1 抽样结果表

| 剧集 | 视频 ID | 编码 | Profile | **Level** | 分辨率 |
| --- | --- | --- | --- | --- | --- |
| ... | ... | HEVC | Main | **6.2** | 1080P |

### 4.2 统计汇总

| Level | 数量 | 占比 |
| --- | --- | --- |
| 6.2 | ? | ?% |
| 其他 | ? | ?% |

### 4.3 关键结论

1. Level 6.2 的占比
2. 是否存在 AVC 内容
3. 跨档位是否一致

### 4.4 原始数据

保存为 JSON（如 `t-a2-survey-data.json`），便于复核。

---

## 五、硬性约束

1. **只读分析** —— **不要修改任何业务代码**
2. **不要修改引擎**（codex 之前的榜单改动保持不动）
3. **不要提交 git**
4. 采样时**控制频率**，避免对上游造成压力
5. 当前 shell 是 **Windows PowerShell 5.1**

---

## 六、验收标准

1. 抽样 **≥ 20 部**剧集
2. 每部有**实际解析**的 Level 值（非猜测）
3. 至少 **3 部**跨全部画质档位检查
4. 提供**原始数据 JSON**
5. 明确回答第二节的三个问题
6. 报告写入 `.agents/shared/t-a2-hevc-survey-codex.md`

---

## 七、注意事项

1. **若某部剧取流失败**，如实记录，不要跳过不报
2. **若发现 Level 不是 6.2 的内容**，重点分析（可能是规避方案的线索）
3. **不要声称「所有内容都是 6.2」**，除非抽样覆盖足够且有数据支撑

---

## 八、提交方式

```powershell
node .agents/cli.mjs done t-a2-hevc-survey codex "结论及报告路径"
```
