# Statewide files: every state and territory

November 7, 2026. Research for decision D2 ([decisions.md](decisions.md)); nothing here is built, bought or sent. It answers
the open item in [HANDOFF.md](HANDOFF.md): a per-state inventory of statewide parcel, assessment and building-fact files,
who publishes each, what it holds, its terms, how to get it, and how many people it reaches beyond what's already in
storage. The WP7 builder works from the ranked table. Counts only: no addresses or owner names appear here.

This isn't legal advice. Terms were read on the date shown and can change.

## The answer

- **Storage today:** 523 counties and county-equivalents in 30 states have a published release (read from
  `index/states/` with the reader key, November 7 07:52 UTC), holding 55.05M records. They hold 157.7M of 340.1M
  Americans. The other 182.4M live in 2,621 counties with no record yet.
- **Free statewide files with an open license or a public, no-limit posting, and street addresses, reach 49.1M more
  people (21.4M homes).** Texas is 12.25M of that and is already built: it waits only for the founder's publish command.
  The rest are Ohio, Indiana, Washington, Wisconsin, Colorado, New York, Virginia, North Dakota, Vermont and Idaho.
- **Tennessee adds 3.76M** through the Comptroller's county files, which allow commercial use in writing but need a person to
  fill a form for each county. **Nine more states add 19.9M** after one written question each (South Carolina, Arkansas,
  Mississippi, Nevada, New Hampshire, Nebraska, Rhode Island, Alaska, Wyoming).
- **Most of this is address, value, lot and sale, not building facts.** Year built and size come with Texas, Virginia (24
  localities), Nebraska, Idaho (13 counties), Vermont (part) and, by email, Indiana. Bedrooms and baths come only with
  Virginia (0.61M people), Idaho (a few counties) and Montana's per-county files (1.14M people, already stored without
  them). The weakest facts stay weak: [other-routes.md](other-routes.md) ranks what would raise them.
- **No usable statewide file** in 16 states and 3 territories: Alabama, Arizona, California, Georgia, Illinois, Iowa,
  Kansas, Kentucky, Louisiana, Michigan, Missouri, New Mexico, Oklahoma, Oregon, Pennsylvania and South Dakota (Iowa's is
  2017 geometry, Michigan's and Oregon's are internal), plus Puerto Rico, American Samoa and the Northern Mariana Islands.
  That's where counties' files, requests and the one-home question in [lookup-sites.md](lookup-sites.md) matter most.

How this beats ATTOM: every one of these records comes from the government that keeps it, names that publisher and its
date, costs nothing per lookup, and refreshes on the state's own schedule (weekly in Tennessee, monthly in Montana and
Nebraska, yearly elsewhere). When a state publishes something useful (Colorado's sale prices, New York's market value for
every town, Virginia's localities' bedroom counts), the record shows it with its source.

## How this was measured

- **Storage:** every `index/states/<ST>.json` file, read with the reader key; the coverage report
  (`scripts/property-index/coverage.cjs`) for facts already stored. A county counts as stored if it has a release, even
  when the release covers one city (Milwaukee, Madison, Detroit) or part of a county.
- **People:** Census Bureau 2024 county estimates
  ([co-est2024-alldata.csv](https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv));
  Puerto Rico from the 2024 state file; Guam, the Virgin Islands, American Samoa and the Northern Mariana Islands from the
  2020 Island Areas count. **Homes:** American Community Survey 2020-2024 housing units per county, as already used by the
  address registry's coverage file.
- **What a file holds:** each state's own service, read with count queries grouped by county (counts only, no records
  fetched), or the file itself where there is no service. Virginia's 373 MB local tables were downloaded, measured
  column by column without decoding owner columns, and deleted.
- **Catalog search:** ArcGIS Online and Socrata catalogs for every state and territory, the state routes in
  [evidence/state-routes.csv](evidence/state-routes.csv), state GIS clearinghouses, and web searches. A file nobody
  catalogs may still exist; "none found" means what it says.
- **Never touched:** any county's property lookup page. Only catalogs, state services, terms pages and robots.txt.

The table behind every number is [evidence/statewide-inventory.csv](evidence/statewide-inventory.csv).

## Ranked by homes gained

Files not yet in storage, ranked by the housing units in the counties each one adds. "Facts" lists what the file holds,
not what fills every record; the notes below give the fill measured. Rights words: *open license or written OK*; *public,
disclaimers only* (posted for the public with no use limit found); *allowed, a person fetches it*; *ask first* (a short
written question before any use).

| # | State | File and publisher | Counties added | People | Homes | Facts | Rights | How to get it |
|---:|---|---|---:|---:|---:|---|---|---|
| 1 | TX | [StratMap land parcels](https://geographic.texas.gov/stratmap/land-parcels.html), Texas Geographic Information Office | 215 built | up to 12.25M | up to 4.91M | address, year built, lot, value | Open license or written OK | Founder's one publish command |
| 2 | OH | [Ohio Statewide Parcels Public View](https://www.arcgis.com/home/item.html?id=26ab5fad8d5d4258a7492a14de83bc0e), OGRIP, State of Ohio | 83 | 7.37M | 3.20M | address, lot | Public, disclaimers only | Feature service; query county by county |
| 3 | IN | [Indiana Gateway PARCEL file, plus state parcel layer for addresses](https://gateway.ifionline.org/public/download.aspx), Department of Local Government Finance; Indiana GIO | 92 | 6.92M | 2.98M | address, lot, value | Public, disclaimers only | Web download; year built and size by email to data@dlgf.in.gov |
| 4 | WA | [Current Parcels](https://www.arcgis.com/home/item.html?id=2b603a599a0842a3b2284c04c8927f35), WaTech, Washington Geospatial Portal | 36 | 6.47M | 2.72M | address, value | Public, disclaimers only | Geodatabase download and service |
| 5 | WI | [V12 Statewide Parcels](https://www.sco.wisc.edu/parcels/data/), State Cartographer's Office and Department of Administration | 70 | 4.45M | 2.54M | address, lot, value | Open license or written OK | Geodatabase, per-county files, service |
| 6 | SC | [Statewide_Parcels layer](https://www.arcgis.com/home/item.html?id=0eb57066abc0403b8e2bdf760b6aae7d), SC Revenue and Fiscal Affairs Office | 46 | 5.48M | 2.44M | lot, value | Ask first | Feature service |
| 7 | CO | [Colorado Public Parcels](https://www.arcgis.com/home/item.html?id=55234e04218f47c9868900e439fcbd5a), Governor's Office of Information Technology | 42 | 4.43M | 1.91M | address, value, sale price, lot | Open license or written OK | Geodatabase download (the service says don't bulk-download through it) |
| 8 | TN | [Comptroller county parcel downloads with Assessment_Data table](https://comptroller.tn.gov/office-functions/pa/gisredistricting/redistricting-and-land-use-maps/parcel-data.html), Comptroller, Division of Property Assessments | 86 | 3.76M | 1.65M | address, lot, value | Allowed; a person fetches it | A person, 86 forms; don't script it |
| 9 | NY | [Property Assessment Data from Local Assessment Rolls](https://data.ny.gov/d/7vem-aaz7), Department of Taxation and Finance | 23 | 3.30M | 1.41M | address, lot, value | Open license or written OK | Open data API; select columns so owner and mailing columns are never requested |
| 10 | AR | [Parcel Polygon, County Assessor Mapping Program](https://www.arcgis.com/home/item.html?id=a137c0ad109e41a99f4d88ca96fbdc2a), Arkansas GIS Office | 75 | 3.09M | 1.39M | address, value | Ask first | Feature service (200 rows a request) or GeoStor download |
| 11 | MS | [MDEM Cadastral Framework, Mississippi statewide 2022](https://www.arcgis.com/home/item.html?id=399921dbc1e646b49ab7b7b7cd26c80e), Mississippi Emergency Management and county assessors, on a contractor's server | 82 | 2.94M | 1.34M | address, lot, value | Ask first | Feature service |
| 12 | NV | [All Parcels, 2018-12-31](https://gis.dot.nv.gov/agsphs/rest/services/Reference/Statewide_Parcels/MapServer/0), Division of State Lands, on NDOT's server | 17 | 3.27M | 1.33M | address, lot | Ask first | Map service |
| 13 | VA | [Virginia Parcels and Local Schema Tables, 2026 Q3](https://www.arcgis.com/home/item.html?id=523d89ebf23d4d84957f9fe5b9158bd9), Virginia Geographic Information Network | 24 | 1.76M | 756K | address, year built, size, bedrooms, baths, value, sale price | Open license or written OK | 373 MB geodatabase, 147 tables |
| 14 | NH | [Parcel Mosaic (GRANIT)](https://www.arcgis.com/home/item.html?id=366c27f862eb434f8852da93f1ee95a2), Department of Revenue Administration, through GRANIT | 10 | 1.41M | 648K | address | Ask first | Map service |
| 15 | NE | [StatewideParcelsExternal](https://giscat.ne.gov/enterprise/rest/services/StatewideParcelsExternal/MapServer/0), Office of the CIO, from county assessors | 92 | 1.40M | 612K | address, year built, size, value, sale price | Ask first | Map service |
| 16 | HI | [Statewide TMKs](https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/25), Hawaii Statewide GIS Program | 5 | 1.45M | 568K | lot | Public, disclaimers only | Map service |
| 17 | RI | [RIGIS Tax Parcels](https://risegis.ri.gov/hosting/rest/services/RIDEM/Tax_Parcels/MapServer/0), RIDEM on the state's GIS server | 5 | 1.11M | 486K | address, lot | Ask first | Map service |
| 18 | DE | [Delaware State Parcels 2.0](https://www.arcgis.com/home/item.html?id=35154346e73748ef915d863651839ccc), FirstMap, from three counties | 3 | 1.05M | 464K | lot | Public, disclaimers only | Map service |
| 19 | ND | [NDGISHub State Parcel Program](https://www.arcgis.com/home/item.html?id=ac6da1176038457db16e8debe3f1abaf), North Dakota Information Technology, from counties | 53 | 797K | 377K | address, lot, value | Public, disclaimers only | Feature service, with a download route in the item |
| 20 | VT | [Standardized parcels with Grand List; E911 site points; Property Transfers](https://www.arcgis.com/home/item.html?id=09cf47e1cf82465e99164762a04f3ce6), Vermont Center for Geographic Information, Department of Taxes | 14 | 648K | 339K | address, year built, lot, value, sale price | Public, disclaimers only | Feature services |
| 21 | ID | [Public Idaho Parcels and Improvement Table](https://www.arcgis.com/home/item.html?id=65a3f7c6d4ca404ba6ab677913953b35), Idaho Office of Information Technology Services, from counties | 13 | 708K | 292K | address, year built, size, bedrooms, baths, lot, value | Open license or written OK | Feature service |
| 22 | WY | [Wyoming Parcels for 2026](https://www.arcgis.com/home/item.html?id=9ab04f655f5b4e398d9f2f070d2d29bb), Department of Revenue staff account | 23 | 588K | 277K | address, lot, value | Ask first | Feature service |
| 23 | AK | [Alaska Statewide Parcels](https://www.arcgis.com/home/item.html?id=458be3d8aafa47cd882af05cee983f6b), Division of Forestry and Fire Protection, a compilation | 12 | 607K | 268K | value | Ask first | Feature service, then each borough |

What to know about each:

| State | What to know |
|---|---|
| TX | State says the file is free to acquire; no use limit found. Built on this Mac for 215 counties and not published: GitHub's runners get 403, and the founder holds the writer key. |
| OH | Public use at the user's own risk. Summary says updated January 21, 2024, so it's old. Sampled 10 counties: address on 82%, land use on 86%, land area on 45%. No value, no building facts; each record links to its auditor's site. |
| IN | Free positional files, one county or all 92, tax year 2025 pay 2026. No limit stated on the download page. Indiana law lets an agency restrict commercial use of data it issues on disk or tape by rule (IC 5-14-3-3(e)); no such rule was found, not ruled out. Layout: 50 IAC 26. Holds owner columns. |
| WA | Informational; no use limit in the layer. Updated April 2026; 38 of 39 counties have rows. Address on 83% and building value on 75% of parcels beyond storage. King, Snohomish and Spokane limit their own files; ask whether the state's copy is different before showing those three. |
| WI | Layer says free for public consumption as of June 30, 2026. Address on 66% and assessed value on 87% of parcels beyond storage (counted on the V11 copy). Also covers the rest of Milwaukee and Dane, where storage holds one city. |
| SC | No address column: a home can only reach it by its map point. It sits inside a county-boundary web map; public information as is. RFA also runs the state's yearly county data collection; ask whether this is meant for public use. |
| CO | Written: commercial use, including subscription apps, is allowed with credit to the State; only reselling the dataset itself is barred. Published June 2026. 44 of 64 counties; 20 small counties absent. Beyond storage: address 69%, sale price 47%, appraised value 68%. |
| TN | Written: any company may use and keep the files for any use, including in a commercial app. But no bulk or automated downloads: a person fills a form per county. Updated weekly. The table holds owner, property, building, land use and assessment fields; its dictionary comes with each download and wasn't opened, so year, size, beds and baths aren't confirmed. Nine counties (Davidson, Hamilton, Knox, Shelby and five more) aren't the state's. |
| NY | OPEN-NY terms: free use for lawful purposes, no attribution, an indemnity clause. Roll year 2025, every city and town outside NYC. Adds 23 unstored counties, Nassau first, and market value upstate. No building facts. Storage has 39 counties from the state's public parcels and Monroe. |
| AR | Refreshed semiannually from county CAMA. Address 81%, value 95%, improvement value 57%. The item says it's for ad valorem valuation, research and assessment purposes only, and I couldn't read GeoStor's terms by script: a short written question first. |
| MS | No license stated. 2022 data on an engineering firm's server. Ask MDEM or MARIS for the current copy and the terms before any use. |
| NV | 2018 data. No terms. Address, city, acres, owner. Too old to show; useful only for matching. |
| VA | CC0. Facts differ by locality, so each needs its own mapping. Measured from the file: 49 localities have addresses (3.87M people), 24 have an address and at least one fact at 50% or more (1.76M people). Year 1.28M, size 0.77M, beds 0.73M, beds and baths 0.61M, sale 1.40M. Fairfax, Prince William, Loudoun, Arlington and Norfolk hold IDs only. Some tables hold owner columns. |
| NH | Licensed by the Department of Revenue Administration; item says last updated 2016. Address and land use code only, no value. |
| NE | Best facts per home here: of 938,247 parcels beyond storage, year built on 531,655, improved size on 265,872, sale value on 417,556. But the text says compiled for official, internal use by the State, though served publicly. Ask the OCIO first. |
| HI | State calls the content public domain with exceptions in its terms. Tax map key, acres and a link to each county's qPublic page. No address. Hawaii County's own layer adds land and building value. Honolulu has no value column. |
| RI | Plat and lot, acres, E911 address, impervious share. No value. Terms not readable by script. Assessing is by town, mostly on Vision sites. |
| DE | As is. Parcel number and acres only, no address and no value. |
| ND | Goal stated as publicly accessible; disclaimers only. All 53 counties. Address on 57%. Also holds number of structures and tax roll year. |
| VT | Disclaimers only. All 14 counties. E911 points carry year built and unit counts (fill not countable without a token). Transfers carry sale price; leave out buyer and seller columns. |
| ID | Terms: no warranty, and not for use as a mailing list (Idaho Code 74-120). Only 13 of 44 counties. Beds and baths near full in Nez Perce, Gooding and Teton; partial in Valley, Minidoka, Washington, Camas and Boise; empty in Ada, Jerome and Lincoln. |
| WY | No terms stated, no description. All 23 counties, tax year 2026. Address on all; value on 89%. Ask the Department first. |
| AK | Non-authoritative compilation; each origin's terms apply and each must be credited. No address column. Rows with values in 12 of the 30 boroughs and census areas. |

### The order I'd build them in

Homes aren't the only measure: rights, facts and upkeep matter as much. Recommended order for the WP7 builder, each still
needing its rights row in [cost-and-rights.md](cost-and-rights.md) before a release:

1. **Texas:** the founder's publish command. 4,873,940 records, nothing to build.
2. **Colorado:** the clearest written permission here, sale prices and values for 42 counties.
3. **New York:** one open-data query adds 23 counties, Nassau first, and market value for every stored upstate county.
4. **Wisconsin:** free, yearly, all 72 counties, and fills the rest of Milwaukee and Dane counties.
5. **Indiana:** free yearly files for all 92 counties; a second step by email adds year built and size.
6. **Virginia:** CC0, but 24 separate mappings; worth it for the only free bedroom and bath counts left in a big state.
7. **Washington:** address and value for 36 counties; ask about King, Snohomish and Spokane first.
8. **North Dakota, Vermont, Idaho:** small, clean, cheap to add.
9. **Ohio:** large but thin (address and lot, January 2024). Build it after the others or when Ohio's auditors' own files
   are mapped; it's the fallback for the 83 Ohio counties without a connector.
10. **After a written answer:** Nebraska (best facts per home), Arkansas, Mississippi, Wyoming, South Carolina (by map
    point only), Nevada (2018, matching only), New Hampshire, Rhode Island, Alaska.
11. **Tennessee:** 86 forms by a person, then a connector that reads the downloaded folders. The field dictionary in the
    first download decides whether it carries year built, size, bedrooms and baths.

## Already in storage: what the state's own file could still add

| State | Stored file | Facts in it | What the state could still add |
|---|---|---|---|
| CT | [Parcel and CAMA](https://data.ct.gov/d/ibe8-9i3q), Office of Policy and Management | address, year built, size, bedrooms, baths, lot, value, sale price | Already stored. Full facts. |
| DC | [CAMA layers](https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer), DC GIS | address, year built, size, bedrooms, baths, lot, value, sale price | Already stored. |
| FL | [Department of Revenue roll](https://www.floridarevenue.com/property/Pages/DataPortal_RequestAssessmentRollGISData.aspx), Florida Department of Revenue | address, year built, size, lot, value, sale price | Already stored for all 67 counties. No beds or baths in the roll; those sit with each property appraiser (other-routes.md). |
| MA | [MassGIS Property Tax Parcels](https://www.mass.gov/info-details/massgis-data-property-tax-parcels), MassGIS | address, year built, size, lot, value, sale price | Already stored. Boston and Cambridge add beds and baths. |
| MD | [Real Property, owner names hidden; CAMA tables](https://opendata.maryland.gov/d/ed4q-f8tm), Department of Assessments and Taxation | address, year built, size, lot, value, sale price | Already stored. CAMA tables hold no bedroom or bath column; building rooms filled on 3,940 of 2,428,561. |
| ME | [Parcels, GeoLibrary](https://www.maine.gov/geolib/content/data-catalog), Maine GeoLibrary | address, value | Stored, but thin: towns submit by choice, and records are about half of housing units. Facts sit in town rolls. |
| MN | [Open parcels compilation](https://www.arcgis.com/home/item.html?id=69148d3959194a05a23964cc60f6517b), MnGeo | address, year built, size, lot, value, sale price | 57 counties stored; 30 others (0.67M people) haven't opted in. |
| MT | [Cadastral; Orion CAMA per county](https://www.msl.mt.gov/geoinfo/msdi/cadastral/), Montana State Library, Department of Revenue | address, year built, size, bedrooms, baths, lot, value | Parcels stored for all 56, with no building facts. The monthly per-county CAMA holds year, living area, bedrooms and baths (marked optional entry). SQL Express databases; fill unknown until one is opened. Law bars using it as a distribution list (MCA 2-6-1017). |
| NC | [OneMap parcels; Risk building footprints](https://assets.nconemap.gov/pages/hub/ncom-od-parcels-dd.htm), NC OneMap, Emergency Management | address, year built, size, lot, value | 88 counties stored. 12 counties (0.92M people) have no address in OneMap or sit with their own connector queue. |
| NJ | [Parcels and MOD-IV](https://nj.gov/njgin/edata/parcels/), NJ Office of GIS | address, year built, lot, value, sale price | Already stored. No size, beds or baths in the state's file. |
| UT | [LIR parcels](https://gis.utah.gov/products/sgid/cadastre/parcels/), Utah UGRC | address, year built, lot, value | Already stored. Sale prices aren't public in Utah. |
| WV | [WV_Parcels and ParcelSummary](https://www.wvgis.wvu.edu/data/dataset.php?ID=371), WV GIS Technical Center | address, year built, lot | Already stored for all 55. |

## No statewide file

| State | What exists | Note |
|---|---|---|
| AL | [None found](https://www.revenue.alabama.gov/property-tax/county-offices-appraisal-assessment-records/) (Department of Revenue directory) | State agencies license a vendor's parcels; no public file found. Records law is limited to Alabama residents. |
| AS | [None](https://legalaffairs.as.gov/public-records-1) (Territorial Registrar) | Most land is communal. FEMA's Region 9 note says parcel data isn't available here. |
| AZ | [None public](https://server.azgeo.az.gov/arcgis/rest/services/az911/AZ911_Parcel_Provisioning_Boundary/MapServer/0/iteminfo) (AZGeo, NG911 parcels) | AZGeo's NG911 parcel work is reserved for public-safety staff. Arizona law requires a stated commercial purpose on records requests (A.R.S. 39-121.03). |
| CA | [None usable](https://www.arcgis.com/home/item.html?id=2061fbc963464c5198ec064100802624) (CAL FIRE holds an APN-and-address view) | CAL FIRE's public view has APN and address only, no terms, and a column named for a commercial parcel vendor. FEMA Region 9's point layer has year built but columns named for a commercial source. Both stay out under D2. California counties are the route. |
| GA | [None found](https://dor.georgia.gov/county-property-tax-facts) (Georgia DOR county directory) | No state file found. Most counties use qPublic. The Clerks' Authority holds a statewide sales filing index (PT-61), sold by subscription. |
| IA | [Iowa Statewide Parcel Data, 2017](https://services3.arcgis.com/kd9gaiUExYqUbnoq/arcgis/rest/services/Iowa_Parcels_2017/FeatureServer/0) (University of Iowa copy) | 2017 boundaries, class and deed holder, no facts. Not worth building. Iowa's assessors are mostly on Beacon. |
| IL | [None found](https://tax.illinois.gov/localgovernments/property.html) (Illinois DOR) | No state file found. Cook is stored. Illinois law has a commercial-purpose step for FOIA requests (5 ILCS 140/3.1). |
| KS | [No free statewide file; state sells CAMA](https://www.ksrevenue.gov/pdf/pvd75.pdf) (Department of Revenue, Property Valuation Division) | Not free, but a state route: 93 of 105 counties are hosted by the state, and a records request gets virtually all CAMA fields at $250 a county with sales, plus a typical $500 programming fee. See other-routes.md. |
| KY | [County layers only](https://www.arcgis.com/home/search?q=owner%3AKentucky_DGI%20parcel) (Division of Geographic Information) | DGI's hub has parcels for some counties, without assessment facts in the one opened. A 2020 legislative briefing said statewide parcels were still needed. |
| LA | [None found](https://www.louisianaassessors.org/a-district-directory-by-parish/) (Louisiana Assessors' Association directory) | No state file. The Attorney General has said assessment rolls on computer are public records, even for a requester who sells them (Op. 87-301, 90-330). |
| MI | [State layer is internal only](https://www.michigan.gov/dtmb/services/maps/mgf-data-hub/boundaries-and-mgf/boundary-faqs) (Department of Technology, Management and Budget) | The state says its parcel layer is internal only and points to each county. Assessing is by city and township, often on BS&A's site, whose terms ban scraping. |
| MO | [None found](https://stc.mo.gov/directories/) (State Tax Commission directory; MSDIS) | No statewide assessor parcel layer confirmed on MSDIS. St. Louis County's own layer is a lead (other-routes.md). |
| MP | [None found](https://dlnr.cnmi.gov/land-registration-and-survey.html) (DLNR Land Registration and Survey) | No public file found. FEMA's Region 9 note says parcel data isn't available here. |
| NM | [None found](https://www.tax.newmexico.gov/About-Us/Property-Tax-Division/) (Property Tax Division) | No statewide file found. Bernalillo is stored. |
| OK | [None found](https://oklahoma.gov/tax/ad-valorem.html) (Tax Commission, Ad Valorem Division) | No state file found. Oklahoma and Tulsa are stored. Records law can price commercial requests higher (51 O.S. 24A.5). |
| OR | [Statewide taxlots are for state agencies](https://omls.oregon.gov/pipermail/gpl_list/2021-April/001431.html) (Oregon Department of Revenue, ORMAP) | State notices say the statewide file goes to agencies with credentials. A Forestry map service shows taxlots with addresses and owners, but it's a display service, not a release. Metro and Deschutes are stored; others are county by county. |
| PA | [No statewide file; PASDA holds some counties](https://www.pasda.psu.edu/) (Penn State's PASDA clearinghouse) | County by county on PASDA, with no facts in most. Pennsylvania's law lets agencies price property-assessment data at market value (65 P.S. 67.1307(b)(4)). |
| PR | [CRIM Catastro Digital](https://catastro.crimpr.net/cdprpc/help/CDPRPC_ManualUsuario_20200708.pdf) (Centro de Recaudación de Ingresos Municipales) | CRIM's web app is free to view and sells map products. Planning Board's crim_parcelas service didn't answer with layers. A bulk extract must be asked for. |
| SD | [None found](https://dor.sd.gov/government/director-of-equalization/contact-county-directors-of-equalization/) (Directors of Equalization) | No state file found. |

## Looks statewide, stays out

- **California Statewide Parcels Public View** (CAL FIRE, 13,138,000 parcels): APN and address only, no terms, and a
  column named for a commercial parcel vendor's ID. Even if public, it adds no facts. Out under D2.
- **FEMA Region 9 "Property - Structures - Static" points** (13.7M residential points with year built in California,
  Arizona, Nevada and Hawaii): its columns carry a commercial data vendor's naming, so the year built likely comes from a
  reseller. Out under D2 until FEMA says otherwise.
- **Iowa 2017, Nevada 2018:** too old to show; Nevada's is useful only for address matching.
- **Oregon Forestry's taxlot display service:** a display for state staff, not a release. Oregon's own notices say the
  statewide taxlots go to agencies with credentials.

## What I couldn't confirm

- Tennessee's Assessment_Data fields: the dictionary comes only inside a download, which needs a person's form.
- Montana's bedroom and bath fill: the counts sit inside SQL Express databases I didn't open.
- Indiana: whether DLGF or a county has adopted a rule limiting commercial use of files issued on disk (IC 5-14-3-3(e)).
- Arkansas GeoStor's and Rhode Island's terms pages: both load only in a browser.
- Wisconsin's yearly transfer data: the Department of Revenue's download sits behind its tax-account site, which needs
  cookies and a person.
- Vermont's year built fill: the E911 layer refuses count queries without a token.
- Whether South Carolina's statewide layer, served inside a county-boundary project, is meant for public reuse.
- Puerto Rico: CRIM sells map products; whether it will sell or give a bulk roll extract is a question for CRIM.
- Each county inside a statewide compilation may have its own terms on its own files; the state's posting was read, not
  each county's.

## Sources

All read November 7, 2026 (UTC), except where a document gives its own date.

- Storage: private bucket `pantopus-property-index`, `index/states/*.json` and release reports, read with the reader key.
- Census: [county estimates 2024](https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv);
  [state estimates 2024](https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/state/totals/NST-EST2024-ALLDATA.csv);
  [ACS 2020-2024 housing units, table B25001](https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b25001.dat);
  [2020 Census Island Areas counts](https://census.gov/library/stories/2021/10/first-2020-census-united-states-island-areas-data-released-today.html)
  (Guam 153,836; Virgin Islands 87,146; American Samoa 49,710; Northern Mariana Islands 47,329).
- Each file's own page is linked in the tables above. Further pages read:
  [Tennessee Comptroller parcel data](https://comptroller.tn.gov/office-functions/pa/gisredistricting/redistricting-and-land-use-maps/parcel-data.html);
  [Tennessee public-use service](https://www.arcgis.com/home/item.html?id=e356f1a241844d6f9025f2fa4e977df3);
  [Indiana Gateway file documentation](https://gateway.ifionline.org/guides/downloads/property-file-documentation.xlsx);
  [50 IAC 26, the file layout](https://gateway.ifionline.org/guides/50_IAC_26.pdf) (read by OCR);
  [DLGF data FAQ](https://In.gov/dlgf/files/230801-FAQ-Data-Mailbox.pdf);
  [Wisconsin V12 page](https://www.sco.wisc.edu/parcels/data/) and
  [V12 service item](https://www.arcgis.com/home/item.html?id=2386813b23ea4e51a009f7d1d6b76e02);
  [OPEN-NY terms of use](https://data.ny.gov/download/77gx-ii52/application%2Fpdf);
  [Montana cadastral page](https://www.msl.mt.gov/geoinfo/msdi/cadastral/) and
  [Orion CAMA data dictionary](https://ftpgeoinfo.msl.mt.gov/Data/Spatial/MSDI/Cadastral/Documentation/Orion%20CAMA%20Documentation/OrionCAMADataDictionary.xlsx);
  [Maryland CAMA Core columns](https://opendata.maryland.gov/api/views/w26w-g63e.json);
  [Kansas PVD-75 CAMA request form](https://www.ksrevenue.gov/pdf/pvd75.pdf);
  [Michigan DTMB boundary FAQ](https://www.michigan.gov/dtmb/services/maps/mgf-data-hub/boundaries-and-mgf/boundary-faqs);
  [Oregon statewide taxlot notice, 2021](https://omls.oregon.gov/pipermail/gpl_list/2021-April/001431.html);
  [FEMA Region 9 building points item](https://www.arcgis.com/home/item.html?id=712097874f5740a3a8d1865cab585f84);
  [CRIM Catastro Digital user guide](https://catastro.crimpr.net/cdprpc/help/CDPRPC_ManualUsuario_20200708.pdf);
  [Kentucky 2020 legislative GIS briefing](https://apps.legislature.ky.gov/CommitteeDocuments/341/12814/Oct%2020%202020%20KyPVATaskForceGIS.pdf).
