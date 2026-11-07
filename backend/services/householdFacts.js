'use strict';

/**
 * What a household says about its own Home: it confirms a county record's facts,
 * corrects them, and fills in what the record lacks (architecture.md, sections 7 and 9).
 *
 * Entries live in `niche_data.household_facts`, apart from the record's copy
 * (`niche_data.property_record`), so a refresh can't write one, and nothing here ever
 * changes the record. The five facts with Home columns also write the column, which is
 * what the Home's own features read:
 *
 *   { schema: 1, fields: { bedrooms: { value: 4, action: 'corrected', by, at, via,
 *       record: 3, column_before: 3, verified: true, history: [older entries, newest first] } } }
 *
 * `action`: 'corrected' differs from the record; 'entered' the record has nothing;
 * 'confirmed' agrees with the record, and lapses if a newer record changes that value.
 * A correction stays until the household changes it. The last verified writer wins. An
 * unverified writer's entry (Add Home's creator holds pending access) stays theirs alone
 * until they verify.
 *
 * Who may do what follows the Home's permissions: `home.edit` writes, verified household
 * members read, and a renter, guest or restricted member gets nothing new. County figures
 * stay the verified owner's, here as on the record itself.
 */

const { FACTS } = require('./propertyRecords/facts');
const { factValue, factIsMono } = require('../serializers/countyRecordSerializer');
const { changeNicheData } = require('./homeNicheData');

const SCHEMA = 1;
const MAX_HISTORY = 9;
const HOUSEHOLD_TAG = 'From your household';
const UNIT_HOME_TYPES = new Set(['apartment', 'condo', 'studio']);
const SECTION_ORDER = ['unit', 'building', 'construction', 'utilities', 'parking', 'lot', 'records', 'assessment', 'sale'];
const EDIT_GROUPS = ['unit', 'building', 'construction', 'utilities', 'parking', 'lot'];
const GROUP_TITLES = {
  unit: 'Your unit', building: 'Building', construction: 'Construction', utilities: 'Heating, cooling & utilities', parking: 'Parking', lot: 'Lot',
};
// A sale is the recorder's: nothing a household says about it is accepted, and there's nothing to report here either.
const NO_CONTROLS = new Set(['sale']);

const choices = (...labels) => labels.map((label) => ({ label, value: label }));
const yearsOf = { input: 'year', first: 'record', conflict: true };
const area = { input: 'number', unit: 'sq ft', min: 1, max: 10000000 };

/**
 * The facts a household can speak to. `first` says what the page shows on top: the
 * household's value with the record underneath, or the record with the household's
 * beside it (`conflict` also sends the difference to review). Everything else in the
 * record is report-only or, for sales, closed.
 */
const CATALOG = {
  bedrooms: { column: 'bedrooms', input: 'number', max: 99, first: 'household', options: choices('1', '2', '3', '4', '5', '6'), ask: 'Bedrooms?' },
  bathrooms: { column: 'bathrooms', input: 'decimal', max: 99, first: 'household', options: choices('1', '1.5', '2', '2.5', '3', '3.5'), ask: 'Bathrooms?' },
  living_sqft: { column: 'sq_ft', ...area, first: 'household' },
  year_built: { column: 'year_built', ...yearsOf },
  lot_sqft: { column: 'lot_sq_ft', ...area, first: 'record', conflict: true },
  stories: { input: 'decimal', max: 200, first: 'record', conflict: true, options: choices('1', '1.5', '2', '3') },
  effective_year_built: yearsOf,
  full_baths: { input: 'number', max: 99, first: 'household', options: choices('1', '2', '3', '4') },
  half_baths: { input: 'number', max: 99, first: 'household', options: choices('0', '1', '2') },
  rooms: { input: 'number', max: 999, first: 'household' },
  fireplaces: { input: 'number', max: 99, first: 'household', options: choices('0', '1', '2', '3') },
  exterior_walls: { input: 'text', first: 'household', options: choices('Wood siding', 'Vinyl siding', 'Fiber cement', 'Brick', 'Stucco', 'Stone') },
  roof_cover: { input: 'text', first: 'household', options: choices('Composition shingle', 'Metal', 'Tile', 'Wood shake', 'Membrane', 'Slate') },
  roof_shape: { input: 'text', first: 'household', options: choices('Gable', 'Hip', 'Flat', 'Shed') },
  foundation: { input: 'text', first: 'household', options: choices('Slab', 'Crawl space', 'Basement', 'Pier and beam') },
  frame: { input: 'text', first: 'household', options: choices('Wood', 'Steel', 'Masonry', 'Concrete') },
  flooring: { input: 'text', first: 'household', options: choices('Hardwood', 'Carpet', 'Tile', 'Laminate', 'Vinyl', 'Concrete') },
  heating: { input: 'text', first: 'household', options: choices('Forced air', 'Heat pump', 'Baseboard', 'Radiant', 'Wall heater', 'None') },
  heating_fuel: { input: 'text', first: 'household', options: choices('Natural gas', 'Electric', 'Oil', 'Propane', 'Wood') },
  cooling: { input: 'text', first: 'household', options: choices('Central air', 'Heat pump', 'Mini-split', 'Window units', 'None') },
  water_source: { input: 'text', first: 'household', options: choices('Public', 'Well') },
  sewer: { input: 'text', first: 'household', options: choices('Public', 'Septic') },
  garage: { input: 'text', first: 'household', options: choices('Attached', 'Detached', 'Carport', 'None') },
  parking_spaces: { input: 'number', max: 9999, first: 'household', options: choices('0', '1', '2', '3', '4') },
  garage_sqft: { ...area, first: 'household' },
  carport_sqft: { ...area, first: 'household' },
  pool: { input: 'text', first: 'household', options: choices('In-ground', 'Above-ground', 'None') },
};
// Fact → the Home column it writes, for the columns any build can PATCH.
const COLUMN_FACTS = Object.entries(CATALOG).filter(([, def]) => def.column).map(([key, def]) => [key, def.column]);

const failure = (code = 'HOME_FACTS_INVALID', status = 400) => Object.assign(new Error('Check those details and try again.'), { code, statusCode: status });
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);

function storedFields(nicheData) {
  const stored = nicheData?.household_facts;
  return stored?.schema === SCHEMA && object(stored.fields) ? stored.fields : {};
}

/** A person's answer as stored: a number for a number, trimmed text for text. Null when it isn't an answer. */
function parseValue(def, raw) {
  if (def.input === 'text') {
    const text = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    return text && text.length <= 80 ? text : null;
  }
  const digits = String(raw ?? '').trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(digits)) return null;
  const n = Number(digits);
  if (def.input !== 'decimal' && !Number.isInteger(n)) return null;
  if (def.input === 'year') return n >= 1600 && n <= 2100 ? n : null;
  return n >= (def.min ?? 0) && n <= def.max ? n : null;
}

function sameValue(def, a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (def.input === 'text') return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  return Number(a) === Number(b);
}

/** A Home column holds a record's value rounded (bathrooms to one decimal, the rest to whole numbers): the same number, not the household's own. */
function columnAgrees(key, column, value) {
  return Math.abs(Number(column) - Number(value)) <= (key === 'bathrooms' ? 0.05 : 0.5) + 1e-9;
}

/** How a value reads on a screen. A zero is an answer here ("Fireplaces: 0"), where a record's zero means nothing recorded. */
function valueText(key, value) {
  if (value === null || value === undefined) return null;
  if (Number(value) === 0 && CATALOG[key].input !== 'text') return '0';
  if (CATALOG[key].input === 'text') return String(value);
  return factValue(FACTS[key].format, value);
}

const editorText = (value) => (value === null || value === undefined ? '' : String(value));

/** "Nov 6, 2026", in Pacific time: a Home's own time zone isn't stored. */
function dayLabel(at) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' });
}

/** A condo, an apartment or a building-only match: the unit's own facts, never the building's or the land's. */
function isUnitPage(home, copy) {
  if (copy) return copy.subject?.kind === 'unit' || copy.match === 'building_only';
  return UNIT_HOME_TYPES.has(home?.home_type);
}

function groupOf(key, unitPage) {
  const fact = FACTS[key];
  if (!unitPage) return fact.section;
  return fact.scope === 'unit' && fact.section !== 'lot' ? 'unit' : null;
}

function recordFacts(copy) {
  if (!copy) return {};
  const facts = { ...copy.building, ...copy.facts };
  // A record may give the lot in acres only; the Home keeps square feet, as Place reads it.
  if (facts.lot_sqft === undefined && facts.lot_acres) facts.lot_sqft = Math.round(facts.lot_acres * 43560);
  return facts;
}

/** The entry this viewer may rely on: the newest by a verified writer, or their own. */
function entryFor(stored, viewerId, verifiedWriters) {
  if (!object(stored)) return null;
  for (const entry of [stored, ...(Array.isArray(stored.history) ? stored.history : [])]) {
    if (entry.verified !== false || entry.by === viewerId || verifiedWriters.has(entry.by)) return entry;
  }
  return null;
}

/** Who wrote entries that are private until they verify, other than this viewer: the reader checks them. */
function unverifiedWriters(nicheData, viewerId) {
  const writers = new Set();
  for (const stored of Object.values(storedFields(nicheData))) {
    for (const entry of [stored, ...(Array.isArray(stored?.history) ? stored.history : [])]) {
      if (entry?.verified === false && entry.by && entry.by !== viewerId) writers.add(entry.by);
    }
  }
  return [...writers];
}

/** Whether this viewer's Property details has a household part at all: not a renter's, a guest's or a restricted member's. */
function seesHousehold(access) {
  return access.isOwner || access.permissions.includes('home.edit') || ['member', 'manager', 'admin', 'owner'].includes(access.effective_role_base);
}

/** Each fact's standing for this viewer. `own` is the household's value, when it has one apart from the record's. */
function factStates({ home, nicheData, copy, viewerId, verifiedWriters }) {
  const record = recordFacts(copy);
  const stored = storedFields(nicheData);
  const states = {};
  for (const [key, def] of Object.entries(CATALOG)) {
    const entry = entryFor(stored[key], viewerId, verifiedWriters);
    const recordValue = record[key] ?? null;
    const column = def.column ? home[def.column] ?? null : null;
    const confirmed = entry?.action === 'confirmed' && sameValue(def, entry.value, recordValue);
    let own = null;
    if (entry && entry.action !== 'confirmed') own = entry.value;
    // A column that differs from the record is the household's, as on Place (buildProfileFromRecord).
    else if (copy && !confirmed && column !== null && (recordValue === null || !columnAgrees(key, column, recordValue))) own = column;
    states[key] = { key, def, entry, record: recordValue, column, confirmed, own };
  }
  return states;
}

function householdRow(state) {
  return { id: state.key, label: FACTS[state.key].label, value: valueText(state.key, state.own), mono: state.def.input !== 'text' && factIsMono(FACTS[state.key].format) };
}

/** The record's sections with the household's word in place. The record's own rows are copied, never changed in the copy. */
function recordView(countyRecord, states, unitPage) {
  const sections = countyRecord.sections.map((section) => ({ ...section, rows: section.rows.map((row) => ({ ...row })) }));
  const sectionFor = (id) => {
    let section = sections.find((candidate) => candidate.id === id);
    if (!section) {
      section = { id, title: GROUP_TITLES[id], rows: [], note: null };
      sections.push(section);
    }
    return section;
  };
  for (const state of Object.values(states)) {
    if (state.own === null) continue;
    const row = sections.flatMap((section) => section.rows).find((candidate) => candidate.id === state.key);
    const text = valueText(state.key, state.own);
    if (!row) {
      sectionFor(groupOf(state.key, unitPage) || FACTS[state.key].section).rows.push({ ...householdRow(state), tag: HOUSEHOLD_TAG });
    } else if (state.def.first === 'household') {
      row.note = sameValue(state.def, state.own, state.record) ? 'Matches the county record' : `County record: ${row.value}`;
      row.value = text;
      row.tag = HOUSEHOLD_TAG;
    } else if (!sameValue(state.def, state.own, state.record)) {
      row.note = `Your household: ${text}`;
    }
  }
  sections.sort((a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id));
  return { ...countyRecord, sections };
}

function factForEditor(state) {
  const { key, def, own, record, column, entry } = state;
  const shown = def.first === 'record' && record !== null ? record : own ?? record ?? column;
  let note = null;
  if (own !== null && record !== null && !sameValue(def, own, record)) {
    note = def.first === 'household' ? `County record: ${factValue(FACTS[key].format, record)}` : `Your household: ${valueText(key, own)}`;
  }
  const options = [...(def.options || [])];
  // The county's own wording is one of the answers, so going back to it takes a tap.
  if (def.input === 'text' && record !== null && !options.some((option) => sameValue(def, option.value, record))) {
    options.unshift({ label: factValue(FACTS[key].format, record), value: String(record) });
  }
  return {
    key,
    label: FACTS[key].label,
    value: shown === null ? null : valueText(key, shown),
    current: editorText(own ?? record ?? column),
    note,
    input: def.input,
    unit: def.unit || null,
    options,
    can_undo: Boolean(entry && entry.action !== 'confirmed'),
  };
}

function confirmationOf(states) {
  const open = states.filter((state) => state.record !== null && state.own === null);
  if (!open.length) return { prompt: null, confirmed: null };
  if (!open.every((state) => state.confirmed)) return { prompt: 'Is this right?', confirmed: null };
  const latest = open.map((state) => state.entry.at).sort().pop();
  return { prompt: null, confirmed: `Confirmed by your household · ${dayLabel(latest)}` };
}

function reportedLine(reports, sectionId) {
  const mine = (reports || []).filter((report) => report.section === sectionId);
  if (!mine.length) return null;
  return `You reported a problem on ${dayLabel(mine[mine.length - 1].at)}. We're checking it.`;
}

/** The questions and controls for someone who can write. */
function editorParts({ states, sections, unitPage, reports, hasRecord }) {
  const offered = Object.values(states).filter((state) => groupOf(state.key, unitPage));
  const groups = [];
  const leftover = [];
  for (const id of EDIT_GROUPS) {
    const inGroup = offered.filter((state) => groupOf(state.key, unitPage) === id);
    if (!inGroup.length) continue;
    if (sections.some((section) => section.id === id && section.rows.length)) {
      groups.push({
        id, section_id: id, title: GROUP_TITLES[id], ...confirmationOf(inGroup), fix: 'Fix something',
        facts: inGroup.map(factForEditor), report: null, reported: null,
      });
    } else leftover.push(...inGroup);
  }
  for (const section of sections) {
    if (NO_CONTROLS.has(section.id) || groups.some((group) => group.section_id === section.id) || !section.rows.length) continue;
    groups.push({
      id: section.id, section_id: section.id, title: section.title, prompt: null, confirmed: null, fix: null,
      facts: [], report: 'Report a problem', reported: reportedLine(reports, section.id),
    });
  }
  if (leftover.length) {
    groups.push({
      id: 'add', section_id: null, title: 'Add details',
      lead: hasRecord ? "The county's record doesn't list these. Add what you know." : 'Add what you know about your home. You can change it anytime.',
      prompt: null, confirmed: null, fix: 'Add details', facts: leftover.map(factForEditor), report: null, reported: null,
    });
  }
  const questions = offered.filter((state) => state.def.ask && state.record === null && state.own === null && state.column === null)
    .map((state) => ({ key: state.key, prompt: state.def.ask, options: state.def.options, other: 'Other' }));
  return { groups, questions };
}

/** What the household has said, as a card: for a member, and for an owner with no record to set it beside. */
function entriesCard(states) {
  const rows = Object.values(states).filter((state) => state.entry && state.entry.action !== 'confirmed').map((state) => ({
    ...householdRow(state),
    note: dayLabel(state.entry.at) ? `Updated ${dayLabel(state.entry.at)}` : null,
  }));
  return rows.length ? [{ id: 'household', title: HOUSEHOLD_TAG, rows, note: null }] : [];
}

/**
 * The household part of GET /api/homes/:id/property-details, for builds that ask for
 * the new words (services/recordVocabulary.js). `record_view` is the county record with
 * the household's word in place; without the flag the record goes out as it is.
 *
 * @param {object} args
 * @param {object} args.home          The Home's columns.
 * @param {object} args.nicheData     The Home's niche_data.
 * @param {object|null} args.copy     The record's copy, for someone who may see it.
 * @param {object|null} args.countyRecord  That copy's serialized sections; null with no record.
 * @param {boolean} args.canEdit
 * @param {string} args.viewerId
 * @param {Set<string>} args.verifiedWriters  Of `unverifiedWriters`, those verified now.
 * @param {object[]} [args.reports]   This person's open reports about the record.
 * @param {object|null} [args.countyPage]
 * @returns {object|null} Null when there's nothing to say to this viewer.
 */
function project({ home, nicheData, copy, countyRecord, canEdit, viewerId, verifiedWriters, reports = null, countyPage = null }) {
  const unitPage = isUnitPage(home, copy);
  const states = factStates({ home, nicheData, copy, viewerId, verifiedWriters });
  const view = copy && countyRecord ? recordView(countyRecord, states, unitPage) : null;
  const sections = view ? [] : entriesCard(states);
  const shared = { ...(view ? { record_view: view } : {}), sections };
  if (!canEdit) return view || sections.length ? { can_edit: false, ...shared, groups: [], questions: [], county_page: null } : null;
  const { groups, questions } = editorParts({ states, sections: view ? view.sections : [], unitPage, reports, hasRecord: Boolean(view) });
  return { can_edit: true, ...shared, groups, questions, county_page: countyPage };
}

function newEntry({ def, value, action, actorId, via, record, previous, column, verified, at }) {
  const older = previous ? [(({ history: _history, ...entry }) => entry)(previous), ...(previous.history || [])] : [];
  return {
    value, action, by: actorId, at, via, record: record ?? null, verified,
    ...(def.column ? { column_before: column ?? null } : {}),
    history: older.slice(0, MAX_HISTORY),
  };
}

/** A column accepts only what its type does: a record's 1,850.5 sq ft goes in as 1,851. */
function columnValue(def, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return def.input === 'decimal' ? n : Math.round(n);
}

/** Group requests become one request per fact, as this viewer sees them. */
function expand(asked, unitPage, states) {
  const out = [];
  for (const request of asked) {
    if (!request.group) {
      if (!CATALOG[request.key]) throw failure();
      out.push(request);
      continue;
    }
    if (request.action === 'correct' || !EDIT_GROUPS.includes(request.group)) throw failure();
    for (const state of Object.values(states)) {
      if (groupOf(state.key, unitPage) !== request.group) continue;
      if (request.action === 'confirm' && state.record !== null && state.own === null && !state.confirmed) out.push({ key: state.key, action: 'confirm' });
      if (request.action === 'undo' && state.confirmed) out.push({ key: state.key, action: 'undo' });
    }
  }
  return out;
}

/**
 * Prepares `household_facts` from PATCH /api/homes/:id, or the who and when for a
 * column some build changed directly. The caller writes `columns` with the rest of the
 * edit, under its authority check, then calls `commit`.
 *
 * @returns {{ columns: object, commit: () => Promise<void>, changed: string[], conflicts: object[] }}
 */
function plan({ home, copy, seesRecord, asked, fields, actorId, now = new Date().toISOString() }) {
  const nicheData = home.niche_data;
  const shownCopy = seesRecord ? copy : null;
  const unitPage = isUnitPage(home, shownCopy);
  const states = factStates({ home, nicheData, copy: shownCopy, viewerId: actorId, verifiedWriters: new Set() });
  const columns = {};
  const edits = [];
  const conflicts = [];
  const known = recordFacts(copy);
  for (const request of expand(asked || [], unitPage, states)) {
    const { key, action } = request;
    const state = states[key];
    const { def } = state;
    if (action === 'undo') {
      if (!storedFields(nicheData)[key]) continue;
      if (def.column) columns[def.column] = storedFields(nicheData)[key].column_before ?? null;
      edits.push({ key, undo: true });
      continue;
    }
    if (!['confirm', 'correct'].includes(action)) throw failure();
    if (action === 'confirm' && state.record === null) throw failure();
    const value = action === 'confirm' ? state.record : parseValue(def, request.value);
    if (value === null) throw failure();
    const agrees = sameValue(def, value, state.record);
    if (def.column) {
      const next = columnValue(def, value);
      if (next !== null && !sameValue(def, next, state.column)) columns[def.column] = next;
    }
    edits.push({ key, value, action: agrees ? 'confirmed' : state.record !== null ? 'corrected' : 'entered', record: state.record, column: state.column, via: 'details' });
    if (def.conflict && known[key] !== undefined && !sameValue(def, value, known[key])) {
      conflicts.push({ field: key, section: FACTS[key].section, shown: factValue(FACTS[key].format, known[key]), entered: valueText(key, value) });
    }
  }
  if (!asked) {
    // A column some build's edit screen changed directly keeps who and when too.
    for (const [key, column] of COLUMN_FACTS) {
      if (!Object.hasOwn(fields, column)) continue;
      const state = states[key];
      if (sameValue(state.def, fields[column], state.column) || (fields[column] == null && state.column == null)) continue;
      if (fields[column] == null) edits.push({ key, clear: true });
      else edits.push({ key, value: fields[column], action: state.record !== null ? 'corrected' : 'entered', record: state.record, column: state.column, via: 'home_edit' });
    }
  }
  const commit = async () => {
    if (!edits.length) return;
    await changeNicheData(home.id, (stored) => {
      const next = { ...storedFields(stored) };
      for (const edit of edits) {
        const previous = next[edit.key] || null;
        if (edit.clear) {
          delete next[edit.key];
        } else if (edit.undo) {
          if (!previous) continue;
          const [latest, ...rest] = previous.history || [];
          if (latest) next[edit.key] = { ...latest, history: rest };
          else delete next[edit.key];
        } else if (!(previous && previous.action === edit.action && sameValue(CATALOG[edit.key], previous.value, edit.value))) {
          next[edit.key] = newEntry({ def: CATALOG[edit.key], ...edit, actorId, previous, verified: true, at: now });
        }
      }
      return { ...stored, household_facts: { schema: SCHEMA, fields: next } };
    });
  };
  return { columns, commit, changed: edits.map((edit) => edit.key), conflicts };
}

/**
 * Who and when for what Add Home's form sent, kept with the new Home. A value the record
 * already says is the record's, not an entry. Its writer holds pending access at this
 * point, so the entries wait for them to verify.
 *
 * @returns {object|null} The `household_facts` to store; null with nothing to keep.
 */
function fromAddHome({ values, copy, actorId, now = new Date().toISOString() }) {
  const record = recordFacts(copy);
  const fields = {};
  for (const [key, column] of COLUMN_FACTS) {
    const value = values[column];
    if (value === null || value === undefined) continue;
    const def = CATALOG[key];
    if (sameValue(def, value, record[key])) continue;
    const recorded = record[key] ?? null;
    fields[key] = newEntry({
      def, value, action: recorded !== null ? 'corrected' : 'entered', actorId, via: 'add_home', record: recorded, previous: null, column: null, verified: false, at: now,
    });
  }
  return Object.keys(fields).length ? { schema: SCHEMA, fields } : null;
}

/** One-tap answers for Add Home's missing bedrooms and bathrooms, once the lookup has had its say. */
function addHomeQuestions(suggestions, lookup) {
  if (lookup === 'pending') return [];
  return Object.entries(CATALOG).filter(([key, def]) => def.ask && suggestions?.[key] == null)
    .map(([key, def]) => ({ key, prompt: def.ask, options: def.options, other: 'Other' }));
}

/** The record's facts with a verified household's corrections in them, for what's drawn from them (Today's house). */
function factsWithEntries(facts, nicheData) {
  const entries = Object.entries(storedFields(nicheData))
    .filter(([key, entry]) => CATALOG[key] && entry?.verified !== false && entry?.action !== 'confirmed')
    // "None" is an answer: no pool, no garage, whatever the record says.
    .map(([key, entry]) => [key, String(entry.value).toLowerCase() === 'none' ? null : entry.value]);
  return entries.length ? { ...facts, ...Object.fromEntries(entries) } : facts;
}

module.exports = {
  plan, project, fromAddHome, addHomeQuestions, factsWithEntries, seesHousehold, unverifiedWriters, columnAgrees, COLUMN_FACTS,
};
