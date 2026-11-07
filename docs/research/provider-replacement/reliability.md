# Reliability: drills and measured speed, November 7, 2026

Counts and times only. Spec: `docs/research/provider-replacement/` architecture.md sections 4, 10-14; experience.md "When something fails", G4, G6; parity-and-acceptance.md service objectives. "Real storage" = the private bucket `pantopus-property-index` read with the read-only key from this Mac (16 ms from us-west-2). "Stand-in" = a local copy or a fault preload. Master = origin/master of Nov 7; fixes = PRs #3638 #3639 #3640 #3641 #3642 #3647 together.

## Better than the vendors (measured)
- Storage refused, unreachable, erroring, slow, corrupted or its DNS failing: every Home that holds its county copy kept showing it (14 of 14 faults, warm and cold server). New addresses answer "Looking up" within about 1 s and fill in by themselves. With ATTOM, a vendor outage meant no record and up to 10 s waits.
- Back within 2.4-4.7 s of storage returning (master 25-29 s).
- Google down, hanging or erroring: Add Home finishes unverified with an address id, bounded to 5 tries before Google is left alone, and the postcard waits with a clear message until a re-check passes (3 of 3 passed when Google came back).
- Printer down or its answers lost: T5 on the PostGrid stand-in, 64 passed, 0 failed, 5 skipped. The printer holds exactly one card in every lost-answer case, and nothing was resent while it was down.
- A bad release is refused before it serves. A rolled-back release leaves every Home's screen 319 s after the rollback (master: still showing past 540 s; its refresh is hourly).
- 0 calls to any vendor started by a failure in any drill.

## Speed (G4)

Measured from this Mac on real storage through the real backend and local database. "Production model" combines production's per-call database time (its public /health minus a no-database 401, 60 samples on Nov 7: p50 77, p90 121, p95 217, max 1,095 ms; the tail includes this Mac's own network), Google's measured answers (p50 144, p95 190 ms) and in-region storage (this Mac's S3 times minus its 16 ms round trip). Two bands: as sampled, and with calls capped at the 90th percentile (121 ms) to remove this Mac's network tail. Production's own number lies between; only its server log can say.

| Objective | Target | Master | Fixes | Result |
|---|---|---|---|---|
| Index read, server side | under 50 ms | warm lookup p50 38, p95 46-75 ms from this Mac (new block each time, LA 2.39M records, Cook 1.94M, Miami-Dade condos, Clark, Liberty FL, no-record addresses); about 22 ms in region | same | Pass |
| Cold first lookup after a restart | (no target) | p50 297-328, p95 398-534 ms from this Mac (state file, suppressions, manifest, block) | #3647 reads the live state files at start, one read fewer | Measured |
| Address resolve (Add Home address check) | p95 ≤ 300 ms | 6 database round trips in a row. Production model p95 740 (capped) to 1,670 ms; this Mac with production's per-call times replayed: p50 557-598, p95 1,612-1,645 | 2 rounds. Model p95 378 (capped) to 1,255; replayed p50 198-262, p95 545-1,181 | Fails the target. Google alone is p95 190 ms; our own part after the fix is about 190 ms at p95 (capped model) |
| Stored property read (Property details) | p95 ≤ 400 ms | 18 calls in 4 rounds. Model p95 452 (capped) to 1,698; replayed p50 635-815, p95 1,508-2,363 | 18 calls in 2 rounds. Model p95 249 (capped) to 1,526; replayed p50 450-555, p95 1,287-1,603 | Passes in the capped model only. To pass as sampled: one SQL call for the access check (model p95 231 capped, 1,172 as sampled); a security change, the founder's call |
| Add Home details step | (G4) | p50 39-50, p95 50-112 ms (no database call; one with an address id) | same | Pass |
| Address search | p95 ≤ 150 ms | Mapbox autocomplete, unchanged by this build; not measured (a vendor call) | | Not measured |
| Availability of eligible reads | ≥ 99.9% a month | Reader soak from this Mac: 1,914 lookups in 16 clean minutes, 0 unavailable. The backend saw one 15 s stretch (5 reads stuck at DNS, then a 30 s pause): about 1% of that hour from this Mac | Stuck reads get a second try at 700 ms; DNS answered by the resolver with the last good address kept; pause 5 s with one check | Not provable locally |
| Recovery: bad release rolled back | within 30 min | Rollback waited behind any running build (up to 340 min) and could be replaced by a newer waiting run; Homes kept the bad copy up to 1 h | Own concurrency line (#3640; the registry's landed as #3634). Local rollback < 0.3 s; switch runs on GitHub take about 1 min; servers follow within 5 min (state file re-read); Homes 319 s | Pass with fixes |
| Mail: durable pending state | | T5 64 passed, 0 failed | | Pass |

Parse costs: LA's manifest 343 KB gzip, 1.5 MB JSON, 5.6 ms to parse, 3 MB held; a block 0.2 ms, 33 KB held. Index reads aren't the cost; database round trips are.

## Failure rows (experience.md) and drills (architecture section 14)

| Drill | Storage | What happened | Number | Result |
|---|---|---|---|---|
| Storage refused (connection refused) | real + fault | Copies shown; new addresses "looking up"; Property details LOOKUP_PENDING | back in 4.6 s (master 25.5 s) | Pass |
| Storage unreachable (no answer) | real + fault | Same; each new address waits about 1.0 s at most (master up to 3.1 s) | back in 3.9 s | Pass |
| Storage 500 / 503 / 403 (expired key) | real + fault | Same | back in 2.4-4.7 s | Pass |
| Storage slow 0.8 / 2.5 / 6 s per read | real + fault | Master: a cold lookup held Add Home up to 10.2 s at 2.5 s per read. Fixes: about 1.0-1.1 s, then fills in | Add Home p50 1,018 ms max 1,109 | Pass with fixes |
| One read in three refused | real + fault | Most answered on the second try | 21 of 24 new addresses answered | Pass |
| Corrupted block / manifest / state file | real + fault (checksums removed) | Master: Add Home 500, Property details 503. Fixes: "looking up", named in the log | 0 errors with fixes | Pass with fixes |
| Truncated block | real + fault | "looking up" on both | | Pass |
| DNS hanging / failing | real + fault | Warm server unaffected (open connections); cold: "looking up" | back in 4.0-4.2 s (master 28 s) | Pass |
| Wrong index address (3 kinds) | real | Screens: no record, as before. /health (#3647): property_index "missing" for all 3, "ok" when right, "unreachable" during an outage | | Pass with #3647 |
| A bad import | stand-in (aws stand-in, made-up county) | Release with half the records refused; previous kept serving | | Pass |
| Bad release and its rollback, timed | stand-in index on a running server | Homes followed in 319 s (fixes); master still on the bad release past 540 s | rollback < 0.3 s locally | Pass with fixes |
| A rollback during another county's publish | stand-in | Master undid it; fixed on master by #3634's guard | | Pass on master today |
| A county withdraws its file | stand-in index | Fixes: facts leave in 305 s, Property details says SOURCE_WITHDRAWN, web and Add Home say "The county no longer publishes these records"; household entries stay. Native apps show household facts without a sentence | | Pass (web, server) |
| Google down / hang / 500 (D1a) | stand-in Google | POSTAL_PENDING with an address id; 5 tries then Google left alone; Add Home finishes; postcard refused 409 until the re-check passes | down 22-193 ms, hang 2.5-2.6 s then 50-62 ms | Pass |
| Expired postal answer (Google allows 30 days) | real database, stand-in Google | 3 addresses backdated 31 days: the job cleared 3 of 3 USPS answers, kept the address and the conclusion, and made 0 Google calls | | Pass |
| The printer down / answers lost | stand-in (PostGrid) | T5 | 64 passed, 0 failed, 5 skipped | Pass |
| A lost worker | real database, stand-in Google | USPS re-check job killed during its run with 4 addresses pending: nothing half-done; the next run re-checked 4 of 4, one notification each (4 distinct keys). T5 covers the printer side | | Pass |
| A server restart with a cold cache | real | Restart to healthy 2.6-7.3 s; first lookups about 300 ms from this Mac | | Pass |
| No record anywhere | real | Add Home "We couldn't find public records for this address..."; Property details NO_PROPERTY_FOUND with household facts | | Pass |
| Database restore (suppressions and erasures reapplied) | | Can't run: Supabase Free has no backups or point-in-time restore, and nothing journals suppressions outside the database | | Not runnable; founder |
| Reload and relaunch, the other member's view, iOS and Android | | Server and web first; devices pending a slot | | Open |

## Only hosted servers or physical phones can prove
Production's own read times from S3 and its database (its log has "Slow request detected" lines), availability over a month, a real GitHub rollback run on real storage (writing to it is the founder's), the alarm in CloudWatch, physical phones on mobile networks, and live mail.
