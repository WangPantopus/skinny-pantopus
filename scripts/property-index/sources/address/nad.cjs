'use strict';
// The U.S. DOT National Address Database: the states' and counties' address points, compiled about quarterly.
// https://data.transportation.gov/dataset/National-Address-Database-NAD-Text-File/fc2s-wawr (about 8.5 GB, 99 million rows).
// Rights: rights.cjs. Only the columns below are read; rows are in file order, grouped by state.

const path = require('node:path');
const { download, zipTable, zipMembers } = require('../../lib/tables.cjs');

const DOWNLOAD_URL = 'https://data.transportation.gov/download/fc2s-wawr/application%2Fx-zip-compressed';
const COLUMNS = ['AddNum_Pre', 'AddNo_Full', 'St_PreMod', 'St_PreDir', 'St_PreTyp', 'St_PreSep', 'St_Name', 'St_PosTyp', 'St_PosDir', 'St_PosMod', 'Building', 'Floor', 'Unit', 'Room', 'SubAddress',
  'Post_City', 'Inc_Muni', 'Urbnztn_PR', 'State', 'Zip_Code', 'UUID', 'Longitude', 'Latitude', 'Placement', 'AddrClass', 'Lifecycle', 'Expire', 'Addr_Type', 'DateUpdate'];

// How the point was placed, as the publisher says. Lower is better for a pin.
const PLACEMENT = [
  [/rooftop/i, 'rooftop'], [/entrance/i, 'entrance'], [/structure/i, 'structure'], [/site/i, 'site'], [/property access|driveway|access/i, 'access'],
  [/parcel/i, 'parcel'], [/geocod|linear|interpolat/i, 'geocoded'],
];
const NOT_A_PLACE = /^(not stated|none|unknown|n\/?a|null|unincorporated|no name|0+)$/i;
const NOT_CURRENT = /retired|deleted|demolish|expired|inactive|proposed|temporary/i;
// Intersections and landmarks have no house number; a range is many houses.
const NOT_AN_ADDRESS = /intersection|range|landmark|community|general delivery|po box/i;

const words = (...values) => values.filter(Boolean).join(' ');
const place = (value) => (value && !NOT_A_PLACE.test(value) ? value : '');

/**
 * The house number as published, read once where a county also copied it into the prefix: NAD joins the two, so Kittitas WA's
 * 123 arrives as "123-123" (39,853 of its 40,155 rows in release 24, 22 rows elsewhere). Queens and Hawaii number houses with a
 * hyphen, so a number there stays as it is.
 */
function houseNumber(row) {
  const pre = (row.AddNum_Pre || '').trim();
  const full = (row.AddNo_Full || '').trim();
  return pre && full === `${pre}-${pre}` && row.State !== 'NY' && row.State !== 'HI' ? pre : row.AddNo_Full;
}

function asOf() {
  // The file's description states its date; the release number in the member name is what changes.
  return process.env.NAD_AS_OF || '2026-09-30';
}

/**
 * One row of the registry's source shape per address in the file.
 * @param {object} options { work: where the download goes; states: Set of state codes, or null for all }
 */
async function* rows({ work, states = null }) {
  const zip = path.join(work, 'nad', 'TXT.zip');
  download(DOWNLOAD_URL, zip);
  // Zip64 and Deflate64: the Linux unzip reads it; the Mac's doesn't.
  const member = zipMembers(zip).find((name) => /NAD.*\.txt$/i.test(name));
  if (!member) throw new Error('The NAD zip no longer has its text file');
  const today = new Date().toISOString().slice(0, 10);
  for await (const row of zipTable(zip, member, COLUMNS, { encoding: 'utf8' })) {
    // A row naming no state is placed by its point (build-registry.cjs).
    if (states && row.State && !states.has(row.State)) continue;
    if (NOT_AN_ADDRESS.test(row.AddrClass) || NOT_CURRENT.test(row.Lifecycle)) continue;
    if (row.Expire && row.Expire.slice(0, 10) < today && /^\d{4}-/.test(row.Expire)) continue;
    const quality = PLACEMENT.find(([pattern]) => pattern.test(row.Placement));
    yield {
      source: 'nad',
      record: row.UUID,
      state: row.State,
      number: houseNumber(row),
      pre: row.St_PreDir,
      name: words(row.St_PreMod, row.St_PreTyp, row.St_PreSep, row.St_Name, row.St_PosMod),
      suffix: row.St_PosTyp,
      post: row.St_PosDir,
      unit: row.Unit || row.Room || (row.Floor ? `FL ${row.Floor}` : '') || row.SubAddress,
      building: row.Building,
      urbanization: place(row.Urbnztn_PR),
      city: place(row.Post_City) || place(row.Inc_Muni),
      zip: row.Zip_Code,
      lng: Number(row.Longitude),
      lat: Number(row.Latitude),
      quality: quality ? quality[1] : 'unknown',
      use: /resid/i.test(row.Addr_Type) ? 'residential' : /commer|industr|business/i.test(row.Addr_Type) ? 'commercial' : '',
    };
  }
}

module.exports = { id: 'nad', rows, asOf };
