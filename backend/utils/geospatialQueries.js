/**
 * Example geospatial queries for Pantopus
 * Using raw SQL with Supabase for optimal performance
 */

const { createServerSupabaseClient } = require('../config/supabaseClient');
require('dotenv').config();

const supabase = createServerSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ============ GEOSPATIAL QUERY EXAMPLES ============

/**
 * Find all gigs within a specified radius (in meters)
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {number} radiusMeters - Search radius in meters
 * @returns {Promise<Array>} Array of gigs
 */
async function findGigsNearby(latitude, longitude, radiusMeters = 5000) {
  const { data, error } = await supabase.rpc('find_gigs_nearby', {
    user_lat: latitude,
    user_lon: longitude,
    radius_meters: radiusMeters
  });

  if (error) throw error;
  return data;
}

/**
 * Get gigs sorted by distance from user location
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Gigs sorted by distance
 */
async function getGigsByDistance(latitude, longitude, limit = 10) {
  const { data, error } = await supabase
    .from('Gig')
    .select('*, distance:exact_location.st_distance(st_point($1, $2))::int', {
      // Note: ST_Distance requires PostGIS, handled via raw SQL
    })
    .eq('status', 'open')
    .order('distance', { ascending: true })
    .limit(limit);

  // Better approach: use raw SQL
  return getGigsByDistanceRaw(latitude, longitude, limit);
}

/**
 * Raw SQL version for distance sorting (recommended)
 * Better performance and more control
 */
async function getGigsByDistanceRaw(latitude, longitude, limit = 10) {
  const { data, error } = await supabase.rpc('get_gigs_by_distance', {
    user_lat: latitude,
    user_lon: longitude,
    limit_count: limit
  });

  if (error) throw error;
  return data;
}

/**
 * Find homes near a location with optional filters
 */
async function findHomesNearby(latitude, longitude, radiusMeters = 10000) {
  const { data, error } = await supabase.rpc('find_homes_nearby', {
    user_lat: latitude,
    user_lon: longitude,
    radius_meters: radiusMeters
  });

  if (error) throw error;
  return data;
}

// ============ SQL FUNCTIONS TO CREATE IN DATABASE ============
// Run these in Supabase SQL editor to enable the RPC functions above

const SQL_FUNCTIONS = `
-- Function 1: Find gigs within radius
CREATE OR REPLACE FUNCTION find_gigs_nearby(
  user_lat FLOAT,
  user_lon FLOAT,
  radius_meters INT DEFAULT 5000
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  description TEXT,
  price DECIMAL,
  category VARCHAR,
  user_id UUID,
  status VARCHAR,
  distance_meters INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.description,
    g.price,
    g.category,
    g.user_id,
    g.status,
    CAST(
      ST_Distance(
        g.exact_location,
        ST_Point(user_lon, user_lat)::GEOGRAPHY
      ) AS INT
    ) as distance_meters
  FROM "Gig" g
  WHERE 
    g.status = 'open'
    AND ST_Distance(
      g.exact_location,
      ST_Point(user_lon, user_lat)::GEOGRAPHY
    ) <= radius_meters
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Get gigs sorted by distance
CREATE OR REPLACE FUNCTION get_gigs_by_distance(
  user_lat FLOAT,
  user_lon FLOAT,
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  description TEXT,
  price DECIMAL,
  category VARCHAR,
  user_id UUID,
  status VARCHAR,
  distance_meters INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.description,
    g.price,
    g.category,
    g.user_id,
    g.status,
    CAST(
      ST_Distance(
        g.exact_location,
        ST_Point(user_lon, user_lat)::GEOGRAPHY
      ) AS INT
    ) as distance_meters
  FROM "Gig" g
  WHERE g.status = 'open' AND g.exact_location IS NOT NULL
  ORDER BY distance_meters ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Find homes nearby
CREATE OR REPLACE FUNCTION find_homes_nearby(
  user_lat FLOAT,
  user_lon FLOAT,
  radius_meters INT DEFAULT 10000
)
RETURNS TABLE (
  id UUID,
  address VARCHAR,
  city VARCHAR,
  state VARCHAR,
  owner_id UUID,
  distance_meters INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.address,
    h.city,
    h.state,
    h.owner_id,
    CAST(
      ST_Distance(
        h.location,
        ST_Point(user_lon, user_lat)::GEOGRAPHY
      ) AS INT
    ) as distance_meters
  FROM "Home" h
  WHERE 
    ST_Distance(
      h.location,
      ST_Point(user_lon, user_lat)::GEOGRAPHY
    ) <= radius_meters
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;
`;

module.exports = {
  findGigsNearby,
  getGigsByDistance,
  getGigsByDistanceRaw,
  findHomesNearby,
  SQL_FUNCTIONS
};
