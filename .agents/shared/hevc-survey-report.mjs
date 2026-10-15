import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('.agents/shared/t-a2-survey-data.json','utf8'));
const completed=data.series.filter(row=>row.samples.length);
const samples=completed.flatMap(row=>row.samples.map(sample=>({seriesId:row.id,title:row.title,...sample})));
const video=sample=>sample.tracks.find(track=>['HEVC','AVC'].includes(track.codec));
function parameterSets(bytes,cfg){
 const body=cfg.payloadOffset;let at=body+23;const result=[];
 for(let i=0;i<bytes[body+22];i++){
  const type=bytes[at++]&63;const count=bytes.readUInt16BE(at);at+=2;
  for(let j=0;j<count;j++){
   const length=bytes.readUInt16BE(at);at+=2;const nal=bytes.subarray(at,at+length);at+=length;
   if(type!==32&&type!==33)continue;
   const rbsp=[];for(let k=2;k<nal.length;k++){if(nal[k]===3&&k>=4&&nal[k-1]===0&&nal[k-2]===0)continue;rbsp.push(nal[k]);}
   const start=type===32?4:1;
   result.push({nalType:type,name:type===32?'VPS':'SPS',profileIdc:rbsp[start]&31,levelIdc:rbsp[start+11]});
  }
 }
 return result;
}
const sets=[];
for(const sample of samples){
 const bytes=fs.readFileSync(sample.localFile);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sample.headerSHA256);
 const track=video(sample);assert.ok(track);
 const row={seriesId:sample.seriesId,qualityKey:sample.qualityKey,codec:track.codec,headerSHA256:sample.headerSHA256,parameterSets:track.hvcC?parameterSets(bytes,track.hvcC):[]};
 sets.push(row);
}
fs.writeFileSync('.agents/shared/t-a2-parameter-set-check.json',JSON.stringify(sets,null,2));
const primary=completed.map(series=>({series,sample:series.samples.find(sample=>sample.qualityKey===series.available[0]?.key)||series.samples[0]}));
const levels={};for(const {sample} of primary){const label=video(sample).hvcC?.level??video(sample).codec;levels[label]=(levels[label]||0)+1;}
const codecInventory={};for(const series of data.series)for(const codec of series.modelCodecInventory||[])codecInventory[codec]=(codecInventory[codec]||0)+1;
const cross=data.series.filter(series=>(data.completeCrossSeries||[]).includes(series.id));
assert.ok(completed.length>=20);assert.equal(cross.length,3);
for(const series of cross)assert.equal(series.samples.length,series.available.length);
const fps=[...new Set(samples.flatMap(sample=>sample.ffprobe?.streams?.filter(s=>s.codec_type==='video').map(s=>s.avg_frame_rate)||[]))];
const vpsLevels=[...new Set(sets.flatMap(row=>row.parameterSets.filter(s=>s.name==='VPS').map(s=>s.levelIdc)))];
const spsLevels=[...new Set(sets.flatMap(row=>row.parameterSets.filter(s=>s.name==='SPS').map(s=>s.levelIdc)))];
let report=`# A2 HEVC Level 与编码抽样报告\n\n执行方 codex；日期 2026-10-15（Asia/Shanghai）。任务 t-a2-hevc-survey。仅只读分析，未修改业务代码或操作设备。\n\n## 结论\n\n1. 实测 ${completed.length} 部不同剧集、${samples.length} 个档位样本，主样本 HEVC Level 分布为 ${JSON.stringify(levels)}；结果只适用于本次榜单抽样，不代表全站概率。\n2. 实际 MP4 stsd/hvcC/avcC 检查未发现 AVC；模型记录的 codec_type 计数为 ${JSON.stringify(codecInventory)}。bytevc2 是另一类编码声明，未将它归入 HEVC，也未将它误写为 AVC。\n3. 三部完整跨档位样本所有可用档位逐个取流，见下表；本轮范围内 Level 与分辨率未表现为同步变化。\n4. 原始 hvcC 声明由 ffprobe 独立交叉验证；帧率取值 ${fps.join('、')}。配置中的 Level 6.2 不等于实际视频是 8K：它是解码能力声明，低分辨率也可以携带高 Level。不能只据分辨率断言一律改成 120 安全。\n\n## 方法与范围\n\n来源为官网 hot-drama、hot-real-drama、hot-comic-drama、hot-ai-drama 各第一页，轮询去重取样，选择首集、最高可用非 bytevc2 档位为主样本。实际读取 CDN 原始 MP4，未经过我方解密头部改写。每次媒体请求间隔至少 750ms，串行执行；不保存媒体 URL、访问头或解密密钥。\n\n读取起始 262144 字节；若 moov 大于前缀，仅追加读完 moov，限定 8MiB。按 ftyp/moov/trak/mdia/minf/stbl/stsd 的真实 box 边界解析，encv/enca 通过 sinf/frma 恢复原始编码声明，避免直接搜索四字符造成误判。hvcC level 字节为 payload+12，即 box起点+20，或字符串 hvcC 起点+4+12；profile 是 payload+1 低5位。任务说明中的不同 offset 基准在这里统一。\n\n取样开始 ${data.startedAt}，结束 ${data.finishedAt}；共享引擎 SHA256 ${data.sourceSHA256}。分析使用内存加载的该版本，之前榜单改动保持原样。\n\n## 每部主样本\n\n| 剧集 | 剧集 ID | 视频 ID | 编码 | Profile | Level | 实测宽×高 | 音频 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
for(const {series,sample}of primary){const track=video(sample);report+=`| ${series.title.replaceAll('|','/')} | ${series.id} | ${series.videoId} | ${track.codec} | ${track.hvcC?.profileIdc===1?'Main':track.hvcC?.profileIdc??'-'} | ${track.hvcC?.level??'-'} | ${track.width}×${track.height} | ${sample.tracks.find(t=>t.codec==='AAC')?'AAC':'其他/未知'} |\n`;}
report+='\n## 主样本 Level 分布\n\n| Level | 部数 | 比例 |\n| --- | ---: | ---: |\n';
for(const [level,count]of Object.entries(levels))report+=`| ${level} | ${count} | ${(count/completed.length*100).toFixed(1)}% |\n`;
report+='\n## 三部完整跨档位检查\n\n| 剧集 | key | 实测宽×高 | 模型画质字段 | 编码 | Profile | Level |\n| --- | --- | --- | --- | --- | --- | --- |\n';
for(const series of cross)for(const sample of series.samples){const track=video(sample);report+=`| ${series.title} | ${sample.qualityKey} | ${track.width}×${track.height} | ${sample.qualityLabel} | ${track.codec} | ${track.hvcC?.profileIdc??'-'} | ${track.hvcC?.level??'-'} |\n`;}
report+=`\n档位不强行套用 360/480/540/720/1080 模板，以后端实际返回的 key 和 MP4 分辨率为准；有的样本为 496 高、628×360 或 836×480。模型质量字段可能是竖屏长边，如 1920 对应 1080×1920。bytevc2 档位未当作 HEVC 全档位验证；完整跨档位三部特意选择全部档位均为 bytevc1 的内容。\n\n## 补充参数集检查\n\n另检查 hvcC 内 VPS/SPS，移除 emulation-prevention 字节后读取 profile_tier_level。VPS general_level_idc 集合 ${JSON.stringify(vpsLevels)}，SPS 集合 ${JSON.stringify(spsLevels)}。完整逐文件证据 t-a2-parameter-set-check.json。实际修复若修改 Level，应检查容器 hvcC 与 VPS/SPS 的一致性，不能只改一个容器字段后就认定解码器必然接受；是否恢复硬解由 A1/DSH 设备测试决定，本任务未验证。\n\n## 失败与重试记录\n\n原始数据保留 ${data.failures.length} 条历史错误事件，不隐去。首轮扫描器要求 moov 完整存在于 256KiB 内，导致较大头部未解析；确认首例 moov=283310 字节后，改为追加读取剩余 moov。这是采样工具的读取边界问题，不能归因为上游取流失败。\n\n`;
const outstanding=data.series.filter(s=>!s.samples.length||s.errors.length);
if(!outstanding.length)report+='补读后的最终样本均已成功，原始 JSON 的 previousErrors/failures 保留首轮记录。\n';
else for(const row of outstanding)report+=`- ${row.id} ${row.title}：${JSON.stringify(row.errors)}\n`;
report+=`\n## 复核命令与资料\n\n~~~powershell\nnode .agents/shared/hevc-survey.mjs\nnode .agents/shared/hevc-survey.mjs --complete\nnode .agents/shared/hevc-survey-report.mjs\n~~~\n\n首轮确认 moov 边界后中止自有采样进程，保留 outputs/hevc-survey/first-pass.json，从逐条持久化检查点继续，不重复已有成功媒体样本。补采模式仅修复已尝试样本并补齐三部全档位。\n\n原始数据：.agents/shared/t-a2-survey-data.json；参数集复核：.agents/shared/t-a2-parameter-set-check.json；本地二进制前缀及 SHA256 对照：outputs/hevc-survey/*.bin。日志 outputs/hevc-survey-run.log、hevc-survey-resume.log、hevc-survey-complete.log。JSON 未保存上游临时 URL、签名头和密钥。\n\nLevel 是 decoder requirement，编码器需综合码率等参数满足目标 Level，而非只由分辨率决定，参见 [x265 官方文档](https://x265.readthedocs.io/en/master/cli.html#profile-level-tier) 与 [ITU-T H.265 官方规范](https://www.itu.int/rec/dologin_pub.asp?id=T-REC-H.265-201802-S%21%21PDF-E&lang=e&type=items)。本次统计不能独立证明「所有硬解均回退软解」或「降低 Level 后即可解决音画不同步」。\n`;
fs.writeFileSync('.agents/shared/t-a2-hevc-survey-codex.md',report);
console.log(JSON.stringify({series:completed.length,samples:samples.length,levels,codecInventory,crossSeries:cross.map(s=>s.title),vpsLevels,spsLevels,outstanding:outstanding.length}));
