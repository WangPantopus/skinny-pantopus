'use strict';
// A table in a Microsoft Access 2000-2003 database (Jet 4, .mdb), row by row, with no packages: the layout is the one
// mdbtools documents (HACKING). Pages are 4 KB; a table's definition names its columns and points to its usage map, the
// bitmap of the pages it owns (a page freed before the file was last compacted can still name the table, so pages are
// never taken from a scan). Only the columns a connector names are decoded: owner and mailing columns never become text
// in this process. Memo and OLE columns aren't read.

const fs = require('node:fs');
const { log } = require('./log.cjs');

const PAGE = 4096;
const DATA = 1;
const TABLE = 2;
const DELETED_OR_MOVED = 0xc000;
const OFFSET = 0x1fff;
const TYPES = { BOOL: 1, BYTE: 2, INT: 3, LONG: 4, MONEY: 5, FLOAT: 6, DOUBLE: 7, DATETIME: 8, TEXT: 10, NUMERIC: 16 };

function readPage(fd, number, buffer = Buffer.alloc(PAGE)) {
  fs.readSync(fd, buffer, 0, PAGE, number * PAGE);
  return buffer;
}

/** A table's columns, from its definition page and any continuation pages. */
function definition(fd, page) {
  const parts = [];
  for (let next = page; next;) {
    const buffer = readPage(fd, next);
    if (buffer[0] !== TABLE) throw new Error(`Page ${next} isn't a table definition`);
    parts.push(parts.length ? buffer.subarray(8) : buffer);
    next = buffer.readUInt32LE(4);
  }
  const tdef = Buffer.concat(parts);
  const count = tdef.readUInt16LE(45);
  const usage = tdef.readUInt32LE(55);
  let at = 63 + tdef.readUInt32LE(51) * 12;
  const columns = [];
  for (let i = 0; i < count; i += 1, at += 25) {
    columns.push({
      type: tdef[at], number: tdef.readUInt16LE(at + 5), variable: tdef.readUInt16LE(at + 7), scale: tdef[at + 12],
      fixed: Boolean(tdef[at + 15] & 1), offset: tdef.readUInt16LE(at + 21), length: tdef.readUInt16LE(at + 23),
    });
  }
  for (const column of columns) {
    const length = tdef.readUInt16LE(at);
    column.name = tdef.toString('utf16le', at + 2, at + 2 + length);
    at += 2 + length;
  }
  return { columns, usage };
}

/** The pages a table owns, from its usage map: a row pointer (page << 8 | row) to an inline bitmap or a list of bitmap pages. */
function ownedPages(fd, pointer) {
  const holder = readPage(fd, pointer >>> 8);
  const row = pointer & 0xff;
  const start = holder.readUInt16LE(14 + row * 2) & OFFSET;
  const end = row === 0 ? PAGE : holder.readUInt16LE(12 + row * 2) & OFFSET;
  const map = Buffer.from(holder.subarray(start, end));
  const pages = [];
  if (map[0] === 0) {
    const first = map.readUInt32LE(1);
    for (let i = 0; i < (map.length - 5) * 8; i += 1) if (map[5 + (i >> 3)] & (1 << (i & 7))) pages.push(first + i);
  } else {
    const perPage = (PAGE - 4) * 8;
    for (let index = 0; 1 + index * 4 + 4 <= map.length; index += 1) {
      const bitmap = map.readUInt32LE(1 + index * 4);
      if (!bitmap) continue;
      const bits = readPage(fd, bitmap);
      for (let i = 0; i < perPage; i += 1) if (bits[4 + (i >> 3)] & (1 << (i & 7))) pages.push(index * perPage + i);
    }
  }
  return pages;
}

// Text is UTF-16, or, after FF FE, single bytes with each 00 switching between single bytes and UTF-16.
function text(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xfe) return bytes.toString('utf16le');
  let out = '';
  let single = true;
  for (let i = 2; i < bytes.length;) {
    if (bytes[i] === 0) {
      single = !single;
      i += 1;
    } else if (single) {
      out += String.fromCharCode(bytes[i]);
      i += 1;
    } else {
      out += bytes.toString('utf16le', i, i + 2);
      i += 2;
    }
  }
  return out;
}

// A NUMERIC is a sign byte and a 128-bit integer in four little-endian words, most significant first, scaled by the column.
function numeric(bytes, scale) {
  let value = 0n;
  for (let word = 0; word < 4; word += 1) value = (value << 32n) | BigInt(bytes.readUInt32LE(1 + word * 4));
  const number = Number(value) / 10 ** scale;
  return bytes[0] & 0x80 ? -number : number;
}

function fixedValue(column, bytes, present) {
  switch (column.type) {
    case TYPES.BOOL: return present;
    case TYPES.BYTE: return bytes[0];
    case TYPES.INT: return bytes.readInt16LE(0);
    case TYPES.LONG: return bytes.readInt32LE(0);
    case TYPES.MONEY: return Number(bytes.readBigInt64LE(0)) / 10000;
    case TYPES.FLOAT: return bytes.readFloatLE(0);
    case TYPES.DOUBLE: case TYPES.DATETIME: return bytes.readDoubleLE(0);
    case TYPES.NUMERIC: return numeric(bytes, column.scale);
    default: return null;
  }
}

/** One row's named columns. `end` is the row's last byte. */
function crack(page, start, end, columns, wanted) {
  const stored = page.readUInt16LE(start);
  const maskBytes = (stored + 7) >> 3;
  const mask = page.subarray(end - maskBytes + 1, end + 1);
  const variables = columns.some((column) => !column.fixed) ? page.readUInt16LE(end - maskBytes - 1) : 0;
  const offsets = [];
  for (let i = 0; i <= variables; i += 1) offsets.push(page.readUInt16LE(end - maskBytes - 3 - i * 2));
  const fixedStored = stored - variables;
  const row = {};
  let fixedSeen = 0;
  for (const column of columns) {
    const present = (column.number >> 3) < mask.length && Boolean(mask[column.number >> 3] & (1 << (column.number & 7)));
    let value = null;
    if (column.fixed) {
      if (fixedSeen < fixedStored) {
        fixedSeen += 1;
        if (wanted.has(column.name) && (present || column.type === TYPES.BOOL)) {
          const at = start + 2 + column.offset;
          value = fixedValue(column, page.subarray(at, at + column.length), present);
        }
      }
    } else if (present && column.variable < variables && wanted.has(column.name) && column.type === TYPES.TEXT) {
      value = text(page.subarray(start + offsets[column.variable], start + offsets[column.variable + 1]));
    }
    if (wanted.has(column.name)) row[column.name] = value;
  }
  return row;
}

/** The database's tables by name, each with its definition page (from the catalog, MSysObjects, at page 2). */
function tables(file) {
  const found = new Map();
  for (const row of rows(file, 2, ['Id', 'Name', 'Type'])) if (row.Type === 1) found.set(row.Name, row.Id & 0xffffff);
  return found;
}

/** Every row of the table defined at `page`, holding only `columns`. A missing column stops the build. */
function* rows(file, page, columns) {
  const fd = fs.openSync(file, 'r');
  try {
    const { columns: all, usage } = definition(fd, page);
    const missing = columns.filter((name) => !all.some((column) => column.name === name));
    if (missing.length) throw new Error(`A table no longer has ${missing.join(', ')}`);
    const wanted = new Set(columns);
    const buffer = Buffer.alloc(PAGE);
    for (const number of ownedPages(fd, usage)) {
      readPage(fd, number, buffer);
      if (buffer[0] !== DATA || buffer.readUInt32LE(4) !== page) continue;
      const count = buffer.readUInt16LE(12);
      for (let i = 0; i < count; i += 1) {
        const raw = buffer.readUInt16LE(14 + i * 2);
        if (raw & DELETED_OR_MOVED) continue;
        const end = (i === 0 ? PAGE : buffer.readUInt16LE(12 + i * 2) & OFFSET) - 1;
        yield crack(buffer, raw & OFFSET, end, all, wanted);
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

/** Every row of a named table. */
function* tableRows(file, name, columns) {
  const page = tables(file).get(name);
  if (!page) throw new Error(`The database no longer has the table ${name}`);
  let count = 0;
  for (const row of rows(file, page, columns)) {
    count += 1;
    yield row;
  }
  log(`${name}: ${count} rows`);
}

module.exports = { tables, tableRows };
