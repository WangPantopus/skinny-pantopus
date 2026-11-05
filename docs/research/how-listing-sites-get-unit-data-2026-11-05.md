# How Zillow and Redfin show facts for every unit, and what Pantopus can use

November 5, 2026. Research only; nothing here is approved or built. Asked by the founder after the county survey:
is free public data still far behind ATTOM, how do Zillow and Redfin have facts (and floor plans) for almost every
home and apartment, and can Pantopus use the same sources?

## Short answer

- **Against ATTOM:** yes, still well behind on reach. ATTOM says it covers about 160 million properties, 99% of the US
  population, from more than 3,000 counties. Free bulk files reach about 56% of Americans with building facts and 22%
  with bedrooms or baths ([county survey](county-property-data-2026-11-05.md)). The gap is mostly counties that only
  run lookup sites (about 36% of Americans) or sell their files (about 6.5%); ATTOM buys or requests those files.
- **But ATTOM is county records too.** Where a county does not record a unit's bedrooms or size, as with most condo
  and apartment units, an assessor-based source has nothing to give. That is exactly where Zillow and Redfin look
  complete, because their unit facts come from listings, not county records.
- **Where Zillow and Redfin get unit facts:** sale listings from the local MLS (multiple listing service), rental
  listings that property managers and rental platforms send them, owners' own edits, and county records bought from
  data vendors. Floor plan images arrive with listings.
- **Can Pantopus get the same?** Partly, and free of subscriptions for apartments: a building's own floor plan sheet
  maps every unit number to a plan, so one sheet from a building manager fills hundreds of units. MLS data is the one
  source that would need a broker relationship and per-MLS fees.

## The two Chicago examples (checked Nov 5)

**10 E Ontario St #3006** (a condo; Cook County PIN 17-10-111-014-1208):
- Redfin's "Public record" section is empty for bedrooms, baths, size and year built; it shows only Condo/Co-op,
  Cook County and the PIN.
- The 1 bed, 1 bath, 765 sq ft come from a sale listing posted Nov 5, 2026: Redfin marks it "Source: MRED as
  Distributed by MLS Grid". MRED is the Chicago-area MLS. A 2024 rental listing for the unit came from MRED too.
- Redfin's building table lists the same three facts for each unit now for sale, again from MLS listings. The public
  record section notes "Last updated by owner": owners can edit facts too.
- Cook County's free condo file (Assessor Residential Condominium Unit Characteristics, `3r7i-mrz4`) has this unit's
  year built (1983) but no size or bedrooms for any of the building's 966 units. Countywide that file has bedrooms
  for 53% of condo units and size for 39% (2026 rows, parking and common areas excluded).

**25 W Randolph St #3125** (a rental apartment in Marquee at Block 37):
- Redfin's public facts say "Multi-Family (5+ Unit)" with no bedrooms, baths, size, year built or parcel number. The
  whole tower is one county record, not 690 units.
- Redfin's history shows nine rental listings for the unit (Jan to Mar 2024, about $4,400 a month) from
  YouGotListings, a rental-listing platform used by brokers and landlords. The page photo, the floor plan, sits in
  Redfin's rental photo store: it arrived with those rental listings. Redfin's rentals come from RentPath (Rent.com,
  ApartmentGuide), which it bought in 2021.
- The building's floor plan sheet (the one the founder shared) maps unit numbers to plans: units ending in 25 on
  floors 6-37 are 2 bed / 2 bath, and 3125 is in the 1,358 sq ft group. One sheet like this fills every unit in the
  stack.
- Cook County's free Commercial Valuation Data (`csik-bsws`, 2024) has the tower's unit mix: built 2016, 690 units
  (249 studios, 312 one-bed, 117 two-bed, 12 three-bed), 757,862 sq ft. It has no per-unit facts.
- Zillow's page could not be opened: its bot check stopped the research browser, and bot checks are not bypassed. Its
  unit facts are most likely from the same kind of rental listing (Zillow Rentals receives property managers' feeds).

## Where each site's data comes from

| Source | What it gives | Who uses it | Can Pantopus use it? |
|---|---|---|---|
| County assessor and recorder records, bought from vendors | Parcel facts, sales, taxes; unit facts only where counties record them | Zillow, Redfin (an older Redfin filing names CoreLogic), ATTOM | Free where counties publish (the survey); otherwise buy, request, or a vendor subscription |
| MLS sale and rental listings | Beds, baths, size, photos, floor plans, prices for any home listed in recent years | Redfin (a brokerage in about 100 MLSs), Zillow (feeds from MLSs and brokers) | Only through a broker relationship and each MLS's license (IDX, VOW or back-office); fees per MLS, for example Canopy MLS charges non-participants $1,000 plus $1,200 a quarter; display rules apply |
| Rental listing feeds from property managers and rental platforms | Unit beds, baths, size, rent, floor plan images | Redfin via RentPath; Zillow Rentals; Apartments.com | Possible as a listing destination; needs partner agreements; floor plans come with display rights |
| Owners' and residents' edits | Corrections and missing facts | Zillow ("claim your home"), Redfin ("Edit facts") | Yes: Pantopus's verified households are a stronger version of this |
| Building marketing floor plan sheets | Every unit number mapped to a plan with beds, baths, size | Leasing sites, listing media | Yes with the building's permission: facts stored as ours with the source, images shown only if the owner agrees |

## What this means for Pantopus (proposed, needs the founder's decisions)

1. **Apartments and condos, free:** ask building managers for their floor plan sheet (or let a verified resident
   upload it with the building's permission); map unit stacks to plans so one sheet fills the building; residents
   confirm their own unit. This covers exactly the homes where county data and ATTOM are thinnest.
2. **County data where it exists:** Cook County's condo file (bedrooms for 53% of condo units) and its commercial file
   (each rental tower's unit mix, usable as a labeled estimate until a sheet arrives).
3. **Rental feeds later:** only if Pantopus shows rentals; it needs partner agreements with property-management and
   rental platforms.
4. **MLS not now:** the richest source for houses and condos that have been listed, but it means a broker relationship
   and a fee per MLS (a subscription again) with display rules. A founder decision if ever wanted.
5. **Houses in counties without free files:** the plan already proposed (households plus labeled estimates, and
   pricing records requests for the largest counties).

## Sources

- Redfin pages, read Nov 5, 2026: [10 E Ontario St #3006](https://www.redfin.com/IL/Chicago/10-E-Ontario-St-60611/unit-3006/home/12592915),
  [25 W Randolph St #3125](https://www.redfin.com/IL/Chicago/25-W-Randolph-St-60601/unit-3125/home/183572688).
- Zillow page (not opened, bot check): [25 W Randolph St APT 3125](https://www.zillow.com/homedetails/25-W-Randolph-St-APT-3125-Chicago-IL-60601/2083564110_zpid/).
- Cook County Assessor open data: [Residential Condominium Unit Characteristics](https://datacatalog.cookcountyil.gov/resource/3r7i-mrz4.json),
  [Commercial Valuation Data](https://datacatalog.cookcountyil.gov/resource/csik-bsws.json),
  [Parcel Addresses](https://datacatalog.cookcountyil.gov/resource/3723-97qp.json).
- ATTOM coverage claims: [attomdata.com real estate data](https://www.attomdata.com/sem/real-estate-data/),
  [ATTOM marketing list announcement](https://www.attomdata.com/news/company-news/marketing-solutions/attom-data-solutions-launches-new-property-data-marketing-list-platform).
- Zillow on its data layers: [Zillow Group Q&A](https://www.zillowgroup.com/news/in-case-you-missed-it),
  [NBC Chicago report](https://www.nbcchicago.com/news/local/zillow-false-foreclosures/2074006/),
  [Zillow and MRED feed dispute, May 2026](https://www.realestatenews.com/2026/05/14/zillow-looks-to-bypass-mred-with-direct-feed).
- Redfin on its data: [Listing Details help](https://support.redfin.com/hc/en-us/articles/360004496791-Listing-Details),
  [Public Records help](https://support.redfin.com/hc/en-us/articles/360001454531-Public-Records),
  [Competition Tribunal filing (older; CoreLogic, about 100 MLSs)](https://decisions.ct-tc.gc.ca/ct-tc/cdo/en/463146/1/document.do),
  [RentPath acquisition](https://investors.redfin.com/news-events/press-releases/detail/114/redfin-completes-acquisition-of-rentpath-for-608-million),
  [rental search powered by RentPath](https://investors.redfin.com/news-events/press-releases/detail/692/redfin-launches-rental-search).
- Rental listing platforms: [YouGotListings](https://www.yougotlistings.com).
- MLS licensing: [MLS Grid FAQ](https://mlsgrid.com/faq), [Canopy MLS data licensing (fee example)](https://go.canopymls.com/data).
- Marquee at Block 37 (690 units): [Multi-Housing News](https://www.multihousingnews.com/post/cim-group-finishes-apartment-tower-at-chicagos-block-37/).
