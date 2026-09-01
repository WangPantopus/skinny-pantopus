#!/usr/bin/env node

/**
 * Geocode Provenance Backfill Script
 *
 * Backfills geocode_provider and related provenance columns for all
 * location-storing tables. Optionally re-geocodes rows with untrusted
 * origins (e.g. Nominatim) via Mapbox.
 *
 * Usage:
 *   node backend/scripts/geocode-provenance-backfill.js [--dry-run]
 *
 * Options:
 *   --dry-run    Report what would change without writing to the database.
 *
 * Rate-limited to 10 requests/sec for Mapbox forward geocoding.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabaseAdmin = require('../config/supabaseAdmin');
const geoProvider = require('../services/geo');
const logger = require('../utils/logger');

const DRY_RUN = process.argv.includes('--dry-run');
const RATE_LIMIT_MS = 100; // 10 req/sec

// Distance threshold constants (in meters)
const SHIFT_WARNING_M = 50;
const SHIFT_MANUAL_REVIEW_M = 200;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Haversine distance between two lat/lng pairs, in meters.
 */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Parse a PostGIS POINT string into { lat, lng }.
 * Accepts "POINT(lng lat)" and "SRID=4326;POINT(lng lat)".
 */
function parsePoint(val) {
  if (!val) return null;
  if (typeof val === 'object' && val.coordinates) {
    return { lng: val.coordinates[0], lat: val.coordinates[1] };
  }
  if (typeof val === 'string') {
    const m = val.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
    if (m) return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
  }
  return null;
}

// ──────────────────────────────────────────────
// Report structure
// ──────────────────────────────────────────────
const report = {
  dry_run: DRY_RUN,
  started_at: new Date().toISOString(),
  total: 0,
  tagged_verified: 0,
  tagged_legacy: 0,
  re_geocoded: 0,
  shifted_50m: 0,
  shifted_200m: 0,
  flagged_manual: 0,
  errors: 0,
  by_table: {},
};

function initTable(name) {
  if (!report.by_table[name]) {
    report.by_table[name] = {
      total: 0,
      tagged_verified: 0,
      tagged_legacy: 0,
      re_geocoded: 0,
      shifted_50m: 0,
      shifted_200m: 0,
      flagged_manual: 0,
      errors: 0,
    };
  }
  return report.by_table[name];
}

// ──────────────────────────────────────────────
// Table-specific backfill handlers
// ──────────────────────────────────────────────

/**
 * Home — verified address pipeline.
 * Homes that went through address validation get mode: 'verified'.
 * Homes created before 2026-03-01 (potential Nominatim era) get re-geocoded.
 */
async function backfillHome() {
  const tbl = initTable('Home');
  console.log('\n── Home ──');

  const { data: rows, error } = await supabaseAdmin
    .from('Home')
    .select('id, address, city, state, zipcode, location, created_at')
    .is('geocode_provider', null)
    .not('location', 'is', null);

  if (error) {
    console.error('  Error querying Home:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  for (const row of rows) {
    const createdAt = new Date(row.created_at);
    const isLegacy = createdAt < new Date('2026-03-01T00:00:00Z');
    const coords = parsePoint(row.location);

    if (isLegacy && row.address && coords) {
      // Potentially Nominatim — re-geocode via Mapbox
      await reGeocodeRow('Home', row.id, row.address, row.city, row.state, row.zipcode, coords, tbl, 'home_onboarding');
    } else {
      // Recent row or no address to re-geocode — tag as verified (went through onboarding)
      await tagRow('Home', row.id, { geocode_provider: 'mapbox', geocode_mode: 'verified', geocode_source_flow: 'home_onboarding' }, tbl);
      tbl.tagged_verified++;
      report.tagged_verified++;
    }
  }
}

/**
 * HomeAddress — canonical validated addresses, always verified.
 */
async function backfillHomeAddress() {
  const tbl = initTable('HomeAddress');
  console.log('\n── HomeAddress ──');

  const { data: rows, error } = await supabaseAdmin
    .from('HomeAddress')
    .select('id')
    .is('geocode_provider', null);

  if (error) {
    console.error('  Error querying HomeAddress:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  // HomeAddress is always from a validation pipeline
  for (const row of rows) {
    await tagRow('HomeAddress', row.id, { geocode_provider: 'mapbox', geocode_mode: 'verified', geocode_source_flow: 'home_onboarding' }, tbl);
    tbl.tagged_verified++;
    report.tagged_verified++;
  }
}

/**
 * BusinessLocation — addresses from the business onboarding pipeline.
 * Verified businesses get mode: 'permanent'. Legacy rows get re-geocoded.
 */
async function backfillBusinessLocation() {
  const tbl = initTable('BusinessLocation');
  console.log('\n── BusinessLocation ──');

  const { data: rows, error } = await supabaseAdmin
    .from('BusinessLocation')
    .select('id, address, city, state, zipcode, country, location, created_at, decision_status')
    .is('geocode_provider', null)
    .not('location', 'is', null);

  if (error) {
    console.error('  Error querying BusinessLocation:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  for (const row of rows) {
    const createdAt = new Date(row.created_at);
    const isLegacy = createdAt < new Date('2026-03-01T00:00:00Z');
    const coords = parsePoint(row.location);

    if (isLegacy && row.address && coords) {
      await reGeocodeRow('BusinessLocation', row.id, row.address, row.city, row.state, row.zipcode, coords, tbl, 'business_onboarding');
    } else if (row.decision_status === 'ok') {
      await tagRow('BusinessLocation', row.id, { geocode_provider: 'google_validation', geocode_mode: 'permanent', geocode_source_flow: 'business_onboarding' }, tbl);
      tbl.tagged_verified++;
      report.tagged_verified++;
    } else {
      await tagRow('BusinessLocation', row.id, { geocode_provider: 'mapbox', geocode_mode: 'permanent', geocode_source_flow: 'business_onboarding' }, tbl);
      tbl.tagged_verified++;
      report.tagged_verified++;
    }
  }
}

/**
 * BusinessAddress — canonical validated addresses.
 */
async function backfillBusinessAddress() {
  const tbl = initTable('BusinessAddress');
  console.log('\n── BusinessAddress ──');

  const { data: rows, error } = await supabaseAdmin
    .from('BusinessAddress')
    .select('id, validation_provider')
    .is('geocode_provider', null);

  if (error) {
    console.error('  Error querying BusinessAddress:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  for (const row of rows) {
    await tagRow('BusinessAddress', row.id, {
      geocode_provider: row.validation_provider || 'unknown',
      geocode_mode: 'verified',
      geocode_source_flow: 'business_address_validation',
    }, tbl);
    tbl.tagged_verified++;
    report.tagged_verified++;
  }
}

/**
 * SeededBusiness — bulk-loaded business directory.
 */
async function backfillSeededBusiness() {
  const tbl = initTable('SeededBusiness');
  console.log('\n── SeededBusiness ──');

  const { data: rows, error } = await supabaseAdmin
    .from('SeededBusiness')
    .select('id, source')
    .is('geocode_provider', null);

  if (error) {
    console.error('  Error querying SeededBusiness:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  for (const row of rows) {
    await tagRow('SeededBusiness', row.id, {
      geocode_provider: row.source || 'manual',
      geocode_mode: 'permanent',
      geocode_accuracy: 'address',
      geocode_source_flow: 'backfill',
    }, tbl);
    tbl.tagged_legacy++;
    report.tagged_legacy++;
  }
}

/**
 * Gig — task locations. Re-geocode legacy rows; tag recent as mapbox/temporary.
 */
async function backfillGig() {
  const tbl = initTable('Gig');
  console.log('\n── Gig ──');

  const { data: rows, error } = await supabaseAdmin
    .from('Gig')
    .select('id, exact_address, exact_city, exact_state, exact_zip, exact_location, created_at')
    .is('geocode_provider', null)
    .not('exact_location', 'is', null);

  if (error) {
    console.error('  Error querying Gig:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  for (const row of rows) {
    const createdAt = new Date(row.created_at);
    const isLegacy = createdAt < new Date('2026-03-01T00:00:00Z');
    const coords = parsePoint(row.exact_location);

    if (isLegacy && row.exact_address && coords) {
      await reGeocodeRow('Gig', row.id, row.exact_address, row.exact_city, row.exact_state, row.exact_zip, coords, tbl, 'gig_create');
    } else {
      await tagRow('Gig', row.id, { geocode_provider: 'mapbox', geocode_mode: 'temporary', geocode_source_flow: 'gig_create' }, tbl);
      tbl.tagged_legacy++;
      report.tagged_legacy++;
    }
  }
}

/**
 * GigPrivateLocation — exact locations revealed to assignees.
 */
async function backfillGigPrivateLocation() {
  const tbl = initTable('GigPrivateLocation');
  console.log('\n── GigPrivateLocation ──');

  const { data: rows, error } = await supabaseAdmin
    .from('GigPrivateLocation')
    .select('gig_id')
    .is('geocode_provider', null)
    .not('exact_location', 'is', null);

  if (error) {
    console.error('  Error querying GigPrivateLocation:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  for (const row of rows) {
    // GigPrivateLocation doesn't have its own id column — keyed on gig_id
    await tagRowByKey('GigPrivateLocation', 'gig_id', row.gig_id, {
      geocode_provider: 'mapbox',
      geocode_mode: 'temporary',
      geocode_source_flow: 'gig_create',
    }, tbl);
    tbl.tagged_legacy++;
    report.tagged_legacy++;
  }
}

/**
 * Listing — marketplace items. Re-geocode legacy; tag recent.
 */
async function backfillListing() {
  const tbl = initTable('Listing');
  console.log('\n── Listing ──');

  const { data: rows, error } = await supabaseAdmin
    .from('Listing')
    .select('id, location_name, location_address, latitude, longitude, created_at')
    .is('geocode_provider', null)
    .not('latitude', 'is', null);

  if (error) {
    console.error('  Error querying Listing:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  for (const row of rows) {
    const createdAt = new Date(row.created_at);
    const isLegacy = createdAt < new Date('2026-03-01T00:00:00Z');

    if (isLegacy && (row.location_address || row.location_name)) {
      const coords = { lat: row.latitude, lng: row.longitude };
      const address = row.location_address || row.location_name;
      await reGeocodeRow('Listing', row.id, address, null, null, null, coords, tbl, 'listing_create');
    } else {
      await tagRow('Listing', row.id, { geocode_provider: 'mapbox', geocode_mode: 'temporary', geocode_source_flow: 'listing_create' }, tbl);
      tbl.tagged_legacy++;
      report.tagged_legacy++;
    }
  }
}

/**
 * Post — feed posts. Re-geocode legacy; tag recent.
 */
async function backfillPost() {
  const tbl = initTable('Post');
  console.log('\n── Post ──');

  const { data: rows, error } = await supabaseAdmin
    .from('Post')
    .select('id, location_name, location_address, latitude, longitude, created_at')
    .is('geocode_provider', null)
    .not('latitude', 'is', null);

  if (error) {
    console.error('  Error querying Post:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  for (const row of rows) {
    const createdAt = new Date(row.created_at);
    const isLegacy = createdAt < new Date('2026-03-01T00:00:00Z');

    if (isLegacy && (row.location_address || row.location_name)) {
      const coords = { lat: row.latitude, lng: row.longitude };
      const address = row.location_address || row.location_name;
      await reGeocodeRow('Post', row.id, address, null, null, null, coords, tbl, 'post_create');
    } else {
      await tagRow('Post', row.id, { geocode_provider: 'mapbox', geocode_mode: 'temporary', geocode_source_flow: 'post_create' }, tbl);
      tbl.tagged_legacy++;
      report.tagged_legacy++;
    }
  }
}

/**
 * UserPlace — user's saved places (work, gym, etc.).
 */
async function backfillUserPlace() {
  const tbl = initTable('UserPlace');
  console.log('\n── UserPlace ──');

  const { data: rows, error } = await supabaseAdmin
    .from('UserPlace')
    .select('id')
    .is('geocode_provider', null)
    .not('location', 'is', null);

  if (error) {
    console.error('  Error querying UserPlace:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  for (const row of rows) {
    await tagRow('UserPlace', row.id, { geocode_provider: 'unknown', geocode_mode: 'legacy', geocode_source_flow: 'backfill' }, tbl);
    tbl.tagged_legacy++;
    report.tagged_legacy++;
  }
}

/**
 * SavedPlace — cached search results.
 */
async function backfillSavedPlace() {
  const tbl = initTable('SavedPlace');
  console.log('\n── SavedPlace ──');

  const { data: rows, error } = await supabaseAdmin
    .from('SavedPlace')
    .select('id')
    .is('geocode_provider', null);

  if (error) {
    console.error('  Error querying SavedPlace:', error.message);
    tbl.errors++;
    report.errors++;
    return;
  }
  if (!rows?.length) { console.log('  No rows to backfill.'); return; }

  console.log(`  Found ${rows.length} rows with NULL provenance.`);
  tbl.total = rows.length;
  report.total += rows.length;

  for (const row of rows) {
    await tagRow('SavedPlace', row.id, { geocode_provider: 'unknown', geocode_mode: 'legacy', geocode_source_flow: 'backfill' }, tbl);
    tbl.tagged_legacy++;
    report.tagged_legacy++;
  }
}

// ──────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────

/**
 * Tag a row with provenance metadata (no re-geocoding).
 */
async function tagRow(table, id, fields, tbl) {
  const update = {
    ...fields,
    geocode_created_at: new Date().toISOString(),
  };

  if (DRY_RUN) {
    console.log(`  [DRY] ${table} ${id}: would set ${JSON.stringify(fields)}`);
    return;
  }

  const { error } = await supabaseAdmin
    .from(table)
    .update(update)
    .eq('id', id);

  if (error) {
    console.error(`  [ERR] ${table} ${id}: ${error.message}`);
    tbl.errors++;
    report.errors++;
  }
}

/**
 * Tag a row using a non-id primary key column.
 */
async function tagRowByKey(table, keyCol, keyVal, fields, tbl) {
  const update = {
    ...fields,
    geocode_created_at: new Date().toISOString(),
  };

  if (DRY_RUN) {
    console.log(`  [DRY] ${table} ${keyCol}=${keyVal}: would set ${JSON.stringify(fields)}`);
    return;
  }

  const { error } = await supabaseAdmin
    .from(table)
    .update(update)
    .eq(keyCol, keyVal);

  if (error) {
    console.error(`  [ERR] ${table} ${keyCol}=${keyVal}: ${error.message}`);
    tbl.errors++;
    report.errors++;
  }
}

/**
 * Re-geocode a row via Mapbox and compare coordinate shift.
 * If shift > 200m, flag for manual review (don't auto-update coordinates).
 * If shift > 50m, log a warning but still update.
 */
async function reGeocodeRow(table, id, address, city, state, zip, oldCoords, tbl, sourceFlow, existingMode) {
  // Never overwrite coordinates on rows that are already verified
  if (existingMode === 'verified') {
    console.log(`  [SKIP] ${table} ${id}: already verified — skipping re-geocode`);
    tbl.tagged_verified++;
    report.tagged_verified++;
    return;
  }

  await sleep(RATE_LIMIT_MS);

  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');

  try {
    const result = await geoProvider.forwardGeocode(fullAddress, { mode: 'permanent' });

    if (!result || result.latitude == null || result.longitude == null) {
      // Geocoding returned no result — tag as unknown/legacy
      console.log(`  [MISS] ${table} ${id}: no geocode result for "${fullAddress}"`);
      await tagRow(table, id, { geocode_provider: 'unknown', geocode_mode: 'legacy', geocode_source_flow: 'backfill' }, tbl);
      tbl.tagged_legacy++;
      report.tagged_legacy++;
      return;
    }

    const shiftM = haversineMeters(oldCoords.lat, oldCoords.lng, result.latitude, result.longitude);

    if (shiftM > SHIFT_MANUAL_REVIEW_M) {
      // Flag for manual review — don't update coordinates
      console.log(`  [FLAG] ${table} ${id}: shift ${Math.round(shiftM)}m > 200m — needs manual review`);
      await tagRow(table, id, {
        geocode_provider: 'nominatim_suspect',
        geocode_mode: 'legacy',
        geocode_accuracy: `flagged:shift_${Math.round(shiftM)}m`,
        geocode_source_flow: 'backfill',
      }, tbl);
      tbl.flagged_manual++;
      report.flagged_manual++;
      tbl.shifted_200m++;
      report.shifted_200m++;
      return;
    }

    if (shiftM > SHIFT_WARNING_M) {
      console.log(`  [WARN] ${table} ${id}: shift ${Math.round(shiftM)}m > 50m — updating anyway`);
      tbl.shifted_50m++;
      report.shifted_50m++;
    }

    // Update coordinates and provenance
    const update = {
      geocode_provider: 'mapbox',
      geocode_mode: 'permanent',
      geocode_accuracy: 'address',
      geocode_place_id: result.place_id || null,
      geocode_source_flow: sourceFlow,
      geocode_created_at: new Date().toISOString(),
    };

    // Add coordinate update based on table column format
    if (table === 'Gig') {
      update.exact_location = `POINT(${result.longitude} ${result.latitude})`;
      // Recalculate approx
      const approxLat = Math.round(result.latitude * 10) / 10;
      const approxLng = Math.round(result.longitude * 10) / 10;
      update.approx_location = `POINT(${approxLng} ${approxLat})`;
    } else if (table === 'Home' || table === 'BusinessLocation') {
      update.location = `POINT(${result.longitude} ${result.latitude})`;
    } else if (table === 'Listing' || table === 'Post') {
      update.latitude = result.latitude;
      update.longitude = result.longitude;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${table} ${id}: would re-geocode (shift ${Math.round(shiftM)}m), provider=mapbox`);
    } else {
      const { error } = await supabaseAdmin.from(table).update(update).eq('id', id);
      if (error) {
        console.error(`  [ERR] ${table} ${id}: ${error.message}`);
        tbl.errors++;
        report.errors++;
        return;
      }
      console.log(`  [OK]  ${table} ${id}: re-geocoded (shift ${Math.round(shiftM)}m)`);
    }

    tbl.re_geocoded++;
    report.re_geocoded++;
  } catch (err) {
    console.error(`  [ERR] ${table} ${id}: geocode failed — ${err.message}`);
    // Tag as unknown so it's not retried until manually investigated
    await tagRow(table, id, { geocode_provider: 'unknown', geocode_mode: 'legacy', geocode_source_flow: 'backfill' }, tbl);
    tbl.errors++;
    report.errors++;
  }
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  Geocode Provenance Backfill                 ║`);
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (writing to DB)'}             ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);

  await backfillHome();
  await backfillHomeAddress();
  await backfillBusinessLocation();
  await backfillBusinessAddress();
  await backfillSeededBusiness();
  await backfillGig();
  await backfillGigPrivateLocation();
  await backfillListing();
  await backfillPost();
  await backfillUserPlace();
  await backfillSavedPlace();

  report.finished_at = new Date().toISOString();

  // Print summary
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  BACKFILL REPORT                             ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Mode:             ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Total rows:       ${report.total}`);
  console.log(`  Tagged verified:  ${report.tagged_verified}`);
  console.log(`  Tagged legacy:    ${report.tagged_legacy}`);
  console.log(`  Re-geocoded:      ${report.re_geocoded}`);
  console.log(`  Shifted >50m:     ${report.shifted_50m}`);
  console.log(`  Shifted >200m:    ${report.shifted_200m}`);
  console.log(`  Flagged manual:   ${report.flagged_manual}`);
  console.log(`  Errors:           ${report.errors}`);
  console.log('');

  for (const [table, stats] of Object.entries(report.by_table)) {
    if (stats.total === 0) continue;
    console.log(`  ${table}:`);
    console.log(`    total=${stats.total} verified=${stats.tagged_verified} legacy=${stats.tagged_legacy} re-geocoded=${stats.re_geocoded} flagged=${stats.flagged_manual} errors=${stats.errors}`);
  }

  // Write JSON report to stdout (pipe to file if needed)
  const reportPath = require('path').resolve(__dirname, '../../reports');
  const fs = require('fs');
  if (!fs.existsSync(reportPath)) fs.mkdirSync(reportPath, { recursive: true });
  const reportFile = require('path').join(reportPath, `geocode-backfill-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n  Report written to: ${reportFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script crashed:', err);
    process.exit(1);
  });
