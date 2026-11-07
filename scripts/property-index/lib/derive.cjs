'use strict';
// What a county's record says without saying it twice: the other unit of its lot, and the plain words for what its own codes
// said this home is. Nothing here looks past the record.

const ACRE = 43560;
const TYPE_WORDS = {
  'property:house': 'Single family residence', 'property:townhouse': 'Townhouse', 'property:mobile_home': 'Manufactured or mobile home', 'property:condo': 'Condominium',
  'unit:condo': 'Condominium', 'building:condo': 'Condominium building', 'building:multi_unit': 'Multi-family building', 'building:apartment': 'Apartment building',
};

function deriveFacts(records) {
  for (const { kind, home_type: homeType, facts, restricted } of records) {
    if (restricted || !facts) continue;
    if (facts.lot_sqft > 0 && !(facts.lot_acres > 0)) facts.lot_acres = Number((facts.lot_sqft / ACRE).toFixed(4));
    else if (facts.lot_acres > 0 && !(facts.lot_sqft > 0)) facts.lot_sqft = Math.round(facts.lot_acres * ACRE);
    const words = TYPE_WORDS[`${kind}:${homeType}`];
    if (words && !facts.property_type) facts.property_type = words;
  }
}

module.exports = { deriveFacts };
