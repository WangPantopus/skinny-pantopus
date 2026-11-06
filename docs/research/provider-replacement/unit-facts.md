# Unit facts for condos and apartments

November 5, 2026. Research and a proposed design; nothing is built. The founder asked, after the county survey: is free
public data still far behind ATTOM, how do Zillow and Redfin have facts and floor plans for almost every home and
apartment, and can Pantopus use the same sources? The two Chicago homes the founder supplied are described here
without their addresses or parcel numbers.

## Short answer

- **Against ATTOM, on reach: still behind.** ATTOM says it covers about 160 million properties from more than 3,000
  counties. Free bulk files reach about 56% of Americans with building facts and 23% with bedrooms or baths
  ([sourcing.md](sourcing.md#1-nationwide-coverage-of-free-building-facts)). ATTOM buys or requests the files of the
  counties that only run lookup sites (35.5% of Americans) or sell their files (6.5%).
- **But ATTOM is county records too.** Where a county records a unit's interior, public data matches it: Dallas has
  bedrooms, baths and area together for 92.1% of condos and Boston for 95.6%. Where it doesn't, an assessor-based source
  has nothing: Cook has all three for 14.2% (bedrooms alone 53%, size 39%), New York City has no unit-level records,
  and a rented apartment usually has no county record of its own.
- **Listing sites fill exactly that gap from listings:** MLS sale listings, rental listings sent by property managers
  and rental platforms, owners' own edits, and county records bought from data vendors. Floor-plan images arrive with
  listings.
- **Pantopus can get the apartment half without a subscription:** a building's floor-plan sheet maps unit numbers to
  plans, so one sheet from a manager fills hundreds of units, and residents confirm their own. MLS data is the one
  source that needs a broker relationship and fees per MLS.

## The two Chicago examples (checked November 5)

**A downtown condo unit (Cook County).**
- Redfin's "Public record" section is empty for bedrooms, baths, size and year built; it shows only the property type,
  the county and the parcel number.
- The bedrooms, baths and square feet on the page come from a sale listing posted that day, marked "Source: MRED as
  Distributed by MLS Grid" (MRED is the Chicago-area MLS); an earlier rental listing came from MRED too. Redfin's
  building table lists the same three facts for each unit for sale, again from MLS listings, and notes "Last updated by
  owner": owners can edit facts.
- Cook County's free condo file (Assessor Residential Condominium Unit Characteristics, `3r7i-mrz4`) has the unit's year
  built but no size or bedrooms for any of the building's 966 units. #3433's address check found the county pins the
  exact unit: two neighboring units mapped to different parcel numbers, and an out-of-range unit matched nothing.

**A rental apartment in a 690-unit downtown tower.**
- Redfin's public facts say "Multi-Family (5+ Unit)" with no bedrooms, baths, size, year built or parcel number: the
  whole tower is one county record, not 690 units.
- The unit's history shows rental listings in early 2024 from YouGotListings, a platform brokers and landlords use. The
  page's floor-plan image sits in Redfin's rental photo store; it arrived with those listings. Redfin's rentals come from
  RentPath (Rent.com, ApartmentGuide), which it bought in 2021.
- The building's own floor-plan sheet maps unit numbers to plans by stack: for example, units ending in the same two
  digits on a range of floors share one plan with its bedrooms, baths and square feet. One sheet fills every unit in
  every stack.
- Cook County's free Commercial Valuation Data (`csik-bsws`, 2024) has the tower's unit mix (built 2016, 690 units: 249
  studios, 312 one-bed, 117 two-bed, 12 three-bed; 757,862 sq ft) but nothing per unit.
- Zillow's page could not be opened: its bot check stopped the research browser, and bot checks are not bypassed.

## Where each site's data comes from

| Source | What it gives | Who uses it | Can Pantopus use it? |
|---|---|---|---|
| County assessor and recorder records, bought from vendors | Parcel facts, sales, taxes; unit facts only where counties record them | Zillow, Redfin (an older Redfin filing names CoreLogic), ATTOM | Free where counties publish ([sourcing.md](sourcing.md)); otherwise buy or request the file |
| MLS sale and rental listings | Beds, baths, size, photos, floor plans, prices for homes listed in recent years | Redfin (a brokerage in about 100 MLSs), Zillow (feeds from MLSs and brokers) | Only through a broker relationship and each MLS's license (IDX, VOW or back-office); fees per MLS, for example $1,000 plus $1,200 a quarter for non-participants at one MLS; display rules apply |
| Rental listing feeds | Unit beds, baths, size, rent, floor-plan images | Redfin via RentPath; Zillow Rentals; Apartments.com | Only as a listing destination, with partner agreements; floor plans come with display rights |
| Owners' and residents' edits | Corrections and missing facts | Zillow ("claim your home"), Redfin ("Edit facts") | Yes: Pantopus's verified households are a stronger version |
| Building floor-plan sheets | Every unit number mapped to a plan with beds, baths, size | Leasing sites, listing media | Yes, with the building's permission: facts stored with their source; images shown only if the owner agrees |

## Floor-plan sheets: the design

Proposed; build as work package WP11 in [build-plan.md](build-plan.md#wp11-unit-floor-plans).

**What a sheet is.** A building's marketing or leasing sheet: plan names with bedrooms, baths and square feet, and the
rule that ties plans to unit numbers (a stack: "units ending in 05 on floors 2-20", or an explicit list).

**Intake.** A building manager uploads the sheet, or a verified resident uploads it with the building's written
permission. Pantopus records who granted permission, when, and its scope: facts only, or facts and images.

**Mapping is per-unit evidence or nothing.** A plan's facts attach to a unit only when the sheet itself states which
units have that plan (a stack rule with floors, or a list). A sheet with plans but no unit mapping stays at the building
level: "This building has one-bedroom plans of 650-780 sq ft", labeled as the building's, never in a unit's fields.
Averages and building totals never fill a unit's fields.

**Checks.**
- A unit's facts from a sheet show only on an exact-unit match ([architecture.md](architecture.md#identity-contract)).
- A resident in a mapped unit sees "Is this your layout?"; a "no" sends the mapping to review and the household's
  answer shows for that home meanwhile.
- A redeemed postcard proves the unit number exists; it says nothing about the layout.
- When a building renumbers or renovates, the old sheet is retired as a new release, not edited in place.

**Where it lives.** A sheet becomes a source release in the property index, like a county file, with the building's
Pantopus ID, its as-of date and its permission. The uploaded original is kept only with permission, in private storage
(a hosted bucket is a proposal for the founder's approval, [decisions.md](decisions.md#proposals-that-need-a-yes)).

**Privacy.** Nothing reveals which units have Pantopus households; there is no unit directory, and the sheet's
existence doesn't show who asked for it.

**Where to start.** The buildings Pantopus users actually live in, ranked by how many households ask for a unit's
facts, beginning with large rental towers in counties that don't record units (Cook, New York City). The county's
commercial file can show a tower's unit mix, labeled as the building's, until a sheet arrives.

## Later, and only by the founder's decision

- **Rental feeds:** only if Pantopus shows rentals; needs partner agreements with property managers and rental
  platforms.
- **MLS:** the richest source for houses and condos that were listed, but it means a broker relationship, fees per MLS
  (a subscription again) and display rules. Not recommended now.

## Sources

- Redfin on its data: [Listing Details help](https://support.redfin.com/hc/en-us/articles/360004496791-Listing-Details),
  [Public Records help](https://support.redfin.com/hc/en-us/articles/360001454531-Public-Records),
  [Competition Tribunal filing (older; CoreLogic, about 100 MLSs)](https://decisions.ct-tc.gc.ca/ct-tc/cdo/en/463146/1/document.do),
  [RentPath acquisition](https://investors.redfin.com/news-events/press-releases/detail/114/redfin-completes-acquisition-of-rentpath-for-608-million),
  [rental search powered by RentPath](https://investors.redfin.com/news-events/press-releases/detail/692/redfin-launches-rental-search).
- Zillow on its data: [Zillow Group Q&A](https://www.zillowgroup.com/news/in-case-you-missed-it),
  [rental listing feeds](https://www.zillow.com/rentals-network/listing-feeds/),
  [Zillow and MRED feed dispute, May 2026](https://www.realestatenews.com/2026/05/14/zillow-looks-to-bypass-mred-with-direct-feed).
- Cook County Assessor open data: [Residential Condominium Unit Characteristics](https://datacatalog.cookcountyil.gov/resource/3r7i-mrz4.json),
  [Commercial Valuation Data](https://datacatalog.cookcountyil.gov/resource/csik-bsws.json),
  [Parcel Addresses](https://datacatalog.cookcountyil.gov/resource/3723-97qp.json). The county says it began gathering
  condo interior characteristics from sources including listings in 2021 (dataset description).
- ATTOM coverage claims: [attomdata.com real estate data](https://www.attomdata.com/sem/real-estate-data/).
- Rental listing platforms: [YouGotListings](https://www.yougotlistings.com).
- MLS licensing: [MLS Grid FAQ](https://mlsgrid.com/faq), [Canopy MLS data licensing (fee example)](https://go.canopymls.com/data).
