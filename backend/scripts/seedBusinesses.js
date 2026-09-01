#!/usr/bin/env node

/**
 * Seed the SeededBusiness table with local service providers for the
 * Clark County WA + Portland Metro launch region.
 *
 * Idempotent — uses upsert with (source, source_id) to prevent duplicates.
 *
 * Usage: node backend/scripts/seedBusinesses.js
 */

require('dotenv').config();
const { createServerSupabaseClient } = require('../config/supabaseClient');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createServerSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Seed data ──────────────────────────────────────────────────────────────

const BUSINESSES = [
  // ── Handyman (10) ────────────────────────────────────────
  { name: 'Clark County Handyman', category: 'Handyman', subcategory: 'General', address: '1208 Main St', city: 'Vancouver', state: 'WA', zipcode: '98660', latitude: 45.6280, longitude: -122.6750, source_id: 'seed-handy-01' },
  { name: 'Fix-It Pro Vancouver', category: 'Handyman', subcategory: 'General', address: '8900 NE Hazel Dell Ave', city: 'Vancouver', state: 'WA', zipcode: '98665', latitude: 45.6680, longitude: -122.6620, source_id: 'seed-handy-02' },
  { name: 'Salmon Creek Fence & Repair', category: 'Handyman', subcategory: 'Fence Repair', address: '2115 NE 134th St', city: 'Vancouver', state: 'WA', zipcode: '98686', latitude: 45.7120, longitude: -122.6590, source_id: 'seed-handy-03' },
  { name: 'A+ Plumbing Solutions', category: 'Handyman', subcategory: 'Plumbing', address: '6701 NE 63rd St', city: 'Vancouver', state: 'WA', zipcode: '98661', latitude: 45.6540, longitude: -122.6210, source_id: 'seed-handy-04' },
  { name: 'Cascade Electric Services', category: 'Handyman', subcategory: 'Electrical', address: '3205 SE 192nd Ave', city: 'Camas', state: 'WA', zipcode: '98607', latitude: 45.5890, longitude: -122.4090, source_id: 'seed-handy-05' },
  { name: 'Camas Home Repair', category: 'Handyman', subcategory: 'General', address: '428 NE 4th Ave', city: 'Camas', state: 'WA', zipcode: '98607', latitude: 45.5870, longitude: -122.3980, source_id: 'seed-handy-06' },
  { name: 'PDX Handyman Co.', category: 'Handyman', subcategory: 'General', address: '8234 N Lombard St', city: 'Portland', state: 'OR', zipcode: '97203', latitude: 45.5770, longitude: -122.7520, source_id: 'seed-handy-07' },
  { name: 'Sellwood Home Services', category: 'Handyman', subcategory: 'General', address: '1636 SE Bybee Blvd', city: 'Portland', state: 'OR', zipcode: '97202', latitude: 45.4670, longitude: -122.6480, source_id: 'seed-handy-08' },
  { name: 'Felida Fix-Up', category: 'Handyman', subcategory: 'General', address: '3210 NW 119th St', city: 'Vancouver', state: 'WA', zipcode: '98685', latitude: 45.7000, longitude: -122.7050, source_id: 'seed-handy-09' },
  { name: 'Washougal Home Helpers', category: 'Handyman', subcategory: 'General', address: '1850 Main St', city: 'Washougal', state: 'WA', zipcode: '98671', latitude: 45.5830, longitude: -122.3530, source_id: 'seed-handy-10' },

  // ── Cleaning (6) ─────────────────────────────────────────
  { name: 'Sparkle House Cleaning', category: 'Cleaning', subcategory: 'House Cleaning', address: '700 NE Chkalov Dr', city: 'Vancouver', state: 'WA', zipcode: '98684', latitude: 45.6320, longitude: -122.5750, source_id: 'seed-clean-01' },
  { name: 'Crystal Clear Window Washing', category: 'Cleaning', subcategory: 'Window Cleaning', address: '4005 SE Mill Plain Blvd', city: 'Vancouver', state: 'WA', zipcode: '98661', latitude: 45.6220, longitude: -122.6300, source_id: 'seed-clean-02' },
  { name: 'NW Pressure Washing', category: 'Cleaning', subcategory: 'Pressure Washing', address: '11215 NE 51st Cir', city: 'Vancouver', state: 'WA', zipcode: '98682', latitude: 45.6600, longitude: -122.5700, source_id: 'seed-clean-03' },
  { name: 'Pacific Gutter Cleaning', category: 'Cleaning', subcategory: 'Gutter Cleaning', address: '902 Esther St', city: 'Vancouver', state: 'WA', zipcode: '98660', latitude: 45.6310, longitude: -122.6830, source_id: 'seed-clean-04' },
  { name: 'Beaverton Maids', category: 'Cleaning', subcategory: 'House Cleaning', address: '4570 SW Watson Ave', city: 'Beaverton', state: 'OR', zipcode: '97005', latitude: 45.4870, longitude: -122.8030, source_id: 'seed-clean-05' },
  { name: 'Hazel Dell Deep Clean', category: 'Cleaning', subcategory: 'House Cleaning', address: '6804 NE Hwy 99', city: 'Vancouver', state: 'WA', zipcode: '98665', latitude: 45.6620, longitude: -122.6620, source_id: 'seed-clean-06' },

  // ── Gardening / Lawn Care (6) ────────────────────────────
  { name: 'Green Thumb Landscaping', category: 'Gardening', subcategory: 'Landscaping', address: '5800 NE Fourth Plain Blvd', city: 'Vancouver', state: 'WA', zipcode: '98661', latitude: 45.6480, longitude: -122.6150, source_id: 'seed-garden-01' },
  { name: 'PNW Lawn & Mow', category: 'Gardening', subcategory: 'Mowing', address: '14300 NE 20th Ave', city: 'Vancouver', state: 'WA', zipcode: '98686', latitude: 45.7150, longitude: -122.6520, source_id: 'seed-garden-02' },
  { name: 'Arborcare Tree Trimming', category: 'Gardening', subcategory: 'Tree Trimming', address: '2503 Columbia House Blvd', city: 'Vancouver', state: 'WA', zipcode: '98661', latitude: 45.6390, longitude: -122.6400, source_id: 'seed-garden-03' },
  { name: 'Cascade Yard Care', category: 'Gardening', subcategory: 'Mowing', address: '917 SE Everett Rd', city: 'Camas', state: 'WA', zipcode: '98607', latitude: 45.5840, longitude: -122.3920, source_id: 'seed-garden-04' },
  { name: 'St. Johns Garden Services', category: 'Gardening', subcategory: 'Landscaping', address: '7509 N Burlington Ave', city: 'Portland', state: 'OR', zipcode: '97203', latitude: 45.5890, longitude: -122.7510, source_id: 'seed-garden-05' },
  { name: 'Felida Lawn Masters', category: 'Gardening', subcategory: 'Mowing', address: '12010 NW 29th Ave', city: 'Vancouver', state: 'WA', zipcode: '98685', latitude: 45.7020, longitude: -122.7100, source_id: 'seed-garden-06' },

  // ── Pet Care (4) ─────────────────────────────────────────
  { name: 'Paws & Play Dog Walking', category: 'Pet Care', subcategory: 'Dog Walking', address: '1300 Broadway St', city: 'Vancouver', state: 'WA', zipcode: '98660', latitude: 45.6280, longitude: -122.6720, source_id: 'seed-pet-01' },
  { name: 'Happy Tails Pet Sitting', category: 'Pet Care', subcategory: 'Pet Sitting', address: '8415 NE Vancouver Mall Dr', city: 'Vancouver', state: 'WA', zipcode: '98662', latitude: 45.6510, longitude: -122.5980, source_id: 'seed-pet-02' },
  { name: 'Bark Avenue Grooming', category: 'Pet Care', subcategory: 'Grooming', address: '305 SE Chkalov Dr', city: 'Vancouver', state: 'WA', zipcode: '98683', latitude: 45.6170, longitude: -122.5780, source_id: 'seed-pet-03' },
  { name: 'Sellwood Dog Walkers', category: 'Pet Care', subcategory: 'Dog Walking', address: '7900 SE 13th Ave', city: 'Portland', state: 'OR', zipcode: '97202', latitude: 45.4620, longitude: -122.6530, source_id: 'seed-pet-04' },

  // ── Moving / Delivery (4) ────────────────────────────────
  { name: 'Two Guys & A Truck', category: 'Moving', subcategory: 'Moving Help', address: '4200 SE Columbia Way', city: 'Vancouver', state: 'WA', zipcode: '98661', latitude: 45.6180, longitude: -122.6270, source_id: 'seed-move-01' },
  { name: 'Clark County Junk Removal', category: 'Moving', subcategory: 'Junk Removal', address: '6111 NE 88th St', city: 'Vancouver', state: 'WA', zipcode: '98665', latitude: 45.6750, longitude: -122.6150, source_id: 'seed-move-02' },
  { name: 'River City Movers', category: 'Moving', subcategory: 'Moving Help', address: '8012 N Fessenden St', city: 'Portland', state: 'OR', zipcode: '97203', latitude: 45.5810, longitude: -122.7430, source_id: 'seed-move-03' },
  { name: 'EZ Furniture Delivery', category: 'Moving', subcategory: 'Delivery', address: '6805 NE 42nd St', city: 'Vancouver', state: 'WA', zipcode: '98661', latitude: 45.6530, longitude: -122.6260, source_id: 'seed-move-04' },

  // ── Other (5) ────────────────────────────────────────────
  { name: 'Bright Minds Tutoring', category: 'Tutoring', subcategory: 'Academic', address: '7620 NE Hazel Dell Ave', city: 'Vancouver', state: 'WA', zipcode: '98665', latitude: 45.6700, longitude: -122.6630, source_id: 'seed-other-01' },
  { name: 'Columbia Gorge Photography', category: 'Photography', subcategory: 'Events', address: '205 E 4th St', city: 'Washougal', state: 'WA', zipcode: '98671', latitude: 45.5820, longitude: -122.3560, source_id: 'seed-other-02' },
  { name: 'GeekSquad NW Tech Support', category: 'Tech Support', subcategory: 'Computer Repair', address: '8511 NE Vancouver Mall Dr', city: 'Vancouver', state: 'WA', zipcode: '98662', latitude: 45.6520, longitude: -122.5950, source_id: 'seed-other-03' },
  { name: 'Abuela\'s Kitchen Catering', category: 'Cooking', subcategory: 'Catering', address: '1901 Main St', city: 'Vancouver', state: 'WA', zipcode: '98660', latitude: 45.6300, longitude: -122.6770, source_id: 'seed-other-04' },
  { name: 'Party Helpers PDX', category: 'Event Help', subcategory: 'Event Setup', address: '3930 N Mississippi Ave', city: 'Portland', state: 'OR', zipcode: '97227', latitude: 45.5530, longitude: -122.6760, source_id: 'seed-other-05' },
];

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${BUSINESSES.length} businesses...`);

  // Add common fields
  const rows = BUSINESSES.map((b) => ({
    ...b,
    source: 'manual_seed',
    is_active: true,
  }));

  // Upsert in batches (Supabase has row limits per request)
  const BATCH_SIZE = 20;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('SeededBusiness')
      .upsert(batch, { onConflict: 'source,source_id', ignoreDuplicates: false })
      .select('id');

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
    } else {
      inserted += (data || []).length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${(data || []).length} rows upserted`);
    }
  }

  console.log(`Done. ${inserted} businesses seeded (${BUSINESSES.length} total records).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
