'use strict';
// Massachusetts: MassGIS's standard extract of all 351 assessors' lists, and the City of Boston's own file, which is
// public domain (PDDL) and also has bedrooms, baths, heat and roof. MassGIS adds what its towns report, one fiscal year
// per town, so a town's values can be years behind another's and each record says its own year. A value here is the
// assessment; state law sets it at full and fair cash value, but it's labeled as the assessor labels it.
//
// Owner names and mailing addresses are columns of both. They're never asked for from MassGIS and never read from
// Boston's file; OWN_OCC too (owner occupancy says something about a person).

const path = require('node:path');
const { parse } = require('../../../backend/services/propertyRecords/addressKey');
const { download } = require('../lib/tables.cjs');
const { getJson, layerRows, cached } = require('../lib/services.cjs');
const { csvRows } = require('../lib/csv.cjs');
const { houseNumbers, readAddresses, year, isoDate, zipCode, realUnit, onRecord } = require('../lib/addresses.cjs');
const { positive, put, word } = require('../lib/values.cjs');
const { condoBuildings } = require('../lib/condos.cjs');
const { log } = require('../lib/log.cjs');

const LAYER = 'https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0';
const BOSTON_FILE = 'https://data.boston.gov/dataset/e02c44d2-3c64-459c-8fe2-e1ce5f38a035/resource/ee73430d-96c0-423e-ad21-c4cfb54c8961/download/fy2026-property-assessment-data_rev.csv';
const BOSTON_YEAR = 2026;
const BOSTON = 35;

// MassGIS's town numbers, by county.
const COUNTIES = {
  25001: ['Barnstable', [20, 36, 41, 55, 75, 86, 96, 126, 172, 224, 242, 261, 300, 318, 351]],
  25003: ['Berkshire', [4, 6, 22, 58, 63, 70, 90, 98, 113, 121, 132, 148, 150, 152, 193, 195, 200, 203, 209, 225, 233, 236, 249, 260, 263, 267, 283, 302, 313, 326, 341, 345]],
  25005: ['Bristol', [3, 16, 27, 72, 76, 88, 94, 95, 102, 167, 201, 211, 218, 245, 247, 265, 273, 292, 293, 334]],
  25007: ['Dukes', [62, 89, 104, 109, 221, 296, 327]],
  25009: ['Essex', [7, 9, 30, 38, 71, 92, 105, 107, 116, 119, 128, 144, 149, 163, 164, 166, 168, 180, 181, 184, 196, 205, 206, 210, 229, 252, 254, 258, 259, 262, 291, 298, 320, 324]],
  25011: ['Franklin', [13, 29, 47, 53, 66, 68, 74, 91, 106, 114, 129, 130, 154, 156, 190, 192, 204, 217, 223, 253, 268, 272, 289, 312, 319, 337]],
  25013: ['Hampden', [5, 33, 43, 59, 61, 85, 112, 120, 135, 137, 159, 161, 191, 194, 227, 256, 279, 281, 297, 306, 325, 329, 339]],
  25015: ['Hampshire', [8, 24, 60, 69, 87, 108, 111, 117, 127, 143, 183, 214, 230, 237, 275, 276, 309, 331, 340, 349]],
  25017: ['Middlesex', [2, 10, 12, 14, 19, 23, 26, 31, 37, 48, 49, 51, 56, 67, 79, 81, 93, 100, 115, 136, 139, 141, 155, 157, 158, 160, 165, 170, 174, 176, 178, 198, 207, 213, 232, 246, 269, 270, 274, 284, 286, 288, 295, 299, 301, 305, 308, 314, 315, 330, 333, 342, 344, 347]],
  25019: ['Nantucket', [197]],
  25021: ['Norfolk', [18, 25, 40, 46, 50, 65, 73, 78, 99, 101, 133, 175, 177, 187, 189, 199, 208, 220, 238, 243, 244, 266, 285, 307, 317, 335, 336, 350]],
  25023: ['Plymouth', [1, 42, 44, 52, 82, 83, 118, 122, 123, 131, 142, 145, 146, 169, 171, 173, 182, 219, 231, 239, 240, 250, 251, 264, 310, 322, 338]],
  25025: ['Suffolk', [35, 57, 248, 346]],
  25027: ['Worcester', [11, 15, 17, 21, 28, 32, 34, 39, 45, 54, 64, 77, 80, 84, 97, 103, 110, 124, 125, 134, 138, 140, 147, 151, 153, 162, 179, 185, 186, 188, 202, 212, 215, 216, 222, 226, 228, 234, 235, 241, 255, 257, 271, 277, 278, 280, 282, 287, 290, 294, 303, 304, 311, 316, 321, 323, 328, 332, 343, 348]],
};

const TOWN_NAMES = {
  1: 'Abington', 2: 'Acton', 3: 'Acushnet', 4: 'Adams', 5: 'Agawam', 6: 'Alford', 7: 'Amesbury', 8: 'Amherst', 9: 'Andover', 10: 'Arlington', 11: 'Ashburnham',
  12: 'Ashby', 13: 'Ashfield', 14: 'Ashland', 15: 'Athol', 16: 'Attleboro', 17: 'Auburn', 18: 'Avon', 19: 'Ayer', 20: 'Barnstable', 21: 'Barre', 22: 'Becket',
  23: 'Bedford', 24: 'Belchertown', 25: 'Bellingham', 26: 'Belmont', 27: 'Berkley', 28: 'Berlin', 29: 'Bernardston', 30: 'Beverly', 31: 'Billerica',
  32: 'Blackstone', 33: 'Blandford', 34: 'Bolton', 35: 'Boston', 36: 'Bourne', 37: 'Boxborough', 38: 'Boxford', 39: 'Boylston', 40: 'Braintree', 41: 'Brewster',
  42: 'Bridgewater', 43: 'Brimfield', 44: 'Brockton', 45: 'Brookfield', 46: 'Brookline', 47: 'Buckland', 48: 'Burlington', 49: 'Cambridge', 50: 'Canton',
  51: 'Carlisle', 52: 'Carver', 53: 'Charlemont', 54: 'Charlton', 55: 'Chatham', 56: 'Chelmsford', 57: 'Chelsea', 58: 'Cheshire', 59: 'Chester', 60: 'Chesterfield',
  61: 'Chicopee', 62: 'Chilmark', 63: 'Clarksburg', 64: 'Clinton', 65: 'Cohasset', 66: 'Colrain', 67: 'Concord', 68: 'Conway', 69: 'Cummington', 70: 'Dalton',
  71: 'Danvers', 72: 'Dartmouth', 73: 'Dedham', 74: 'Deerfield', 75: 'Dennis', 76: 'Dighton', 77: 'Douglas', 78: 'Dover', 79: 'Dracut', 80: 'Dudley',
  81: 'Dunstable', 82: 'Duxbury', 83: 'East Bridgewater', 84: 'East Brookfield', 85: 'East Longmeadow', 86: 'Eastham', 87: 'Easthampton', 88: 'Easton',
  89: 'Edgartown', 90: 'Egremont', 91: 'Erving', 92: 'Essex', 93: 'Everett', 94: 'Fairhaven', 95: 'Fall River', 96: 'Falmouth', 97: 'Fitchburg', 98: 'Florida',
  99: 'Foxborough', 100: 'Framingham', 101: 'Franklin', 102: 'Freetown', 103: 'Gardner', 104: 'Aquinnah', 105: 'Georgetown', 106: 'Gill', 107: 'Gloucester',
  108: 'Goshen', 109: 'Gosnold', 110: 'Grafton', 111: 'Granby', 112: 'Granville', 113: 'Great Barrington', 114: 'Greenfield', 115: 'Groton', 116: 'Groveland',
  117: 'Hadley', 118: 'Halifax', 119: 'Hamilton', 120: 'Hampden', 121: 'Hancock', 122: 'Hanover', 123: 'Hanson', 124: 'Hardwick', 125: 'Harvard', 126: 'Harwich',
  127: 'Hatfield', 128: 'Haverhill', 129: 'Hawley', 130: 'Heath', 131: 'Hingham', 132: 'Hinsdale', 133: 'Holbrook', 134: 'Holden', 135: 'Holland', 136: 'Holliston',
  137: 'Holyoke', 138: 'Hopedale', 139: 'Hopkinton', 140: 'Hubbardston', 141: 'Hudson', 142: 'Hull', 143: 'Huntington', 144: 'Ipswich', 145: 'Kingston',
  146: 'Lakeville', 147: 'Lancaster', 148: 'Lanesborough', 149: 'Lawrence', 150: 'Lee', 151: 'Leicester', 152: 'Lenox', 153: 'Leominster', 154: 'Leverett',
  155: 'Lexington', 156: 'Leyden', 157: 'Lincoln', 158: 'Littleton', 159: 'Longmeadow', 160: 'Lowell', 161: 'Ludlow', 162: 'Lunenburg', 163: 'Lynn',
  164: 'Lynnfield', 165: 'Malden', 166: 'Manchester-By-The-Sea', 167: 'Mansfield', 168: 'Marblehead', 169: 'Marion', 170: 'Marlborough', 171: 'Marshfield',
  172: 'Mashpee', 173: 'Mattapoisett', 174: 'Maynard', 175: 'Medfield', 176: 'Medford', 177: 'Medway', 178: 'Melrose', 179: 'Mendon', 180: 'Merrimac',
  181: 'Methuen', 182: 'Middleborough', 183: 'Middlefield', 184: 'Middleton', 185: 'Milford', 186: 'Millbury', 187: 'Millis', 188: 'Millville', 189: 'Milton',
  190: 'Monroe', 191: 'Monson', 192: 'Montague', 193: 'Monterey', 194: 'Montgomery', 195: 'Mount Washington', 196: 'Nahant', 197: 'Nantucket', 198: 'Natick',
  199: 'Needham', 200: 'New Ashford', 201: 'New Bedford', 202: 'New Braintree', 203: 'New Marlborough', 204: 'New Salem', 205: 'Newbury', 206: 'Newburyport',
  207: 'Newton', 208: 'Norfolk', 209: 'North Adams', 210: 'North Andover', 211: 'North Attleborough', 212: 'North Brookfield', 213: 'North Reading',
  214: 'Northampton', 215: 'Northborough', 216: 'Northbridge', 217: 'Northfield', 218: 'Norton', 219: 'Norwell', 220: 'Norwood', 221: 'Oak Bluffs', 222: 'Oakham',
  223: 'Orange', 224: 'Orleans', 225: 'Otis', 226: 'Oxford', 227: 'Palmer', 228: 'Paxton', 229: 'Peabody', 230: 'Pelham', 231: 'Pembroke', 232: 'Pepperell',
  233: 'Peru', 234: 'Petersham', 235: 'Phillipston', 236: 'Pittsfield', 237: 'Plainfield', 238: 'Plainville', 239: 'Plymouth', 240: 'Plympton', 241: 'Princeton',
  242: 'Provincetown', 243: 'Quincy', 244: 'Randolph', 245: 'Raynham', 246: 'Reading', 247: 'Rehoboth', 248: 'Revere', 249: 'Richmond', 250: 'Rochester',
  251: 'Rockland', 252: 'Rockport', 253: 'Rowe', 254: 'Rowley', 255: 'Royalston', 256: 'Russell', 257: 'Rutland', 258: 'Salem', 259: 'Salisbury',
  260: 'Sandisfield', 261: 'Sandwich', 262: 'Saugus', 263: 'Savoy', 264: 'Scituate', 265: 'Seekonk', 266: 'Sharon', 267: 'Sheffield', 268: 'Shelburne',
  269: 'Sherborn', 270: 'Shirley', 271: 'Shrewsbury', 272: 'Shutesbury', 273: 'Somerset', 274: 'Somerville', 275: 'South Hadley', 276: 'Southampton',
  277: 'Southborough', 278: 'Southbridge', 279: 'Southwick', 280: 'Spencer', 281: 'Springfield', 282: 'Sterling', 283: 'Stockbridge', 284: 'Stoneham',
  285: 'Stoughton', 286: 'Stow', 287: 'Sturbridge', 288: 'Sudbury', 289: 'Sunderland', 290: 'Sutton', 291: 'Swampscott', 292: 'Swansea', 293: 'Taunton',
  294: 'Templeton', 295: 'Tewksbury', 296: 'Tisbury', 297: 'Tolland', 298: 'Topsfield', 299: 'Townsend', 300: 'Truro', 301: 'Tyngsborough', 302: 'Tyringham',
  303: 'Upton', 304: 'Uxbridge', 305: 'Wakefield', 306: 'Wales', 307: 'Walpole', 308: 'Waltham', 309: 'Ware', 310: 'Wareham', 311: 'Warren', 312: 'Warwick',
  313: 'Washington', 314: 'Watertown', 315: 'Wayland', 316: 'Webster', 317: 'Wellesley', 318: 'Wellfleet', 319: 'Wendell', 320: 'Wenham', 321: 'West Boylston',
  322: 'West Bridgewater', 323: 'West Brookfield', 324: 'West Newbury', 325: 'West Springfield', 326: 'West Stockbridge', 327: 'West Tisbury', 328: 'Westborough',
  329: 'Westfield', 330: 'Westford', 331: 'Westhampton', 332: 'Westminster', 333: 'Weston', 334: 'Westport', 335: 'Westwood', 336: 'Weymouth', 337: 'Whately',
  338: 'Whitman', 339: 'Wilbraham', 340: 'Williamsburg', 341: 'Williamstown', 342: 'Wilmington', 343: 'Winchendon', 344: 'Winchester', 345: 'Windsor',
  346: 'Winthrop', 347: 'Woburn', 348: 'Worcester', 349: 'Worthington', 350: 'Wrentham', 351: 'Yarmouth',
};

const COLUMNS = ['TOWN_ID', 'PROP_ID', 'BLDG_VAL', 'LAND_VAL', 'TOTAL_VAL', 'FY', 'LOT_SIZE', 'LOT_UNITS', 'LS_DATE', 'LS_PRICE', 'LS_BOOK', 'LS_PAGE', 'USE_CODE', 'USE_DESC', 'SITE_ADDR',
  'ADDR_NUM', 'FULL_STR', 'LOCATION', 'CITY', 'ZIP', 'ZONING', 'YEAR_BUILT', 'BLD_AREA', 'RES_AREA', 'UNITS', 'STYLE', 'STORIES', 'NUM_ROOMS'];

// The state's property type classification codes (its first three characters; towns add a fourth).
const USES = {
  101: ['property', 'house', 'Single family'], 102: ['unit', 'condo', 'Condominium'], 103: ['property', 'mobile_home', 'Mobile home'], 104: ['building', 'multi_unit', 'Two family'],
  105: ['building', 'multi_unit', 'Three family'], 106: ['parcel', null, 'Accessory land with improvement'], 109: ['property', 'house', 'Several houses on one parcel'], 111: ['building', 'apartment', 'Apartments, 4 to 8 units'],
  112: ['building', 'apartment', 'Apartments, more than 8 units'], 114: ['building', 'apartment', 'Affordable housing'], 130: ['parcel', null, 'Developable residential land'],
  131: ['parcel', null, 'Potentially developable residential land'], 132: ['parcel', null, 'Undevelopable residential land'],
};
function useOf(code) {
  const digits = /^\d{3}/.exec(String(code ?? '').trim());
  return digits ? digits[0] : '';
}

const STORIES_TEXT = /^(\d{1,3}(?:\.\d)?)(?:\s*(?:STORY|STORIES|STY|ST))?$/i;
function storiesFrom(value) {
  const text = String(value ?? '').trim().replace(/\s*1\/2/, '.5');
  const match = STORIES_TEXT.exec(text);
  const count = match ? Number(match[1]) : 0;
  return count > 0 && count <= 120 ? count : null;
}
// Towns write some styles as their own codes. Only a word goes on a screen.
const styleWord = (value) => {
  const text = word(value);
  return text && /^[A-Za-z][A-Za-z /&-]{3,}$/.test(text) ? text : null;
};

function fromMassGis(row, fips, county, town) {
  const code = useOf(row.USE_CODE);
  const [kind, homeType, useWord] = USES[code] || ['other', null, null];
  const facts = { parcel_number: row.PROP_ID, county, fips, municipality: town };
  const on = kind !== 'parcel' && kind !== 'other';
  const unit = realUnit(row.LOCATION);
  put(facts, 'address_on_record', onRecord(row.SITE_ADDR, unit));
  put(facts, 'year_built', on ? year(row.YEAR_BUILT) : null);
  // Several houses on one parcel: the area is theirs together, not this home's.
  put(facts, 'living_sqft', on && code !== '109' ? positive(row.RES_AREA) : null);
  put(facts, 'gross_sqft', on ? positive(row.BLD_AREA) : null);
  put(facts, 'rooms', on && kind !== 'building' ? positive(row.NUM_ROOMS) : null);
  put(facts, 'stories', on ? storiesFrom(row.STORIES) : null);
  put(facts, 'style', on ? styleWord(row.STYLE) : null);
  if (kind === 'building') put(facts, 'units', positive(row.UNITS));
  if (kind !== 'unit') {
    const size = positive(row.LOT_SIZE);
    const lotUnits = String(row.LOT_UNITS ?? '').trim().charAt(0).toUpperCase();
    if (lotUnits === 'A') put(facts, 'lot_acres', size);
    if (lotUnits === 'S') put(facts, 'lot_sqft', size);
  }
  put(facts, 'zoning', word(row.ZONING));
  put(facts, 'land_use', useWord || word(row.USE_DESC));
  put(facts, 'county_use_code', word(row.USE_CODE));
  put(facts, 'value_year', positive(row.FY));
  put(facts, 'assessed_value', positive(row.TOTAL_VAL));
  put(facts, 'assessed_land_value', positive(row.LAND_VAL));
  put(facts, 'assessed_building_value', positive(row.BLDG_VAL));
  const sold = isoDate(row.LS_DATE);
  if (positive(row.LS_PRICE) > 100 && sold) {
    facts.sale_price = positive(row.LS_PRICE);
    facts.sale_date = sold;
    if (word(row.LS_BOOK) && word(row.LS_PAGE)) facts.sale_document = `Book ${word(row.LS_BOOK)}, Page ${word(row.LS_PAGE)}`;
  }
  const street = String(row.FULL_STR ?? '').trim();
  let addresses = readAddresses(houseNumbers(row.ADDR_NUM), street, unit);
  if (!addresses.length) addresses = [parse(row.SITE_ADDR, unit)].filter(Boolean);
  if (!kind || !addresses.length) return [];
  const id = `pp:${kind}:${fips}:${row.TOWN_ID}-${row.PROP_ID}`;
  const city = word(row.CITY)?.toUpperCase() || town.toUpperCase();
  const zip = zipCode(row.ZIP);
  return addresses.map((address) => ({ id, kind, home_type: homeType, address: { ...address, city, zip }, facts }));
}

// Boston's land use codes (its data key).
const BOSTON_USES = {
  R1: ['property', 'house', 'Single family'], R2: ['building', 'multi_unit', 'Two family'], R3: ['building', 'multi_unit', 'Three family'], R4: ['building', 'multi_unit', 'Four to six family'],
  A: ['building', 'apartment', 'Apartments, seven units or more'], CD: ['unit', 'condo', 'Condominium'], CM: ['building', 'condo', 'Condominium main'], RL: ['parcel', null, 'Residential land'],
};
const BOSTON_COLUMNS = ['PID', 'CM_ID', 'ST_NUM', 'ST_ALPHA', 'ST_NUM2', 'ST_NAME', 'UNIT_NUM', 'CITY', 'ZIP_CODE', 'NUM_BLDGS', 'LU', 'LU_DESC', 'BLDG_TYPE', 'RES_FLOOR', 'RES_UNITS', 'LAND_SF', 'GROSS_AREA',
  'LIVING_AREA', 'LAND_VALUE', 'BLDG_VALUE', 'TOTAL_VALUE', 'GROSS_TAX', 'YR_BUILT', 'STRUCTURE_CLASS', 'ROOF_STRUCTURE', 'ROOF_COVER', 'EXT_FNISHED', 'OVERALL_COND', 'BED_RMS', 'FULL_BTH', 'HLF_BTH', 'TT_RMS',
  'HEAT_TYPE', 'HEAT_SYSTEM', 'AC_TYPE', 'FIREPLACES', 'NUM_PARKING'];

// "A - Asphalt Shingl" is code and words; the file's column widths cut some words short, so those read whole here.
const BOSTON_WORDS = { 'Asphalt Shingl': 'Asphalt shingle', 'Ht Water/Steam': 'Hot water or steam', 'Forced Hot Air': 'Forced hot air', 'Reinf Concr': 'Reinforced concrete', 'Brick/Concr': 'Brick or concrete', 'Struct Steel': 'Structural steel', 'Wood/Frame': 'Wood frame' };
function bostonWord(value) {
  const match = /^\s*\S{1,3}\s+-\s+(.+?)\s*$/.exec(String(value ?? ''));
  const text = match ? match[1] : null;
  if (!text || /^(None|Other)$/i.test(text)) return null;
  return BOSTON_WORDS[text] || text;
}

function fromBoston(row, fips, county) {
  const code = String(row.LU ?? '').split(' ')[0].trim();
  const [kind, homeType, useWord] = BOSTON_USES[code] || ['other', null, null];
  const facts = { parcel_number: row.PID, county, fips, municipality: 'Boston', land_use: useWord || word(row.LU_DESC) || null };
  if (!facts.land_use) delete facts.land_use;
  const building = kind === 'building';
  const home = kind === 'property' || kind === 'unit';
  const street = String(row.ST_NAME ?? '').trim();
  const first = `${String(row.ST_NUM ?? '').trim()}${String(row.ST_ALPHA ?? '').trim()}`;
  const last = Number(row.ST_NUM2) > Number(row.ST_NUM) ? String(Number(row.ST_NUM2)) : null;
  put(facts, 'address_on_record', onRecord(`${first} ${street}`, row.UNIT_NUM));
  put(facts, 'year_built', kind !== 'parcel' && kind !== 'other' ? year(row.YR_BUILT) : null);
  put(facts, 'living_sqft', home ? positive(row.LIVING_AREA) : null);
  put(facts, 'gross_sqft', kind !== 'parcel' && kind !== 'other' ? positive(row.GROSS_AREA) : null);
  put(facts, 'stories', kind !== 'parcel' && kind !== 'other' && kind !== 'unit' ? positive(row.RES_FLOOR) : null);
  put(facts, 'style', kind !== 'parcel' && kind !== 'other' ? bostonWord(row.BLDG_TYPE) : null);
  if (building) put(facts, 'units', positive(row.RES_UNITS));
  if (kind !== 'unit') put(facts, 'lot_sqft', positive(row.LAND_SF));
  put(facts, 'buildings_on_parcel', kind !== 'unit' ? positive(row.NUM_BLDGS) : null);
  if (home) {
    put(facts, 'rooms', positive(row.TT_RMS));
    put(facts, 'bedrooms', positive(row.BED_RMS));
    const [full, half] = [positive(row.FULL_BTH), positive(row.HLF_BTH)];
    put(facts, 'full_baths', full);
    put(facts, 'half_baths', half);
    if (full || half) facts.bathrooms = (full || 0) + (half || 0) * 0.5;
    put(facts, 'fireplaces', positive(row.FIREPLACES));
    put(facts, 'parking_spaces', positive(row.NUM_PARKING));
    put(facts, 'condition', bostonWord(row.OVERALL_COND));
    put(facts, 'heating', bostonWord(row.HEAT_TYPE));
    const air = bostonWord(row.AC_TYPE);
    put(facts, 'cooling', air);
  }
  if (kind !== 'parcel' && kind !== 'other') {
    put(facts, 'frame', bostonWord(row.STRUCTURE_CLASS));
    put(facts, 'roof_shape', bostonWord(row.ROOF_STRUCTURE));
    put(facts, 'roof_cover', bostonWord(row.ROOF_COVER));
    put(facts, 'exterior_walls', bostonWord(row.EXT_FNISHED));
  }
  facts.value_year = BOSTON_YEAR;
  facts.tax_year = BOSTON_YEAR;
  const money = (text) => positive(String(text ?? '').replace(/[$,\s]/g, ''));
  put(facts, 'assessed_value', money(row.TOTAL_VALUE));
  put(facts, 'assessed_land_value', money(row.LAND_VALUE));
  put(facts, 'assessed_building_value', money(row.BLDG_VALUE));
  put(facts, 'tax_amount', money(row.GROSS_TAX));

  const addresses = readAddresses(last ? [first, last] : [first], street, realUnit(row.UNIT_NUM));
  if (!addresses.length) return [];
  const id = kind === 'building' && code === 'CM' ? `pp:building:${fips}:${row.PID}` : `pp:${kind}:${fips}:${row.PID}`;
  const parent = code === 'CD' && word(row.CM_ID) ? `pp:building:${fips}:${row.CM_ID}` : null;
  return addresses.map((address) => ({
    id,
    kind,
    home_type: homeType,
    address: { ...address, unit: code === 'CM' ? '' : address.unit, building: '', city: word(row.CITY)?.toUpperCase() || 'BOSTON', zip: zipCode(row.ZIP_CODE) },
    facts,
    ...(parent ? { parent } : {}),
  }));
}

/** A complex's main record lists its units, as a county's own roster would. */
function linkBostonCondos(records) {
  const mains = new Map(records.filter((record) => record.kind === 'building' && record.home_type === 'condo').map((record) => [record.id, record]));
  for (const record of records) {
    if (record.kind !== 'unit' || !record.parent) continue;
    const main = mains.get(record.parent);
    if (!main) {
      delete record.parent;
      continue;
    }
    (main.rosterSet ||= new Set()).add(record.address.unit);
  }
  for (const main of mains.values()) {
    if (main.rosterSet) {
      main.roster = [...main.rosterSet].filter(Boolean).sort();
      main.facts = { ...main.facts, units_in_condominium: main.rosterSet.size };
      delete main.rosterSet;
    }
  }
}

async function* build({ work }) {
  const info = await getJson(`${LAYER}?f=json`, 'The layer\'s description');
  const edited = isoDate(info.editingInfo?.dataLastEditDate || info.editingInfo?.lastEditDate);
  if (!edited) throw new Error('The layer no longer says when it changed');
  const only = (process.env.PROPERTY_INDEX_ONLY || '').split(',').filter(Boolean);
  const towns = await getJson(`${LAYER.replace(/FeatureServer\/0$/, '')}FeatureServer/0/query?${new URLSearchParams({ where: '1=1', outFields: 'TOWN_ID', returnDistinctValues: 'true', returnGeometry: 'false', f: 'json' })}`, 'The layer\'s towns');
  const mapped = new Set(Object.values(COUNTIES).flatMap(([, ids]) => ids));
  const unknown = (towns.features || []).map((feature) => feature.attributes.TOWN_ID).filter((id) => id && !mapped.has(id));
  if (unknown.length) throw new Error(`${unknown.length} town numbers aren't in this connector's table`);

  for (const [fips, [name, ids]] of Object.entries(COUNTIES)) {
    if (only.length && !only.includes(fips)) continue;
    const county = `${name} County`;
    const records = [];
    const seen = new Set();
    let unreadable = 0;
    const townIds = ids.filter((id) => id !== BOSTON);
    const rows = cached(path.join(work, 'ma-massgis', `${fips}.jsonl.gz`), () => layerRows(LAYER, COLUMNS, { where: `TOWN_ID IN (${townIds.join(',')})` }));
    for await (const row of rows) {
      if (!word(row.PROP_ID)) continue;
      const made = fromMassGis(row, fips, county, TOWN_NAMES[row.TOWN_ID] || '');
      if (!made.length) unreadable += 1;
      for (const record of made) {
        const key = `${record.id}|${record.address.number}`;
        if (seen.has(key)) continue;
        seen.add(key);
        records.push(record);
      }
    }
    log(`${county}: ${records.length} records, ${unreadable} without a readable address`);
    const hasBoston = ids.includes(BOSTON);
    if (hasBoston) {
      const file = path.join(work, 'ma-massgis', 'boston.csv');
      download(BOSTON_FILE, file);
      const boston = [];
      for await (const row of csvRows(file, BOSTON_COLUMNS)) boston.push(...fromBoston(row, fips, county));
      linkBostonCondos(boston);
      log(`Boston: ${boston.length} records`);
      for (const record of boston) records.push(record);
    }
    // Boston says which main record a unit belongs to; the towns' files don't, so their units group by street number.
    const towned = records.filter((record) => !(record.kind === 'unit' && record.parent));
    for (const building of condoBuildings(towned, { fips, county })) records.push(building);
    yield {
      fips, state: 'MA', name: county, publisher: hasBoston ? 'MassGIS and the City of Boston' : 'MassGIS', dataset: 'assessors\' parcel data', method: 'state', source: 'ma-massgis', title: 'State records',
      as_of: edited, stale_after_days: 540, records,
    };
  }
}

module.exports = { build };
