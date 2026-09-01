/**
 * GeoProvider — abstract interface for geocoding services.
 *
 * All providers must implement the four methods below. The route layer
 * delegates to whichever provider is active (configured via GEO_PROVIDER env).
 *
 * @typedef {Object} NormalizedSuggestion
 * @property {string}  suggestion_id   - Provider-stable identifier for this suggestion.
 * @property {string}  primary_text    - Street address or main line (e.g. "123 Main St").
 * @property {string}  secondary_text  - City, State, Zip context line.
 * @property {string}  label           - Full display string for the dropdown.
 * @property {{ lat: number, lng: number }} center - Approximate coordinates.
 * @property {string}  kind            - Feature type: "address" | "place" | "locality" | "postcode".
 *
 * @typedef {Object} NormalizedAddress
 * @property {string}       address        - Full street address or place name.
 * @property {string}       city           - City / place name.
 * @property {string}       state          - Two-letter state code (preferred) or full name.
 * @property {string}       zipcode        - Postal code.
 * @property {number|null}  latitude       - WGS-84 latitude.
 * @property {number|null}  longitude      - WGS-84 longitude.
 * @property {string|null}  place_id       - Provider-specific place identifier.
 * @property {boolean}      verified       - Always false from geocoding; set true after verification.
 * @property {string}       source         - Provider tag (e.g. "mapbox_geocode").
 * @property {'temporary'|'permanent'} geocode_mode - Geocode intent.
 */

/**
 * @interface GeoProvider
 *
 * @method autocomplete
 * @param {string} query - User-typed search text.
 * @param {{ sessionToken?: string, limit?: number, country?: string }} [options]
 * @returns {Promise<{ suggestions: NormalizedSuggestion[] }>}
 *
 * @method resolve
 * @param {string} suggestionId - suggestion_id from a previous autocomplete result.
 * @param {string} [sessionToken]
 * @returns {Promise<NormalizedAddress>}
 *
 * @method reverseGeocode
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<NormalizedAddress>}
 *
 * @method forwardGeocode
 * @param {string} address - Full address string to geocode.
 * @param {{ mode?: 'temporary'|'permanent' }} [options]
 * @returns {Promise<NormalizedAddress>}
 */

module.exports = {};
