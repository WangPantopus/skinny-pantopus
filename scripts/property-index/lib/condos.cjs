'use strict';
// A condo's units at one street number share a building record, listing the units the source knows there, and each unit
// points at it. For sources with no record of the complex itself.

const crypto = require('node:crypto');
const { put } = require('./values.cjs');

const BUILDING_FACTS = ['stories', 'exterior_walls', 'roof_cover', 'roof_shape', 'foundation', 'municipality', 'school_district'];

function condoBuildings(records, { fips, county }) {
  const complexes = new Map();
  for (const record of records) {
    if (record.kind !== 'unit' || record.restricted) continue;
    const { pre, name, suffix, post, number, zip } = record.address;
    const key = [pre, name, suffix, post, number, zip].join('|');
    if (!complexes.has(key)) complexes.set(key, []);
    complexes.get(key).push(record);
  }
  const buildings = [];
  for (const [key, units] of complexes) {
    const id = `pp:building:${fips}:${crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)}`;
    const years = units.map((unit) => unit.facts.year_built).filter(Boolean).sort((a, b) => a - b);
    const facts = { units_in_condominium: units.length, county, fips };
    put(facts, 'year_built', years[years.length >> 1]);
    for (const name of BUILDING_FACTS) put(facts, name, units.find((unit) => unit.facts[name])?.facts[name]);
    const roster = [...new Set(units.flatMap((unit) => [unit.address.unit, unit.address.building && `${unit.address.building}${unit.address.unit}`]).filter(Boolean))].sort();
    buildings.push({ id, kind: 'building', home_type: 'condo', address: { ...units[0].address, unit: '', building: '' }, facts, roster });
    for (const unit of units) unit.parent = id;
  }
  return buildings;
}

module.exports = { condoBuildings };
