import { HistoryError } from './history-store.mjs';

const MAX_BODY_BYTES = 2 * 1024 * 1024;
async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= MAX_BODY_BYTES) chunks.push(chunk);
  }
  if (size > MAX_BODY_BYTES) throw new HistoryError(413, 'history request exceeds 2 MiB');
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HistoryError(400, 'request body must be valid JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HistoryError(400, 'request body must be a JSON object');
  return value;
}
function json(res, value, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}

/** Returns true only when this handler owns the requested route. */
export function createHistoryHandler(store) {
  return async (req, res, url = new URL(req.url, 'http://localhost')) => {
    if (url.pathname !== '/api/history' && !url.pathname.startsWith('/api/history/')) return false;
    try {
      const platform = url.searchParams.get('source') ?? 'all';
      if (req.method === 'OPTIONS') { json(res, {}, 204); return true; }
      if (req.method === 'POST' && url.pathname === '/api/history/sessions') json(res, store.registerSession(await body(req)));
      else if (req.method === 'POST' && url.pathname === '/api/history/progress') json(res, store.saveProgress(await body(req)));
      else if (req.method === 'POST' && url.pathname === '/api/history/import') json(res, store.importLegacy(await body(req)));
      else if (req.method === 'GET' && url.pathname === '/api/history') json(res, { items: store.list(platform) });
      else if (req.method === 'DELETE' && url.pathname === '/api/history') json(res, store.clear(platform));
      else if (['GET', 'DELETE'].includes(req.method) && /^\/api\/history\/[^/]+$/.test(url.pathname)) {
        let id;
        try { id = decodeURIComponent(url.pathname.slice('/api/history/'.length)); }
        catch { throw new HistoryError(400, 'invalid series ID encoding'); }
        json(res, req.method === 'GET' ? { item: store.get(id, platform) } : store.remove(id, platform));
      } else throw new HistoryError(405, 'unsupported history route or method');
    } catch (error) {
      if (!(error instanceof HistoryError)) console.error('History storage request failed:', error.message);
      json(res, { error: error instanceof HistoryError ? error.message : 'history storage unavailable' }, error instanceof HistoryError ? error.status : 500);
    }
    return true;
  };
}
