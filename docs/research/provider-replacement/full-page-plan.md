# The full Property details page for every address: review and plan

November 11, 2026. A review of what is stored and live, and a proposed plan. Nothing here is built, bought, sent or
switched, and nothing starts without the founder's yes. Decisions it needs are D13-D17 and P6 in
[decisions.md](decisions.md). Counts only: no addresses or owner names. This isn't legal advice. Terms and prices are as
read on the date shown.

Related: [property-fields.md](property-fields.md) (the 46 rows), [missing-facts.md](missing-facts.md) (the gaps ledger),
[fill-routes.md](fill-routes.md), [other-routes.md](other-routes.md), [statewide-inventory.md](statewide-inventory.md),
[lookup-sites.md](lookup-sites.md), [architecture.md](architecture.md#7-fact-precedence-field-by-field),
[build-plan.md](build-plan.md) (WP0-WP16 and the rules every package follows).

## The answer

- **The bar moved.** The founder asked on November 11 for every row of Property details, for every address, and for
  Pantopus to know a home better than its household does. The build so far aimed at six facts.
- **Where we are.** Storage holds 741 counties and 50.2M homes, about a third of the country's homes. 69 counties are
  live with the six facts on 90% or more of houses (16.0M homes, 17.5% of Americans). No county fills every row.
- **County files alone can't reach the bar.** Free files a script may read are nearly used up, the large remaining
  steps are letters and purchases only the founder can make, and a third of Americans live where the county publishes
  only a lookup page.
- **Five layers can.** The county record stays first. Under it: rows derived from the record, rows measured from public
  aerial data, a licensed copy of public records where the founder allows one, and the household's own confirmations
  and documents. Every row names its source and date.
- **One figure in this package was wrong by about 500 times.** A licensed per-home feed charges per request, and one
  request returns up to 500 homes. Pulling every home in the country would cost about $5,000 once, not $450,000
  (section 5.1). It still needs the founder's decision, because D2 keeps reseller files out.
- **Three things need doing whatever is decided:** put every source on the refresh schedule (20 live counties aren't),
  finish Clark County's page, and derive the rows the records already imply.

## 1. The bar

The founder, November 11: "we want the best quality data in the country, and give users real impression about their
homes, that we may know them much better than they know about their homes", and "we want to at least to have all the
fields from the attached screenshot example of a home, for all addresses". The screenshot is the Property details page:
the 46 rows in [property-fields.md](property-fields.md).

What this changes:

- The six-fact bar (year built, living area, bedrooms, baths, lot and value on 90% or more of houses) stays the minimum
  for a county to go live. It stops being the goal.
- A county is measured by rows filled per home, by kind of home (D16).
- "Better than they know" means going past the 46 rows: history, permits, hazards, utilities, and what the household's
  own documents say (section 5.7).

## 2. Where storage stands

Measured November 11 from each county's serving release (`report.json` in private storage, read with the reader key),
the production switch file, and Census 2024 county estimates. Nothing has been published or switched since November 8.

**Records:** 741 counties in 35 states, from 125 sources. 50,163,743 homes (40.2M houses, 5.1M condo units, 1.5M
townhouses, 1.3M mobile homes, 2.0M homes whose type the county doesn't record), plus 4.8M building records. The country
has about 145.4M housing units.

**By where Americans live** (a county counts by what its houses hold):

| | Counties | Homes stored | People | Share of Americans |
|---|---:|---:|---:|---:|
| Live: the six facts on 90% or more of houses | 69 | 16.0M | 59.5M | 17.5% |
| Stored with bedrooms and baths on half or more of houses, not live | 13 | 2.6M | 9.4M | 2.8% |
| Stored, year built or size but no bedrooms or baths | 171 | 12.3M | 43.1M | 12.7% |
| Stored, address, value and lot only | 300 | 17.5M | 64.0M | 18.8% |
| Stored, few or no houses with a type | 136 | 1.8M | 6.1M | 1.8% |
| Nothing stored | 2,455 | 0 | 158.1M | 46.5% |

Three New York counties (Montgomery, Rensselaer, Tioga) meet the six-fact bar and wait for the founder's switch. Value
estimate models exist for 735 counties; estimates are switched on for Clark County WA only.

**The largest places with nothing stored:** California (17.7M people in counties with no record), Georgia (10.4M), Texas
(9.3M, much of it in the statewide file that waits for the founder's publish), Pennsylvania (8.7M), Virginia (7.8M),
Arizona (7.6M), Illinois (7.5M), Michigan (7.1M), Indiana (6.9M), Tennessee (6.5M), Ohio (6.4M).

## 3. Row by row

"All stored homes" is the share of the 50.2M homes whose record has the row. "Live counties" is the same for the 16.0M
homes in the 69 live counties. "Counties at 90%" counts the 552 stored counties with at least 500 houses where 90% or
more of houses have the row. Fireplaces and partial baths can't reach 90% where homes have none: a county that writes 0
has answered.

| Row | All stored homes | Live counties | Counties at 90% | How every address gets it |
|---|---:|---:|---:|---|
| **Building** | | | | |
| Year built | 81.7% | 99.1% | 368 | County file |
| Effective year built | 32.0% | 53.5% | 108 | County file; many connectors don't read the column yet (WP20) |
| Living area | 64.0% | 97.5% | 239 | County file; licensed copy; household |
| Gross area | 14.9% | 32.1% | 23 | County file; the county's own floor areas added up, where it lists them |
| Ground floor area | 9.0% | 24.4% | 14 | County file; else the building's measured outline, labeled (WP21) |
| Stories | 38.0% | 67.5% | 160 | County file; else the county's floor areas; else a labeled estimate from measured height |
| Bedrooms | 41.8% | 96.8% | 106 | County file; licensed copy; household; a floor-plan sheet for a unit |
| Bathrooms | 40.6% | 96.6% | 88 | Same |
| Full baths | 29.7% | 68.8% | 95 | County file; household |
| Partial baths | 10.5% | 28.7% | 0 | County file; show "None" where the county writes 0 |
| Fireplaces | 9.8% | 24.7% | 0 | County file; show "None" where the county writes 0 |
| Architectural style | 27.1% | 37.0% | 150 | County file and its code words |
| Condition | 13.1% | 31.9% | 24 | County file and its code words; never modeled |
| Quality | 16.8% | 35.0% | 98 | Same |
| Buildings on the parcel | 14.9% | 11.6% | 79 | County file; else the outlines counted inside the parcel's shape, labeled (WP21) |
| **Construction** | | | | |
| Exterior walls | 21.1% | 41.5% | 113 | County file and its code words; licensed copy; household and its documents |
| Roof cover | 13.9% | 34.5% | 29 | Same |
| **Heating, cooling and utilities** | | | | |
| Heating | 21.6% | 47.6% | 74 | Same |
| Cooling | 14.3% | 36.1% | 13 | Same |
| **Parking** | | | | |
| Garage | 12.8% | 31.0% | 7 | County file; "Yes" where the county gives a garage area |
| Parking type | 9.0% | 28.1% | 4 | County file; licensed copy; household |
| Parking spaces | 5.4% | 11.3% | 2 | County file where it counts them; household. Never worked out from an area |
| Parking area | 11.6% | 25.1% | 10 | County file |
| **Lot** | | | | |
| Lot size (acres) | 63.7% | 86.2% | 358 | The other unit (each county's next build); else the parcel shape's area, labeled |
| Lot area (square feet) | 57.5% | 86.2% | 286 | Same |
| Lot number | 7.5% | 21.1% | 6 | County file; else read from the legal description (WP19) |
| **Parcel and records** | | | | |
| Address on record | 93.4% | 99.9% | 489 | County file |
| ZIP+4 | 0.3% | 1.0% | 1 | USPS's ZIP+4 file and our own address matcher (WP22) |
| Parcel number, county, county code | 100% | 100% | 552 | Done |
| Municipality | 44.5% | 51.8% | 235 | County file; else the Census place or town that holds the address (WP19) |
| Subdivision | 20.7% | 29.6% | 61 | County file; else read from the legal description; else the county's plat layer |
| Tax code area | 35.9% | 54.3% | 110 | County file; a state's tax district layer where one is published |
| Property type | 47.4% | 100% | 290 | Words for the record's own kind; each county's next build adds them |
| Property class | 11.1% | 18.3% | 78 | Derived from the county's use code with one published table (WP19) |
| Property subtype | 0.8% | 2.7% | 2 | Same |
| Land use | 91.2% | 89.4% | 496 | County file |
| County use code | 78.1% | 86.6% | 358 | County file |
| Occupancy | 0% | 0% | 0 | Pantopus's own verified households; the county's owner-occupancy exemption where its file states one. Never guessed |
| Legal description | 47.0% | 59.9% | 147 | County file |
| Pantopus ID | every exact match | every exact match | | Ours |
| **Value** | | | | |
| County value (not on the screenshot) | 96.8% | 99.7% | | County file |
| Estimated value, range, date | models for 735 counties | on for Clark WA only | | The founder's switch, county by county (WP12) |
| How sure we are | measured miss and range, per county | | | Shown as the range's width and plain words, not a score |

**One county in detail.** Clark County WA, the pilot and the screenshot's county, fills all but seven of the 46 rows on
nearly every house: heating (0%), roof cover (2%), exterior walls (12%), cooling (32%), parking spaces (0%), ZIP+4 (0%)
and occupancy. Its codes for roof, walls and heating are in the county's file; their words aren't mapped yet (section
5.6). The record also holds about 25 facts the page's 46 rows don't have: last sale and its document, value and tax
history, land and building values, taxable value, exemptions, school district, zoning, neighborhood, basement and
finished basement, second floor, carport, pool, foundation, flooring and other structures.

## 4. What the current plan can't reach

1. **The bar is six facts.** No gate, report or go-live check measures the other 40 rows. In the 69 live counties,
   heating shows on 48% of homes, roof cover on 35%, a garage on 31%.
2. **Free county files a script may read are nearly used up.** The county survey's last passes (ranks 841 to 1,080 by
   population) found almost nothing buildable, and the fills work ended with every free script-readable source used.
   Each new county now adds 20,000 to 60,000 homes.
3. **The large remaining steps are the founder's, and none has moved since November 7.** The Texas statewide publish
   (up to 12.25M people), 35 letters and small orders that have a file ready behind them (29.9M people, Indiana's 6.9M
   and Maricopa County's 4.7M among them), nine state questions (19.9M), the Florida appraisers' asks (about 2.65M
   homes), Tennessee's forms (3.76M), and the hand checks.
4. **A third of Americans live where the county publishes only a lookup page** (about 112M people,
   [lookup-sites.md](lookup-sites.md)). Even if every letter is answered, they are reached only by link and confirm
   (built, off), one home at a time, four facts.
5. **Nobody has hand-checked a county.** The machine checks prove the files were read right, not that the files are
   right. 69 counties are live on that footing.
6. **Refresh gaps.** 20 live counties come from sources that aren't on the monthly schedule in
   `.github/workflows/property-index.yml` (30 stored sources in all). Stark County OH passes its stale date on January
   6, 2027; ten more live counties pass theirs between December 30 and February 1 unless their monthly run publishes. A
   county past its date answers `stale` instead of a record (`backend/services/propertyRecords/index.js`). Texas's
   statewide file can't be fetched by GitHub's runners, so each refresh needs the founder's Mac and the writer key.
7. **Rows no county file fills everywhere have no plan:** ZIP+4, municipality, property class and subtype, parking
   spaces, occupancy.
8. **Rented apartments have no record of their own.** The floor-plan sheets (WP11, built, off) and residents are the
   only sources, as [unit-facts.md](unit-facts.md) says. One live county shows the gap: 72.9% of Milwaukee's condo units
   share an address with no unit numbers, so they answer "several homes".

## 5. What the research found

### 5.1 A licensed copy costs about $5,000, not $450,000

[fill-routes.md](fill-routes.md) priced RentCast at one request per home: about $450,000 for 30M homes. Its billing page
says otherwise, read November 11: "It doesn't matter how much data you retrieve via each API request - it will only
count as one request for billing purposes." A request returns up to 500 records, its documentation describes retrieving
"all property records" in a city, state or ZIP code, and the limit is 20 requests a second.

| | Requests | Cost on the $449 plan (25,000 requests, then $0.015 each) |
|---|---:|---:|
| The 30M stored homes without bedrooms | about 60,000 | about $1,000 |
| Every home in the country (140M records, queried by ZIP) | about 320,000 | about $5,000 |
| A test: the free plan's 50 requests | 50 | $0 for up to 25,000 homes |

- **Fields.** Its record has bedrooms, bathrooms, living area, lot, year built, floors, roof, exterior, heating,
  cooling, fireplace (yes or no), garage with spaces and type, pool, style, foundation, rooms, units, legal description,
  subdivision, zoning, the assessor's ID, last sale, yearly assessments and taxes, and an owner-occupied flag. That
  covers both Construction rows, both Heating rows, garage, parking type and spaces, and most Building rows. It has no
  effective year, gross or ground floor area, split of full and partial baths, fireplace count, condition, quality or
  parking area. Its documentation says availability varies by county.
- **Terms as read** (a summarizing reader, not a lawyer): a customer may store the data, display it to its own users and
  keep data obtained before cancelling; no attribution is required. RentCast may limit calls at its discretion, bars
  "an unreasonable load", and may require deletion where its own licensors do. It doesn't name those licensors.
- **What it is.** Another company's copy of county records, the same class of source as ATTOM. It wouldn't make a row
  authentic; it would fill a row that is otherwise empty until the county's own file arrives.
- **What isn't known:** its accuracy, how fresh each county is, and whether RentCast would allow a full pull. The free
  plan answers the first two: 50 requests return up to 25,000 homes in counties where Pantopus already holds the
  county's own record, so every field's agreement can be counted.
- **It conflicts with D2** ("still no national license, reseller files or listing sites"). Decision D13.

Other feeds, for the record: Estated (now part of ATTOM) lists 126M residential records at $100,000 a year or $125,000
once; BatchData's terms bar building a database; Regrid's stored records must be destroyed when a plan ends; Zillow's
public-records program is invite only; MLS data reaches only listed homes and is licensed per MLS.

### 5.2 Maricopa County's file, read

The Assessor's page now says "All data files available on the Data Downloads page are free to download." Its Residential
Master layout (revised May 31, 2023) has, with no owner columns in the parcel-only version: parcel number, class, story
count, air conditioning type, heating type, bathroom fixtures, exterior wall material, roof material, roof style,
construction year, living square feet, a parking code (type and number of vehicles, such as a two-car garage), patios,
pool square feet, sale price and date, added and detached square feet, and the property use code. No bedrooms, and
bathroom fixtures aren't a bath count. The street address is in the version with owner columns or the parcel files.

Its FAQ says commercial users are "responsible for complying with all applicable Arizona laws that govern the commercial
use of public records" and offers a Commercial Purpose Public Record Request Form. That form is the founder's to sign.
4.67M people, the largest county with nothing stored.

### 5.3 ZIP+4

USPS sells the national ZIP+4 file for $1,750 a year (price sheet of July 2026), monthly updates included. It is about
30M records of address ranges, not addresses, and "mailers must purchase or develop their own matching software": the
address registry's reader is that software. The license is for internal use "on one computer at one location" and bars
passing on copies of the file without a license amendment. Two things to confirm with USPS before buying (D15): that
the monthly registry run may use the file, and that one home's ZIP+4 may be shown to its own household. USPS's free web
API can't be used: its terms limit it to shipping and mailing with USPS and bar building a database.

### 5.4 Measured from public aerial data

- **Building outlines.** FEMA and Oak Ridge National Laboratory's USA Structures holds an outline for every structure
  larger than 450 square feet, in every state. WP7 already matches registry addresses to it. The outline gives the
  ground floor's area and, counted inside a parcel's shape, the buildings on the parcel.
- **Its license needs one check.** The federal catalog lists it as a U.S. Government work; a third-party catalog says
  CC BY 4.0. Its occupancy and address columns were built partly from a commercial parcel set licensed for federal use,
  so this plan uses the outlines' shapes only.
- **Height.** The U.S. Geological Survey's lidar program set out to finish first-time national coverage in fiscal 2026,
  and its point clouds are public. Height gives a labeled estimate of stories, never a record's count.
- **Lot.** A parcel shape's own area, where a state or county publishes parcels, as New York's file already does for
  about 0.9M houses.

Today [architecture.md](architecture.md#7-fact-precedence-field-by-field) keeps footprints and modeled figures in a
separate "Estimate" slot. A measured outline isn't a model. Decision D14 asks whether measured figures may sit in their
own rows, labeled, when the record has none.

### 5.5 Rows the records already imply

`scripts/property-index/lib/derive.cjs` derives two things today: the other unit of a lot, and plain words for the
record's own kind. No new source is needed for:

- property class and subtype, from the county's use code or land use (on 78% and 91% of homes);
- municipality, from the Census place or town that holds the home's address point;
- lot number, read from the legal description only when it plainly names one whole lot (`lib/legal.cjs` does this for
  six counties today), and subdivision, which nothing reads yet (legal descriptions are on 47% of homes, subdivisions
  on 21%, lot numbers on 8%);
- "Garage: Yes" where the county gives a garage area, and "None" where it writes 0 for fireplaces or partial baths;
- stories and gross area, from the county's own floor areas where it lists each floor.

Each derived row says what it was derived from. None looks past the record and official boundaries.

### 5.6 Clark County's roof, walls and heating

The county's file carries a code for each. The connector maps only the codes whose words are certain (vinyl, log,
metal, rolled) and hides the rest, by rule: no published legend was found, and a code is never guessed. The rest wait
for a person to read about ten homes per type on the county's own page (the sheet exists, on the founder's Mac), or for
the Assessor to send its code list, which the standard letter already asks for. Clark's 139,204 houses gain up to
three rows when either arrives, wherever the file carries a code.

### 5.7 Past the 46 rows

None of this is on ATTOM's page.

- **Already in some records:** sale history, value and tax history, exemptions, school district, zoning. Clark's record
  has all of them.
- **Permits.** Clark County publishes a building permits layer for new construction in every jurisdiction in the
  county, updated weekly for the county and the City of Vancouver. Where a city publishes every permit, a roof, furnace
  or addition permit dates a fact better than any assessor file. National permit feeds are sold from about $400 a month
  (third-party listings; not priced here).
- **Public layers, most of them federal:** flood zone, wildfire risk, elevation and slope, school attendance zones,
  electric and water providers, and the districts Pantopus already keeps for ballots. Each needs its own rights row.
- **The household's own documents.** An inspection report, an appraisal or a listing sheet states the roof's age, the
  furnace and water heater, the electrical panel and the plumbing. Read with the household's permission and confirmed by
  them, these are facts no vendor holds (P6).

## 6. Five layers, each labeled

| Layer | Source | On screen | Rule |
|---|---|---|---|
| 1. Record | The county, state or recorder that keeps the fact | "From <office>, <date>" | First for every row it holds, as today |
| 2. Derived | The record itself, plus official boundaries | "From <office>'s <field>" | Only what the record or a boundary states; never a guess |
| 3. Measured | Public aerial data: outlines, parcel shapes, height | "Measured from <survey>, <year>" | Only rows that are measurements; shown when the record has none (D14) |
| 4. Licensed copy | A licensed copy of public records | "Public records via <vendor>, <date>" | Only when layers 1 to 3 have nothing; never mixed into a record; replaced the day the county's file arrives (D13) |
| 5. Household | The verified household: confirmations, corrections, documents | "From your household" | As [architecture.md](architecture.md#7-fact-precedence-field-by-field) says today |

Modeled figures (the national structure inventory, Census medians) stay in the labeled estimate slot. A value estimate
stays a value estimate.

Two measures replace the six-fact bar as the goal:

- **Page score:** rows filled out of the rows that apply, per home, reported per county and kind of home in the
  coverage report.
- **Agreement score:** per county and row, how often two sources agree: the county and a state file, the county and a
  licensed copy, the county and its households' "Is this right?" answers. Hand checks go to the rows that disagree.

## 7. Proposed packages

The rules in [build-plan.md](build-plan.md) apply to each: a plain-words plan to the founder first, off by default,
small PRs, checked in the real apps on web, iOS and Android against a local backend. Nothing here seeds a record from
ATTOM, Smarty or Google output.

| # | Package | What people gain | Needs from the founder | Decision |
|---|---|---|---|---|
| WP17 | Refresh safety | A live county never goes blank on a date | Nothing to build it; the Texas refresh stays a manual publish | D17 |
| WP18 | Clark County's full page | The pilot county shows more than the screenshot | The hand check, or one email to the Assessor | — |
| WP19 | Derived rows | Class, subtype, municipality, subdivision, lot number and "None" answers on nearly every stored home | Nothing | — |
| WP20 | Unread columns and the two scores | Heating, roof, walls, cooling, style, garage wherever a live county's file has them | Letters for code lists where a county publishes none | D16 |
| WP21 | Measured rows | Ground floor area, buildings on the parcel and lot for nearly every address | Nothing | D14 |
| WP22 | ZIP+4 | The ZIP+4 row on every deliverable address | Buys the file ($1,750 a year); asks USPS one question | D15 |
| WP23 | Licensed copy | Most empty Building, Construction, Heating and Parking rows, labeled, until the county's file arrives | An account, a written question to the vendor, then a yes or no | D13 |
| WP24 | Past the page: public layers | Flood zone, permits, providers and school zones, pilot county first | A plan OK for where they show | — |
| WP25 | Household documents | Roof age, furnace, water heater, panel, from the household's own papers | A plan OK; private storage | P6 |

**WP17, refresh safety.** Add every stored source to the monthly schedule in `property-index.yml` (the workflow is at
GitHub's limit of ten inputs, so sources go into the schedule's lists, not new inputs). A report names every live county
within 30 days of its stale date. D17: a county past its date keeps showing its last answer with that date ("better to
show something than nothing", the founder, November 5); check what each screen does with `stale` today before changing
it. Beats ATTOM: every row already shows its date; this keeps the row.

**WP18, Clark County's full page.** Words for the roof, wall and heating codes from the hand check or the Assessor's
list; the derived rows; ZIP+4 when WP22 lands; the county's weekly permits layer after a rights read. Parking spaces
aren't in the county's file and aren't worked out from a garage's area: the household's row. Beats ATTOM: about 25 facts
its page doesn't have, each from the county with its date.

**WP19, derived rows.** Extend `lib/derive.cjs` and `lib/legal.cjs` (its lot reader runs in six connectors; run it
for every county with a legal description, and add a subdivision reader); republish every county through the existing gates
(account retention, fill, self-find). A derived row never replaces a row the county states. Check on a live county
first with `backend/scripts/eval/property-state-check.js`: nothing changed, nothing wrong.

**WP20, unread columns and the two scores.** For each live county, read the columns its connector skips, and the
county's published code tables, as the first-batch depth pass did for 36 counties. Add the page score to
`scripts/property-index/coverage.cjs` and the release report, and the agreement score beside it. A county's go-live
line on the founder's list gains both numbers.

**WP21, measured rows.** Outline area and building count from USA Structures' shapes, joined through the registry's
point for each address (WP7's location index); lot from parcel shapes. Off until D14 and a rights row for the outlines.
Measure first: where a county states its ground floor area, how close is the outline?

**WP22, ZIP+4.** A match from each registry address to its ZIP+4 range, built in the monthly registry run; the raw file
never leaves private storage. Measure against the ZIP+4 a county states (187,195 records have one).

**WP23, licensed copy.** In order, each step the founder's: an account on the free plan; a counts-only comparison
against Pantopus's county records in about ten live counties, field by field; a written question to the vendor (may
Pantopus pull the counties it lacks and show each home's facts to its household?); then yes or no. If yes: a separate
store beside the index, never inside a release; a row shows it only when layers 1 to 3 have nothing; a county's own
file replaces it. Beats ATTOM: the same class of data for a small one-time cost, kept, labeled, and outranked by the
county everywhere Pantopus has the county.

**WP24, past the page.** One layer at a time, each with a rights row, the pilot county first: permits, flood zone,
providers, school zones. Where they show is a screen change, so each starts with the founder's plan OK.

**WP25, household documents.** The household uploads a report; Pantopus reads it, proposes facts, and the household
confirms each one. Confirmed facts are household entries, as link and confirm's are. Originals are kept only with
permission (P6).

**Continuing, unchanged:** county connectors as answers to the founder's letters arrive, Maricopa first (WP10); the
address registry's thin states (WP6).

**Order.** WP17 first, because it protects what is live. Then WP18, so one county shows the whole idea. WP19 and WP20
can run side by side after it. WP21, WP22 and WP23 each start with a measurement and wait on a decision. WP24 and WP25
follow.

## 8. Waiting on the founder

Unchanged since November 8, largest first. Commands and letters are on the founder's private list.

- The Texas statewide publish.
- Switches: the fourth batch (three New York counties), shared-address facts for Cook County, estimates beyond Clark,
  link and confirm.
- The 35 letters and small orders with a file ready behind them, the nine state questions, Indiana's email and
  Maricopa's form.
- Purchases already inside D2's $500 rule: Johnson County KS ($100), San Mateo County ($305 for one file), Ventura
  County (about $465), Greenville County ($500), Lancaster County PA ($500).
- Clark County's hand check, then the other live counties'.
- ATTOM: kept privately.

## 9. How this beats ATTOM

- **Authentic where it counts.** Every row from layers 1 and 2 names the office that keeps it and its date. A vendor's
  page names the vendor.
- **Nothing dressed up.** A measured row says measured, a licensed row says licensed, an estimate says estimate, and a
  household's entry says so.
- **More rows.** Sale, value and tax history, permits, hazards and the household's own documents aren't on the page
  ATTOM filled.
- **Honest accuracy.** A value estimate shows its range and its measured miss, and each county shows how often its
  sources agree.
- **Cost.** $1,750 a year for ZIP+4 and about $5,000 once for a licensed copy if the founder allows one, against a
  subscription whose published price starts at $500 a month.

## What I couldn't confirm

- RentCast's terms were read through a summarizing reader, in short quotes. A person should read them, and its written
  answer on a full pull and on showing data to households is needed before any use. Its sources, accuracy and freshness
  are unknown.
- USA Structures' license (two catalogs disagree), its height column, and how current each state's outlines are.
- Whether USPS's license allows showing a home's ZIP+4 to its household.
- How much of the country the lidar program had covered on November 11; its status map wasn't read.
- What each screen shows today for a county past its stale date.
- What the legal descriptions will yield: the share that names a subdivision and lot wasn't measured.
- Clark County's permits layer terms, and every public layer in section 5.7.
- ATTOM publishes no fill rates, so "better than ATTOM" on a row can be shown only where Pantopus's own numbers are.
- Production's own server log and physical phones, as before.

## Sources

Read November 11, 2026 (UTC). Storage: every `index/states/<ST>.json`, each serving release's `report.json` and
`index/switches/production.json`, with the reader key; Census Bureau 2024 county population estimates.

- RentCast: [billing](https://developers.rentcast.io/reference/billing-and-pricing),
  [property record schema](https://developers.rentcast.io/reference/property-data-schema),
  [search queries](https://developers.rentcast.io/reference/search-queries),
  [pagination](https://developers.rentcast.io/reference/pagination),
  [rate limits](https://developers.rentcast.io/reference/rate-limits), [API terms](https://www.rentcast.io/terms-api),
  [prices](https://www.rentcast.io/api).
- Maricopa County Assessor: [data downloads](https://mcassessor.maricopa.gov/page/data_sales/),
  [FAQ](https://mcassessor.maricopa.gov/faq/data_sales/),
  [Residential Master layout](https://www.mcassessor.maricopa.gov/file/data_sales/R116_ResidentialMaster_Layout.pdf).
- USPS: [AIS products pricing](https://postalpro.usps.com/address-quality/AIS_Products_Pricing),
  [ZIP+4 product](https://postalpro.usps.com/address-quality-solutions/zip-4-product),
  [license agreement](https://postalpro.usps.com/AISCopyright_License),
  [web API terms](https://developers.usps.com/terms-and-conditions).
- USA Structures: [federal catalog](https://catalog.data.gov/dataset/usa-structures),
  [Oak Ridge technical report](https://www.osti.gov/biblio/2076189),
  [third-party catalog](https://gee-community-catalog.org/projects/usa_structures/).
- U.S. Geological Survey: [3D Elevation Program coverage](https://www.usgs.gov/faqs/what-coverage-3d-elevation-program-3dep-dems),
  [fiscal 2026 announcement](https://www.usgs.gov/3d-national-topography-model/fy26-3dep-data-collaboration-announcement-dca)
  (search summaries only; the pages themselves weren't opened).
- Clark County WA: [permits layer](https://gis.clark.wa.gov/arcgisfed2/rest/services/MapCatalog/Permitting/MapServer/4/iteminfo).
- Other feeds: [Estated's listed prices](https://datarade.ai/data-products/usa-nationwide-residential-property-data-126m-residential-pr-estated),
  [Zillow's public records program](https://www.zillowgroup.com/developers/api/public-data/public-records-api/),
  [ATTOM's property characteristics page](https://www.attomdata.com/data/property-data/property-characteristics/).
