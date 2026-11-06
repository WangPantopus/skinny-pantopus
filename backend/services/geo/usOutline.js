'use strict';

/**
 * A coarse outline of the US, drawn just inside its land and lake borders and
 * well out to sea. Inside it a point is surely in the US, so the US venues index
 * is the whole answer there (services/geo/venues.js). The index alone can't say
 * that: Geofabrik's state extracts spill past the border (Toronto's waterfront,
 * central Tijuana), so an area it holds can be in another country.
 *
 * The two mistakes aren't equal, so it hugs the US side. A US town left outside
 * (those right on the border, the Alaska panhandle) only takes the slower path
 * that also asks Overpass. A foreign one left inside would get a partial list.
 */

// [latitude, longitude], clockwise from off Cape Flattery.
const LOWER_48 = [
  // The strait below Vancouver Island, the San Juan Islands
  [48.45, -126], [48.43, -124.75], [48.22, -124], [48.18, -123.55], [48.38, -123.12], [48.58, -123.18],
  [48.7, -123.12], [48.77, -122.9], [48.9, -122.8], [48.985, -122.7],
  // The 49th parallel, Rainy River, the Boundary Waters
  [48.985, -95.16], [48.85, -94.75], [48.68, -94.6], [48.58, -93.85], [48.57, -93.42], [48.5, -93], [48.3, -92.4],
  [48.15, -91.95], [48.02, -91.6], [47.99, -90.9], [47.99, -90.1], [47.93, -89.62],
  // Lake Superior, the St. Marys River, Lake Huron
  [47.7, -88.3], [46.75, -85], [46.5, -84.6], [46.475, -84.36], [46.4, -84.2], [46.2, -84.15], [46.03, -83.9],
  [46.02, -83.55], [45.9, -83.5], [45.3, -82.6], [44, -82.35], [43.03, -82.44],
  // The St. Clair River, Lake St. Clair, the Detroit River
  [42.97, -82.445], [42.83, -82.5], [42.72, -82.51], [42.62, -82.55], [42.47, -82.75], [42.385, -82.9],
  [42.355, -82.975], [42.335, -83.04], [42.315, -83.095], [42.27, -83.14], [42.2, -83.16], [42, -83.18],
  // Lake Erie, the Niagara River, Lake Ontario
  [41.7, -82.92], [41.64, -82.7], [41.9, -81.4], [42.3, -80.2], [42.72, -79.2], [42.87, -78.9], [42.96, -78.91],
  [43.02, -78.98], [43.07, -78.99], [43.09, -79.045], [43.17, -79.03], [43.28, -79.03], [43.5, -78.5],
  [43.6, -77.5], [43.78, -76.7],
  // The St. Lawrence, the 45th parallel
  [44.05, -76.36], [44.19, -76.12], [44.31, -75.95], [44.55, -75.68], [44.66, -75.5], [44.83, -75.22],
  [44.9, -74.9], [44.96, -74.7], [44.975, -71.52],
  // New Hampshire and Maine
  [45.2, -71.3], [45.24, -71.05], [45.33, -70.85], [45.75, -70.3], [46.38, -70], [46.66, -69.95],
  [47.12, -69.1], [47.21, -68.6], [47.3, -68.33], [47.12, -67.96], [47.03, -67.83], [46, -67.83], [45.6, -67.82],
  [45.5, -67.5], [45.17, -67.33], [44.95, -67.12], [44.85, -67.02], [44.7, -67],
  // The Atlantic, the Keys, the Gulf
  [43.5, -67.5], [41, -69], [38, -73], [35, -74.5], [31, -79], [28, -79.6], [25.9, -79.75], [25, -80],
  [24.35, -80.6], [24.35, -83.2], [26, -97], [26, -97.14],
  // The Rio Grande
  [25.93, -97.48], [26, -97.6], [26.08, -97.75], [26.1, -97.95], [26.11, -98.19], [26.14, -98.27], [26.18, -98.35],
  [26.27, -98.56], [26.4, -98.79], [26.43, -99], [26.58, -99.13], [26.92, -99.24], [27.05, -99.41], [27.25, -99.43],
  [27.42, -99.46], [27.515, -99.49], [27.72, -99.7], [27.9, -100.02], [28.25, -100.25], [28.5, -100.33],
  [28.72, -100.48], [28.95, -100.6], [29.2, -100.78], [29.35, -100.9], [29.5, -101.02], [29.85, -101.56],
  [29.88, -102], [29.88, -102.45], [29.55, -102.75], [29.3, -102.9], [29.24, -103.03], [29.06, -103.17], [29.2, -103.58],
  [29.3, -103.76], [29.48, -104], [29.6, -104.35], [30, -104.63], [30.18, -104.64], [30.64, -104.96],
  [30.86, -105.27], [31.08, -105.54], [31.32, -105.81], [31.48, -106.04], [31.62, -106.19], [31.7, -106.31],
  [31.775, -106.45], [31.775, -106.5], [31.805, -106.54],
  // New Mexico, Arizona, California, then the Pacific
  [31.805, -108.235], [31.355, -108.235], [31.355, -111.06], [32.515, -114.77], [32.6, -114.71], [32.7, -114.69],
  [32.735, -114.72], [32.549, -117.13], [32.5, -120], [40, -126.5],
];

// Boxes: [south, west, north, east]. No other country's land is inside any of them.
const BOXES = [
  [18.5, -160.6, 22.6, -154.5], // Hawaii
  [51, -168.5, 71.6, -141.2], // Alaska, between Russia and the Yukon line
  [17.8, -67.4, 18.6, -65.2], // Puerto Rico
  [17.6, -65, 17.85, -64.5], // St. Croix
  [18.27, -65.1, 18.37, -64.68], // St. Thomas and St. John, south and west of the British Virgin Islands
];

function inLower48(latitude, longitude) {
  let inside = false;
  for (let i = 0, j = LOWER_48.length - 1; i < LOWER_48.length; j = i, i += 1) {
    const [latI, lngI] = LOWER_48[i];
    const [latJ, lngJ] = LOWER_48[j];
    if ((latI > latitude) !== (latJ > latitude)
      && longitude < ((lngJ - lngI) * (latitude - latI)) / (latJ - latI) + lngI) inside = !inside;
  }
  return inside;
}

/** True when the point is inside the outline. False says nothing: it may still be in the US. */
function isSurelyInUS(latitude, longitude) {
  return inLower48(latitude, longitude) || BOXES.some(([south, west, north, east]) => latitude >= south
    && latitude <= north && longitude >= west && longitude <= east);
}

module.exports = { isSurelyInUS };
