'use strict';

/**
 * The text of a PDF a household sends about its own home, read in memory on this server and dropped once read
 * (decision P6: keep only the facts the household confirms, never the original). The bytes go to a worker thread
 * (pdfTextWorker.mjs) with a memory cap and a time limit, so a long or broken file can't slow the server; nothing is
 * written to disk, sent anywhere or logged.
 */

const path = require('path');
const { Worker } = require('worker_threads');

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 150;
const TIME_LIMIT_MS = 30000;
// Fewer letters than this per page and the file is a scan or photos: there's no text to read.
const LETTERS_PER_PAGE = 40;

const failure = (code) => Object.assign(new Error(code), { code });

const isPdf = (bytes) => Buffer.isBuffer(bytes) && bytes.length > 5 && bytes.subarray(0, 1024).includes('%PDF-');

/**
 * @param {Buffer} bytes
 * @returns {Promise<Array<Array<Array<{text: string, x: number, y: number, end: number}>>>>} Pages, lines, pieces.
 * @throws {Error} code NOT_PDF, PDF_TOO_LARGE, PDF_LOCKED, PDF_UNREADABLE, PDF_TOO_LONG, PDF_TIMEOUT or PDF_NO_TEXT.
 */
function pdfPages(bytes) {
  if (!isPdf(bytes)) return Promise.reject(failure('NOT_PDF'));
  if (bytes.length > MAX_BYTES) return Promise.reject(failure('PDF_TOO_LARGE'));
  const copy = new Uint8Array(bytes);
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'pdfTextWorker.mjs'), {
      workerData: { bytes: copy, maxPages: MAX_PAGES },
      transferList: [copy.buffer],
      resourceLimits: { maxOldGenerationSizeMb: 384, maxYoungGenerationSizeMb: 64 },
      stdout: true,
      stderr: true,
    });
    // pdf.js can print warnings about a file's fonts; they stay unread, so nothing from a report reaches a log.
    worker.stdout.resume();
    worker.stderr.resume();
    let settled = false;
    const finish = (error, pages) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      if (error) reject(error);
      else resolve(pages);
    };
    const timer = setTimeout(() => finish(failure('PDF_TIMEOUT')), TIME_LIMIT_MS);
    worker.once('message', (result) => {
      if (result?.error) return finish(failure(result.error));
      const pages = Array.isArray(result?.pages) ? result.pages : [];
      const letters = pages.flat(2).reduce((sum, piece) => sum + (piece.text.match(/[a-z]/gi) || []).length, 0);
      if (!pages.length || letters < LETTERS_PER_PAGE * Math.min(pages.length, 3)) return finish(failure('PDF_NO_TEXT'));
      return finish(null, pages);
    });
    worker.once('error', () => finish(failure('PDF_UNREADABLE')));
    worker.once('exit', () => finish(failure('PDF_UNREADABLE')));
  });
}

module.exports = { pdfPages, isPdf, MAX_BYTES };
