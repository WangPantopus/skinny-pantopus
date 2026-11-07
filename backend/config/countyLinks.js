/**
 * Link and confirm (decision D2, docs/research/provider-replacement/lookup-sites.md): the county's own page for a
 * home, opened in the person's own browser, and "Is this right?" when they come back. Off by default.
 *
 *   LINK_AND_CONFIRM   '1': links come from countyLinks.json (a deep link to the home's own page where the county's site
 *                      takes its parcel number in the address, its property search otherwise), and a household with no
 *                      county record is asked to confirm year built, size, bedrooms and baths (services/householdFacts.js).
 *                      Anything else: config/countyPages.js's links, as before, and nothing new.
 *   COUNTY_LINKS_FILE  Local checks only: a table of the same shape to use instead, so a rig's links can point
 *                      somewhere harmless. Never set on a hosted server.
 *
 * Pantopus never reads these pages: every link is built from a published pattern or a public directory, and
 * countyLinks.json names where each one came from.
 */

const fs = require('fs');

const env = (key) => (process.env[key] || '').trim();

const enabled = () => env('LINK_AND_CONFIRM') === '1';

const table = env('COUNTY_LINKS_FILE') ? JSON.parse(fs.readFileSync(env('COUNTY_LINKS_FILE'), 'utf8')) : require('./countyLinks.json');

module.exports = { enabled, table };
