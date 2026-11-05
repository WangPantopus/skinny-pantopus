# Free property data in US counties

Measured November 5, 2026, to answer: can Pantopus show ATTOM-style property details from public sources nationwide? The 150 largest counties (172.9 million people, 50.8% of the US, Census 2024 estimates) were checked one by one; the rest of the country is estimated from a 100-county population-weighted sample (see "National estimate" below).

**Nationally:** about 53% of Americans (range 49-58%) live where the county or state publishes building facts free in bulk, and about 21% (range 19-24%) where that free data includes bedrooms and bathrooms. About a third live where only per-property lookup sites exist and resellers sell the county file.

## Result

| Category | Counties | People | Share of these counties' people |
|---|---:|---:|---:|
| Free, with bedrooms/baths | 36 | 57.9M | 33.5% |
| Free, basics only | 70 | 70.3M | 40.7% |
| One city only | 4 | 4.1M | 2.4% |
| Paid or permission | 8 | 14.0M | 8.1% |
| Not found | 9 | 10.6M | 6.1% |
| Not checked | 23 | 16.0M | 9.2% |

- **Free, with bedrooms/baths:** a free download or open map service has building facts that include bedrooms and/or bathrooms, usually with year built and size.
- **Free, basics only:** year built and/or building size (often also value and sale price), but no bedroom or bathroom fields found.
- **One city only:** only the main city publishes; the rest of the county was not found.
- **Paid or permission:** sold, subscription, or written permission required.
- **Not found:** lookup website or parcels only; no free building facts found.
- **Not checked:** not reached in this pass.

Evidence levels: *Checked in the data* = column names (and for some, fill counts) read from the live service today; *Official page* = the publisher's own page describes the fields; *Seen in a re-published copy* = a city or consultant layer re-publishing the county's data shows the fields (the county source itself still needs confirming); *Known dataset* = an existing dataset not opened today.

## Statewide sources

- **Connecticut:** statewide CAMA file (2026): bedrooms, baths, year built, living area, sales. data.ct.gov.
- **New York:** state public parcels layer: year built, living sq ft, bedrooms, full baths, heat and fuel type for counties that share. Filled on 86% of Erie parcels; NYC has year built and size but no bedrooms; Nassau and Monroe are absent; Suffolk covers about 14%.
- **Maryland:** SDAT statewide: year built (about 83 to 92% filled in the five largest), structure sq ft, stories, units, sale consideration. No bedrooms.
- **Massachusetts:** MassGIS statewide: year built, living area, units, style, rooms, stories, last sale. No bedrooms; some towns (Boston, Cambridge) publish them.
- **New Jersey:** MOD-IV statewide: year built and sale price, no building size or bedrooms.
- **Florida:** Department of Revenue rolls for every county: year built, living area, sale prices. No bedrooms.
- **Utah:** state parcel layers: year built, building sq ft. No sale prices (non-disclosure state).
- **Texas:** statewide parcels carry year built only; each appraisal district publishes its own export. No sale prices.
- **Idaho:** statewide improvements table has bedroom, bath, garage and fireplace columns, but Ada County leaves them empty.
- **Indiana:** state tax agency improvement files (year built, size) by email request.

States where sale prices are not public: Texas, Utah, Idaho, New Mexico, Kansas, Missouri.

## All 150 counties

| # | County | State | People | Category | Evidence | What is there | Source |
|---:|---|---|---:|---|---|---|---|
| 1 | Los Angeles County | California | 9.76M | Free, with bedrooms/baths | Checked in the data | County parcel map service has year built, main sq ft, bedrooms, bathrooms, last sale | LA County Parcel Map Service (lacounty_isd) + county open data |
| 2 | Cook County | Illinois | 5.18M | Free, with bedrooms/baths | Checked in the data | Assessor open data: bedrooms, full/half baths, year built, building sq ft (updated 2026-11-01) | datacatalog.cookcountyil.gov |
| 3 | Harris County | Texas | 5.01M | Free, with bedrooms/baths | Official page | Free public data files; codebook lists bedrooms, bathrooms, fireplaces, stories (no sale prices in Texas) | hcad.org public data (pdata) |
| 4 | Maricopa County | Arizona | 4.67M | Free, basics only | Checked in the data | County GIS: year built, living area, stories, bath fixtures, pool, heat, sale price; no bedrooms. Full assessor data sold under Arizona commercial-purpose rules | gis.maricopa.gov Parcel service |
| 5 | San Diego County | California | 3.30M | Free, with bedrooms/baths | Seen in a re-published copy | SanGIS parcels carry year, bedrooms, baths, garage, pool (seen in re-published copies); SanGIS download has its own license | SanGIS parcels |
| 6 | Orange County | California | 3.17M | Paid or permission | Official page | No public bulk; Assessor points to ParcelQuest (paid) | ocassessor.gov |
| 7 | Miami-Dade County | Florida | 2.84M | Free, with bedrooms/baths | Seen in a re-published copy | County open data Property Point View reportedly has bedroom/bath counts (weekly); official bulk file $50 each; state roll free | Miami-Dade open data + FL DOR |
| 8 | Dallas County | Texas | 2.66M | Free, basics only | Official page | Free DCAD data files for all accounts; bedroom fields not confirmed (no sale prices in Texas) | dallascad.org Data Products |
| 9 | Kings County | New York | 2.62M | Free, basics only | Checked in the data | NY State public parcels: year built 96%, living sq ft; no bedrooms for NYC | NYS Tax Parcels Public + NYC PLUTO |
| 10 | Riverside County | California | 2.53M | Free, with bedrooms/baths | Checked in the data | County open data: year built, living area, bedroom count, bath count | gis.countyofriverside.us Parcels |
| 11 | Clark County | Nevada | 2.40M | Paid or permission | Official page | Assessor sells residential extract (weekly); GIS subscription $7,500/yr | clarkcountynv.gov assessor data files |
| 12 | King County | Washington | 2.34M | Free, with bedrooms/baths | Seen in a re-published copy | Weekly assessor downloads incl. residential building (bedrooms, baths); license forbids redistribution without permission | King County Assessor data download |
| 13 | Queens County | New York | 2.32M | Free, basics only | Checked in the data | NY State public parcels (year built, living sq ft; no bedrooms for NYC) | NYS Tax Parcels Public |
| 14 | Tarrant County | Texas | 2.23M | Free, with bedrooms/baths | Seen in a re-published copy | Free full property data set; Fort Worth re-publication shows bedroom and bath counts (no sale prices in Texas) | tad.org data downloads |
| 15 | San Bernardino County | California | 2.21M | Paid or permission | Official page | Assessor data sale files and vendors; data for internal use | arc.sbcounty.gov |
| 16 | Bexar County | Texas | 2.13M | Free, basics only | Checked in the data | County GIS parcels: year built, gross building area, stories, rooms; BCAD sells data (no sale prices in Texas) | maps.bexar.org Parcels |
| 17 | Broward County | Florida | 2.04M | Free, with bedrooms/baths | Checked in the data | County GIS layers: bedrooms, baths, year built, building sq ft | Broward County GIS (BCGIS) |
| 18 | Santa Clara County | California | 1.93M | Paid or permission | Official page | Assessor sells data files incl. property characteristics (order form) | sccassessor.org |
| 19 | Wayne County | Michigan | 1.77M | One city only | Checked in the data | Detroit only: year built, floor area, sale price; rest of Wayne County not found | Detroit open data parcels |
| 20 | Middlesex County | Massachusetts | 1.67M | Free, basics only | Checked in the data | MassGIS statewide: year built, living area, units, style, rooms, stories, last sale; some towns publish bedrooms too | MassGIS Property Tax Parcels |
| 21 | New York County | New York | 1.66M | Free, basics only | Checked in the data | NY State public parcels (no bedrooms for NYC) | NYS Tax Parcels Public |
| 22 | Alameda County | California | 1.65M | Paid or permission | Official page | Characteristics (incl. bed/bath) sold to the public for a fee | acgov.org assessor records |
| 23 | Sacramento County | California | 1.61M | Not found | Official page | No official bulk; county GIS parcel data restricted; vendors only | saccounty.gov |
| 24 | Palm Beach County | Florida | 1.58M | Free, basics only | Official page | State roll free; county data files for a fee | FL DOR NAL + pbcpao.gov |
| 25 | Hillsborough County | Florida | 1.58M | Free, basics only | Official page | State roll free; county bulk not found | FL DOR NAL |
| 26 | Philadelphia County | Pennsylvania | 1.57M | Free, with bedrooms/baths | Known dataset, not checked today | OPA properties dataset (bedrooms, bathrooms, year built, livable area); not field-checked today | OpenDataPhilly OPA properties |
| 27 | Suffolk County | New York | 1.54M | Not found | Checked in the data | NY State public layer covers only ~14% of Suffolk parcels; county bulk not found | NYS Tax Parcels Public (partial) |
| 28 | Orange County | Florida | 1.53M | Free, basics only | Official page | State roll free; county bulk not found | FL DOR NAL |
| 29 | Nassau County | New York | 1.39M | Not found | Official page | Lookup site only; not in NY State public layer | lrv.nassaucountyny.gov |
| 30 | Bronx County | New York | 1.38M | Free, basics only | Checked in the data | NY State public parcels (no bedrooms for NYC) | NYS Tax Parcels Public |
| 31 | Travis County | Texas | 1.36M | Free, basics only | Official page | Whole appraisal roll export free (PACS layout with improvement detail); bedroom fields not confirmed (no sale prices in Texas) | traviscad.org |
| 32 | Franklin County | Ohio | 1.36M | Free, with bedrooms/baths | Checked in the data | County Auditor GIS: year built, building area, bedrooms, baths, sale price | gis.franklincountyohio.gov |
| 33 | Oakland County | Michigan | 1.30M | Free, with bedrooms/baths | Checked in the data | County Tax Parcel Plus: bedrooms, baths, living area (no year built) | gisservices.oakgov.com |
| 34 | Hennepin County | Minnesota | 1.27M | Free, basics only | Checked in the data | County parcels: year built, sale price/date, market value (no size) | gis.hennepin.us LAND_PROPERTY |
| 35 | Collin County | Texas | 1.25M | Free, basics only | Checked in the data | Collin CAD on Texas Open Data: year built, main area (no sale prices in Texas) | data.texas.gov Collin CAD |
| 36 | Cuyahoga County | Ohio | 1.24M | Free, basics only | Checked in the data | County open data parcels: residential living area, rooms, sale amount (no year built in layer) | gis.cuyahogacounty.gov Open_Data_Parcels |
| 37 | Wake County | North Carolina | 1.23M | Free, basics only | Checked in the data | County parcels: year built, heated area, sale price | maps.wakegov.com Parcels |
| 38 | Allegheny County | Pennsylvania | 1.23M | Free, with bedrooms/baths | Known dataset, not checked today | WPRDC property assessments (bedrooms, full/half baths, year built, finished area); not field-checked today | WPRDC Allegheny assessments |
| 39 | Salt Lake County | Utah | 1.22M | Free, basics only | Checked in the data | State LIR parcels: year built, building sq ft (no sale prices in Utah) | UGRC Parcels_SaltLake_LIR |
| 40 | Mecklenburg County | North Carolina | 1.21M | Free, with bedrooms/baths | Seen in a re-published copy | Free Tax Parcels with CAMA Data; Charlotte re-publication shows bedrooms, baths, heated area, year built, fireplaces | maps.mecknc.gov open data |
| 41 | Contra Costa County | California | 1.17M | Free, basics only | Checked in the data | County assessment parcels: year built, building sq ft | gis.cccounty.us CCMAP |
| 42 | Fairfax County | Virginia | 1.16M | Free, with bedrooms/baths | Official page | Real Estate Dwelling Data CSV: year built, bedrooms, bathrooms, style | Fairfax County open data |
| 43 | Fulton County | Georgia | 1.09M | Not found | Checked in the data | Open tax parcels have no building facts | gismaps.fultoncountyga.gov |
| 44 | Montgomery County | Maryland | 1.08M | Free, basics only | Checked in the data | Maryland SDAT statewide: year built (~92%), structure sq ft, stories, units, sale consideration | MD iMAP Property Data |
| 45 | Pima County | Arizona | 1.08M | Not found | Official page | Parcels free; no building-facts bulk found | Pima County geospatial portal |
| 46 | Duval County | Florida | 1.06M | Free, basics only | Official page | State roll free; county bulk not checked | FL DOR NAL |
| 47 | Denton County | Texas | 1.05M | Not checked | - | Not checked (Fort Worth layers with bed/bath counts come from Tarrant data; Denton CAD itself not checked) | - |
| 48 | Fresno County | California | 1.02M | Not checked | - | Not checked (California assessors usually sell bulk data) | - |
| 49 | Westchester County | New York | 1.01M | Free, with bedrooms/baths | Checked in the data | County tax parcels: year built, living sq ft, bedrooms, full baths | giswww.westchestergov.com |
| 50 | Gwinnett County | Georgia | 1.00M | Not found | Official page | Bulk file has ownership and values only | gwinnettcounty.com |
| 51 | Honolulu County | Hawaii | 1.00M | Not found | Official page | Weekly value/ownership tables; no building facts found | Honolulu HOLIS |
| 52 | St. Louis County | Missouri | 0.99M | Not found | Official page | No official bulk; vendors only | - |
| 53 | Capitol Planning Region | Connecticut | 0.99M | Free, with bedrooms/baths | Checked in the data | Connecticut statewide CAMA 2026: bedrooms, baths, year built, living area, sales | data.ct.gov |
| 54 | Marion County | Indiana | 0.98M | Free, basics only | Official page | Indiana DLGF statewide improvement files (year built, size) by email request | Indiana DLGF / Gateway |
| 55 | Bergen County | New Jersey | 0.98M | Free, basics only | Checked in the data | NJ MOD-IV statewide: year built, sale price, values (no size, no bedrooms) | maps.nj.gov Cadastral |
| 56 | Prince George's County | Maryland | 0.97M | Free, basics only | Checked in the data | Maryland SDAT + county property data: year built, structure sq ft, sale price | MD iMAP + county open data |
| 57 | Pinellas County | Florida | 0.97M | Free, basics only | Official page | State roll free; county points to state files | FL DOR NAL |
| 58 | Fort Bend County | Texas | 0.96M | Free, basics only | Checked in the data | County layer: year built, total living area (no sale prices in Texas) | Fort Bend County Residential Value Assessment |
| 59 | Erie County | New York | 0.95M | Free, with bedrooms/baths | Checked in the data | NY State public parcels: year built 86%, bedrooms 81% | NYS Tax Parcels Public |
| 60 | Pierce County | Washington | 0.94M | Free, basics only | Official page | Free weekly pipe-delimited downloads; fields not confirmed | piercecountywa.gov Data Downloads |
| 61 | DuPage County | Illinois | 0.94M | Paid or permission | Official page | County data requires written permission (FOIA-based use limits) | gis.dupageco.org |
| 62 | Milwaukee County | Wisconsin | 0.92M | One city only | Checked in the data | City of Milwaukee only: year built, building area, bedrooms, baths | City of Milwaukee open data |
| 63 | Kern County | California | 0.92M | Not found | Checked in the data | County GIS assessor layer has land only | KernGIS |
| 64 | Hidalgo County | Texas | 0.91M | Free, basics only | Seen in a re-published copy | Appraisal-district facts in city layers: year built, living area (no sale prices in Texas) | Hidalgo CAD via city copies |
| 65 | Shelby County | Tennessee | 0.91M | Paid or permission | Official page | County parcel services restricted to ReGIS participants; vendors | gis.shelbycountytn.gov |
| 66 | Middlesex County | New Jersey | 0.89M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 67 | Macomb County | Michigan | 0.89M | Not checked | - | Not checked (Michigan: local assessing units) | - |
| 68 | Essex County | New Jersey | 0.88M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 69 | Worcester County | Massachusetts | 0.88M | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 70 | Montgomery County | Pennsylvania | 0.88M | Free, with bedrooms/baths | Checked in the data | County parcels: year built, finished living area, bedrooms, baths | Montgomery County PA GIS (Montco_GIS) |
| 71 | El Paso County | Texas | 0.88M | Free, basics only | Official page | Free certified export files with published layouts; bedroom fields not confirmed (no sale prices in Texas) | epcad.org Open Government |
| 72 | Snohomish County | Washington | 0.86M | Free, basics only | Official page | Assessment roll CSV free 3x/week; improvement file not confirmed | Snohomish County open data |
| 73 | Lee County | Florida | 0.86M | Free, with bedrooms/baths | Checked in the data | County parcels: bedrooms, bathrooms, heated area, year built, sale amounts | Lee County GIS |
| 74 | Polk County | Florida | 0.85M | Free, basics only | Official page | State roll free; county bulk not checked | FL DOR NAL |
| 75 | Baltimore County | Maryland | 0.85M | Free, basics only | Checked in the data | Maryland SDAT + county GIS: year built, structure sq ft | MD iMAP + bcgisdata |
| 76 | Hamilton County | Ohio | 0.84M | Free, basics only | Checked in the data | County open data: year built, sq ft | CAGIS open data (Hamilton County Auditor) |
| 77 | Ventura County | California | 0.84M | Not checked | - | Not checked (California assessors usually sell bulk data) | - |
| 78 | San Francisco County | California | 0.83M | Free, with bedrooms/baths | Known dataset, not checked today | Assessor secured property tax data published; historic rolls include bedrooms, baths, year built, area; not field-checked today | sf.gov secured property tax data |
| 79 | Essex County | Massachusetts | 0.82M | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 80 | Oklahoma County | Oklahoma | 0.82M | Not checked | - | Not checked | - |
| 81 | San Joaquin County | California | 0.82M | Not checked | - | Not checked (California assessors usually sell bulk data) | - |
| 82 | Multnomah County | Oregon | 0.80M | Free, basics only | Checked in the data | Taxlots: year built, building sq ft, sale price | Metro RLIS / county taxlots |
| 83 | Jefferson County | Kentucky | 0.79M | Paid or permission | Official page | PVA commercial subscription billed monthly | jeffersonpva.ky.gov |
| 84 | Suffolk County | Massachusetts | 0.79M | One city only | Checked in the data | Boston only: year built, gross area, bedroom/bath fields; rest of county has MassGIS basics | BostonGIS Property Assessment FY25 |
| 85 | Cobb County | Georgia | 0.79M | Not checked | - | Not checked | - |
| 86 | DeKalb County | Georgia | 0.77M | Free, basics only | Checked in the data | County tax parcels: year built, building area | DeKalb County GIS |
| 87 | El Paso County | Colorado | 0.75M | Free, basics only | Official page | Assessor parcel and sales downloads free; bedroom fields not confirmed | assessor.elpasoco.com |
| 88 | Monroe County | New York | 0.75M | Free, with bedrooms/baths | Checked in the data | Monroe County Parcels: year built, living sq ft, bedrooms, full baths | Monroe County Parcels (PlanningDesign) |
| 89 | Montgomery County | Texas | 0.75M | Free, basics only | Checked in the data | County GIS MCAD view: year built, main area (no sale prices in Texas) | Montgomery County TX GIS |
| 90 | Utah County | Utah | 0.75M | Free, basics only | Checked in the data | State LIR parcels: year built, building sq ft (no sale prices in Utah) | UGRC LIR |
| 91 | San Mateo County | California | 0.74M | Not checked | - | Not checked (city copies show county bed/bath fields; California assessors usually sell bulk data) | - |
| 92 | Norfolk County | Massachusetts | 0.74M | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 93 | Hudson County | New Jersey | 0.74M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 94 | Davidson County | Tennessee | 0.73M | Not checked | - | Not checked | - |
| 95 | Denver County | Colorado | 0.73M | Free, with bedrooms/baths | Known dataset, not checked today | Denver residential characteristics dataset (bedrooms, baths, year built, area); not field-checked today | Denver open data |
| 96 | Williamson County | Texas | 0.73M | Free, with bedrooms/baths | Checked in the data | WCAD open data: bedrooms, plumbing, year built, main area (no sale prices in Texas) | data.wcad.org |
| 97 | Jackson County | Missouri | 0.73M | Free, with bedrooms/baths | Seen in a re-published copy | County assessment fields in a city layer: bedrooms, baths, effective year, floor area (no sale prices in Missouri) | Jackson County via City of Independence |
| 98 | Lake County | Illinois | 0.72M | Free, basics only | Official page | Open data assessment by address (2022); fields not confirmed | Lake County IL open data |
| 99 | Will County | Illinois | 0.71M | Free, basics only | Seen in a re-published copy | City layer of county data: year built, square footage | Will County via City of Joliet |
| 100 | District of Columbia | District of Columbia | 0.70M | Free, with bedrooms/baths | Checked in the data | DC CAMA: year built, living area, bedrooms, bathrooms, sale price | DC GIS open data |
| 101 | Tulsa County | Oklahoma | 0.69M | Not checked | - | Not checked | - |
| 102 | Providence County | Rhode Island | 0.68M | Not checked | - | Not checked (Rhode Island: city assessors) | - |
| 103 | Kent County | Michigan | 0.67M | Not checked | - | Not checked (Michigan: local assessing units) | - |
| 104 | Bernalillo County | New Mexico | 0.67M | Not checked | - | Not checked (no sale prices in New Mexico) | - |
| 105 | Arapahoe County | Colorado | 0.67M | Free, basics only | Seen in a re-published copy | Assessor sales file free; year built, building sq ft seen in re-published layers | Arapahoe County assessor |
| 106 | Ocean County | New Jersey | 0.67M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 107 | Jefferson County | Alabama | 0.66M | Not checked | - | Not checked | - |
| 108 | Pasco County | Florida | 0.66M | Free, basics only | Official page | State roll free | FL DOR NAL |
| 109 | Brevard County | Florida | 0.66M | Free, basics only | Official page | State roll free | FL DOR NAL |
| 110 | Bucks County | Pennsylvania | 0.65M | Free, with bedrooms/baths | Seen in a re-published copy | Re-published county parcels: year built, sq ft, bedrooms, full baths, sale price | Bucks County data (third-party copy) |
| 111 | Monmouth County | New Jersey | 0.65M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 112 | Western Connecticut Planning Region | Connecticut | 0.64M | Free, with bedrooms/baths | Checked in the data | Connecticut statewide CAMA 2026 | data.ct.gov |
| 113 | Johnson County | Kansas | 0.63M | Free, basics only | Seen in a re-published copy | County data in city layers: year built, area (no sale prices in Kansas) | Johnson County AIMS |
| 114 | Washington County | Oregon | 0.61M | Free, basics only | Checked in the data | Taxlots: year built, building sq ft, sale price | Metro RLIS |
| 115 | Volusia County | Florida | 0.60M | Free, basics only | Official page | State roll free; county database download page exists (fields not confirmed) | FL DOR NAL + vcpa.vcgov.org |
| 116 | Anne Arundel County | Maryland | 0.60M | Free, basics only | Checked in the data | Maryland SDAT statewide | MD iMAP |
| 117 | Douglas County | Nebraska | 0.60M | Free, basics only | Seen in a re-published copy | Re-published county data: building year built, building sq ft | Douglas County NE (third-party copy) |
| 118 | Union County | New Jersey | 0.59M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 119 | Bristol County | Massachusetts | 0.59M | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 120 | Dane County | Wisconsin | 0.59M | One city only | Checked in the data | City of Madison only: year built, living area, bedrooms, full baths | City of Madison open data |
| 121 | New Castle County | Delaware | 0.59M | Free, with bedrooms/baths | Checked in the data | County parcels: year built, main floor area, bedrooms, full baths | gis.nccde.org |
| 122 | Delaware County | Pennsylvania | 0.58M | Not checked | - | Not checked | - |
| 123 | Jefferson County | Colorado | 0.58M | Free, basics only | Checked in the data | County parcels: year built, sq ft | mapservices2.jeffco.us |
| 124 | South Central Connecticut Planning Region | Connecticut | 0.58M | Free, with bedrooms/baths | Checked in the data | Connecticut statewide CAMA 2026 | data.ct.gov |
| 125 | Greenville County | South Carolina | 0.57M | Not checked | - | Not checked (an old third-party copy shows bed/bath fields) | - |
| 126 | Baltimore city | Maryland | 0.57M | Free, basics only | Checked in the data | Maryland SDAT + city real property data | MD iMAP + baltegis |
| 127 | Lancaster County | Pennsylvania | 0.56M | Not checked | - | Not checked | - |
| 128 | Chester County | Pennsylvania | 0.56M | Free, basics only | Checked in the data | County parcels: sq ft, last sale price | Chester County PA GIS |
| 129 | Guilford County | North Carolina | 0.56M | Free, with bedrooms/baths | Seen in a re-published copy | Regional GIS ParcelsOnline: year built, bedrooms, full baths, sale price | maps.regisnc.org |
| 130 | Stanislaus County | California | 0.56M | Not checked | - | Not checked (a consultant copy shows bed/bath fields; California assessors usually sell bulk data) | - |
| 131 | Spokane County | Washington | 0.56M | Not checked | - | Not checked | - |
| 132 | Adams County | Colorado | 0.54M | Free, with bedrooms/baths | Checked in the data | County Property Improvements: year built, sq ft, bedrooms, baths | Adams County CO GIS |
| 133 | Plymouth County | Massachusetts | 0.54M | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 134 | Ramsey County | Minnesota | 0.54M | Free, with bedrooms/baths | Checked in the data | County assessor parcel data: bedrooms, full/half baths, year built, sale price | data.ramseycountymn.gov |
| 135 | Summit County | Ohio | 0.54M | Free, basics only | Seen in a re-published copy | County tax parcels in city layers: year built, building area | Summit County fiscal office |
| 136 | Montgomery County | Ohio | 0.54M | Free, with bedrooms/baths | Seen in a re-published copy | County auditor fields in a city layer: living area, bedrooms, bath fixtures, sale price | Montgomery County OH auditor |
| 137 | Sedgwick County | Kansas | 0.54M | Not checked | - | Not checked (no sale prices in Kansas) | - |
| 138 | Ada County | Idaho | 0.54M | Free, basics only | Seen in a re-published copy | Re-published county parcels: year built (no sale prices in Idaho) | Ada County (third-party copy) |
| 139 | Camden County | New Jersey | 0.53M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 140 | Clark County | Washington | 0.53M | Free, with bedrooms/baths | Checked in the data | Full assessor ZIP checked: bedrooms, baths, heat, roof, walls, garage, sales history | Clark County WA PACS open data |
| 141 | Passaic County | New Jersey | 0.53M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 142 | Morris County | New Jersey | 0.52M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 143 | Kane County | Illinois | 0.52M | Not checked | - | Not checked (no county open data found) | - |
| 144 | Polk County | Iowa | 0.52M | Not checked | - | Not checked | - |
| 145 | Pinal County | Arizona | 0.51M | Free, basics only | Seen in a re-published copy | City layer of county data: year built, building area, sale price | Pinal County via City of Maricopa |
| 146 | Washoe County | Nevada | 0.51M | Free, with bedrooms/baths | Checked in the data | County parcels: year built, sq ft, bedrooms, baths, sale price | Washoe County GIS |
| 147 | Knox County | Tennessee | 0.51M | Not checked | - | Not checked | - |
| 148 | Lake County | Indiana | 0.50M | Free, basics only | Official page | Indiana DLGF statewide improvement files by request | Indiana DLGF |
| 149 | Richmond County | New York | 0.50M | Free, basics only | Checked in the data | NY State public parcels (no bedrooms for NYC) | NYS Tax Parcels Public |
| 150 | Prince William County | Virginia | 0.50M | Free, basics only | Checked in the data | County Parcel CAMA Public: above-grade sq ft | gisweb.pwcva.gov |

## Method and limits

- Counties ranked by Census 2024 population estimates.
- Automated scans of Socrata (4,197 datasets) and ArcGIS Online (2,009 services intersecting the counties), reading each dataset's column names; then targeted web searches and direct reads of county map services and assessor downloads.
- A column existing is not proof it is filled. Fill counts were taken for New York, Maryland, Idaho and Clark County WA only.
- Free does not mean unrestricted. King County forbids redistribution without permission; SanGIS has its own license; DuPage requires written permission; Arizona requires a commercial-purpose declaration for records requests; Washington bars commercial use of lists of individuals (owner names). Each source needs a terms check before use.
- The other 2,994 counties are estimated from a 100-county sample in the section below.

## National estimate (added November 5, 2026)

The other 2994 counties hold 167.2 million people (49.2% of the US). I drew 100 of them at random with probability proportional to population (systematic sampling ordered by state, seed 20261105), so each draw stands for 1.67 million people, and checked each one: automated ArcGIS scan, statewide sources, then a web search of the county's own sites. A county counts as free only if it or its state publishes building facts in bulk; per-property lookup websites do not count.

| Category | Rest of the US (sample of 100) | 95% range | Whole US (top 150 measured + sample) |
|---|---:|---:|---:|
| Free, with bedrooms/baths | 8% | 4-15% | 20.9% (71M people) |
| Free, basics only | 24% | 17-33% | 32.5% (110M people) |
| Free download, building fields not confirmed | 5% | 2-11% | 2.5% (8M people) |
| Partial (one city or sold homes only) | 1% | 0-5% | 1.7% (6M people) |
| Paid or permission | 2% | 1-7% | 5.1% (17M people) |
| Not found (lookup sites, resellers) | 60% | 50-69% | 32.6% (111M people) |
| Not checked | 0% | 0-4% | 4.7% (16M people) |
| **Free building facts (first two rows)** | **32%** | 24-42% | **53.4%** (range 49-58%) |

What the smaller counties look like:
- Most "free" results there come from statewide files (Florida, Texas year built, Maryland, Massachusetts, New Jersey, New York, Utah, Minnesota opt-in counties, Maine, West Virginia, Montana year built, Indiana by request). County-level free files with bedrooms/baths were found in Deschutes OR, Bradley TN, Charlottesville VA, Rockland and Broome NY (state layer), and in re-published copies for Northampton PA, Skagit WA and Madison VA.
- "Not found" counties usually run a per-property lookup site (often a vendor platform such as qPublic, Spatialest, Vision or Image Mate) while resellers sell the county's parcel file, typically $200-$300 per county. The data exists; free bulk access does not. Many could be obtained through public-records requests (cost and commercial-use terms vary by state).
- Paid or fee-based: Yolo CA (per-parcel fees), Ingham MI (enhanced-access fees).
- Limits: field presence was confirmed for statewide layers and some counties; for most small counties the evidence is the county's own site and search results. Sampling error is shown as the 95% range; the top-150 'Not checked' share (4.7% of the US) is carried separately.

## Sampled counties

| Size rank | County | State | People | Category | Evidence | What is there | Source |
|---:|---|---|---:|---|---|---|---|
| 181 | Madison County | Alabama | 423,355 | Not found (lookup sites, resellers) | Official page or search | Assessor viewer only (kcsgis); no bulk found | Madison County AL |
| 374 | Lee County | Alabama | 187,847 | Not found (lookup sites, resellers) | Official page or search | Revenue Commissioner property search only; vendors sell files | Lee County AL |
| 966 | Jackson County | Alabama | 53,780 | Not found (lookup sites, resellers) | Official page or search | Revenue Commissioner parcel viewer only | Jackson County AL |
| 3112 | Bristol Bay Borough | Alaska | 884 | Not found (lookup sites, resellers) | Official page or search | Borough assessor office; state copy is an archive; vendors | Bristol Bay Borough AK |
| 189 | Pulaski County | Arkansas | 401,209 | Not found (lookup sites, resellers) | Official page or search | No official bulk found; vendors | Pulaski County AR |
| 1057 | Crittenden County | Arkansas | 46,633 | Not found (lookup sites, resellers) | Official page or search | Assessor records and state map viewer only | Crittenden County AR |
| 153 | Tulare County | California | 483,546 | Not found (lookup sites, resellers) | Official page or search | No official bulk found (California assessors usually sell) | Tulare County CA |
| 170 | Monterey County | California | 436,251 | Not found (lookup sites, resellers) | Checked in the data | County GIS parcels have only parcel area; no official bulk found | Monterey County CA |
| 319 | Yolo County | California | 225,251 | Paid or permission | Official page or search | Residential characteristics sold per parcel at the assessor's office (fee) | Yolo County CA assessor |
| 671 | Mendocino County | California | 89,175 | Not found (lookup sites, resellers) | Official page or search | County parcel GIS is ownership only; no characteristics found | Mendocino County CA |
| 208 | Weld County | Colorado | 369,745 | Not found (lookup sites, resellers) | Official page or search | Lookup tool only; statewide composite has no building facts | Weld County CO |
| 2630 | Lake County | Colorado | 7,369 | Not found (lookup sites, resellers) | Official page or search | EagleWeb lookups and parcel viewer only | Lake County CO |
| 270 | Sussex County | Delaware | 271,134 | Not found (lookup sites, resellers) | Official page or search | County's own assessment download not found; vendors only | Sussex County DE |
| 158 | Osceola County | Florida | 468,058 | Free, basics only | Checked in the data | Florida DOR statewide roll: year built, living area, sale prices | FL DOR NAL |
| 183 | Collier County | Florida | 416,233 | Free, basics only | Checked in the data | Florida DOR statewide roll | FL DOR NAL |
| 252 | Alachua County | Florida | 291,782 | Free, basics only | Official page or search | Florida DOR statewide roll | FL DOR NAL |
| 410 | Citrus County | Florida | 170,174 | Free, basics only | Official page or search | Florida DOR statewide roll | FL DOR NAL |
| 1951 | Dixie County | Florida | 17,614 | Free, basics only | Official page or search | Florida DOR statewide roll | FL DOR NAL |
| 321 | Hall County | Georgia | 221,745 | Not found (lookup sites, resellers) | Official page or search | Tax portal and GIS viewer only; vendors | Hall County GA |
| 510 | Carroll County | Georgia | 129,911 | Not found (lookup sites, resellers) | Official page or search | qPublic lookups only; vendors | Carroll County GA |
| 786 | Spalding County | Georgia | 70,292 | Not found (lookup sites, resellers) | Official page or search | qPublic lookups only; vendors | Spalding County GA |
| 1641 | Tattnall County | Georgia | 24,275 | Not found (lookup sites, resellers) | Official page or search | qPublic lookups only; vendors | Tattnall County GA |
| 274 | Canyon County | Idaho | 266,892 | Not found (lookup sites, resellers) | Official page or search | Free GIS FTP has parcels and ownership; characteristics only via per-parcel search | Canyon County ID |
| 256 | Winnebago County | Illinois | 283,790 | Not found (lookup sites, resellers) | Official page or search | No county bulk found; vendors | Winnebago County IL |
| 476 | Rock Island County | Illinois | 142,731 | Not found (lookup sites, resellers) | Official page or search | Assessment search only; automated retrieval prohibited | Rock Island County IL |
| 1382 | Fulton County | Illinois | 32,510 | Not found (lookup sites, resellers) | Official page or search | No county bulk found; vendors | Fulton County IL |
| 268 | St. Joseph County | Indiana | 273,744 | Free, basics only | Official page or search | Indiana DLGF statewide improvement files by request (county site has lookups only) | Indiana DLGF |
| 514 | Clark County | Indiana | 127,479 | Free, basics only | Official page or search | Indiana DLGF statewide improvement files by request | Indiana DLGF |
| 1218 | Montgomery County | Indiana | 38,633 | Free, basics only | Official page or search | Indiana DLGF statewide improvement files by request | Indiana DLGF |
| 438 | Johnson County | Iowa | 160,080 | Partial (one city or sold homes only) | Checked in the data | County sales-analysis layer: bedrooms, baths, year built, area for sold homes only | Johnson County IA assessor (Sales Analysis) |
| 1966 | Madison County | Iowa | 17,161 | Not found (lookup sites, resellers) | Official page or search | Assessor property search only; vendors | Madison County IA |
| 1347 | Harvey County | Kansas | 33,642 | Not found (lookup sites, resellers) | Official page or search | Appraiser parcel search only; vendors | Harvey County KS |
| 568 | Hardin County | Kentucky | 112,826 | Not found (lookup sites, resellers) | Official page or search | PVA search on qPublic only | Hardin County KY |
| 1488 | Logan County | Kentucky | 28,467 | Not found (lookup sites, resellers) | Official page or search | PVA search only | Logan County KY |
| 165 | East Baton Rouge Parish | Louisiana | 453,022 | Not found (lookup sites, resellers) | Checked in the data | Free tax roll has values, units, structure use and transfer date but no year built or size (no sale prices in Louisiana) | data.brla.gov EBRP Tax Roll |
| 347 | Calcasieu Parish | Louisiana | 206,861 | Not found (lookup sites, resellers) | Official page or search | Assessor search only; vendors | Calcasieu Parish LA |
| 1094 | Washington Parish | Louisiana | 45,090 | Not found (lookup sites, resellers) | Official page or search | Assessor search; GIS by subscription | Washington Parish LA |
| 552 | Androscoggin County | Maine | 115,272 | Free, basics only | Checked in the data | Maine statewide organized-towns parcels: residential area, last sale price (fill not checked) | Maine GeoLibrary parcels |
| 400 | Charles County | Maryland | 174,478 | Free, basics only | Checked in the data | Maryland SDAT statewide + county parcels (year built) | MD iMAP |
| 308 | Barnstable County | Massachusetts | 232,570 | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 253 | Ingham County | Michigan | 290,427 | Paid or permission | Official page or search | County equalization sells data under an enhanced-access fee policy | Ingham County MI |
| 492 | Calhoun County | Michigan | 133,785 | Not found (lookup sites, resellers) | Official page or search | No county bulk found; vendors | Calhoun County MI |
| 1158 | Mecosta County | Michigan | 41,947 | Not found (lookup sites, resellers) | Official page or search | County equalization; no bulk found; vendors | Mecosta County MI |
| 204 | Anoka County | Minnesota | 376,840 | Free, basics only | Checked in the data | Minnesota compiled parcels: year built and finished sq ft on 85% of Anoka parcels | MnGeo plan_parcels_open |
| 800 | Crow Wing County | Minnesota | 68,642 | Not found (lookup sites, resellers) | Checked in the data | In the Minnesota compiled layer but no building facts; county layer has impervious area only | MnGeo + Crow Wing GIS |
| 331 | Harrison County | Mississippi | 213,730 | Not found (lookup sites, resellers) | Official page or search | County search; state copy of the land roll dates from 2016 | Harrison County MS |
| 1169 | Washington County | Mississippi | 41,181 | Not found (lookup sites, resellers) | Official page or search | Assessor search (Delta Computer Systems) only | Washington County MS |
| 238 | Greene County | Missouri | 307,942 | Not found (lookup sites, resellers) | Official page or search | Assessor search portal only | Greene County MO |
| 588 | Franklin County | Missouri | 107,256 | Not found (lookup sites, resellers) | Official page or search | Assessor search and GIS map only; vendors | Franklin County MO |
| 1702 | Morgan County | Missouri | 22,399 | Not found (lookup sites, resellers) | Official page or search | Assessor office; no download found; vendors | Morgan County MO |
| 2318 | Carbon County | Montana | 11,498 | Free, basics only | Checked in the data | Montana statewide: earliest year built per parcel (year only) | Montana DOC |
| 912 | Carson City | Nevada | 58,148 | Not found (lookup sites, resellers) | Official page or search | Per-parcel inquiry only; Nevada's statewide parcel layer is restricted | Carson City NV |
| 1411 | Coos County | New Hampshire | 31,094 | Not found (lookup sites, resellers) | Official page or search | Municipal assessors; vendors only | Coos County NH towns |
| 263 | Atlantic County | New Jersey | 279,114 | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | NJOGIS |
| 751 | Lea County | New Mexico | 75,151 | Not found (lookup sites, resellers) | Official page or search | Assessor map viewer and GIS hub parcels; no building facts found (no sale prices in New Mexico) | Lea County NM |
| 216 | Rockland County | New York | 348,144 | Free, with bedrooms/baths | Checked in the data | NY State public parcels: year built 91%, bedrooms 68% | NYS Tax Parcels Public |
| 362 | Broome County | New York | 196,397 | Free, with bedrooms/baths | Checked in the data | NY State public parcels: year built 75%, bedrooms 69% | NYS Tax Parcels Public |
| 742 | Clinton County | New York | 77,871 | Not found (lookup sites, resellers) | Official page or search | Not in NY State public layer; Image Mate lookups only | Clinton County NY |
| 193 | Forsyth County | North Carolina | 398,143 | Not found (lookup sites, resellers) | Official page or search | Parcel viewer and lookups only; no bulk characteristics | Forsyth County NC |
| 297 | Cabarrus County | North Carolina | 244,925 | Free download, building fields not confirmed | Official page or search | County GIS offers open data downloads; building fields not confirmed (sales search shows year built and heated area) | Cabarrus County NC |
| 419 | Brunswick County | North Carolina | 167,112 | Free, basics only | Checked in the data | County tax parcels: actual year built | Brunswick County NC GIS |
| 636 | Lincoln County | North Carolina | 97,611 | Free download, building fields not confirmed | Official page or search | Free parcel attribute spreadsheet (parceldata.zip); building fields not confirmed | Lincoln County NC |
| 1087 | Davie County | North Carolina | 45,383 | Free download, building fields not confirmed | Official page or search | Free data download page and parcel sales service; building fields not confirmed | Davie County NC |
| 2103 | McKenzie County | North Dakota | 14,782 | Not found (lookup sites, resellers) | Official page or search | County GIS parcels; no building facts found | McKenzie County ND |
| 231 | Lorain County | Ohio | 322,030 | Not found (lookup sites, resellers) | Official page or search | Per-parcel auditor search shows year built and bedrooms; no bulk found | Lorain County OH |
| 377 | Medina County | Ohio | 184,625 | Free download, building fields not confirmed | Official page or search | Auditor has a Download Data page; fields not confirmed | Medina County OH |
| 659 | Tuscarawas County | Ohio | 92,048 | Not found (lookup sites, resellers) | Official page or search | Parcel shapefile from tax map office; no characteristics found | Tuscarawas County OH |
| 1152 | Fulton County | Ohio | 42,028 | Not found (lookup sites, resellers) | Official page or search | Auditor real estate search only; vendors | Fulton County OH |
| 664 | Wagoner County | Oklahoma | 91,257 | Not found (lookup sites, resellers) | Official page or search | Assessor search (Spatialest) only | Wagoner County OK |
| 2388 | Johnston County | Oklahoma | 10,293 | Not found (lookup sites, resellers) | Official page or search | Assessor portal only | Johnston County OK |
| 337 | Deschutes County | Oregon | 211,535 | Free, with bedrooms/baths | Checked in the data | County taxlots: year built, bedrooms, bathrooms, garage sq ft | Deschutes County GIS |
| 156 | York County | Pennsylvania | 471,240 | Not found (lookup sites, resellers) | Official page or search | Assessment lookup site; GIS hub parcels without assessment fields found | York County PA |
| 229 | Northampton County | Pennsylvania | 322,989 | Free, with bedrooms/baths | Seen in a re-published copy | County data in a city layer: year built, living area, full/half baths, rooms, sale price and validity | Northampton County via City of Bethlehem |
| 358 | Butler County | Pennsylvania | 199,341 | Not found (lookup sites, resellers) | Official page or search | GIS maps and parcel search only; vendors | Butler County PA |
| 586 | Adams County | Pennsylvania | 107,914 | Not found (lookup sites, resellers) | Official page or search | GIS map and lookups only; vendors | Adams County PA |
| 403 | Kent County | Rhode Island | 172,450 | Not found (lookup sites, resellers) | Official page or search | Municipal assessor lookups (Vision) only | Kent County RI towns |
| 184 | Horry County | South Carolina | 413,391 | Not found (lookup sites, resellers) | Official page or search | No county bulk found; vendors | Horry County SC |
| 352 | Beaufort County | South Carolina | 201,775 | Not found (lookup sites, resellers) | Official page or search | GIS parcel search only; vendors | Beaufort County SC |
| 1447 | Williamsburg County | South Carolina | 29,865 | Not found (lookup sites, resellers) | Official page or search | Assessor site and parcel map only; vendors | Williamsburg County SC |
| 203 | Rutherford County | Tennessee | 376,996 | Not found (lookup sites, resellers) | Official page or search | Assessor GIS service has owners only (no CAMA); lookups | Rutherford County TN |
| 561 | Bradley County | Tennessee | 113,782 | Free, with bedrooms/baths | Checked in the data | County parcel layer: year built, building sq ft, bedrooms, baths, sale price | Bradley County TN GIS |
| 1106 | Fayette County | Tennessee | 44,476 | Not found (lookup sites, resellers) | Official page or search | Assessor site and state property viewer lookups only | Fayette County TN |
| 172 | Cameron County | Texas | 431,874 | Free, basics only | Official page or search | Texas statewide parcels carry year built; appraisal-district export not checked (no sale prices in Texas) | TxGIO StratMap |
| 228 | Lubbock County | Texas | 327,394 | Free, basics only | Official page or search | Texas statewide year built; CAD export not checked | TxGIO StratMap |
| 295 | Smith County | Texas | 249,091 | Free, basics only | Official page or search | Texas statewide year built; CAD export not checked | TxGIO StratMap |
| 411 | Ector County | Texas | 170,022 | Free, basics only | Official page or search | Texas statewide year built; CAD export not checked | TxGIO StratMap |
| 662 | Victoria County | Texas | 91,949 | Free, basics only | Official page or search | Texas statewide year built; CAD export not checked | TxGIO StratMap |
| 974 | Atascosa County | Texas | 52,783 | Free, basics only | Official page or search | Texas statewide year built; CAD export not checked | TxGIO StratMap |
| 1831 | Calhoun County | Texas | 19,942 | Free, basics only | Official page or search | Texas statewide year built; CAD export not checked | TxGIO StratMap |
| 344 | Washington County | Utah | 207,943 | Free, basics only | Checked in the data | Utah state LIR parcels: year built, building sq ft (no sale prices in Utah) | UGRC LIR |
| 163 | Virginia Beach city | Virginia | 454,808 | Not found (lookup sites, resellers) | Official page or search | Property search tool has bedrooms/baths/year built per parcel; no bulk download confirmed | Virginia Beach VA |
| 288 | Chesapeake city | Virginia | 254,997 | Not found (lookup sites, resellers) | Official page or search | No assessor download found | Chesapeake VA |
| 551 | Hanover County | Virginia | 115,309 | Not found (lookup sites, resellers) | Official page or search | Real estate lookups; county GIS download not confirmed | Hanover County VA |
| 1098 | Charlottesville city | Virginia | 44,767 | Free, with bedrooms/baths | Checked in the data | City open data: residential details with year built, square footage, bedrooms, full baths | Charlottesville Real Estate (Residential Details) |
| 2143 | Madison County | Virginia | 14,252 | Free, with bedrooms/baths | Seen in a re-published copy | Regional commission layer of county assessment data: year built, gross area, bedrooms, full baths, sale price | Rappahannock-Rapidan Regional Commission copy |
| 496 | Skagit County | Washington | 132,736 | Free, with bedrooms/baths | Seen in a re-published copy | County taxroll in a re-published layer: year built, living area, bedrooms, heat/AC, garage, sale price | Skagit County taxroll (third-party copy) |
| 582 | Monongalia County | West Virginia | 108,697 | Free, basics only | Seen in a re-published copy | West Virginia statewide tax parcels: year built, stories, rooms, structure area (2021 copy) | WV GIS Technical Center |
| 182 | Waukesha County | Wisconsin | 417,029 | Free download, building fields not confirmed | Official page or search | County publishes free parcel downloads with tax listing data; building fields not confirmed (state schema has none) | Waukesha County WI |
| 531 | La Crosse County | Wisconsin | 121,060 | Not found (lookup sites, resellers) | Official page or search | Older county export and statewide parcels carry assessment values only | La Crosse County WI + Wisconsin statewide parcels |
| 1109 | Douglas County | Wisconsin | 44,276 | Not found (lookup sites, resellers) | Official page or search | Wisconsin statewide parcels carry values only; city GIS for Superior | Douglas County WI |
