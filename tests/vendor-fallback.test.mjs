import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const authority = 'shared/content-core/hongguo.js';
const vendors = ['custom-server/vendor/hongguo.cjs', 'server/vendor/hongguo.cjs'];
const consumers = ['custom-server/index.mjs', 'server/provider.mjs'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function load(file, exportBody, post = async () => ({ status: 200, data: '{}' })) {
  const client = Object.assign(async () => ({ status: 200, data: '{}' }), { post });
  const context = vm.createContext({
    Buffer, URL, URLSearchParams,
    require: name => { assert.equal(name, 'node:crypto'); return crypto; },
    axios: client,
  });
  vm.runInContext(fs.readFileSync(file, 'utf8') + '\nthis.api = {' + exportBody + '};', context, { timeout: 5000 });
  return context.api;
}

test('both fallback engines remain byte-for-byte synchronized with the authoritative engine', () => {
  for (const file of vendors) assert.equal(hash(file), hash(authority), `${file} is stale; synchronize from ${authority}`);
});

for (const file of vendors) {
  for (const consumer of consumers) {
    test(`${file}: loads every dynamically extracted ${consumer} export when shared is unavailable`, () => {
      const source = fs.readFileSync(consumer, 'utf8');
      const match = /this\.api\s*=\s*\{([^}]+)\}/.exec(source);
      assert.ok(match, `No VM export contract found in ${consumer}`);
      // Execute the actual consumer object body, so future exports are automatically covered.
      const api = load(file, match[1]);
      assert.ok(Object.keys(api).length > 0);
      for (const [name, value] of Object.entries(api)) assert.notEqual(value, undefined, `${consumer} requires ${name}`);
    });
  }

  test(`${file}: empty body retries with a new device and records upstream counters`, async () => {
    const ids = [];
    const api = load(file, 'requestVideoModel, upstreamStats', async url => {
      ids.push(new URL(url).searchParams.get('device_id'));
      return { status: 200, data: ids.length === 1 ? '' : JSON.stringify({ BaseResp: { StatusCode: 0 }, data: { marker: 'ok' } }) };
    });
    const result = await api.requestVideoModel('9007199254740993');
    assert.equal(result.data.marker, 'ok');
    assert.equal(ids.length, 2); assert.equal(new Set(ids).size, 2);
    assert.equal(api.upstreamStats.total, 2); assert.equal(api.upstreamStats.empty, 1); assert.equal(api.upstreamStats.ok, 1);
  });

  test(`${file}: repeated empty bodies fail at the bounded retry limit`, async () => {
    const ids = [];
    const api = load(file, 'requestVideoModel, upstreamStats', async url => {
      ids.push(new URL(url).searchParams.get('device_id')); return { status: 200, data: '' };
    });
    await assert.rejects(api.requestVideoModel('123'), /连续 5 次返回空响应体/);
    assert.equal(ids.length, 5); assert.equal(new Set(ids).size, 5);
    assert.equal(api.upstreamStats.empty, 5); assert.equal(api.upstreamStats.ok, 0);
  });
}
