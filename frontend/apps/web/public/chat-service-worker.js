/* The only HTML retained here is a fixed anonymous document. Never cache
 * authenticated navigation, APIs, RSC responses, uploads, or private media. */
const SHELL_PATH = '/chat-offline';
const SHELL_CACHE = 'pantopus-chat-shell-v1';
const ASSET_CACHE = 'pantopus-chat-public-assets-v1';
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_BYTES = 50 * 1024 * 1024;
const MAX_CACHE_FILES = 160;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CHAT_PATH = new RegExp(`^/app/chat(?:/(?:conversation/)?${UUID})?/?$`, 'i');
let preparing;

function publicAsset(url) {
  return url.origin === self.location.origin && !url.search
    && /^\/_next\/static\/[a-zA-Z0-9_./%-]+\.(?:js|css|woff2?)$/.test(url.pathname);
}

async function retainAsset(cache, url, response) {
  if (!response.ok || response.type === 'opaque' || response.redirected) throw new Error('Public asset unavailable');
  const type = (response.headers.get('content-type') || '').split(';')[0];
  if (!/^(?:text\/(?:javascript|css)|application\/(?:javascript|font-woff)|font\/woff2?)$/.test(type)) throw new Error('Unexpected asset');
  if (Number(response.headers.get('content-length') || 0) > MAX_ASSET_BYTES) throw new Error('Asset too large');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error('Asset too large');
  const headers = new Headers(response.headers);
  headers.delete('content-encoding'); headers.delete('content-length');
  headers.set('X-Pantopus-Asset-Bytes', String(bytes.byteLength));
  await cache.put(url, new Response(bytes, { status: 200, headers }));
}

async function trimAssets() {
  const shell = await (await caches.open(SHELL_CACHE)).match(SHELL_PATH);
  const pinned = new Set(JSON.parse(shell?.headers.get('X-Pantopus-Shell-Assets') || '[]'));
  const cache = await caches.open(ASSET_CACHE);
  const requests = await cache.keys();
  const entries = await Promise.all(requests.map(async (request) => ({ request,
    bytes: Number((await cache.match(request))?.headers.get('X-Pantopus-Asset-Bytes') || 0) })));
  let bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  let count = entries.length;
  for (const entry of entries) {
    if (count <= MAX_CACHE_FILES && bytes <= MAX_CACHE_BYTES) break;
    if (pinned.has(new URL(entry.request.url).pathname)) continue;
    await cache.delete(entry.request); count--; bytes -= entry.bytes;
  }
}

function prepareShell() {
  if (preparing) return preparing;
  preparing = (async () => {
    const response = await fetch(SHELL_PATH, { credentials: 'omit', cache: 'reload', redirect: 'error' });
    if (!response.ok || response.headers.get('X-Pantopus-Chat-Shell') !== '1'
      || !response.headers.get('content-type')?.startsWith('text/html')) throw new Error('Anonymous shell unavailable');
    const html = await response.text();
    if (html.length > 1024 * 1024) throw new Error('Shell too large');
    const assets = [...new Set([...html.matchAll(/(?:src|href)="([^"\s]+)"/g)]
      .map((match) => new URL(match[1].replaceAll('&amp;', '&'), self.location.origin))
      .filter(publicAsset).map((url) => url.pathname))];
    if (!assets.some((url) => url.endsWith('.js')) || assets.length > MAX_CACHE_FILES) throw new Error('Shell assets unavailable');
    const cache = await caches.open(ASSET_CACHE);
    let index = 0;
    let shellBytes = 0;
    await Promise.all(Array.from({ length: Math.min(4, assets.length) }, async () => {
      while (index < assets.length) {
        const asset = assets[index++];
        if (!await cache.match(asset)) await retainAsset(cache, asset,
          await fetch(asset, { credentials: 'omit', redirect: 'error' }));
        shellBytes += Number((await cache.match(asset))?.headers.get('X-Pantopus-Asset-Bytes') || 0);
        if (shellBytes > MAX_CACHE_BYTES) throw new Error('Shell assets too large');
      }
    }));
    const bytes = await Promise.all(assets.map(async (asset) => Number((await cache.match(asset))?.headers.get('X-Pantopus-Asset-Bytes') || 0)));
    if (bytes.reduce((sum, size) => sum + size, 0) > MAX_CACHE_BYTES) throw new Error('Shell assets too large');
    // Publish the new document only after every immediate script/style exists.
    const headers = new Headers(response.headers);
    headers.delete('content-encoding'); headers.delete('content-length');
    headers.set('X-Pantopus-Shell-Assets', JSON.stringify(assets));
    headers.set('Cache-Control', 'no-store');
    await (await caches.open(SHELL_CACHE)).put(SHELL_PATH, new Response(html, { headers }));
    await trimAssets();
  })().finally(async () => { await trimAssets().catch(() => {}); preparing = null; });
  return preparing;
}

self.addEventListener('install', (event) => {
  event.waitUntil(prepareShell().then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', (event) => {
  if (event.data?.type === 'prepare-chat-shell') event.waitUntil(prepareShell().catch(() => {}));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && CHAT_PATH.test(url.pathname)) {
    event.respondWith(fetch(request).catch(async () => {
      const shell = await (await caches.open(SHELL_CACHE)).match(SHELL_PATH);
      return shell || Response.error();
    }));
    return;
  }
  if (!publicAsset(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const saved = await cache.match(url.href);
    if (saved) return saved;
    const response = await fetch(request);
    const client = event.clientId ? await self.clients.get(event.clientId) : null;
    if (client && (CHAT_PATH.test(new URL(client.url).pathname) || new URL(client.url).pathname === SHELL_PATH)) {
      event.waitUntil(retainAsset(cache, url.href, response.clone()).then(trimAssets).catch(() => {}));
    }
    return response;
  })());
});
