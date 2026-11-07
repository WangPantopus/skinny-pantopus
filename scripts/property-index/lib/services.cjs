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
 * @param {object} [options] { where, oid: the layer's object ID column, pageSize, optional: columns some layers don't have }
 */
async function* layerRows(url, fields, { where = '1=1', oid = 'OBJECTID', pageSize = 2000, optional = [] } = {}) {
  let last = -1;
  let rows = 0;
  let columns = fields;
  if (optional.length) {
    const info = await getJson(`${url}?f=json`, 'A map layer\'s description');
    const names = new Set((info.fields || []).map((field) => field.name));
    columns = fields.filter((name) => names.has(name) || !optional.includes(name));
  }
  for (;;) {
    const query = new URLSearchParams({
      where: `(${where}) AND ${oid} > ${last}`, outFields: [oid, ...columns].join(','), returnGeometry: 'false', orderByFields: oid,
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

/**
 * Each parcel's area in square feet from its own shape, asked for in a state plane system in feet (a layer's own area column is often in Web
 * Mercator, which overstates areas away from the equator). Rings are summed with their signs, so holes come out.
 * @param {string} url    The layer, ending in its number
 * @param {string} outSR  The state plane system's code, in US feet
 * @returns {AsyncGenerator<{ OBJECTID: number, area: number }>}
 */
async function* layerAreas(url, outSR, { pageSize = 1000 } = {}) {
  let last = -1;
  for (;;) {
    const query = new URLSearchParams({ where: `OBJECTID > ${last}`, outFields: 'OBJECTID', returnGeometry: 'true', outSR, orderByFields: 'OBJECTID', resultRecordCount: String(pageSize), f: 'json' });
    const page = await getJson(`${url}/query?${query}`, 'A parcel shape page');
    const features = page.features || [];
    if (!features.length) return;
    for (const feature of features) {
      let signed = 0;
      for (const ring of feature.geometry?.rings || []) {
        for (let i = 0; i < ring.length - 1; i += 1) signed += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      }
      yield { OBJECTID: feature.attributes.OBJECTID, area: Math.round(Math.abs(signed) / 2) };
      last = Math.max(last, feature.attributes.OBJECTID);
    }
  }
}

/** A table's rows by page offset, for a table whose object ID column can't be paged on. */
async function* offsetRows(url, fields, { where = '1=1', orderBy, pageSize = 1000 } = {}) {
  let offset = 0;
  for (;;) {
    const query = new URLSearchParams({ where, outFields: fields.join(','), returnGeometry: 'false', orderByFields: orderBy, resultOffset: String(offset), resultRecordCount: String(pageSize), f: 'json' });
    const page = await getJson(`${url}/query?${query}`, `A map table at row ${offset}`);
    const features = page.features || [];
    if (!features.length) break;
    for (const feature of features) yield feature.attributes;
    offset += features.length;
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

/** Rows of a CARTO table, in row order. */
async function* cartoRows(base, table, fields, { where = 'true', pageSize = 20000 } = {}) {
  let last = -1;
  for (;;) {
    const sql = `SELECT cartodb_id,${fields.join(',')} FROM ${table} WHERE (${where}) AND cartodb_id > ${last} ORDER BY cartodb_id LIMIT ${pageSize}`;
    const page = await getJson(`${base}?${new URLSearchParams({ q: sql })}`, `A table after row ${last}`);
    const rows = page.rows || [];
    if (!rows.length) break;
    for (const row of rows) {
      last = row.cartodb_id;
      yield row;
    }
  }
}

/** Rows of a CKAN datastore table, in row order. */
async function* ckanRows(domain, resource, fields, { pageSize = 20000 } = {}) {
  let offset = 0;
  for (;;) {
    const query = new URLSearchParams({ resource_id: resource, fields: fields.join(','), sort: '_id', limit: String(pageSize), offset: String(offset) });
    const page = await getJson(`https://${domain}/api/3/action/datastore_search?${query}`, `A table at row ${offset}`);
    const rows = page.result?.records || [];
    for (const row of rows) yield row;
    offset += rows.length;
    if (rows.length < pageSize) break;
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

module.exports = { getJson, layerRows, layerAreas, offsetRows, socrataRows, cartoRows, ckanRows, cached };
