'use strict';
// A table in a SQL Server data file (.mdf), row by row, with no packages and no server: the page format Microsoft documents
// in its internals books. Only the columns a connector names are decoded, so owner names and mailing addresses never become
// text in this process. It reads uncompressed rows stored in the row's own page; a value kept off the page reads as missing.

const fs = require('node:fs');

const PAGE = 8192;
const HEADER = 96;
const DATA_PAGE = 1;
// The system tables' own page labels, which don't change between versions.
const SYSTEM = { columnsOfRowset: '3:0', rowsets: '5:0', allocationUnits: '7:0', objects: '34:1', columns: '41:1' };
const PRIMARY_RECORD = 0;
const FORWARDED_RECORD = 1;

/** One row's parts: its fixed bytes and its variable columns' places. Null for a record that isn't a live row. */
function readRecord(page, at) {
  const status = page[at];
  const type = (status >> 1) & 7;
  if (type !== PRIMARY_RECORD && type !== FORWARDED_RECORD) return null;
  const fixedEnd = page.readUInt16LE(at + 2);
  let p = at + fixedEnd;
  const columns = status & 0x10 ? page.readUInt16LE(p) : 0;
  p += 2;
  const nullBytes = (columns + 7) >> 3;
  const nulls = p;
  p += nullBytes;
  const varying = [];
  if (status & 0x20) {
    const count = page.readUInt16LE(p);
    p += 2;
    let start = p + count * 2;
    for (let i = 0; i < count; i += 1) {
      const end = page.readUInt16LE(p + i * 2);
      const offPage = (end & 0x8000) !== 0;
      const stop = at + (end & 0x7fff);
      varying.push(offPage ? null : [start, stop]);
      start = stop;
    }
  }
  return { at, nulls, varying };
}

function* pagesOf(fd, wanted) {
  const size = fs.fstatSync(fd).size;
  const buffer = Buffer.alloc(PAGE);
  for (let position = 0; position + PAGE <= size; position += PAGE) {
    fs.readSync(fd, buffer, 0, PAGE, position);
    if (buffer[1] !== DATA_PAGE) continue;
    if (wanted && !wanted.has(`${buffer.readUInt32LE(24)}:${buffer.readUInt16LE(6)}`)) continue;
    yield buffer;
  }
}

function* recordsOf(fd, wanted) {
  for (const page of pagesOf(fd, wanted)) {
    const label = `${page.readUInt32LE(24)}:${page.readUInt16LE(6)}`;
    const slots = page.readUInt16LE(22);
    for (let slot = 0; slot < slots; slot += 1) {
      const at = page.readUInt16LE(PAGE - 2 - slot * 2);
      // An empty slot, or a slot past what the page holds.
      if (at < HEADER || at >= PAGE) continue;
      const record = readRecord(page, at);
      if (record) yield { page, record, label };
    }
  }
}

const textOf = (page, place) => (place ? page.toString('utf16le', place[0], place[1]) : '');

const DECIMAL_SCALE = (scale) => 10 ** scale;
function decimal(page, at, length, scale) {
  // A sign byte, then the magnitude in little-endian.
  let magnitude = 0;
  for (let i = length - 1; i >= 1; i -= 1) magnitude = magnitude * 256 + page[at + i];
  return ((page[at] ? 1 : -1) * magnitude) / DECIMAL_SCALE(scale);
}

function fixedValue(page, at, column) {
  switch (column.type) {
    case 'int': return page.readInt32LE(at);
    case 'smallint': return page.readInt16LE(at);
    case 'tinyint': return page[at];
    case 'bigint': return Number(page.readBigInt64LE(at));
    case 'real': return page.readFloatLE(at);
    case 'float': return page.readDoubleLE(at);
    case 'money': return (page.readInt32LE(at) * 4294967296 + page.readUInt32LE(at + 4)) / 10000;
    case 'decimal': return decimal(page, at, column.length, column.scale);
    case 'char': return page.toString('latin1', at, at + column.length).trim();
    case 'nchar': return page.toString('utf16le', at, at + column.length).trim();
    default: return undefined;
  }
}

const TYPE_NAMES = { 48: 'tinyint', 52: 'smallint', 56: 'int', 59: 'real', 62: 'float', 60: 'money', 106: 'decimal', 108: 'decimal', 127: 'bigint', 167: 'varchar', 175: 'char', 231: 'nvarchar', 239: 'nchar' };

/**
 * What's in the file: each user table's page label and columns.
 * @returns {Map<string, { label: string, columns: Map<string, object> }>}
 */
function tables(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const objects = new Map();
    const columns = new Map();
    const rowsets = new Map();
    const units = new Map();
    const placed = new Map();
    const system = new Set(Object.values(SYSTEM));
    for (const { page, record, label } of recordsOf(fd, system)) {
      const at = record.at + 4;
      if (label === SYSTEM.objects) {
        objects.set(page.readInt32LE(at), { name: textOf(page, record.varying[0]), kind: page.toString('latin1', at + 13, at + 15) });
      } else if (label === SYSTEM.columns) {
        const id = page.readInt32LE(at);
        if (!columns.has(id)) columns.set(id, new Map());
        columns.get(id).set(page.readInt32LE(at + 6), {
          name: textOf(page, record.varying[0]), type: TYPE_NAMES[page[at + 10]], length: page.readInt16LE(at + 15), scale: page[at + 18],
        });
      } else if (label === SYSTEM.rowsets) {
        rowsets.set(page.readBigInt64LE(at), { object: page.readInt32LE(at + 9), index: page.readInt32LE(at + 13) });
      } else if (label === SYSTEM.allocationUnits) {
        // In-row data only.
        if (page[at + 8] === 1) units.set(page.readBigInt64LE(at + 9), page.readBigInt64LE(at));
      } else if (label === SYSTEM.columnsOfRowset) {
        const rowset = page.readBigInt64LE(at);
        if (!placed.has(rowset)) placed.set(rowset, []);
        placed.get(rowset).push({ column: page.readInt32LE(at + 8), offset: page.readInt32LE(at + 40), nullBit: page.readInt32LE(at + 44) });
      }
    }
    const found = new Map();
    for (const [rowset, { object, index }] of rowsets) {
      const about = objects.get(object);
      // The table's rows: its heap, or its clustered index.
      if (!about || about.kind !== 'U ' || index > 1 || !units.has(rowset) || !placed.has(rowset)) continue;
      const unit = units.get(rowset);
      const named = new Map();
      for (const { column, offset, nullBit } of placed.get(rowset)) {
        const info = columns.get(object)?.get(column);
        if (info) named.set(info.name, { ...info, offset, nullBit });
      }
      found.set(about.name, { label: `${Number((unit >> 16n) & 0xffffffffn)}:${Number(unit >> 48n)}`, columns: named });
    }
    return found;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Every row of a table, with only the named columns.
 * @param {string} file
 * @param {string} name   A table from tables()
 * @param {string[]} wanted
 */
function* rows(file, { label, columns }, wanted) {
  const picked = wanted.map((name) => {
    const column = columns.get(name);
    if (!column) throw new Error(`A data file's table no longer has ${name}`);
    return { name, ...column };
  });
  const fd = fs.openSync(file, 'r');
  try {
    for (const { page, record } of recordsOf(fd, new Set([label]))) {
      const row = {};
      for (const column of picked) {
        if (column.nullBit > 0 && (page[record.nulls + ((column.nullBit - 1) >> 3)] >> ((column.nullBit - 1) & 7)) & 1) continue;
        // A column's offset says where in the fixed part it sits; a negative one which variable column it is.
        const low = column.offset & 0xffff;
        const signed = low > 0x7fff ? low - 0x10000 : low;
        if (signed >= 0) {
          const value = fixedValue(page, record.at + signed, column);
          if (value !== undefined) row[column.name] = value;
        } else {
          const place = record.varying[-signed - 1];
          if (!place) continue;
          if (column.type === 'varchar') row[column.name] = page.toString('latin1', place[0], place[1]).trim();
          else if (column.type === 'nvarchar') row[column.name] = page.toString('utf16le', place[0], place[1]).trim();
        }
      }
      yield row;
    }
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { tables, rows };
