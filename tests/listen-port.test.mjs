import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {EventEmitter} from 'node:events';
import {listenWithFallback, serviceListenOptions} from '../shared/listen-port.mjs';

test('HG_PORT is strict and takes precedence, while PORT=0 stays ephemeral',()=>{
 assert.deepEqual(serviceListenOptions(8788,{HG_PORT:'8899',PORT:'9000'}),{port:8899,attempts:1});
 assert.deepEqual(serviceListenOptions(8788,{PORT:'0'}),{port:0,attempts:11});
 assert.deepEqual(serviceListenOptions(8788,{}),{port:8788,attempts:11});
});
test('real occupied port falls back, emits actual port, and leaves no temporary listeners',async t=>{
 const occupied=http.createServer();await listenWithFallback(occupied,24000,'127.0.0.1');t.after(()=>occupied.close());
 const server=http.createServer();t.after(()=>server.close());
 const port=await listenWithFallback(server,occupied.address().port,'127.0.0.1',11,()=>{});
 assert.ok(port>occupied.address().port);assert.equal(server.address().port,port);assert.equal(server.listenerCount('error'),0);
});
test('eleven occupied ports produce guidance and stop retrying; explicit port tries once',async()=>{
 for(const attempts of [1,11]){
  class Busy extends EventEmitter{tried=[];listen(port){this.tried.push(port);queueMicrotask(()=>this.emit('error',Object.assign(Error('busy'),{code:'EADDRINUSE'})));}}
  const server=new Busy();await assert.rejects(listenWithFallback(server,8788,'127.0.0.1',attempts,()=>{}),error=>error.code==='EADDRINUSE'&&/netstat/.test(error.message)&&/HG_PORT/.test(error.message));
  assert.equal(server.tried.length,attempts);assert.equal(server.tried.at(-1),8788+attempts-1);assert.equal(server.listenerCount('error'),0);assert.equal(server.listenerCount('listening'),0);
 }
});
test('ephemeral port works, invalid ports and non-collision errors never retry',async t=>{
 const server=http.createServer();t.after(()=>server.close());assert.ok(await listenWithFallback(server,0,'127.0.0.1'));
 await assert.rejects(listenWithFallback(http.createServer(),65536,'127.0.0.1'),/端口/);
 class Denied extends EventEmitter{n=0;listen(){this.n++;queueMicrotask(()=>this.emit('error',Object.assign(Error('denied'),{code:'EACCES'})));}}
 const denied=new Denied();await assert.rejects(listenWithFallback(denied,8788,'127.0.0.1'),/EACCES/);assert.equal(denied.n,1);
});
