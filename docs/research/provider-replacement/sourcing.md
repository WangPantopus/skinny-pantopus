# Sourcing: what public data exists nationwide, and where each fact comes from

November 5, 2026. Two studies feed this page, measured the same day with no paid data, no vendor calls and no
Pantopus records:

| Study | Question | What it counts | Headline | Detail |
|---|---|---|---|---|
| County survey (#3418) | Where do Americans live with free bulk building facts? | People, by county (Census 2024) | 55.7% (range 52-61%) have free building facts; 23.2% (21-27%) with bedrooms or baths | [county-survey.md](county-survey.md) |
| Field test (#3433) | Which of Property details' 46 fields can public records fill, by property type? | Assessment records in 8 states | 14,660,226 records; 41 of 46 fields found; 16.3 fields per record on average | [property-fields.md](property-fields.md) |

The two denominators differ (people versus records), so the numbers are not comparable with each other. The field
test's sample was chosen on purpose and can't be projected onto the country; the survey's sample was drawn at random
for exactly that.

A field being present is not proof it is right, and a free download is not a right to show it to users: every source
passes a rights check before use ([cost-and-rights.md](cost-and-rights.md#4-rights-register)).

## 1. Nationwide coverage of free building facts

| Where people live | Share of Americans | People |
|---|---:|---:|
| County or state publishes building facts with bedrooms or baths | 23.2% (21.1-26.7%) | 78.8M |
| Basics only (year built, size, value, sales) | 32.5% | 110.7M |
| **Free building facts of either kind** | **55.7% (51.5-60.5%)** | 189.5M |
| Free file whose building fields could not be opened | 0.4% | 1.3M |
| One city only, or sold homes only | 1.9% | 6.5M |
| The county sells its file or requires permission | 6.5% | 22.0M |
| Only per-property lookup sites (resellers sell the files) | 35.5% | 120.8M |

The 150 largest counties (50.8% of Americans) were classified one by one; the other 2,994 are estimated from a
100-county sample drawn with probability proportional to population. Ranges are 95% sampling ranges. Method, all 250
county rows and the scripts: [county-survey.md](county-survey.md) and [county-survey/](county-survey/).

**Correction (accepted from the #3433 review, November 5):** Dallas County moved from "basics" to "with bedrooms or
baths". #3433 measured the appraisal district's 2026 certified files: bedrooms on 529,857 of 539,442 houses (98.2%),
baths and living area on nearly all, and bedrooms, baths and area together on 92.1% of condos. That moved 2.66M people
and raised the national "with bedrooms or baths" share from 22.4% to 23.2%; the total with free building facts is
unchanged.

Statewide files do most of the work outside the largest counties: Connecticut (CAMA with bedrooms and baths), New York
(parcels with bedrooms where counties share them), Maryland, Massachusetts (MassGIS; Boston and Cambridge add
bedrooms), New Jersey (year built and sale price only), Florida (every county's roll), Utah, Texas (year built
statewide; appraisal districts publish more), Minnesota, North Carolina (only the parcel-derived half counts), West
Virginia, Maine, Montana and Indiana (by request). Sale prices are not public in Texas, Utah, Idaho, New Mexico, Kansas
and Missouri.

## 2. The counties without free building facts

41 of the 150 largest counties (41.9M people) have no free building facts: 19 not found, 15 sell their files or need
permission, 5 publish for one city only, and 2 offer a free file whose fields could not be confirmed. Every row, with
the next step: [evidence/uncovered-counties.csv](evidence/uncovered-counties.csv).

Prices found so far (one-time unless noted): Fresno CA $15,492 for the characteristics file (5 cents a parcel);
Greenville SC $500 for the county GIS set; Lancaster PA $50 basic or $500 with the structure file; Johnson KS $100 a
year; Knox TN (KGIS) $100 per map tile, own use only; Clark NV a $7,500-a-year GIS subscription; Cobb GA's tabular file
is free on its FTP site (fields unopened) while its parcel shapes cost $22,000. Across the smaller "not found"
counties, resellers sell the county file for about $200-300 each. Many of these files can also be requested under
public-records laws, at copying cost; commercial-use terms vary by state.

The founder has not chosen how to fill these places (decision D2 in [decisions.md](decisions.md)). The recommended
floor is household entries plus labeled estimates, and pricing public-records requests for the 20 largest uncovered
counties as research only.

## 3. Field fill by property type

From #3433's field test across eight states (Florida's 67 county rolls, Massachusetts' 350 town files plus Boston, Los
Angeles, Cook, Dallas, King, New York City, Philadelphia):

| Property type | Records | Fields of 46 found, on average |
|---|---:|---:|
| House | 11,245,408 | 17.0 |
| Townhouse or rowhouse | 460,040 | 20.2 |
| Condo | 2,685,854 | 12.9 |
| Apartment building or complex | 166,891 | 14.9 |
| Office property | 102,033 | 15.5 |

41 of the 46 fields had a usable direct, derived or explicitly qualified value somewhere. The five never found: the
ATTOM ID and the four value-estimate fields (estimate, range, confidence, date). Every field by type, with the scoring
rules: [property-fields.md](property-fields.md).

**Condo interiors vary by county** (this replaces the earlier "county records rarely hold condo interiors", which was
wrong as stated). Bedrooms, total baths **and** unit living area on the same record:

| County source | Condos with all three | Share |
|---|---:|---:|
| Dallas | 37,705 of 40,930 | 92.1% |
| Boston | 70,968 of 74,229 | 95.6% |
| Cook | 53,073 of 372,656 | 14.2% |

Cook's condo file holds bedrooms alone for 53% of units and size for 39% (#3418's count, parking and common areas
excluded). New York City's tax lots aggregate condo units to a billing lot, so no unit facts come from there. Where a
county doesn't record a unit's interior, county-based sources (ATTOM included) have nothing to give; that is where
listing sites use MLS and rental feeds ([unit-facts.md](unit-facts.md)).

Facts that are useful but mean something else stay under their own labels and never fill a unit's field: King County's
**average** unit area on 6,995 apartment complexes, Los Angeles' **main square footage** on 256,456 of 256,917 condos,
Florida's **effective improvement area** on 1,611,419 of 1,616,522 condos
([evidence/additional-measures.csv](evidence/additional-measures.csv)). For houses, all six headline tiles appear on
the same record for 470,353 of 470,599 King accounts, 27,491 of 27,517 Boston accounts and 336,866 of 539,442 Dallas
accounts.

## 4. What each property type can show

| Subject | What public records can show | The boundary |
|---|---|---|
| House | Assessor identity, year built, lot, structure, rooms where measured, construction, systems, parking | Living, gross and effective area are different facts; accessory units and outbuildings can change the subject |
| Townhouse or rowhouse | Building form, rooms and land where the unit is assessed separately (Dallas, King and Cook have explicit classes) | Attached form and condo ownership overlap; never count one assessed interest twice |
| Condo | The exact legal unit, sometimes its rooms, area and parking, and the building's year | Common land, shared structures and parking accounts stay separate; a recorded parking space may still need proof of assignment |
| Rental apartment | Address, building or complex, building count, gross area, apartment count, average size where documented | A rented unit usually has no taxable parcel; show its dimensions only from a unit roster or a floor-plan mapping for that unit |
| Office, campus, mixed use | Site, use, year, improvements, gross or rentable area (labeled), systems, assessment | One parcel can hold several buildings; a development total doesn't describe each office |
| Leased suite, other | Facts published for that suite only | No suite cohort was certified; no bedroom tiles or home value defaults |

## 5. Identity: the right unit, or an honest "which one?"

- **Ambiguity is common.** A temporary local index of Cook County's 1,864,469 address rows qualified 1,814,527 with a
  street number, city and ZIP, giving 1,700,036 distinct normalized keys; 69,070 keys matched more than one parcel.
  Taking the first result would show the wrong home's facts for those.
- **The county can pin the exact unit.** For a downtown Chicago condo the founder supplied, Cook's records identified
  the exact unit and its building year; two neighboring units mapped to different parcel numbers; an out-of-range unit
  number matched nothing. The record omitted the unit's rooms and area, which the listing site showed from the MLS.
- **Lookups are fast.** Across 5,000 existing-record probes and 500 misses, the warm local lookup's p95 was 0.011 ms.
  That excludes network, ranking, authorization and rendering; production latency still has to be measured.

These findings set the identity contract in [architecture.md](architecture.md#5-identity-contract).

## 6. How coverage gets built

The order, from #3433, with the founder's no-subscription direction applied:

1. **Accept every US address.** Address points from the U.S. DOT National Address Database (99.2M features, queried
   November 5), then Overture, OpenAddresses and state and county address points, each license-checked; Census TIGER for
   geography. Every place gets an entry and recovery path even where no point or parcel exists: rural routes, tribal
   lands, territories, Puerto Rico urbanizaciones, PO boxes, military addresses.
2. **Register every custodian.** 56 state and territory routes ([evidence/state-routes.csv](evidence/state-routes.csv))
   and 3,235 county-equivalents ([evidence/national-jurisdictions.csv](evidence/national-jurisdictions.csv)). The real
   custodian may be a city, town, parish, appraisal district, state or tribal authority. A directory entry is a lead,
   not coverage.
3. **Statewide rolls before county connectors.** Florida and Massachusetts proved one connector can cover many
   jurisdictions. Then county assessor tables, recorder sales, address-to-parcel tables and data dictionaries. Prefer
   bulk files with stable IDs, documented meanings, dates and display rights. Where a file costs money, record the
   price and leave the field unavailable until the founder decides.
4. **Fill the missing subject.** Units: floor-plan sheets from building managers and residents' own entries
   ([unit-facts.md](unit-facts.md)). Offices: assessor improvement cards. Sales: recorder rules by state. Values: only a
   model measured for that market. Never an automatic paid fallback.
5. **Publish a coverage report** per source, jurisdiction, property type and release: eligible records, unique
   identities, fill by field, same-record intersections, ambiguity, age, suppressed records, unresolved rights. Choose
   the next connector by **unanswered searches from Pantopus users**, not by parcel counts.

## 7. Data source catalog by job

Status words: **in use** (the code calls it today), **checked** (opened in this research), **planned** (in the design,
terms still to verify), **founder decision** (costs money or needs an agreement). Never seed Pantopus's record from
ATTOM, Smarty or Google output; owner names are dropped when any file is read.

### Can mail arrive here? (replaces Smarty)

| Source | Gives | Terms and cost | Status |
|---|---|---|---|
| Google Address Validation with USPS CASS (already requested) | Standardized address, DPV, footnotes, vacancy, CMRA, no-stat, record type, carrier route, ZIP+4; home, business and PO-box flags | Per request (billing SKU is a founder-only fact); results kept at most 30 days; no made-up addresses | In use; Phase 1 makes it the only check |
| USPS Address Management System license | The USPS database on Pantopus's own server | About $7,570 a year (first pass); worth it past about 40,000 checks a month | Founder decision, later |
| Redeemed and returned postcards | Proof that mail reaches an address and unit, or doesn't | Ours | In use |

### Does the address exist, and which units?

| Source | Gives | Terms and cost | Status |
|---|---|---|---|
| U.S. DOT National Address Database | Address points from states and counties | Free; coverage varies by state | Planned |
| OpenAddresses | Address points from local governments | Free; per-source licenses, checked one by one | Planned |
| Overture Maps addresses | Address points (126.3M US points listed; coverage described as partial) | Free; per-source licenses; anything derived from OpenStreetMap stays out | Planned |
| State and county address points | Official points, often with unit numbers (Clark County WA: 250,271 points, 70,569 with a unit) | Free; per-source terms | Planned, per county |
| Pantopus postcards | Proven units | Ours | In use |

### Home or business?

| Source | Gives | Status |
|---|---|---|
| Google's `metadata.residential` / `business` / `poBox` (same request) | Yes, no, or unknown | In use after Phase 1; unknown handled by the rule in decision D1 |
| County land-use codes | The parcel's legal use | Planned |
| USACE National Structure Inventory occupancy | A **modeled** occupancy type per structure | Planned, advisory only |

### Building facts (replaces ATTOM `/property/detail`)

| Source | Gives | Coverage | Status |
|---|---|---|---|
| County assessor files and services | Year built, size, stories, bedrooms, baths, heat, roof, garage, sales, values (varies) | 23.2% of Americans with bedrooms or baths; 32.5% basics | Checked (survey and field test) |
| Statewide files (section 1) | As listed | Whole states | Checked |
| Cook County condo and commercial files | Condo bedrooms (53%) and size (39%); rental towers' unit mix by bedroom count | Cook County | Checked |
| USACE National Structure Inventory | **Modeled** size, stories, year built and value per structure | Nationwide | Planned; shown only as a labeled estimate, never in a record field, until measured against county records |
| FEMA USA Structures | Footprints with height and use, for the Today house outline | Nationwide | Planned; terms to verify |
| Census ACS (block groups) | Median year built, rooms, bedroom mix | Nationwide | Planned; neighborhood statistics only, never a home's fact |
| Verified households | Their own home's facts and corrections | Every verified household | Planned ([architecture.md](architecture.md#7-fact-precedence-field-by-field)) |
| Building floor-plan sheets | Unit number to plan (bedrooms, baths, size) | Buildings whose managers share them | Planned ([unit-facts.md](unit-facts.md)) |
| County files bought or requested | Full assessor files where nothing is free (section 2) | 41.9M people in the largest counties alone | Founder decision |

### Value and price trend (replaces ATTOM `/attomavm/detail` and `/salestrend/snapshot`)

| Source | Gives | Limits | Status |
|---|---|---|---|
| County assessed and market values | The assessor's value with its tax year (Washington assesses at 100% of market) | Assessment practice varies by state | Planned |
| County and state recorded sales | Sale price and date where public | Not public in TX, UT, ID, NM, KS, MO | Planned |
| FHFA House Price Index (ZIP and county, annual) | **Price change** for an area: 14,200 ZIPs with their own number and 16,800 more through their county, in the 2025 file | Not a home's value and not a ZIP median sale price; labeled as an area index. Tract would need each home's tract, which a Home doesn't keep | Built (WP12), off until `VALUE_AREA_TREND` |
| Pantopus estimate | A value from the three above | Shown only where its error has been measured on held-out sales | Planned, optional (decision D9) |

### Mail (Lob)

| Source | Gives | Terms and cost | Status |
|---|---|---|---|
| Lob | Prints and mails verification and Block Founders cards; delivery events | Developer plan, no monthly fee; about $0.87-0.91 per 4x6 postcard with postage (first pass); live key and return address are founder-only | In use |
| A second print-and-mail provider (PostGrid is one candidate) or a local printer with USPS induction | The same cards | Per piece; not chosen or priced | Founder decision (D5) |

### Apartment and condo units

| Source | Gives | Status |
|---|---|---|
| Building floor-plan sheets | Every unit number mapped to a plan | Planned; free with the building's permission |
| Residents | Their own unit | Planned |
| Rental listing feeds | Unit facts, rents, plans | Later, only if Pantopus shows rentals; needs partner agreements |
| MLS (IDX, VOW or back-office license) | Facts and photos for homes listed in recent years | Not recommended now: a broker relationship and fees per MLS (for example $1,000 setup plus $1,200 a quarter at one MLS) |

### Never used as a source

ATTOM, Smarty and Google output (never copied into Pantopus's record or used as evaluation truth); OpenStreetMap and
other share-alike (ODbL) data; listing sites (not scraped).

## 8. Registers and evidence

| File | What it holds |
|---|---|
| [evidence/property-data-sources.csv](evidence/property-data-sources.csv) | The 58 county (53) and state (5) sources opened in the survey's second pass: link, contents, terms caveat |
| [evidence/source-register.csv](evidence/source-register.csv) | 37 government field definitions, candidate providers, licensing pages and dated price references (#3433) |
| [evidence/county-survey-top150.csv](evidence/county-survey-top150.csv), [evidence/county-survey-sample.csv](evidence/county-survey-sample.csv) | Every surveyed county with category, evidence and source |
| [evidence/uncovered-counties.csv](evidence/uncovered-counties.csv) | The 41 large counties without free building facts, prices and next steps |
| [evidence/government-files.csv](evidence/government-files.csv), [evidence/jurisdiction-fields.csv](evidence/jurisdiction-fields.csv) | The 417 official files read in the field test and 1,476 local cohorts |
| [evidence/README.md](evidence/README.md) | How to audit any number; `verify.py` reconciles the field test offline |

## 9. Beyond today's scope

ATTOM also sells deeds and mortgages, foreclosures, permits, parcel boundaries, schools, hazards and rental values.
Pantopus calls none of them. If a feature ever needs one: deeds and sales from recorder and transfer files; liens from
recorder and court sources; permits from permit offices; boundaries from state and local GIS; neighborhood and hazard
facts from Census and official layers. Each needs its own coverage, rights and accuracy check, and area-level facts
never fill a home's fields.

## 10. Not verified yet

- License terms for each free source (King County and Will County forbid redistribution without permission; KGIS and
  Stanislaus are own-use only; SanGIS has its own license; Arizona requires a commercial-purpose declaration).
- Spokane WA's free files sit behind Washington's commercial-use attestation (opening them needs the founder's OK,
  D8); Cobb GA's FTP file and Medina OH's file (expired certificate) are unopened; Northampton PA and Madison VA rest on
  re-published copies.
- North Carolina's statewide building layer mixes county data with model estimates; only the parcel-derived share
  counts.
- Correctness: presence was measured, accuracy was not (see [parity-and-acceptance.md](parity-and-acceptance.md)).
- A per-state inventory of statewide files beyond those found.
