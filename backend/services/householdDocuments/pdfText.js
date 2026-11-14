'use strict';

/**
 * A PDF a household sends about its own home, read in memory on this server and dropped once read (decision P6: keep
 * only the facts the household confirms, never the original). The bytes go to a worker thread (pdfTextWorker.mjs),
 * which reads the text and the facts it states (readFacts.js) under a memory cap and a time limit, so a long or
 * broken file can't slow the server; only the facts come back. Nothing is written to disk, sent anywhere or logged.
 *
 * At most HOUSEHOLD_DOCUMENTS_READERS (default 2) files are read at once across all accounts; past that, PDF_BUSY,
 * and the person tries again in a moment. Each reader can hold about MEMORY_MB of memory.
 */

const path = require('path');
const { Worker } = require('worker_threads');

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 150;
const TIME_LIMIT_MS = 30000;
const MEMORY_MB = 256;
const readers = () => Math.max(1, Math.min(8, Number.parseInt(process.env.HOUSEHOLD_DOCUMENTS_READERS || '', 10) || 2));
let running = 0;

const failure = (code) => Object.assign(new Error(code), { code });

const isPdf = (bytes) => Buffer.isBuffer(bytes) && bytes.length > 5 && bytes.subarray(0, 1024).includes('%PDF-');

/**
 * @param {Buffer} bytes
 * @param {{ address: string, today?: Date }} args  The Home's street line, which the report must name.
 * @returns {Promise<{ pages: number, found: object }>} The page count and readFacts's answer.
 * @throws {Error} code NOT_PDF, PDF_TOO_LARGE, PDF_BUSY, PDF_LOCKED, PDF_UNREADABLE, PDF_TOO_LONG, PDF_TIMEOUT or PDF_NO_TEXT.
 */
function readDocument(bytes, { address, today = new Date() }) {
  if (!isPdf(bytes)) return Promise.reject(failure('NOT_PDF'));
  if (bytes.length > MAX_BYTES) return Promise.reject(failure('PDF_TOO_LARGE'));
  if (running >= readers()) return Promise.reject(failure('PDF_BUSY'));
  running += 1;
  const copy = new Uint8Array(bytes);
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(path.join(__dirname, 'pdfTextWorker.mjs'), {
        workerData: { bytes: copy, maxPages: MAX_PAGES, address: String(address || ''), today: today.toISOString() },
        transferList: [copy.buffer],
        resourceLimits: { maxOldGenerationSizeMb: MEMORY_MB, maxYoungGenerationSizeMb: 48 },
        stdout: true,
        stderr: true,
      });
    } catch {
      running -= 1;
      reject(failure('PDF_UNREADABLE'));
      return;
    }
    // pdf.js can print warnings about a file's fonts; they stay unread, so nothing from a report reaches a log.
    worker.stdout.resume();
    worker.stderr.resume();
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      running -= 1;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      if (error) reject(error);
      else resolve(result);
    };
    const timer = setTimeout(() => finish(failure('PDF_TIMEOUT')), TIME_LIMIT_MS);
    worker.once('message', (result) => {
      if (result?.error) return finish(failure(result.error));
      if (!Number.isInteger(result?.pages) || !result.found) return finish(failure('PDF_UNREADABLE'));
      return finish(null, { pages: result.pages, found: result.found });
    });
    worker.once('error', () => finish(failure('PDF_UNREADABLE')));
    worker.once('exit', () => finish(failure('PDF_UNREADABLE')));
  });
}

module.exports = { readDocument, isPdf, MAX_BYTES };
