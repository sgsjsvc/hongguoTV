import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, fork } from 'node:child_process';
import assert from 'node:assert/strict';

const evidence = path.resolve('outputs/testing/b1-vendor');
const extracted = path.join(evidence, 'fallback-extracted');
fs.mkdirSync(extracted, { recursive: true });
const unpack = spawnSync('tar', ['-xf', path.resolve('outputs/bundles/hongguotv-web-win-x64.zip'), '-C', extracted], { windowsHide: true });
assert.equal(unpack.status, 0, unpack.stderr?.toString());
const root = path.join(extracted, 'hongguotv-web-win-x64');
const shared = path.join(root, 'shared/content-core/hongguo.js');
const disabled = shared + '.disabled-for-fallback-test';
for (const file of [shared, disabled]) assert.ok(path.resolve(file).startsWith(extracted + path.sep));
const authority = fs.readFileSync('shared/content-core/hongguo.js');
for (const name of ['shared/content-core/hongguo.js', 'custom-server/vendor/hongguo.cjs', 'server/vendor/hongguo.cjs']) assert.ok(fs.readFileSync(path.join(root, name)).equals(authority), name + ' must match authority');
fs.renameSync(shared, disabled); // Only the extracted test copy, never the working source or staged bundle.
const log = fs.createWriteStream(path.join(evidence, 'fallback-server.log'));
const child = fork(path.join(root, 'custom-server/index.mjs'), [], {
  execPath: path.join(root, 'runtime/node.exe'), cwd: root,
  env: { ...process.env, HG_PORT: '0', HG_HOST: '127.0.0.1', HG_DATA_DIR: path.join(evidence, 'fallback-data') },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
});
child.stdout.pipe(log); child.stderr.pipe(log);
try {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('fallback startup timed out')), 20000);
    child.on('message', message => { if (message?.type === 'ready') { clearTimeout(timer); resolve(message.port); } });
    child.once('exit', code => { clearTimeout(timer); reject(Error('fallback startup exited ' + code)); });
  });
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  const health = await response.json();
  assert.equal(response.status, 200); assert.equal(health.playback.engineLoaded, true);
  assert.equal(health.playback.stats.total, 0);
  const result = { sharedAbsent: !fs.existsSync(shared), bothVendorCopiesMatchSource: true, bundledNode: true, healthStatus: response.status, engineLoaded: health.playback.engineLoaded, stats: health.playback.stats,
    md5: crypto.createHash('md5').update(authority).digest('hex') };
  fs.writeFileSync(path.join(evidence, 'fallback-process-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  if (child.connected) child.send({ type: 'shutdown' });
  await Promise.race([new Promise(r => child.once('exit', r)), new Promise(r => setTimeout(r, 6000))]);
  if (child.exitCode === null) child.kill();
  log.end();
  fs.renameSync(disabled, shared);
}
