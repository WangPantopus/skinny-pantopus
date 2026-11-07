'use strict';

/**
 * A floor-plan sheet's original, kept only when whoever sent it says we may. A local folder stands in for private storage
 * until hosted storage for originals is decided (FLOOR_PLAN_ORIGINALS_URL, config/floorPlanSheets.js). With none, nothing
 * is kept and the sheet's facts still go to review. An original is never served to anyone from here.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const config = require('../../config/floorPlanSheets');

const REFUSED = Symbol('refused');

/** What a file says it is, by its first bytes rather than its name. */
function kindOf(bytes) {
  if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  return null;
}

/**
 * @param {object|undefined} file  multer's memory file
 * @param {{ permitted: boolean }} options  Whether whoever sent it said it may be kept
 * @returns {Promise<null|symbol|{ key: string, kind: string, bytes: number }>} Null when it isn't kept; REFUSED when it isn't a file we take.
 */
async function keep(file, { permitted }) {
  if (!file) return null;
  const kind = kindOf(file.buffer);
  if (!kind) return REFUSED;
  const root = config.originalsRoot();
  if (!permitted || !root) return null;
  const key = `${crypto.randomUUID()}.${kind}`;
  const folder = fileURLToPath(root);
  await fs.promises.mkdir(folder, { recursive: true });
  await fs.promises.writeFile(path.join(folder, key), file.buffer, { mode: 0o600 });
  return { key, kind, bytes: file.buffer.length };
}

module.exports = { keep, REFUSED };
