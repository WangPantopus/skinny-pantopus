'use strict';

/**
 * A building's own floor-plan sheet, for its residents (unit-facts.md, "Floor-plan
 * sheets"). County records usually stop at a tower's front door; a sheet from its
 * manager says which units have which plan, so one sheet fills every unit it names.
 *
 *   lookup(address)     what a sheet says about an address, per the identity contract
 *   forAddress(address) that, for Add Home, or null without holding up the screen
 *   forHome(home)       the Home's copy (`niche_data.floor_plan`), up to date with the sheet's release
 *
 * A unit's plan goes out only on an exact match. Everything else with a sheet is a
 * building-only answer: the building's plan ranges, labeled as the building's, never in a
 * unit's fields. Several sheets or records in one place answer nothing. Off behind
 * FLOOR_PLAN_SHEETS_ENABLED, where nothing is read at all.
 *
 * Addresses, unit numbers and Home IDs never go in the log.
 */

const zlib = require('zlib');
const config = require('../../config/floorPlanSheets');
const logger = require('../../utils/logger');
const { changeNicheData } = require('../homeNicheData');
const { createReader, createStorage, StorageUnavailable } = require('./reader');
const { stateCode } = require('./addressKey');
const format = require('./floorPlanFormat');
const { answerFor, addressStamp, SCHEMA } = require('./floorPlanLookup');

// How long a lookup may hold up a screen, as the address registry's. A first read that takes longer finishes in the background.
const LOOKUP_DEADLINE_MS = 800;
// A state's file and the sheets people are asking about. A big tower's sheet is a few KB.
const KEPT_FILES = 256;

let shared = null;
function reader() {
  if (!shared) shared = createReader(config.url ? createStorage(config.url) : null, { keptFiles: KEPT_FILES });
  return shared;
}

const parseJson = (bytes) => JSON.parse(bytes.toString('utf8'));
const gunzipJson = (bytes) => JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));
const stateFile = (state) => reader().file(format.statePath(state), parseJson);
const sheetFile = (id, release) => reader().file(format.sheetPath(id, release), gunzipJson);

const homeAddress = (home) => ({ line1: home.address, unit: home.address2, city: home.city, state: home.state, zip: home.zipcode });

/** What a sheet says about this address: a copy to keep, or null when no sheet speaks for it. */
function lookup(address) {
  return answerFor(address, { stateFile, sheetFile, suppressions: () => reader().suppressions() });
}

const TOO_LONG = Symbol('too long');

/** A read that doesn't hold up a screen. TOO_LONG when storage can't say just now; a first read that takes longer finishes in the background. */
async function quickly(read) {
  let timer;
  try {
    return await Promise.race([
      read(),
      new Promise((resolve) => { timer = setTimeout(() => resolve(TOO_LONG), LOOKUP_DEADLINE_MS); }),
    ]);
  } catch (err) {
    if (!(err instanceof StorageUnavailable)) logger.warn('floor_plans.read_failed', { error: err.name });
    return TOO_LONG;
  } finally {
    clearTimeout(timer);
  }
}

/** Add Home: what a sheet says about an address with no Home yet. Null when the sheets are off, have nothing, or can't be read just now. */
async function forAddress(address) {
  if (!config.enabled()) return null;
  const copy = await quickly(() => lookup(address));
  return copy === TOO_LONG ? null : copy;
}

/** The copy a Home holds for its current address, with no reading. Null when the sheets are off. */
function storedCopy(home) {
  if (!config.enabled()) return null;
  const copy = home?.niche_data?.floor_plan;
  if (!copy || copy.schema !== SCHEMA) return null;
  return copy.address_stamp === addressStamp(homeAddress(home)) ? copy : null;
}

// Only this key changes, on the row as it stands now, so an entry made meanwhile stays.
async function storeCopy(home, copy) {
  if (!home?.id || home.niche_data === undefined) return;
  try {
    const nicheData = await changeNicheData(home.id, (stored) => {
      if (copy) stored.floor_plan = copy;
      else delete stored.floor_plan;
      return stored;
    });
    if (nicheData) home.niche_data = nicheData;
  } catch (err) {
    logger.warn('floor_plans.store_failed', { error: err.message });
  }
}

/**
 * What a sheet says about a Home, for a screen, with the state's file (in memory, re-read every few minutes) deciding
 * whether its copy still stands. A new release's answer replaces the copy, and a withdrawn sheet's facts go. If storage
 * can't say, the copy stands; it can't lose a Home's plan to an outage.
 *
 * @param {object} home  A Home row with its address fields and `niche_data`
 * @returns {Promise<object|null>}
 */
async function forHome(home) {
  if (!config.enabled() || !home) return null;
  const stored = storedCopy(home);
  if (stored) {
    const file = await quickly(() => stateFile(stateCode(home.state)));
    if (file === TOO_LONG || !file) return stored;
    const entry = file.sheets?.[stored.sheet];
    if (entry?.status === 'active' && entry.release === stored.release) return stored;
  }
  const copy = await quickly(() => lookup(homeAddress(home)));
  if (copy === TOO_LONG) return stored;
  if (copy || stored) await storeCopy(home, copy);
  return copy;
}

module.exports = { lookup, forAddress, forHome, storedCopy, enabled: config.enabled };
