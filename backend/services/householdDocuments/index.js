'use strict';

/**
 * Facts from a household's own documents (WP25; docs/research/provider-replacement/full-page-plan.md 5.7 and 7, decision
 * P6). A verified member who can edit the home sends a PDF of its inspection report, appraisal or listing sheet. This
 * server reads the PDF's text in memory (pdfText.js), finds the facts it states by rules (readFacts.js), and answers
 * with them beside what the page shows now. Nothing is kept: not the file, not its text, not the suggestions. The
 * household then sends back the facts it confirmed or fixed, and those alone are saved where the household's word
 * already lives: Property details facts as household entries (householdFacts.js, `via` 'document:<kind>'), and the
 * years of the roof, heating, water heater and panel in Place's Home systems (HomeSystem, source 'resident',
 * source_ref 'document:<kind>'). Off unless config/householdDocuments.js is on.
 *
 * Privacy: the file never leaves this server and nothing read from it reaches a log; errors log a code only.
 */

const db = require('../../config/supabaseAdmin');
const config = require('../../config/householdDocuments');
const authority = require('../homeDashboardService');
const householdFacts = require('../householdFacts');
const homeRecords = require('../propertyRecords/homeRecord');
const { getSystemsLedger, recordSystem } = require('../homeSystemsService');
const { pdfPages } = require('./pdfText');
const { readFacts, KINDS, SYSTEMS } = require('./readFacts');
const logger = require('../../utils/logger');

const MESSAGES = {
  HOME_DOCUMENTS_OFF: [404, 'Not found.'],
  HOME_DOCUMENTS_DENIED: [403, 'Only a verified owner or member who can edit this home can add facts from a document.'],
  HOME_DOCUMENTS_INVALID: [400, 'Check those details and try again.'],
  HOME_DOCUMENTS_UNAVAILABLE: [503, "Couldn't save that. Please try again."],
  NO_FILE: [400, 'Choose a PDF of your report.'],
  NOT_PDF: [415, "That isn't a PDF. Photos and scanned pages can't be read yet: you can type what the report says in Add details."],
  PDF_TOO_LARGE: [413, 'That file is over 15 MB.'],
  PDF_LOCKED: [422, 'This PDF has a password. Save a copy without the password and try again.'],
  PDF_TOO_LONG: [422, 'That PDF has more than 150 pages.'],
  PDF_NO_TEXT: [422, 'This looks like a scan or photos of the pages. For now we can only read PDFs made on a computer: you can type what the report says in Add details.'],
  PDF_UNREADABLE: [422, "We couldn't open that PDF. Try saving it again from the program it came from."],
  PDF_TIMEOUT: [422, "We couldn't open that PDF. Try saving it again from the program it came from."],
};

const failure = (code) => {
  const [statusCode, message] = MESSAGES[code] || MESSAGES.HOME_DOCUMENTS_UNAVAILABLE;
  return Object.assign(new Error(message), { code: MESSAGES[code] ? code : 'HOME_DOCUMENTS_UNAVAILABLE', statusCode });
};

// The facts the check screen lists, in this order: the systems' years, the household's own rows, then the page's rows.
const FACT_ORDER = [
  'water_heater', 'electrical_service', 'electrical_panel', 'plumbing',
  'year_built', 'living_sqft', 'bedrooms', 'bathrooms', 'full_baths', 'half_baths', 'rooms', 'stories', 'lot_sqft',
  'roof_cover', 'exterior_walls', 'foundation', 'heating', 'heating_fuel', 'cooling', 'water_source', 'sewer',
  'garage', 'parking_spaces', 'fireplaces', 'pool',
];
const SYSTEM_PREFIX = 'system:';
const HOME_COLUMNS = [...new Set(['id', 'address', 'address2', 'city', 'state', 'zipcode', 'home_type', 'year_built', 'niche_data', ...householdFacts.COLUMN_FACTS.map(([, column]) => column)])];

/** Verified members who can edit the home: its verified owner, or a verified member with edit rights. */
function mayUse(access) {
  if (!access?.permissions?.includes('home.edit')) return false;
  return Boolean(access.isOwner || access.occupancy?.verification_status === 'verified');
}

/** The card on Property details, for someone who may use it; null otherwise. */
function offer(access) {
  if (!config.enabled() || !mayUse(access)) return null;
  return {
    title: 'From your papers',
    lead: "Have a home inspection, appraisal or listing sheet for this home? We'll read it for the roof, furnace, water heater, panel and plumbing, and check bedrooms, baths and size. You check each one. We don't keep the file.",
    action: 'Add from a document',
  };
}

/** The years a household (or a permit, or a job) gave for the home's systems, for Property details. Null when off. */
async function systemsFor(homeId) {
  if (!config.enabled()) return null;
  const { data, error } = await db.from('HomeSystem').select('system_key, installed_year, source, source_ref, updated_at').eq('home_id', homeId).neq('source', 'estimated');
  if (error) throw new Error(error.message);
  return data || [];
}

async function readHome(homeId) {
  const { data, error } = await db.from('Home').select(HOME_COLUMNS.join(', ')).eq('id', homeId).maybeSingle();
  if (error || !data) throw failure('HOME_DOCUMENTS_UNAVAILABLE');
  return data;
}

const dayText = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
const sourceLine = (found) => (found.quote ? `Page ${found.page}: “${found.quote}”` : `Page ${found.page}`);

function systemProposal(key, found, ledger) {
  const now = ledger?.systems?.find((system) => system.key === key);
  let note = null;
  if (now?.installed_year) {
    if (now.source === 'estimated') note = `Estimated from the year built: ${now.installed_year}`;
    else note = now.installed_year === found.value ? 'Matches what your page shows' : `Your page shows ${now.installed_year}`;
  }
  return {
    key: `${SYSTEM_PREFIX}${key}`, label: SYSTEMS[key].label, value: found.age ? `About ${found.value}` : String(found.value),
    current: String(found.value), note, input: 'year', unit: null, options: [], can_undo: false,
    source: found.age ? `${sourceLine(found)} · ${found.age} years old when the report was written` : sourceLine(found),
  };
}

/**
 * POST /api/homes/:id/document-facts/read. The report is read and dropped; the answer is the facts it states.
 *
 * @returns {Promise<object>} { kind, title, subtitle, lead, facts, missing, message }
 */
async function read({ homeId, actorId, bytes }) {
  if (!config.enabled()) throw failure('HOME_DOCUMENTS_OFF');
  if (!bytes?.length) throw failure('NO_FILE');
  return authority.withCurrentAccess({ homeId, actorId, permission: 'home.edit' }, async (access) => {
    if (!mayUse(access)) throw failure('HOME_DOCUMENTS_DENIED');
    const home = await readHome(homeId);
    let pages;
    try {
      pages = await pdfPages(bytes);
    } catch (error) {
      logger.info('Home document not read', { homeId, reason: error.code });
      throw failure(MESSAGES[error.code] ? error.code : 'PDF_UNREADABLE');
    }
    const found = readFacts(pages, { address: home.address });
    const kind = KINDS[found.kind];
    const subtitle = [found.date ? `Dated ${dayText(found.date)}` : null, `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`].filter(Boolean).join(' · ');
    const answer = {
      kind: found.kind, title: kind.title, subtitle,
      lead: "Tap Right for each fact that's correct, or fix it. Only what you keep is saved, and the file isn't kept.",
      facts: [], missing: null, message: null,
    };
    if (!found.namesAddress) {
      answer.message = `This ${kind.title.toLowerCase()} doesn't name ${home.address}, so we didn't use it.`;
      return answer;
    }
    const ledger = Object.keys(found.systems).length ? await getSystemsLedger(home) : null;
    for (const key of Object.keys(SYSTEMS)) {
      if (found.systems[key]) answer.facts.push(systemProposal(key, found.systems[key], ledger));
    }
    const states = householdFacts.statesFor({ home, copy: access.isOwner ? homeRecords.liveCopy(home) : null, viewerId: actorId });
    for (const key of FACT_ORDER) {
      const fact = found.facts[key];
      const proposal = fact && householdFacts.proposalFor(states, key, fact.value);
      if (proposal) answer.facts.push({ ...proposal, source: sourceLine(fact) });
    }
    if (found.missing.length) answer.missing = `Not in this report: ${found.missing.join(', ')}`;
    if (!answer.facts.length) answer.message = `We didn't find facts we can read in this ${kind.title.toLowerCase()}. You can type what it says in Add details.`;
    return answer;
  });
}

/**
 * POST /api/homes/:id/document-facts: what the household kept. Checks the switch and who's asking, then splits the
 * facts: Property details facts become `household_facts` requests for the usual write (routes/home.js), and system
 * years are saved here.
 *
 * @param {{ homeId: string, actorId: string, kind: string, facts: Array<{key: string, value: string}> }} args
 * @returns {Promise<{ asked: object[], systems: Array<{key: string, year: number}> }>}
 */
async function prepare({ homeId, actorId, kind, facts }) {
  if (!config.enabled()) throw failure('HOME_DOCUMENTS_OFF');
  if (!KINDS[kind]) throw failure('HOME_DOCUMENTS_INVALID');
  await authority.withCurrentAccess({ homeId, actorId, permission: 'home.edit' }, async (access) => {
    if (!mayUse(access)) throw failure('HOME_DOCUMENTS_DENIED');
  });
  const asked = [];
  const systems = [];
  const seen = new Set();
  for (const fact of facts) {
    if (seen.has(fact.key)) throw failure('HOME_DOCUMENTS_INVALID');
    seen.add(fact.key);
    if (fact.key.startsWith(SYSTEM_PREFIX)) {
      const key = fact.key.slice(SYSTEM_PREFIX.length);
      const year = Number(String(fact.value).trim());
      if (!SYSTEMS[key] || !Number.isInteger(year) || year < 1800 || year > new Date().getUTCFullYear()) throw failure('HOME_DOCUMENTS_INVALID');
      systems.push({ key, year });
    } else {
      if (!FACT_ORDER.includes(fact.key)) throw failure('HOME_DOCUMENTS_INVALID');
      asked.push({ key: fact.key, action: 'correct', value: fact.value, via: `document:${kind}` });
    }
  }
  return { asked, systems };
}

/** The systems' years the household kept, in Place's Home systems: the household's word, from this report. */
async function saveSystems({ homeId, actorId, kind, systems }) {
  for (const { key, year } of systems) {
    const result = await recordSystem({ homeId, systemKey: key, installedYear: year, source: 'resident', sourceRef: `document:${kind}`, userId: actorId });
    if (!result.ok) throw failure(result.reason === 'invalid_year' ? 'HOME_DOCUMENTS_INVALID' : 'HOME_DOCUMENTS_UNAVAILABLE');
  }
}

function savedMessage(kind, count) {
  return `Saved ${count} ${count === 1 ? 'fact' : 'facts'} from ${KINDS[kind].source}.`;
}

function sendError(res, error, fallback) {
  if (MESSAGES[error?.code]) return res.status(error.statusCode).json({ error: error.message, code: error.code });
  return fallback(res, error);
}

module.exports = { enabled: config.enabled, mayUse, offer, systemsFor, read, prepare, saveSystems, savedMessage, sendError, failure };
