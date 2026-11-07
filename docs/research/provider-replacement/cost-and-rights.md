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
| County and city files with their own connector | Stated open: San Francisco (PDDL), Allegheny (CC0), Ramsey (public domain), Adams, DC, Milwaukee, DeKalb and Charlottesville (CC BY, credited in the record's footer), Los Angeles's license, Deschutes ("free to download and use"), Metro RLIS for Multnomah, Washington and Clackamas (credit Metro). Published with disclaimers and no limit stated: Cook, Riverside, San Joaquin, Contra Costa, Montgomery PA, Franklin, Cuyahoga, Summit, Montgomery OH, Hamilton, Denver, Oklahoma, Tulsa, Jackson, Miami-Dade, Broward, Hillsborough, Sarasota, Seminole, Mecklenburg, Guilford, Wake, Monroe NY, Douglas NE, Davidson, Bernalillo, Pierce, Madison, Bexar, Travis, Collin, Denton, Fort Bend, Hidalgo, Montgomery TX | Hold-harmless or indemnity on the user: Philadelphia, Oakland, Detroit, Los Angeles. San Diego: say "derived from SanGIS". San Bernardino: its property file says "internal use", so a written question goes first. Texas: a protected person's account (Tax Code 25.025) is left out. Washington: no names are read (RCW 42.56.070(8)). Waiting on written permission or the founder: Fairfax, King, Spokane, Snohomish, Lee, Washoe, Maricopa, Pinal, Polk IA, El Paso TX, El Paso CO, Arapahoe, Chester | Checked November 6 and 7; going live is the founder's, county by county |
| Statewide parcel and assessor files | Stated open or no restriction found: MassGIS parcels; Boston and Cambridge assessor files (PDDL); NYC PLUTO (Admin. Code 23-502(d), no restrictions on use); New York's public parcels, only the 33 upstate counties it lists as authorized; Connecticut's parcels and CAMA; Maryland (public domain); Utah's LIR parcels; Texas's StratMap parcels; Minnesota, only counties its state table marks open (59 of 87); North Carolina OneMap, and the building layer it lists, parcel or appraisal figures only; Maine; Montana; West Virginia; Williamson CAD (no terms stated) | Owner, mailing, taxpayer, grantor and homestead columns are never requested. Texas's owner column is read only for the protected marker under Tax Code 25.025, then dropped, and those accounts carry no facts. New Jersey asks for acknowledgement, its web conditions of use are still to read, and Daniel's Law means no address tied to a person. Montana: no list of persons kept (MCA 2-6-1017). Credit each publisher. Written questions drafted, not sent: West Virginia | Checked November 6 |
| Harris and Tarrant appraisal districts | Harris's page says its data is "available to users for import into other applications". Tarrant's page states no terms | Harris's Public Access Policies PDF is unread. Both carry a copyright notice. Published to private storage, off. Written questions drafted, not sent; neither county goes live before they're answered | Read November 6; open |
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
