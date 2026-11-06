'use strict';

/**
 * What the national estimate layer may hold, apart from the record's facts
 * (facts.js): modeled figures about a structure, never a county's statement about a
 * home. No name here is a record fact, so nothing can read one as the other by
 * accident, and a build refuses anything else. No dependencies: the index build uses
 * it too.
 */
const ESTIMATE_FACTS = {
  // FEMA USA Structures (ORNL): the outline seen from above.
  footprint_sqft: { source: 'fema' },
  building_use: { source: 'fema' },
  structures_at_address: { source: 'fema' },
  // USACE National Structure Inventory: modeled from the footprint and census data.
  modeled_sqft: { source: 'nsi' },
  modeled_stories: { source: 'nsi' },
  block_group: { source: 'nsi' },
};

module.exports = { ESTIMATE_FACTS };
