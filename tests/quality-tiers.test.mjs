import {createPrefetchMetrics} from '../custom-server/prefetch-metrics.mjs';
import {traceRequest} from '../custom-server/request-timing.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import http from 'node:http';
import { createPrefetchQueue, sharedResource } from '../server/provider.mjs';

const files = ['shared/content-core/hongguo.js', 'custom-server/vendor/hongguo.cjs', 'server/vendor/hongguo.cjs'];
function payloadFromEngine(file, hostCrypto = crypto) {
  let payload;
  const context = vm.createContext({ Buffer, URL, URLSearchParams, require: () => hostCrypto,
    axios: { post: async (_url, body) => { payload = JSON.parse(body); return { status: 200, data: '{"BaseResp":{"StatusCode":0}}' }; } },
  });
  vm.runInContext(fs.readFileSync(file, 'utf8') + '\nthis.request = requestVideoModel;', context, { timeout: 5000 });
  return { request: () => context.request('9007199254740993'), payload: () => payload };
}
for (const file of files) {
  test(`${file}: actual signed video-model payload requests all definitions with device level 5`, async () => {
    const engine = payloadFromEngine(file); await engine.request();
    assert.equal(engine.payload().biz_param.device_level, 5);
    assert.equal(engine.payload().biz_param.need_all_video_definition, true);
    assert.equal(engine.payload().video_id, '9007199254740993');
  });
}
test('TV-like crypto host without randomBytes sends the same device-level payload', async () => {
  const engine = payloadFromEngine(files[0], { createHash: name => crypto.createHash(name), createDecipheriv: (...args) => crypto.createDecipheriv(...args) });
  await engine.request(); assert.equal(engine.payload().biz_param.device_level, 5);
});
test('qualities endpoint continues excluding private bytevc2 streams', async t => {
  const source = fs.readFileSync('custom-server/index.mjs', 'utf8');
  const context = vm.createContext({ http, URL, Buffer, AbortController, process, createPrefetchQueue, sharedResource, createPrefetchMetrics, traceRequest,
    hgEngine: { qualityNumber: value => Number(value), fetchVideoInfo: async () => ({ rows: [
      { key: 'video_4', quality: 720, item: { codec_type: 'bytevc2' } },
      { key: 'video_5', quality: 1080, item: { codec_type: 'bytevc1' } },
    ] }) }, handleLibrary: async () => false, handleHistory: async () => false, console: { warn() {}, error() {} },
  });
  vm.runInContext(source.slice(source.indexOf('function json('), source.indexOf('listenWithFallback(server, PORT')) + '\nthis.server = server;this.queue = prefetchQueue;', context);
  await new Promise(r => context.server.listen(0, '127.0.0.1', r));
  t.after(async () => { context.queue.close(); context.server.closeAllConnections(); await new Promise(r => context.server.close(r)); });
  const response = await fetch(`http://127.0.0.1:${context.server.address().port}/api/episodes/123/qualities`);
  assert.equal(response.status, 200);
  const data = await response.json(); assert.deepEqual(data.qualities.map(row => row.key), ['1080P']);
  assert.equal(data.qualities[0].codec, 'HEVC');
});
