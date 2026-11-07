'use strict';

/**
 * A building's floor-plan sheet as the property index holds it, and how a sheet reads
 * on a screen (floorPlans.js reads it, scripts/property-index/build-floor-plans.cjs
 * writes it, routes/floorPlanSheets.js checks one on intake). No dependencies beyond this
 * folder's, so the build runs without the backend's packages.
 *
 * Under its own prefix, `floor-plans/`, beside `registry/`:
 *   states/<ST>.json                       which release each of a state's sheets serves, its previous one and its
 *                                          status, and which street keys reach which sheet. Replacing this file
 *                                          is what publishes a sheet, withdraws one or moves one back.
 *   releases/<sheet>/<release>.json.gz     one sheet, never changed once written. A building that renumbers or
 *                                          renovates gets a new release.
 *
 * A plan's facts attach to a unit only when the sheet itself says which units have that
 * plan: a stack with its floors, or a list. A plan with neither stays the building's. So a
 * release holds a building's plans, each with the units it names, and turns into the same
 * records a county release holds (`recordsAt`), which identity.js matches by the same
 * rules: a unit's plan goes out only on an exact match, and a unit the sheet doesn't name
 * gets the building's ranges. Who sent a sheet and who granted permission stay in the
 * review queue; a release says only what the permission covers.
 */

const { parts, parse, sortKey, zip5, city: cityKey, stateCode, stateOfCounty } = require('./addressKey');
const { registryId } = require('./registryFormat');

const FORMAT = 1;
const FLOOR_PLAN_PREFIX = 'floor-plans';
const SCOPES = new Set(['facts', 'facts_and_images']);
const GRANTORS = new Set(['building_manager', 'building_owner', 'resident_with_permission']);
const MAX_ADDRESSES = 10;
const MAX_PLANS = 200;
const MAX_UNITS = 20000;
const MAX_FLOORS = 300;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const statePath = (state) => `states/${state}.json`;
const sheetPath = (sheet, release) => `releases/${sheet}/${release}.json.gz`;

const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => {
  const clean = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean && clean.length <= max ? clean : null;
};
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) && !Number.isNaN(Date.parse(value));

/** A count or size as the sheet gives it. Null when the sheet doesn't say; undefined when it says something this can't use. */
function factNumber(value, { min, max, whole = true, step = null }) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (whole && !Number.isInteger(n))) return undefined;
  if (step && !Number.isInteger(n / step)) return undefined;
  return n;
}

/** One unit as a person's address would read it: "BLDG A UNIT 101" is unit 101 of building A; 012 stays 012. */
function unitEntry(raw) {
  const { unit, building } = parts({ number: '1', name: 'X', unit: String(raw ?? '') });
  if (!unit) return null;
  return building ? `${building}|${unit}` : unit;
}

/** Every unit a stack names, on the floors the sheet says. A stack with no floors names none, and isn't accepted. */
function stackUnits(stack, problems) {
  const suffix = text(stack?.stack, 8);
  const from = Number(stack?.floors?.from);
  const to = Number(stack?.floors?.to);
  if (!suffix || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to - from > MAX_FLOORS) {
    problems.push('A stack needs its name and the floors it covers');
    return [];
  }
  const skip = new Set(Array.isArray(stack.floors.skip) ? stack.floors.skip.map(Number) : []);
  const pad = Number.isInteger(stack.pad) && stack.pad > 0 && stack.pad <= 4 ? stack.pad : 0;
  const units = [];
  for (let floor = from; floor <= to; floor += 1) {
    if (!skip.has(floor)) units.push(`${String(floor).padStart(pad, '0')}${suffix}`);
  }
  return units;
}

/**
 * Reads what a manager sent, or what review saved, into what a release holds. Problems are words for the person
 * sending it, counts rather than the units or addresses, so they're safe in a public log too.
 *
 * @param {object} raw { building: { name, addresses: [{ line1, city, state, zip }] }, as_of, plans: [{ name, bedrooms,
 *   bathrooms, sq_ft, units: [...], stacks: [{ stack, floors: { from, to, skip }, pad }] }], permission: { role, scope, granted_at } }
 * @returns {{ sheet: object|null, problems: string[], summary: object }}
 */
function readSheet(raw) {
  const problems = [];
  const given = object(raw) ? raw : {};
  const addresses = [];
  let state = null;
  const addressList = Array.isArray(given.building?.addresses) ? given.building.addresses : [];
  if (!addressList.length || addressList.length > MAX_ADDRESSES) problems.push(`A sheet names 1 to ${MAX_ADDRESSES} street addresses for its building`);
  for (const address of addressList.slice(0, MAX_ADDRESSES)) {
    const code = stateCode(address?.state);
    const zip = zip5(address?.zip);
    const read = code && zip ? parse(address?.line1, '', { state: code, zip }) : null;
    // The building's own address. A floor plan names its units, not its street line.
    if (!read || read.form !== 'street' || read.unit) {
      problems.push('Each address needs a street number and name, a state and a ZIP, with no unit');
      continue;
    }
    if (state && state !== code) problems.push('A building sits in one state');
    state = state || code;
    const { form: _form, ...where } = read;
    addresses.push({ ...where, city: cityKey(address?.city), zip });
  }

  const asOf = validDate(given.as_of) ? given.as_of : null;
  if (!asOf) problems.push('A sheet needs its date, YYYY-MM-DD');

  const permission = object(given.permission) ? given.permission : {};
  if (!SCOPES.has(permission.scope)) problems.push('Say what the permission covers: facts, or facts and images');
  if (!GRANTORS.has(permission.role)) problems.push('Say who gave permission: the building manager, the building owner, or a resident with the building\'s written permission');
  if (!validDate(permission.granted_at)) problems.push('A permission needs its date, YYYY-MM-DD');

  const plans = [];
  const seenNames = new Set();
  const planOfUnit = new Map();
  let onTwoPlans = 0;
  let badUnits = 0;
  const planList = Array.isArray(given.plans) ? given.plans : [];
  if (!planList.length || planList.length > MAX_PLANS) problems.push(`A sheet lists 1 to ${MAX_PLANS} plans`);
  for (const plan of planList.slice(0, MAX_PLANS)) {
    const name = text(plan?.name, 40);
    const bedrooms = factNumber(plan?.bedrooms, { min: 0, max: 20 });
    const bathrooms = factNumber(plan?.bathrooms, { min: 0, max: 20, whole: false, step: 0.25 });
    const sqFt = factNumber(plan?.sq_ft, { min: 50, max: 50000 });
    if (!name || seenNames.has(name.toUpperCase())) {
      problems.push('Each plan needs its own name');
      continue;
    }
    seenNames.add(name.toUpperCase());
    if (bedrooms === undefined || bathrooms === undefined || sqFt === undefined) {
      problems.push('Bedrooms and bathrooms are numbers up to 20, and size is square feet');
      continue;
    }
    if (bedrooms === null && sqFt === null) {
      problems.push('A plan says at least its bedrooms or its size');
      continue;
    }
    const named = [
      ...(Array.isArray(plan.units) ? plan.units : []),
      ...(Array.isArray(plan.stacks) ? plan.stacks.flatMap((stack) => stackUnits(stack, problems)) : []),
    ];
    const units = [];
    for (const raw2 of named) {
      const entry = unitEntry(raw2);
      if (!entry) {
        badUnits += 1;
        continue;
      }
      const other = planOfUnit.get(entry);
      if (other && other !== name) onTwoPlans += 1;
      else if (!other) {
        planOfUnit.set(entry, name);
        units.push(entry);
      }
    }
    plans.push({ id: name.toUpperCase(), name, bedrooms, bathrooms, sq_ft: sqFt, units });
  }
  if (badUnits) problems.push(`Unit numbers that can't be read: ${badUnits}`);
  // Which is right isn't for us to guess. A sheet that says both goes back to its sender.
  if (onTwoPlans) problems.push(`Units on two plans: ${onTwoPlans}`);
  if (planOfUnit.size > MAX_UNITS) problems.push(`A sheet names up to ${MAX_UNITS} units`);

  const summary = {
    plans: plans.length,
    mapped_plans: plans.filter((plan) => plan.units.length).length,
    unmapped_plans: plans.filter((plan) => !plan.units.length).length,
    mapped_units: planOfUnit.size,
  };
  if (problems.length) return { sheet: null, problems: [...new Set(problems)], summary };
  return {
    sheet: {
      state,
      building: { name: text(given.building?.name, 120), addresses },
      as_of: asOf,
      // Who, by name, stays in the review queue. A release says what's allowed and when it was given.
      permission: { scope: permission.scope, role: permission.role, granted_at: permission.granted_at },
      plans,
    },
    problems: [],
    summary,
  };
}

/** A release for a county, once review says which one it's in. */
function sheetRelease(sheet, fips, release) {
  if (!/^\d{5}$/.test(String(fips)) || stateOfCounty(fips) !== sheet.state) throw new Error('The county code isn\'t in the sheet\'s state');
  const buildingId = registryId(fips, 'building', sheet.building.addresses[0]);
  return { v: FORMAT, id: sheetId(buildingId), release, fips, building_id: buildingId, ...sheet };
}

/** `pp:bldg:53011:abc` as a folder's name. A building has one sheet in force, whatever its releases. */
const sheetId = (buildingId) => buildingId.replace(/^pp:bldg:/, '').replace(/:/g, '-');

/** A sheet as the records identity.js matches, at one street key, with each unit's plan beside it. */
function recordsAt(sheet, key) {
  const records = [];
  for (const address of sheet.building.addresses) {
    if (sortKey(address) !== key) continue;
    const at = { ...address, unit: '', building: '' };
    const roster = [];
    for (const plan of sheet.plans) {
      for (const entry of plan.units) {
        const [building, unit] = entry.includes('|') ? entry.split('|') : ['', entry];
        roster.push(`${building}${unit}`);
        records.push({ kind: 'unit', id: `${sheet.building_id}:${entry}`, parent: sheet.building_id, plan: plan.id, address: { ...at, unit, building } });
      }
    }
    records.push({ kind: 'building', id: sheet.building_id, address: at, roster });
  }
  return records;
}

/** A building's plans by bedrooms, smallest first, with the size range of each. */
function rangesOf(plans) {
  const groups = new Map();
  for (const plan of plans) {
    const key = plan.bedrooms ?? -1;
    const group = groups.get(key) || { bedrooms: plan.bedrooms ?? null, sq_ft_min: null, sq_ft_max: null, plans: 0 };
    group.plans += 1;
    if (plan.sq_ft !== null && plan.sq_ft !== undefined) {
      group.sq_ft_min = group.sq_ft_min === null ? plan.sq_ft : Math.min(group.sq_ft_min, plan.sq_ft);
      group.sq_ft_max = group.sq_ft_max === null ? plan.sq_ft : Math.max(group.sq_ft_max, plan.sq_ft);
    }
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.bedrooms ?? 99) - (b.bedrooms ?? 99));
}

const planKey = (plan) => [plan.id, plan.bedrooms, plan.bathrooms, plan.sq_ft].join('|');

/** The facts an exact match gives a unit, in the record's field names. */
function planFacts(copy) {
  if (copy?.match !== 'exact' || !copy.plan) return {};
  const { bedrooms, bathrooms, sq_ft: livingSqft } = copy.plan;
  return Object.fromEntries(Object.entries({ bedrooms, bathrooms, living_sqft: livingSqft }).filter(([, value]) => value !== null && value !== undefined));
}

const PLAN_TAG = "Building's floor plan";
const PLAN_SOURCE_WORD = 'Floor plan';
const PLAN_PROMPT = 'Is this your layout?';
const BUILDING_NOTE = "These are the building's floor plans, not your unit's.";
const BEDROOM_NAMES = ['Studio', 'One-bedroom', 'Two-bedroom', 'Three-bedroom', 'Four-bedroom', 'Five-bedroom', 'Six-bedroom'];

/** "Oct 2, 2026" from "2026-10-02". */
function dateLabel(iso) {
  const [year, month, day] = String(iso || '').split('-').map(Number);
  return year && month && day ? `${MONTHS[month - 1]} ${day}, ${year}` : null;
}

const sourceLine = (copy) => `From the building's floor-plan sheet, updated ${dateLabel(copy.as_of)}`;
const thousands = (n) => Number(n).toLocaleString('en-US');
const sizeText = (group) => {
  if (group.sq_ft_min === null) return null;
  return group.sq_ft_min === group.sq_ft_max
    ? `${thousands(group.sq_ft_min)} sq ft`
    : `${thousands(group.sq_ft_min)}-${thousands(group.sq_ft_max)} sq ft`;
};
const groupName = (group) => (group.bedrooms === null ? 'Other' : BEDROOM_NAMES[group.bedrooms] || `${group.bedrooms}-bedroom`);
const bathText = (n) => `${n} ${n === 1 ? 'bath' : 'baths'}`;
const bedroomText = (n) => (n === 0 ? 'Studio' : `${n} ${n === 1 ? 'bedroom' : 'bedrooms'}`);

/** "This building has studio plans of 480-540 sq ft and one-bedroom plans of 650-780 sq ft." */
function rangeSentence(ranges) {
  const pieces = ranges.map((group) => {
    const size = sizeText(group);
    return `${groupName(group).toLowerCase()} plans${size ? ` of ${size}` : ''}`;
  });
  if (!pieces.length) return null;
  const list = pieces.length === 1 ? pieces[0] : `${pieces.slice(0, -1).join(', ')} and ${pieces[pieces.length - 1]}`;
  return `This building has ${list}.`;
}

/** "Plan B2 · 1 bedroom · 1 bath · 742 sq ft" */
function planLine(plan) {
  return [
    `Plan ${plan.name}`,
    plan.bedrooms === null ? null : bedroomText(plan.bedrooms),
    plan.bathrooms === null ? null : bathText(plan.bathrooms),
    plan.sq_ft === null ? null : `${thousands(plan.sq_ft)} sq ft`,
  ].filter(Boolean).join(' · ');
}

const row = (id, label, value, mono = false) => ({ id, label, value, mono, tag: PLAN_TAG });

/**
 * A copy as cards in the record's shape. A unit's plan goes in "Your unit"; a building's ranges in "Building",
 * labeled as the building's. A fact a unit's county record already has was taken out before this (usableFloorPlan).
 */
function planSections(copy, hasRecord = false) {
  if (copy.match === 'exact') {
    const { plan } = copy;
    const rows = [
      row('floor_plan', 'Floor plan', plan.name),
      ...(plan.bedrooms !== null ? [row('bedrooms', 'Bedrooms', plan.bedrooms === 0 ? 'Studio' : String(plan.bedrooms), plan.bedrooms !== 0)] : []),
      ...(plan.bathrooms !== null ? [row('bathrooms', 'Bathrooms', String(plan.bathrooms), true)] : []),
      ...(plan.sq_ft !== null ? [row('living_sqft', 'Living area', `${thousands(plan.sq_ft)} sq ft`, true)] : []),
    ];
    return [{ id: 'unit', title: 'Your unit', rows, note: hasRecord ? `${sourceLine(copy)}.` : null }];
  }
  const rows = (copy.ranges || []).map((group) => row(`floor_plans_${group.bedrooms ?? 'other'}`, `${groupName(group)} plans`, sizeText(group) || `${group.plans} ${group.plans === 1 ? 'plan' : 'plans'}`));
  if (!rows.length) return [];
  return [{ id: 'building', title: 'Building', rows, note: hasRecord ? `${BUILDING_NOTE} ${sourceLine(copy)}.` : BUILDING_NOTE }];
}

/** A record's cards with a copy's in them, or a copy's alone when there's no record. The record's own rows aren't changed. */
function withFloorPlan(record, copy) {
  const hasRecord = Boolean(record?.sections?.length);
  const sections = (record?.sections || []).map((section) => ({ ...section, rows: section.rows.map((one) => ({ ...one })) }));
  for (const section of planSections(copy, hasRecord)) {
    const same = sections.find((candidate) => candidate.id === section.id);
    if (same) {
      same.rows.push(...section.rows);
      same.note = [same.note, section.note].filter(Boolean).join(' ') || null;
    } else {
      sections.push(section);
    }
  }
  return { ...(record || {}), sections, footer: record?.footer ?? `${sourceLine(copy)}.`, as_of: record?.as_of ?? copy.as_of };
}

/** Add Home's words for a copy. Only an exact match asks anything, and only it fills a field. */
function addHomePart(copy) {
  if (copy.match === 'exact') {
    return { match: 'exact', line: planLine(copy.plan), source: `${sourceLine(copy)}.`, prompt: PLAN_PROMPT };
  }
  const line = rangeSentence(copy.ranges || []);
  return line ? { match: 'building', line, source: `${BUILDING_NOTE} ${sourceLine(copy)}.`, prompt: null } : null;
}

module.exports = {
  FORMAT,
  FLOOR_PLAN_PREFIX,
  PLAN_TAG,
  PLAN_SOURCE_WORD,
  PLAN_PROMPT,
  statePath,
  sheetPath,
  readSheet,
  sheetRelease,
  sheetId,
  recordsAt,
  rangesOf,
  planKey,
  planFacts,
  planLine,
  rangeSentence,
  withFloorPlan,
  addHomePart,
  dateLabel,
};
