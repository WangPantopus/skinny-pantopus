/**
 * Reads a household's PDF for services/householdDocuments/pdfText.js: its text, page by page, then the facts it states
 * (readFacts.js). It runs in its own worker thread, under the caller's memory cap and time limit, so neither a long
 * report nor the rules can hold up the server; and it only reads: no page is drawn, no script or font runs. The text
 * never leaves this thread: only the facts found go back.
 *
 * In: workerData { bytes: Uint8Array, maxPages, address, today }. Out: one message, { pages: <count>, found } (see
 * readFacts) or { error: 'PDF_LOCKED' | 'PDF_UNREADABLE' | 'PDF_TOO_LONG' | 'PDF_NO_TEXT' }.
 * Nothing here logs: a household's report never reaches a log.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('pdfjs-dist/package.json'));
const { readFacts } = require('./readFacts.js');

// Pieces of one line sit within this many points of each other, top to bottom.
const SAME_LINE = 2.5;
// What the rules read, at most: a report's line is a few dozen words, and a long report a few thousand lines.
const MAX_PIECE_CHARS = 300;
const MAX_LINE_PIECES = 40;
const MAX_LINES = 25000;
// Fewer letters than this per page (of the first three) and the file is a scan or photos: there's no text to read.
const LETTERS_PER_PAGE = 40;

function linesOf(items) {
  const pieces = items
    .filter((item) => typeof item.str === 'string' && item.str.trim())
    .map((item) => ({ text: item.str.replace(/\s+/g, ' ').trim().slice(0, MAX_PIECE_CHARS), x: item.transform[4], y: item.transform[5], width: item.width || 0 }));
  pieces.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const piece of pieces) {
    const line = lines[lines.length - 1];
    if (line && line.y - piece.y <= SAME_LINE) line.pieces.push(piece);
    else lines.push({ y: piece.y, pieces: [piece] });
  }
  return lines.map((line) => line.pieces.sort((a, b) => a.x - b.x).slice(0, MAX_LINE_PIECES)
    .map(({ text, x, y, width }) => ({ text, x: Math.round(x), y: Math.round(y), end: Math.round(x + width) })));
}

async function read() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // The worker's code runs here, in this thread, instead of a second one.
  globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  let task;
  let doc;
  try {
    task = pdfjs.getDocument({
      data: workerData.bytes,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      disableAutoFetch: true,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      enableXfa: false,
      verbosity: 0,
      cMapUrl: `${path.join(root, 'cmaps')}/`,
      cMapPacked: true,
      standardFontDataUrl: `${path.join(root, 'standard_fonts')}/`,
    });
    doc = await task.promise;
  } catch (error) {
    task?.destroy().catch(() => {});
    return { error: error?.name === 'PasswordException' ? 'PDF_LOCKED' : 'PDF_UNREADABLE' };
  }
  try {
    if (doc.numPages > workerData.maxPages) return { error: 'PDF_TOO_LONG' };
    const pages = [];
    let lines = 0;
    for (let number = 1; number <= doc.numPages && lines < MAX_LINES; number += 1) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const pageLines = linesOf(content.items).slice(0, MAX_LINES - lines);
      lines += pageLines.length;
      pages.push(pageLines);
      page.cleanup();
    }
    const letters = pages.slice(0, 3).flat(2).reduce((sum, piece) => sum + (piece.text.match(/[a-z]/gi) || []).length, 0);
    if (!pages.length || letters < LETTERS_PER_PAGE * Math.min(pages.length, 3)) return { error: 'PDF_NO_TEXT' };
    return { pages: doc.numPages, found: readFacts(pages, { address: workerData.address, today: new Date(workerData.today) }) };
  } catch {
    return { error: 'PDF_UNREADABLE' };
  } finally {
    await task.destroy();
  }
}

read().then((result) => parentPort.postMessage(result), () => parentPort.postMessage({ error: 'PDF_UNREADABLE' }));
