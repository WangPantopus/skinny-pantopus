/**
 * Building floor-plan sheets: which servers read them, and where (services/propertyRecords/floorPlans.js). Off by default.
 *
 *   FLOOR_PLAN_SHEETS_ENABLED  '1': builds that ask for the new words see a unit's plan and a building's ranges, residents
 *                              can answer "Is this your layout?", and managers can send sheets. Anything else: nothing is
 *                              read, and nothing new is said.
 *   FLOOR_PLAN_SHEETS_URL      The sheets' root, s3://bucket/prefix or file:///dir. Empty: <PROPERTY_RECORDS_MANIFEST_URL>/floor-plans.
 *   FLOOR_PLAN_ORIGINALS_URL   Where an uploaded original is kept, with permission. file:///dir, a local stand-in: hosted private
 *                              storage for originals is a founder's decision still to come. Empty: originals aren't kept.
 *
 * Storage and keys for reading are the property index's (config/propertyRecords.js).
 */

const logger = require('../utils/logger');

const env = (key) => (process.env[key] || '').trim();

const manifestUrl = env('PROPERTY_RECORDS_MANIFEST_URL').replace(/\/+$/, '');
const url = env('FLOOR_PLAN_SHEETS_URL') || (manifestUrl ? `${manifestUrl}/floor-plans` : '');
const originalsUrl = env('FLOOR_PLAN_ORIGINALS_URL');

const enabled = () => env('FLOOR_PLAN_SHEETS_ENABLED') === '1';
/** Where originals go: only a local folder for now. */
const originalsRoot = () => (originalsUrl.startsWith('file:') ? originalsUrl : '');

if (enabled()) logger.info('floor_plans.config', { readable: Boolean(url), keeps_originals: Boolean(originalsRoot()) });

module.exports = { url, enabled, originalsRoot };
