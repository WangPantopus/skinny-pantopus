'use strict';
// Merges what every source says about one county's addresses into registry records (registryFormat.js): one subject per
// real address, the best point any source has, and a building's list of units. A source's row is never trusted to be
// complete: one has the street type, another the ZIP, a third the unit.

const { QUALITIES } = require('../../../backend/services/propertyRecords/registryFormat');

// Same street line, ZIPs agree: the same place even this far apart (a driveway against a rooftop on a long rural lot).
const SAME_LINE_METERS = 2000;
// Sources disagreeing on a direction, type or ZIP are the same place only when their points are this close.
const NEARBY_METERS = 150;
const SAME_POINT_METERS = 3;
const QUALITY_RANK = new Map(QUALITIES.map((quality, i) => [quality, i]));

// A partition row (build-registry.cjs).
const [NUMBER, PRE, NAME, SUFFIX, POST, UNIT, BUILDING, URB, CITY, ZIP, LNG, LAT, QUALITY, USE, SOURCE] = Array.from({ length: 15 }, (_, i) => i);

function meters(a, b) {
  const scale = Math.cos((a[LAT] * Math.PI) / 180);
  const dx = (a[LNG] - b[LNG]) * scale * 111320;
  const dy = (a[LAT] - b[LAT]) * 110540;
  return Math.sqrt(dx * dx + dy * dy);
}

const agrees = (a, b) => !a || !b || a === b;

/** Which of two rows' points a pin should use: how it was placed, then whose it is (rank[source]: county points before national files). */
function better(a, b, ranks) {
  const qa = QUALITY_RANK.get(a[QUALITY]) ?? 9;
  const qb = QUALITY_RANK.get(b[QUALITY]) ?? 9;
  if (qa !== qb) return qa < qb;
  return (ranks[a[SOURCE]] ?? 9) < (ranks[b[SOURCE]] ?? 9);
}

function fits(cluster, row) {
  const best = cluster.best;
  if (!agrees(cluster[PRE], row[PRE]) || !agrees(cluster[SUFFIX], row[SUFFIX]) || !agrees(cluster[POST], row[POST])) return false;
  const distance = meters(best, row);
  const sameLine = cluster[PRE] === row[PRE] && cluster[SUFFIX] === row[SUFFIX] && cluster[POST] === row[POST];
  if (cluster[ZIP] && row[ZIP] && cluster[ZIP] !== row[ZIP]) return distance <= NEARBY_METERS;
  return sameLine ? distance <= SAME_LINE_METERS : distance <= NEARBY_METERS;
}

function absorb(cluster, row, ranks) {
  for (const field of [PRE, SUFFIX, POST, ZIP, CITY, USE]) if (!cluster[field] && row[field]) cluster[field] = row[field];
  if (better(row, cluster.best, ranks)) cluster.best = row;
}

/** The address's fields, leaving out what's empty: most are, and a release is compressed JSON. */
function addressOf(cluster, number, name, urbanization, unit = '', building = '') {
  const address = { number, name };
  if (cluster[PRE]) address.pre = cluster[PRE];
  if (cluster[SUFFIX]) address.suffix = cluster[SUFFIX];
  if (cluster[POST]) address.post = cluster[POST];
  if (unit) address.unit = unit;
  if (building) address.building = building;
  if (urbanization) address.urbanization = urbanization;
  if (cluster[CITY]) address.city = cluster[CITY];
  if (cluster[ZIP]) address.zip = cluster[ZIP];
  return address;
}

const unitOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const USE_CODE = { residential: 'r', commercial: 'c' };

function pointOf(row) {
  return [Number(row[LNG].toFixed(6)), Number(row[LAT].toFixed(6))];
}

function subject(kind, cluster, row, address, extra = {}) {
  const record = { kind, address, point: pointOf(row), q: row[QUALITY], s: row[SOURCE], ...extra };
  if (cluster[USE] && USE_CODE[cluster[USE]]) record.use = USE_CODE[cluster[USE]];
  return record;
}

/**
 * @param {Array[]} rows   One county's partition rows
 * @param {number[]} ranks Per source index, lower first when points are equally well placed
 * @returns {object[]} Its registry records
 */
function mergeCounty(rows, ranks) {
  const groups = new Map();
  for (const row of rows) {
    // A building letter with no unit under it is what tells homes apart there.
    if (!row[UNIT] && row[BUILDING]) {
      row[UNIT] = row[BUILDING];
      row[BUILDING] = '';
    }
    const key = `${row[NAME]}\u0000${row[NUMBER]}\u0000${row[URB]}`;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
    }
    group.push(row);
  }
  const records = [];
  for (const group of groups.values()) {
    const [{ [NUMBER]: number, [NAME]: name, [URB]: urbanization }] = group;
    group.sort((a, b) => (better(a, b, ranks) ? -1 : better(b, a, ranks) ? 1 : 0));
    const clusters = [];
    // Rows saying the most go first, so a sparse one joins the street line it agrees with.
    const saying = (row) => (row[PRE] ? 1 : 0) + (row[SUFFIX] ? 1 : 0) + (row[POST] ? 1 : 0) + (row[ZIP] ? 1 : 0);
    const ordered = group.map((row, i) => [row, i]).sort((a, b) => saying(b[0]) - saying(a[0]) || a[1] - b[1]).map(([row]) => row);
    for (const row of ordered) {
      let cluster = clusters.find((candidate) => fits(candidate, row));
      if (!cluster) {
        cluster = { [PRE]: row[PRE], [SUFFIX]: row[SUFFIX], [POST]: row[POST], [ZIP]: row[ZIP], [CITY]: row[CITY], [USE]: row[USE], best: row, base: null, units: new Map() };
        clusters.push(cluster);
      }
      absorb(cluster, row, ranks);
      if (row[UNIT]) {
        const unitKey = `${row[BUILDING]}\u0000${row[UNIT]}`;
        const known = cluster.units.get(unitKey);
        if (!known || better(row, known, ranks)) cluster.units.set(unitKey, row);
      } else if (!cluster.base || better(row, cluster.base, ranks)) cluster.base = row;
    }
    for (const cluster of clusters) {
      const baseAddress = addressOf(cluster, number, name, urbanization);
      if (!cluster.units.size) {
        records.push(subject('property', cluster, cluster.base || cluster.best, baseAddress));
        continue;
      }
      const list = [...cluster.units.values()];
      const roster = list.map((row) => `${row[BUILDING]}${row[UNIT]}`).sort(unitOrder.compare);
      const building = subject('building', cluster, cluster.base || list[0], baseAddress, { roster });
      records.push(building);
      for (const row of list) {
        const unit = { kind: 'unit', address: addressOf(cluster, number, name, urbanization, row[UNIT], row[BUILDING]), s: row[SOURCE] };
        // Most units share their building's point; say so by saying nothing.
        if (meters(row, cluster.base || list[0]) > SAME_POINT_METERS) {
          unit.point = pointOf(row);
          unit.q = row[QUALITY];
        }
        records.push(unit);
      }
    }
  }
  return records;
}

module.exports = { mergeCounty };
