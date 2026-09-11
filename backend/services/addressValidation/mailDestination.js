/** Mailing destination bindings; exclude these snapshots from public status responses. */
function textKey(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
}

function unitKey(value) {
  // Only these apartment labels are interchangeable. Preserve floor/suite,
  // punctuation, leading zeros and the complete unit suffix.
  return textKey(value).replace(/^(?:APARTMENT\s+|APT\.?\s+|UNIT\s+|#\s*)/, '');
}

function destinationFor(address, unit) {
  const canonicalUnit = address.address_line2_norm;
  if (canonicalUnit && unit && unitKey(canonicalUnit) !== unitKey(unit)) return null;
  return {
    line1: address.address_line1_norm,
    line2: canonicalUnit || unit || null,
    city: address.city_norm,
    state: address.state,
    zip: address.postal_code,
  };
}

function sameDestination(left, right) {
  return !!left && !!right && ['line1', 'city', 'state', 'zip'].every(key => textKey(left[key]) === textKey(right[key]))
    && unitKey(left.line2) === unitKey(right.line2);
}

function destinationForHome(home, address) {
  return {
    line1: home.address,
    line2: String(home.address2 || '').trim() || address.address_line2_norm || null,
    city: home.city,
    state: home.state,
    zip: home.zipcode,
  };
}

module.exports = { unitKey, destinationFor, destinationForHome, sameDestination };
