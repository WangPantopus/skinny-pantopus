# The business file: find, claim and prove every business (plan, November 11, 2026)

**Status: step 1 is live. Steps 2 to 6 are a plan: none is built, and none starts
until the founder says so.** Step 1 merged on November 11, 2026 as
[PR #3938](https://github.com/WangPantopus/skinny-pantopus/pull/3938) and reached
production that morning. The plan was read against master `58725ba2b2`. Sources
were checked on November 11, 2026; the last section lists what was not checked.

## The short version

1. Google and Yelp forbid copying their listings, so nobody can out-Google Google
   with Google's data. We win with the records they don't join to a listing:
   licences, bonds, insurance, registrations, inspections and payments.
2. The world's place catalog is already free: 88 million places in Overture Maps,
   over 100 million in Foursquare's open set. It is broad, shallow and dirty.
   Breadth comes from there.
3. Depth comes from government records. Washington publishes every contractor's
   licence, bond, insurance, phone and owner, refreshed daily, in the public
   domain. Those contractors are our Crew Day crews.
4. Claiming gets faster than Google's. Google mostly asks for a video and takes
   days. We send a code to the phone or domain an official record already lists.
5. The part nobody can copy is ours: reviews and counts backed by paid invoices
   and verified homes.
6. First we fixed a hole: the first account to type an address blocked every
   other business from it, with no proof. That is step 1, now live.

## Where the big names are weak

| | Google, Yelp, Apple, Nextdoor | Pantopus, with this plan |
| --- | --- | --- |
| Is the contractor licensed, bonded, insured today? | Not shown from state records | Shown, with the state's own date |
| Businesses with no storefront | Thin. The US has 30.4 million of them (Census, 2023), about 78% of all businesses | Covered through licence and registration records |
| Claiming a listing | Google picks the method, mostly video, reviewed in about five business days. Yelp, Apple and Nextdoor call the listed phone, or ask for documents | A code to the phone or domain on the official record, in minutes. Documents and a mailed code as fallbacks |
| Reviews | Anyone can write one | Tied to a paid invoice and a verified home |
| Where each fact came from | Not shown | Every fact carries its source and date |

How the others verify comes from help pages and agency guides, not from the
companies' own policies.

## The sources

### A. Places: breadth

| Source | Size | Licence | What it gives | Limits |
| --- | --- | --- | --- | --- |
| Overture Maps Places (release 2026-10-21) | 88,418,121 places worldwide, monthly | CDLA Permissive 2.0, Apache 2.0 for the Foursquare part. No share-alike | Name, category (about 2,300 kinds), address, phone, website, social links, email, brand, open or closed, a 0–1 "does it exist" score, a stable ID | Overture itself warns of duplicates, junk and missing fields. Only 33% of places say open or closed. No hours |
| Foursquare Open Source Places | Over 100 million (Foursquare's figure) | Apache 2.0 | The same kinds of fields plus created, refreshed and closed dates | Needs a free account and token since the move to their Places Portal. Overture carries only 3.8 million of these as its main record, so it is worth reading directly |
| AllThePlaces | 1.9 million inside Overture | CC0 | Chain locations read from the brands' own store finders, often with hours | Chains only |
| OpenStreetMap | Already in the app | ODbL, credit shown | Hours where mappers added them, shops, restaurants, parks | Share-alike applies if we publish a combined database. Fine for lookups |

Overture's sources are Meta (60.3 million), BrightQuery (15.8 million),
Microsoft (5.9 million), Foursquare (3.8 million), AllThePlaces (1.9 million)
and seven smaller ones.

### B. Licences and registrations: depth, and the proof of who owns what

| Source | Size | Licence | What it gives |
| --- | --- | --- | --- |
| Washington L&I contractor data (four datasets) | 161,657 licences, 76,318 active. Camas 206, Washougal 218, Vancouver 3,077 active | Public domain | Business name, licence number and type, two specialties, address, phone, state business number (UBI), status, start, expiry and suspension dates, owner names, bond company and amount, insurance company, amount and expiry. Refreshed three times a day |
| Oregon Construction Contractors Board | 56,648 active licences | Public domain | The same, including bond and insurance |
| Washington health provider credentials | 2,470,740 rows | Public domain | Every licensed nurse, dentist, therapist and clinic credential, with status |
| Washington CPA firms, childcare centres (2,543), liquor and cannabis licences | Small | Public domain or unlabelled | Licence status per business |
| State company registries, open and free | New York 4.3 million active, Colorado 3.1 million, Oregon 1.6 million rows, Connecticut 1.3 million, Florida (free bulk files) | Public domain or unlabelled | Legal name, formation date, status, registered address |
| Washington Secretary of State, Department of Revenue | No bulk file found. The Secretary of State's old extract page is gone | — | One business at a time through their lookup pages |

Some states charge: Indiana $9,500, Georgia a subscription. Those wait.

### C. Federal records: more depth

| Source | Size | What it adds |
| --- | --- | --- |
| NPPES (every US health provider) | 8 to 9.5 million records, monthly and weekly files | Practice address, phone, specialty |
| IRS exempt organizations file | About 1.8 million nonprofits, monthly | Proof of nonprofit status, which today needs an uploaded letter |
| FMCSA company census | 4,528,545 carriers | Movers and haulers: fleet size, authority, safety record |
| PPP loans of $150,000 and up | About 968,000 loans | Jobs reported in 2020–21. Smaller loans have names withheld |
| Census business counts | By ZIP and industry | Not listings: the yardstick for how complete we are |

Also worth joining, not yet opened: OSHA inspections, wage-and-hour cases,
federal contracts, trademark filings, county health inspections.

### D. The business's own website

About 1.5 million websites publish their own hours, phone, services and prices in
a machine-readable form (Web Data Commons, from the October 2024 Common Crawl).
It is the business's own word, so it is the best open source for hours.

### E. What only Pantopus has

Paid invoices, repeat customers, how fast the business answers (already
measured), endorsements from verified neighbors, and streets served on Crew Day.
None of this can be bought or copied.

### Not usable

- **Google.** Its terms forbid copying and saving business names and addresses,
  and forbid building a directory from its content. We may store only its place ID.
- **Yelp.** At most 24 hours of storage, and no building our own listing database.
- **Paid files** (Data Axle, Dun & Bradstreet, SafeGraph): priced by quote. Not
  needed to start.

## What we would know about one business

A gutter crew in Camas, before its owner has typed anything:

- Legal name, trade name, state business number, and the year it registered.
- Contractor licence number, type and specialties; active since which year; any
  suspension, with dates.
- Bond: company, amount, current or lapsed. Insurance: company, amount, expiry.
- Phone, website, social pages, category, and whether other catalogs think it
  is still open.
- After claiming: jobs paid through Pantopus, repeat households, reply time.

When the owner claims, they see this file first: "Here is what the public record
says about you. Confirm or fix each line." Their fixes are dated and become the
freshest data we hold. Then the file works for them: "Your bond expires in 23
days." That is the moment they learn we know their paperwork better than they do.

## Rules that don't bend

1. **People's names and home addresses stay private.** Owner names from licence
   records are used only to check a claim. A home-based business never shows its
   address. A home on Pantopus still blocks a business from listing there.
2. **Every public fact shows its source and date.** A negative fact (a
   suspension, a lapsed bond) is shown only from the official record, only on an
   exact match by licence or business number, and the owner can answer it.
3. **A weak match is never published.** It waits for the owner to confirm.
4. **Each source's terms are followed.** Washington law (RCW 42.56.070(8)) bars
   agencies from handing out lists of individuals for commercial use, so owner
   names are never used to contact anyone.
5. **Nothing is sent to a business** until the founder decides to.

## How it is built

- **Reuse the monthly places index.** The app already builds a US index from
  OpenStreetMap each month on GitHub and reads it by map area. A second index of
  the same shape, built from Overture, Foursquare, AllThePlaces and
  OpenStreetMap, makes the catalog searchable with no new database table and no
  database growth.
- **Where the files live.** Steps 1 and 2 store no catalog files. From step 3
  the raw monthly copy of each source and the built index go in a private AWS S3
  bucket of their own, so every month's copy is kept and changes can be
  compared. The GitHub release that holds today's places index is too small for
  this, and production uploads go to a Supabase bucket that is the wrong home.
  Creating the bucket is the founder's step.
- **One identity per business.** Each business gets cross-references: the
  Overture ID, Foursquare ID, licence number, state business number, website
  domain. Matching uses name, address, phone and domain together.
- **A business stays what it is today:** an account with locations. Imported
  places never become accounts.
- **One new table, at step 2:** public licence and registration records, one row
  per source record, with the business it is linked to. It serves every later
  source. It needs the founder's approval.
- **Publishing unclaimed listings (step 5)** needs a second table or a search
  service, and the `business_directory` switch, which is off.

## The steps

### Step 1. Stop the first-come address block (live since November 11, 2026)

**Before:** a business location was refused when another business already had
an active location at the same address and suite. No proof was asked, a
forgotten draft counted, and there was no way to contest it.

**Now:**

- A home at the address: refused, as today.
- Another business there that Pantopus has not verified: allowed. Both list it.
- A verified business there with a different name: allowed. Businesses share
  buildings.
- A verified business there with the same or nearly the same name: refused, with
  a sentence that says so and gives the support address.
- A rename can't take a verified business's name at an address the two share.
- The admin verification page lists any unverified same-name pages at the
  business's address, so the reviewer sees them before approving.

**What changed:** the conflict rule in `backend/services/businessAddressService.js`,
the name comparison in `backend/utils/businessNameMatch.js`, the refusal
sentences in `backend/routes/businesses.js`, the admin queue, the web's conflict
card, and the two existing tests of the old rule. No migration, no iPhone or
Android code.

**Checked by:** creating businesses at one address on the web, the iPhone
simulator and the Android emulator against a local backend and database; a home
address still refused; the same-name refusal read on each; saved businesses
still there after a reload or relaunch.

**Left open:** on the iPhone the wizard shows a refusal below the last step's
buttons, so the owner has to scroll to read it. Businesses that existed before
the change were not re-checked.

**Money:** protects the invoice fee. A crew's page is what households pay.

### Step 2. The contractor file for Washington and Oregon

- A daily job loads the four L&I datasets and Oregon's licence list.
- Creating a home-service business searches them by name, phone, licence or
  business number: "Is this you?" One tap fills the page.
- Proof is a code to the phone the state has on file. A match sets
  `government_verified`, a status the code already has and nothing sets today.
  Fallbacks: email at the business's own domain, then the document review that
  exists.
- The business page shows the licence, bond and insurance lines with the state's
  date.
- **Money:** today a crew gets the 10% founding rate only after the founder
  approves a document by hand. This does it in minutes. Households see proof
  before they pay.
- **Needs:** the new table; a text-message provider (the app's sender is a
  placeholder that only logs); web, iPhone and Android screens.

### Step 3. "Find your business" for every kind of business

The create screen searches the new index near the typed address and fills name,
address, category, phone and website. Proof by domain email, then by mailed code.

### Step 4. The full file

The federal and state sources of section C and the website reader, the "confirm
or fix" screen at claim time, and expiry alerts to the owner.

### Step 5. Public listings and the rest of the country

Unclaimed listings become public pages. State registries are added one by one,
free ones first. Other countries follow the same way: Overture already covers
them, and each country's company register adds the depth.

### Step 6. Proof no one else has

Reviews and counts from paid invoices and verified homes, on every business page.

## How we know we are the best

- **Coverage:** our count against the Census count, per ZIP and industry.
- **Freshness:** the age of each fact. Licence facts are a day old.
- **Accuracy:** a sampled share of matches checked by hand every release.
- **Claim time:** minutes from "this is mine" to verified.
- **Bad claims caught.**

## What the founder decides

1. ~~Go ahead with step 1.~~ Approved and live, November 11.
2. One new table for public licence and registration records (step 2).
3. A text-message provider, which costs a little per code and needs an account.
4. New screens on web, iPhone and Android from step 2 on.
5. The `business_directory` switch and a second table, at step 5 only.

## Not checked

- Counts for the US, Washington and Clark County inside Overture and Foursquare.
  Measuring them is the first task of step 3.
- The licence terms of the L&I bond dataset, the Oregon and New York registries
  and the childcare list, which show no licence label.
- Whether Florida's "informational purposes" wording allows our use.
- Census totals per ZIP: the Census API now needs a key. The 78% share is from
  census.gov; the 30.4 million count is from a search summary of Census's
  nonemployer statistics, not the table itself.
- Prices of the paid files, and of text messages.
- Whether the mailed-code sender used for homes is switched on in production.
- Company registers outside the US.
- This is not legal advice. A lawyer should read the plan before step 5.

## Sources

- Overture: [release notes](https://docs.overturemaps.org/blog/2026/10/21/release-notes/), [Places guide](https://docs.overturemaps.org/guides/places/), [attribution](https://docs.overturemaps.org/attribution/)
- Foursquare: [schema](https://docs.foursquare.com/data-products/docs/places-os-data-schema), [access](https://docs.foursquare.com/data-products/docs/access-fsq-os-places)
- AllThePlaces: [project](https://github.com/alltheplaces/alltheplaces)
- Washington: [L&I general](https://data.wa.gov/d/m8qx-ubtq), [principals](https://data.wa.gov/d/4xk5-x9j6), [insurance](https://data.wa.gov/d/ciwg-agsx), [bond](https://data.wa.gov/d/bzff-4fmt), [health credentials](https://data.wa.gov/d/qxh8-f4bd), [RCW 42.56.070](https://app.leg.wa.gov/RCW/default.aspx?cite=42.56.070)
- Oregon: [contractor licences](https://data.oregon.gov/d/g77e-6bhs), [active businesses](https://data.oregon.gov/d/tckn-sxa6)
- Other states: [New York](https://data.ny.gov/d/n9v6-gdp6), [Colorado](https://data.colorado.gov/d/4ykn-tg5h), [Connecticut](https://data.ct.gov/d/n7gp-d28j), [Florida](https://dos.fl.gov/sunbiz/other-services/data-downloads/), [Indiana](https://inbiz.in.gov/Inbiz/BulkDataServices/Index)
- Federal: [NPPES](https://download.cms.gov/nppes/NPI_Files.html), [IRS exempt organizations](https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf), [FMCSA census](https://datahub.transportation.gov/d/az4n-8mr2), [PPP](https://data.sba.gov/dataset/ppp-foia), [Census business patterns](https://www.census.gov/newsroom/press-releases/2025/2023-county-business-patterns.html), [Census small business story](https://www.census.gov/library/stories/2026/05/small-business-week.html)
- Websites: [Web Data Commons 2024](https://www.uni-mannheim.de/dws/news/wdc-json-ld-microdata-rdfa-data-corpus-2024-published)
- Terms: [Google Maps Platform](https://cloud.google.com/maps-platform/terms), [Yelp API](https://terms.yelp.com/developers/api_terms/20250113_en_us/)
- Claim methods: [Google guide](https://www.brightlocal.com/learn/verifying-google-my-business-without-a-postcard/), [video problems](https://www.sterlingsky.ca/top-3-issues-with-video-verification/), [Yelp](https://www.brightlocal.com/learn/how-to-add-or-claim-a-yelp-business-listing/), [Apple](https://business.apple.com/docs/onboarding-guide/core-concepts/brand-claim-process), [Nextdoor](https://business.nextdoor.com/local/resources/managing-your-nextdoor-business-page-answers-to-your-most-asked-questions)
