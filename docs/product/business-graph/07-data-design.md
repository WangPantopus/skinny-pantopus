# The business data: how we get it, store it, index it, query it and refresh it

November 11, 2026 · Measured on November 11, 2026 (Pacific). Nothing here is
built. No production system was touched, no account was created and nothing
was spent.

This replaces the outlines in sections 4 and 7 of
[the business file contract](03-business-file-contract.md) with a design made
from real downloads. Every number says how it was measured. What could not be
measured is listed in section 12.

## 1. The short version

1. **The whole United States fits on a laptop.** Overture's newest release has
   18,445,349 United States places. With every field it is 2.15 GB, and it
   downloaded in 89 seconds. This is gigabytes, not terabytes.
2. **Place catalogs miss most contractors.** Of 4,913 active Washington
   contractor licences with a Clark County address, only about one in five
   could be tied to a place listing. Three in four have no listing at all. For
   our crews the state licence file is the main source, and the place catalog
   is the extra.
3. **A name alone never ties two records.** Ties by phone and name, or by
   address and name, were right every time in the hand check (53 of 53). Ties
   by name alone across the county were wrong almost every time (at most 1
   right in 20).
4. **The "does it exist" score cannot be used as a cut.** One in six listings
   that a state licence proves real scores under 0.5. Dropping low scores, as
   the outline planned, would drop real crews.
5. **Store it as files in S3, search it as one file on the server.** The raw
   copies and the built business file live in a private S3 bucket. The server
   reads one search file (7.6 GB, built in about five minutes) from its own
   disk. A name anywhere in the country answered in 2 to 31 thousandths of a
   second; a phone or a website in under one.
6. **The app's database stays small.** It holds only licence records
   (about 208,000 rows for Washington and Oregon) and what owners claim and
   correct. The 18 million listings never enter it.
7. **It costs a few dollars a month**, at list prices (section 10).

## 2. What was measured

Everything was downloaded to the external drive, outside Git:
`/Volumes/Studio-Extended/rigs/BIZDATA/` (about 16 GB in all; section 13 says what is
in it).

### 2.1 Terms, read before downloading

| Source | Licence shown on its own page | Limits on our use |
| --- | --- | --- |
| Overture Places, release 2026-10-21.0 | CDLA Permissive 2.0 for Meta, Microsoft, BrightQuery and seven smaller sources; Apache 2.0 for the Foursquare part, with a notice file; CC0 for AllThePlaces | None on storing or showing. Keep the Foursquare notice with any copy we pass on. Credit "Overture Maps Foundation" |
| Washington L&I, general (`m8qx-ubtq`) and principals (`4xk5-x9j6`) | Open Data Commons Public Domain Dedication and License | None from the licence. State law (RCW 42.56.070(8)) bars using lists of individuals for commercial contact, so owner names are never used to reach anyone |
| Washington L&I, insurance (`ciwg-agsx`) | Public Domain | The same |
| Washington L&I, bond (`bzff-4fmt`) | **No licence label** | Still open, as the plan said. Treated like its three sister files until someone at L&I says otherwise |
| Oregon CCB active licences (`g77e-6bhs`) | Public Domain (U.S. Government) | None |
| Foursquare Open Source Places | Apache 2.0 | **Not downloaded.** It now needs a free account and a token from Foursquare's Places Portal. Creating that is the founder's step |

### 2.2 Overture Places

How: the public bucket was read with DuckDB, keeping rows whose first address
says `US`. The whole world is 16 files, 11.9 GB. The United States part took
89 seconds to fetch and 22 seconds to count.

| | United States | Washington | Clark County |
| --- | --- | --- | --- |
| Places | 18,445,349 | 390,716 | 22,165 |
| Size on disk, all fields | 2.15 GB | 46 MB | 2.7 MB |
| Has a name | 100% | 100% | 100% |
| Has a phone | 87.3% | 87.0% | 88.4% |
| Has a website | 78.5% | 82.9% | 85.2% |
| Has a social page | 57.9% | 55.3% | 56.5% |
| Has an email | 35.4% | 37.0% | 40.5% |
| Has a category | 95.7% | 96.5% | 95.7% |
| Has a street address | 96.3% | 96.9% | 97.3% |
| Street address starts with a house number | 94.1% | 95.0% | 95.7% |
| Has a city | 99.7% | 99.7% | 99.8% |
| Has a ZIP code | 97.2% | 97.2% | 97.5% |
| Has a brand | 8.9% | 8.2% | 9.2% |
| Says open or closed | 74.0% | 76.0% | 74.6% |
| — says open | 13,011,787 | 283,273 | 16,004 |
| — says closed for good | 638,054 | 13,679 | 522 |
| — says nothing | 4,795,340 | 93,762 | 5,639 |
| Source record dated 2025 or 2026 | 91.8% | 90.5% | 88.9% |

Clark County is every place whose point falls inside the Census Bureau's
county outline. Washington is every place whose address says `WA`.

**The "does it exist" score (0 to 1):**

| Score | United States | Washington | Clark County |
| --- | --- | --- | --- |
| Under 0.2 | 2.5% | 1.9% | 2.1% |
| 0.2 to 0.4 | 6.9% | 5.9% | 6.6% |
| 0.4 to 0.6 | 8.8% | 8.9% | 9.4% |
| 0.6 to 0.8 | 14.4% | 12.9% | 10.0% |
| 0.8 to 0.9 | 7.9% | 8.0% | 9.1% |
| 0.9 and up | 59.6% | 62.4% | 62.8% |
| Under 0.5, as a count | 2,149,906 | 38,511 | 2,386 |

The middle score is 0.92 in all three. Nearly all the low scores come from
one source: 20.6% of Meta's records score under 0.5, against 1.4% of
BrightQuery's and 0.1% of Microsoft's and Foursquare's.

**Where the records come from** (the first source named on each, United
States): Meta 10,127,297 · BrightQuery 4,220,346 · Microsoft 2,544,038 ·
Foursquare 1,109,358 · AllThePlaces 261,010 · six others 183,300.

**Duplicates and junk:**

| | United States | Washington | Clark County |
| --- | --- | --- | --- |
| Extra rows with the same name and the same phone | 653,320 (3.5%) | 11,408 (2.9%) | 585 (2.6%) |
| Extra rows with the same name, street and ZIP | 173,324 | 3,136 | 163 |
| Extra rows with the same name within about 100 metres | 49,555 | 1,083 | 69 |
| No street, no phone and no website | 198,298 (1.1%) | 3,451 | 143 |
| Not a business at all (parks, historic sites, rivers and the like) | 491,319 (2.7%) | 12,397 | 635 |
| Name shorter than three letters | 17,120 | 529 | 20 |

One Vancouver roofer appears three times with one phone and three spellings
of its name. 3.2 million United States listings share their phone with
another listing (16.1 million phones, 12.9 million different ones). 126,555
rows name no state, about 9,600 leave it blank, and a few thousand spell it
out ("California"). 64,087 give a Facebook or Instagram page as the website.
There are no opening hours anywhere in the file.

**The largest groups, United States:** home services 1,058,098 · financial
services 939,197 · restaurants 882,017 · real estate 775,148 · beauty and
personal care 711,343 · car services 525,995. There are 2,057 detailed
categories and 284 broad ones.

**Month to month** (Washington, release 2026-09-23.1 against 2026-10-21.0):
of 382,560 ids, 382,389 were still there four weeks later (99.96%). 171 were
gone and 7,935 were new. 31,660 of the kept ones (8.3%) had a changed name,
phone, website, street, category or open-or-closed word. The ids are stable
enough to build on.

### 2.3 The contractor files

How: each file was downloaded whole as a spreadsheet file from the state's
open-data site and counted with DuckDB. The five took 147 seconds; the bond
file is slow to serve.

| File | Rows | Size |
| --- | --- | --- |
| Washington L&I, general | 161,657 | 35.6 MB |
| Washington L&I, principals (owner names) | 251,432 | 32.6 MB |
| Washington L&I, insurance | 77,402 | 16.0 MB |
| Washington L&I, bond | 177,369 | 28.5 MB |
| Oregon CCB active licences | 56,688 rows, 45,842 licences | 14.8 MB |
| All five | | 127.5 MB |

**Washington.** 76,306 licences are active (61,399 expired, 9,692 suspended,
9,305 re-licensed, 4,712 out of business). One row per licence, no repeats.

| Field | All 161,657 | The 76,306 active |
| --- | --- | --- |
| Name, street, city, ZIP, phone, state business number (UBI), start and end dates | 100% | 100% |
| A principal's name | 99.8% | 99.9% |
| First specialty | 99.7% | 99.7% |
| Second specialty | 0.1% | 0.1% |
| A bond on file that is not cancelled | — | 75,570 (99.0%) |
| Insurance on file that has not ended | — | 70,835 (92.8%) |

Things to know about the active ones:

- 9,793 (12.8%) are licensed to an **individual**, so the "business name" is
  often a person's name.
- 11,846 (15.5%) give a **PO box**, not a street.
- 6,772 share their phone with another active licence, and 5,692 share their
  state business number with another. One company can hold several licences.
- 9,315 have an address outside Washington (Oregon 4,101, Idaho 1,574).
- City names come in two spellings ("VANCOUVER" and "Vancouver"), and long
  business names are shortened by the state to fit 30 letters
  ("ENVIRNMTL CNSLTG"). That matters for matching (section 3).
- Junk is rare: 36 phones that are not ten digits, 7 names that start with
  punctuation.

**Oregon.** Every row has a name, address and phone. 90.0% carry a bond and
88.8% carry insurance, with company, amount and end date in the same row. A
licence repeats once for each extra person or endorsement (10,846 repeated
rows), so it is read as 45,842 licences. 4,644 rows have a Washington address.

**Clark County.** 4,913 active Washington licences have an address in one of
Clark County's 23 ZIP codes (Woodland's ZIP, which straddles the county line,
is left out). 2,151 Oregon licences have a Clark County address. 1,469 of the
4,913 share a phone with one of those Oregon licences: the same crews,
licensed on both sides of the river.

## 3. Matching, tested on Clark County

**The question:** can a licence be tied to a place listing, and how often is
the tie right?

**How:** each of the 4,913 active Washington licences was compared with the
22,165 Clark County listings, and by phone with all 18.4 million United States
listings. Names were compared with the app's own rule
(`backend/utils/businessNameMatch.js`). Addresses were compared by house
number, street and ZIP after folding "Street" to "ST" and dropping suite
numbers.

### 3.1 What tied

| Tie | Washington licences | Share | Hand check |
| --- | --- | --- | --- |
| Same phone, and the names read as the same | 672 | 13.7% | 48 of 48 right |
| Same street address, and the names read as the same | 148 | 3.0% | 5 of 5 right |
| Exactly the same name in the county, nothing else agrees | 131 | 2.7% | 4 of 5 right, 1 could not be told |
| **Tied with confidence** | **951** | **19.4%** | |
| Same phone, but the names differ | 219 | 4.5% | 8 of 13 right |
| **No listing found** | **3,743** | **76.2%** | 48 of 50 truly had none |

The hand-check column counts both samples of section 3.2 for the first two
rows and the second sample for the others.

The same test on the 2,151 Oregon licences with Clark County addresses: 524
tied with confidence (24.4%), 117 by phone only, 1,510 with no listing.

From the other side: 1,076 of Clark County's 22,165 listings tied to a
licence. Of the 1,750 listings filed under "home service", 687 tied (39%);
of the 299 under "building or construction", 88. 115 licences found their
listing outside the county, by phone (a Portland or Boise office of the same
company).

### 3.2 The hand check

Two samples of 50 ties and one of 50 non-ties were read one by one, picked at
random with a fixed seed.

- **First sample, name rule used on its own across the county:** 28 of 50
  right. Every phone or address tie was right. The 20 name-only ties were
  wrong 19 times: "JD Mechanical" tied to "A-1 Mechanical", "Welter Home
  Repair" to a listing called "Home". The rule was written to compare two
  names at one address, and it is right for that. It says "same" whenever one
  name's words all appear in the other, which across a whole county is
  nearly always a coincidence.
- **Second sample, name-only ties tightened to an exact match:** 44 of 50
  right. All 32 phone-and-name and address-and-name ties were right. Of the
  6 not right, 5 were phone-only ties and 1 was an exact-name tie that could
  not be told either way.
- **Phone-only ties are two different things.** 8 of 13 were the same
  business under the state's shortened name ("CERTIFIED ENVIRNMTL CNSLTG LLC"
  and "Certified Environmental Consulting"). 5 were a different business
  with the same owner's phone (a landscaper and a firewood seller; a handyman
  and an inn). A rule that reads shortened words (each word of the state's
  name is a shortening of a word in the listing) passed 93 of the 219.
- **50 licences with no tie:** for 48 there was no listing at that address
  and no listing in the county sharing an unusual word of the name. 2 were
  misses: a listing at the same address under a trade name unlike the legal
  name.

What this check cannot tell: whether a business with no listing has one on
Google. Google's terms forbid us from reading that, so "no listing" means
"none in Overture".

### 3.3 What follows

1. **Contractors come from the licence files.** Three in four are in no
   place catalog. Overture adds a website, a category and a map point for
   the one in five it knows.
2. **The tie rule** for the build:
   - *Tied* when the phone agrees and the names read as the same, or the
     street address agrees and the names read as the same. The app's name
     rule is used only in these two cases, plus the shortened-word rule for
     state names.
   - *Offered to the owner, never published* when only the phone agrees or
     only the exact name agrees. The owner sees "Is this also you?"
   - *Not tied* on a name alone, or an address alone (498 licences shared an
     address with some other business).
3. **Keep low scores.** Of 1,256 Washington and Oregon licences tied to a
   listing by phone and name or address and name, 200
   (16%) found a listing scoring under 0.5, and 52 one under 0.2. The score is kept as a fact
   and used to rank, and to decide what a stranger may see at step 5. It is
   never used to throw a record away.
4. **Fold duplicates in the build.** Rows with the same name and phone, or
   the same name, street and ZIP, become one business that remembers every
   source id (about 4% of rows).

## 4. How each source is fetched, and how often

| Source | Fetched how | How often | Size each time | Measured |
| --- | --- | --- | --- | --- |
| Overture Places, United States | DuckDB reads the public bucket and keeps `US` rows. No account | When a new release appears: monthly | 2.15 GB | 89 seconds |
| Washington L&I, four files | The whole file from the open-data site | Daily, at night. The state refreshes three times a day; once a day is enough for a licence line | 113 MB | 147 seconds with Oregon |
| Oregon CCB | The whole file | Daily | 15 MB | Included above |
| Foursquare Open Source Places | Its catalog, with a token | Monthly, once the founder has a token | Not measured | — |
| Later sources (section 11) | Each its own small reader | Monthly, or as the source publishes | Listed there | — |

Rules for every fetch:

- A source's terms are read and written down before its reader is switched
  on (contract rule 5). This document's section 2.1 is that record for the
  five sources here.
- Whole files, never page by page: all five contractor files together are
  smaller than one phone video.
- A fetch that comes back much smaller than the last one (under 90% of its
  rows) is kept aside and not used. A source having a bad day must not mark
  thousands of licences as gone.
- The fetch writes the untouched copy to S3 first, then everything else is
  built from that copy. A build can always be repeated from what was saved.

## 5. Where everything is stored

The founder asked whether this goes in S3. **Yes for the files, no for the
live search, and almost nothing in the app's database.**

### 5.1 One private S3 bucket

Named by `BUSINESS_CATALOG_BUCKET`, in the same AWS region as the server, so
copying to the server costs nothing. Nothing in it is public.

| Folder | Holds | Format | Size (measured unless said) | Changed after writing |
| --- | --- | --- | --- | --- |
| `raw/overture/<release>/` | The United States places, every field, as fetched | Parquet | 2.15 GB a month | Never |
| `raw/wa_lni/<date>/`, `raw/or_ccb/<date>/` | The contractor files as fetched | The states' own files, compressed | 128 MB a day before compression | Never |
| `raw/<other source>/<release>/` | Each later source | As published | Section 11 | Never |
| `built/<yyyymmdd>/businesses.parquet` | The business file: one row per business, every fact with its source and date (section 6) | Parquet | About 2.5 GB (estimate: Overture's 2.15 GB plus the licence facts) | Never |
| `built/<yyyymmdd>/ids.parquet` | Which source id belongs to which Pantopus business id | Parquet | About 0.5 GB (estimate) | Never |
| `search/<yyyymmdd>/catalog.sqlite.gz` | The search file the server reads | SQLite, compressed | 3.35 GB (7.6 GB opened) | Never |
| `search/current.json` | Which build the server should be reading | A few lines | — | By the build only |
| `reports/<yyyymmdd>.json` | What each build counted: rows in, rows out, ties, what changed | A few lines | — | Never |

Parquet is the format Overture itself ships. It is a table saved column by
column: a tool reads only the columns and rows it asks for, which is why the
whole country could be counted in 22 seconds.

A new build is always a new folder. The old one stays, so any month can be
compared with any other, and a bad build is undone by pointing
`search/current.json` back.

### 5.2 The server's own disk

The server keeps the current search file, opened, on its disk: 7.6 GB, plus
the same again while a new month's file is being swapped in. So about 16 GB
of disk for this. The server's disk size and memory were not checked
(section 12); making room is the founder's step if it is short.

### 5.3 The app's database

Only what belongs to people and to proof:

| What | Where | Size |
| --- | --- | --- |
| Licence records, Washington and Oregon | `PublicBusinessRecord` (the contract's table, waiting for the founder's approval) | 161,657 + 45,842 rows. Roughly 150 to 250 MB with its indexes (estimate; not loaded into a database for this test) |
| A claimed business's ties | `BusinessProfile.attributes.catalog_ids`, and `PublicBusinessRecord.business_user_id` | A few values per claimed business |
| The owner's confirmations, corrections and hidden lines | `BusinessProfile.attributes.file` (contract section 5) | A few lines per claimed business |

The 18 million listings never enter the database. No new table beyond the
one the contract already asks for.

**Why the licence records are in the database and the listings are not.** A
licence record is tied to an account by proof, changes daily, raises alerts
and must never be lost between builds: that is database work. A listing is
read-only reference data replaced whole each month: that is a file's work.

## 6. The record for one business

One row in `businesses.parquet`, shown here as text:

```
pantopus_id   biz_01JCQ8…          minted once, never reused (section 9)
name          "Mountain View Pool & Spa"
kind          home_service · swimming pool
point         45.86, -122.67        from the listing; none for a licence-only business
home_like     false                 section 8
refs          overture: [two ids]   every source id folded into this business
              wa_lni:   [licence number]
              ubi:      [number]
              phone:    [number] · domain: [site]
facts         one line each, see below
tie           "phone+name"          how the licence and the listing were tied
```

Each fact is its own line with four things beside the value:

| Fact | Value | Source | Source's own id | Date the source was read | Source's own date |
| --- | --- | --- | --- | --- | --- |
| `name` | Mountain View Pool & Spa | overture | its id | 2026-11-11 | 2026-08-02 |
| `legal_name` | MOUNTAIN VIEW POOL & SPA LLC | wa_lni | licence number | 2026-11-11 | — |
| `phone` | (360) … | overture | its id | 2026-11-11 | 2026-08-02 |
| `phone` | (360) … | wa_lni | licence number | 2026-11-11 | — |
| `licence.status` | ACTIVE | wa_lni | licence number | 2026-11-11 | — |
| `bond.amount` | 30000 | wa_lni_bond | licence number | 2026-11-11 | — |
| `exists_score` | 0.92 | overture | its id | 2026-11-11 | — |

Rules of the record:

1. **Every fact keeps its source and both dates.** When two sources give the
   same fact (the phone above), both lines are kept. Agreement between
   sources is itself worth showing: "listed by 2 sources".
2. **The value shown is chosen when read, by a fixed order:** the owner's
   correction, then an official record tied by licence or business number,
   then the listing with the newest source date. The order is in one place
   in the code, so it can be changed without rebuilding.
3. **The owner's corrections are not in this file at all.** They live in the
   app's database beside the business's account, each with its date and one
   of `confirmed`, `corrected`, `hidden`. The monthly build cannot touch
   them, because it never writes there. When the file is read for an owner
   or a page, the corrections are laid over the source facts, and the source
   fact stays visible to the owner underneath ("The state says …, you
   say …").
4. **An owner's correction never changes what an official record says.** It
   changes what the page says, and is shown as the owner's.
5. **Private facts are a separate list** on the row (`private`), holding
   owner names and the street of a home-like business. The search file is
   built without that list (section 8).

## 7. The indexes, and how the app asks

Two questions have to be fast: **"what is near this address"** (the create
screen, a map) and **"this name anywhere in the country"** (an owner looking
for their business, a neighbor looking one up). The claim flow adds two more:
**"whose phone is this"** and **"whose website is this"**.

### 7.1 The options weighed

All four were sized against the same 17,807,295 open United States places
(everything not marked closed for good).

| Option | Near an address | A name anywhere | Phone or website | Size | New moving parts |
| --- | --- | --- | --- | --- | --- |
| **A. Files by map area in S3**, read a slice at a time. This is how the app's places index works today | 13 to 45 thousandths of a second in ordinary towns. 0.26 seconds in downtown Los Angeles. 1.1 seconds in Midtown Manhattan, where the nine areas hold 273,669 places | **Cannot do it.** There is no area to look in | Cannot | 1.37 GB, 236,488 areas, plus a 6.4 MB list of them held in memory | None |
| **B. One search file on the server's disk** (SQLite, with a word index) | 0.2 thousandths in Camas; 28 in Midtown Manhattan | 2 to 31 thousandths; 110 for a single very common word like "construction" | Under 1 thousandth | 7.6 GB on disk, 3.35 GB compressed in S3 | A file to copy each month. No service to run |
| **C. A table in the app's database** (Postgres, with its fuzzy-text index) | Would work | Would work | Would work | Not measured. At least the 4.3 GB the bare rows took in option B, plus indexes: likely 8 to 12 GB, in a database whose plan includes 8 GB | Reloading 18 million rows a month into the database that runs the live app |
| **D. A hosted search service** | Would work | Best at misspellings | Would work | — | A new vendor, a monthly bill, another place for data to be out of date. Not priced |

How these were measured: both A and B were built in full from the downloaded
data and queried from Node, the server's language, on this Mac with the files
already in memory. A used the app's own area size (about 5 km). B's times are
the fastest of five runs; the first run was never more than twice as long.
Section 12 says what that leaves out.

Smaller areas do not rescue option A: at about 1 km there are 1,475,466 areas,
the list of them is 41 MB, and it still cannot search by name.

### 7.2 The recommendation: option B, built from the Parquet file

- **S3 holds the truth, the server holds a copy to search.** The build writes
  `catalog.sqlite`, compresses it and puts it in S3. The server downloads it
  to its disk, opens it read-only, and swaps to it. No request ever waits on
  S3.
- **One file answers all four questions**, and they can be combined: a name
  near an address, a name in one state, a name in one city.
- **Nothing to run.** SQLite is a file format with a reader, not a server.
  The reader is built into Node from version 22.5 (the server runs Node 22;
  it is still marked experimental there, so the build may choose the
  long-standing `better-sqlite3` package instead).
- **The app's database is not put at risk.** No monthly reload of 18 million
  rows, no growth past its plan.
- **The existing places index stays as it is.** It is OpenStreetMap data
  under a share-alike licence. It remains its own file, joined when read
  (contract call B7), never merged into this one.

What is inside the search file, as measured:

| Part | For | Size |
| --- | --- | --- |
| The rows: Pantopus id, source ids, name, category, street, city, state, ZIP, point, phone, website, brand, open or closed, score, source date | Everything shown in a result | 4.33 GB |
| Word index over name and city, with word beginnings of 2, 3 and 4 letters | A name anywhere; typing as you go | 1.47 GB |
| Index by map cell (about 150 metres) | Near an address | 0.30 GB |
| Index by phone | "Whose phone is this" | 0.31 GB |
| Index by website | "Whose website is this" | 0.38 GB |
| Index by source id | Following a saved id back to its row | 0.82 GB |

A home-like business's street and every owner name are not in it.

The licence records are searched in the database, as the contract's section
3.3 says, because there are only 208,000 of them and they change daily. A
"find your business" request asks both and merges the two lists by the tie
rule of section 3.3.

### 7.3 How the app asks

The contract's routes do not change. What sits behind them:

| Request | Behind it | Measured |
| --- | --- | --- |
| `GET /api/businesses/find?q=&lat=&lng=` (the create screen) | The search file: the words typed, in the nine map cells around the point, widening to the city, then the state, then the country until 8 are found. The database: licence records by name | 0.2 to 14 thousandths of a second in Camas; up to 110 in Midtown Manhattan |
| `GET /api/businesses/records/search?q=&state=&phone=&licence=` | The database | Not measured: needs the table |
| A name with no place given | The search file's word index, best match first | 2 to 31 thousandths; 110 for one very common word |
| "Is this phone or website already a business" (claim proofs) | The search file's phone and website indexes | Under 1 thousandth |
| A business page's facts | The database for a claimed business and its licence lines; the search file by id for the rest | Under 1 thousandth for the file |

Search misspellings: the word index finds word beginnings ("barkdust" finds
"Barkdusters"), not misspellings ("barkdsters"). When a search finds nothing,
the server tries the first three letters of each word and then keeps the
candidates the app's name rule accepts. That second pass was not built or
timed.

## 8. Privacy rules

These are the plan's rules, made exact by what the data showed.

1. **Owner names never leave the build and the claim check.** The principals
   file (251,432 rows of names) is kept in `raw/` and in
   `PublicBusinessRecord.private_people`. It is not in the search file, not
   in any response, and never used to contact anyone.
2. **A licence held by an individual is not listed by name.** 9,793 active
   Washington licences (12.8%) are in a person's own name. Such a record can
   be found only by its licence number or its phone, by someone claiming it.
   It gets a public name when its owner claims and chooses one.
3. **A home-like business shows no street, anywhere.** A record is home-like
   when the app's address check says the address is a residence, when a
   Pantopus home exists there, or when the source says it works from a
   service area. Home-like records carry city and ZIP only in the search
   file, and their map point is moved to the middle of the ZIP area. How
   many records this covers was not measured (section 12); for contractors,
   expect most.
4. **A PO box is shown as city and ZIP.** 15.5% of active licences give one.
5. **A home on Pantopus still blocks a business from listing there**, as
   today.
6. **Bad news only from the official record**, tied by licence or business
   number, with its date (contract call B6). A phone-only or name-only tie
   publishes nothing.
7. **Phones on a licence record stay masked** until the claim is proved
   (contract call B5). Phones from a public listing are already public.
8. **Emails are kept but not shown and not used.** 35% of listings carry
   one. Nothing is sent to a business that has not claimed.
9. **The raw files are private.** The bucket has no public access, and the
   server's key reads only `search/`.

## 9. The monthly refresh, stable ids and owner corrections

### 9.1 What runs

| When | What | Took, measured |
| --- | --- | --- |
| Each night | Fetch the five contractor files to `raw/`. Update `PublicBusinessRecord` row by row. A licence missing from a full file gets `gone_at`; it is not deleted | 147 seconds to fetch |
| When Overture publishes (monthly) | 1. Fetch the United States places to `raw/` | 89 seconds |
| | 2. Fold duplicates; tie listings to licence records by the rule of section 3.3 | Seconds in the test |
| | 3. Give every business its Pantopus id from last month's `ids.parquet` (9.2) | — |
| | 4. Write `businesses.parquet`, `ids.parquet` and the report | — |
| | 5. Build `catalog.sqlite` | About 5 minutes (97 seconds to load, 73 for four indexes, 94 for the word index) |
| | 6. Check the build (9.4). If it passes, upload and point `current.json` at it | — |
| Within the hour | The server sees the new `current.json`, downloads, opens the new file, swaps, and deletes the old one after a day | Not measured from the server |

The whole monthly build took under 15 minutes of machine time on this Mac and
needed about 13 GB of working disk. It can run where the places index is
built today (a monthly GitHub job), if that machine's free disk is first made
large enough, or on any machine with 20 GB free.

### 9.2 Stable ids

- **A Pantopus id is minted the first time a business is seen** and is never
  reused. Everything outside the build (a claimed page, a saved search, a
  link) holds the Pantopus id or a source id, never a row number.
- **`ids.parquet` is the memory.** It lists every source id ever seen
  (Overture id, licence number, state business number) with its Pantopus id.
  Each build starts from last month's list.
- **A known source id keeps its Pantopus id.** Measured: 99.96% of
  Washington's Overture ids survived a month.
- **A source id that disappears is not deleted.** Its business is kept and
  marked "not seen since" that date. If a new source id arrives with the
  same phone and name, it joins the old business. In the test only 1 of the
  171 vanished ids came back that way, so vanished mostly means gone.
- **When two businesses turn out to be one,** the older Pantopus id wins and
  the other is kept in the list as "now part of". When one turns out to be
  two, the original keeps the id and the split-off gets a new one.

### 9.3 Owner corrections and claims survive by design

- A claim is a row in the app's database tied to a licence number or to
  source ids. The build reads those ties and never writes them.
- A correction is stored against the Pantopus id and the fact's name, in the
  database. A rebuild replaces the source facts beneath it; the correction
  is laid back on top when read.
- When a source later changes a fact the owner had confirmed, the owner's
  line stays and the file shows them the difference: "The state now
  says …". When a source later agrees with the owner's correction, nothing
  shows.
- A claimed business whose listing vanishes from every source keeps its
  page. Its facts simply stop getting newer.

### 9.4 Checks before a build goes live

A build is refused, and last month's stays, when any of these is off:

- Total rows moved by more than 5% from last month (the test saw +2.0%).
- More than 1% of last month's ids are missing (the test saw 0.04%).
- Any state lost more than 10% of its rows.
- A sample of 50 new ties and 50 non-ties has not been read by a person and
  written into the report. The plan promised this every release; the hand
  check in section 3.2 is the first one.

## 10. What it costs each month

At AWS's list prices as known to this document's author, not re-read today:
S3 storage about $0.023 per GB a month, server disk about $0.08 per GB a
month, and no charge for copying between S3 and a server in the same region.

| Item | Amount | A month |
| --- | --- | --- |
| S3, first month: one raw copy, one built file, one search file, a month of nightly contractor files | About 12 GB | About $0.30 |
| S3 after a year, if nothing is ever deleted | About 140 GB | About $3.30 |
| The server's extra disk | 16 GB | About $1.30 |
| The monthly build's machine | Free on GitHub for a public repository, or minutes on any machine | $0 |
| The database | No change of plan: about 0.2 GB more | $0 |
| Overture, Washington, Oregon | Free | $0 |
| **Total** | | **About $2 at first, about $5 after a year** |

Keeping only the last three search files and moving raw copies older than
three months to S3's cold tier would hold it near $2. That is a setting on
the bucket, and the founder's choice.

Not in this table: a text-message provider for claim codes, and the mailed
codes. Those are priced in the plan's open questions, not here.

## 11. What would make each business's file richer

In the order worth adding. Each joins the same way: a small reader, a copy
in `raw/`, facts with a source and a date, a tie by an exact number where
one exists.

| | Source | Adds | Size | Licence | Ties by |
| --- | --- | --- | --- | --- | --- |
| 1 | **Washington L&I and Oregon CCB** (in hand) | Licence, bond, insurance, specialties, years in business | 208,000 licences, 128 MB | Public domain; the bond file shows no label | Licence number, state business number |
| 2 | **AllThePlaces, read directly** | **Opening hours** for chain locations, from the brands' own store finders. Overture carries the places but drops the hours | 40.3 million lines worldwide, 2.9 GB, weekly (measured from its own run record) | CC0 | Brand and address |
| 3 | **OpenStreetMap** (already in the app) | Hours where mappers added them, wheelchair access, outdoor seating | Already built monthly | ODbL: joined when read, never merged into the file | Name and point |
| 4 | **The business's own website** | Hours, services, prices, photos, in the site's own machine-readable block. 78.5% of listings name a website | Our own polite read of each site, or the 1.5 million sites in Web Data Commons (2024) | The business's own published facts. Follow each site's robots file. Worth a lawyer's read | The website itself |
| 5 | **Foursquare Open Source Places** | More small businesses, and the dates each was created and last seen, which is the best open sign of "still open" | Over 100 million worldwide (Foursquare's figure) | Apache 2.0. **Needs the founder's free account and token** | Name, phone, point |
| 6 | **National health provider file (NPPES)** | Every clinic, dentist, therapist: practice address, phone, specialty | 8 to 9.5 million records; 1.13 GB compressed, monthly (size read from the file's own header) | Federal public data | Its own provider number; name and phone |
| 7 | **Washington health credentials** | Whether each of those providers' state licence is active | 2,470,740 rows | Public domain | Credential number; name |
| 8 | **IRS exempt organizations** | Proof a nonprofit is one, without an uploaded letter | About 1.8 million, monthly | Federal public data | Tax number once the owner gives it; name and ZIP |
| 9 | **State company registries**, free ones first | Legal name, formation date, good standing | Oregon 1.6 million rows, New York 4.3 million, Colorado 3.1 million, Connecticut 1.3 million, Florida | Mixed; Oregon and New York show no label. Washington has no bulk file | State business number where the licence gives it (Washington's does); name |
| 10 | **Washington childcare, liquor and cannabis licences** | Licence status for those trades | Small | Public domain or unlabelled | Licence number; address |
| 11 | **Federal carrier census (FMCSA)** | Movers and haulers: authority, fleet size, safety record | 4,528,545 carriers | Federal public data; the portal shows no label | Its own carrier number; name and phone |
| 12 | **County health inspections** | Restaurant inspection results | Per county; Clark County's was not checked | Varies | Name and address |
| 13 | **Federal records of trouble and size:** OSHA inspections, wage cases, PPP loans of $150,000 and up, federal contracts | Depth for larger firms | PPP about 968,000 loans; others not checked | Federal public data | Name and address: weak. Offered to the owner, not published |
| 14 | **Census business counts** | Not listings: the yardstick. How many businesses of each kind each ZIP should have | Small | Public domain; the Census service now needs a free key | — |
| 15 | **What only Pantopus has** | Paid invoices, repeat households, reply time, endorsements from verified homes | Grows with use | Ours | The account |

Not usable, as the plan found: Google (its terms forbid storing names and
addresses or building a directory), Yelp (24 hours of storage at most), and
the paid files, which are not needed to start.

The first gap to close is **hours**: no source measured here has them, and
rows 2 to 4 are the only open sources that do.

## 12. What was not measured

- **Foursquare.** No token; not downloaded. Its counts and overlap with
  Overture are unknown.
- **Anything on the real server.** The server's disk size and memory, how
  long it takes to download the search file from S3, and query times there.
  All times in section 7 are from this Mac with the files already in memory.
  A first read from a cold disk will be slower.
- **S3 itself.** No bucket was created. For scale only: a 200 KB slice of
  Overture's public bucket took about 0.12 seconds from this Mac.
- **Option C (the database) and option D (a search service).** Neither was
  loaded or priced. Option C's size is an estimate from option B's rows.
- **Matching outside Clark County**, and matching by website: the licence
  files carry no website.
- **Whether a business with no listing really has none.** It was checked
  against Overture only.
- **How many listings and licences are at homes.** That needs the app's
  address check, which calls paid services, so it was not run.
- **How many businesses the country should have.** The Census yardstick
  needs a key.
- **Hours.** None of these sources has them.
- **Whether the phone on a licence is one the crew answers.** Still the
  plan's by-hand test with five crews.
- **Compressed sizes of the nightly contractor files**, and the sizes of
  `businesses.parquet` and `ids.parquet`, which are estimates.
- **AWS prices** were not re-read today.
- **The licence of the Washington bond file**, which shows no label.
- This is not legal advice. Reading businesses' own websites (section 11,
  row 4) and publishing unclaimed listings (step 5) each want a lawyer's
  read first.

## 13. Where the downloaded files are

On the external drive, outside Git. Nothing was written to the Mac's own
disk or to any hosted service. The founder can keep or delete the folder;
nothing depends on it.

`/Volumes/Studio-Extended/rigs/BIZDATA/` — about 16 GB

| Path | What | Size |
| --- | --- | --- |
| `data/overture/us-places-2026-10-21.0.parquet` | Every United States place, all fields | 2.15 GB |
| `data/overture/wa-places-2026-09-23.1.parquet` | Washington from the release before, for the month-to-month test | 25 MB |
| `data/wa_lni/` | The four Washington files. **Contains owner names** | 113 MB |
| `data/or_ccb/` | The Oregon file. **Contains owner names** | 15 MB |
| `data/census/` | The Census county outlines | 29 MB |
| `out/overture.duckdb` | The working table the counts came from | 2.9 GB |
| `out/catalog.sqlite` | The search file of option B | 7.6 GB |
| `out/cells/` | The by-area files of option A, at two area sizes | 3.0 GB |
| `out/*.txt`, `out/*.json` | Every count in this document as the scripts printed it, the tie results and the three hand-check samples. **The samples contain business names and phones from public records** | About 120 MB |
| `scripts/` | The fifteen scripts that produced it all | 72 KB |
| `tools/venv/` | DuckDB for Python | 229 MB |

To free the space and keep the evidence, delete `out/catalog.sqlite`,
`out/cells/` and `out/overture.duckdb` (13.5 GB): each rebuilds from the
Parquet file in minutes.
