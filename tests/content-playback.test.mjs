import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const source = fs.readFileSync(new URL('../shared/content-core/hongguo.js', import.meta.url), 'utf8');
function fixture(publicResponse) {
  const calls = [];
  const axios = async (url, options) => {
    calls.push({ url, options });
    return publicResponse;
  };
  axios.post = async () => ({ status: 200, data: JSON.stringify({ Code: 110001, Message: '未知异常' }) });
  const context = vm.createContext({ Buffer, URL, URLSearchParams, axios, require: () => crypto });
  vm.runInContext(source + '\nthis.api={fetchVideoInfo,resolveStream,videoInfoCache};', context);
  return { api: context.api, calls };
}
test('unavailable App video model falls back to verified public MP4 and reports its real quality', async () => {
  const bytes = Buffer.alloc(32);
  bytes.writeUInt32BE(24, 0);
  bytes.write('ftyp', 4, 'ascii');
  const { api, calls } = fixture({ status: 206, data: bytes, headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-31/15000000' } });
  const info = await api.fetchVideoInfo('7686715217652223038');
  assert.equal(info.rows.length, 1);
  assert.equal(info.rows[0].quality, '360');
  assert.equal(info.source, 'official-public');
  const stream = await api.resolveStream('7686715217652223038', '1080P');
  assert.equal(stream.quality, '360P');
  assert.equal(stream.key, null);
  assert.match(stream.url, /\/video\/public\/7686715217652223038\/360p\.mp4$/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.Range, 'bytes=0-31');
});
test('unavailable or non-video public responses never become a fabricated quality', async () => {
  for (const response of [{ status: 404, data: Buffer.alloc(0) }, { status: 206, data: Buffer.from('not a video response') }]) {
    const { api } = fixture(response);
    await assert.rejects(api.fetchVideoInfo('7686715217652223038'), /110001/);
    assert.equal(api.videoInfoCache.size, 0);
  }
});

test('working original video source keeps its available high quality without public fallback', async () => {
  const requests = [];
  const axios = async url => {
    requests.push(url);
    return { status: 200, data: JSON.stringify({ video_info: { data: { video_list: { hd: { height: 1080, main_url: 'https://example.test/video.mp4', codec_type: 'bytevc1' } } } } }) };
  };
  axios.post = async () => ({ status: 200, data: JSON.stringify({ Code: 0, data: { '7686715217652223038': { video_model: { fallback_api: 'https://example.test/video-info' } } } }) });
  const context = vm.createContext({ Buffer, URL, URLSearchParams, axios, require: () => crypto });
  vm.runInContext(source + '\nthis.api={fetchVideoInfo,resolveStream};', context);
  const info = await context.api.fetchVideoInfo('7686715217652223038');
  assert.equal(info.rows[0].quality, '1080');
  const stream = await context.api.resolveStream('7686715217652223038', '1080P');
  assert.equal(stream.quality, '1080P');
  assert.equal(requests.length, 1);
  assert.equal(requests[0], 'https://example.test/video-info');
});
