const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const multer = require('multer');
const s3 = require('./s3Service');
const logger = require('../utils/logger');

const MAX_BATCH_BYTES = 250 * 1024 * 1024;
const MAX_ACTIVE = 4;
const MAX_PER_USER = 2;
const PREFIX = 'pantopus-chat-media-';
let active = 0;
const activeByUser = new Map();
let imageProcessor = Promise.resolve();

async function processImage(work, signal) {
  const previous = imageProcessor;
  let release;
  imageProcessor = new Promise(resolve => { release = resolve; });
  await previous;
  try { signal.throwIfAborted(); return await work(); }
  finally { release(); }
}

function uploadError(message, status = 400, code = 'CHAT_UPLOAD_INVALID') {
  return Object.assign(new Error(message), { status, code });
}

async function expireAbandonedDirectories() {
  // Only this uploader's private directories, older than any allowed request.
  // Live processes may share tmpdir, so never clean recent requests on startup.
  for (const name of await fsp.readdir(os.tmpdir())) {
    if (!name.startsWith(PREFIX)) continue;
    const dir = path.join(os.tmpdir(), name);
    const stat = await fsp.lstat(dir).catch(() => null);
    if (stat?.isDirectory() && stat.uid === process.getuid?.()
      && Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000) await fsp.rm(dir, { recursive: true, force: true });
  }
}

module.exports = function chatMediaUpload({ validateFileMime, sharp }) {
  expireAbandonedDirectories().catch(() => logger.warn('Chat temporary upload cleanup deferred'));

  const storage = {
    _handleFile(req, file, callback) {
      const context = req.chatUpload;
      const filename = crypto.randomUUID();
      const destination = path.join(context.directory, filename);
      const category = s3.categorizeFile(file.mimetype) || 'document';
      const maxBytes = s3.MAX_FILE_SIZES[category];
      let size = 0;
      const bounded = new Transform({ transform(chunk, encoding, done) {
        size += chunk.length;
        context.bytes += chunk.length;
        if (size > maxBytes || context.bytes > MAX_BATCH_BYTES) {
          return done(uploadError('These attachments exceed the upload size limit.', 413, 'CHAT_UPLOAD_TOO_LARGE'));
        }
        done(null, chunk);
      } });
      const write = pipeline(file.stream, bounded, fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 }),
        { signal: context.controller.signal });
      context.work.add(write);
      write.then(() => callback(null, { path: destination, filename, size }), callback)
        .finally(() => context.work.delete(write));
    },
    _removeFile(_req, file, callback) {
      if (!file.path) return callback(null);
      fs.unlink(file.path, (error) => callback(error?.code === 'ENOENT' ? null : error));
    },
  };
  const multipart = multer({ storage,
    limits: { fieldNameSize: 100, fieldNestingDepth: 3, fieldArrayIndexLimit: 32,
      fileSize: 100 * 1024 * 1024, files: 10, fields: 8, parts: 18, fieldSize: 32768 },
    fileFilter: (_req, file, done) => done(s3.isAllowedType(file.mimetype)
      ? null : uploadError('Choose a supported attachment type.'), true),
  }).array('files', 10);

  function fail(req, res, error) {
    req.chatUpload?.controller.abort();
    if (res.destroyed || res.headersSent) return;
    const sizeError = error.code === 'LIMIT_FILE_SIZE';
    const unavailable = ['ENOSPC', 'EMFILE', 'ENFILE', 'EACCES', 'EIO'].includes(error.code);
    const status = error.status || (sizeError ? 413 : unavailable ? 503 : 400);
    res.status(status).json({ error: sizeError ? 'This attachment exceeds the file size limit.'
      : unavailable ? 'Attachment storage is temporarily unavailable. Please retry.' : error.message,
      code: sizeError ? 'CHAT_UPLOAD_TOO_LARGE' : error.code || 'CHAT_UPLOAD_INVALID' });
  }

  async function receive(req, res, next) {
    const userId = req.user.id;
    if (active >= MAX_ACTIVE || (activeByUser.get(userId) || 0) >= MAX_PER_USER) {
      return res.status(429).set('Retry-After', '2').json({ error: 'Attachments are busy. Please retry shortly.',
        code: 'CHAT_UPLOAD_BUSY', retryAfter: 2 });
    }
    active += 1;
    activeByUser.set(userId, (activeByUser.get(userId) || 0) + 1);
    const context = { controller: new AbortController(), bytes: 0, work: new Set(), directory: null };
    req.chatUpload = context;
    let released = false;
    let timer;
    const release = () => {
      if (released) return;
      released = true;
      clearTimeout(timer);
      context.controller.abort();
      active -= 1;
      const count = (activeByUser.get(userId) || 1) - 1;
      if (count) activeByUser.set(userId, count); else activeByUser.delete(userId);
      Promise.allSettled([...context.work]).then(() => context.directory
        ? fsp.rm(context.directory, { recursive: true, force: true }) : null)
        .catch(() => logger.warn('Chat temporary upload cleanup deferred'));
    };
    res.once('finish', release);
    res.once('close', release);
    req.once('aborted', release);
    try {
      context.directory = await fsp.mkdtemp(path.join(os.tmpdir(), PREFIX));
      await fsp.chmod(context.directory, 0o700);
      if (released) { await fsp.rm(context.directory, { recursive: true, force: true }); return; }
      timer = setTimeout(() => {
        fail(req, res, uploadError('The upload timed out. Please retry.', 408, 'CHAT_UPLOAD_TIMEOUT'));
      }, 10 * 60 * 1000).unref();
      multipart(req, res, (error) => error ? fail(req, res, error) : next());
    } catch (error) {
      logger.warn('Chat temporary upload setup failed', { code: error.code });
      fail(req, res, uploadError('Attachments are temporarily unavailable. Please retry.', 503, 'CHAT_UPLOAD_UNAVAILABLE'));
    }
  }

  async function prepare(req, res, next) {
    try {
      for (const file of req.files || []) {
        req.chatUpload.controller.signal.throwIfAborted();
        const result = await validateFileMime(file);
        if (!result.valid) throw uploadError('This attachment does not match its declared file type.');
        // Work from bounded disk streams. Invalid images do not silently retain
        // metadata or fall back to an unprocessed original.
        if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif') {
          if (!sharp) throw uploadError('Image processing is unavailable. Please retry.', 503);
          await processImage(async () => {
            const stripped = `${file.path}.stripped`;
            const transform = pipeline(fs.createReadStream(file.path), sharp({ limitInputPixels: 64 * 1024 * 1024 }).rotate(),
              fs.createWriteStream(stripped, { mode: 0o600 }), { signal: req.chatUpload.controller.signal });
            req.chatUpload.work.add(transform);
            try { await transform; } finally { req.chatUpload.work.delete(transform); }
            await fsp.rename(stripped, file.path);
          }, req.chatUpload.controller.signal);
          file.size = (await fsp.stat(file.path)).size;
          if (file.size > s3.MAX_FILE_SIZES.image) throw uploadError('This image exceeds the file size limit.', 413, 'CHAT_UPLOAD_TOO_LARGE');
        }
        const hash = crypto.createHash('sha256');
        const hashing = pipeline(fs.createReadStream(file.path), hash, { signal: req.chatUpload.controller.signal });
        req.chatUpload.work.add(hashing);
        try { await hashing; file.sha256 = hash.digest('hex'); } finally { req.chatUpload.work.delete(hashing); }
      }
      next();
    } catch (error) { fail(req, res, error); }
  }

  return { receive, prepare };
};

// Reuse the same bounded processor for private thumbnail reads.
module.exports.processImage = processImage;
