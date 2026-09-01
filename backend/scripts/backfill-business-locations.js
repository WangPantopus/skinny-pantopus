#!/usr/bin/env node

/**
 * Backfill script: geocode all BusinessLocation rows with NULL location column.
 *
 * Usage: node backend/scripts/backfill-business-locations.js
 *
 * Rate-limited to 10 requests/sec for Mapbox API.
 * Safe to run multiple times — only processes rows where location IS NULL.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabaseAdmin = require('../config/supabaseAdmin');
const { geocodeAddress } = require('../utils/geocoding');
const logger = require('../utils/logger');

// Rate limit: 10 requests per second (100ms between requests)
const BATCH_DELAY_MS = 100;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function backfillLocations() {
  console.log('Starting business location backfill...');

  // Fetch all locations with NULL coordinates that have an address
  const { data: locations, error } = await supabaseAdmin
    .from('BusinessLocation')
    .select('id, business_user_id, address, city, state, zipcode, country')
    .is('location', null)
    .not('address', 'is', null)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to query locations:', error.message);
    process.exit(1);
  }

  if (!locations || locations.length === 0) {
    console.log('No locations with NULL coordinates found. Nothing to backfill.');
    process.exit(0);
  }

  console.log(`Found ${locations.length} locations to geocode.`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const loc of locations) {
    if (!loc.address) {
      skipped++;
      continue;
    }

    await sleep(BATCH_DELAY_MS);
    const geo = await geocodeAddress(loc.address, loc.city, loc.state, loc.zipcode, loc.country);

    if (geo) {
      const point = `POINT(${geo.longitude} ${geo.latitude})`;
      const { error: updateError } = await supabaseAdmin
        .from('BusinessLocation')
        .update({ location: point })
        .eq('id', loc.id);

      if (updateError) {
        console.error(`  [FAIL] ${loc.id}: DB update failed — ${updateError.message}`);
        failed++;
      } else {
        console.log(`  [OK]   ${loc.id}: ${loc.address}, ${loc.city} → ${geo.latitude}, ${geo.longitude}`);
        succeeded++;
      }
    } else {
      console.log(`  [MISS] ${loc.id}: ${loc.address}, ${loc.city} — no geocoding result`);
      failed++;
    }
  }

  console.log('\nBackfill complete:');
  console.log(`  Total:     ${locations.length}`);
  console.log(`  Geocoded:  ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Skipped:   ${skipped}`);

  process.exit(0);
}

backfillLocations().catch((err) => {
  console.error('Backfill script crashed:', err);
  process.exit(1);
});
