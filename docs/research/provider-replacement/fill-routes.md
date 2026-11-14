# Filling missing home facts: every route, ranked

November 7, 2026. The founder asked for every record's missing facts to be researched and filled "with all resources,
whatever resources, it has to be available online, even Zillow, redfin", and saved for those records, and for the
address to be kept on file where nothing is found. This page ranks every route by homes it would fill, bedrooms and
baths first. It records what each listing site and data vendor allows and what has been filled so far. Counts only: no
addresses or owner names. This isn't legal advice. Terms and prices are as read on the date shown.

Related: [missing-facts.md](missing-facts.md) (the gaps ledger's counts by field, kind, state and county; PR #3737),
[other-routes.md](other-routes.md) (the routes beyond free county files),
[statewide-inventory.md](statewide-inventory.md), [lookup-sites.md](lookup-sites.md), [unit-facts.md](unit-facts.md),
[decisions.md](decisions.md) (D2, D7), [architecture.md](architecture.md#7-fact-precedence-field-by-field) (which source
wins; modeled figures never fill a record field).

## The answer

- **The gap.** Storage holds 48,599,859 homes in 728 counties (November 7). Missing: bedrooms 29.96M (61.6%), baths
  30.56M, living area 18.41M, year built 9.38M, lot 6.64M, value 3.34M. Most missing bedrooms are in Florida (6.04M),
  Texas (3.21M), New Jersey (2.31M), North Carolina (2.31M), Maryland (1.92M), New York (1.78M) and Massachusetts (1.75M).
- **Filled free, from the county that keeps the fact.** A county's own building file, joined to the records already in
  storage by parcel number, adds bedrooms, baths and living area without changing the record or its account. Built
  November 7: Osceola, Alachua, Leon, Martin and St. Johns counties in Florida (524,165 homes gain facts) and Summit
  County, Ohio (184,638): 708,803 homes. The files serving them today have no bedrooms or baths.
- **Listing sites: no lawful copy route.** Zillow, Redfin, Realtor.com and Homes.com bar automated collection of their
  pages. None offers a program that hands a non-broker company bedrooms and baths for homes that aren't for sale, except
  Zillow's invite-only, unpriced Public Records API, which is a vendor's copy of the same county records.
- **Licensed feeds exist, for the founder to decide.** The cheapest found is a per-home API (RentCast, from $74 a month
  for 1,000 lookups) whose terms allow storing and showing the data. Bulk licenses for every home run far higher, and
  MLS data reaches only homes listed in recent years.
- **What's left stays with the household.** Homes no allowed source reaches keep their address in the private gaps
  ledger, get their county's page link (link and confirm), and the one-tap questions let residents confirm their own.

## Every route, ranked by homes it would fill

"Homes" are homes in storage today without bedrooms or baths that the route reaches. Routes that would add records not
yet stored are in [statewide-inventory.md](statewide-inventory.md) and [other-routes.md](other-routes.md).

| Route | Homes | Fields | Terms | Cost | Who acts |
|---|---:|---|---|---|---|
| Households confirm or correct their own home (WP9, link and confirm) | Every verified household, 29.96M without bedrooms | Bedrooms, baths, size, year, the household's own | Pantopus's privacy policy | $0 | Built, off; the founder turns it on |
| Florida appraisers whose free files a script may read: Osceola, Alachua, Leon, Martin, St. Johns | 524,165 | Bedrooms, baths, living area, floors; walls and roof in three | Disclaimers; no limit on use stated | $0 | Built (this work) |
| Duval and Manatee FL, the appraisers' own free files (Duval's real estate roll file; Manatee's nightly Comprehensive CAMA Data File), read November 14 | 510,135 | Bedrooms, baths with halves, living area, floors | No limit on use stated; Manatee's terms bar only use that slows its site | $0 | Built (November 14) |
| Summit County OH, Fiscal Office's dwelling file | 184,638 | Bedrooms, full and half baths | No terms stated | $0 | Built (this work) |
| Florida appraisers whose sites refuse scripts (15 counties: Orange, Pinellas, Polk, Brevard, Pasco, Volusia, Marion, St. Lucie, Escambia, Bay, Okaloosa, Clay, Flagler, Walton, Monroe) | about 2.65M | Bedrooms, baths, living area where each publishes them | Bot challenge or robots.txt banning all robots | $0 | Founder: a one-line written ask each |
| Other Florida appraisers: Lake (its free files sit under a robots.txt Disallow: /ftp/), Indian River (file on Schneider's server, whose terms ban robots) | 235,903 | As above | As noted | $0 | A written ask |
| Florida appraisers whose free files leave bedrooms and baths out: Collier (its terms welcome scripts once a day, but its buildings file has only year, class and areas), Highlands, Charlotte (code tables only) | 380,384 | None today | As noted | $0 | Founder: ask each to add them |
| Citrus FL, the appraiser's files on Google Drive | about 80,000 | To open | To read | $0 | A person's download |
| Lee, Palm Beach FL | 962,764 | Bedrooms, baths | Lee's site allows only "personal, non-business use". Palm Beach posts a free CAMA file (November 2026), but on the county's file-sharing site behind a "private, authorized users only" banner with an Accept button, which a script doesn't click | $0 | Founder: letter (county-letters.md) |
| Tarrant TX, appraisal district's residential file | 606,542 | Bedrooms, baths | Free, but both columns are empty in all 670,390 rows (file of November 7) | $0 | Founder: ask the district to fill them |
| Licensed per-home API (RentCast) when someone adds a home no free file covers | Any | Bedrooms, baths, size, year (from public records and directories) | Storing and showing allowed | $74-$449 a month by volume | Founder's decision |
| MLS data through a broker | Homes listed in recent years only | Bedrooms, baths, size, photos | Per MLS; IDX can't fill records | For example $1,000 setup plus $1,200 a quarter at one MLS | Founder's decision (D7: not now) |
| Building permits | Few | New Orleans' permits list beds and baths; short-term rental permits list bedrooms | Open data | $0 | Not stored yet (Orleans Parish) |
| Cuyahoga OH, Hamilton OH | 624,453 | Cuyahoga's CAMA tables hold living area and rooms, not bedrooms; Hamilton's download menu needs a browser | | | Household route; a person's look at Hamilton |

## Listing sites: what each allows

Read November 7, 2026. No property, listing or search page was opened on any of these sites; only terms pages, robots
files and developer pages.

| Site | Automated access | Reuse of its data | Programs | What it would take |
|---|---|---|---|---|
| Zillow | Its robots.txt: "Access to and use of Zillow.com is governed by our Terms of Use." Its terms page refused an automated reader; published copies quote a ban on robots, spiders, scrapers and data mining | Not allowed without a license | [Public Records API](https://www.zillowgroup.com/developers/api/public-data/public-records-api/): "parcel, assessment and transactional county data across the entire US", "invite only", for "commercial use cases by businesses"; no price. [Zestimates API](https://www.zillowgroup.com/developers/api/zestimate/zestimates-api/): values only. [MLS Listings](https://www.zillowgroup.com/developers/api/mls-broker-data/mls-listings/): at each MLS's discretion | Request access; get the price and the storage and display terms in writing |
| Redfin | [Terms](https://www.redfin.com/about/terms-of-use) (updated September 29, 2025), section 2.3.5: "You may not automatedly crawl or query the Services" without written permission | Section 2.3.3 bars reproducing, redistributing and derivative works; the addendum (2.9.3-2.9.5) bars copying listing information, which the MLS owns | No API or data license. Its [Data Center](https://www.redfin.com/news/data-center/) is national, metro, state, county, city, ZIP and neighborhood figures, never a single home | Written permission only |
| Realtor.com | Its robots.txt carries a legal notice: "scraping data from this website is unauthorized without the express written permission" of Move Sales, Inc. Terms page refused an automated reader | Per its terms | None found | Written permission only |
| Homes.com (CoStar) | Terms page and even its robots.txt refused an automated reader | Unknown | None found | A person reads the terms |
| Trulia (Zillow Group) | Terms page refused an automated reader | As Zillow | As Zillow | As Zillow |

Listing sites get their facts from county records bought from vendors, MLS listings and owners' edits
([unit-facts.md](unit-facts.md)). Where a county publishes, Pantopus reads the same record free and names the county.

## Licensed feeds, for the founder's decision

| Provider | Fields | Source | May Pantopus store and show it? | Published price |
|---|---|---|---|---|
| [RentCast API](https://www.rentcast.io/api) | Property records (bedrooms, baths, size, year: confirm in its docs before signing) | "Public records, tax assessors and online directories" | Yes: its [API terms](https://www.rentcast.io/terms-api) let a customer store the data and show, even resell it; no attribution required | Free 50 calls a month; $74 for 1,000; $199 for 5,000; $449 for 25,000; then $0.20 down to $0.015 a call |
| [BatchData](https://batchdata.io/pricing) | Bedrooms, baths, living area, year | County assessor records | Not without a custom order: [terms](https://batchdata.io/terms-of-service) (November 6, 2026) bar building a database or disclosing to third parties | $1,000 a month for 100,000 records up to $10,000 for 3M |
| [Regrid](https://regrid.com/) | No bedrooms or baths found | Parcels | Stored records must be destroyed when the plan ends | Contact sales |
| [Estated](https://estated.com/) | Bedrooms, baths, area, year | Assessor records | Now part of ATTOM | ATTOM's (no paid ATTOM plan, decisions.md) |
| Cotality (CoreLogic), First American DataTree | Full assessor files | Assessor records | By contract | Contact sales |
| MLS through a broker | Listed homes' facts and photos | MLS members | IDX shows active listings on a broker's site only; a data license is per MLS. Example: [Canopy MLS](https://go.canopymls.com/data), non-participant license $1,000 setup plus $1,200 a quarter with board approval; IDX, VOW or back office $500 setup plus $100 a month through a broker (back office: no public display) | Per MLS |

A per-home API fits Pantopus best of these: called once when someone adds a home that no free file covers, it costs
about $74-$199 a month at today's volume. Filling all 30M homes that way would cost about $450,000, so bulk licensing
isn't a fit. Any vendor fact would carry the vendor's name, never appear as a county record, and need the founder's
signature (D2 keeps resellers out until then).

**Correction, November 11:** the $450,000 figure assumed one request per home. RentCast bills per request, and one
request returns up to 500 records, so the 30M homes are about 60,000 requests, about $1,000 at its listed prices, and
every home in the country about $5,000. Whether to use a licensed copy at all is decision D13:
[full-page-plan.md](full-page-plan.md#51-a-licensed-copy-costs-about-5000-not-450000).

## How a fill works (built November 7)

- A county's own file is joined to the records already in storage by parcel number. Only facts a record lacks are
  added, only on homes (a house, a mobile home, a condo unit), and only where the parcel has one dwelling: a guest
  house's rooms or a duplex's total aren't one home's count (architecture.md section 7, unit scope).
- The record, its account and every fact it had stay, so a county already serving passes the publishing gates (account
  retention, fill, self-find) with nothing accepted by hand.
- The county's source line names both offices, for example "From Florida Department of Revenue and the Osceola County
  Property Appraiser's 2026 tax roll and 2026 certified building data".
- Codes become words only where the county publishes them (Alachua's and Martin's descriptions, Leon's code tabs).
  Codes with no published words (Summit's walls and heat) aren't read. A count capped by a code ("5 or more bedrooms")
  isn't a count, so it fills nothing.
- Modeled figures (NSI size, footprints) stay in the labeled estimate slot, never in a record field.

| County | Homes gaining facts | Bedrooms | Baths | Living area | Also |
|---|---:|---:|---:|---:|---|
| Osceola FL | 159,528 of 160,365 | 155,900 | 159,285 | 159,523 | Floors, half baths |
| Alachua FL | 77,282 of 78,440 | 74,555 | 76,828 | 77,276 | Roof, walls, floors |
| Leon FL | 85,692 of 86,580 | 56,892 (blank on a third in its file) | 56,850 | 85,686 | Roof, walls, floors |
| Martin FL | 68,050 of 70,978 | 67,021 | 68,017 | 67,958 | Roof, walls, heat, floors |
| St. Johns FL | 133,613 of 134,367 | 133,611 | 133,074 | 119,167 | Floors, half baths (read from its Access database) |
| Duval FL | 328,960 of 332,847 | 328,795 | 328,921 | 328,960 | Floors, half baths; condominium units' rooms from their unit lines (November 14) |
| Manatee FL | 181,175 of 181,305 | 175,968 | 181,145 | 181,175 | Floors, half baths (November 14) |
| Summit OH | 184,638 of 186,097 | 184,620 | 184,579 | (already had it) | Half baths |

## What I couldn't confirm

- Zillow's, Realtor.com's, Homes.com's and Trulia's terms pages: each refused an automated reader, so their clauses come
  from robots files and published copies. A person should read them before any request.
- RentCast's exact field list: its docs list property records, but bedrooms and baths weren't named on the pages read.
- Hamilton OH's "Building Information" files: the download menu renders only in a browser.
- Each refusing Florida appraiser's file contents: not opened, since their sites refuse scripts.

## Sources

Read November 7, 2026 (UTC): the pages linked above; robots.txt at www.zillow.com, www.realtor.com, www.redfin.com,
www.trulia.com and www.homes.com; each Florida appraiser's own site and robots.txt (property-appraiser.org,
acpafl.org, leonpa.gov, pamartinfl.gov, sjcpa.gov, pa.marion.fl.us, escpa.org, ccappraiser.com, paslc.gov,
okaloosapa.com, baypa.net, flaglerpa.com, waltonpa.com, mcpafl.org, ccpao.com, ircpa.org, citruspa.org); Summit County
Fiscal Office data downloads (fiscaloffice.summitoh.net/data-downloads); Cuyahoga County GIS services
(gis.cuyahogacounty.gov); Tarrant Appraisal District's residential download; the Socrata open data catalog
(api.us.socrata.com) for permit data with bedrooms; storage counts read with the reader key.
