'use strict';

/**
 * What a property index release holds and how (reader.js reads it,
 * scripts/property-index/build.cjs writes it). No dependencies, so the build
 * runs without the backend's packages.
 *
 * Everything lives in private storage under one prefix:
 *   states/<ST>.json                      which release each county of a state serves, its previous one, whose it is
 *                                         and how fresh, and which counties a ZIP or city can be in. Replacing this
 *                                         file is what switches readers over, or back.
 *   releases/<fips>/<release>/manifest.json.gz, data.bin    one county's release, never changed once written.
 *   suppressions.json                     addresses taken down at someone's request, as salted hashes.
 *   switches/<name>.json                  which counties an environment serves, and how (router.js).
 *
 * data.bin is the county's records as gzip'd JSON arrays, back to back, sorted by
 * street name and then house number. All the records of one name and number sit in
 * one block, whatever their direction, type or unit, so a lookup reads one small
 * block and sees every candidate: a building's units are never split. The manifest
 * holds each block's first key and its length.
 */

const FORMAT = 1;
// Blocks close at the first new street name and number past this many bytes of JSON.
const BLOCK_RAW_BYTES = 32 * 1024;

/**
 * A record's `kind` says what subject it describes:
 *   property  one home that is one thing: a house, a townhouse on its own lot, a mobile home
 *   unit      one legal unit in a building, a condo; `parent` names its building
 *   building  a building or complex: a rental tower, a condo's common record
 *   parcel    land with no dwelling
 *   other     a record at this address that isn't a home (commercial, public, exempt)
 *
 * Facts are `facts: { field: value }`; `scopes` in the state file's county entry says
 * per kind whose each fact is, so a building's figures never read as a unit's. A
 * restricted record has `restricted: true` and carries no facts at all.
 * A record may also carry `held: { <list>: { field: value } }`: facts a build read or derived that would change what a
 * live county shows, kept off every screen until the switch file names the county on that list (router.js: new_columns,
 * derived_rows, measured_rows). A server that predates them ignores the key. The county's state entry may carry `held_from:
 * { <list>: { field: words } }`, where a list's facts come from somewhere other than the county's own column, in words
 * for Property details ("From the Census Bureau's 2025 city boundaries"). measured_rows (figures measured from public aerial
 * data, scripts/property-index/lib/measure.cjs) also has `held.measured_years: { field: year }`, the year each was measured,
 * which its words take where they say {year}.
 */
const KINDS = new Set(['property', 'unit', 'building', 'parcel', 'other']);

const statePath = (state) => `states/${state}.json`;
const releasePath = (fips, release) => `releases/${fips}/${release}`;
const SUPPRESSIONS_PATH = 'suppressions.json';
const switchesPath = (name) => `switches/${name}.json`;

/** The block that holds this key, by its position in the manifest's first keys; -1 when the key sorts before them all. */
function findBlock(keys, key) {
  let low = 0;
  let high = keys.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (keys[middle] <= key) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

module.exports = { FORMAT, BLOCK_RAW_BYTES, KINDS, SUPPRESSIONS_PATH, statePath, releasePath, switchesPath, findBlock };
