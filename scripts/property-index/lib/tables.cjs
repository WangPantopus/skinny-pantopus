'use strict';
// Reading a source's files: downloads, delimited tables inside a zip, and public map layers, page by page. A table is
// read through the list of columns its connector asks for, so anything else in the file (owner names, mailing
// addresses, phone numbers) never leaves this file's loop.

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn, execFileSync } = require('node:child_process');
const { log } = require('./log.cjs');

// Some counties answer a plain script with an error page.
const USER_AGENT = 'Mozilla/5.0 (compatible; PantopusPropertyIndex/1.0; +https://pantopus.com)';

function download(url, file) {
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const partial = `${file}.part`;
  // Some county servers crawl: long deadline, and a dropped download picks up where it stopped.
  execFileSync('curl', ['-fsSL', '-A', USER_AGENT, '--retry', '8', '--retry-delay', '20', '--retry-all-errors', '-C', '-',
    '--speed-limit', '1024', '--speed-time', '120', '--max-time', '7200', '-o', partial, url], { stdio: ['ignore', 'inherit', 'inherit'] });
  fs.renameSync(partial, file);
}

/**
 * A stream's lines, with the consumer setting the pace. readline's iterator throws "readline was closed" when a slow
 * consumer falls behind and the stream ends: that lost the end of a table in checks that write as they read.
 */
async function* streamLines(stream) {
  let rest = '';
  for await (const chunk of stream) {
    const lines = (rest + chunk).split('\n');
    rest = lines.pop();
    for (const line of lines) yield line.endsWith('\r') ? line.slice(0, -1) : line;
  }
  if (rest) yield rest;
}

/** A quoted CSV line's fields ("" inside quotes is one quote). Lines with a line break inside quotes aren't expected. */
function splitQuoted(line, delimiter) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      fields.push(field);
      field = '';
    } else field += char;
  }
  fields.push(field);
  return fields;
}

const blank = (value) => value === undefined || value === '' || value === 'NULL';

/**
 * Yields one object per row of a delimited table inside a zip, holding only `columns`.
 * @param {string} zip           The zip file
 * @param {string} member        The table inside it
 * @param {string[]} columns     What this connector reads; a missing one stops the build (the source changed)
 * @param {object} [options]     { delimiter: ',', quoted: true, encoding: 'latin1' }
 */
async function* zipTable(zip, member, columns, { delimiter = ',', quoted = true, encoding = 'latin1' } = {}) {
  const unzip = spawn('unzip', ['-p', zip, member], { stdio: ['ignore', 'pipe', 'ignore'] });
  const exited = new Promise((resolve, reject) => {
    unzip.on('error', reject);
    unzip.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`unzip of ${member} exited ${code}`))));
  });
  unzip.stdout.setEncoding(encoding);
  let positions = null;
  let rows = 0;
  for await (const line of streamLines(unzip.stdout)) {
    const fields = quoted && line.includes('"') ? splitQuoted(line, delimiter) : line.split(delimiter);
    if (!positions) {
      const header = fields.map((name) => name.replace(/^\ufeff/, '').trim());
      positions = columns.map((column) => header.indexOf(column));
      const missing = columns.filter((_, i) => positions[i] < 0);
      if (missing.length) throw new Error(`${member} no longer has ${missing.join(', ')}`);
      continue;
    }
    const row = {};
    for (let i = 0; i < columns.length; i += 1) {
      const value = fields[positions[i]]?.trim();
      row[columns[i]] = blank(value) ? '' : value;
    }
    rows += 1;
    yield row;
  }
  await exited;
  log(`${member}: ${rows} rows`);
}

/** What a zip holds. */
function zipMembers(zip) {
  return execFileSync('unzip', ['-Z1', zip], { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').split('\n').filter(Boolean);
}

/** Every row of a public map layer, page by page, holding only `fields` (and with `points`, each point as _lng and _lat). */
/** When each of a zip's files was written, YYYY-MM-DD by name. `unzip -l` prints MM-DD-YYYY on a Mac and YYYY-MM-DD on Linux. */
function zipDates(zip, listing = execFileSync('unzip', ['-l', zip], { encoding: 'latin1' })) {
  const dates = new Map();
  for (const line of listing.split('\n')) {
    const row = /^\s*\d+\s+(?:(\d{2})-(\d{2})-(\d{4})|(\d{4})-(\d{2})-(\d{2}))\s+\d{2}:\d{2}\s+(.+?)\s*$/.exec(line);
    if (row) dates.set(row[7], row[3] ? `${row[3]}-${row[1]}-${row[2]}` : `${row[4]}-${row[5]}-${row[6]}`);
  }
  return dates;
}

async function* mapLayer(url, fields, { points = false } = {}) {
  let offset = 0;
  for (;;) {
    const query = new URLSearchParams({
      where: '1=1', outFields: fields.join(','), returnGeometry: points ? 'true' : 'false', orderByFields: 'OBJECTID',
      ...(points ? { outSR: '4326' } : {}),
      resultOffset: String(offset), resultRecordCount: '2000', f: 'json',
    });
    let page = null;
    for (let attempt = 1; !page; attempt += 1) {
      try {
        const response = await fetch(`${url}/query?${query}`, { signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error(`answered ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(`answered error ${data.error.code}`);
        page = data;
      } catch (err) {
        if (attempt >= 6) throw new Error(`A map layer failed at row ${offset}: ${err.message}`);
        await new Promise((resolve) => { setTimeout(resolve, attempt * 10000); });
      }
    }
    for (const feature of page.features || []) yield points ? { ...feature.attributes, _lng: feature.geometry?.x, _lat: feature.geometry?.y } : feature.attributes;
    offset += (page.features || []).length;
    if (!page.features?.length || !page.exceededTransferLimit) break;
  }
  log(`map layer: ${offset} rows`);
}

/** A map layer kept on disk while a build runs, so a re-run doesn't read it again. */
async function* cachedLayer(file, url, fields) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const out = fs.createWriteStream(`${file}.part`);
    for await (const row of mapLayer(url, fields)) out.write(`${JSON.stringify(row)}\n`);
    await new Promise((resolve) => { out.end(resolve); });
    fs.renameSync(`${file}.part`, file);
  }
  for await (const line of readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })) {
    yield JSON.parse(line);
  }
}

module.exports = { download, zipTable, zipMembers, zipDates, streamLines, splitQuoted, mapLayer, cachedLayer, USER_AGENT };
