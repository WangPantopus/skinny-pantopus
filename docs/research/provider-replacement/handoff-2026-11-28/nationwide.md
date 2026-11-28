# Nationwide production and changes since November 23

The November 28 storage audit read the active property and registry state manifests and both property switch files. The comparison point is November 23 at 06:29 UTC, after the Boston and Clinton releases. Every county is in [the detailed inventory](nationwide.json). [State totals](state-coverage.md) and [release deltas](release-changes.json) are included.

| Measure | Verified November 28 |
|---|---:|
| County equivalents in the FIPS inventory, including the island areas | 3,235 |
| County equivalents in the project's housing-unit reference, including Puerto Rico | 3,222 |
| County property releases in storage | 965 in 38 state-level jurisdictions |
| Countywide in production | 164 |
| Municipal only in production | Boston within Suffolk County, MA |
| Property release stored, serving off | 800 |
| No stored property release | 2,270 including the 13 island-area entries outside the housing table |
| Property records stored across all releases | 70,304,930 |
| Stored records in the 164 countywide places | 25,633,350 |
| Address registry in storage | 133,801,002 records in 2,606 county equivalents and 52 state-level jurisdictions |
| Registry breakdown | 105,278,315 property addresses, 5,195,681 buildings, 23,327,006 named units |

The 164 whole counties contain 30,459,435 Census-reference housing units out of 145,409,712 in the national comparison. Boston contributes a separately verified 103,358 property identities at the starting production release. The previous 30,816,725 geographic figure includes all 357,290 Suffolk County housing units. It overstates Boston-only service. County property records include parcels, commercial accounts, buildings and units. No one figure in this table is a count of all homes with complete interiors. The separate census-file geography and household coverage limits apply throughout.

The live backend’s Add Home registry list was empty. DC, MA, MD, OR, TN, VA, WI and WV were configured for shadow comparison. Coordinate replacement was in shadow and alternate street readings were enabled. The stored 48,431 Boston apartment-address matches therefore do not establish a live registry rollout in Massachusetts. Boston’s municipal property record is a different user-visible feature.

## Releases people gained

| New or improved scope | Evidence and effect |
|---|---|
| Lee County, FL · 12071 | The county parcel layer adds heated living area, bedrooms and actual baths to the state roll. The served release contains 546,997 records. Direct binary recount found all six on 277,258 of 277,573 houses (99.89%). [Production switch](https://github.com/WangPantopus/amber-lattice-4729/actions/runs/45810991856) |
| Skagit County, WA · 53057 | The source distinguishes manufactured and no-dwelling parcels. The served release contains 53,230 records. Direct recount found all six on 31,136 of 34,554 houses (90.11%). [Production switch](https://github.com/WangPantopus/amber-lattice-4729/actions/runs/45803506269) |
| All nine Connecticut planning regions | The November 26 source linked recorded history to exact town, address and unit. Storage reports total 573,567 records with history across 1,355,914 records. The launch audit counted 423,528 houses, 59,046 condo units and 570,293 records with a sale. Production’s new-columns setting gained all nine FIPS. [Production switch](https://github.com/WangPantopus/amber-lattice-4729/actions/runs/45801224047) |
| Home Record area facts | The backend shipped school district and electric utility lookups, with the county’s district name taking precedence. Shaded FEMA X now reads Moderate, Zone D shows undetermined risk, and floodways are identified. These are on-demand geographic lookups. The electric territory map is dated September 30, 2024. [Area changes](https://github.com/WangPantopus/amber-lattice-4729/pull/4905) |
| Texas and New York source maintenance | Wise’s signed download link works again. Wise and Caldwell were rebuilt/read back and both still have property serving off. The monthly build group is split across two dates. NY parcel builds have a state ZIP fallback. A fresh NY service metadata and count query still returned HTTP 200 with ArcGIS error 500; New York’s published ZIP and the old combined-unit draft are separate issues. [Health repair](https://github.com/WangPantopus/amber-lattice-4729/pull/4908) · [Wise source](https://github.com/WangPantopus/amber-lattice-4729/pull/4913) |

The production switch diff from the November 23 snapshot added only Lee and Skagit countywide and the nine Connecticut new-column entries, apart from its timestamp. Dallas, Clinton, Hernando and Denton were already live at the comparison point. Denton’s 51 confidential records stay suppressed. The pre-existing Boston scope covers 30,173 single-family homes and 73,185 individually assessed residential condos. In the exhaustive prior release check, 30,144 houses had all six fields and 69,931 condos had their own bedrooms, bath total and living area. The Boston-specific addendum records the outcome of the November 28 apartment investigation.

## Other work visible in the audit

- The current manifests identify **23 property releases** imported after the cutoff and **1,069 county registry releases across 46 state-level jurisdictions**. Besides the Connecticut, Lee, Skagit and two Texas releases above, property refreshes covered Clark WA, Stark OH, Cumberland PA, Adams CO, Denver CO, DC, Miami-Dade FL, Boulder CO and Kitsap WA. Oakland MI was refreshed in private storage on November 28. Its county switch is off. [Storage verification](storage-receipt.md)
- Beyond Connecticut, the refreshed releases stored 102,817 recorded-history entries in Clark WA, 153,016 in Adams CO and 113,868 in Denver. Clark also stored 118,539 permit fields. The nine non-Connecticut refreshes together added 780,433 held parcel outlines. These were stored changes. The release JSON gives each prior and current release ID, record delta and changed field occurrence counts. Those deltas count stored fields; setting a field live requires the corresponding production switch.
- Recorded-history code also landed for Clark WA, Pierce, Franklin, Seminole, Sarasota, Charlottesville, Geauga, Clinton OH, Hillsborough FL, Ashtabula OH, Denver, Cook IL, Adams CO and Oklahoma County. Other Home Record code covered Clark permits, gated parcel outlines, buyer reports and change notices. The two-snapshot switch comparison supplies no blanket new activation of those groups. Check the county’s current dated release, held columns and production settings before describing an individual feature as visible. [History integrations](https://github.com/WangPantopus/amber-lattice-4729/pull/4725) · [Parcel outlines](https://github.com/WangPantopus/amber-lattice-4729/pull/4700)
- All 15 November 26 dev, master and back-merge PRs were confirmed merged on GitHub. Staging PRs were 4903, 4904, 4906, 4910, 4911 and 4915. Production PRs were 4905, 4908, 4909, 4912, 4913 and 4916. Back-merges were 4907, 4914 and 4917. Repo ID 1353785096 now resolves to [WangPantopus/amber-lattice-4729](https://github.com/WangPantopus/amber-lattice-4729); the earlier skinny-pantopus URL redirects there.
- At the audit, production and staging health returned healthy and property_index ok. The November 26 team verified Connecticut history on all three local clients. Its Lee/Skagit phone checks used public-building controls and debug apps; house and condo rows were checked in storage. There was no fresh November 28 production-household lookup. The full scope of future user-visible releases still needs the exact-client checks in new-mac.md.
- At the inventory read, 29 stored-off county releases were past their own stale-after dates. No enabled release was past that threshold. The freshness repair did not invent new effective dates where a publisher had provided no newer roll.
- The historical landing ledger has 224 rows and 223 distinct heads. The four unmatched historical ledger entries, PRs 4059, 4069, 4091 and 4120, were already merged. The four genuinely open drafts are #4190 Mason, #4657 Crook, #4658 the old Clinton/Logan reader and #4659 NY combined units. None was ready merely by being in that queue. The Property Index and Address Registry workflows each had zero queued or running jobs when checked. Recheck remote state on arrival.
- The last property-lane production audit used master 2201db1ee5b7 with successful master CI. The dev branch moved even during this audit; a prior dev run was cancelled during ongoing unrelated staging work. Fetch exact refs and inspect the newest checks before merging. [Master CI](https://github.com/WangPantopus/amber-lattice-4729/actions/runs/45989624000)

## How much of each house fact is stored

I read the release reports for all 965 county property releases. These are direct field occurrences on explicit house records. A separate joint recount and source check is needed for go-live. The municipal Suffolk report includes other towns, so it is excluded from both columns.

| House field | 107 countywide releases with explicitly typed houses | 580 stored-off releases with explicitly typed houses |
|---|---:|---:|
| House rows | 16,537,078 | 26,165,753 |
| Year built | 16,450,752 | 19,693,317 |
| Living area | 16,363,465 | 13,009,615 |
| Bedrooms | 16,338,776 | 3,318,476 |
| Bath total | 16,360,719 | 2,982,884 |
| Lot, conservative lower count across units of measure | 16,486,019 | 22,080,352 |
| Value, conservative lower count across assessed and market values | 16,506,407 | 24,853,471 |

Bedroom and bath coverage are the main reasons that a nationwide storage count is much larger than the number of usable home records. Another 57 live releases and 220 stored-off releases have no explicit house cohort in their report. Older Montana/Virginia sources need their documented assessor classifications. In the stored-off typed cohort, only Oakland MI and Montgomery OH could reach 90% even under the loose upper bound from direct field marginals. Oakland still lacks documented bath semantics. Montgomery fails the lot check when overlapping columns and map agreement are tested on actual houses. Other counties can still qualify with new authoritative source data or a separately proved municipal scope. [All 965 field reports with bounds](house-field-coverage.json)

## Address validation and mail

The registry has 128,605,321 property-address and named-unit rows combined. Against the county housing reference, the sum of positive county gaps is 32,613,557. Of that, 11,500,512 is in counties which already have a stored property file. These are opportunity estimates; assessors include commercial and duplicate sites. A registry match proves a source recorded an address. Deliverability and a completed mailing require different evidence. Use the federal address-file usage guidance when expanding registry coverage. [National Address Database disclaimer](https://www.transportation.gov/mission/open/gis/national-address-database/national-address-database-nad-disclaimer)

The standing vendor notes list the ATTOM trial as ended and its purge/affidavit as awaiting founder evidence. The own-mail layer has a founder-run physical pilot outstanding in the last handoff. This audit did not verify an affidavit, postage, delivery, a carrier acceptance, or a change to mail provider routing. Normal release work here needs no vendor calls. Keep the founder’s no-spend and no-real-mail direction.
