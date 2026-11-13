/**
 * Reads the text a PDF carries, page by page, for services/householdDocuments/pdfText.js. It runs in its own worker
 * thread so a long report never holds up the server, and it only reads: no page is drawn, no script or font runs.
 *
 * In: workerData { bytes: Uint8Array, maxPages }. Out: one message, { pages: [[{ text, x, y }]] } (each page's
 * lines from the top, each line's pieces from the left) or { error: 'PDF_LOCKED' | 'PDF_UNREADABLE' | 'PDF_TOO_LONG' }.
 * Nothing here logs: a household's report never reaches a log.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('pdfjs-dist/package.json'));

// Pieces of one line sit within this many points of each other, top to bottom.
const SAME_LINE = 2.5;

function linesOf(items) {
  const pieces = items
    .filter((item) => typeof item.str === 'string' && item.str.trim())
    .map((item) => ({ text: item.str.replace(/\s+/g, ' ').trim(), x: item.transform[4], y: item.transform[5], width: item.width || 0 }));
  pieces.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const piece of pieces) {
    const line = lines[lines.length - 1];
    if (line && line.y - piece.y <= SAME_LINE) line.pieces.push(piece);
    else lines.push({ y: piece.y, pieces: [piece] });
  }
  return lines.map((line) => line.pieces.sort((a, b) => a.x - b.x).map(({ text, x, y, width }) => ({ text, x: Math.round(x), y: Math.round(y), end: Math.round(x + width) })));
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
    for (let number = 1; number <= doc.numPages; number += 1) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      pages.push(linesOf(content.items));
      page.cleanup();
    }
    return { pages };
  } catch {
    return { error: 'PDF_UNREADABLE' };
  } finally {
    await task.destroy();
  }
}

read().then((result) => parentPort.postMessage(result), () => parentPort.postMessage({ error: 'PDF_UNREADABLE' }));
