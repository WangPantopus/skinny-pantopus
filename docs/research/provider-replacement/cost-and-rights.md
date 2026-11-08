# Cost and rights

November 5, 2026. Planning figures and terms as published or quoted on that date; nothing was bought, no supplier was
contacted, no paid lookup was made. Merges #3433's cost model and rights review with #3418's prices.

## 1. Where Pantopus stands

| Vendor | What Pantopus has | Monthly cost |
|---|---|---|
| ATTOM | Kept in the founder's private notes, outside this public repository | No paid plan |
| Smarty | No paid agreement (founder, November 5); a key exists on the founder's machine; production has had no key since Oct 9 | $0 |
| Google Address Validation | Already called with USPS CASS; billed per request (the SKU is a founder-only fact); no production key since Oct 9 | Per request |
| Lob | Developer plan, no monthly fee; about $0.87-0.91 per 4x6 postcard with postage (first pass); no production key since Oct 9 | Per piece |

## 2. What replacing ATTOM costs

#3433's planning model, at 10,000 distinct property opens a month (editable in
[studies/sourcing-and-cost.xlsx](studies/sourcing-and-cost.xlsx)). Scenarios, not quotes:

| Approach | Build, including setup | Running per year, including labor | Year one | Cash in year one if the founder supplies the labor |
|---|---:|---:|---:|---:|
| **Public records first, nationwide lookup, gaps said plainly** (the founder's direction) | $47,500 | $30,480 | $77,980 | $5,400 |
| Public records plus a metered property API | $55,800 | $49,904 | $105,704 | $15,424 |
| A national bulk license plus metered values | $120,000 | $172,240 | $292,240 | $116,680 |

The second and third rows are subscriptions again; they are kept only to show what the public route avoids.

**Where the public-first money goes.** 500 hours of engineering, GIS and review to build ($44,500 of labor value) and
28 hours a month to run ($28,080 a year), payable only if someone is hired; plus a $3,000 setup allowance and about
$200 a month of storage, compute, backups and serving. No data fees. It funds the first connectors and nationwide
handling of gaps, not every county.

**Scale.** At the model's rates ($105 an hour engineering, $80 GIS, $55 review), three engineer-days per additional
source mapping and four GIS hours a quarter to keep it, 100 more mappings cost about $252,000 to build and $128,000 a
year to keep. One statewide mapping can serve dozens of counties, and connectors are built in order of unanswered
lookups, so the real count grows with demand.

**Storage, sized roughly** (to be measured in WP5): about 150 million address points and 140 million parcels at roughly
120-150 bytes each compressed is on the order of 40 GB per release, about 80 GB with the previous release kept. On
S3-compatible storage that is a few dollars a month plus small per-request charges for range reads, inside the model's
$200 allowance.

**A value estimate (D9).** #3433 sized a full in-house residential estimate at about $57,200 of initial labor and
$51,360 a year, before any sales-data rights. The founder decided on November 7 to show one everywhere we can; WP12
builds a simpler version from official values and public sales.

## 3. Prices found, for decisions only

None is automatic; each is a founder decision recorded in [decisions.md](decisions.md):

| Item | Price | Notes |
|---|---|---|
| USPS Address Management System license | About $7,570 a year (first pass) | Runs on Pantopus's server; worth it past about 40,000 checks a month |
| USPS ZIP+4 reference (all states) | $1,750 a year | A reference file, not a postal processor or display rights |
| County files where nothing is free | Fresno CA $15,492; Greenville SC $500; Lancaster PA $50 or $500; Johnson KS $100 a year; Knox TN $100 per map tile; Clark NV $7,500 a year (GIS subscription); Cobb GA parcel shapes $22,000 | [evidence/uncovered-counties.csv](evidence/uncovered-counties.csv) |
| Reseller copies of county files | About $200-300 per county | For counties with lookup sites only |
| Public-records requests | Copying cost; terms vary by state | To be priced for the 20 largest uncovered counties (D2) |
| MLS access | For example $1,000 setup plus $1,200 a quarter at one MLS, plus a broker relationship | Not recommended now |
| National bulk property license | From about $80,000 a year (one published listing) | Not recommended: a subscription |
| Metered property API | For example about $202 a month for 5,100 calls (one published tier) | Not recommended: a subscription that bills on misses |

**Smarty and Lob have their own economics.** Dropping Smarty leaves Google's per-request charge (one request instead
of two systems). Mail is measured as cost per verified household: printing, postage, reissues, returns and support
time; Block Founders invitations get their own budget and switch.

## 4. Rights register

Every source passes this before production use. "Checked" means the terms were read on the date shown.

| Source | What the terms allow | What they forbid or require | Status |
|---|---|---|---|
| ATTOM | Kept in the founder's private notes, outside this public repository | See section 5 | Founder |
| Google Address Validation | Keeping the address, USPS data and components 30 days for later transactions, then delete or replace with what the person confirmed; confirmation flags 30 days for correction requests; coordinates 30 days, then delete; place IDs indefinitely | No artificially-created US or Puerto Rico addresses (Google stops USPS checks and reports the account to USPS); attribution when Google content is shown | Checked November 5 (non-EEA service terms, modified October 28, 2026); section 6 |
| Smarty | As the published terms say; the founder signed no paid agreement | The published agreement restricts competitive development, benchmarking and compiling databases (sections 6-7) and has duties after termination; never build a registry from Smarty answers, and don't score Google against Smarty | Founder confirmed no paid agreement, November 5 |
| Lob | Printing and mailing (terms of August 14 and July 6, 2026) | Customer data stays Pantopus's; piece data is deleted at 90 days, so Pantopus keeps its own record of each piece. Performance information is Lob's confidential information, so printer results stay out of Git. The API section bars "any product evaluation, benchmarking, or other comparative analysis", so the founder asks Lob in writing before any comparison. A complaint about a mailpiece can suspend the account, with a fee of up to 10% of annual spend, so invitations can route to a different printer | Checked November 6; founder's question to Lob open |
| PostGrid | Candidate second printer, off | No benchmarking or competing-product clause found. Returned-card tracking is listed for Enterprise only | Checked November 6; founder's questions open |
| Stannp | Fallback candidate, not built | Reverse-engineering clause; no benchmarking or competing clause found. First-Class is an add-on with no published price | Checked November 6 |
| USPS (AMS, DPV, CASS) | A licensed local engine with periodic updates | Field of use, display, retention, replicas and exit in writing | Later, if AMS is chosen |
| County and state files | Per source | King County: no redistribution without permission (and Washington's commercial-use acknowledgement before download); SanGIS: its own license; DuPage: written permission; Will County: no redistribution without written permission; Stanislaus and KGIS: own use only; Los Angeles County: its terms of use; Arizona: commercial-purpose declaration for records requests; Washington (RCW 42.56.070): no commercial use of lists of individuals | Per connector, before its first release |
| County and city files with their own connector | Stated open: San Francisco (PDDL), Allegheny (CC0), Ramsey (public domain), Adams, DC, Denver, Milwaukee, DeKalb, Charlottesville and Utah's parcels (CC BY, credited on the web's [data sources page](../../../frontend/apps/web/src/app/(site)/about/data-sources/credits.json)), Los Angeles's license (a citation format is recommended, also on that page), Deschutes ("free to download and use"), Metro RLIS for Multnomah, Washington and Clackamas (credit Metro). Published with disclaimers and no limit stated: Cook, Riverside, San Joaquin, Contra Costa, Montgomery PA, Franklin, Cuyahoga, Summit, Montgomery OH, Hamilton, Oklahoma, Tulsa, Jackson, Miami-Dade, Broward, Hillsborough, Sarasota, Seminole, Mecklenburg, Guilford, Wake, Monroe NY, Douglas NE, Davidson, Bernalillo, Pierce, Madison, Bexar, Travis, Collin, Denton, Fort Bend, Hidalgo, Montgomery TX, Cameron ("considered in the public domain"), Nueces, Kaufman, Grayson, Liberty, Atascosa, Bell, Gregg, Bastrop, Smith, Brazos, Johnson TX, Ector, Skagit, Lincoln NC | Hold-harmless or indemnity on the user: Philadelphia, Oakland, Detroit, Los Angeles. San Diego: say "derived from SanGIS". San Bernardino: its property files' page opens a "Limitation of liability" paragraph with "maintained for internal use only in the determination of property value for the purpose of taxation", then speaks of "the recipient of this data" and "their application"; it states no license and no limit on use, and offers the files free to anyone (read November 7). That is a disclaimer, not a restriction; a confirming email to the Assessor is optional. Taylor TX's page says its files were developed for internal use and not for resale, in its disclaimer; nothing here resells them. Texas: a protected person's account (Tax Code 25.025) is left out. Washington: no names are read (RCW 42.56.070(8)). Waiting on written permission or the founder: Fairfax, King, Spokane, Snohomish, Lee, Washoe, Maricopa, Pinal, Polk IA, El Paso TX, El Paso CO, Arapahoe, Chester, Douglas CO (share-alike) | Checked November 6 and 7; going live is the founder's, county by county |
| County connectors read November 7 (second batch) | Sonoma CA: "share ... for any purpose, even commercially" with credit to "County of Sonoma" and changes noted (credited on the data sources page; the record says "reformatted"). Berks PA: data in its original format may not be copied or redistributed, and a product citing it says "Information is based on geospatial data from the County of Berks", which the record's dataset line does (also on the data sources page). Chesterfield VA: errors disclaimed, no limit on use stated. St. Charles MO: no terms stated; the county's own ArcGIS organization publishes the open data layer | Berks: never redistributed as its file. St. Charles: Missouri keeps sale prices out of public records, so none are read; its main web host answers scripts with a bot challenge, which is never worked around | Checked November 7; going live is the founder's, county by county |
| County connectors read November 7 (third batch) | Boulder CO: the Assessor's free data download, rebuilt nightly. Its page and help manual say the data was "developed solely for internal use only by Boulder County" and disclaim warranties and liability; they state no license and no limit on use, and the county's privacy policy adds none (the same reading as San Bernardino's). Henrico VA: the county's terms of use for its data grant no license and forbid nothing; the data is as is. York SC: the county offers its GIS data "at no cost" and its services for "your own application"; its layers disclaim warranties, and its open data site states no license. Not built: Weld CO (its Assessor download carries only a disclaimer, but the county site's privacy statement and disclaimer says "Using or modifying this site's information for personal or commercial purposes is prohibited"); Lorain OH (its Auditor's open data terms: no release to any other entity without written approval, no display on any other website); letters asking permission are drafted, not sent. Larimer CO's data page answers scripts with a bot challenge, which is never worked around | Henrico: the user indemnifies and defends the County, and the County may end any display of its data or of a work built on it. York SC: South Carolina bars using personal information from public bodies for commercial solicitation (S.C. Code 30-2-50): no owner column is read. Boulder: owner and mailing columns are never read | Checked November 7; going live is the founder's, county by county |
| County connectors read November 7 (fourth batch) | St. Louis County MO: the Assessor's parcel data on the county GIS Service Center's open data site; its notice disclaims warranties and asks users to hold the county harmless, and states no license and no limit on use. Cumberland County PA: its tax parcel layer, published "as a public information service" with a no-warranty notice and no limit on use. Cumberland County NC: its GIS terms of use disclaim warranties and call the site "a public service to the citizens of Cumberland County and to the Internet Community"; they state no limit on use and ask for none of the agreement G.S. 132-10 allows. Kitsap County WA: the Assessor's weekly data files, each with its layout; the download page and the county's website policies state no limit on use | St. Louis County: users hold the county harmless; Missouri keeps sale prices out of public records, so none are read. Cumberland NC: its server's firewall refuses some filtered queries, so rows are read in plain object ID pages. Kitsap: its files carry no owner names, and none would be read (RCW 42.56.070(8)) | Checked November 7; going live is the founder's, county by county |
| County connectors read November 7 (fifth batch) | Stark County OH: the Auditor's CAMA export on the county's GIS downloads page, where "It is the Stark County Auditor's Office policy to make all data available for public use"; the county's website terms let its materials be used subject to law and any restriction stated with them, and none is stated for this file | Owner, billing, tax payment and delinquency columns are never read, nor the transfers' grantor and grantee; the terms bar automated use that unreasonably burdens county systems, and the build downloads one file | Checked November 7; going live is the founder's, county by county |
| County connectors read November 7 (sixth batch) | Delaware County OH: two of the county's own GIS layers, its 2026 revaluation parcel layer (parcel numbers, living area, bedrooms, baths, values) and its monthly parcel layer kept by the Auditor's GIS office (year built, stories, sales), each "made available as a public service" under the county's disclaimer, with no license and no limit on use stated. A third layer with parcel numbers and year built carries a consultant's copyright line, so it isn't read. Iredell County NC: its tax parcel layer; the county's map use notice says the maps come from public records, should be verified and are used at the user's own risk, and states no limit on use. Onslow County NC: its parcel layer with tax records; its notice says the county isn't liable for errors and the data isn't a legal document, credited to "Onslow County GIS Department", no limit on use. Neither North Carolina county asks for the agreement G.S. 132-10 allows. Not built: Linn County IA, whose Assessor layers say "No person shall sell, give, reproduce, or receive for the purpose of selling or offering for sale, any portion of the data provided herein"; a written question is drafted, not sent | Delaware: the user waives, releases and indemnifies the county. Owner and mailing columns are never read in any of the three | Checked November 7; going live is the founder's, county by county |
| County connectors read November 7 (seventh batch) | Greene County OH: the Auditor's parcel data on the county's GIS open data service; its disclaimer says the data locates, identifies and inventories parcels for appraisal and taxing and isn't a legal description, that accuracy isn't guaranteed and the county isn't liable; no license and no limit on use stated (a written question about the "appraisal and taxing" wording is drafted, not sent). Fairfield County OH: the Auditor's parcel boundaries; its GIS downloads page says the data comes from public records and isn't warranted for content, completeness, accuracy or fitness for any use, with no license or limit stated; the heat, wall and basement words come from the code tables in the Auditor's free CAMA download. Mesa County CO: its tax parcels on the county's open data service; the county distributes its GIS data "as a service to the public" to promote sharing among governments and private GIS users and asks only non-commercial users to share back data they make. Scott County MN: its parcels on the county's ArcGIS Online; the disclaimer (Minnesota Statutes 466.03, subd. 21) says the data is for reference, isn't guaranteed, and the user waives claims and indemnifies the county; no limit on use. Not built: Arlington County VA, whose open data portal links to the county website's terms, which allow downloads for "non commercial, personal use only" and bar reuse without written permission; Peoria County IL, whose open data license page needs a sign-in; Butte County CA, whose assessor layer is a personal account's export | Owner, taxpayer, mailing, grantor and grantee columns are never read in any of the four | Checked November 7; going live is the founder's, county by county |
| County connectors read November 8 (eighth batch) | Solano County CA: the county's public parcel layer with Assessor characteristics, on its own ArcGIS Online, updated monthly; its disclaimer says the user takes the data as is, the county makes no warranty and disclaims liability, and the data isn't survey grade; no license and no limit on use stated. The layer holds no owner names, and its homeowner exemption column is never read. Not built: El Dorado County CA, whose parcel layer says its results "are not to be redistributed unless agreed upon with the originator" (and it records no baths); Kenosha County WI, whose data portal links to website terms that keep material "for the noncommercial use of the general public" and ask for permission otherwise; written questions for both are drafted, not sent | Solano: the county's disclaimer only | Checked November 8; going live is the founder's, county by county |
| County connectors read November 8 (ninth batch) | Woodbury County IA: the parcel table published by WCICC-IT GIS, the IT agency Woodbury County and Sioux City run together, with both assessors' rows; its item says "Public use allowed" and states no other term. Napa County CA: the county's public parcel layer with Assessor characteristics, made available under the Open Data Commons Public Domain Dedication and License (PDDL) 1.0. Montgomery County VA: the county's open data tax parcels, shared by its Planning & GIS Services on behalf of the Commissioner of the Revenue with owner names left out by the county; its notice says the data is for reference only, isn't guaranteed and the county isn't responsible for its use; no license and no limit on use stated. Roanoke County VA: its "Parcels Open Data" layer, which joins each address to the parcel's CAMA and tax records; the item states no license (the county's other parcel items are CC BY), and the county's layer notice disclaims warranties and damages and says the data is for information purposes only; no limit on use stated. Not built: Berkeley County WV, whose Assessor's export says "Use by Licensed Authorized Agents ONLY" and that copying, distribution or sale without the Assessor's written permission is prohibited (a written question is drafted, not sent); Grant County WA, whose residential characteristics layer holds the 2023 roll; the survey's "Adams County PA" layer is Adams County CO's (already built) and its Lycoming County PA layer is a consultant's copy | Owner, deed holder, mailing, homestead, exemption and protected-owner columns are never read, nor values net of exemptions; Woodbury's occupancy column (owner-occupied or rented) only sorts homes and is never shown | Checked November 8; going live is the founder's, county by county |
| Statewide parcel and assessor files | Stated open or no restriction found: MassGIS parcels; Boston and Cambridge assessor files (PDDL); NYC PLUTO (Admin. Code 23-502(d), no restrictions on use); New York's public parcels, only the 33 upstate counties it lists as authorized; Connecticut's parcels and CAMA; Maryland (public domain); Utah's LIR parcels; Texas's StratMap parcels; Minnesota, only counties its state table marks open (59 of 87); North Carolina OneMap, and the building layer it lists, parcel or appraisal figures only; Maine; Montana; West Virginia; Williamson CAD (no terms stated) | Owner, mailing, taxpayer, grantor and homestead columns are never requested. Texas's owner column is read only for the protected marker under Tax Code 25.025, then dropped, and those accounts carry no facts. New Jersey asks for acknowledgement, its web conditions of use are still to read, and Daniel's Law means no address tied to a person. Montana: no list of persons kept (MCA 2-6-1017). Credit each publisher. Written questions drafted, not sent: West Virginia | Checked November 6 |
| Harris and Tarrant appraisal districts | Harris's page says its data is "available to users for import into other applications". Tarrant's page states no terms | Harris's Public Access Policies pamphlet, read November 7, covers access to its board, and its disclaimer page covers its website: neither says anything about using its data files. Both carry a copyright notice. Published to private storage, off. Written questions drafted, not sent; neither county goes live before they're answered | Read November 6; open |
| U.S. DOT National Address Database | Federal work, no copyright, re-use without limitation; CC0 on data.gov | Not to be used as a mailing list: nothing in Pantopus mails from the registry. As is. Credit DOT, Census and partners | Checked November 6 |
| Overture Maps addresses | Per row: public domain, CC0, PDDL, CC BY 4.0; "proprietary" read per source | No OpenStreetMap data in this theme; each row's dataset is checked; CC BY needs credit | Checked November 6 |
| OpenAddresses sources | Per source, in `scripts/property-index/sources/address/openaddresses-rights.json`: 179 clear | Share-alike, no-sale and internal-use sources stay out; sources stating nothing stay out until someone asks | Checked November 6 |
| County address points | Clark County WA: public layer, disclaimers only. Held until read: San Diego, Stanislaus, Kent, Allegan and Muskegon MI, Carson City | | Per county |
| Federal data (Census, FEMA USA Structures, USACE NSI) | Public data. FEMA's file states no access or use constraints; ACS is public; NSI is a public download | Credit ORNL and FEMA. NSI keeps its label (modeled). Own index, never a record field | Checked November 6 |
| FHFA House Price Index, annual ZIP and county files | Federal agency's public download; the data.gov entry says public with no license stated; FHFA calls these annual series developmental | Keeps its name on every line; an area's price change, never a home's value or a median sale price | Read November 6; a written question to FHFA is on the founder's list |
| Building floor-plan sheets | Use with the building's written permission | Images only if the owner agrees | Per building |
| Household entries | Pantopus's own privacy policy | Never shown outside the household; never in the shared index | — |
| Mapbox (autocomplete and resolve) | Its geocoding terms | Storage of temporary geocoding results is limited; not changed by this work, but coordinates kept on `HomeAddress` should come from the registry | To check alongside WP6 |

A fee for copying public records and a license to republish them are separate questions; an unauthenticated download
proves only that the file can be read.

## 5. ATTOM

ATTOM's agreement, its status and any steps it requires are kept in the founder's private notes, outside this public repository. No ATTOM content goes into the index, its
mappings or its evaluation sets.

## 6. Google Address Validation: retention

Fields on `HomeAddress` that are Google content, and what happens to each (WP3, WP6):

| Field | Rule | Plan |
|---|---|---|
| The address the person confirmed | Allowed to keep as the person's own data once they confirm it | Keep, marked as confirmed |
| USPS data (DPV, footnotes, flags, ZIP+4) | 30 days, then delete or replace | `postal_checked_at`; a daily job clears older USPS fields, and screens that need them re-check |
| Coordinates | 30 days, then delete | Replaced by Pantopus registry coordinates (address points or parcel centroids) |
| Place ID | Indefinitely | Keep |
| Confirmation flags | 30 days, for correction requests | Clear with the USPS fields |

Google's coordinates are never an input to the national floor by location (WP7): the platform terms (section 3.2.3(c),
read November 7) forbid creating content from Google Maps content and give point-in-polygon analysis with its
coordinates as an example. That floor reads only Pantopus's own registry points, and a stored Google coordinate stays
out unless the founder decides otherwise after asking Google.

Testing follows the "no made-up addresses" rule: synthetic cases run offline through the adapter, never against Google
([parity-and-acceptance.md](parity-and-acceptance.md#principles)).

## 7. The ATTOM transition, county by county

Routing per county:

| County state | Routing |
|---|---|
| Qualified (its gates passed, founder's OK) | The record; zero ATTOM calls there, including background and operator paths |
| Not qualified | Stays as it is until its gates pass; the founder decides what serves it meanwhile |

Tracked per county and property type: latency, errors and ATTOM calls.

## 8. Smarty and Lob exits

- **Smarty:** if an agreement exists, check its post-termination duties (deleting cached Smarty answers:
  `HomeAddress.validation_raw_response.smarty_candidate`, reused 90 days) before WP14.
- **Lob:** keeping Lob per piece costs nothing monthly; retiring it fully needs a chosen second route that passed the
  real-mail pilot. Which one is the founder's choice (D5).
