/**
 * Provider Interface Definitions
 *
 * JSDoc type definitions for the normalized data shapes returned by
 * weather, AQI, and alert providers. All provider adapters should
 * conform to these shapes so the context pipeline can consume them
 * uniformly.
 */

// ── Weather ─────────────────────────────────────────────

/**
 * @typedef {Object} WeatherCurrent
 * @property {number|null} temp_f            Temperature in Fahrenheit
 * @property {number|null} temp_c            Temperature in Celsius
 * @property {string}      condition_code    Machine-readable code (e.g. 'rain', 'clear', 'cloudy')
 * @property {string}      condition_label   Human-readable label (e.g. 'Light Rain', 'Clear')
 * @property {number|null} humidity_pct      Relative humidity (0–100)
 * @property {number|null} wind_mph          Wind speed in mph
 * @property {string|null} wind_direction    Compass direction (e.g. 'NW', 'SSE')
 * @property {number|null} feels_like_f      Feels-like temperature in Fahrenheit
 * @property {number|null} uv_index          UV index (0–11+)
 * @property {number|null} cloud_cover_pct   Cloud cover percentage (0–100)
 * @property {number|null} visibility_miles  Visibility in miles
 * @property {number|null} pressure_mb       Barometric pressure in millibars
 * @property {number|null} dew_point_f       Dew point in Fahrenheit
 */

/**
 * @typedef {Object} WeatherHourly
 * @property {string}      datetime_utc      ISO 8601 UTC timestamp for the hour
 * @property {number}      temp_f            Temperature in Fahrenheit
 * @property {string}      condition_code    Machine-readable condition code
 * @property {string}      condition_label   Human-readable condition label
 * @property {number|null} precip_chance_pct Precipitation probability (0–100)
 * @property {string|null} precip_type       'rain', 'snow', 'sleet', 'hail', or null
 * @property {number|null} wind_mph          Wind speed in mph
 * @property {number|null} humidity_pct      Relative humidity (0–100)
 */

/**
 * @typedef {Object} WeatherDaily
 * @property {string}      date              Date string YYYY-MM-DD
 * @property {number}      high_f            Daily high in Fahrenheit
 * @property {number}      low_f             Daily low in Fahrenheit
 * @property {string}      condition_code    Machine-readable condition code
 * @property {string}      condition_label   Human-readable condition label
 * @property {number|null} precip_chance_pct Precipitation probability (0–100)
 * @property {string|null} sunrise_utc       ISO 8601 sunrise time (UTC)
 * @property {string|null} sunset_utc        ISO 8601 sunset time (UTC)
 * @property {number|null} uv_index_max      Peak UV index for the day
 */

/**
 * @typedef {Object} WeatherResult
 * @property {WeatherCurrent|null} current  Current conditions
 * @property {WeatherHourly[]}     hourly   Hourly forecast (next 24 hours)
 * @property {WeatherDaily[]}      daily    Daily forecast (next 7 days)
 * @property {string}              provider Provider identifier (e.g. 'WEATHERKIT', 'OPEN_METEO')
 * @property {string}              fetchedAt ISO 8601 timestamp of fetch
 */

// ── AQI ─────────────────────────────────────────────────

/**
 * @typedef {Object} AQIResult
 * @property {number|null}  aqi           AQI value (0–500), or null if unavailable
 * @property {string|null}  category      Human-readable category (e.g. 'Good', 'Unhealthy')
 * @property {string|null}  pollutant     Primary pollutant (e.g. 'PM2.5', 'O3')
 * @property {string|null}  color         Hex color for UI rendering
 * @property {boolean}      is_noteworthy True if AQI warrants user attention (>= 101)
 * @property {string}       provider      Provider identifier (e.g. 'AIRNOW')
 * @property {string|null}  fetchedAt     ISO 8601 timestamp of fetch, or null if unavailable
 */

// ── Alerts ──────────────────────────────────────────────

/**
 * @typedef {Object} Alert
 * @property {string}   id          Alert identifier
 * @property {string}   event       Alert event type (e.g. 'Wind Advisory')
 * @property {string}   severity    'minor' | 'moderate' | 'severe' | 'extreme' | 'unknown'
 * @property {string}   headline    Short headline
 * @property {string}   description Full description (truncated)
 * @property {string}   instruction Protective action guidance
 * @property {string}   onset       ISO 8601 onset time
 * @property {string}   expires     ISO 8601 expiry time
 * @property {string[]} areas       Affected area names
 */

/**
 * @typedef {Object} AlertResult
 * @property {Alert[]} alerts    Active alerts, ordered by severity
 * @property {string}  provider  Provider identifier (e.g. 'NOAA')
 * @property {string}  fetchedAt ISO 8601 timestamp of fetch
 */

// ── Generic Provider Result ─────────────────────────────

/**
 * @typedef {Object} ProviderResult
 * @property {*}                                        data      Provider-specific payload
 * @property {'cache'|'live'|'error'|'unavailable'}     source    How the data was obtained
 * @property {string|null}                              fetchedAt ISO 8601 timestamp, or null
 * @property {string}                                   provider  Provider identifier
 */

module.exports = {
  // Exported as empty object — this file exists for JSDoc type definitions.
  // Import it for IDE type-checking:
  //   const { WeatherResult } = require('./providerInterfaces'); // (JSDoc only)
};
