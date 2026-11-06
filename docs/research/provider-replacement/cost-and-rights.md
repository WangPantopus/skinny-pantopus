# Cost and rights

November 5, 2026. Planning figures and terms as published or quoted on that date; nothing was bought, no supplier was
contacted, no paid lookup was made. Merges #3433's cost model and rights review with #3418's prices.

## 1. Where Pantopus stands

| Vendor | What Pantopus has | Monthly cost |
|---|---|---|
| ATTOM | The free trial, which **ended November 4, 2026** (founder, November 5); its terms are below | $0; no paid plan |
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

**A value estimate (optional, D9).** #3433 sized an in-house residential estimate at about $57,200 of initial labor and
$51,360 a year, before any sales-data rights. It ships only where measured.

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
| ATTOM free trial | Internal evaluation, to decide whether to license | A database built from it; storing anything past 24 hours; disclosing it to anyone (including showing it in a product); see section 5 | Checked November 5 (published trial terms) |
| Google Address Validation | Keeping the address, USPS data and components 30 days for later transactions, then delete or replace with what the person confirmed; confirmation flags 30 days for correction requests; coordinates 30 days, then delete; place IDs indefinitely | No artificially-created US or Puerto Rico addresses (Google stops USPS checks and reports the account to USPS); attribution when Google content is shown | Checked November 5 (non-EEA service terms, modified October 28, 2026); section 6 |
| Smarty | As the published terms say; the founder signed no paid agreement | The published agreement restricts competitive development, benchmarking and compiling databases (sections 6-7) and has duties after termination; never build a registry from Smarty answers, and don't score Google against Smarty | Founder confirmed no paid agreement, November 5 |
| Lob | Printing and mailing | Terms on using and keeping address results, proofs and tracking; competitive-use limits | To check before the mail work package |
| USPS (AMS, DPV, CASS) | A licensed local engine with periodic updates | Field of use, display, retention, replicas and exit in writing | Later, if AMS is chosen |
| County and state files | Per source | King County: no redistribution without permission (and Washington's commercial-use acknowledgement before download); SanGIS: its own license; DuPage: written permission; Will County: no redistribution without written permission; Stanislaus and KGIS: own use only; Los Angeles County: its terms of use; Arizona: commercial-purpose declaration for records requests; Washington (RCW 42.56.070): no commercial use of lists of individuals | Per connector, before its first release |
| Address points (NAD, OpenAddresses, Overture) | Free use per source | Overture and OpenAddresses carry per-source licenses; anything derived from OpenStreetMap (ODbL, share-alike) stays out | Per source, before WP6 |
| Federal data (Census, FHFA, FEMA USA Structures, USACE NSI) | Public data | Attribution; NSI and FHFA keep their labels (modeled; area index) | To confirm per dataset |
| Building floor-plan sheets | Use with the building's written permission | Images only if the owner agrees | Per building |
| Household entries | Pantopus's own privacy policy | Never shown outside the household; never in the shared index | — |
| Mapbox (autocomplete and resolve) | Its geocoding terms | Storage of temporary geocoding results is limited; not changed by this work, but coordinates kept on `HomeAddress` should come from the registry | To check alongside WP6 |

A fee for copying public records and a license to republish them are separate questions; an unauthenticated download
proves only that the file can be read.

## 5. ATTOM free trial

**The trial ended November 4, 2026** (founder, November 5), which makes the deadline for the purge and signed affidavit
about November 18 (10 business days; the founder confirms the date from ATTOM's notice). ATTOM's key stops being used,
and no ATTOM copy may keep serving screens.

**The terms** (ATTOM's published API terms at api.developer.attomdata.com/legal, re-read November 5, paraphrased): the
products may be used only to test and evaluate them before deciding on a license, for internal evaluation, with no
commercial use. Among the prohibited uses: building or enhancing a database of any kind from them, disclosing or
publishing any portion to others, and storing the content for more than 24 hours. The trial runs 90 days from its
effective date; at the end Pantopus must stop using the content, purge it from every system, and sign an affidavit of
destruction within 10 business days.

**What the code does today** ([current-system.md](current-system.md#five-stored-copies)): five stored copies, property
detail kept forever, values for 30 days, shown in the apps; the November 1-2 prefill saved 195 trial responses. All of
that sits outside the trial terms.

**What happens now** (hosted deletes and contacts with ATTOM are founder-only):
1. Confirm the end date from ATTOM's notice.
2. Nobody runs the operator prefill again.
3. Take `ATTOM_API_KEY` out of every server's env file and restart, so no screen asks ATTOM or keeps saying "Looking up".
4. Purge `Home.niche_data.attom_property_detail`, `AttomPropertyCache`, the per-address `PlaceSectionCache` sections, ATTOM
   rows in `ExternalFeedCache` and `PropertyIntelligenceCache`, on every hosted database and on local machines (including
   the operator prefill's saved responses), handle backups as the affidavit requires, then sign it.
5. No ATTOM content in the new index, its mappings or its evaluation sets.

**The timing risk happened.** The trial ended before the replacement was built, so screens lose ATTOM's facts at the
purge. Measured on production, November 5: 1 Home snapshot, 2 per-home copies, 0 per-address copies, 195 shared answers
(the prefill), 2 built profiles. Few homes depend on them. Until a county qualifies, its screens use the "trial ended"
routing in section 7; the build plan's first property slice targets the counties where Pantopus homes already are
([build-plan.md](build-plan.md#wp5-property-index-foundation-and-the-first-vertical-slice)).

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

With no paid plan and the trial over, there is no ATTOM bridge. Routing per county:

| County state | Routing |
|---|---|
| Qualified (its gates passed, founder's OK) | The record; zero ATTOM calls there, including background and operator paths |
| Not qualified (the trial ended November 4, so every other county) | Labeled partial results and household entries; ATTOM calls zero |

Tracked per county and property type: latency, errors, and ATTOM calls, which must stay zero.

## 8. Smarty and Lob exits

- **Smarty:** if an agreement exists, check its post-termination duties (deleting cached Smarty answers:
  `HomeAddress.validation_raw_response.smarty_candidate`, reused 90 days) before WP14.
- **Lob:** keeping Lob per piece costs nothing monthly; retiring it fully needs a chosen second route that passed the
  real-mail pilot. Which one is the founder's choice (D5).
