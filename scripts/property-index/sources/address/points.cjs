'use strict';
// State and county address points, read from their publishers: where they say more than the national files, usually which
// units an address has. Each passes the rights register first (rights.cjs); one entry here per layer.

const { mapLayer } = require('../../lib/tables.cjs');
const { log } = require('../../lib/log.cjs');
const { parse } = require('../../../../backend/services/propertyRecords/addressKey');
const { POINT_LAYERS } = require('./rights.cjs');

// A layer that keeps only the whole line can add another name in brackets: "123 SWAN MOUNTAIN RD (CR 30)".
const ALSO_KNOWN_AS = /\s*\([^)]*\)/g;

async function* rows({ states = null }) {
  for (const layer of POINT_LAYERS) {
    if (states && !states.has(layer.state)) continue;
    let count = 0;
    const columns = [...Object.values(layer.fields), ...(layer.secondary || [])];
    for await (const row of mapLayer(layer.url, columns, { points: true, where: layer.where })) {
      const read = (field) => (layer.fields[field] ? row[layer.fields[field]] ?? '' : '');
      count += 1;
      // The whole line, read the way a person's is; the layer's unit columns win over a unit at the end of the line.
      const line = layer.fields.line
        ? parse(`${read('line')}`.replace(ALSO_KNOWN_AS, ''), (layer.secondary || []).map((column) => row[column] ?? '').join(' ').trim()) || {}
        : null;
      yield {
        source: `point:${layer.id}`,
        record: '',
        state: layer.state,
        number: line ? line.number || '' : `${read('number')}`,
        pre: line ? line.pre : read('pre'),
        name: line ? line.name || '' : read('name'),
        suffix: line ? line.suffix : read('suffix'),
        post: line ? line.post : read('post'),
        unit: line ? line.unit : `${read('unit')}`,
        building: line ? line.building : `${read('building')}`,
        city: read('city'),
        zip: `${read('zip')}`,
        lng: row._lng,
        lat: row._lat,
        quality: layer.quality || 'unknown',
        use: '',
      };
    }
    log(`point:${layer.id}: ${count} rows`);
  }
}

module.exports = { id: 'point', rows, asOf: () => new Date().toISOString().slice(0, 10) };
