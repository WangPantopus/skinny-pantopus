# Data source catalog: everything the replacement plans to use

November 5, 2026. Status words: **in use** (the code calls it today), **checked** (opened and read in this research,
with the date), **planned** (part of the proposed design, terms still to verify), **founder decision** (costs money
or needs an agreement). Facts carried over from the first pass and not re-checked are marked "(first pass)".
Never seed Pantopus data from Smarty, ATTOM or Google output; owner names are dropped when any file is read.

County-by-county sources with links: [property-data-sources-2026-11-05.csv](property-data-sources-2026-11-05.csv)
(second pass) and the survey tables in [county-property-data-2026-11-05.md](county-property-data-2026-11-05.md).

## 1. Can mail arrive at this address? (replaces Smarty)

| Source | What it gives | Terms and cost | Status |
|---|---|---|---|
| Google Address Validation API with USPS CASS (`enableUspsCass`, `googleProvider.js:110`) | Standardized address, USPS deliverability (DPV), vacant, mail-drop store (CMRA), carrier route, ZIP+4, home/business flags | Per request; billing SKU is a founder-only fact; caching limits apply to Google content | In use; Phase 1 makes it the only address check |
| USPS Address Management System (AMS) license | The USPS database run on our own server | About $7,570 a year (first pass); worth it past ~40k checks a month | Planned, later |
| Redeemed and returned postcards | Proof that mail arrives (or not) at an address and unit | Ours | In use (stored outcomes) |

## 2. Does the address exist, and which units? (national address record)

| Source | What it gives | Terms and cost | Status |
|---|---|---|---|
| National Address Database (U.S. DOT) | Address points contributed by states and counties | Free; coverage varies by state; terms to verify | Planned |
| OpenAddresses | Address points gathered from local governments | Free; each source has its own license, checked one by one | Planned |
| Overture Maps addresses | Address points from open sources | Free; per-source licenses; anything derived from OpenStreetMap (ODbL) stays out | Planned |
| State and county address points | Official points with unit numbers (Clark County WA: 250,271 points, 70,569 with a unit, first pass) | Free; per-source terms | Planned, per county |
| Pantopus postcards | Proven units | Ours | In use |

## 3. Is it a home or a business?

| Source | What it gives | Terms and cost | Status |
|---|---|---|---|
| Google's home/business flags (same request as section 1) | Residential or business when Google knows | Per request | In use; blank answers handled as in the Phase 1 plan |
| County land-use codes (assessor files) | The parcel's legal use | Free where published | Planned |
| USACE National Structure Inventory (NSI) | Occupancy type per structure | Free; terms to verify | Planned |

## 4. Building facts (replaces ATTOM `/property/detail`)

| Source | What it gives | Coverage | Terms and cost | Status |
|---|---|---|---|---|
| County assessor files and services | Year built, size, stories, bedrooms, baths, heat, roof, garage, sales, values (varies by county) | With bedrooms or baths: about 22% of Americans; basics: about 34% | Free with per-source terms; some forbid redistribution | Checked Nov 5 (survey, 150 counties + 100-county sample) |
| Statewide files | CT CAMA (bedrooms, baths); NY parcels (bedrooms where counties share); MD SDAT; MassGIS; NJ MOD-IV; FL DOR rolls; UT LIR; TX StratMap (year built); ID improvements; IN DLGF (by request); MN compiled parcels; NC Emergency Management buildings (year built, heated sq ft; about half from county data, half modeled); WV parcel summary (year built) | Whole states | Free; terms per state | Checked (first and second pass) |
| Cook County condo and commercial files | Condo units: bedrooms for 53%, size for 39%; rental towers: unit mix by bedroom count | Cook County IL | Free | Checked Nov 5 |
| USACE NSI | Estimated size, stories, year built (neighborhood median), value per structure | Nationwide | Free; terms to verify; always labeled "estimate" | Planned |
| FEMA USA Structures | Building footprints with height and use, for the Today sky house where counties have none | Nationwide | U.S. government data; terms to verify | Planned |
| Census ACS (block groups) | Median year built, rooms, bedroom mix | Nationwide | Public | Planned, estimates only |
| Verified households | Bedrooms, baths and corrections for their own home | Every home with a verified household | Ours | Planned |
| County files bought or requested | Full assessor files where nothing is free: Fresno $15,492, Greenville $500, Lancaster PA $50 or $500, Johnson KS $100 a year, KGIS $100 per map tile; resellers about $200-300 per county (first pass) | About 42% of Americans have no free file | One-time or yearly | Founder decision (prices in `uncovered-counties-2026-11-05.csv`) |
| ATTOM (fallback) | Today's fields for counties we don't cover yet | National | Subscription; plan allows keeping records | In use; stopped county by county |

## 5. Value and price trend (replaces ATTOM `/attomavm/detail` and `/salestrend/snapshot`)

| Source | What it gives | Terms and cost | Status |
|---|---|---|---|
| County assessed and market values | The assessor's value (in Washington, assessed at 100% of market value) | Free where published | Planned |
| County sales | Sale prices and dates where public (not in TX, UT, ID, NM, KS, MO) | Free where published | Planned |
| FHFA House Price Index (ZIP and tract) | Price trend to age a value forward | Free, public | Planned |
| Pantopus value estimate | Our own estimate from the three above, with a range only after error is measured on held-out sales | Ours | Planned, Phase 4 |

## 6. Mail (Lob)

| Source | What it gives | Terms and cost | Status |
|---|---|---|---|
| Lob | Prints and mails verification postcards and Block Founders cards; delivery webhooks | Developer plan, no monthly fee; about $0.87-0.91 per 4x6 postcard with postage (first pass); live key and return address are founder-only | In use |
| Backup printer behind the mail-provider switch | The same postcards when Lob is down | Per piece; vendor not chosen or priced yet | Planned; founder decision on the vendor |

## 7. Apartment and condo units

| Source | What it gives | Terms and cost | Status |
|---|---|---|---|
| Building floor plan sheets from managers | Every unit number mapped to bedrooms, baths, size and plan | Free with the building's permission; images only if the owner agrees | Planned; first request drafted for Marquee at Block 37 |
| Residents | Their own unit's facts | Ours | Planned |
| Rental listing feeds (ILS) | Unit facts, rents, floor plans | Partner agreements; display rights come with the feed | Later, only if Pantopus shows rentals |
| MLS (IDX, VOW or back-office license) | Facts and photos for any home listed in recent years | Broker relationship plus a fee per MLS (for example $1,000 setup + $1,200 a quarter at one MLS) | Founder decision; not recommended now |

## Never used as a source

Smarty, ATTOM and Google output are never copied into Pantopus's own record (ATTOM copies stay labeled as the
fallback). OpenStreetMap and other share-alike (ODbL) data stay out. Listing sites (Zillow, Redfin) are not scraped.
