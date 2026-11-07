#!/usr/bin/env node

/**
 * Backfill script: give active BusinessLocation rows a time zone where they have none.
 *
 * Discover's open state and the apps' business profile read a location's hours in
 * its own time zone. Locations saved before the zone was derived on save have none:
 * Discover shows them no open state, its Open now filter drops them, and the
 * profile reads their hours in the viewer's own zone.
 *
 * Usage:
 *   node backend/scripts/backfill-business-location-timezones.js            dry run, counts only
 *   node backend/scripts/backfill-business-location-timezones.js --apply    write the zones
 *
 *   --geocode  also look up the address of a location without coordinates (Mapbox,
 *              10 requests/sec). Only the zone is saved, never the coordinates.
 *
 * Only a missing zone, or a saved value that isn't a real time zone, is filled; a
 * valid saved zone is never changed. Safe to run more than once. Prints counts and
 * failing row ids, never addresses.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabaseAdmin = require('../config/supabaseAdmin');
const { geocodeAddress } = require('../utils/geocoding');
const parsePostGISPoint = require('../utils/parsePostGISPoint');
const { timezoneFromCoordinates, validTimezone } = require('../utils/timezone');

const APPLY = process.argv.includes('--apply');
const GEOCODE = process.argv.includes('--geocode');
const PAGE_SIZE = 1000;
// Rate limit: 10 Mapbox requests per second
const GEOCODE_DELAY_MS = 100;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function activeLocations() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('BusinessLocation')
      .select('id, location, timezone, address, city, state, zipcode, country')
      .eq('is_active', true)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to query locations: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function backfillTimezones() {
  console.log(`Business location time zone backfill: ${APPLY ? 'writing' : 'dry run'}`
    + `${GEOCODE ? ', looking up addresses without coordinates' : ''}`);

  const locations = await activeLocations();
  const counts = { hadZone: 0, fromCoordinates: 0, fromAddress: 0, noCoordinates: 0, noAnswer: 0, failed: 0 };
  const zones = {};

  for (const loc of locations) {
    if (validTimezone(loc.timezone)) {
      counts.hadZone++;
      continue;
    }

    let coords = parsePostGISPoint(loc.location);
    let source = 'fromCoordinates';
    if (!coords) {
      if (!GEOCODE) {
        counts.noCoordinates++;
        continue;
      }
      await sleep(GEOCODE_DELAY_MS);
      coords = await geocodeAddress(loc.address, loc.city, loc.state, loc.zipcode, loc.country || 'US');
      source = 'fromAddress';
    }

    const zone = coords && timezoneFromCoordinates(coords.latitude, coords.longitude, null);
    if (!zone) {
      counts.noAnswer++;
      continue;
    }

    if (APPLY) {
      // Leaves the row alone if a zone was saved while the script ran.
      const update = supabaseAdmin.from('BusinessLocation').update({ timezone: zone }).eq('id', loc.id);
      const { error } = loc.timezone === null
        ? await update.is('timezone', null)
        : await update.eq('timezone', loc.timezone);
      if (error) {
        console.error(`  [FAIL] ${loc.id}: ${error.message}`);
        counts.failed++;
        continue;
      }
    }
    counts[source]++;
    zones[zone] = (zones[zone] || 0) + 1;
  }

  const verb = APPLY ? 'Filled' : 'Would fill';
  console.log('');
  for (const [label, count] of [
    ['Active locations', locations.length],
    ['  Already had a zone', counts.hadZone],
    [`  ${verb} from coordinates`, counts.fromCoordinates],
    [`  ${verb} from the address`, counts.fromAddress],
    [`  No coordinates${GEOCODE ? '' : ' (add --geocode)'}`, counts.noCoordinates],
    ['  No zone found', counts.noAnswer],
    ['  Write failed', counts.failed],
  ]) {
    console.log(`${`${label}:`.padEnd(36)}${count}`);
  }
  for (const [zone, count] of Object.entries(zones).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${zone}: ${count}`);
  }

  process.exit(counts.failed ? 1 : 0);
}

backfillTimezones().catch((err) => {
  console.error('Backfill script crashed:', err);
  process.exit(1);
});
