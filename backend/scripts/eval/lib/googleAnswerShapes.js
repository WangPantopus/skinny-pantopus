/**
 * Google Address Validation answer shapes for offline evaluation.
 *
 * The structure and code combinations are the ones Google really returns (recorded from real
 * addresses, November 2026); every address here is synthetic and none is ever sent to Google,
 * whose terms forbid made-up US and Puerto Rico addresses.
 */

const SHAPES = {
  house: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABB', addressRecordType: 'S', carrierRoute: 'C012' }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  apartment_with_unit: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABB', addressRecordType: 'H', carrierRoute: 'C012' }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['subpremise'], granularity: 'SUB_PREMISE', hasUnit: true },
  apartment_no_unit: { usps: { dpvConfirmation: 'D', dpvFootnote: 'AAN1', addressRecordType: 'H', carrierRoute: 'C012', dpvNoStat: 'Y', dpvNoStatReasonCode: 5, defaultAddress: true }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE', missing: ['subpremise'], nextAction: 'CONFIRM_ADD_SUBPREMISES' },
  apartment_wrong_unit: { usps: { dpvConfirmation: 'S', dpvFootnote: 'AAC1', addressRecordType: 'H', carrierRoute: 'C012', dpvNoStat: 'Y', dpvNoStatReasonCode: 5 }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE', hasUnit: true, unconfirmed: ['subpremise'] },
  house_stray_unit: { usps: { dpvConfirmation: 'S', dpvFootnote: 'AABBCC', addressRecordType: 'S', carrierRoute: 'C012' }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['subpremise'], granularity: 'SUB_PREMISE', hasUnit: true },
  not_in_usps_file: { usps: { dpvFootnote: 'A1', onlyFootnote: true }, metadata: { residential: true, business: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  no_usps_answer: { usps: null, metadata: { residential: true, business: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  cass_not_processed: { usps: { cassProcessed: false, onlyFootnote: true }, metadata: { residential: true, business: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  usps_suspended: { usps: { errorMessage: 'USPS processing suspended', onlyFootnote: true }, metadata: { residential: true, business: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  undeliverable: { usps: { dpvConfirmation: 'N', dpvFootnote: 'AAA1', addressRecordType: 'S', carrierRoute: 'C012' }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  wrong_street_number: { usps: { dpvConfirmation: 'N', dpvFootnote: 'AAM3' }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE_PROXIMITY', unconfirmed: ['street_number'] },
  not_listed_yet: { usps: { dpvConfirmation: 'N', dpvFootnote: 'AAM3' }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  coming_soon: { usps: { dpvConfirmation: 'N', dpvFootnote: 'A1', ewsNoMatch: true }, metadata: { residential: true, business: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  po_box: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABB', addressRecordType: 'P', carrierRoute: 'B001' }, metadata: { poBox: true }, placeTypes: ['postal_code'], granularity: 'OTHER' },
  mail_drop: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABBR1', addressRecordType: 'H', carrierRoute: 'C012', dpvCmra: 'Y' }, metadata: { residential: false, business: true, poBox: false }, placeTypes: ['subpremise'], granularity: 'SUB_PREMISE', hasUnit: true },
  business: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABB', addressRecordType: 'S', carrierRoute: 'C012' }, metadata: { residential: false, business: true, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  mixed_use: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABB', addressRecordType: 'H', carrierRoute: 'C012' }, metadata: { residential: true, business: true, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  vacant: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABB', addressRecordType: 'S', carrierRoute: 'C012', dpvVacant: 'Y' }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  no_stat: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABB', addressRecordType: 'S', carrierRoute: 'C012', dpvNoStat: 'Y', dpvNoStatReasonCode: 5 }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  use_unset: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABB', addressRecordType: 'S', carrierRoute: 'C012' }, metadata: { poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  use_unset_store: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABB', addressRecordType: 'S', carrierRoute: 'C012' }, metadata: { poBox: false }, placeTypes: ['store', 'establishment', 'point_of_interest'], granularity: 'PREMISE' },
  rural_route: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABB', addressRecordType: 'R', carrierRoute: 'R003' }, metadata: { residential: true, business: false, poBox: false }, placeTypes: ['premise'], granularity: 'PREMISE' },
  military: { usps: { dpvConfirmation: 'Y', dpvFootnote: 'AABBF1', addressRecordType: 'P', carrierRoute: 'B001' }, metadata: { poBox: true }, placeTypes: ['postal_code'], granularity: 'OTHER' },
};

function uspsFields(usps, zip4) {
  if (usps === null) return undefined;
  const { onlyFootnote = false, ...given } = usps;
  const delivered = onlyFootnote ? {} : {
    dpvCmra: 'N',
    dpvVacant: 'N',
    dpvNoStat: 'N',
    dpvDrop: 'N',
    dpvThrowback: 'N',
    dpvNonDeliveryDays: 'N',
    dpvNoSecureLocation: 'N',
    dpvPbsa: 'N',
    dpvDoorNotAccessible: 'N',
    deliveryPointCode: '12',
    deliveryPointCheckDigit: '3',
    carrierRouteIndicator: 'D',
    elotNumber: '0012',
    elotFlag: 'A',
    county: 'CLARK',
    fipsCountyCode: '011',
  };
  return {
    standardizedAddress: { zipCodeExtension: zip4 },
    postOfficeCity: 'VANCOUVER',
    postOfficeState: 'WA',
    cassProcessed: true,
    ...delivered,
    ...given,
  };
}

/**
 * Build an answer. `shape` names a recorded combination; `overrides.usps`, `.metadata` and
 * `.placeTypes` replace single fields, and a usps value of `undefined` removes a field.
 */
function googleAnswer(shape, address, overrides = {}) {
  const base = SHAPES[shape];
  if (!base) throw new Error(`Unknown answer shape: ${shape}`);
  const { line1, line2, city, state, zip, lat = 45.64, lng = -122.66 } = address;
  const [streetNumber, ...route] = String(line1).split(' ');
  const hasUnit = !!line2 && (base.hasUnit !== false);

  const components = [
    { componentName: { text: streetNumber }, componentType: 'street_number', confirmationLevel: (base.unconfirmed || []).includes('street_number') ? 'UNCONFIRMED_BUT_PLAUSIBLE' : 'CONFIRMED' },
    { componentName: { text: route.join(' ') }, componentType: 'route', confirmationLevel: 'CONFIRMED' },
    { componentName: { text: city }, componentType: 'locality', confirmationLevel: 'CONFIRMED' },
    { componentName: { text: state }, componentType: 'administrative_area_level_1', confirmationLevel: 'CONFIRMED' },
    { componentName: { text: zip }, componentType: 'postal_code', confirmationLevel: 'CONFIRMED' },
    { componentName: { text: 'USA' }, componentType: 'country', confirmationLevel: 'CONFIRMED' },
    { componentName: { text: '1234' }, componentType: 'postal_code_suffix', confirmationLevel: 'CONFIRMED', inferred: true },
  ];
  if (hasUnit) {
    components.push({
      componentName: { text: line2 },
      componentType: 'subpremise',
      confirmationLevel: (base.unconfirmed || []).includes('subpremise') ? 'UNCONFIRMED_BUT_PLAUSIBLE' : 'CONFIRMED',
    });
  }

  let usps = base.usps === null ? null : { ...base.usps };
  if (overrides.usps === null) usps = null;
  else if (overrides.usps) usps = { ...(usps || {}), ...overrides.usps };

  const uspsData = uspsFields(usps, '1234');
  if (uspsData) {
    for (const [key, value] of Object.entries(uspsData)) {
      if (value === undefined) delete uspsData[key];
    }
  }

  const metadata = { ...(base.metadata || {}), ...(overrides.metadata || {}) };
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) delete metadata[key];
  }

  const result = {
    verdict: {
      inputGranularity: hasUnit ? 'SUB_PREMISE' : 'PREMISE',
      validationGranularity: base.granularity === 'OTHER' ? 'PREMISE' : base.granularity,
      geocodeGranularity: overrides.granularity || base.granularity,
      addressComplete: true,
      hasInferredComponents: true,
      ...(base.unconfirmed ? { hasUnconfirmedComponents: true } : {}),
      possibleNextAction: base.nextAction || 'ACCEPT',
      ...(overrides.verdict || {}),
    },
    address: {
      formattedAddress: [line1, line2, `${city}, ${state} ${zip}`].filter(Boolean).join(', '),
      postalAddress: { regionCode: 'US', postalCode: zip, administrativeArea: state, locality: city, addressLines: [line1] },
      addressComponents: components,
      ...(base.missing ? { missingComponentTypes: base.missing } : {}),
      ...(base.unconfirmed ? { unconfirmedComponentTypes: base.unconfirmed } : {}),
    },
    geocode: {
      location: { latitude: lat, longitude: lng },
      placeId: 'standin-place-id',
      placeTypes: overrides.placeTypes || base.placeTypes,
    },
    metadata,
  };
  if (uspsData) result.uspsData = uspsData;

  return { result, responseId: 'standin-response' };
}

module.exports = { SHAPES, googleAnswer };
