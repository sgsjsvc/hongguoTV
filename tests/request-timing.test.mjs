import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { once } from 'node:events';
import { traceRequest } from '../custom-server/request-timing.mjs';
test('request trace sanitizes route and query, header measures TTFB, finish logs total once', () => {
  let now=100; const logs=[]; const headers={};
  const res=new EventEmitter(); res.statusCode=200;
  res.setHeader=(k,v)=>{headers[k]=v;}; res.getHeader=k=>headers[k]; res.writeHead=function(){return this;};
  const original=res.writeHead;
  traceRequest({method:'GET',url:'/api/series/secret-id?key=private'},res,{now:()=>now,log:line=>logs.push(line)});
  now=125;res.writeHead(200); assert.match(headers['Server-Timing'],/^app;dur=25\.000$/);
  now=150;res.emit('finish');res.emit('close');
  assert.equal(logs.length,1);assert.match(logs[0],/cost=50\.000ms/);assert.match(logs[0],/\/api\/series\/:id/);
  assert.ok(!logs[0].includes('secret-id'));assert.ok(!logs[0].includes('private'));assert.equal(res.writeHead,original);
});
test('aborted response logs once, keeps existing server metrics, ignores malformed/sensitive routes', () => {
  let now=0;const logs=[],headers={'Server-Timing':'other;dur=4'};const res=new EventEmitter();
  res.setHeader=(k,v)=>headers[k]=v;res.getHeader=k=>headers[k];res.writeHead=()=>{};res.statusCode=503;
  traceRequest({method:'POST',url:'/unknown/credential?token=secret'},res,{now:()=>now,log:x=>logs.push(x)});
  now=5;res.writeHead();assert.equal(headers['Server-Timing'],'other;dur=4, app;dur=5.000');res.emit('close');res.emit('close');
  assert.match(logs[0],/aborted=true/);assert.match(logs[0],/route=other/);assert.equal(logs.length,1);
});
test('real HTTP end emits Server-Timing and logs once across finish/close without URL secrets', async()=>{
  const logs=[];
  const server=http.createServer((req,res)=>{
    traceRequest(req,res,{log:line=>logs.push(line)});
    setTimeout(()=>{res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');},25);
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/episodes/private-id/qualities?token=secret`);
    assert.equal(response.status,200);assert.ok(Number(response.headers.get('Server-Timing').match(/dur=([\d.]+)/)[1])>=20);
    assert.deepEqual(await response.json(),{ok:true});await new Promise(resolve=>setImmediate(resolve));
    assert.equal(logs.length,1);assert.match(logs[0],/route=\/api\/episodes\/:id\/qualities/);assert.match(logs[0],/aborted=false/);
    assert.ok(!logs[0].includes('private-id'));assert.ok(!logs[0].includes('secret'));
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
