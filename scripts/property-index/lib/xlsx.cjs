'use strict';
// A spreadsheet's first sheet, row by row, holding only the columns asked for. Read as text from inside the zip, so a large roll isn't
// held in memory and nothing else in the sheet (owner names, mailing addresses) leaves this loop. Handles the cell types county exports use:
// numbers and text written in the cell. Shared strings aren't read; a sheet that needs them stops the build.

const { spawn } = require('node:child_process');

const decode = (text) => text.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name]));
const CELL = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs;

async function* sheetRows(file, columns) {
  const unzip = spawn('unzip', ['-p', file, 'xl/worksheets/sheet1.xml'], { stdio: ['ignore', 'pipe', 'ignore'] });
  unzip.stdout.setEncoding('utf8');
  let rest = '';
  let positions = null;
  for await (const chunk of unzip.stdout) {
    rest += chunk;
    let end;
    while ((end = rest.indexOf('</row>')) >= 0) {
      const row = rest.slice(0, end);
      rest = rest.slice(end + 6);
      const cells = new Map();
      for (const [, column, attributes, inner] of row.matchAll(CELL)) {
        if (/t="s"/.test(attributes)) throw new Error('The sheet uses shared strings');
        const value = /<(?:v|t)[^>]*>(.*?)<\/(?:v|t)>/s.exec(inner || '')?.[1];
        if (value !== undefined) cells.set(column, decode(value).trim());
      }
      if (!positions) {
        const header = new Map();
        for (const [column, name] of cells) if (!header.has(name)) header.set(name, column);
        const missing = columns.filter((name) => !header.has(name));
        if (missing.length) throw new Error(`The sheet no longer has ${missing.join(', ')}`);
        positions = columns.map((name) => header.get(name));
        continue;
      }
      const out = {};
      columns.forEach((name, i) => { out[name] = cells.get(positions[i]) ?? ''; });
      yield out;
    }
  }
}

module.exports = { sheetRows };
