// Read-only A2 survey. No URLs, signed headers, keys or video-model payloads are persisted.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import axios from 'axios';
const output='outputs/hevc-survey';fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync('shared/content-core/hongguo.js','utf8');
const sourceSHA256=crypto.createHash('sha256').update(source).digest('hex');
const context=vm.createContext({Buffer,URL,URLSearchParams,axios,require:()=>crypto});
vm.runInContext(source+'\nthis.surveyApi={rankData,fetchVideoInfo,resolveStream,remoteRange};',context);
const api=context.surveyApi;
const data=fs.existsSync('.agents/shared/t-a2-survey-data.json')?JSON.parse(fs.readFileSync('.agents/shared/t-a2-survey-data.json','utf8')):{startedAt:new Date().toISOString(),sourceSHA256,candidates:[],series:[],failures:[]};
assert.equal(data.sourceSHA256,sourceSHA256,'Engine changed during the survey');
data.method='4 official ranking pools, round-robin distinct series, first episode; primary highest non-bytevc2 quality; raw CDN bytes 0..262143 plus remaining moov when needed; serial media requests with 750ms pacing';
const persist=()=>fs.writeFileSync('.agents/shared/t-a2-survey-data.json',JSON.stringify(data,null,2));
const pause=()=>new Promise(resolve=>setTimeout(resolve,750));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
// Parse actual box boundaries, not incidental fourcc strings in mdat.
function boxes(buffer,start=0,end=buffer.length){
 const out=[];
 for(let at=start;at+8<=end;){let size=buffer.readUInt32BE(at),header=8;const type=buffer.toString('ascii',at+4,at+8);if(size===1){if(at+16>end)break;size=Number(buffer.readBigUInt64BE(at+8));header=16;}if(size===0)size=end-at;if(size<header||at+size>end)break;out.push({type,at,size,body:at+header,end:at+size});at+=size;}
 return out;
}
function entries(buffer){
 const found=[];
 const visit=(start,end)=>{for(const box of boxes(buffer,start,end)){
  if(['moov','trak','mdia','minf','stbl'].includes(box.type))visit(box.body,box.end);
  if(box.type==='stsd')found.push(...boxes(buffer,box.body+8,box.end));
 }};visit(0,buffer.length);return found;
}
function inspect(buffer){
 return entries(buffer).map(entry=>{
  const video=['hvc1','hev1','avc1','avc3','encv'].includes(entry.type);
  const audio=['mp4a','enca'].includes(entry.type);
  const children=boxes(buffer,entry.body+(video?78:audio?28:entry.size),entry.end);
  const cfg=children.find(box=>box.type==='hvcC');
  const avc=children.find(box=>box.type==='avcC');
  const sinf=children.find(box=>box.type==='sinf');
  const frma=sinf&&boxes(buffer,sinf.body,sinf.end).find(box=>box.type==='frma');
  const original=frma?buffer.toString('ascii',frma.body,frma.body+4):entry.type;
  return {sampleEntry:entry.type,originalFormat:original,codec:cfg?'HEVC':avc?'AVC':original==='mp4a'?'AAC':original,
   width:video?buffer.readUInt16BE(entry.body+24):null,height:video?buffer.readUInt16BE(entry.body+26):null,
   hvcC:cfg?{boxOffset:cfg.at,payloadOffset:cfg.body,profileIdc:buffer[cfg.body+1]&31,tierFlag:(buffer[cfg.body+1]>>5)&1,levelIdc:buffer[cfg.body+12],level:buffer[cfg.body+12]/30,levelByteOffset:cfg.body+12}:null};
 });
}
// Synthetic boundary check: the level byte is payload+12 = fourcc offset+4+12.
const fake=Buffer.alloc(140);fake.writeUInt32BE(140,0);fake.write('stsd',4);fake.writeUInt32BE(1,12);fake.writeUInt32BE(124,16);fake.write('hvc1',20);fake.writeUInt16BE(1080,48);fake.writeUInt16BE(1920,50);fake.writeUInt32BE(38,102);fake.write('hvcC',106);fake[111]=1;fake[122]=186;
assert.equal(inspect(fake)[0].hvcC.levelIdc,186);assert.equal(inspect(fake)[0].hvcC.profileIdc,1);assert.equal(inspect(fake)[0].width,1080);

const routes=['hot-drama','hot-real-drama','hot-comic-drama','hot-ai-drama'];
const pools=[];
for(const route of data.candidates.length?[]:routes){
 const response=await axios.get('https://hongguoduanju.com/rank/'+route,{timeout:25000});
 pools.push(Array.from(api.rankData(response.data).rankList,item=>({route,id:String(item.seriesId||item.id),title:item.title,videoId:String(item.episodeVids?.[0]||'')})));
 await pause();
}
const seen=new Set();
for(let index=0;index<20;index++)for(const pool of pools){const row=pool[index];if(row&&!seen.has(row.id)){seen.add(row.id);data.candidates.push(row);}}
persist();
const crossRoutes=new Set(['hot-real-drama','hot-comic-drama','hot-ai-drama']);
const completeMode=process.argv.includes('--complete');
const crossIds=new Set(['7686713195246930968','7690494161551625241','7691938290202577944']);
for(const row of data.series)if(row.crossQuality&&row.samples.length===row.available.filter(q=>q.codec!=='bytevc2').length&&row.samples.length)crossRoutes.delete(row.route);
async function sample(series,row){
 await pause();
 const stream=await api.resolveStream(series.videoId,row.key);
 const response=await api.remoteRange(stream,0,262143);
 let bytes=Buffer.from(response.data);
 const firstBoxSize=bytes.readUInt32BE(0);
 if(bytes.toString('ascii',firstBoxSize+4,firstBoxSize+8)==='moov'){
  const end=firstBoxSize+bytes.readUInt32BE(firstBoxSize);
  if(end>bytes.length){
   if(end>8*1024*1024||end>response.total)throw Error('moov exceeds safe inspection bounds');
   await pause();const extra=await api.remoteRange(stream,bytes.length,end-1);bytes=Buffer.concat([bytes,Buffer.from(extra.data)]);
  }
 }
 const tracks=inspect(bytes);const video=tracks.find(track=>track.codec==='HEVC'||track.codec==='AVC');
 if(!video)throw Error('No validated video stsd/hvcC/avcC in first 256KiB');
 const file=path.join(output,series.id+'-'+row.key.replace(/[^a-z0-9_-]/gi,'_')+'.bin');fs.writeFileSync(file,bytes);
 const probe=spawnSync('F:/software/ffmpeg-master-latest-win64-gpl/bin/ffprobe.exe',['-v','quiet','-show_entries','stream=codec_name,codec_type,profile,level,width,height,r_frame_rate,avg_frame_rate','-of','json',file],{encoding:'utf8',timeout:20000});
 let ffprobe=null;try{ffprobe=JSON.parse(probe.stdout||'null');}catch{}
 const hevcProbe=ffprobe?.streams?.find(track=>track.codec_name==='hevc');
 if(video.hvcC&&hevcProbe)assert.equal(video.hvcC.levelIdc,hevcProbe.level);
 return {qualityKey:row.key,qualityLabel:String(row.quality),reportedCodec:row.item.codec_type||null,reportedWidth:row.item.vwidth||row.item.width||null,reportedHeight:row.item.vheight||row.item.height||null,
  resolvedQuality:stream.quality,tracks,ffprobe,ffprobeExit:probe.status,bytes:bytes.length,totalBytes:response.total,headerSHA256:hash(bytes),localFile:file.replaceAll('\\','/')};
}
for(const candidate of data.candidates){
 const successful=data.series.filter(row=>row.samples.some(sample=>sample.tracks.some(track=>track.hvcC||track.codec==='AVC'))).length;
 if(!completeMode&&successful>=20&&crossRoutes.size===0)break;
 let series=data.series.find(row=>row.id===candidate.id);
 if(completeMode&&!series)continue;
 if(completeMode&&series?.samples.length&&!crossIds.has(series.id))continue;
 if(!completeMode&&series?.samples.length&&!crossRoutes.has(series.route))continue;
 if(!series){series={...candidate,available:[],samples:[],errors:[]};data.series.push(series);}
 if(series.errors.length){series.previousErrors=[...(series.previousErrors||[]),...series.errors];series.errors=[];}
 try{
  if(!series.videoId)throw Error('First episode ID missing in official rank response');
  await pause();const info=await api.fetchVideoInfo(series.videoId);
  series.available=Array.from(info.rows,row=>({key:row.key,quality:String(row.quality),codec:row.item.codec_type||null,width:row.item.vwidth||row.item.width||null,height:row.item.vheight||row.item.height||null}));
  series.modelCodecInventory=Object.values(info.info.video_list||{}).map(row=>row?.codec_type||null);
  const rows=Array.from(info.rows).filter(row=>row.item.codec_type!=='bytevc2');
  const cross=completeMode?crossIds.has(series.id):crossRoutes.has(series.route);series.crossQuality=cross;
  const selected=cross?rows:rows.slice(0,1);
  if(!selected.length)throw Error('No supported quality rows');
  for(const row of selected){if(series.samples.some(sample=>sample.qualityKey===row.key))continue;try{const result=await sample(series,row);series.samples.push(result);console.log(JSON.stringify({seriesId:series.id,quality:row.key,codec:result.tracks[0]?.codec,level:result.tracks.find(t=>t.hvcC)?.hvcC.level,width:result.tracks.find(t=>t.hvcC)?.width,height:result.tracks.find(t=>t.hvcC)?.height}));}catch(error){series.errors.push({qualityKey:row.key,error:String(error.message).replace(/https?:\/\/\S+/g,'[URL omitted]')});}}
  if(cross&&series.samples.length===selected.length)crossRoutes.delete(series.route);
 }catch(error){series.errors.push({error:String(error.message).replace(/https?:\/\/\S+/g,'[URL omitted]')});}
 for(const error of series.errors)data.failures.push({seriesId:series.id,...error});
 persist();
 console.log(JSON.stringify({progress:data.series.filter(row=>row.samples.length).length,attempted:data.series.length,failures:data.failures.length}));
}
data.finishedAt=new Date().toISOString();data.remainingCrossRoutes=[...crossRoutes];persist();
if(completeMode){data.completeCrossSeries=data.series.filter(row=>crossIds.has(row.id)&&row.samples.length===row.available.length).map(row=>row.id);persist();assert.equal(data.completeCrossSeries.length,3);}
const success=data.series.filter(row=>row.samples.length).length;
console.log(JSON.stringify({successfulSeries:success,attempted:data.series.length,samples:data.series.reduce((n,row)=>n+row.samples.length,0),failures:data.failures.length,remainingCrossRoutes:[...crossRoutes]}));
if(success<20||crossRoutes.size)process.exitCode=1;
