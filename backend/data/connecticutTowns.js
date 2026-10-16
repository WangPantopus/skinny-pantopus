/**
 * Connecticut's 169 towns and the county each one belonged to before 2022.
 *
 * In 2022 the Census Bureau replaced Connecticut's eight counties with nine
 * planning regions (FIPS 09110–09190), so the geocoder now places a
 * Connecticut point in a planning region. Two national datasets still use
 * the old counties: EPA's Map of Radon Zones (CountyRadonZone) and EPA's
 * drinking-water records (SDWIS county_served). A planning region crosses
 * old county lines, and its towns can sit in different radon zones, so a
 * Connecticut point is matched through its town instead.
 *
 * Source, fetched October 15, 2026: U.S. Census Bureau,
 * www2.census.gov/geo/docs/reference/ct_change/ct_cou_to_cousub_crosswalk.txt
 * (county subdivision FIPS → old county FIPS; town codes did not change).
 */

// County subdivision (town) FIPS → old county FIPS.
const TOWN_LEGACY_COUNTY = {
  '01080': '09013', // Andover town
  '01220': '09009', // Ansonia town
  '01430': '09015', // Ashford town
  '02060': '09003', // Avon town
  '02760': '09005', // Barkhamsted town
  '03250': '09009', // Beacon Falls town
  '04300': '09003', // Berlin town
  '04580': '09009', // Bethany town
  '04720': '09001', // Bethel town
  '04930': '09005', // Bethlehem town
  '05910': '09003', // Bloomfield town
  '06260': '09013', // Bolton town
  '06820': '09011', // Bozrah town
  '07310': '09009', // Branford town
  '08070': '09001', // Bridgeport town
  '08210': '09005', // Bridgewater town
  '08490': '09003', // Bristol town
  '08980': '09001', // Brookfield town
  '09190': '09015', // Brooklyn town
  '10100': '09003', // Burlington town
  '10940': '09005', // Canaan town
  '12130': '09015', // Canterbury town
  '12270': '09003', // Canton town
  '13810': '09015', // Chaplin town
  '14160': '09009', // Cheshire town
  '14300': '09007', // Chester town
  '15350': '09007', // Clinton town
  '15910': '09011', // Colchester town
  '16050': '09005', // Colebrook town
  '16400': '09013', // Columbia town
  '17240': '09005', // Cornwall town
  '17800': '09013', // Coventry town
  '18080': '09007', // Cromwell town
  '18500': '09001', // Danbury town
  '18850': '09001', // Darien town
  '19130': '09007', // Deep River town
  '19550': '09009', // Derby town
  '20810': '09007', // Durham town
  '21860': '09015', // Eastford town
  '22070': '09003', // East Granby town
  '22280': '09007', // East Haddam town
  '22490': '09007', // East Hampton town
  '22630': '09003', // East Hartford town
  '22910': '09009', // East Haven town
  '23400': '09011', // East Lyme town
  '23890': '09001', // Easton town
  '24800': '09003', // East Windsor town
  '25360': '09013', // Ellington town
  '25990': '09003', // Enfield town
  '26270': '09007', // Essex town
  '26620': '09001', // Fairfield town
  '27600': '09003', // Farmington town
  '29910': '09011', // Franklin town
  '31240': '09003', // Glastonbury town
  '32290': '09005', // Goshen town
  '32640': '09003', // Granby town
  '33620': '09001', // Greenwich town
  '33900': '09011', // Griswold town
  '34250': '09011', // Groton town
  '34950': '09009', // Guilford town
  '35230': '09007', // Haddam town
  '35650': '09009', // Hamden town
  '36000': '09015', // Hampton town
  '37070': '09003', // Hartford town
  '37140': '09003', // Hartland town
  '37280': '09005', // Harwinton town
  '37910': '09013', // Hebron town
  '40290': '09005', // Kent town
  '40500': '09015', // Killingly town
  '40710': '09007', // Killingworth town
  '42390': '09011', // Lebanon town
  '42600': '09011', // Ledyard town
  '43230': '09011', // Lisbon town
  '43370': '09005', // Litchfield town
  '44210': '09011', // Lyme town
  '44560': '09009', // Madison town
  '44700': '09003', // Manchester town
  '44910': '09013', // Mansfield town
  '45820': '09003', // Marlborough town
  '46520': '09009', // Meriden town
  '46940': '09009', // Middlebury town
  '47080': '09007', // Middlefield town
  '47360': '09007', // Middletown town
  '47535': '09009', // Milford town
  '48620': '09001', // Monroe town
  '48900': '09011', // Montville town
  '49460': '09005', // Morris town
  '49950': '09009', // Naugatuck town
  '50440': '09003', // New Britain town
  '50580': '09001', // New Canaan town
  '50860': '09001', // New Fairfield town
  '51350': '09005', // New Hartford town
  '52070': '09009', // New Haven town
  '52140': '09003', // Newington town
  '52350': '09011', // New London town
  '52630': '09005', // New Milford town
  '52980': '09001', // Newtown town
  '53470': '09005', // Norfolk town
  '53890': '09009', // North Branford town
  '54030': '09005', // North Canaan town
  '54870': '09009', // North Haven town
  '55500': '09011', // North Stonington town
  '56060': '09001', // Norwalk town
  '56270': '09011', // Norwich town
  '57040': '09011', // Old Lyme town
  '57320': '09007', // Old Saybrook town
  '57600': '09009', // Orange town
  '58300': '09009', // Oxford town
  '59980': '09015', // Plainfield town
  '60120': '09003', // Plainville town
  '60750': '09005', // Plymouth town
  '61030': '09015', // Pomfret town
  '61800': '09007', // Portland town
  '62150': '09011', // Preston town
  '62290': '09009', // Prospect town
  '62710': '09015', // Putnam town
  '63480': '09001', // Redding town
  '63970': '09001', // Ridgefield town
  '65370': '09003', // Rocky Hill town
  '65930': '09005', // Roxbury town
  '66210': '09011', // Salem town
  '66420': '09005', // Salisbury town
  '67400': '09015', // Scotland town
  '67610': '09009', // Seymour town
  '67960': '09005', // Sharon town
  '68170': '09001', // Shelton town
  '68310': '09001', // Sherman town
  '68940': '09003', // Simsbury town
  '69220': '09013', // Somers town
  '69640': '09009', // Southbury town
  '70550': '09003', // Southington town
  '71390': '09003', // South Windsor town
  '71670': '09011', // Sprague town
  '72090': '09013', // Stafford town
  '73070': '09001', // Stamford town
  '73420': '09015', // Sterling town
  '73770': '09011', // Stonington town
  '74190': '09001', // Stratford town
  '74540': '09003', // Suffield town
  '75730': '09005', // Thomaston town
  '75870': '09015', // Thompson town
  '76290': '09013', // Tolland town
  '76570': '09005', // Torrington town
  '77200': '09001', // Trumbull town
  '77830': '09013', // Union town
  '78250': '09013', // Vernon town
  '78600': '09011', // Voluntown town
  '78740': '09009', // Wallingford town
  '79510': '09005', // Warren town
  '79720': '09005', // Washington town
  '80070': '09009', // Waterbury town
  '80280': '09011', // Waterford town
  '80490': '09005', // Watertown town
  '81680': '09007', // Westbrook town
  '82590': '09003', // West Hartford town
  '82870': '09009', // West Haven town
  '83430': '09001', // Weston town
  '83500': '09001', // Westport town
  '84900': '09003', // Wethersfield town
  '85950': '09013', // Willington town
  '86370': '09001', // Wilton town
  '86440': '09005', // Winchester town
  '86790': '09015', // Windham town
  '87000': '09003', // Windsor town
  '87070': '09003', // Windsor Locks town
  '87560': '09009', // Wolcott town
  '87700': '09009', // Woodbridge town
  '87910': '09005', // Woodbury town
  '88190': '09015', // Woodstock town
};

// The names EPA's records use for the old counties.
const LEGACY_COUNTY_NAMES = {
  '09001': 'Fairfield',
  '09003': 'Hartford',
  '09005': 'Litchfield',
  '09007': 'Middlesex',
  '09009': 'New Haven',
  '09011': 'New London',
  '09013': 'Tolland',
  '09015': 'Windham',
};

const PLANNING_REGION = /^091[1-9]0$/;

function isConnecticutPlanningRegion(countyFips) {
  return PLANNING_REGION.test(String(countyFips || ''));
}

// The old county for a town, or null when the code isn't one of the 169.
function legacyCountyForTown(townFips) {
  const fips = TOWN_LEGACY_COUNTY[String(townFips || '')];
  return fips ? { county_fips: fips, county_name: LEGACY_COUNTY_NAMES[fips] } : null;
}

module.exports = { isConnecticutPlanningRegion, legacyCountyForTown };
