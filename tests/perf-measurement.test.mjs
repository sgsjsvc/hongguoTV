import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { summarize, resourcePhases, toCsv, browserRequest, connectCdp, startBrowser, main, visualReport, startServer, sampleProcess, findBrowser } from '../scripts/perf/measure-end-to-end.mjs';

test('percentiles use documented nearest rank, preserve zeros, exclude failures', () => {
  assert.deepEqual(summarize([0, 1, 2, 3, 4, NaN]), { count: 5, p50: 2, p95: 4, p99: 4 });
  assert.deepEqual(summarize([]), { count: 0, p50: null, p95: null, p99: null });
});
test('phase calculation separates TLS from TCP and zero reused connections', () => {
  const r = resourcePhases({ startTime: 2, domainLookupStart: 3, domainLookupEnd: 5, connectStart: 5, secureConnectionStart: 9, connectEnd: 15, requestStart: 16, responseStart: 30, responseEnd: 40 });
  assert.deepEqual(r, { dnsMs: 2, tcpMs: 4, tlsMs: 6, ttfbMs: 14, contentMs: 10, totalMs: 38 });
  assert.equal(resourcePhases({ startTime: 0, domainLookupStart: 0, domainLookupEnd: 0, connectStart: 0, connectEnd: 0, secureConnectionStart: 0, requestStart: 1, responseStart: 5, responseEnd: 6 }).tlsMs, 0);
});
test('CSV quotes arbitrary labels and never emits body fields', () => {
  const out = toCsv([{ variant: 'a,"b', totalMs: 1, body: 'secret' }]);
  assert.match(out, /"a,""b"/);
  assert.ok(!out.includes('secret'));
});
test('real ResourceTiming agrees within 5% with independently measured fetch wall time', { timeout: 60000, skip:!findBrowser() && 'Set CHROME_PATH to run live browser accuracy validation' }, async t => {
  const server = http.createServer((req, res) => {
    if (req.url === '/') { res.end('<!doctype html>'); return; }
    const begin = performance.now();
    setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{"ok":'); setTimeout(() => { const elapsed = performance.now() - begin; res.end('true}'); server.lastElapsed = elapsed; }, 250); }, 250);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  let browser, cdp;
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await startBrowser(); cdp = await connectCdp(browser.endpoint, base);
    for (let i = 0; i < 3; i++) {
      const measured = await browserRequest(cdp, base + '/delayed');
      assert.equal(measured.status, 200);
      // Server elapsed excludes network/browser scheduling and is a lower bound, not
      // an accuracy reference. Compare two independent browser timing APIs around
      // the same real transfer, with measured server delays guarding fake zero data.
      assert.ok(Math.abs(measured.phases.totalMs - measured.elapsedMs) / measured.elapsedMs <= 0.05, JSON.stringify(measured));
      assert.ok(measured.phases.totalMs >= server.lastElapsed-5);
      t.diagnostic(JSON.stringify({ resourceMs:measured.phases.totalMs, independentFetchWallMs:measured.elapsedMs, serverSpanMs:server.lastElapsed, errorPercent:100*Math.abs(measured.phases.totalMs-measured.elapsedMs)/measured.elapsedMs }));
      assert.ok(measured.phases.ttfbMs >= 220);
      assert.ok(measured.phases.contentMs >= 220);
    }
  } finally { cdp?.close(); await browser?.stop(); await new Promise(r => server.close(r)); }
});
test('CLI pipeline writes cold/warm CSV JSON and escaped paired charts without payload/media URL', { timeout:60000,skip:!findBrowser() && 'Set CHROME_PATH to run browser pipeline integration' }, async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'hg-b5-test-'));
  let emptyQualities=false;
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.url.includes('/recommend'))res.end(JSON.stringify({items:[{id:'test-1'},{id:'test-2'}]}));
    else if(req.url.includes('/series/'))res.end(JSON.stringify({episodes:[{id:'episode-test'}],secret:'DO-NOT-PERSIST'}));
    else res.end(JSON.stringify({qualities:emptyQualities?[]:[{url:'https://private-media.invalid/secret'}]}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const output=path.join(folder,'out'),corpus=path.join(folder,'corpus.json');
    await main([`--base=http://127.0.0.1:${server.address().port}`,`--out=${output}`,`--corpus=${corpus}`,'--count=2','--variant=fixture',`--server-pid=${process.pid}`]);
    const report=JSON.parse(fs.readFileSync(path.join(output,'results.json'),'utf8'));
    assert.equal(report.rows.length,8);assert.equal(report.summary['detail-cold'].count,2);
    assert.ok(report.cpuSummary.sampleCount>=2);assert.ok(report.cpuSummary.peakRssBytes>0);
    assert.equal(report.semantics.prefetch,'uncontrolled');assert.equal(report.semantics.serverFresh,false);
    assert.equal(JSON.parse(fs.readFileSync(corpus,'utf8')).length,2);
    for(const filename of ['results.json','results.csv','comparison.html']) {
      const data=fs.readFileSync(path.join(output,filename),'utf8');assert.ok(!data.includes('DO-NOT-PERSIST'));assert.ok(!data.includes('private-media'));
    }
    await main([`--base=http://127.0.0.1:${server.address().port}`,`--out=${path.join(folder,'paired')}`,`--corpus=${corpus}`,'--count=2',`--compare=${path.join(output,'results.json')}`]);
    assert.ok(visualReport([{variant:'<script>',rows:[]}]).includes('&lt;script>'));
    emptyQualities=true;
    await assert.rejects(()=>main([`--base=http://127.0.0.1:${server.address().port}`,`--out=${path.join(folder,'failed')}`,`--corpus=${corpus}`,'--count=1']),/Failed samples retained/);
    const failed=JSON.parse(fs.readFileSync(path.join(folder,'failed/results.json'),'utf8'));
    assert.equal(failed.summary['qualities-cold'].count,0);assert.equal(failed.rows.find(r=>r.kind==='qualities').apiValid,false);
  }finally{await new Promise(r=>server.close(r));fs.rmSync(folder,{recursive:true,force:true});}
});
test('CLI validates count, documents limitations; isolated server and CPU sampler operate', {timeout:30000}, async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'hg-b5-pid-'));let server;
  try {
    await main(['--help']);await assert.rejects(()=>main(['--count=0',`--out=${folder}`]),/count/);
    server=await startServer(path.resolve('.'),path.join(folder,'data'));
    const sample=await sampleProcess(server.pid);assert.ok(sample.rssBytes>0);assert.ok(sample.cpuMs>=0);
    assert.equal((await fetch(server.base+'/health')).status,200);
  } finally{await server?.stop();fs.rmSync(folder,{recursive:true,force:true});}
});
