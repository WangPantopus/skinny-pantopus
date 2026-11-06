'use strict';
// Reading public data services row by row: ArcGIS layers and Socrata datasets. A connector names its columns and the
// service sends nothing else, so owner names and mailing addresses never reach this machine.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const readline = require('node:readline');
const { USER_AGENT } = require('./tables.cjs');
const { log } = require('./log.cjs');

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Errors say what failed and how the server answered, never what a row held.
async function getJson(url, label) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error(`answered ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(`answered error ${data.error.code}`);
      return data;
    } catch (err) {
      if (attempt >= 8) throw new Error(`${label} failed: ${err.constructor === Error ? err.message : err.name}`);
      await wait(attempt * 15000);
    }
  }
}

/**
 * A layer's rows in object ID order, so paging stays fast however large the layer is.
 * @param {string} url       The layer, ending in its number
 * @param {string[]} fields  The columns to ask for
 * @param {object} [options] { where, oid: the layer's object ID column, pageSize }
 */
async function* layerRows(url, fields, { where = '1=1', oid = 'OBJECTID', pageSize = 2000 } = {}) {
  let last = -1;
  let rows = 0;
  for (;;) {
    const query = new URLSearchParams({
      where: `(${where}) AND ${oid} > ${last}`, outFields: [oid, ...fields].join(','), returnGeometry: 'false', orderByFields: oid,
      resultRecordCount: String(pageSize), f: 'json',
    });
    const page = await getJson(`${url}/query?${query}`, `A map layer at row ${rows}`);
    const features = page.features || [];
    if (!features.length) break;
    for (const feature of features) {
      last = feature.attributes[oid];
      rows += 1;
      yield feature.attributes;
    }
  }
}

/** Rows of a Socrata dataset, in row order. */
async function* socrataRows(domain, id, fields, { where, pageSize = 50000 } = {}) {
  let offset = 0;
  for (;;) {
    const query = new URLSearchParams({ $select: fields.join(','), $order: ':id', $limit: String(pageSize), $offset: String(offset) });
    if (where) query.set('$where', where);
    const page = await getJson(`https://${domain}/resource/${id}.json?${query}`, `A dataset at row ${offset}`);
    for (const row of page) yield row;
    offset += page.length;
    if (page.length < pageSize) break;
  }
}

/** A stream of rows kept on disk while a build runs, so a re-run doesn't read the service again. */
async function* cached(file, source) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const gzip = zlib.createGzip({ level: 1 });
    const done = new Promise((resolve, reject) => {
      gzip.pipe(fs.createWriteStream(`${file}.part`)).on('finish', resolve).on('error', reject);
    });
    let rows = 0;
    for await (const row of source()) {
      if (!gzip.write(`${JSON.stringify(row)}\n`)) await new Promise((resolve) => { gzip.once('drain', resolve); });
      rows += 1;
    }
    gzip.end();
    await done;
    fs.renameSync(`${file}.part`, file);
    log(`${path.basename(file)}: read ${rows} rows`);
  }
  for await (const line of readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity })) {
    yield JSON.parse(line);
  }
}

module.exports = { getJson, layerRows, socrataRows, cached };
