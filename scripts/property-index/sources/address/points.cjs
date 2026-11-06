'use strict';
// State and county address points, read from their publishers: where they say more than the national files, usually which
// units an address has. Each passes the rights register first (rights.cjs); one entry here per layer.

const { mapLayer } = require('../../lib/tables.cjs');
const { log } = require('../../lib/log.cjs');
const { POINT_LAYERS } = require('./rights.cjs');

async function* rows({ states = null }) {
  for (const layer of POINT_LAYERS) {
    if (states && !states.has(layer.state)) continue;
    let count = 0;
    for await (const row of mapLayer(layer.url, Object.values(layer.fields), { points: true })) {
      const read = (field) => (layer.fields[field] ? row[layer.fields[field]] ?? '' : '');
      count += 1;
      yield {
        source: `point:${layer.id}`,
        record: '',
        state: layer.state,
        number: `${read('number')}`,
        pre: read('pre'),
        name: read('name'),
        suffix: read('suffix'),
        post: read('post'),
        unit: `${read('unit')}`,
        building: `${read('building')}`,
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
