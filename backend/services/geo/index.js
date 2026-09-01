/**
 * Geo provider factory.
 *
 * Reads GEO_PROVIDER from centralized geo config to select the active implementation.
 * Default: 'mapbox'.
 */

const { GEO_PROVIDER } = require('../../config/geo');

let provider;

switch (GEO_PROVIDER) {
  case 'mapbox':
  default:
    provider = require('./mapboxProvider');
    break;
  // Future providers:
  // case 'google':
  //   provider = require('./googleProvider');
  //   break;
}

module.exports = provider;
