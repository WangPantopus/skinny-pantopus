#!/usr/bin/env node
// A local stand-in for PostGrid's test mode, from its public docs, for scripts/mail-t5.js until a real
// test account exists. It holds pieces in memory, honors repeat keys for 24 hours and answers lookups by
// reference. Nothing is mailed, nothing leaves this machine, and it proves nothing about PostGrid itself.
// usage: node backend/scripts/mail-printer-stand-in.cjs [port]   (POSTGRID_API_URL=http://127.0.0.1:<port>/print-mail/v1)
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || 18990);
const ROOT = '/print-mail/v1/postcards';
const pieces = new Map();
const keys = new Map();

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (!String(req.headers['x-api-key'] || '').startsWith('test_')) return send(res, 401, { error: { type: 'unauthorized' } });
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    if (req.method === 'POST' && url.pathname === ROOT) {
      const key = req.headers['idempotency-key'];
      if (key && keys.has(key)) return send(res, 200, pieces.get(keys.get(key)));
      const body = JSON.parse(raw);
      if (!body.to?.addressLine1 || !body.from?.addressLine1 || !body.frontHTML || !body.backHTML || !body.size) {
        return send(res, 422, { error: { type: 'validation_error' } });
      }
      const piece = { id: `postcard_${crypto.randomBytes(9).toString('base64url')}`, object: 'postcard', live: false, status: 'ready',
        size: body.size, mailingClass: body.mailingClass, metadata: body.metadata || {}, createdAt: new Date().toISOString() };
      pieces.set(piece.id, piece);
      if (key) keys.set(key, piece.id);
      return send(res, 200, piece);
    }
    if (req.method === 'GET' && url.pathname === ROOT) {
      const search = JSON.parse(url.searchParams.get('search') || '{}');
      const data = [...pieces.values()].filter((piece) => Object.entries(search)
        .every(([path, value]) => path.startsWith('metadata.') && piece.metadata?.[path.slice(9)] === value));
      return send(res, 200, { object: 'list', limit: 2, skip: 0, totalCount: data.length, data: data.slice(0, 2) });
    }
    const piece = pieces.get(url.pathname.slice(ROOT.length + 1));
    if (!piece) return send(res, 404, { error: { type: 'not_found' } });
    if (req.method === 'GET') return send(res, 200, piece);
    if (req.method === 'DELETE') { pieces.delete(piece.id); return send(res, 200, { ...piece, status: 'cancelled' }); }
    return send(res, 405, { error: { type: 'method_not_allowed' } });
  });
}).listen(PORT, '127.0.0.1', () => console.log(`printer stand-in on 127.0.0.1:${PORT}${ROOT}`));
