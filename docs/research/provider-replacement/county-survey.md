# County survey: free property data in US counties

Measured November 5, 2026 (PR #3418), to answer: can Pantopus show ATTOM-style property details from public sources nationwide? The 150 largest counties (172.9 million people, 50.8% of the US, Census 2024 estimates) were checked one by one; the rest of the country is estimated from a 100-county population-weighted sample (see "National estimate" below). A second pass the same evening finished the 23 counties left unchecked, the sampled counties whose files had not been opened, and every county classified only from a re-published copy or a known dataset, at the county or state source (see "Second pass" below).

**Nationally:** about 56% of Americans (range 52-61%) live where the county or state publishes building facts free in bulk, and about 23% (range 21-27%) where that free data includes bedrooms or bathrooms. About 36% live where only per-property lookup sites exist and resellers sell the county file, and about 6% where the county sells its file or requires permission.

## Result

| Category | Counties | People | Share of these counties' people |
|---|---:|---:|---:|
| Free, with bedrooms/baths | 41 | 63.8M | 36.9% |
| Free, basics only | 68 | 67.2M | 38.9% |
| Free download, building fields not confirmed | 2 | 1.3M | 0.8% |
| One city only | 5 | 4.8M | 2.8% |
| Paid or permission | 15 | 18.7M | 10.8% |
| Not found | 19 | 17.1M | 9.9% |

- **Free, with bedrooms/baths:** a free download or open map service has building facts that include bedrooms and/or bathrooms, usually with year built and size.
- **Free, basics only:** year built and/or building size (often also value and sale price), but no bedroom or bathroom fields found.
- **Free download, building fields not confirmed:** the county offers a free file whose building fields could not be opened or confirmed.
- **One city only:** only the main city publishes; the rest of the county was not found.
- **Paid or permission:** sold, subscription, or written permission required.
- **Not found:** lookup website or parcels only; no free building facts found.

Every one of the 150 counties is now classified.

**Correction (November 5, late, accepted from the #3433 review):** Dallas County (row 8) moved from basics to bedrooms/baths. #3433 measured the appraisal district's 2026 certified files directly: bedrooms on 529,857 of 539,442 houses (98.2%), baths and living area on nearly all, and bedrooms, baths and area together on 92.1% of condos. The tables, CSVs and national estimate below include it.

Evidence levels: *Checked in the data* = column names (and for most, fill counts) read from the live service or file; *Official page* = the publisher's own page or file layout describes the fields; *Seen in a re-published copy* = a city or regional layer re-publishing the county's data shows the fields (the county source itself could not be confirmed); *Known dataset* = an existing dataset not opened. After the second pass and the Dallas correction, 102 of the 150 rest on the data itself and 48 on the publisher's own page or layout; none rests only on a copy.

## Statewide sources

- **Connecticut:** statewide CAMA file (2026): bedrooms, baths, year built, living area, sales. data.ct.gov.
- **New York:** state public parcels layer: year built, living sq ft, bedrooms, full baths, heat and fuel type for counties that share. Filled on 86% of Erie parcels; NYC has year built and size but no bedrooms; Nassau and Monroe are absent; Suffolk covers about 14%.
- **Maryland:** SDAT statewide: year built (about 83 to 92% filled in the five largest), structure sq ft, stories, units, sale consideration. No bedrooms.
- **Massachusetts:** MassGIS statewide: year built, living area, units, style, rooms, stories, last sale. No bedrooms; some towns (Boston, Cambridge) publish them.
- **New Jersey:** MOD-IV statewide: year built and sale price, no building size or bedrooms.
- **Florida:** Department of Revenue rolls for every county: year built, living area, sale prices. No bedrooms.
- **Utah:** state parcel layers: year built, building sq ft. No sale prices (non-disclosure state).
- **Texas:** statewide parcels carry year built only; each appraisal district publishes its own export (Denton's certified export and Tarrant's residential file include bedrooms and baths). No sale prices.
- **Idaho:** statewide improvements table has bedroom, bath, garage and fireplace columns, but Ada County leaves them empty (year built and size too, on all 180,120 Ada rows).
- **Indiana:** state tax agency improvement files (year built, size) by email request.
- **North Carolina:** Emergency Management's statewide building layer (5.19M buildings): year built and heated sq ft per building, but only about half the year-built values come from county parcel data (the rest are HAZUS model estimates or "estimated"). The parcel-derived share varies by county: Mecklenburg 96%, Forsyth 70%, Guilford 72%, Brunswick 74%, Cabarrus 15%, Davie and Lincoln 0%.
- **West Virginia:** statewide parcel summary from the county assessors (WV GIS Technical Center, tax year 2026): year built on 54% of 1.5M parcels, stories, style, grade, construction.
- **Values only:** Washington's statewide parcels (values and land use) and Wisconsin's statewide parcels carry no building facts.

States where sale prices are not public: Texas, Utah, Idaho, New Mexico, Kansas, Missouri.

## All 150 counties

| # | County | State | People | Category | Evidence | What is there | Source |
|---:|---|---|---:|---|---|---|---|
| 1 | Los Angeles County | California | 9.76M | Free, with bedrooms/baths | Checked in the data | County parcel map service has year built, main sq ft, bedrooms, bathrooms, last sale | LA County Parcel Map Service (lacounty_isd) + county open data |
| 2 | Cook County | Illinois | 5.18M | Free, with bedrooms/baths | Checked in the data | Assessor open data: bedrooms, full/half baths, year built, building sq ft (updated 2026-11-01) | datacatalog.cookcountyil.gov |
| 3 | Harris County | Texas | 5.01M | Free, with bedrooms/baths | Official page | Free public data files; codebook lists bedrooms, bathrooms, fireplaces, stories (no sale prices in Texas) | hcad.org public data (pdata) |
| 4 | Maricopa County | Arizona | 4.67M | Free, basics only | Checked in the data | County GIS: year built, living area, stories, bath fixtures, pool, heat, sale price; no bedrooms. Full assessor data sold under Arizona commercial-purpose rules | gis.maricopa.gov Parcel service |
| 5 | San Diego County | California | 3.30M | Free, with bedrooms/baths | Checked in the data | SanGIS parcels (county-city GIS agency, served by SANDAG; "legal recorded data provided by the County Recorders and Assessor"): living area on 975,365 of 1,088,570 parcels (90%), bedrooms, baths, effective year, garage, pool; SanGIS license applies | SanGIS parcels via geo.sandag.org |
| 6 | Orange County | California | 3.17M | Paid or permission | Official page | No public bulk; Assessor points to ParcelQuest (paid) | ocassessor.gov |
| 7 | Miami-Dade County | Florida | 2.84M | Free, with bedrooms/baths | Checked in the data | County Property Point View: bedrooms on 796,593 of 944,411 points (84%), year built 92%, baths, heated area, sale price 88% | Miami-Dade County open data (PaGISView) |
| 8 | Dallas County | Texas | 2.66M | Free, with bedrooms/baths | Checked in the data | Appraisal district's 2026 certified data files (all accounts): bedrooms on 529,857 of 539,442 houses (98.2%), baths, living area and year built on nearly all; condos carry bedrooms, baths and area together on 92.1% (measured in PR #3433's field test; no sale prices in Texas) | dallascad.org Data Products |
| 9 | Kings County | New York | 2.62M | Free, basics only | Checked in the data | NY State public parcels: year built 96%, living sq ft; no bedrooms for NYC | NYS Tax Parcels Public + NYC PLUTO |
| 10 | Riverside County | California | 2.53M | Free, with bedrooms/baths | Checked in the data | County open data: year built, living area, bedroom count, bath count | gis.countyofriverside.us Parcels |
| 11 | Clark County | Nevada | 2.40M | Paid or permission | Official page | Assessor sells residential extract (weekly); GIS subscription $7,500/yr | clarkcountynv.gov assessor data files |
| 12 | King County | Washington | 2.34M | Free, with bedrooms/baths | Checked in the data | Assessor's weekly data download, Residential Building file (Oct 31, 2026): bedrooms, full/three-quarter/half baths, year built, living sq ft, stories, grade, condition, heat; the download page requires acknowledging Washington's ban on commercial use of lists of individuals; license forbids redistribution without permission | King County Assessor Data Download |
| 13 | Queens County | New York | 2.32M | Free, basics only | Checked in the data | NY State public parcels (year built, living sq ft; no bedrooms for NYC) | NYS Tax Parcels Public |
| 14 | Tarrant County | Texas | 2.23M | Free, with bedrooms/baths | Checked in the data | Appraisal district's free certified residential property data file: bedrooms, bathrooms, year built, living area, garage, pool, central heat/air (no sale prices in Texas) | tad.org Data Downloads (PropertyData Residential) |
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
| 26 | Philadelphia County | Pennsylvania | 1.57M | Free, with bedrooms/baths | Checked in the data | City/county OPA properties dataset: bedrooms on 413,633 of 583,716 properties (71%), year built 93%, livable area 93%, sale price | OpenDataPhilly OPA properties (phl.carto.com) |
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
| 38 | Allegheny County | Pennsylvania | 1.23M | Free, with bedrooms/baths | Checked in the data | County property assessments (updated Nov 2, 2026): bedrooms on 449,253 of 584,995 parcels (77%), year built 77%, full/half baths, finished area, sale price | WPRDC Allegheny County Property Assessments |
| 39 | Salt Lake County | Utah | 1.22M | Free, basics only | Checked in the data | State LIR parcels: year built, building sq ft (no sale prices in Utah) | UGRC Parcels_SaltLake_LIR |
| 40 | Mecklenburg County | North Carolina | 1.21M | Free, with bedrooms/baths | Checked in the data | County's own CAMA parcel service: bedrooms on 361,112 of 449,593 parcels (80%), full/half baths, heated area, year built, sale price; separate all-buildings table | meckgis.mecklenburgcountync.gov TaxParcel_camadata |
| 41 | Contra Costa County | California | 1.17M | Free, basics only | Checked in the data | County assessment parcels: year built, building sq ft | gis.cccounty.us CCMAP |
| 42 | Fairfax County | Virginia | 1.16M | Free, with bedrooms/baths | Official page | Real Estate Dwelling Data CSV: year built, bedrooms, bathrooms, style | Fairfax County open data |
| 43 | Fulton County | Georgia | 1.09M | Not found | Checked in the data | Open tax parcels have no building facts | gismaps.fultoncountyga.gov |
| 44 | Montgomery County | Maryland | 1.08M | Free, basics only | Checked in the data | Maryland SDAT statewide: year built (~92%), structure sq ft, stories, units, sale consideration | MD iMAP Property Data |
| 45 | Pima County | Arizona | 1.08M | Not found | Official page | Parcels free; no building-facts bulk found | Pima County geospatial portal |
| 46 | Duval County | Florida | 1.06M | Free, basics only | Official page | State roll free; county bulk not checked | FL DOR NAL |
| 47 | Denton County | Texas | 1.05M | Free, with bedrooms/baths | Checked in the data | Free certified appraisal export (yearly, PACS layout): improvement attributes include bedrooms, plumbing (bath count), fireplaces, foundation, roof; free nightly CSV has year built and main area (no sale prices in Texas) | dentoncad.com Data Downloads |
| 48 | Fresno County | California | 1.02M | Paid or permission | Official page | Assessor sells the Property Characteristics file at 5 cents per parcel ($15,492 for 309,837 parcels, Jan 2026), whole file only; quarterly sales file $25.10; free roll PDFs have no building facts | fresnocountyca.gov Assessor Data for Sale |
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
| 64 | Hidalgo County | Texas | 0.91M | Free, basics only | Official page | Appraisal district's free monthly shapefile export joined to appraisal data (same platform and export as Denton, whose export carries year built and main area); city layers show year built and living area (no sale prices in Texas) | hidalgoad.org Data Downloads |
| 65 | Shelby County | Tennessee | 0.91M | Paid or permission | Official page | County parcel services restricted to ReGIS participants; vendors | gis.shelbycountytn.gov |
| 66 | Middlesex County | New Jersey | 0.89M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 67 | Macomb County | Michigan | 0.89M | Not found | Official page | County open data portal's tax parcel layer is no longer listed (its 2025 copy is not reachable); Michigan assessing is by city and township (per-parcel lookups); no county bulk building facts found | Macomb County MCMAP open data portal |
| 68 | Essex County | New Jersey | 0.88M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 69 | Worcester County | Massachusetts | 0.88M | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 70 | Montgomery County | Pennsylvania | 0.88M | Free, with bedrooms/baths | Checked in the data | County parcels: year built, finished living area, bedrooms, baths | Montgomery County PA GIS (Montco_GIS) |
| 71 | El Paso County | Texas | 0.88M | Free, basics only | Official page | Free certified export files with published layouts; bedroom fields not confirmed (no sale prices in Texas) | epcad.org Open Government |
| 72 | Snohomish County | Washington | 0.86M | Free, basics only | Official page | Assessment roll CSV free 3x/week; improvement file not confirmed | Snohomish County open data |
| 73 | Lee County | Florida | 0.86M | Free, with bedrooms/baths | Checked in the data | County parcels: bedrooms, bathrooms, heated area, year built, sale amounts | Lee County GIS |
| 74 | Polk County | Florida | 0.85M | Free, basics only | Official page | State roll free; county bulk not checked | FL DOR NAL |
| 75 | Baltimore County | Maryland | 0.85M | Free, basics only | Checked in the data | Maryland SDAT + county GIS: year built, structure sq ft | MD iMAP + bcgisdata |
| 76 | Hamilton County | Ohio | 0.84M | Free, basics only | Checked in the data | County open data: year built, sq ft | CAGIS open data (Hamilton County Auditor) |
| 77 | Ventura County | California | 0.84M | Paid or permission | Official page | Characteristics sold: "real property characteristics ... available to non-assessees at a fee" (Auditor-Controller 2025-26); county GIS parcels carry APN only; assessor site has lookups and roll summaries | Ventura County Auditor-Controller + assessor.venturacounty.gov |
| 78 | San Francisco County | California | 0.83M | Free, with bedrooms/baths | Checked in the data | Assessor's secured property tax rolls, published yearly (latest roll 2025): bedrooms on 103,172 parcels in 2025, baths, year built, area | data.sf.gov Assessor Historical Secured Property Tax Rolls |
| 79 | Essex County | Massachusetts | 0.82M | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 80 | Oklahoma County | Oklahoma | 0.82M | Free, with bedrooms/baths | Checked in the data | Assessor's own public map server: improvements table with bedrooms on 283,360 of 325,614 buildings (87%), bathrooms, year built, square feet, stories, roof, foundation, heat/AC; tax parcel layer has sale price | okassessor.oklahomacounty.org View_OKPublicRecord |
| 81 | San Joaquin County | California | 0.82M | Free, with bedrooms/baths | Checked in the data | County parcel layer (assessor data, public map service): bedrooms on 209,924 of 253,737 parcels (83%), year built 85%, whole/half baths, living area, stories, pool, garage | San Joaquin County Public Works Parcels (ArcGIS Online) |
| 82 | Multnomah County | Oregon | 0.80M | Free, basics only | Checked in the data | Taxlots: year built, building sq ft, sale price | Metro RLIS / county taxlots |
| 83 | Jefferson County | Kentucky | 0.79M | Paid or permission | Official page | PVA commercial subscription billed monthly | jeffersonpva.ky.gov |
| 84 | Suffolk County | Massachusetts | 0.79M | One city only | Checked in the data | Boston only: year built, gross area, bedroom/bath fields; rest of county has MassGIS basics | BostonGIS Property Assessment FY25 |
| 85 | Cobb County | Georgia | 0.79M | Free download, building fields not confirmed | Official page | County map services checked: parcels carry values and owners only (building sq ft on 321 of 279,996); county data-sales sheet says the assessor's tabular parcel data (ownership, appraisal, tax bill) is free on its GIS FTP site, building fields not confirmed; parcel polygons sold ($22,000 countywide) | gis.cobbcounty.org + GIS Data Sales sheet |
| 86 | DeKalb County | Georgia | 0.77M | Free, basics only | Checked in the data | County tax parcels: year built, building area | DeKalb County GIS |
| 87 | El Paso County | Colorado | 0.75M | Free, basics only | Official page | Assessor parcel and sales downloads free; bedroom fields not confirmed | assessor.elpasoco.com |
| 88 | Monroe County | New York | 0.75M | Free, with bedrooms/baths | Checked in the data | Monroe County Parcels: year built, living sq ft, bedrooms, full baths | Monroe County Parcels (PlanningDesign) |
| 89 | Montgomery County | Texas | 0.75M | Free, basics only | Checked in the data | County GIS MCAD view: year built, main area (no sale prices in Texas) | Montgomery County TX GIS |
| 90 | Utah County | Utah | 0.75M | Free, basics only | Checked in the data | State LIR parcels: year built, building sq ft (no sale prices in Utah) | UGRC LIR |
| 91 | San Mateo County | California | 0.74M | Not found | Checked in the data | County open data (45 datasets) and county GIS have no building facts; two towns (Portola Valley, San Bruno) re-publish county assessor characteristics for their own parcels only; California assessors sell characteristics | data.smcgov.org + town copies |
| 92 | Norfolk County | Massachusetts | 0.74M | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 93 | Hudson County | New Jersey | 0.74M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 94 | Davidson County | Tennessee | 0.73M | Free, basics only | Checked in the data | Metro ownership parcels map service: finished area on 237,557 of 287,886 parcels (83%), sale price 66%, dwelling units, land use, appraised values; no year built or bedrooms | maps.nashville.gov Cadastral Layers (Ownership Parcels) |
| 95 | Denver County | Colorado | 0.73M | Free, with bedrooms/baths | Checked in the data | City and County residential characteristics service: bedrooms on 204,403 of 212,970 residential records (96%), year built 97%, full/half baths, above-grade and basement area, stories | Denver open data (ODC real property residential characteristics) |
| 96 | Williamson County | Texas | 0.73M | Free, with bedrooms/baths | Checked in the data | WCAD open data: bedrooms, plumbing, year built, main area (no sale prices in Texas) | data.wcad.org |
| 97 | Jackson County | Missouri | 0.73M | Free, with bedrooms/baths | Checked in the data | County's own parcel viewer service: bedrooms on 237,106 of 300,626 records (79%), effective year built, total sq ft, full baths (no sale prices in Missouri) | jcgis.jacksongov.org ParcelViewer (Ascend) |
| 98 | Lake County | Illinois | 0.72M | Free, basics only | Official page | Open data assessment by address (2022); fields not confirmed | Lake County IL open data |
| 99 | Will County | Illinois | 0.71M | One city only | Checked in the data | County GIS services carry no building facts and county terms forbid redistribution without written permission; a City of Joliet layer re-publishes county year built and sq ft for Joliet only | gis.willcountyillinois.com + City of Joliet |
| 100 | District of Columbia | District of Columbia | 0.70M | Free, with bedrooms/baths | Checked in the data | DC CAMA: year built, living area, bedrooms, bathrooms, sale price | DC GIS open data |
| 101 | Tulsa County | Oklahoma | 0.69M | Free, with bedrooms/baths | Checked in the data | Regional council (INCOG) map service of Tulsa County Assessor data: year built on 238,723 of 284,813 parcels (84%), bath count 77%, gross sq ft 96%, sale price 59%, stories, quality; no bedroom field | INCOG Tulsa County Parcels (map11.incog.org) |
| 102 | Providence County | Rhode Island | 0.68M | Not found | Checked in the data | City of Providence open data has no current assessment file (a 2013 residential assessment is the latest); Rhode Island assessing is by city and town, mostly Vision lookup sites | data.providenceri.gov + town lookup sites |
| 103 | Kent County | Michigan | 0.67M | Not found | Checked in the data | County and Grand Rapids map layers carry parcels without building facts (one city analysis layer shows decade built); Michigan assessing is by city and township | Kent County + City of Grand Rapids ArcGIS |
| 104 | Bernalillo County | New Mexico | 0.67M | Free, basics only | Checked in the data | Assessor parcel map service: dwelling year built on 208,800 of 257,286 parcels (81%), style, values; no size or bedrooms (no sale prices in New Mexico) | assessormap.bernco.gov Public Assessor Parcels |
| 105 | Arapahoe County | Colorado | 0.67M | Free, basics only | Official page | Assessor's free weekly data export (official site): building characteristics table for each parcel, extra features and transfers (fields not opened; re-published layers show year built and building sq ft) | gis.arapahoegov.com Assessor Data Export |
| 106 | Ocean County | New Jersey | 0.67M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 107 | Jefferson County | Alabama | 0.66M | Not found | Checked in the data | County parcel map service carries parcel IDs and owners only; per-parcel lookups for building facts | jccgis.jccal.org Basemap Parcels |
| 108 | Pasco County | Florida | 0.66M | Free, basics only | Official page | State roll free | FL DOR NAL |
| 109 | Brevard County | Florida | 0.66M | Free, basics only | Official page | State roll free | FL DOR NAL |
| 110 | Bucks County | Pennsylvania | 0.65M | Not found | Official page | County parcel file (PASDA, May 2026) carries values and land use only; a third-party copy with bedrooms and baths could not be traced to a current county source | PASDA Bucks County Parcels |
| 111 | Monmouth County | New Jersey | 0.65M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 112 | Western Connecticut Planning Region | Connecticut | 0.64M | Free, with bedrooms/baths | Checked in the data | Connecticut statewide CAMA 2026 | data.ct.gov |
| 113 | Johnson County | Kansas | 0.63M | Paid or permission | Official page | Appraiser sells its whole property-record data file (SQL, excludes ownership, updated February and June) for $100 a year under the Kansas Open Records Act; city layers re-publish year built and area (no sale prices in Kansas) | jocogov.org Appraiser Data Requests and Pricing |
| 114 | Washington County | Oregon | 0.61M | Free, basics only | Checked in the data | Taxlots: year built, building sq ft, sale price | Metro RLIS |
| 115 | Volusia County | Florida | 0.60M | Free, basics only | Official page | State roll free; county database download page exists (fields not confirmed) | FL DOR NAL + vcpa.vcgov.org |
| 116 | Anne Arundel County | Maryland | 0.60M | Free, basics only | Checked in the data | Maryland SDAT statewide | MD iMAP |
| 117 | Douglas County | Nebraska | 0.60M | Free, basics only | Checked in the data | County open-data parcels: building year built on 192,258 of 217,434 parcels (88%), building sq ft 88%, stories, quality, condition | data.dogis.org Parcels public (dcgis.org) |
| 118 | Union County | New Jersey | 0.59M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 119 | Bristol County | Massachusetts | 0.59M | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 120 | Dane County | Wisconsin | 0.59M | One city only | Checked in the data | City of Madison only: year built, living area, bedrooms, full baths | City of Madison open data |
| 121 | New Castle County | Delaware | 0.59M | Free, with bedrooms/baths | Checked in the data | County parcels: year built, main floor area, bedrooms, full baths | gis.nccde.org |
| 122 | Delaware County | Pennsylvania | 0.58M | Not found | Checked in the data | County GIS services carry parcels without building facts; Board of Assessment has per-parcel lookups | gis.delcopa.gov |
| 123 | Jefferson County | Colorado | 0.58M | Free, basics only | Checked in the data | County parcels: year built, sq ft | mapservices2.jeffco.us |
| 124 | South Central Connecticut Planning Region | Connecticut | 0.58M | Free, with bedrooms/baths | Checked in the data | Connecticut statewide CAMA 2026 | data.ct.gov |
| 125 | Greenville County | South Carolina | 0.57M | Paid or permission | Official page | County GIS sells its full data set ($500 one-time; includes tax parcels and ownership); its public server exposes only a geocoder; re-published copies of the county tax parcel file show bedrooms, baths, sq ft and year built | gcgis.org GIS Data Products Order Form |
| 126 | Baltimore city | Maryland | 0.57M | Free, basics only | Checked in the data | Maryland SDAT + city real property data | MD iMAP + baltegis |
| 127 | Lancaster County | Pennsylvania | 0.56M | Paid or permission | Official page | Assessor sells monthly data packages: $500 package has structure file (year built, base area, style), structure attributes and last sale price; $50 basic file has values and last sale; free county parcel map service has no building facts | lancastercountypa.gov Property Assessment Data For Sale |
| 128 | Chester County | Pennsylvania | 0.56M | Free, basics only | Checked in the data | County parcels: sq ft, last sale price | Chester County PA GIS |
| 129 | Guilford County | North Carolina | 0.56M | Free, with bedrooms/baths | Checked in the data | County's own GIS parcel service: bedrooms on 157,305 of 223,510 parcels (70%), year built 84%, full baths, sq ft, sale price | gcgis.guilfordcountync.gov AreaPlanViewer Parcels |
| 130 | Stanislaus County | California | 0.56M | Paid or permission | Official page | Assessor sells data subscriptions; the property characteristics database has bedrooms, bathrooms, year built, building size, pools and confirmed sale prices, licensed for the buyer's own use only (no transfer without the Assessor's consent) | stancounty.com Assessor data subscription definitions |
| 131 | Spokane County | Washington | 0.56M | Free download, building fields not confirmed | Official page | County publishes free parcel data file downloads behind a commercial-purpose attestation (Washington bars commercial use of lists of individuals); not opened, so building fields unconfirmed; SCOUT lookups show characteristics; Washington statewide parcels carry values and land use only | Spokane County GIS Data Catalog (Parcel Data File Downloads) |
| 132 | Adams County | Colorado | 0.54M | Free, with bedrooms/baths | Checked in the data | County Property Improvements: year built, sq ft, bedrooms, baths | Adams County CO GIS |
| 133 | Plymouth County | Massachusetts | 0.54M | Free, basics only | Checked in the data | MassGIS statewide | MassGIS |
| 134 | Ramsey County | Minnesota | 0.54M | Free, with bedrooms/baths | Checked in the data | County assessor parcel data: bedrooms, full/half baths, year built, sale price | data.ramseycountymn.gov |
| 135 | Summit County | Ohio | 0.54M | Free, basics only | Checked in the data | County fiscal office tax parcels: residential year built on 389,807 of 518,514 parcels (75%); building area field empty | Summit County TaxParcels public |
| 136 | Montgomery County | Ohio | 0.54M | Free, with bedrooms/baths | Official page | County treasurer's free file downloads include a CAMA characteristics file (layout: year built, total rooms, bedrooms, full/half baths, stories) plus weekly/monthly/yearly sales files | go.mcohio.org Treasurer File Downloads (Cama Characteristics) |
| 137 | Sedgwick County | Kansas | 0.54M | Not found | Checked in the data | County GIS hub parcels carry IDs and lot size only; appraiser characteristics via per-parcel lookups only (no sale prices in Kansas) | Sedgwick County GIS (SedgwickCounty-GIS land records) |
| 138 | Ada County | Idaho | 0.54M | Not found | Checked in the data | County parcel layer and Idaho's statewide improvement table carry no building facts for Ada (180,120 improvement rows, year built, size and bedrooms all empty); only an older third-party copy showed year built (no sale prices in Idaho) | Ada County GIS + Public Idaho Parcels improvement table |
| 139 | Camden County | New Jersey | 0.53M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 140 | Clark County | Washington | 0.53M | Free, with bedrooms/baths | Checked in the data | Full assessor ZIP checked: bedrooms, baths, heat, roof, walls, garage, sales history | Clark County WA PACS open data |
| 141 | Passaic County | New Jersey | 0.53M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 142 | Morris County | New Jersey | 0.52M | Free, basics only | Checked in the data | NJ MOD-IV: year built, sale price (no size) | maps.nj.gov Cadastral |
| 143 | Kane County | Illinois | 0.52M | Not found | Official page | No county open data or bulk file found; Supervisor of Assessments answers FOIA requests; per-parcel lookups only | assessments.kanecountyil.gov |
| 144 | Polk County | Iowa | 0.52M | Free, with bedrooms/baths | Checked in the data | Assessor's free residential inventory CSV (whole county, updated Sep 2026): bedrooms, bathrooms, year built, living area, basement, garage, heating/AC, condition; separate free sales downloads | assess.co.polk.ia.us Residential Downloads |
| 145 | Pinal County | Arizona | 0.51M | Free, basics only | Checked in the data | County GIS tax parcels: residential year built on 193,680 of 288,631 parcels (67%), building area 67%, sale price 53% | gis.pinal.gov TaxParcels |
| 146 | Washoe County | Nevada | 0.51M | Free, with bedrooms/baths | Checked in the data | County parcels: year built, sq ft, bedrooms, baths, sale price | Washoe County GIS |
| 147 | Knox County | Tennessee | 0.51M | Paid or permission | Official page | KGIS (Knoxville, Knox County, KUB) licenses property data at $100 per 2,500 ft tile (volume discounts) under a license that forbids redistribution; per-parcel lookups otherwise | kgis.org Digital Data Purchase Information |
| 148 | Lake County | Indiana | 0.50M | Free, basics only | Official page | Indiana DLGF statewide improvement files by request | Indiana DLGF |
| 149 | Richmond County | New York | 0.50M | Free, basics only | Checked in the data | NY State public parcels (no bedrooms for NYC) | NYS Tax Parcels Public |
| 150 | Prince William County | Virginia | 0.50M | Free, basics only | Checked in the data | County Parcel CAMA Public: above-grade sq ft | gisweb.pwcva.gov |

## Method and limits

- Counties ranked by Census 2024 population estimates.
- Automated scans of Socrata (4,197 datasets) and ArcGIS Online (2,009 services intersecting the counties), reading each dataset's column names; then targeted web searches and direct reads of county map services and assessor downloads.
- Second pass: walks of each county's own ArcGIS server (`county-survey/tools/restscan.py`), statewide layers, file headers read from remote ZIPs with range requests (`county-survey/tools/zipls.py`, `county-survey/tools/zipmember.py`), and published file layouts. Two files were left unopened on purpose: Spokane's downloads sit behind a commercial-use attestation, and Medina OH's site has an expired certificate.
- A column existing is not proof it is filled. Fill counts were taken for most services checked in the second pass (shown in the table) and for New York, Maryland, Idaho, North Carolina, West Virginia and Clark County WA.
- Free does not mean unrestricted. King County forbids redistribution without permission; SanGIS has its own license; DuPage requires written permission; Will County forbids redistribution without written permission; Stanislaus and KGIS (Knox) license data for the buyer's own use only; Arizona requires a commercial-purpose declaration for records requests; Washington bars commercial use of lists of individuals (owner names), and King and Spokane ask for that acknowledgement before download. Many files also carry owner names, which Pantopus would drop. Each source needs a terms check before use.
- The other 2,994 counties are estimated from a 100-county sample in the section below.

## National estimate (added November 5, 2026; updated after the second pass)

The other 2994 counties hold 167.2 million people (49.2% of the US). I drew 100 of them at random with probability proportional to population (systematic sampling ordered by state, seed 20261105), so each draw stands for 1.67 million people, and checked each one: automated ArcGIS scan, statewide sources, then a web search of the county's own sites. A county counts as free only if it or its state publishes building facts in bulk; per-property lookup websites do not count.

| Category | Rest of the US (sample of 100) | 95% range | Whole US (top 150 measured + sample) |
|---|---:|---:|---:|
| Free, with bedrooms/baths | 9% | 5-16% | 23.2% (79M people) |
| Free, basics only | 26% | 18-35% | 32.5% (111M people) |
| Free download, building fields not confirmed | 0% | 0-4% | 0.4% (1M people) |
| Partial (one city or sold homes only) | 1% | 0-5% | 1.9% (6M people) |
| Paid or permission | 2% | 1-7% | 6.5% (22M people) |
| Not found (lookup sites, resellers) | 62% | 52-71% | 35.5% (121M people) |
| Not checked | 0% | 0-4% | 0% |
| **Free building facts (first two rows)** | **35%** | 26-45% | **55.7%** (range 52-61%) |

What the smaller counties look like:
- Most "free" results there come from statewide files (Florida, Texas year built, Maryland, Massachusetts, New Jersey, New York, Utah, Minnesota opt-in counties, Maine, West Virginia, North Carolina where its building layer is parcel-derived, Montana year built, Indiana by request). County-level free files with bedrooms/baths were found in Deschutes OR, Bradley TN, Charlottesville VA, Lincoln NC, Skagit WA, Rockland and Broome NY (state layer), and in re-published copies for Northampton PA and Madison VA.
- "Not found" counties usually run a per-property lookup site (often a vendor platform such as qPublic, Spatialest, Vision or Image Mate) while resellers sell the county's parcel file, typically $200-$300 per county. The data exists; free bulk access does not. Many could be obtained through public-records requests (cost and commercial-use terms vary by state).
- Paid or fee-based: Yolo CA (per-parcel fees), Ingham MI (enhanced-access fees).
- Limits: field presence was confirmed for statewide layers and many counties; for most small counties the evidence is the county's own site and search results. Sampling error is shown as the 95% range.

## Second pass (November 5, 2026, evening)

- **The 23 unchecked top-150 counties:** 5 free with bedrooms or baths (Denton TX certified export, Oklahoma County's assessor server, San Joaquin CA's county layer, Tulsa via INCOG, Polk IA's residential CSV); 2 free basics (Davidson TN finished area and sale price, Bernalillo NM year built); 2 free downloads not confirmed (Cobb GA tabular file on its FTP site, Spokane WA behind an attestation); 6 paid (Fresno $15,492 for the characteristics file, Ventura at a fee, Greenville SC $500 GIS set, Lancaster PA $50 or $500 packages, Stanislaus subscription for own use only, Knox TN at $100 per map tile); 8 not found (Macomb, Kent MI, San Mateo, Providence, Jefferson AL, Delaware PA, Sedgwick KS, Kane IL).
- **Re-published copies and known datasets, checked at the source:** confirmed with bedrooms (San Diego via SanGIS, Miami-Dade, King, Tarrant, Mecklenburg, Guilford, Jackson MO, Montgomery OH's CAMA file, Philadelphia, Allegheny, San Francisco, Denver) and with basics (Summit OH, Douglas NE, Pinal AZ, Hidalgo TX, Arapahoe CO). Four were weaker at the source: Will IL becomes one city only (the county forbids redistribution; only Joliet's layer carries the facts), Johnson KS becomes paid (whole file $100 a year), Bucks PA and Ada ID become not found (the county files carry no building facts).
- **Sample:** Lincoln NC moves to bedrooms/baths (free county CSVs); Medina OH to basics (free CAMA file, unopened); Forsyth NC to basics through North Carolina's statewide building layer; Cabarrus NC, Davie NC and Waukesha WI to not found (their files carry values only). Skagit WA and Monongalia WV were confirmed at the county or state source; Northampton PA and Madison VA remain re-published copies because no county file was found.
- **Net effect:** free building facts 53.4% to 55.7% of Americans; with bedrooms or baths 20.9% to 22.4% (23.2% after the later Dallas correction); paid or permission 5.1% to 6.5%; not found 32.6% to 35.5%; unchecked 4.7% to 0.

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
| 193 | Forsyth County | North Carolina | 398,143 | Free, basics only | Checked in the data | North Carolina Emergency Management statewide building layer: parcel-derived year built on 140,740 of 202,178 buildings (70%), heated sq ft 55%; the county itself has lookups only | NC Emergency Management NC Risk Building Footprints |
| 297 | Cabarrus County | North Carolina | 244,925 | Not found (lookup sites, resellers) | Checked in the data | County open-data tax parcels carry values and sale prices but no building facts (2005 and 2010 archive layers had year built); North Carolina's statewide building layer is mostly modeled here (15% of buildings have a parcel-derived year built) | Cabarrus County open data + NC Emergency Management buildings |
| 419 | Brunswick County | North Carolina | 167,112 | Free, basics only | Checked in the data | County tax parcels: actual year built | Brunswick County NC GIS |
| 636 | Lincoln County | North Carolina | 97,611 | Free, with bedrooms/baths | Checked in the data | County GIS publishes free CSVs: improvements (year built on 93% of records, finished area, bedrooms, full/half baths, fireplaces, basement) and sales | Lincoln County NC GIS downloads (improvements.zip, sales.zip) |
| 1087 | Davie County | North Carolina | 45,383 | Not found (lookup sites, resellers) | Checked in the data | County parcels carry values and sale dates only; North Carolina's statewide building layer has no parcel-derived values here (modeled only) | Davie County GIS + NC Emergency Management buildings |
| 2103 | McKenzie County | North Dakota | 14,782 | Not found (lookup sites, resellers) | Official page or search | County GIS parcels; no building facts found | McKenzie County ND |
| 231 | Lorain County | Ohio | 322,030 | Not found (lookup sites, resellers) | Official page or search | Per-parcel auditor search shows year built and bedrooms; no bulk found | Lorain County OH |
| 377 | Medina County | Ohio | 184,625 | Free, basics only | Official page or search | Auditor's free download page lists a CAMA file of dwellings, buildings, additions and features (pipe-delimited) plus parcel and transfer files; fields not opened because the auditor's site certificate has expired | Medina County Auditor Available Downloads |
| 659 | Tuscarawas County | Ohio | 92,048 | Not found (lookup sites, resellers) | Official page or search | Parcel shapefile from tax map office; no characteristics found | Tuscarawas County OH |
| 1152 | Fulton County | Ohio | 42,028 | Not found (lookup sites, resellers) | Official page or search | Auditor real estate search only; vendors | Fulton County OH |
| 664 | Wagoner County | Oklahoma | 91,257 | Not found (lookup sites, resellers) | Official page or search | Assessor search (Spatialest) only | Wagoner County OK |
| 2388 | Johnston County | Oklahoma | 10,293 | Not found (lookup sites, resellers) | Official page or search | Assessor portal only | Johnston County OK |
| 337 | Deschutes County | Oregon | 211,535 | Free, with bedrooms/baths | Checked in the data | County taxlots: year built, bedrooms, bathrooms, garage sq ft | Deschutes County GIS |
| 156 | York County | Pennsylvania | 471,240 | Not found (lookup sites, resellers) | Official page or search | Assessment lookup site; GIS hub parcels without assessment fields found | York County PA |
| 229 | Northampton County | Pennsylvania | 322,989 | Free, with bedrooms/baths | Seen in a re-published copy | County offers lookups only (Vision); a City of Bethlehem layer re-publishes county CAMA fields for all 122,379 county parcels: year built, living area, bedrooms, full/half baths, rooms, sale price | Northampton County via City of Bethlehem |
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
| 2143 | Madison County | Virginia | 14,252 | Free, with bedrooms/baths | Seen in a re-published copy | County source not found (vendors sell the county file); the Rappahannock-Rapidan Regional Commission layer re-publishes county assessment data: year built, gross area, bedrooms, full baths, sale price | Rappahannock-Rapidan Regional Commission copy |
| 496 | Skagit County | Washington | 132,736 | Free, with bedrooms/baths | Checked in the data | County's own assessor tax parcel service: bedrooms on 38,548 of 83,004 parcels, year built on 49,062, living area, plumbing, sale price | geo.skagitcountywa.gov Tax Parcels |
| 582 | Monongalia County | West Virginia | 108,697 | Free, basics only | Checked in the data | West Virginia's statewide parcel summary (WV GIS Technical Center, county assessor data, tax year 2026): year built on 41,424 of 65,497 Monongalia parcels (63%), stories, style, grade | services.wvgis.wvu.edu WV_Parcels ParcelSummary |
| 182 | Waukesha County | Wisconsin | 417,029 | Not found (lookup sites, resellers) | Checked in the data | County parcel map service and downloads carry values and owners only, no building facts; Wisconsin statewide parcels carry values only | Waukesha County Web Tax Parcel |
| 531 | La Crosse County | Wisconsin | 121,060 | Not found (lookup sites, resellers) | Official page or search | Older county export and statewide parcels carry assessment values only | La Crosse County WI + Wisconsin statewide parcels |
| 1109 | Douglas County | Wisconsin | 44,276 | Not found (lookup sites, resellers) | Official page or search | Wisconsin statewide parcels carry values only; city GIS for Superior | Douglas County WI |
