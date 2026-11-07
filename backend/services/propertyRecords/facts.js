'use strict';

/**
 * Every fact a release may hold: the allowlist. The build refuses a record with
 * any other key, and the Property details projector (serializers/countyRecordSerializer.js)
 * reads this table for each fact's group, words and format. No dependencies, so
 * the index build runs without the backend's packages.
 *
 * `scope` is whose fact it is on a condo or in a building:
 *   unit      the unit's own (shown only on an exact match)
 *   building  the building's (shown on an exact match, labeled, and on a building-only match)
 *   parcel    the land's or the account's
 * `owner: true` stays out of everything but a verified owner's own screens: a tax
 * status can say something about a person's age or health.
 */
const FACTS = {
  // Building
  year_built: { section: 'building', label: 'Year built', format: 'year', scope: 'building' },
  effective_year_built: { section: 'building', label: 'Effective year built', format: 'year', scope: 'building' },
  living_sqft: { section: 'building', label: 'Living area', format: 'sqft', scope: 'unit' },
  usable_sqft: { section: 'building', label: 'Living or usable area', format: 'sqft', scope: 'unit' },
  gross_sqft: { section: 'building', label: 'Gross area', format: 'sqft', scope: 'building' },
  ground_floor_sqft: { section: 'building', label: 'Ground floor area', format: 'sqft', scope: 'unit' },
  second_floor_sqft: { section: 'building', label: 'Second floor area', format: 'sqft', scope: 'unit' },
  stories: { section: 'building', label: 'Stories', format: 'stories', scope: 'building' },
  rooms: { section: 'building', label: 'Total rooms', format: 'count', scope: 'unit' },
  bedrooms: { section: 'building', label: 'Bedrooms', format: 'count', scope: 'unit' },
  bathrooms: { section: 'building', label: 'Bathrooms', format: 'baths', scope: 'unit' },
  kitchens: { section: 'building', label: 'Kitchens', format: 'count', scope: 'unit' },
  full_baths: { section: 'building', label: 'Full baths', format: 'count', scope: 'unit' },
  three_quarter_baths: { section: 'building', label: 'Three-quarter baths', format: 'count', scope: 'unit' },
  half_baths: { section: 'building', label: 'Half baths', format: 'count', scope: 'unit' },
  basement_sqft: { section: 'building', label: 'Basement area', format: 'sqft', scope: 'unit' },
  basement_finished_sqft: { section: 'building', label: 'Finished basement area', format: 'sqft', scope: 'unit' },
  fireplaces: { section: 'building', label: 'Fireplaces', format: 'count', scope: 'unit' },
  style: { section: 'building', label: 'Architectural style', format: 'text', scope: 'building' },
  building_type: { section: 'building', label: 'Building type', format: 'text', scope: 'building' },
  condition: { section: 'building', label: 'Condition', format: 'text', scope: 'unit' },
  quality: { section: 'building', label: 'Quality', format: 'text', scope: 'building' },
  percent_complete: { section: 'building', label: 'Construction complete', format: 'percent', scope: 'building' },
  units: { section: 'building', label: 'Units', format: 'count', scope: 'building' },
  units_in_condominium: { section: 'building', label: 'Units in the condominium', format: 'count', scope: 'building' },
  buildings_on_parcel: { section: 'building', label: 'Buildings on the parcel', format: 'count', scope: 'building' },
  other_structures: { section: 'building', label: 'Other structures', format: 'text', scope: 'unit' },

  // Construction
  frame: { section: 'construction', label: 'Frame', format: 'text', scope: 'building' },
  foundation: { section: 'construction', label: 'Foundation', format: 'text', scope: 'building' },
  exterior_walls: { section: 'construction', label: 'Exterior walls', format: 'text', scope: 'building' },
  roof_cover: { section: 'construction', label: 'Roof cover', format: 'text', scope: 'building' },
  roof_shape: { section: 'construction', label: 'Roof shape', format: 'text', scope: 'building' },
  flooring: { section: 'construction', label: 'Flooring', format: 'text', scope: 'unit' },

  // Heating and cooling
  heating: { section: 'utilities', label: 'Heating', format: 'text', scope: 'unit' },
  heating_fuel: { section: 'utilities', label: 'Heating fuel', format: 'text', scope: 'unit' },
  cooling: { section: 'utilities', label: 'Cooling', format: 'text', scope: 'unit' },
  water_source: { section: 'utilities', label: 'Water', format: 'text', scope: 'parcel' },
  sewer: { section: 'utilities', label: 'Sewer', format: 'text', scope: 'parcel' },
  utilities: { section: 'utilities', label: 'Utilities', format: 'text', scope: 'parcel' },

  // Parking
  garage: { section: 'parking', label: 'Garage', format: 'text', scope: 'unit' },
  parking_type: { section: 'parking', label: 'Parking type', format: 'text', scope: 'unit' },
  garage_sqft: { section: 'parking', label: 'Parking area', format: 'sqft', scope: 'unit' },
  carport_sqft: { section: 'parking', label: 'Carport area', format: 'sqft', scope: 'unit' },
  parking_spaces: { section: 'parking', label: 'Parking spaces', format: 'count', scope: 'unit' },

  // Lot
  lot_acres: { section: 'lot', label: 'Lot size', format: 'acres', scope: 'parcel' },
  lot_sqft: { section: 'lot', label: 'Lot area', format: 'sqft', scope: 'parcel' },
  lot_number: { section: 'lot', label: 'Lot number', format: 'code', scope: 'parcel' },
  zoning: { section: 'lot', label: 'Zoning', format: 'code', scope: 'parcel' },
  pool: { section: 'lot', label: 'Pool', format: 'text', scope: 'unit' },

  // Parcel and records
  property_type: { section: 'records', label: 'Property type', format: 'text', scope: 'parcel' },
  property_subtype: { section: 'records', label: 'Property subtype', format: 'text', scope: 'parcel' },
  address_on_record: { section: 'records', label: 'Address on record', format: 'raw', scope: 'unit' },
  zip_plus4: { section: 'records', label: 'ZIP+4', format: 'code', scope: 'unit' },
  parcel_number: { section: 'records', label: 'Parcel number (APN)', format: 'code', scope: 'parcel' },
  county: { section: 'records', label: 'County', format: 'name', scope: 'parcel' },
  fips: { section: 'records', label: 'County code (FIPS)', format: 'code', scope: 'parcel' },
  municipality: { section: 'records', label: 'Municipality', format: 'name', scope: 'parcel' },
  neighborhood: { section: 'records', label: 'Neighborhood', format: 'name', scope: 'parcel' },
  subdivision: { section: 'records', label: 'Subdivision', format: 'name', scope: 'parcel' },
  tax_code_area: { section: 'records', label: 'Tax code area', format: 'code', scope: 'parcel' },
  school_district: { section: 'records', label: 'School district', format: 'name', scope: 'parcel' },
  land_use: { section: 'records', label: 'Land use', format: 'text', scope: 'parcel' },
  property_class: { section: 'records', label: 'Property class', format: 'text', scope: 'parcel' },
  county_use_code: { section: 'records', label: 'County use code', format: 'code', scope: 'parcel' },
  legal_description: { section: 'records', label: 'Legal description', format: 'raw', scope: 'parcel' },

  // Assessment and taxes: the account's. `market_value` is the county's own market value, never fractional.
  market_value: { section: 'assessment', label: 'County market value', format: 'money', scope: 'unit', value: true },
  market_land_value: { section: 'assessment', label: 'County market land value', format: 'money', scope: 'unit', value: true },
  market_building_value: { section: 'assessment', label: 'County market improvement value', format: 'money', scope: 'unit', value: true },
  assessed_value: { section: 'assessment', label: 'Assessed value', format: 'money', scope: 'unit', value: true },
  assessed_land_value: { section: 'assessment', label: 'Assessed land value', format: 'money', scope: 'unit', value: true },
  assessed_building_value: { section: 'assessment', label: 'Assessed improvement value', format: 'money', scope: 'unit', value: true },
  taxable_value: { section: 'assessment', label: 'Taxable value', format: 'money', scope: 'unit', value: true },
  value_year: { section: 'assessment', label: 'Value year', format: 'year', scope: 'unit', value: true },
  value_history: { section: 'assessment', format: 'history', scope: 'unit', value: true, owner: true },
  tax_amount: { section: 'assessment', label: 'Property tax', format: 'money', scope: 'unit', value: true },
  tax_year: { section: 'assessment', label: 'Tax year', format: 'year', scope: 'unit', value: true },
  tax_history: { section: 'assessment', format: 'history', scope: 'unit', value: true, owner: true },
  tax_status: { section: 'assessment', label: 'Tax status', format: 'text', scope: 'unit', value: true, owner: true },
  exemptions: { section: 'assessment', format: 'none', scope: 'unit', value: true, owner: true },

  // Last sale
  sale_price: { section: 'sale', label: 'Sale price', format: 'money', scope: 'unit', value: true },
  sale_date: { section: 'sale', label: 'Sale date', format: 'date', scope: 'unit', value: true },
  sale_month: { section: 'sale', label: 'Sale date', format: 'raw', scope: 'unit', value: true },
  sale_document: { section: 'sale', label: 'Document number', format: 'code', scope: 'unit', value: true },
  // How many homes share this sale's deed, where several do (scripts/property-index/lib/shared-deeds.cjs): its price is the deed's.
  sale_parcels: { section: 'sale', format: 'none', scope: 'unit', value: true },
};

const SECTIONS = [
  ['building', 'Building'],
  ['construction', 'Construction'],
  ['utilities', 'Heating, cooling & utilities'],
  ['parking', 'Parking'],
  ['lot', 'Lot'],
  ['records', 'Parcel & records'],
  ['assessment', 'Assessment & taxes'],
  ['sale', 'Last sale'],
];

module.exports = { FACTS, SECTIONS };
