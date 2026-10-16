import { fork, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const endpoints = [
  { name: '首页 Banner (/api/banners)', path: '/api/banners' },
  { name: '首页专区 (/api/sections)', path: '/api/sections' },
  { name: '首页聚合 (/api/home)', path: '/api/home' },
  { name: '分类标签 (/api/category/tags)', path: '/api/category/tags' },
  { name: '分类列表 (/api/category/list)', path: '/api/category/list?type=short&page=1' },
  { name: '榜单列表 (/api/rank/list)', path: '/api/rank/list?slug=hot-drama&page=1' },
  { name: '四大榜单 (/api/ranks)', path: '/api/ranks' },
  { name: '短剧搜索 (/api/search)', path: '/api/search?q=%E6%88%98%E7%A5%9E' },
  { name: '推荐流 (/api/recommend)', path: '/api/recommend?page=1' }
];

async function runBenchmark() {
  console.log('Starting custom-server instance for benchmark...');
  const tmpDataDir = path.resolve('outputs/debug/bench-data');
  fs.mkdirSync(tmpDataDir, { recursive: true });

  const child = fork('custom-server/index.mjs', [], {
    env: {
      ...process.env,
      HG_PORT: '0',
      HG_DATA_DIR: tmpDataDir,
      HG_MANAGED: '1',
      NODE_ENV: 'benchmark'
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server start timeout')), 15000);
    child.on('message', msg => {
      if (msg?.type === 'ready') {
        clearTimeout(timer);
        resolve(msg.port);
      }
    });
    child.stdout.on('data', data => {
      const match = data.toString().match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });

  console.log(`Server listening on port ${port}. Waiting 2s for background pre-warm...`);
  await new Promise(r => setTimeout(r, 2000));
  const baseUrl = `http://127.0.0.1:${port}`;

  const allResults = [];

  for (const ep of endpoints) {
    console.log(`Testing endpoint: ${ep.name}...`);
    const times = [];
    const cacheHeaders = [];

    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      try {
        const res = await fetch(baseUrl + ep.path);
        const t1 = performance.now();
        const duration = t1 - t0;
        await res.text();
        times.push(duration);
        cacheHeaders.push(res.headers.get('x-cache') || 'NONE');
      } catch (err) {
        const t1 = performance.now();
        times.push(t1 - t0);
        cacheHeaders.push('ERROR');
      }
      // Small pause between warm calls
      await new Promise(r => setTimeout(r, 10));
    }

    const coldTime = times[0];
    const warmTimes = times.slice(1).sort((a, b) => a - b);
    const p50 = warmTimes[Math.floor(warmTimes.length * 0.5)];
    const p90 = warmTimes[Math.floor(warmTimes.length * 0.9)];
    const p99 = warmTimes[warmTimes.length - 1];
    const avgWarm = warmTimes.reduce((acc, v) => acc + v, 0) / warmTimes.length;
    const hitCount = cacheHeaders.slice(1).filter(h => h === 'HIT').length;

    allResults.push({
      name: ep.name,
      path: ep.path,
      coldTime,
      avgWarm,
      p50,
      p90,
      p99,
      minWarm: warmTimes[0],
      maxWarm: warmTimes[warmTimes.length - 1],
      hitRate: `${((hitCount / 29) * 100).toFixed(1)}%`
    });
  }

  // Run curl sample tests to verify headers & protocol
  console.log('Running curl samples...');
  const curlLogs = [];
  const testEndpoints = [
    '/api/banners',
    '/api/sections',
    '/api/category/tags?type=short',
    '/api/rank/list?slug=hot-drama&page=1',
    '/api/recommend?page=1'
  ];
  for (const p of testEndpoints) {
    try {
      const curlCmd = `curl.exe -s -i -w "\\n---\\ntime_namelookup: %{time_namelookup}s\\ntime_connect: %{time_connect}s\\ntime_starttransfer: %{time_starttransfer}s\\ntime_total: %{time_total}s\\n" "${baseUrl}${p}"`;
      const out = execSync(curlCmd, { encoding: 'utf8', timeout: 5000 });
      curlLogs.push({ path: p, output: out.split('\r\n\r\n')[0] + '\n' + out.split('---')[1] });
    } catch (e) {
      curlLogs.push({ path: p, error: e.message });
    }
  }

  // wrk-style benchmark simulator (10 concurrency, 2s duration)
  console.log('Running wrk-style concurrent throughput benchmark...');
  const wrkResults = [];
  const wrkEp = '/api/banners';
  const concurrency = 10;
  const durationSec = 2;
  const deadline = Date.now() + durationSec * 1000;
  let totalRequests = 0;
  let totalBytes = 0;
  const latencies = [];

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (Date.now() < deadline) {
        const start = performance.now();
        try {
          const res = await fetch(baseUrl + wrkEp);
          const text = await res.text();
          const elapsed = performance.now() - start;
          latencies.push(elapsed);
          totalRequests++;
          totalBytes += text.length;
        } catch {}
      }
    })
  );

  latencies.sort((a, b) => a - b);
  const wrkSummary = {
    endpoint: wrkEp,
    concurrency,
    durationSec,
    requests: totalRequests,
    rps: (totalRequests / durationSec).toFixed(2),
    transferKBps: (totalBytes / 1024 / durationSec).toFixed(2),
    latencyAvg: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2),
    latencyP50: latencies[Math.floor(latencies.length * 0.5)].toFixed(2),
    latencyP75: latencies[Math.floor(latencies.length * 0.75)].toFixed(2),
    latencyP90: latencies[Math.floor(latencies.length * 0.9)].toFixed(2),
    latencyP99: latencies[Math.floor(latencies.length * 0.99)].toFixed(2),
    latencyMax: latencies[latencies.length - 1].toFixed(2)
  };

  // Gracefully stop child process
  child.send({ type: 'shutdown' });
  await new Promise(r => setTimeout(r, 500));
  try { child.kill('SIGTERM'); } catch {}

  console.log('\n================ BENCHMARK RESULTS (30 CALLS) ================');
  console.log('| 接口名称 | 冷启动耗时 | 热请求均值 | 热 P50 | 热 P90 | 热 P99 | 缓存命中率 | 目标达成 |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const r of allResults) {
    const coldOk = r.coldTime < 300 ? '✅ 达标' : '⚠️ 需关注';
    const warmOk = r.p50 < 50 ? '✅ 达标' : '❌ 未达标';
    const status = coldOk.startsWith('✅') && warmOk.startsWith('✅') ? '✅ 达标 (<300ms / <50ms)' : `${coldOk}/${warmOk}`;
    console.log(`| ${r.name} | ${r.coldTime.toFixed(1)} ms | ${r.avgWarm.toFixed(1)} ms | ${r.p50.toFixed(1)} ms | ${r.p90.toFixed(1)} ms | ${r.p99.toFixed(1)} ms | ${r.hitRate} | ${status} |`);
  }
  console.log('===============================================================\n');

  fs.writeFileSync('outputs/debug/b6-bench-results.json', JSON.stringify({
    results: allResults,
    curlLogs,
    wrkSummary
  }, null, 2));

  console.log('Benchmark data saved to outputs/debug/b6-bench-results.json');
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
