// Stream 2 harness-only logging proxy: 127.0.0.1:18142 -> 127.0.0.1:18143 (real backend).
// Records method/path/status and redacted bodies to proxy.jsonl. Auth bodies are never logged;
// JWT-shaped strings, passwords and token fields are redacted. No app code.
const http = require('node:http'), fs = require('node:fs');
const log = __dirname + '/proxy.jsonl';
const redact = (s) => s
  .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]')
  .replace(/"(password|access_token|refresh_token|token|accessToken|refreshToken|session_token|code_verifier)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"');
const quiet = (p) => /\/(auth|login|register|session|token|refresh)/i.test(p);
http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c)).on('end', () => {
    const body = Buffer.concat(chunks); const at = Date.now();
    const up = http.request({ host: '127.0.0.1', port: 18143, method: req.method, path: req.url, headers: { ...req.headers } }, (r) => {
      const out = []; r.on('data', (c) => out.push(c)).on('end', () => {
        const rb = Buffer.concat(out);
        const ct = String(r.headers['content-type'] || '');
        const textual = /json|text/.test(ct);
        fs.appendFileSync(log, JSON.stringify({ at, method: req.method, path: req.url, ua: String(req.headers['user-agent'] || '').slice(0, 80), inm: req.headers['if-none-match'] || undefined, ims: req.headers['if-modified-since'] || undefined, cc: req.headers['cache-control'] || undefined,
          reqBody: quiet(req.url) ? '[omitted]' : redact(body.toString('utf8').slice(0, 800)), status: r.statusCode, contentType: ct,
          resBytes: rb.length, resBody: quiet(req.url) ? '[omitted]' : (textual ? redact(rb.toString('utf8').slice(0, 1500)) : '[binary]') }) + '\n');
        res.writeHead(r.statusCode, r.headers); res.end(rb);
      });
    });
    up.on('error', (e) => { fs.appendFileSync(log, JSON.stringify({ at, method: req.method, path: req.url, error: e.message }) + '\n'); res.writeHead(502); res.end('proxy error'); });
    up.end(body);
  });
}).listen(18142, '127.0.0.1', () => console.log('proxy 18142 -> 18143 ready'));
