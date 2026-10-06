#!/usr/bin/env node
// Read-only checks of a hosted Pantopus environment, for the launch checklist's "Check" steps
// (docs/release/prod-config-checklist.md). Sends only anonymous GET requests and prints one line
// per check; exits 1 if any check fails.
//
// usage: node scripts/staging/check-hosted.cjs <web origin> <api origin> [--production]
//   staging:    node scripts/staging/check-hosted.cjs https://staging.pantopus.com https://staging-api.pantopus.com
//   production: node scripts/staging/check-hosted.cjs https://pantopus.com https://api.pantopus.com --production
//
// Sign-in, live chat and push delivery still need a person (checklist S7, P9).

const args = process.argv.slice(2);
const production = args.includes('--production');
const [web, api] = args.filter((arg) => !arg.startsWith('--')).map((url) => String(url).replace(/\/+$/, ''));
if (!web || !api) {
  console.error('usage: check-hosted.cjs <web origin> <api origin> [--production]');
  process.exit(2);
}

const results = [];
async function check(name, run) {
  try {
    const note = await run();
    results.push({ ok: true, name, note });
  } catch (error) {
    const cause = error.cause?.code || error.cause?.message;
    results.push({ ok: false, name, note: cause ? `${error.message} (${cause})` : error.message });
  }
}
function must(condition, message) {
  if (!condition) throw new Error(message);
}
function get(url) {
  return fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
}
async function json(url) {
  const response = await get(url);
  must(response.status === 200, `${url} answered HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${url} did not return JSON`);
  }
}

(async () => {
  await check('API health', async () => {
    const body = await json(`${api}/health`);
    must(body.status === 'healthy', `status is ${body.status}`);
    must(body.database === 'connected', `database is ${body.database}`);
  });

  await check('API is served over HTTPS', async () => {
    must(api.startsWith('https://'), `${api} is not https`);
  });

  await check('Web home page', async () => {
    const response = await get(`${web}/`);
    must(response.status === 200, `HTTP ${response.status}`);
  });

  await check('Web security headers', async () => {
    const headers = (await get(`${web}/`)).headers;
    must(headers.get('x-content-type-options') === 'nosniff', 'no X-Content-Type-Options: nosniff');
    const framing = `${headers.get('content-security-policy') || ''} ${headers.get('x-frame-options') || ''}`;
    must(/frame-ancestors|DENY|SAMEORIGIN/i.test(framing), 'other sites may frame the page');
    must(headers.get('referrer-policy'), 'no Referrer-Policy');
    if (web.startsWith('https://')) must(headers.get('strict-transport-security'), 'no Strict-Transport-Security');
  });

  // The web forwards /api and /socket.io to the API on its own origin (next.config.js rewrites).
  await check('Web forwards /api to the API', async () => {
    const response = await get(`${web}/api/users/profile`);
    const type = response.headers.get('content-type') || '';
    must(response.status === 401 && type.includes('json'), `expected the API's 401 JSON, got HTTP ${response.status} ${type}`);
  });

  // The apps use Socket.IO's default path; the web client drops the trailing slash
  // (SocketContext addTrailingSlash: false) because Next.js redirects "/socket.io/".
  for (const [name, url] of [['API', `${api}/socket.io/`], ['Web', `${web}/socket.io`]]) {
    await check(`${name} answers realtime (Socket.IO polling)`, async () => {
      const response = await get(`${url}?EIO=4&transport=polling`);
      const text = await response.text();
      must(response.status === 200 && text.startsWith('0{'), `HTTP ${response.status}, no Socket.IO open packet`);
    });
  }

  await check('iOS app links (apple-app-site-association)', async () => {
    const body = await json(`${web}/.well-known/apple-app-site-association`);
    const ids = (body.applinks?.details || []).flatMap((detail) => detail.appIDs || [detail.appID]).filter(Boolean);
    must(ids.some((id) => id.endsWith('.app.pantopus.ios')), `no app.pantopus.ios entry (found ${ids.join(', ') || 'none'})`);
  });

  await check('Android app links (assetlinks.json)', async () => {
    const body = await json(`${web}/.well-known/assetlinks.json`);
    const entry = (Array.isArray(body) ? body : []).find((s) => s?.target?.package_name === 'app.pantopus.android');
    must(entry, 'no app.pantopus.android entry yet (checklist P10 regenerates the file)');
    must((entry.target.sha256_cert_fingerprints || []).length > 0, 'app.pantopus.android has no certificate fingerprint');
  });

  await check(production ? 'robots.txt lets search engines in' : 'robots.txt keeps search engines out', async () => {
    const response = await get(`${web}/robots.txt`);
    must(response.status === 200, `HTTP ${response.status}`);
    const blocksAll = /^\s*disallow:\s*\/\s*$/im.test(await response.text());
    must(production ? !blocksAll : blocksAll, production ? 'production blocks every page' : 'this environment can be indexed');
  });

  for (const { ok, name, note } of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `: ${note}` : ''}`);
  const failed = results.filter((result) => !result.ok).length;
  console.log(failed ? `\n${failed} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
})();
