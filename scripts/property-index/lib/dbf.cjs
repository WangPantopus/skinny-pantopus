'use strict';
// A dBASE table inside a zip, the table half of a shapefile, row by row. Only the columns a connector names are decoded,
// so anything else in the file (owner names, mailing addresses) never becomes text in this process.

const { spawn } = require('node:child_process');
const { log } = require('./log.cjs');

/**
 * @param {string} zip         The zip file
 * @param {string} member      The .dbf inside it
 * @param {string[]} columns   What this connector reads; a missing one stops the build (the source changed)
 * @param {object} [options]   { optional: columns that some counties' files don't have }
 */
async function* dbfRows(zip, member, columns, { optional = [] } = {}) {
  const unzip = spawn('unzip', ['-p', zip, member], { stdio: ['ignore', 'pipe', 'ignore'] });
  const exited = new Promise((resolve, reject) => {
    unzip.on('error', reject);
    unzip.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`unzip of a table exited ${code}`))));
  });
  let buffer = Buffer.alloc(0);
  let wanted = null;
  let recordLength = 0;
  let rows = 0;
  for await (const chunk of unzip.stdout) {
    buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
    if (!wanted) {
      if (buffer.length < 32) continue;
      const headerLength = buffer.readUInt16LE(8);
      if (buffer.length < headerLength) continue;
      recordLength = buffer.readUInt16LE(10);
      const at = new Map();
      let offset = 1;
      for (let position = 32; position + 32 <= headerLength && buffer[position] !== 0x0d; position += 32) {
        const name = buffer.toString('latin1', position, position + 11).split('\0')[0];
        const length = buffer[position + 16];
        at.set(name, [offset, length]);
        offset += length;
      }
      const missing = columns.filter((column) => !at.has(column) && !optional.includes(column));
      if (missing.length) throw new Error(`A table no longer has ${missing.join(', ')}`);
      wanted = columns.filter((column) => at.has(column)).map((column) => [column, ...at.get(column)]);
      buffer = buffer.subarray(headerLength);
    }
    let position = 0;
    while (position + recordLength <= buffer.length) {
      // 0x2A marks a deleted row, 0x1A ends the file.
      const flag = buffer[position];
      if (flag === 0x1a) {
        position = buffer.length;
        break;
      }
      if (flag !== 0x2a) {
        const row = {};
        for (const [name, offset, length] of wanted) row[name] = buffer.toString('latin1', position + offset, position + offset + length).replace(/\0+/g, '').trim();
        rows += 1;
        yield row;
      }
      position += recordLength;
    }
    buffer = buffer.subarray(position);
  }
  await exited;
  log(`table: ${rows} rows`);
}

module.exports = { dbfRows };
