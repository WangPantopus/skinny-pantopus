/** Bounded private in-memory derivatives. Every HTTP read still authorizes the File first. */
const { Writable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const sharp = require('sharp');
const storage = require('./s3Service');
const { processImage } = require('./chatMediaUpload');
const { incCounter, setGauge, recordHistogram } = require('./chatMetrics');
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ENTRIES = 128;
const MAX_PENDING = 64;
const TTL_MS = 10 * 60 * 1000;
const cache = new Map();
const pending = new Map();
let bytes = 0;

function remove(key) {
  const entry = cache.get(key);
  if (!entry) return;
  bytes -= entry.buffer.length;
  cache.delete(key);
}
function prune() {
  for (const [key, entry] of cache) if (entry.expiresAt <= Date.now()) remove(key);
  while (bytes > MAX_BYTES || cache.size > MAX_ENTRIES) remove(cache.keys().next().value);
  setGauge('chat.thumbnail.cache_bytes', bytes);
  setGauge('chat.thumbnail.cache_entries', cache.size);
}
setInterval(prune, 60_000).unref();

async function getThumbnail(file) {
  const key = JSON.stringify([file.id, file.file_path, file.metadata?.storage_sha256 || '', 'thumbnail-v1']);
  prune();
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key); cache.set(key, cached); // Least recently used first.
    incCounter('chat.thumbnail.cache_hit');
    return cached.buffer;
  }
  if (pending.has(key)) {
    incCounter('chat.thumbnail.coalesced');
    return pending.get(key);
  }
  if (pending.size >= MAX_PENDING) {
    incCounter('chat.thumbnail.busy');
    throw Object.assign(new Error('Image previews are busy. Please retry.'), { status: 503 });
  }
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 60_000).unref();
  const started = Date.now();
  // Shares the uploader's single image processor, so a burst of downloads and
  // uploads cannot multiply full-size decodes. Queue and encoded bytes are capped.
  const work = processImage(async () => {
    const object = await storage.getObjectStream(file.file_path, undefined, undefined, { abortSignal: controller.signal });
    const chunks = [];
    let size = 0;
    const output = new Writable({ write(chunk, _encoding, done) {
      size += chunk.length;
      if (size > 1024 * 1024) return done(new Error('Image preview exceeds size limit'));
      chunks.push(chunk); done();
    } });
    await pipeline(object.body, sharp({ limitInputPixels: 64 * 1024 * 1024 }).rotate()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }), output,
    { signal: controller.signal });
    const buffer = Buffer.concat(chunks, size);
    cache.set(key, { buffer, expiresAt: Date.now() + TTL_MS });
    bytes += buffer.length;
    prune();
    incCounter('chat.thumbnail.generated');
    recordHistogram('chat.thumbnail.generation_ms', Date.now() - started);
    return buffer;
  }, controller.signal).finally(() => { clearTimeout(deadline); pending.delete(key); });
  pending.set(key, work);
  return work;
}
module.exports = { getThumbnail };
