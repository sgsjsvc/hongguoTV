// No dependencies. Run --help for isolation/cache semantics and privacy limits.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile, fork } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const delay = ms => new Promise(r => setTimeout(r, ms));
export function summarize(values) {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  const at = p => sorted.length ? sorted[Math.max(0, Math.ceil(p*sorted.length)-1)] : null;
  return { count: sorted.length, p50: at(.5), p95: at(.95), p99: at(.99) };
}
export function resourcePhases(e) {
  return { dnsMs: e.domainLookupEnd-e.domainLookupStart, tcpMs: (e.secureConnectionStart > 0 ? e.secureConnectionStart : e.connectEnd)-e.connectStart,
    tlsMs: e.secureConnectionStart > 0 ? e.connectEnd-e.secureConnectionStart : 0,
    ttfbMs: e.responseStart-e.requestStart, contentMs: e.responseEnd-e.responseStart, totalMs: e.responseEnd-e.startTime };
}
const fields = ['variant','seriesIndex','kind','cache','status','dnsMs','tcpMs','tlsMs','ttfbMs','contentMs','totalMs','serverMs'];
export function toCsv(rows) {
  const quote = value => '"'+String(value ?? '').replaceAll('"','""')+'"';
  return fields.join(',')+'\n'+rows.map(row => fields.map(k => quote(row[k] ?? row.phases?.[k])).join(',')).join('\n')+'\n';
}
export function findBrowser() {
  const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  return candidates.find(x => fs.existsSync(x));
}
export async function startBrowser() {
  const binary = findBrowser();
  if (!binary) throw Error('Chrome/Edge not found; set CHROME_PATH');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hg-perf-cdp-'));
  const child = spawn(binary, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], { windowsHide:true, stdio:'ignore' });
  let spawnError; child.once('error',error=>{spawnError=error;});
  const stop = async () => { child.kill(); await Promise.race([new Promise(r => child.once('exit',r)), delay(2000)]); try { fs.rmSync(profile,{recursive:true,force:true}); } catch {} };
  try {
    for (let i=0;i<200;i++) {
      const active = path.join(profile,'DevToolsActivePort');
      if(spawnError)throw spawnError;
      if (fs.existsSync(active)) return { endpoint:'http://127.0.0.1:'+fs.readFileSync(active,'utf8').split('\n')[0], stop, binary };
      if (child.exitCode !== null) throw Error('Chrome exited before CDP ready');
      await delay(50);
    }
    throw Error('CDP startup timed out');
  } catch(e) { await stop(); throw e; }
}
export async function connectCdp(endpoint, base) {
  const page = await (await fetch(endpoint+'/json/new?'+encodeURIComponent(base), {method:'PUT'})).json();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject) => { ws.addEventListener('open',resolve,{once:true}); ws.addEventListener('error',reject,{once:true}); });
  let seq=0; const pending=new Map();
  ws.addEventListener('message', e => { const msg=JSON.parse(e.data); const p=pending.get(msg.id); if (p) { pending.delete(msg.id); clearTimeout(p.timer); msg.error ? p.reject(Error(msg.error.message)) : p.resolve(msg.result); } });
  const send = (method,params={}) => new Promise((resolve,reject) => { const id=++seq; const timer=setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: '+method)); },65000); pending.set(id,{resolve,reject,timer}); ws.send(JSON.stringify({id,method,params})); });
  const close = () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(Error('CDP closed')); } pending.clear(); ws.close(); };
  await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Page.navigate',{url:base});
  for(let i=0;i<100;i++) { const r=await send('Runtime.evaluate',{expression:'document.readyState'}); if(r.result.value==='complete') break; await delay(20); }
  return {send,close};
}
export async function browserRequest(cdp, url, extract=false) {
  // Body stays inside browser unless corpus metadata is explicitly requested; never persisted.
  const expression = `(async()=>{performance.clearResourceTimings();const t=performance.now();const r=await fetch(${JSON.stringify(url)},{cache:'no-store',signal:AbortSignal.timeout(55000)});const text=await r.text();const e=performance.getEntriesByName(r.url).at(-1);let body,validJson=false;try{body=JSON.parse(text);validJson=true}catch{};return {status:r.status,elapsedMs:performance.now()-t,entry:e?.toJSON(),serverMs:e?.serverTiming?.find(x=>x.name==='app')?.duration??null,itemCount:Array.isArray(body?.items)?body.items.length:0,episodeCount:Array.isArray(body?.episodes)?body.episodes.length:0,qualityCount:Array.isArray(body?.qualities)?body.qualities.length:0,${extract ? 'items:(Array.isArray(body?.items)?body.items:[]).map(x=>({id:String(x.id)})),episodes:(Array.isArray(body?.episodes)?body.episodes:[]).slice(0,1).map(x=>({id:String(x.id)})),' : ''}validJson}})()`;
  const result = await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails) throw Error('Browser fetch failed: '+result.exceptionDetails.text);
  const value=result.result.value;
  if(!value?.entry) throw Error('Browser resource timing unavailable');
  const {entry,...safe}=value; return {...safe,phases:resourcePhases(entry)};
}
export async function sampleProcess(pid) {
  if(process.platform==='win32') {
    const result=await exec('powershell.exe',['-NoProfile','-Command',`$p=Get-Process -Id ${Number(pid)} -ErrorAction Stop; @{cpuMs=$p.TotalProcessorTime.TotalMilliseconds;rssBytes=$p.WorkingSet64}|ConvertTo-Json -Compress`],{windowsHide:true});
    return {at:Date.now(),...JSON.parse(result.stdout)};
  }
  const result=await exec('ps',['-p',String(Number(pid)),'-o','time=,rss=']);
  const [time,rss]=result.stdout.trim().split(/\s+/); const parts=time.split(':').map(Number);
  return {at:Date.now(),cpuMs:parts.reduce((acc,n)=>acc*60+n,0)*1000,rssBytes:Number(rss)*1024};
}
export async function startServer(serverRoot, dataDir) {
  fs.mkdirSync(dataDir,{recursive:true});
  const child=fork(path.join(serverRoot,'custom-server/index.mjs'),[],{cwd:serverRoot,env:{...process.env,HG_PORT:'0',HG_HOST:'127.0.0.1',HG_DATA_DIR:dataDir,HG_PREFETCH_ENABLED:'0'},stdio:['ignore','ignore','ignore','ipc']});
  let port;
  try { port=await new Promise((resolve,reject)=> { const timer=setTimeout(()=>reject(Error('Isolated server startup timeout')),20000); child.once('error',reject); child.once('exit',code=>{clearTimeout(timer);reject(Error('Isolated server exited '+code));}); child.on('message',msg=>{if(msg.type==='ready'){clearTimeout(timer);resolve(msg.port);}}); }); }
  catch(error){child.kill();throw error;}
  return {base:`http://127.0.0.1:${port}`,pid:child.pid,stop:async()=>{child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),delay(2000)]);}};
}
export function visualReport(runs) {
  const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const colors=['#ff486f','#46c7ed','#f9c74f'];
  const groups=runs.map(run=>({name:run.variant,values:run.rows.filter(r=>r.kind==='qualities'&&r.cache==='cold').map(r=>r.phases?.totalMs ?? 0)}));
  const max=Math.max(1,...groups.flatMap(g=>g.values));
  return `<!doctype html><meta charset="utf-8"><title>B5 browser timing</title><style>body{background:#101623;color:#eee;font:16px system-ui;margin:30px}table{border-collapse:collapse}td,th{padding:8px}small{color:#9daac0}svg{background:#172136;max-width:100%}</style><h1>Browser API timing</h1><p>Cold = first resource request in this run. Only --spawn-server guarantees a fresh local process and disabled speculative prefetch; external --base server cache/prefetch state is uncontrolled. Browser HTTP cache disabled. CDN/upstream cache always uncontrolled. Failed requests remain in JSON and are excluded from percentiles.</p><h2>Cold qualities heatmap (ms)</h2><table>${groups.map(g=>`<tr><th>${esc(g.name)}</th>${g.values.map(v=>`<td style="background:rgba(255,72,111,${.08+.85*v/max})">${v.toFixed(0)}</td>`).join('')}</tr>`).join('')}</table><h2>Paired series line chart</h2><svg viewBox="0 0 1000 360" role="img" aria-label="Qualities latency for each series">${groups.map((g,i)=>`<polyline fill="none" stroke="${colors[i%3]}" stroke-width="2" points="${g.values.map((v,j)=>`${40+j*920/Math.max(1,g.values.length-1)},${310-v/max*270}`).join(' ')}"/><text x="40" y="${20+i*20}" fill="${colors[i%3]}">${esc(g.name)}</text>`).join('')}<text x="5" y="100" fill="white">${max.toFixed(0)}ms</text><text x="5" y="315" fill="white">0</text></svg>`;
}
export async function main(argv=process.argv.slice(2)) {
  const arg=name=>argv.find(x=>x.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
  if(argv.includes('--help')) { console.log('node scripts/perf/measure-end-to-end.mjs --spawn-server --server-root=PATH --variant=LABEL --out=DIR --corpus=FILE --count=30\nAlternative: --base=http://127.0.0.1:8788 --server-pid=PID. Only loopback URLs supported. Cold=first resource access (not upstream/CDN cold). Browser HTTP cache disabled. Fresh server and disabled prefetch only with --spawn-server; external --base state uncontrolled. No media requests or bodies saved. --compare=baseline.json emits paired HTML. CPU sampling only measures target Node process, not Chrome/OS.'); return; }
  const output=path.resolve(arg('out')||'outputs/testing/b5/current'); fs.mkdirSync(output,{recursive:true});
  const count=Number(arg('count')||30); if(!Number.isInteger(count)||count<1||count>200) throw Error('count must be 1..200');
  let server,browser,cdp,timer;
  const rows=[],resources=[]; let sampling=false;
  try {
    if(argv.includes('--spawn-server')) server=await startServer(path.resolve(arg('server-root')||root),path.join(output,'data'));
    const base=server?.base||arg('base')||'http://127.0.0.1:8788';
    if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname)) throw Error('Use a loopback local backend only');
    const pid=server?.pid||Number(arg('server-pid'));
    if(pid) { const take=async()=>{if(sampling)return; sampling=true;try{resources.push(await sampleProcess(pid));}catch{}finally{sampling=false;}};await take();timer=setInterval(take,1000); }
    browser=await startBrowser(); cdp=await connectCdp(browser.endpoint,base+'/health');
    const variant=arg('variant')||'current';
    let corpus=arg('corpus')&&fs.existsSync(arg('corpus')) ? JSON.parse(fs.readFileSync(arg('corpus'),'utf8')) : [];
    if(!corpus.length) {
      const ids=new Set(); const session='b5-'+Date.now();
      for(let page=1;page<=10&&ids.size<count;page++) {
        const rec=await browserRequest(cdp,`${base}/api/recommend?page=${page}&session=${session}`,true);
        if(rec.status!==200) throw Error('Corpus recommendation HTTP '+rec.status);
        for(const row of rec.items) if(row.id&&row.id!=='undefined')ids.add(row.id);
      }
      corpus=[...ids].slice(0,count).map(id=>({id}));
      if(corpus.length<count) throw Error(`Only ${corpus.length}/${count} unique series available`);
    }
    corpus=corpus.slice(0,count);
    for(let i=0;i<corpus.length;i++) {
      const entry=corpus[i];
      for(const cache of ['cold','warm']) {
        try {
          const result=await browserRequest(cdp,`${base}/api/series/${encodeURIComponent(entry.id)}`,true);
          entry.episodeId ||= result.episodes?.[0]?.id;
          const {items,episodes,...safe}=result;
          rows.push({variant,seriesIndex:i+1,kind:'detail',cache,...safe,apiValid:result.episodeCount>0});
        } catch { rows.push({variant,seriesIndex:i+1,kind:'detail',cache,status:0,error:'Browser request failed'}); }
      }
      if(!entry.episodeId) { rows.push({variant,seriesIndex:i+1,kind:'qualities',cache:'cold',status:0,error:'No episode'});continue; }
      for(const cache of ['cold','warm']) {
        try { const result=await browserRequest(cdp,`${base}/api/episodes/${encodeURIComponent(entry.episodeId)}/qualities?seriesId=${encodeURIComponent(entry.id)}`); rows.push({variant,seriesIndex:i+1,kind:'qualities',cache,...result,apiValid:result.qualityCount>0}); }
        catch { rows.push({variant,seriesIndex:i+1,kind:'qualities',cache,status:0,error:'Browser request failed'}); }
      }
      console.log(`${variant} ${i+1}/${corpus.length}`);
    }
    const summary={};
    for(const kind of ['detail','qualities']) for(const cache of ['cold','warm']) summary[kind+'-'+cache]=summarize(rows.filter(r=>r.kind===kind&&r.cache===cache&&r.status===200&&r.validJson&&r.apiValid).map(r=>r.phases?.totalMs));
    clearInterval(timer);if(pid){while(sampling)await delay(20);resources.push(await sampleProcess(pid));}
    const first=resources[0],last=resources.at(-1);
    const cpuSummary=resources.length>1?{sampleCount:resources.length,cpuMs:last.cpuMs-first.cpuMs,wallMs:last.at-first.at,averageOneCorePercent:100*(last.cpuMs-first.cpuMs)/Math.max(1,last.at-first.at),peakRssBytes:Math.max(...resources.map(x=>x.rssBytes))}:null;
    const report={variant,createdAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,browser:browser.binary,pid,logicalCpus:os.cpus().length},semantics:{cold:'first access per resource; fresh server only with --spawn-server',serverFresh:!!server,browserHttpCache:false,prefetch:server?false:'uncontrolled',upstreamCold:false,cpuScope:'target Node process only; serial ~1s OS snapshots; CPU milliseconds cumulative'},summary,cpuSummary,rows,resources};
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2)); fs.writeFileSync(path.join(output,'results.csv'),toCsv(rows));
    fs.writeFileSync(path.join(output,'corpus.json'),JSON.stringify(corpus,null,2));
    if(arg('corpus')&&!fs.existsSync(arg('corpus'))) fs.writeFileSync(arg('corpus'),JSON.stringify(corpus,null,2));
    const compare=arg('compare') ? JSON.parse(fs.readFileSync(arg('compare'),'utf8')):null;
    fs.writeFileSync(path.join(output,'comparison.html'),visualReport(compare?[compare,report]:[report]));
    console.log(JSON.stringify(summary,null,2));
    if(rows.some(r=>r.status!==200||!r.validJson||!r.apiValid)) throw Error('Failed samples retained; see results.json');
  } finally { clearInterval(timer); cdp?.close();await browser?.stop();await server?.stop(); }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e.message);process.exitCode=1;});
