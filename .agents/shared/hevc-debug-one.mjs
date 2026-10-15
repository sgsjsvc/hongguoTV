import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';import axios from 'axios';
const context=vm.createContext({Buffer,URL,URLSearchParams,axios,require:()=>crypto});
vm.runInContext(fs.readFileSync('shared/content-core/hongguo.js','utf8')+'\nthis.api={fetchVideoInfo,resolveStream,remoteRange};',context);
const survey=JSON.parse(fs.readFileSync('.agents/shared/t-a2-survey-data.json','utf8'));
const series=survey.series.find(row=>row.errors.length&&row.errors[0].error.includes('No validated'));
const info=await context.api.fetchVideoInfo(series.videoId);const stream=await context.api.resolveStream(series.videoId,info.rows[0].key);const {data,total}=await context.api.remoteRange(stream,0,262143);
fs.writeFileSync('outputs/hevc-survey/failed-head.bin',data);
console.log(JSON.stringify({seriesId:series.id,total,rows:Array.from(info.rows,row=>({key:row.key,codec:row.item.codec_type})),prefix:data.subarray(0,40).toString('hex')}));
for(let at=0;at+8<=data.length;){const size=data.readUInt32BE(at),type=data.toString('ascii',at+4,at+8);console.log({at,size,type});if(size<8)break;at+=size;}
for(const type of ['stsd','hvcC','avcC','hvc1','hev1','avc1','encv'])console.log(type,data.indexOf(type));
