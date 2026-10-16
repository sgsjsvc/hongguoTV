import fs from 'node:fs';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const out = path.resolve('outputs/testing/q1-quality');
const child = fork(path.resolve('custom-server/index.mjs'), [], { env: { ...process.env, HG_PORT: '0', HG_HOST: '127.0.0.1', HG_DATA_DIR: path.join(out, 'data'), HG_PREFETCH_ENABLED: '0' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
const log = fs.createWriteStream(path.join(out, 'server.log')); child.stdout.pipe(log); child.stderr.pipe(log);
try {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('start timeout')), 30000);
    child.on('message', m => { if (m?.type === 'ready') { clearTimeout(timer); resolve(m.port); } });
    child.once('exit', code => { clearTimeout(timer); reject(Error('start exit ' + code)); });
  });
  const base = 'http://127.0.0.1:' + port;
  for (const name of process.argv.includes('--resolution-only') ? ['quality-resolution'] : ['quality-device-level', 'quality-side-effects']) {
    const output = fs.createWriteStream(path.join(out, name + '.log'));
    let args = ['scripts/perf/' + name + '.mjs'];
    if (name === 'quality-resolution') {
      let source = fs.readFileSync('scripts/perf/quality-side-effects.mjs', 'utf8');
      // The supplied script passes l3.info into pick(), which itself reads .vl.
      // Correct only the in-memory verification copy, preserving the coordinator's script.
      source = source.slice(0, source.indexOf('console.log("\\n  --- 2.'))
        .replace('/api/recommend?page=1', '/api/recommend?page=1&session=q1-resolution-fixed-20261016')
        .replace('pick(l3.info, "video_5")', 'pick(l3, "video_5")')
        .replace('pick(l5.info, "video_5")', 'pick(l5, "video_5")')
        .replace('const l3v5 = l3.vl.video_5, l5v5 = l5.vl.video_5;', 'const l3v5 = l3.vl.video_5, l5v5 = l5.vl.video_5; const fields=v=>Object.fromEntries(["vwidth","vheight","bitrate","size","codec_type","definition"].map(k=>[k,v?.[k]])); console.log("  metadata " + JSON.stringify({episode:i+1,vid:eps[i].id,L3:fields(l3v5),L5:fields(l5v5)})); if(!l3v5 || !l5v5 || ["vwidth","vheight","bitrate","size"].some(k=>l3v5[k]!==l5v5[k])) throw Error("1080P metadata differs"); console.log("  metadata matched episode " + (i+1));');
      args = ['--input-type=module', '--eval', source];
    }
    const probe = spawn(process.execPath, args, { env: { ...process.env, BASE: base }, stdio: ['ignore', 'pipe', 'pipe'] });
    probe.stdout.pipe(output); probe.stderr.pipe(output);
    const code = await new Promise(r => probe.once('exit', r));
    await new Promise(r => output.end(r)); assert.equal(code, 0, name);
    const text = fs.readFileSync(path.join(out, name + '.log'), 'utf8');
    if (name === 'quality-device-level') {
      assert.match(text, /汇总（18 个样本）/);
      assert.match(text, /device_level=5[^\n]*90 \/ 总档位 90/);
    } else if (name === 'quality-side-effects') {
      assert.match(text, /1080P 完全一致/);
      assert.match(text, /12 次连续请求: 成功 12, 空响应 0, 错误 0/);
      const a = /L3: bitrate=(\d+).*?size=(\d+)/.exec(text), b = /L5: bitrate=(\d+).*?size=(\d+)/.exec(text);
      assert.ok(a && b); assert.equal(a[1], b[1]); assert.equal(a[2], b[2]);
    } else {
      assert.equal((text.match(/metadata matched episode/g) || []).length, 4);
      assert.ok(!text.includes('错误:'));
    }
    console.log(name + ': strict output checks passed');
  }
} finally {
  if (child.connected) child.send({ type: 'shutdown' });
  await Promise.race([new Promise(r => child.once('exit', r)), new Promise(r => setTimeout(r, 6000))]);
  if (child.exitCode === null) child.kill(); log.end();
}
