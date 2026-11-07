'use strict';

/**
 * A Home's facts as an ATTOM /property/detail property gives them: what Add Home's
 * prefill and the ATTOM profile read (propertyIntelligenceService.js), and what a
 * Home's saved copy says, so a column Add Home filled from it can be told from the
 * household's own entry (householdFacts.js). Nothing here asks ATTOM.
 */

/**
 * ATTOM often returns lowercase keys (beds, bathsfull) on rooms; summary may use livingsize.
 */
function pickAttomRooms(building) {
  const rooms = building?.rooms || {};
  const beds =
    rooms.beds ?? rooms.bedrooms ?? rooms.Beds ?? rooms.bedroomsCount;
  const baths =
    rooms.bathstotal
    ?? rooms.bathsTotal
    ?? rooms.bathsfull
    ?? rooms.bathsFull
    ?? rooms.bathscalc
    ?? rooms.calcBathrooms;
  return {
    bedrooms: beds != null && beds !== '' ? Number(beds) : null,
    bathrooms: baths != null && baths !== '' ? Number(baths) : null,
  };
}

/** ATTOM /property/detail: sqft lives under building.size; year/type under property.summary; lot sqft often lot.lotsize2 */
function pickAttomSummaryLot(property) {
  if (!property) {
    return { sqft: null, lot_sq_ft: null, year_built: null, raw_property_type: null };
  }
  const pSum = property.summary || {};
  const building = property.building || {};
  const bSize = building.size || {};
  const lot = property.lot || {};

  const sqft =
    bSize.livingsize
    ?? bSize.livingSize
    ?? bSize.universalsize
    ?? bSize.universalSize
    ?? bSize.grosssizeadjusted
    ?? bSize.grossSizeAdjusted
    ?? bSize.bldgsize
    ?? bSize.bldgSize;

  const lotSq =
    lot.lotsize2
    ?? lot.lotSize2
    ?? null;

  const year =
    pSum.yearbuilt
    ?? pSum.yearBuilt;

  const propType =
    pSum.propertyType
    ?? pSum.proptype
    ?? pSum.propclass;

  return {
    sqft: sqft != null && sqft !== '' ? Number(sqft) : null,
    lot_sq_ft: lotSq != null && lotSq !== '' ? Number(lotSq) : null,
    year_built: year != null && year !== '' ? Number(year) : null,
    raw_property_type: propType != null && propType !== '' ? String(propType) : null,
  };
}

/**
 * Bedrooms, bathrooms and living area as the Home's saved ATTOM copy
 * (`niche_data.attom_property_detail`) gives them, under the record's names, read
 * the way Add Home read them to fill the form. Empty when there's no copy.
 */
function savedCopyFacts(nicheData) {
  const saved = nicheData?.attom_property_detail;
  const property = saved?.full_response?.property?.[0] || saved?.property;
  if (!property || typeof property !== 'object' || Array.isArray(property)) return {};
  const rooms = pickAttomRooms(property.building);
  return { bedrooms: rooms.bedrooms, bathrooms: rooms.bathrooms, living_sqft: pickAttomSummaryLot(property).sqft };
}

module.exports = { pickAttomRooms, pickAttomSummaryLot, savedCopyFacts };
