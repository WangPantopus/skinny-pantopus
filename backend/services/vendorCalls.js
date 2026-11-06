'use strict';

/**
 * Counts every call to a paid data vendor, where they all pass: fetch. Installed once per
 * process, so background jobs and operator paths count too. ATTOM's count must stay zero
 * and Smarty's and Lob's fall to zero as each is replaced, so "no calls" is measured, not
 * assumed. A request is never changed or delayed, and only the vendor's name is kept; for
 * ATTOM also the county its ZIP is mostly in. Never an address or a URL.
 */

const counts = require('./propertyRecords/counts');
const { countyOfZip } = require('./propertyRecords/zipCounty');

const VENDORS = [
  [/(^|\.)attomdata\.com$/, 'attom'],
  [/(^|\.)corelogic\.com$/, 'corelogic'],
  [/(^|\.)smarty\.com$/, 'smarty'],
  [/^addressvalidation\.googleapis\.com$/, 'google_address_validation'],
  [/^places\.googleapis\.com$/, 'google_places'],
  [/^api\.mapbox\.com$/, 'mapbox'],
  [/(^|\.)lob\.com$/, 'lob'],
  [/(^|\.)postgrid\.com$/, 'postgrid'],
  [/(^|\.)stannp\.com$/, 'stannp'],
  [/^api\.walkscore\.com$/, 'walkscore'],
];

function vendorOf(host) {
  const found = VENDORS.find(([pattern]) => pattern.test(host));
  return found ? found[1] : null;
}

// ATTOM's parameters: `postalcode`, or `address2` ("City, ST 98660").
function attomCounty(url) {
  const place = url.searchParams.get('postalcode') || url.searchParams.get('address2') || '';
  const zip = place.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  return zip ? countyOfZip(zip[1]) : null;
}

function note(input) {
  const url = new URL(input?.url || input);
  const vendor = vendorOf(url.hostname.toLowerCase());
  if (vendor) counts.vendorCall(vendor, vendor === 'attom' ? attomCounty(url) : null);
}

/** Starts counting in this process. A rig's stand-in sits underneath, so its answers count as calls. */
function install() {
  const fetchWas = globalThis.fetch;
  if (typeof fetchWas !== 'function' || fetchWas.countsVendors) return;
  const counted = (input, init) => {
    try {
      note(input);
    } catch {
      // A URL this can't read isn't a vendor's, and counting never gets in a request's way.
    }
    return fetchWas(input, init);
  };
  counted.countsVendors = true;
  globalThis.fetch = counted;
}

module.exports = { install, vendorOf };
