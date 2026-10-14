// ============================================================
// HOUSE SHAPE — the household's home as the Today sky draws it
//
// Reads the ATTOM /property/detail record the backend already caches
// for a Home and describes its outline: what kind of home it is, how
// many stories, how big its footprint is, the roof, the garage, a
// fireplace (the chimney) and a pool. The apps draw it
// (TodaySkyHomes.swift / TodaySkyHomes.kt); nothing here is a picture,
// and nothing here calls ATTOM.
//
// County records describe a home; they don't measure it, and coverage
// varies by county. A field the record doesn't state stays null, and
// the apps draw their default for it. Only shape facts are read: never
// an owner, sale, tax or value field.
// ============================================================

// The app's own home types (Add Home) that name a kind of home. "house"
// and "other" are not a choice here: "house" is what a Home gets when
// nobody picked one, so the county record decides for those.
const KIND_BY_HOME_TYPE = {
  townhouse: 'townhouse',
  apartment: 'apartment',
  condo: 'apartment',
  studio: 'apartment',
  multi_unit: 'apartment',
  mobile_home: 'mobile',
  trailer: 'mobile',
  rv: 'mobile',
};

// ATTOM spells keys both ways (livingsize / livingSize), so look them up
// without regard to case.
function field(obj, name) {
  if (!obj || typeof obj !== 'object') return undefined;
  if (name in obj) return obj[name];
  const lower = name.toLowerCase();
  const key = Object.keys(obj).find((k) => k.toLowerCase() === lower);
  return key === undefined ? undefined : obj[key];
}

function text(value) {
  if (typeof value !== 'string') return null;
  const t = value.trim().toUpperCase();
  return t || null;
}

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function yes(value) {
  const t = text(value);
  return t === 'Y' || t === 'YES' || value === true;
}

function no(value) {
  const t = text(value);
  return t === 'N' || t === 'NO' || value === false;
}

// The pattern that appears first in `t` wins ("GABLE/HIP" is a gable).
function firstMatch(t, rules) {
  let best = null;
  for (const [pattern, result] of rules) {
    const match = pattern.exec(t);
    if (match && (best === null || match.index < best.index)) best = { index: match.index, result };
  }
  return best ? best.result : null;
}

function kindFromText(value) {
  const t = text(value);
  if (!t) return null;
  if (/MOBILE|MANUFACTURED/.test(t)) return 'mobile';
  if (/CONDO|CO-?OP|COOPERATIVE/.test(t)) return 'apartment';
  const single = /SINGLE FAMILY|\bSFR\b/.test(t);
  const row = /TOWN ?HOUSE|ROW ?HOUSE/.test(t);
  // "Single Family Residence / Townhouse" (a class, not a type) says neither.
  if (single && row) return null;
  if (row) return 'townhouse';
  if (/DUPLEX/.test(t)) return 'townhouse';
  if (/APARTMENT|MULTI ?-?FAMILY|TRIPLEX|QUADRUPLEX|FOURPLEX/.test(t)) return 'apartment';
  if (single) return 'house';
  return null;
}

function kindFromRecords(property) {
  const summary = property.summary || {};
  if (yes(field(property.building?.summary, 'mobileHomeInd'))) return 'mobile';
  // Most specific first: the property type, then the land use, then the class.
  for (const name of ['propertyType', 'propType', 'propLandUse', 'propSubType', 'propClass']) {
    const kind = kindFromText(field(summary, name));
    if (kind) return kind;
  }
  return null;
}

// 1, 1.5, 2 or 3 stories; anything taller draws as 3.
function storiesBand(value) {
  if (value <= 1.25) return 1;
  if (value < 1.75) return 1.5;
  if (value < 2.5) return 2;
  return 3;
}

const STORY_WORDS = [
  [/ONE AND (ONE )?(A )?HALF|1 1\/2|1\.5/, 1.5],
  [/TWO AND (ONE )?(A )?HALF|2 1\/2|2\.5/, 2],
  [/SPLIT|BI-?LEVEL|TRI-?LEVEL|MULTI-?LEVEL/, 2],
  [/\bTHREE\b|\b3\b/, 3],
  [/\bTWO\b|\b2\b/, 2],
  [/\bONE\b|\b1\b|RANCH/, 1],
];

function storiesFromRecords(building) {
  const summary = building.summary || {};
  const levels = number(field(summary, 'levels'));
  if (levels !== null && levels >= 1 && levels <= 10) return storiesBand(levels);
  const desc = text(field(summary, 'storyDesc'));
  if (desc) {
    for (const [pattern, stories] of STORY_WORDS) {
      if (pattern.test(desc)) return stories;
    }
  }
  // Living area over ground-floor area, when both are on file.
  const size = building.size || {};
  const living = number(field(size, 'livingSize'));
  const ground = number(field(size, 'groundFloorSize'));
  if (living && ground && ground > 200 && living >= ground) return storiesBand(living / ground);
  return null;
}

function footprintFromRecords(building, stories) {
  const size = building.size || {};
  let ground = number(field(size, 'groundFloorSize'));
  if (!(ground > 200)) {
    const living = number(field(size, 'livingSize')) ?? number(field(size, 'universalSize'));
    ground = living > 200 && stories ? living / stories : null;
  }
  if (!ground) return null;
  if (ground < 1000) return 'small';
  if (ground < 1700) return 'medium';
  return 'large';
}

const ROOF_SHAPES = [
  [/FLAT|SHED|BUILT.?UP/, 'flat'],
  [/HIP|MANSARD/, 'hip'],
  [/GABLE|GAMBREL|A.?FRAME|SALTBOX/, 'gable'],
];

function roofFromRecords(building) {
  const construction = building.construction || {};
  const shape = text(field(construction, 'roofShape'));
  const fromShape = shape ? firstMatch(shape, ROOF_SHAPES) : null;
  if (fromShape) return fromShape;
  // Without a shape, a membrane or tar-and-gravel cover means a flat roof.
  const cover = text(field(construction, 'roofCover'));
  if (cover && /TAR|GRAVEL|BUILT.?UP|ROLL|MEMBRANE|RUBBER|EPDM|TPO/.test(cover)) return 'flat';
  return null;
}

function garageFromRecords(building) {
  const parking = building.parking || {};
  const type = text(field(parking, 'garageType')) || text(field(parking, 'prkgType'));
  let garage = null;
  if (type) {
    if (/CARPORT/.test(type)) garage = 'carport';
    else if (/DETACHED/.test(type)) garage = 'detached';
    // Before the garage words: "NO GARAGE" is none.
    else if (/NONE|^NO\b|NO GARAGE/.test(type)) garage = 'none';
    else if (/GARAGE|ATTACHED|BUILT.?IN|TUCK|BASEMENT|UNDERGROUND/.test(type)) garage = 'attached';
    else if (/OPEN|SURFACE|STREET|DRIVEWAY|PAVED|PARKING LOT/.test(type)) garage = 'none';
  }
  if (!garage || garage === 'none') return { garage, spaces: null };
  let spaces = number(field(parking, 'prkgSpaces'));
  if (!(spaces > 0)) {
    const area = number(field(parking, 'prkgSize'));
    spaces = area > 0 ? (area <= 330 ? 1 : area <= 620 ? 2 : 3) : null;
  }
  return { garage, spaces: spaces > 0 ? Math.min(3, Math.max(1, Math.round(spaces))) : null };
}

function fireplaceFromRecords(building) {
  const interior = building.interior || {};
  const count = number(field(interior, 'fplcCount'));
  const indicator = field(interior, 'fplcInd');
  const type = text(field(interior, 'fplcType'));
  if (count > 0 || yes(indicator)) return true;
  if (no(indicator) || (type && /^(NO|NONE)\b/.test(type))) return false;
  // A bare 0 count is often "not recorded", so it decides nothing.
  return null;
}

function poolFromRecords(lot) {
  const type = text(field(lot, 'poolType'));
  if (type) {
    if (/NO POOL|^NO\b|NONE/.test(type)) return false;
    if (/POOL/.test(type)) return true;
  }
  const indicator = field(lot, 'poolInd');
  if (yes(indicator)) return true;
  if (no(indicator)) return false;
  return null;
}

/**
 * The home's outline from an ATTOM /property/detail `property[0]` record.
 * Every field is null when the record doesn't say; null when there's no record.
 */
function houseFromAttomProperty(property) {
  if (!property || typeof property !== 'object') return null;
  const building = property.building || {};
  const stories = storiesFromRecords(building);
  const { garage, spaces } = garageFromRecords(building);
  return {
    kind: kindFromRecords(property),
    stories,
    footprint: footprintFromRecords(building, stories),
    roof: roofFromRecords(building),
    garage,
    garage_spaces: spaces,
    fireplace: fireplaceFromRecords(building),
    pool: poolFromRecords(property.lot || {}),
  };
}

/**
 * What the apps draw: the county record's outline, with the kind of home the
 * household chose (if they chose one) over the record's. `kind` is always set.
 */
function resolveHouse(records, homeType) {
  const r = records && typeof records === 'object' ? records : {};
  return {
    kind: KIND_BY_HOME_TYPE[homeType] || r.kind || 'house',
    stories: r.stories ?? null,
    footprint: r.footprint ?? null,
    roof: r.roof ?? null,
    garage: r.garage ?? null,
    garage_spaces: r.garage_spaces ?? null,
    fireplace: r.fireplace ?? null,
    pool: r.pool ?? null,
  };
}

module.exports = { houseFromAttomProperty, resolveHouse };
