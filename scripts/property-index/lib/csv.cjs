'use strict';
// A delimited file with quoted fields that can hold line breaks, row by row, holding only the columns asked for. A file that declares no
// text qualifier reads its quotes as ordinary characters.

const fs = require('node:fs');
const { log } = require('./log.cjs');

async function* records(stream, delimiter, qualified = true) {
  let row = [];
  let field = '';
  let quoted = false;
  let previous = '';
  for await (const chunk of stream) {
    for (const char of chunk) {
      if (quoted) {
        if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"' && qualified) {
        // A doubled quote inside a quoted field is one quote.
        if (previous === '"') field += '"';
        quoted = true;
      } else if (char === delimiter) {
        row.push(field);
        field = '';
      } else if (char === '\n' || char === '\r') {
        // A line ends in a line feed, a carriage return, or both (one city's file uses a bare return).
        if (char === '\r' || previous !== '\r') {
          row.push(field);
          yield row;
          row = [];
          field = '';
        }
      } else field += char;
      previous = char;
    }
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

/**
 * @param {string} file        The file
 * @param {string[]} columns   What this connector reads; a missing one stops the build (the source changed)
 * @param {object} [options]   { delimiter: ',', encoding: 'utf8', label, quoted: false for a file with no text qualifier }
 */
async function* csvRows(file, columns, { delimiter = ',', encoding = 'utf8', label = 'file', quoted = true } = {}) {
  let positions = null;
  let rows = 0;
  for await (const fields of records(fs.createReadStream(file, { encoding }), delimiter, quoted)) {
    if (!positions) {
      const header = fields.map((name) => name.replace(/^﻿/, '').trim());
      positions = columns.map((column) => header.indexOf(column));
      const missing = columns.filter((_, i) => positions[i] < 0);
      if (missing.length) throw new Error(`The ${label} no longer has ${missing.join(', ')}`);
      continue;
    }
    const row = {};
    for (let i = 0; i < columns.length; i += 1) {
      const value = fields[positions[i]]?.trim();
      row[columns[i]] = value === undefined || value === 'NULL' ? '' : value;
    }
    rows += 1;
    yield row;
  }
  log(`${label}: ${rows} rows`);
}

module.exports = { csvRows };
