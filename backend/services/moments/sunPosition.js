/**
 * Where the sun is in the sky for a place and a moment (NOAA's general solar position formula, good to about a degree,
 * which is plenty for drawing a shadow). Used by the Moments map's "float by day" (flag `moment_float`): both phones
 * draw their shadows from this one answer, so they agree.
 *
 * @param {number} latitude  degrees north
 * @param {number} longitude degrees east (west is negative)
 * @param {Date} [when]      the moment, default now
 * @returns {{ azimuth_deg: number, elevation_deg: number }} azimuth clockwise from true north (0 to 360) and height
 *   above the horizon (negative once the sun has set), each rounded to 0.1 degree.
 */
function sunPosition(latitude, longitude, when = new Date()) {
  const start = Date.UTC(when.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((when.getTime() - start) / 86400000) + 1;
  const hour = when.getUTCHours() + when.getUTCMinutes() / 60 + when.getUTCSeconds() / 3600;
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  const minutesFast = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const declination = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const solarMinutes = hour * 60 + minutesFast + 4 * longitude;
  const hourAngle = ((solarMinutes / 4 - 180) * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  const cosZenith = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
  const elevation = 90 - (zenith * 180) / Math.PI;
  const azimuth = (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat))
    * 180) / Math.PI + 180;
  const round = (value) => Math.round(value * 10) / 10;
  return { azimuth_deg: round(((azimuth % 360) + 360) % 360), elevation_deg: round(elevation) };
}

module.exports = { sunPosition };
