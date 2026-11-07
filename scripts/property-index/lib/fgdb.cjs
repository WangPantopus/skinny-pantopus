'use strict';
// A table in an Esri file geodatabase, row by row, with no packages: the format is the one GDAL's OpenFileGDB driver
// documents. Only the columns a connector names are decoded; everything else is skipped over, so owner names and mailing
// addresses never become text in this process. A geometry column named in the list reads as its rings.

const fs = require('node:fs');
const path = require('node:path');
const { log } = require('./log.cjs');

const TYPE = { INT16: 0, INT32: 1, FLOAT32: 2, FLOAT64: 3, STRING: 4, DATETIME: 5, OBJECTID: 6, GEOMETRY: 7, BINARY: 8, RASTER: 9, GUID: 10, GLOBALID: 11, XML: 12, INT64: 13, DATE: 14, TIME: 15, DATETIME_OFFSET: 16 };
const DAY_MS = 86400000;
const EPOCH_1899 = Date.UTC(1899, 11, 30);

function varUint(buffer, start) {
  let value = 0;
  let shift = 1;
  let position = start;
  for (;;) {
    const byte = buffer[position];
    position += 1;
    value += (byte & 0x7f) * shift;
    if (byte < 0x80) return [value, position];
    shift *= 128;
  }
}

/** A signed one: the first byte's bit 6 is the sign. */
function varInt(buffer, start) {
  let byte = buffer[start];
  let position = start + 1;
  const negative = (byte & 0x40) !== 0;
  let value = byte & 0x3f;
  let shift = 64;
  while (byte >= 0x80) {
    byte = buffer[position];
    position += 1;
    value += (byte & 0x7f) * shift;
    shift *= 128;
  }
  return [negative ? -value : value, position];
}

const POLYGON_TYPES = new Set([5, 15, 19, 25, 51]);

/** A polygon's rings as [[x, y], ...] in the table's coordinates, or null for anything else or an empty shape. */
function readPolygon(buffer, start, { xOrigin, yOrigin, xyScale }) {
  let [type, p] = varUint(buffer, start);
  if (!POLYGON_TYPES.has(type % 256)) return null;
  let points;
  [points, p] = varUint(buffer, p);
  if (!points) return null;
  let parts;
  [parts, p] = varUint(buffer, p);
  // The curves' count, when the type's flag says there are any.
  if (Math.floor(type / 0x20000000) % 2 === 1) [, p] = varUint(buffer, p);
  for (let i = 0; i < 4; i += 1) [, p] = varUint(buffer, p); // the shape's box
  const sizes = [];
  let left = points;
  for (let i = 0; i < parts - 1; i += 1) {
    let size;
    [size, p] = varUint(buffer, p);
    sizes.push(size);
    left -= size;
  }
  sizes.push(left);
  let x = 0;
  let y = 0;
  return sizes.map((size) => {
    const ring = [];
    for (let i = 0; i < size; i += 1) {
      let dx;
      let dy;
      [dx, p] = varInt(buffer, p);
      [dy, p] = varInt(buffer, p);
      x += dx;
      y += dy;
      ring.push([x / xyScale + xOrigin, y / xyScale + yOrigin]);
    }
    return ring;
  });
}

/** The columns of a table: name, type and whether a row's null bits cover it. */
function readFields(fd) {
  const head = Buffer.alloc(40);
  fs.readSync(fd, head, 0, 40, 0);
  const sectionAt = Number(head.readBigUInt64LE(32));
  const sizeBuffer = Buffer.alloc(4);
  fs.readSync(fd, sizeBuffer, 0, 4, sectionAt);
  const size = sizeBuffer.readUInt32LE(0);
  const section = Buffer.alloc(size);
  fs.readSync(fd, section, 0, size, sectionAt + 4);
  const count = section.readUInt16LE(8);
  const fields = [];
  let p = 10;
  for (let i = 0; i < count; i += 1) {
    const nameChars = section[p];
    const name = section.toString('utf16le', p + 1, p + 1 + nameChars * 2);
    p += 1 + nameChars * 2;
    p += 1 + section[p] * 2; // alias
    const type = section[p];
    p += 1;
    let nullable = false;
    let grid = null;
    if (type === TYPE.STRING) {
      const flags = section[p + 4];
      nullable = (flags & 1) !== 0;
      p += 5;
      if (flags & 4) {
        const [length, after] = varUint(section, p);
        p = after + length;
      }
    } else if (type === TYPE.OBJECTID || type === TYPE.BINARY || type === TYPE.GUID || type === TYPE.GLOBALID || type === TYPE.XML) {
      nullable = (section[p + 1] & 1) !== 0;
      p += 2;
    } else if (type === TYPE.GEOMETRY) {
      nullable = (section[p + 1] & 1) !== 0;
      p += 2;
      const wktBytes = section.readUInt16LE(p);
      p += 2 + wktBytes;
      const flags = section[p];
      p += 1;
      const hasM = (flags & 2) !== 0;
      const hasZ = (flags & 4) !== 0;
      grid = { xOrigin: section.readDoubleLE(p), yOrigin: section.readDoubleLE(p + 8), xyScale: section.readDoubleLE(p + 16) };
      p += 24 + (hasM ? 16 : 0) + (hasZ ? 16 : 0) + 8 + (hasM ? 8 : 0) + (hasZ ? 8 : 0) + 32;
      // Newer tables carry Z and M extents here: the grid's count is the first place that reads as a small number.
      for (let tries = 0; tries < 3; tries += 1) {
        const grids = section[p] === 0 ? section.readUInt32LE(p + 1) : -1;
        if (grids >= 1 && grids <= 3) {
          p += 5 + grids * 8;
          break;
        }
        if (tries === 2) throw new Error('A geodatabase table has a geometry column this reader doesn\'t follow');
        p += 16;
      }
    } else if (type === TYPE.RASTER) {
      throw new Error('A geodatabase table has a raster column');
    } else {
      const flags = section[p + 1];
      nullable = (flags & 1) !== 0;
      p += 2;
      if (flags & 4) p += 1 + section[p];
    }
    fields.push({ name, type, nullable, grid });
  }
  return fields;
}

/** The catalog's table names and their files. */
function catalog(dir) {
  const names = new Map();
  for (const row of readRows(path.join(dir, 'a00000001'), ['ID', 'Name'])) names.set(row.Name, path.join(dir, `a${Number(row.ID).toString(16).padStart(8, '0')}`));
  return names;
}

function* readRows(base, columns, { optional = [] } = {}) {
  const table = fs.openSync(`${base}.gdbtable`, 'r');
  const index = fs.openSync(`${base}.gdbtablx`, 'r');
  try {
    const fields = readFields(table);
    const names = new Set(fields.map((field) => field.name));
    const missing = columns.filter((column) => !names.has(column) && !optional.includes(column));
    if (missing.length) throw new Error(`A geodatabase table no longer has ${missing.join(', ')}`);
    const wanted = new Set(columns);
    const nullBytes = Math.ceil(fields.filter((field) => field.nullable).length / 8);
    const head = Buffer.alloc(16);
    fs.readSync(index, head, 0, 16, 0);
    const blocks = head.readUInt32LE(4);
    const rowCount = head.readUInt32LE(8);
    const offsetSize = head.readUInt32LE(12);
    if (blocks === 0) return;
    const chunkRows = 65536;
    const offsets = Buffer.alloc(chunkRows * offsetSize);
    let row = Buffer.alloc(1 << 20);
    const lengthBuffer = Buffer.alloc(4);
    for (let start = 0; start < rowCount; start += chunkRows) {
      const size = Math.min(chunkRows, rowCount - start);
      fs.readSync(index, offsets, 0, size * offsetSize, 16 + start * offsetSize);
      for (let i = 0; i < size; i += 1) {
        const at = offsets.readUIntLE(i * offsetSize, offsetSize);
        if (at === 0) continue;
        fs.readSync(table, lengthBuffer, 0, 4, at);
        const length = lengthBuffer.readUInt32LE(0);
        if (length > row.length) row = Buffer.alloc(length);
        fs.readSync(table, row, 0, length, at + 4);
        const out = {};
        let nullIndex = 0;
        let p = nullBytes;
        for (const { name, type, nullable, grid } of fields) {
          // An object ID isn't stored: it's the row's place in the index.
          if (type === TYPE.OBJECTID) {
            if (wanted.has(name)) out[name] = start + i + 1;
            continue;
          }
          if (nullable) {
            const isNull = (row[nullIndex >> 3] >> (nullIndex & 7)) & 1;
            nullIndex += 1;
            if (isNull) continue;
          }
          const keep = wanted.has(name);
          if (type === TYPE.STRING || type === TYPE.XML) {
            const [bytes, after] = varUint(row, p);
            if (keep) out[name] = row.toString('utf8', after, after + bytes).trim();
            p = after + bytes;
          } else if (type === TYPE.GEOMETRY || type === TYPE.BINARY) {
            const [bytes, after] = varUint(row, p);
            if (keep && type === TYPE.GEOMETRY) out[name] = readPolygon(row, after, grid);
            p = after + bytes;
          } else if (type === TYPE.INT16) {
            if (keep) out[name] = row.readInt16LE(p);
            p += 2;
          } else if (type === TYPE.INT32) {
            if (keep) out[name] = row.readInt32LE(p);
            p += 4;
          } else if (type === TYPE.INT64) {
            if (keep) out[name] = Number(row.readBigInt64LE(p));
            p += 8;
          } else if (type === TYPE.FLOAT32) {
            if (keep) out[name] = row.readFloatLE(p);
            p += 4;
          } else if (type === TYPE.FLOAT64) {
            if (keep) out[name] = row.readDoubleLE(p);
            p += 8;
          } else if (type === TYPE.DATETIME || type === TYPE.DATE || type === TYPE.TIME) {
            if (keep) out[name] = EPOCH_1899 + row.readDoubleLE(p) * DAY_MS;
            p += 8;
          } else if (type === TYPE.DATETIME_OFFSET) {
            if (keep) out[name] = EPOCH_1899 + row.readDoubleLE(p) * DAY_MS;
            p += 10;
          } else if (type === TYPE.GUID || type === TYPE.GLOBALID) {
            p += 16;
          } else throw new Error(`A geodatabase column has type ${type}`);
        }
        yield out;
      }
    }
  } finally {
    fs.closeSync(table);
    fs.closeSync(index);
  }
}

/** Every row of a named table in an unzipped geodatabase folder. */
function* tableRows(dir, tableName, columns, options) {
  const tables = catalog(dir);
  const base = tables.get(tableName);
  if (!base) throw new Error(`A geodatabase no longer has the table ${tableName}`);
  let rows = 0;
  for (const row of readRows(base, columns, options)) {
    rows += 1;
    yield row;
  }
  log(`${tableName}: ${rows} rows`);
}

/** A table's column names. */
function fieldNames(base) {
  const table = fs.openSync(`${base}.gdbtable`, 'r');
  try {
    return readFields(table).map((field) => field.name);
  } finally {
    fs.closeSync(table);
  }
}

module.exports = { catalog, tableRows, fieldNames, rows: readRows };
