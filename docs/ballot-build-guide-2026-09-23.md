# Ballot: build guide

Status: build specification, September 23, 2026. Nothing in it is built yet.
Review added September 23: [product, data and build-guide critique](ballot-product-review-2026-09-23.md). Appendix D records proposed amendments and unresolved contradictions; the research request does not authorize implementation, and the original specification below is preserved for comparison.
Visual source of truth: the [Pantopus Ballot design canvas](https://claude.ai/artifact/KCuXBiAYYaX13gpoqUCdmq) (20 boards; board names are quoted in this guide as **[Board: Name]**).
Owner of product decisions: the founder. Section 16 lists the open decisions and the default this guide builds until one is made.

This guide tells an engineer or a coding agent exactly what to build, in what order, against which existing code, with which data, and how to prove it works. Where the canvas and this guide disagree on behavior, this guide wins; where they disagree on appearance, the canvas wins.

---

## 0. Rules for whoever builds this

1. Read `AGENTS.md` and `docs/PROJECT_HANDOFF.md` first. Their rules apply: verify existing behavior before changing it, extend rather than rebuild, no parallel tables, record evidence for every new table or service.
2. Founder direction of September 23, 2026: verify every flow end to end on the iOS simulator, the Android emulator and the web; improve UX within the design system without asking; unit tests are not required. Money, security, legal and new-table questions still go to the founder.
3. Build phase by phase (section 2). Do not start a phase until the previous phase's acceptance journeys pass (section 14).
4. Every file path in this guide was checked on master at `cef95ab67` (September 23, 2026). If a path moved, find the new home of the same symbol before writing anything new.
5. Never invent election facts. A date, deadline, place, eligibility rule, candidate, statement or number shown to a user must come from a stored or fetched source with a URL and an as-of time. If it is missing, the UI shows the honest empty state described here.
6. Sample content on the canvas (Fernbrook, Alder County, every candidate, quote and number) is fictional. It must never appear in production data, fixtures shipped to users, or store screenshots.

---

## 1. What we are building

**One sentence.** For any U.S. address, Ballot shows the stack of governments the address sits inside, what each of them is deciding at the next election, and each contest as a calm document: the candidates' own words, the public record, someone else's judgment, and facts about the place, with an AI clerk that can only fetch and compare documents already loaded for that contest.

**Why it exists.** "What's on my ballot" is the strongest single-player reason a stranger has to type an address into Pantopus, it works nationwide on day one, it recurs up to four times a year per address, and it fits the product line "what's on record about your address."

**Where it lives.** No new tab. The four tabs stay Place · Today · Nearby · Mail.

| Surface | What Ballot adds | Canvas board |
|---|---|---|
| Web `/start` (anonymous) | The governments count, a still stack, the next deadline, "See your ballot" and "Compare with a friend" | Web lookup |
| Place | A seasonal "Your ballot" card; it opens the peel, the ballot strip and every contest | Place: Your ballot card |
| Today | A deadline line when one is near; a "Ballot week" card when ballots arrive | Today in ballot week |
| Nearby | "What this ground decides" when looking anywhere that is not home | Nearby: crossing a line |
| Mail | Mail Day flags the official ballot envelope and pamphlet (existing Mail Day, new rule) | Journey |
| Pushes | At most three per election plus one for movers, all opt-in | The only pushes |

**Hard rules (product requirements, not preferences).** Breaking any of these is a bug.

- No polls, odds, forecasts, ratings of who is winning, or "momentum".
- No values quiz, match score, or "candidates like you".
- No feed, comments, reactions, trending, or clips.
- No red or blue fills anywhere. Party is a small grey text label in the exact words the state prints (for example "Prefers Independent Party").
- Contest and candidate order follows the printed ballot. Never sort by fame, money, followers or alphabet unless the state's ballot does.
- A candidate's words are shown quoted, dated, sourced and unedited. The model never paraphrases them into a "position".
- An empty column is a finished state. Nothing is backfilled from news or written by the model.
- Dates, deadlines, polling or drop-box locations and eligibility never come from the model.
- The app never asks for party, never stores how or whether anyone voted, and never buys or reads a voter file.
- Registration, ballot tracking and official pamphlets link out to the official site.

---

## 2. Scope by phase

| Phase | When | Ships | Explicitly not in this phase |
|---|---|---|---|
| **P0 Thin layer** | Now to Nov 3, 2026 (about 1 week of build) | Place "Your ballot" card with date, how voting works, deadlines and official links; the governments count and a still stack on `/start` and Place; election deadlines in the address calendar and the three pushes; the "you moved" registration card; the share card with the count | Candidates, measures, documents, animation, the clerk, Nearby looking mode |
| **P1 Shapes and the ballot** | Winter 2027 (about 6 weeks) | District shapes and the animated peel; the ballot strip in printed order with glyphs; contest pages (race and measure); Nearby looking mode; the ballot packet service and cache; the documents table | Statements ingestion at scale, charts, the clerk |
| **P2 Reading room, test market** | Spring to Nov 2, 2027 (about 8 weeks, then per-election ingestion) | Question room from Washington and Oregon pamphlets; place charts; levy for this home; voting plan; clerk for measures only; error reports | Clerk for candidate races; federal money |
| **P3 National** | 2028 primaries onward (about 8 weeks plus partnerships) | Federal record (Congress votes, FEC totals); clerk inside any contest; more states' pamphlets; nationwide deadlines through a data partner; official translations | Live results; endorsement graphs; local money outside integrated states |

Default for the open P0 decision: **ship P0 for November 3, 2026**, behind the `ballot_p0` flag (section 5.16), enabled first for the seeded metro.

---

## 3. Existing code this builds on (verified)

| Need | Existing implementation | Notes for the builder |
|---|---|---|
| Districts for a point | `composeCivicDistricts` and `districtsFromGeographies` in `backend/services/placeSectionAdapters.js` (lines ~614–865) call the Census geocoder `geographies/coordinates … layers=all` | Returns congressional, state upper and lower, county, incorporated place and unified school district, plus raw codes. Extend, do not replace. |
| Next election | `composeCivicElection` in the same file (~866–935) reads Google Civic `elections` with `GOOGLE_CIVIC_API_KEY` | Its data already has `polling_place: null` and `ballot: []` placeholders. P0 extends this section's data; it does not add a new section id. |
| Federal and state incumbents | `fetchCongressIndex` (unitedstates/congress-legislators, 7-day cache) and `fetchStateLegislators` (OpenStates people CSV) in the same file | Reuse for "incumbent" flags and IDs (bioguide, FEC ids exist in the full legislators file). |
| Section envelope and registry | `serializePlaceSection` and `PLACE_SECTION_META` in `backend/serializers/placeIntelligenceSerializer.js`; composers wired in `COMPOSER_SECTIONS` in `backend/services/placeIntelligenceService.js` (~914–915) | Section ids are mirrored in TypeScript unions on web and in native models; any new id must be added on all three clients. |
| Place sections route | `GET /api/homes/:id/intelligence` in `backend/routes/placeIntelligence.js` (mounted in `backend/app.js` ~367) | Auth plus home access. |
| Remote cache | `readThrough({ cacheKey, sectionId, ttlMs, fetch })` in `backend/services/placeSectionCache.js`, table `PlaceSectionCache` | Serves stale on provider failure; `null` results are not cached. Use it for every Ballot fetch. |
| Address calendar | `AddressCalendarRule` table; `composeForHome` in `backend/services/addressCalendarService.js`; route `backend/routes/addressCalendar.js` | Kind `election_deadline` already allowed; scopes state, county, city, home; narrowest scope wins **per kind**; default window 14 days. |
| Calendar to pushes | `generateAddressCalendarSignals` in `backend/services/context/usefulnessEngine.js` (~277); interrupt gate `MIN_PUSH_SCORE 0.20` and `MIN_PUSH_COST 0.25` in `backend/services/context/providerOrchestrator.js` (~91, ~522) | Election deadlines currently score 0.34 and inherit the pickup-day "Unconfirmed" text. Section 5.6 fixes both. |
| Anonymous preview | `GET /api/public/place` in `backend/routes/public.js` (~475); `backend/services/placePreviewService.js` (`composePreviewSections`, `pickAha` ~438) | Contract: persists nothing, `Cache-Control: no-store`. Ballot additions must keep it. |
| Funnel events | `backend/services/funnelEvents.js` (`FUNNEL_EVENT_TYPES`, `CLIENT_POSTABLE_EVENT_TYPES`), `POST /api/public/funnel-events`; table `FunnelEvent` with CHECK `funnelevent_type_check` (six values today) | New events need a migration and the code lists. |
| Share image | `frontend/apps/web/src/app/api/og/place/route.tsx` (`next/og` `ImageResponse`, edge runtime) | Add the governments variant here. |
| Feature flags | `backend/services/featureFlagService.js` (`isFeatureEnabled(flag, user)`), `GET /api/feature-flags/:flagName` in `backend/routes/featureFlags.js`; env flags in `backend/utils/featureFlags.js` | Web reads backend flags (`useFeatureFlag`); the native apps do not. Gate on the server (section 5.16). |
| AI | `backend/config/openai.js` (`getOpenAIClient`), models via `OPENAI_CHAT_MODEL` / `OPENAI_DRAFT_MODEL` in `backend/services/ai/agentService.js`; structured schemas in `backend/services/ai/schemas.js` | The clerk uses this client and its usage logging. No second AI provider. |
| Scheduled work | `backend/jobs/index.js` (node-cron) and `pg-boss` jobs | Use for ingestion refresh and the optional evening push. |
| Moved-in date | `HomeOccupancy.start_at` | Enough for the P0 "you moved" card. |
| PostGIS | Installed in the baseline (`CREATE EXTENSION postgis`) | Not required by this plan; available if spatial queries are ever needed. |

Client paths are in section 7.1.

---

## 4. Data sources

Use only these. Every fetched payload is cached through `readThrough`. Every value shown carries its source label and as-of time.

| Layer | Source | How | Key | Cache | Phase | Rules |
|---|---|---|---|---|---|---|
| Which districts contain the point | Census Geocoder, `geographies/coordinates`, `layers=all` | Existing call | none | 90 days per geohash-7 | P0 | Already built. |
| District shapes | Census TIGERweb ArcGIS REST (`tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/…/MapServer/<layer>/query`) with `geometry=<lng,lat>&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=true&outSR=4326&maxAllowableOffset=<deg>&f=geojson` | New | none | 365 days per GEOID | P1 | Read the service directory once and pin the layer ids for: states, counties, incorporated places, unified/elementary/secondary school districts, 119th congressional districts, state legislative upper and lower. Do not hardcode ids from memory. |
| Special districts (fire, port, library, transit, water) | County GIS "taxing district" or "levy code area" layers | Per county, curated | none | 365 days | P2 test market only | Not in TIGER. Outside integrated counties the count says "at least N governments". |
| Upcoming elections | Google Civic `elections` | Existing | `GOOGLE_CIVIC_API_KEY` | 1 day | P0 | Filter by `ocdDivisionId` for the state. |
| Contests, candidates, drop boxes, early vote sites, election office URLs | Google Civic `voterinfo?address=…&electionId=…` | New | same key | 6 hours in season; 1 hour in the final 7 days | P1 | Needs the full address, so call only for authenticated homes (and never persist the query). Only live once the Voting Information Project loads the election; before that, show the P0 card. |
| Deadlines and how voting works | Hand-kept state sheet stored as `AddressCalendarRule` rows plus a small JSON of voting method per state | New data | none | n/a | P0 | Each row cites the statute or Secretary of State page. P3 replaces curation with Democracy Works Elections API (partnership). |
| Registration fallback | vote.gov state pages | Link | none | n/a | P0 | For states without curated deadlines: "Check your state's deadline" links to vote.gov. |
| Candidate words | State and county voters' pamphlets (Washington SOS online voters' guide, county pamphlets; Oregon SOS voters' pamphlet); questionnaires the candidate answered | Curated ingestion (section 5.10) | none | stored | P2 | Verbatim only. Vote411 is linked, not scraped. |
| Measure text | Official ballot title, full text, explanatory statement, fiscal statement, filed arguments and rebuttals from the same pamphlets | Curated ingestion | none | stored | P2 | Verbatim. |
| Federal incumbents | unitedstates/congress-legislators | Existing | none | 7 days | P1 | Provides bioguide and FEC ids. |
| State incumbents | OpenStates people CSV | Existing | none | 7 days | P1 | "Incumbent" flag only. |
| Federal votes | Congress.gov API (api.data.gov key) where it covers roll calls; House Clerk and Senate roll-call XML otherwise | New | `CONGRESS_API_KEY` | 1 day | P3 | Incumbents only; each vote links to the bill and tally. |
| Federal money | OpenFEC `/candidate/{id}/totals`, `/candidates/search` | New | `FEC_API_KEY` (api.data.gov) | 1 day | P3 | Totals and source mix only. No donor names. |
| State money | State portals (Washington PDC first) | Per state | varies | 1 day | P2+ | Only where the portal has a stable API. |
| The place | Census ACS 5-year (latest vintage; 2020–2024 when this was written) at the contest's geography: `congressional district`, `state legislative district (upper/lower chamber)`, `county`, `place`, `school district (unified)` | New calls beside the existing tract-level census context | `CENSUS_API_KEY` | 365 days | P2 | Six indicators max per contest. No caption verdicts. Verify variable ids against the vintage's variable list (for example B25070 rent burden, B25064 median gross rent, B19013 median household income, B25103 median real estate taxes paid). |
| Assessed value (levy for this home) | County assessor value already used by Place records, or ATTOM where display terms allow | Existing record paths | existing | per record | P2 | If the value is not on record, the levy block shows the rate only. |

**Never build on:** Google Civic representatives endpoint (turned off April 30, 2025), ProPublica Congress API (gone), OpenSecrets API (discontinued), GovTrack API (retired), FollowTheMoney as a live 2026 source, Vote Smart as a load-bearing feed, scraped endorsement graphs, any purchased voter file.

---

## 5. Backend

All new backend code lives in `backend/services/ballot/` and one route file `backend/routes/ballot.js`. Nothing Ballot-specific is added to unrelated services except the small, named extensions below.

### 5.1 Module layout

| File | Responsibility | Phase |
|---|---|---|
| `services/ballot/governments.js` | From the geocoder result, build the list of governments (with GEOIDs, level, name) and the count; later add special districts for integrated counties | P0 (list), P2 (special districts) |
| `services/ballot/shapes.js` | Fetch TIGERweb polygons per GEOID, simplify, and produce peel geometry (section 5.3) | P1 |
| `services/ballot/deadlines.js` | Read election rows from the address calendar for a 60-day window and the state voting-method sheet | P0 |
| `services/ballot/contests.js` | Call voterInfo for an authenticated home, normalize contests and candidates, apply ballot order, attach contest keys | P1 |
| `services/ballot/documents.js` | Read `ElectionDocument` rows for a contest key; compute material buckets | P1 |
| `services/ballot/glyph.js` | Compute the four-part glyph per contest (section 5.5) | P1 |
| `services/ballot/placeCharts.js` | ACS indicators for a contest geography | P2 |
| `services/ballot/levy.js` | Levy estimate for this home | P2 |
| `services/ballot/federal.js` | Congress votes and FEC totals for incumbents and filed federal candidates | P3 |
| `services/ballot/packet.js` | Assemble the ballot packet (section 5.2); the only thing routes call | P0 (summary), P1 (full) |
| `services/ballot/clerk.js` | The clerk (section 5.14) | P2 (measures), P3 (races) |
| `services/ballot/compareToken.js` | Sign and verify the compare payload | P0 (count), extends loop design F8 |
| `scripts/ballot/ingest.js` | Validate and load a documents file (section 5.10) | P1 |
| `scripts/ballot/seed-deadlines.js` | Generate the reference-data migration SQL from the state sheet | P0 |

### 5.2 The ballot packet (the one contract every surface reads)

`GET /api/homes/:id/ballot` returns this object. Clients render it and never interpret raw provider data. Fields marked P1+ are absent in P0.

```json
{
  "as_of": "2026-09-23T16:40:00Z",
  "mode": "home",
  "election": {
    "id": "ocd-election/2026-11-03-wa-general",
    "name": "November 3 general election",
    "date": "2026-11-03",
    "days_until": 41,
    "voting_method": "all_mail",
    "how_it_works": "Everyone here votes by mail. Your ballot is mailed by Oct 16. Return it by mail with a Nov 3 postmark, or in a drop box by 8 p.m.",
    "deadlines": [
      { "key": "ballots_mailed", "label": "Ballots mailed", "date": "2026-10-16", "days_until": 23, "needs_action": false, "source": "Washington Secretary of State", "source_url": "https://…" },
      { "key": "register_online_mail", "label": "Register by", "date": "2026-10-26", "days_until": 33, "needs_action": true, "detail": "Online or by mail. In person through Election Day.", "source": "…", "source_url": "…" },
      { "key": "return_by", "label": "By 8 p.m.", "date": "2026-11-03", "time_local": "20:00", "days_until": 41, "needs_action": true, "source": "…", "source_url": "…" }
    ],
    "official_links": [
      { "key": "registration", "label": "Check or update registration", "owner": "Secretary of State", "url": "…" },
      { "key": "ballot_tracking", "label": "Track your ballot", "owner": "County elections", "url": "…" },
      { "key": "pamphlet", "label": "Voters' pamphlet", "owner": "County elections", "url": "…" }
    ],
    "source": "Google Civic Information · state election calendar"
  },
  "governments": {
    "count": 9,
    "count_is_minimum": false,
    "on_ballot_count": 6,
    "items": [
      { "geoid": "53", "level": "state", "name": "The state", "on_ballot": true, "decisions": 6, "next_election_note": null, "shape_ref": "tiger:state:53" },
      { "geoid": "…", "level": "city", "name": "City of Fernbrook", "on_ballot": false, "decisions": 0, "next_election_note": "Mayor and council are elected in November 2027.", "shape_ref": "tiger:place:…" }
    ]
  },
  "peel": { "version": 1, "layers": [ { "geoid": "53", "ring": [[-0.93,-0.86],[0.86,-0.93],[0.93,0.84],[-0.86,0.93]], "on_ballot": true } ] },
  "contests": [
    {
      "key": "2026-11-03|ocd-division/country:us/state:wa/sldl:18|state_representative_position_1",
      "section": "Legislative District 18",
      "ballot_order": 6,
      "kind": "candidate",
      "office": "State Representative, Position 1",
      "subtitle": "3 candidates",
      "government_geoid": "…",
      "shape_ref": "tiger:sldl:…",
      "nonpartisan": false,
      "glyph": { "record": true, "words": true, "judgment": true, "place": true },
      "candidates": [
        { "key": "priya-natarajan", "name": "Priya Natarajan", "party_label": "Prefers Democratic Party", "incumbent": true, "ballot_order": 1, "photo_url": null }
      ],
      "measure": null
    }
  ],
  "plan_hints": { "drop_boxes_available": true, "voting_centers_available": true },
  "coverage": { "contests_source": "voterinfo", "documents_states": ["WA", "OR"] }
}
```

Field rules:
- `mode` is `home` for the saved home and `looking` for any other point (Nearby). In `looking` mode, `election.deadlines`, `official_links` and `plan_hints` are omitted and the client shows "Not your ballot".
- `voting_method` is one of `all_mail`, `mail_or_in_person`, `in_person_with_absentee`. It comes from the state sheet, never from the model.
- `deadlines[].needs_action` is true for registration and return deadlines only. The client colors only these with the warning ink.
- `governments.count_is_minimum` is true when special districts are not integrated for the county; the client then writes "at least 5 governments".
- `peel.layers` is ordered wide to narrow by area. Rings are simplified, centered on the home point and normalized to [-1, 1] on the longest axis of the widest layer, so clients only apply the isometric transform (section 7.3).
- `contests[].key` is `<election date>|<ocd division id>|<normalized office key>`. It is the join key for documents. Normalize the office key by lowercasing, removing punctuation and joining words with underscores.
- `ballot_order` comes from voterInfo `ballotPlacement` when present, otherwise the state's printed order table (section 5.4).
- `party_label` is the exact string the source prints. Do not map it to a party enum anywhere in the client.

`GET /api/homes/:id/ballot/contests/:key` returns one contest with its documents grouped by material, the place chart data, the federal record (P3) and, for measures, the levy estimate for this home (P2). Section 5.7 lists all routes.

P0 exposes a summary only, through the existing Place section (below), so P0 needs no new route for the Place card.

**P0: extend the existing `civic_election` section instead of adding a section id.** Add these optional fields to its `data`: `voting_method`, `how_it_works`, `deadlines[]`, `official_links[]`, `governments_count`, `governments_on_ballot`, `count_is_minimum`. Keep `name`, `date`, `days_until`, `polling_place`, `ballot` as they are. Clients that do not know the new fields keep working. The TypeScript union and native models gain optional fields only.

### 5.3 Governments, shapes and peel geometry

1. **Governments list (P0).** From `districtsFromGeographies`, take one government per level: United States (always), state, county, incorporated place (if any), and school district (unified, or elementary plus secondary when unified is absent). Congressional and legislative districts are election districts, not governments: they are attached to the United States and the state as the districts that decide those seats. `count` is the number of governments. In P0, `on_ballot` is true for the United States and the state in a federal general election, and for any government with a known measure or contest in the state sheet; everything else is `false` with `next_election_note` when the state sheet knows it. Where special districts are not integrated, `count_is_minimum` is true.
2. **Special districts (P2, integrated counties only).** Load the county's levy code area or taxing district layer once a year into the cache, keyed `county:<fips>:taxing_districts`. A point-in-polygon test (do it in Node with a small ray-casting helper; PostGIS is not required) adds fire, port, library, transit and water districts. Then `count_is_minimum` becomes false.
3. **Shapes (P1).** For each government and each election district with a contest, query TIGERweb by point with `returnGeometry=true`. Cache the raw GeoJSON per GEOID for 365 days. Simplify each outer ring to at most 200 vertices with Douglas–Peucker. Drop holes and secondary parts except the part containing the home.
4. **Peel geometry (P1).** Project every simplified ring to local meters around the home point (equirectangular is enough at this scale), scale all rings by one factor so the widest layer fits [-1, 1], and sort wide to narrow by area. Very large layers (the United States, a big state) are clipped to a circle 2.5 times the size of the next layer so the stack stays readable; mark them `clipped: true`. Output only the rings, `geoid` and `on_ballot`.

### 5.4 Contests and candidates (P1)

1. Call voterInfo only for an authenticated home, with the home's normalized address and the election id. Never log the address. Never persist the raw response outside the cache, and key the cache by `home:<homeId>:<electionId>`, not by address.
2. Map each voterInfo contest to a contest key using its `district.id` (an OCD id) and `office` (or `referendumTitle`).
3. Order: use `ballotPlacement` when present. Otherwise use a per-state printed-order table in `services/ballot/printedOrder.js` (start with WA and OR from their sample ballots; default elsewhere: state measures, federal, statewide executive, legislative, judicial, county, city, school, special districts, local measures). Candidates keep the order voterInfo returns; never sort.
4. `nonpartisan` is true for judicial and local nonpartisan offices; the client then shows no party label.
5. Match each contest to a government by the contest's OCD id against the governments list and shapes, so the ballot strip can highlight the right polygon.
6. When voterInfo is not live for the election, the packet has `contests: []` and `coverage.contests_source: "none"`, and the client keeps the P0 card with "Your full ballot appears here when the county publishes it, usually about four weeks before the election."

### 5.5 The glyph

Four booleans per contest, in this fixed order: record, words, judgment, place.

| Mark | Candidate contest is true when | Measure is true when |
|---|---|---|
| Record | Any candidate has a prior-office record we can show (legislative votes, a bill count, an FEC or state finance total) | Official full text or a fiscal statement is stored |
| Their words | Any candidate has a published pamphlet statement, questionnaire answer or official post | A filed argument for or against is stored |
| Judgment | Any published endorsement the candidate listed, or a published rating (for example a bar evaluation) | A published rating exists (rare) |
| Place | ACS data exists for the contest's geography | Same |

ACS has no data for special districts, so fire, port, library and transit contests always have a hollow place mark. A glyph is computed from what is stored, never from what might exist.

### 5.6 Deadlines, pushes and the "you moved" card (P0)

1. **Rows.** Election deadlines are `AddressCalendarRule` rows with `kind = 'election_deadline'`, `scope_type = 'state'`, `scope_key = '<ST>'`, one row per deadline, `rrule = 'FREQ=DAILY;COUNT=1'`, `dtstart = <date>`, `confidence = 'official'`, and `source` and `source_url` pointing at the statute or Secretary of State page. Titles are the labels users see ("Ballots mailed", "Register online or by mail", "Return by 8 p.m."). `lead_days` is 0 for ballots mailed, 7 for registration and 1 for return. `deadlines.js` maps each title to its machine key (`ballots_mailed`, `register_online_mail`, `return_by`, `election_day`) through a table in `states.json`; unknown titles are shown as plain dated rows with `needs_action: false`.
2. **Keep all election rows at state scope.** `applyPrecedence` keeps only the narrowest scope per kind. A single county-scope `election_deadline` row would hide every state row for homes in that county. If a county-specific deadline is ever needed, add it at state scope with a county-specific title, or add a new kind in a migration.
3. **Window.** `composeForHome` defaults to 14 days. `deadlines.js` calls it with `windowDays: 60` and keeps only `election_deadline` events.
4. **Briefing signal.** In `generateAddressCalendarSignals`, add an election branch: score 0.62, urgency `high` on the day of a `needs_action` deadline and `medium` for the day before, detail from the row title plus "today" or "tomorrow", action `{ label: 'Open your ballot', route: '/place/ballot' }`, and never the pickup "Unconfirmed" suffix (that suffix must apply to pickup kinds only). `address_calendar` cost of inaction stays 0.60, so these clear the interrupt gate on their days.
5. **The three pushes.** P0 uses the morning briefing push: ballots mailed (lead 0), register-by (lead 7 and lead 0), return day (lead 1 and lead 0). The evening "Last call" at 6 p.m. local on Election Day is P2, as a pg-boss job that runs once per state per election and only for users with the Ballot reminders preference on.
6. **"You moved" card.** Show on Place and Today when `HomeOccupancy.start_at` is within the last 12 months, a `register_online_mail` deadline is in the future, and the user has not dismissed it. It links to the registration official link. Dismissal is stored with the existing card-dismissal mechanism if one exists on the platform; otherwise on-device. The same condition drives one push, 7 days before the registration deadline.
7. **Mail Day.** Add a rule to the existing Mail Day classifier: an envelope from a county elections office in the 10 days after `ballots_mailed` is labeled "Your ballot" and links to the ballot card. If Mail Day has no rule mechanism for sender matching, skip this in P0 and record it in section 16.

### 5.7 Routes

| Route | Auth | Phase | Returns |
|---|---|---|---|
| `GET /api/homes/:id/intelligence?sections=civic_election,civic_districts` | existing | P0 | Extended `civic_election` data (section 5.2) |
| `GET /api/public/place?address=…` | none, existing limiter | P0 | Adds `ballot_teaser: { governments_count, count_is_minimum, next_election: { name, date, days_until }, next_deadline: { label, date, days_until } }`. Uses lat/lng only. Persists nothing. |
| `GET /api/homes/:id/ballot` | home access | P1 | The full packet |
| `GET /api/homes/:id/ballot/contests/:key` | home access | P1 | One contest with documents, charts, levy (P2), federal record (P3) |
| `GET /api/ballot/looking?lat=&lng=` | signed in | P1 | Packet in `looking` mode: governments, shapes and contests for that point from the state sheet and cached contest lists; no deadlines, no address sent to Google |
| `GET /api/ballot/contests/:key/public` | none | P1 | Public contest page data with no personal data. Backs the web page the apps open in the in-app browser (section 7.5). |
| `GET /api/homes/:id/ballot/levy/:key` | home access | P2 | Levy estimate for this home (section 5.13); used by the native measure sheet and the signed-in web page |
| `POST /api/ballot/contests/:key/clerk` | none, rate-limited | P2 | Clerk answer for one contest (section 5.14). Public because it reads only public documents. |
| `POST /api/ballot/reports` | signed in or anonymous with limiter | P2 | Error report on a contest or document |
| `GET /api/ballot/compare/:token` | none | P0 | Verifies a compare token, returns the sharer's city, optional first name, governments count and government names |

Put all new routes in `backend/routes/ballot.js`, mounted beside `placeIntelligence` in `backend/app.js`. Validate params with Joi as other routes do. Every public route gets `Cache-Control` appropriate to its data (`no-store` for anything derived from a typed address).

### 5.8 Anonymous `/start` (P0)

`composePreviewSections` already runs per lat/lng with a time budget. Add a `ballot_teaser` computed from the geocoder geographies (governments count) and the state's election rows (next election and next deadline). Run it inside the same budget with a fallback of `null`. When null, the aha card does not show the ballot line. `pickAha` does not change; the ballot teaser is its own block under the aha card on `/start`.

### 5.9 Share and compare (P0)

1. **Share image.** Extend `frontend/apps/web/src/app/api/og/place/route.tsx` with `variant=governments`. Inputs: `city`, `count`, `minimum` (boolean), optional `name`. Never an address. Draw the still stack (same polygons as the canvas **[Board: Share and compare cards]**; in P0 use the fixed decorative stack, since the image must not reveal real shapes of a stranger's districts) and the line "My address sits inside N governments." with "How many does yours?" and the start URL. Light and dark.
2. **Compare token.** Reuse the loop design's F8 signed compare payload (`docs/first-person-loop-design-2026-09-16.md`, section F8) and add `governments: [{ level, geoid, name }]` and `count`. GEOIDs of states, counties, cities and school districts are public and coarse. Sign with the same HMAC keyring pattern. Expiry: the day after the election plus one week.
3. **Compare view.** On `/start?vs=<token>`, after the friend's lookup, show both counts and the governments in common by GEOID **[Board: Share and compare cards, lower card]**. First names show only if the sharer opted in.

### 5.10 Documents and ingestion (P1 table, P2 content)

Documents are what makes the reading room. They are entered by a person (the founder, a contractor or an agent) from official pamphlets, then loaded by a script.

**File format.** One JSON Lines file per election and state, `backend/data/ballot/documents/<election-date>-<st>.jsonl`. Commit a file only after every row in it is published; drafts stay out of Git. One object per document:

```json
{"election_date":"2026-11-03","ocd_division_id":"ocd-division/country:us/state:wa/sldl:18","office_key":"state_representative_position_1","contest_kind":"candidate","candidate_name":"Priya Natarajan","kind":"questionnaire_answer","topic":"housing","prompt":"What would you change to make housing more affordable in the district?","body":"Let homeowners build a backyard cottage without a two-year permit wait…","source_name":"Alder County voters' guide questionnaire","source_url":"https://…","source_page":null,"published_at":"2026-09-12","language":"en"}
```

`kind` values: `pamphlet_statement`, `questionnaire_answer`, `official_post`, `listed_endorsement`, `rating`, `official_ballot_title`, `official_text`, `explanatory_statement`, `fiscal_statement`, `argument_for`, `argument_against`, `rebuttal_for`, `rebuttal_against`.

**Material mapping (fixed in code):** words = `pamphlet_statement`, `questionnaire_answer`, `official_post`, `argument_for`, `argument_against`, `rebuttal_for`, `rebuttal_against`; judgment = `listed_endorsement`, `rating`; record = `official_ballot_title`, `official_text`, `explanatory_statement`, `fiscal_statement`.

**Script `scripts/ballot/ingest.js`:** validates every line (required fields, known kind, `body` non-empty, `source_url` is https, `published_at` is a date), normalizes `office_key` and `candidate_key`, rejects duplicates, and writes rows with `status = 'draft'`. A second command `--publish <file>` flips reviewed rows to `published` after a human has compared each body against the source. Nothing reaches users while `draft`.

**Questionnaires.** When a question was sent to every candidate, every candidate without an answer gets no row. The contest page derives "Did not respond" from the set of candidates minus those with an answer for that prompt. Record the prompt text on every answer row so the page can group by prompt.

**Corrections.** A correction inserts a new row with `supersedes_id` and marks the old row `corrected`. A retraction marks it `retracted`. The contest page shows "Corrected on <date>" under a corrected document.

### 5.11 Federal record and money (P3)

1. Map incumbents to ids through the congress-legislators file (bioguide and FEC ids). For challengers, search OpenFEC by name, state and district. Keep ids out of `ElectionDocument`: `federal.js` caches an `external_ids` map per contest, keyed by candidate key, and a person confirms any challenger match before it is shown.
2. Money: OpenFEC totals per two-year cycle and per quarter from the candidate's committee reports; source mix as percentages of receipts (small individual, large individual, committees, candidate self-funding, other). No donor names. Label the report through date and the next report due date.
3. Votes: for incumbents only, the roll calls on bills tagged with the same topic as the question room's topic tabs. Topic tagging of bills uses the bill's policy area and subjects from Congress.gov, mapped by a small table in `federal.js`. Each vote shows the bill number and short title, the date, the result and tally, and links to the roll call.

### 5.12 Place charts (P2)

For each contest geography, fetch up to six ACS indicators with the district's value, the state's value and the national value. The indicator shown first follows the active question topic: housing shows rent burden, property taxes shows median real estate taxes paid, schools shows residents under 18. Special districts return nothing (hollow place mark). Values are rounded as the source publishes them; margins of error are available in the detail view.

### 5.13 Levy for this home (P2)

Only for local levies and bonds whose explanatory statement publishes an estimated rate per $1,000 of assessed value.

`estimate = rate_per_1000 × assessed_value / 1000`, rounded to the dollar, labeled "about $N in <first year>". Inputs and their sources are shown on the card: the rate (from the explanatory statement, stored as a `fiscal_statement` document with a structured `rate_per_1000` and `first_year` in a sidecar JSON field), the home's assessed value (from the county assessor record already on the home, with its year). Rules:
- Always render the "What the $N million pays for" breakdown from the same statement beside the cost. If the statement has no breakdown, render the statement's purpose text instead. Never the cost alone.
- If the assessed value is not on record, show the rate only: "$0.94 per $1,000 of assessed value."
- Renters see "Owners pay this tax. We don't estimate how much reaches rent."
- Never shown in Nearby looking mode.

### 5.14 The clerk (P2 measures, P3 races)

**What it may do:** retrieve quotes ("Only their words on housing"), show where answers differ without ranking, and rewrite measure text in plain language next to the locked official text. **What it must not do:** recommend, rank, judge truthfulness, fill a blank, browse the web, translate a candidate's words and attribute them to the candidate, or state any date, place or eligibility rule.

**Implementation.**
1. Input: contest key, the user's question, the last four turns of this conversation (kept in the page and sent with each request; nothing stored on the server).
2. Context: only the contest's published documents, each with a short id (`d1`, `d2`, …), and the candidate list. No other text.
3. Model: the existing OpenAI client and `OPENAI_CHAT_MODEL`, temperature 0, structured output with a JSON schema added to `services/ai/schemas.js`:
   `{ "answer_type": "retrieve|diff|plain_language|decline", "lines": [ { "text": "...", "quotes": [ { "doc": "d3", "span": "exact substring" } ] } ], "suggestions": ["..."] }`.
4. Server validation before returning: every `span` must be an exact substring of the named document's `body`; every line in `retrieve` or `diff` must carry at least one valid quote; `plain_language` lines are allowed without quotes only for measures and are tagged in the UI "Rewritten by the clerk, not the law". Any failure drops that line; if nothing survives, return the fixed decline text.
5. Deterministic refusals before the model call: a keyword classifier catches "who should I vote for", "who is better", "is X lying", "predict", "will X win", dates and deadlines, polling places and eligibility. Voting-choice questions get: "That choice is yours, and I don't rank candidates. I can put their answers side by side on any topic, or show what's on the record for each of them." Logistics questions get the relevant official link from the packet.
6. Limits: 20 questions per visitor per contest per day and 60 per visitor per day, keyed by user id when signed in and otherwise by the existing IP limiter. Log token usage through the existing AI usage logging. Do not store question or answer text.
7. The clerk button appears only on contest pages. Never on the map, the strip, `/start`, Today or pushes.

### 5.15 Cache keys and time-to-live

| Data | Section id | Key | TTL |
|---|---|---|---|
| Geocoder geographies | `civic_districts` (existing) | existing | existing |
| Elections list | `civic_election` (existing) | `state:<st>` | 1 day |
| voterInfo per home | `_ballot_voterinfo` | `home:<homeId>:<electionId>` | 6 h; 1 h in the final 7 days |
| TIGER shape | `_ballot_shape` | `tiger:<layer>:<geoid>` | 365 days |
| Peel geometry | `_ballot_peel` | `home:<homeId>` | 30 days |
| County taxing districts | `_ballot_taxing` | `county:<fips>` | 365 days |
| ACS indicators | `_ballot_acs` | `acs:<vintage>:<geo>` | 365 days |
| FEC totals | `_ballot_fec` | `fec:<candidateId>:<cycle>` | 1 day |
| Congress votes | `_ballot_votes` | `bioguide:<id>:<congress>` | 1 day |

Leading-underscore section ids are internal (the existing pattern, for example `_congress_legislators`) and are not added to `PLACE_SECTION_META`.

### 5.16 Feature flags

DB-backed flags through `featureFlagService`: `ballot_p0` (Place card, `/start` teaser, deadlines, share), `ballot_full` (packet, strip, peel, contest pages, Nearby looking), `ballot_reading_room` (documents, charts, levy, plan), `ballot_clerk`.

The native apps do not read backend flags today, so **gate on the server**: when a flag is off for the user, the backend omits the Ballot fields and routes return 404, and every client renders only what it receives. Web may also read `useFeatureFlag` for route-level gating. The anonymous `/start` teaser follows a global setting of `ballot_p0`. Deadline rows are data and appear in the address calendar regardless of flags; the briefing election branch checks `ballot_p0`.

### 5.17 Funnel events

Add to `FUNNEL_EVENT_TYPES` and (where client-posted) `CLIENT_POSTABLE_EVENT_TYPES`:

| Event | Posted by | Meta (no address, no home id for anonymous) |
|---|---|---|
| `ballot_teaser_viewed` | web `/start` | `{ count, minimum }` |
| `ballot_card_viewed` | clients | `{ days_until }` |
| `ballot_peel_viewed` | clients | `{ completed: bool }` |
| `ballot_contest_opened` | clients | `{ kind, has_words: bool }` |
| `ballot_official_link_clicked` | clients | `{ key }` |
| `ballot_share_clicked` | clients | `{}` |
| `ballot_compare_viewed` | web | `{ in_common }` |
| `ballot_plan_saved` | clients | `{ method }` (never the day) |
| `ballot_clerk_asked` | server | `{ answer_type }` |

Never record a candidate, party, measure position or anything that could reveal a voting intention.

---

## 6. Database

Two migrations in P0, one in P1, one in P2. Nothing else. Each migration file follows the repo rules: the header says `-- Backwards compatible: yes.` with a reason, it sets `SET LOCAL lock_timeout='5s';`, the file name sorts after the newest migration on master at the time of the PR (CI runs `scripts/db/check-migrations.cjs`; renumber with `git mv` if master moves), and applied migrations are never edited.

### M1 (P0): widen the funnel events CHECK

```sql
-- Backwards compatible: yes. Widens one CHECK; existing values stay valid.
SET LOCAL lock_timeout='5s';
ALTER TABLE public."FunnelEvent" DROP CONSTRAINT IF EXISTS funnelevent_type_check;
ALTER TABLE public."FunnelEvent" ADD CONSTRAINT funnelevent_type_check CHECK (event_type = ANY (ARRAY[
  't0_preview_viewed','t0_aha_viewed','t0_share_clicked','t0_wall_viewed','register_started','t1_account_created',
  'ballot_teaser_viewed','ballot_card_viewed','ballot_peel_viewed','ballot_contest_opened',
  'ballot_official_link_clicked','ballot_share_clicked','ballot_compare_viewed','ballot_plan_saved','ballot_clerk_asked'
]::text[]));
```

If the loop design's events (`t0_compare_viewed`, `session_open`) have landed by then, keep them in the list; if not, add them here too so there is one widening, not two.

### M2 (P0): election deadline reference rows

Generated by `scripts/ballot/seed-deadlines.js` from the state sheet, same insert shape as the Washington property-tax rows in `supabase/migrations/20260908234527_reference_baseline.sql`. For Washington, November 3, 2026:

| Title | dtstart | lead_days | Source |
|---|---|---|---|
| Ballots mailed | 2026-10-16 | 0 | RCW 29A.40.070 (ballots mailed at least 18 days before) |
| Register online or by mail | 2026-10-26 | 7 | RCW 29A.08.140 (received 8 days before; in person through Election Day) |
| Return by 8 p.m. | 2026-11-03 | 1 | RCW 29A.40.091 and Secretary of State |

For every other state in P0, insert only the Election Day row (`Election Day`, 2026-11-03, lead 1, source the state's election office) unless its registration and mail deadlines have been checked against the state's own site and cited. The client links to vote.gov for any missing deadline. Make reruns safe with `ON CONFLICT (scope_type, scope_key, kind, rrule, dtstart, title) WHERE scope_type <> 'home' DO NOTHING`, which matches the existing unique index `AddressCalendarRule_seed_uniq`.

The per-state voting method (`all_mail`, `mail_or_in_person`, `in_person_with_absentee`) and the official links live in a versioned JSON file, `backend/data/ballot/states.json`, loaded at boot. It is reference data that changes by election, not per user, so it does not need a table.

### M3 (P1): `ElectionDocument`

```sql
-- Backwards compatible: yes. New table only; no existing object changes.
SET LOCAL lock_timeout='5s';
CREATE TABLE public."ElectionDocument" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_date date NOT NULL,
  ocd_division_id text NOT NULL,
  office_key text NOT NULL,
  contest_kind text NOT NULL CHECK (contest_kind IN ('candidate','measure')),
  candidate_key text,
  candidate_name text,
  kind text NOT NULL CHECK (kind IN ('pamphlet_statement','questionnaire_answer','official_post','listed_endorsement','rating',
    'official_ballot_title','official_text','explanatory_statement','fiscal_statement',
    'argument_for','argument_against','rebuttal_for','rebuttal_against')),
  topic text,
  prompt text,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  structured jsonb NOT NULL DEFAULT '{}'::jsonb,
  language text NOT NULL DEFAULT 'en',
  source_name text NOT NULL,
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  source_page text,
  published_at date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','corrected','retracted')),
  supersedes_id uuid REFERENCES public."ElectionDocument"(id),
  correction_note text,
  ingested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT election_document_candidate_chk CHECK (
    (contest_kind = 'candidate' AND kind IN ('pamphlet_statement','questionnaire_answer','official_post','listed_endorsement','rating') AND candidate_key IS NOT NULL)
    OR (contest_kind = 'measure' AND candidate_key IS NULL)
    OR (contest_kind = 'candidate' AND kind NOT IN ('pamphlet_statement','questionnaire_answer','official_post','listed_endorsement','rating'))
  )
);
CREATE INDEX idx_election_document_contest ON public."ElectionDocument" (election_date, ocd_division_id, office_key) WHERE status = 'published';
CREATE UNIQUE INDEX uq_election_document_source ON public."ElectionDocument"
  (election_date, ocd_division_id, office_key, coalesce(candidate_key, ''), kind, coalesce(topic, ''), source_url) WHERE status IN ('draft','published');
ALTER TABLE public."ElectionDocument" ENABLE ROW LEVEL SECURITY;
-- No policies: only the backend service role reads and writes. Clients never query this table directly.
```

`structured` holds machine fields that some kinds need, for example `{ "rate_per_1000": 0.94, "first_year": 2027, "breakdown": [{ "label": "Replace Fernbrook Elementary", "amount": 92000000 }] }` on a `fiscal_statement`.

Why a new table (record this in the PR per `AGENTS.md`): no existing table stores sourced, versioned public documents about a contest. `PlaceSectionCache` is a TTL cache that drops rows; `AddressCalendarRule` holds dated rules; posts and mail are user content with other privacy rules.

### M4 (P2): `ElectionReport`

```sql
-- Backwards compatible: yes. New table only.
SET LOCAL lock_timeout='5s';
CREATE TABLE public."ElectionReport" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid,
  anon_id text CHECK (anon_id IS NULL OR char_length(anon_id) <= 64),
  contest_key text NOT NULL,
  document_id uuid REFERENCES public."ElectionDocument"(id),
  reason text NOT NULL CHECK (reason IN ('wrong_date','wrong_candidate','misquoted','outdated','missing','other')),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','fixed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public."ElectionReport" ENABLE ROW LEVEL SECURITY;
```

Why a new table: report tables are per-type today (`PostReport`, `ListingReport`, `GigReport`, `UserReport`), and none can reference an election document. In P0 there are no documents, so the "Report a mistake" link on the Place card opens the existing support email.

### Not added, on purpose

- No table for contests or candidates: they come live from voterInfo and are cached. Revisit only if the P2 test market shows voterInfo missing local contests.
- No table for the voting plan: it stays on the device (section 7.8).
- No table for shapes or packets: `PlaceSectionCache`.
- No table for compare links: signed tokens.
- No table for clerk conversations: nothing is stored.

---

## 7. Clients

Path prefixes: **W** = `frontend/apps/web/src`, **P** = `frontend/packages`, **I** = `frontend/apps/ios/Pantopus`, **A** = `frontend/apps/android/app/src/main/java/app/pantopus/android`. Line numbers are approximate anchors from September 23, 2026.

### 7.1 Where each surface is built

| Surface | Web | iOS | Android |
|---|---|---|---|
| Section types | `P/types/src/placeIntelligence.ts` (`PlaceCivicElectionData` ~693, `PlaceBallotRace` ~673, `PlaceSectionId` ~810) | `I/Core/Networking/Models/Place/PlaceIntelligenceDTOs.swift` (civic types ~991–1032, envelope payload switch ~1404) | `A/data/api/models/place/PlaceIntelligenceDtos.kt` (civic ~830, ~867), `PlaceJsonAdapters.kt` ~124 |
| API client | `P/api/src/endpoints/place.ts` (`getPlaceIntelligence` ~158, `getPublicPlacePreview` ~174); add `endpoints/ballot.ts` | `I/Core/Networking/Endpoints/PlaceEndpoints.swift`; add `BallotEndpoints.swift` | `A/data/api/services/PlaceApi.kt`, `A/data/place/PlaceRepository.kt`; add `BallotApi.kt` |
| Place "Your ballot" card | `W/components/place/presentation.tsx` (`SECTION_CONFIG` ~153, civic ~396/405, `renderSection` ~472) and `W/components/archetypes/place/SectionCard.tsx`; new `W/components/ballot/BallotCard.tsx` | `I/Features/Place/PlacePresentation.swift` (`config(for:)` civic ~187, `reading(for:)` ~354), `PlaceSectionView.swift`, `Components/PlaceSectionCard.swift`; new `Features/Ballot/BallotCardView.swift` | `A/ui/screens/place/PlacePresentation.kt` (civic ~187/190, ~385/405), `PlaceSectionRenderer.kt`, `components/PlaceSectionCard.kt`; new `ui/screens/ballot/BallotCard.kt` |
| Civic detail today | `W/components/place/detail/CivicDetail.tsx` (`ElectionBanner`, `PollingCard`, `BallotPreview`, `BallotRace`) | `I/Features/Place/Detail/PlaceCivicDetailContent.swift` (`ElectionCard` ~143) | `A/ui/screens/place/detail/PlaceMoneyCivicDetailContent.kt` (`ElectionCard` ~707) |
| `/start` teaser and compare | `W/app/start/page.tsx`, `W/components/place/StartFunnel.tsx` (`PreviewBody` ~398, `ShareAddressLink` ~490), `W/components/archetypes/place/AhaCard.tsx` | `I/Features/Place/Launch/PlacePreviewBody.swift` | `A/ui/screens/place/launch/PlaceLaunchScreen.kt` (`AhaCard` ~679) |
| Share image | `W/app/api/og/place/route.tsx` | native share sheet with the web URL | native share sheet with the web URL |
| "You moved" card | `W/components/place/JustMovedCard.tsx` | `I/Components/JustMovedCard.swift` | `A/ui/screens/place/components/JustMovedCard.kt` |
| Today | `W/app/(app)/app/hub/today/page.tsx`, `W/components/hub/HubTodayCard.tsx`, `W/components/place/detail/AddressCalendarCard.tsx` | `I/Features/Root/RootTabView.swift` (`TodayTabRoot` ~262, `AddressTodayTabView`) | `A/ui/screens/place/today/TodayTabScreen.kt` |
| Nearby looking mode | `W/app/(app)/app/nearby/page.tsx`, `NearbyCellsMap.tsx` | `I/Features/Neighborhood/NeighborhoodView.swift`, `I/Features/Nearby/NearbyMapView.swift` (SwiftUI `Map`) | `A/ui/screens/nearby/NearbyScreen.kt` (`GoogleMap` ~228) |
| Maps | Leaflet and react-leaflet, `W/components/map/BaseMap.tsx`, tiles in `W/components/map/constants.ts` | MapKit, SwiftUI `Map` with `MapPolygon` (iOS 17 target) | Google Maps Compose `Polygon` |
| Push routing | web notifications as today | `I/App/AppDelegate.swift` (tap routing ~134), `I/Core/Routing/DeepLinkRouter.swift` (`Destination` ~26) | `A/push/NotificationDispatcher.kt` (`route` ~118), `A/core/routing/DeepLinkRouter.kt` |
| Contest pages | new public route `W/app/ballot/[election]/[contest]/page.tsx` | open with `SFSafariViewController` (pattern: `I/Core/Payments/ConnectWebPresenter.swift`) | open with Custom Tabs (pattern: `wallet/scheduling/StripeConnectLauncher.kt`) |
| Flags | `W/hooks/useFeatureFlag.ts` | none: server-side gating | none: server-side gating |

**Decisions forced by what exists.**
- **No in-app web view exists** on either native app, and native requests are device-bound (DPoP). So contest pages are **public web pages with no personal data**, opened in `SFSafariViewController` and Custom Tabs, which both apps already use. Nothing about the user travels to that page. Anything personal (the levy for this home, the plan) is native.
- **Native apps do not read backend flags.** Gate on the server: the backend adds ballot fields to responses only when the user's flag is on; the clients render whatever fields are present. Web can also use `useFeatureFlag`.
- **Neither native app schedules local notifications today.** The P2 voting plan adds that: `UNCalendarNotificationTrigger` on iOS and a new `androidx.work` dependency on Android.

### 7.2 Place "Your ballot" card (P0) **[Board: Place: Your ballot card]**

Built as the renderer for the existing `civic_election` section, titled "Your ballot". Layout top to bottom:

1. Header row: 34pt icon tile (home-green tile, ballot-box glyph), title "Your ballot", subtitle "<Month day> <election type>", right chip "<N> days".
2. Line (15/21 medium): "<decisions> decisions from <on_ballot> of your <count> governments". In P0, before contests are known, use "<count> governments decide things at this address" and hide the decisions count. With `count_is_minimum`: "at least <count>".
3. Deadline timeline (section 9.2).
4. How it works (13.5/19): `how_it_works` from the packet.
5. Primary button "Open your ballot" (P1+; in P0 the button reads "See your governments" and opens the still stack).
6. Sunken well of official links: each row has a title, the owning office as subtitle, and an external-link icon. P0 adds "Make a voting plan" only in P2.
7. Source line: "<source> · as of <time>".

States:

| State | When | Shows |
|---|---|---|
| Loading | fetching | skeleton in the card's shape |
| Unavailable | no key or no data | the section's standard unavailable state: "Election data isn't available for your area yet." |
| Nothing scheduled | no election in the next 120 days | Compact card: "No election on the calendar for this address." If a later date is known: "Next: <date>." |
| Far | 61 to 120 days out | Compact card with date and "Registration deadline: <date>" when known |
| In season | 60 days out to Election Day | Full card |
| Election Day | the day | Title "Election Day", timeline collapses to "Return by 8 p.m. today" |
| After | Election Day plus 1 to 7 days | "Results are published by <county elections>" with a link. No results in the app. |
| Hidden | 8 or more days after | Card removed until the next election |

### 7.3 The stack and the peel **[Boards: Overview, The peel, Web lookup]**

**Geometry (shared by all platforms).** Input: `peel.layers[].ring` in normalized coordinates. For each point `(x, y)`:
- rotate 45 degrees: `u = (x − y) / √2`, `v = (x + y) / √2`
- flatten: `v' = v × 0.5`
- screen: `X = cx + u × S`, `Y = baseY_i + v' × S`, where `S` is the layer scale and `baseY_i = baseY_0 − i × gap` for layer `i` (0 is the widest).

Sizes: large (overview, tablet) `S = 200`, `gap = 36`; phone full screen `S = 164`, `gap = 32`; card still `S = 90`, `gap = 14`.

**Drawing rules.** Layer 0 fills `#eef1f5`; the others fill white at 94% opacity so lower outlines show faintly. Governments with something on this ballot stroke 1.5pt `#111827`; governments with nothing this year stroke 1.2pt `#9ca3af` dashed 4 on 3. Strokes do not scale with the layer. A dashed 2pt home-green line runs through every layer's center, ending in a 7pt home-green dot with a 2.5pt white ring at the base. Labels sit right of the stack with a 1pt leader line: name 14/600 in `#111827` (or `#4e5563` when nothing this year), detail 12 in `#4e5563`.

**Animation (P1).** Two modes.

| Mode | Where | Sequence | Timing |
|---|---|---|---|
| Rise | Overview, first open of the ballot | Layers start collapsed at the base and rise to their positions, widest first; labels fade in after their layer settles; the count rolls from 1 up to N | Each layer 280 ms ease-out, next layer starts 120 ms later; labels 150 ms fade; count steps with each layer |
| Story | Full-screen peel on phones | One step per government, widest first, then a final step "You are standing in N governments." The current layer lifts 8pt, fills home-green tint `#dcfce7` with a 3pt `#15803d` outline; the caption card below changes | 1.2 s per step; captions fade up 8pt in 180 ms; a single progress bar fills across all steps; "Skip" ends it; plays once per election, "Replay" in the card menu |

Reduced motion (iOS `accessibilityReduceMotion`, Android animator duration scale 0, web `prefers-reduced-motion`): show the finished stack and the final caption; no rise, no story.

Platform notes: web uses SVG with CSS keyframes (the canvas boards contain working keyframes for both modes; copy their structure); iOS draws each layer as a `Path` inside a `ZStack`, offsets animated with `.easeOut(duration: 0.28).delay(Double(i) * 0.12)`, the count with `.contentTransition(.numericText(value:))`; Android draws with `Canvas` and one `Animatable` per layer launched with staggered delays, the count with `AnimatedContent`. Cap at 12 layers and 200 vertices per ring.

**P0 still stack.** P0 has no real shapes yet, so the still stack on `/start` and Place uses the fixed decorative polygon set from the canvas (nine shapes), shows only as many layers as `governments.count` (up to nine), and marks dashed layers by `on_ballot = false`. It is a picture of "a stack", labeled by the list beside it, never presented as the real boundaries.

### 7.4 Ballot strip and map (P1) **[Board: Ballot strip and map]**

- Screen: back bar "Your ballot" with "<Month day> · <address line1>"; a 300pt map; below it the strip.
- Map: the platform map component with the home pin (home green) and one polygon per contest geography from the shapes cache. Unselected: 1pt `#94a3b8` stroke, no fill. Selected: 3pt `#111827` stroke, fill `rgba(17,24,39,0.07)`. On selection the camera fits the selected polygon's bounds with 24pt padding in 450 ms. A white caption chip at the map's bottom reads "<government> · decides <what>".
- Strip: header "<N> decisions · In the order they are printed on your ballot" plus the glyph legend. Groups in printed order with an overline title per group; each group is one card of rows. Row: office (14.5 medium; semibold when selected), subtitle (12.5 secondary), glyph at right. Selected row: `#f0f9ff` background and a 3pt `#0369a1` bar at left; a trailing "Open" link appears. Tapping a row selects it; tapping "Open" (or tapping a selected row again) opens the contest page.
- Footnote: "Tap a contest to see the line that decides it. A hollow square means nobody filed that kind of document yet."

**Glyph component.** Four squares 10×10pt, corner radius 2, gap 3, order record, words, judgment, place; filled with the material ink or hollow with a 1.5pt border in that ink. Accessibility label, for example "Record on file. Their words on file. No judgment filed. Place on file."

### 7.5 Contest pages (P1 structure, P2 content) **[Boards: Race, Federal race, Measure, Nothing filed, The clerk]**

A public Next.js route, `W/app/ballot/[election]/[contest]/page.tsx`, server-rendered from `GET /api/ballot/contests/:key/public`, cacheable for 10 minutes, `noindex` until P3. It contains no personal data and needs no sign-in.

**Candidate race.**
1. Header: office, district, "N candidates"; the glyph.
2. Candidates in printed order as equal cards: initials disc (or the pamphlet photo if filed), name, party label, "Incumbent" chip when true. Note: "No photos unless a candidate filed one with the voters' pamphlet."
3. **Their words.** Topic chips (one per questionnaire prompt that has at least one answer; 36pt pill; selected is ink-filled). The prompt card ("Question sent to every candidate"). Then one card per candidate in printed order: quoted body in the serif face, candidate name and party, source link with date. A candidate without an answer gets the dashed "Did not respond" card: "No answer was filed by <date>. We leave this space empty rather than write one for them."
4. **The place.** Title from the indicator, a dot plot (section 9.4), source line ending "No caption tells you what it means." The indicator follows the selected topic.
5. **Record.** For each candidate: office history or "No prior elected office. Filed <date>." Money raised this cycle as same-scale single-ink bars. Federal races add the quarterly small multiples, source mix and votes on the selected topic (section 9.3, 9.5).
6. **Someone else's judgment.** Amber slips, organization name larger than its grade, "listed in <his/her/their> pamphlet statement". Use the candidate's pamphlet pronoun if stated, otherwise "their". "<Name> lists no endorsements." when none. Only endorsements the candidate lists, and published ratings.
7. Clerk button (violet): "Ask the clerk about this race", with "The clerk answers only from the N documents on this page."
8. Footer: "Report a mistake" and every source used on the page.

**Measure.** Map strip of the deciding shape with "Your home is inside" (only when opened from the user's own ballot; the public page omits the home pin), the official ballot title as a bordered document with the ballot's answer choices, a link to the full text, the clerk's plain-language block (violet, "Rewritten by the clerk, not the law", "This rewrite can be wrong. The official text above is what you vote on."), "What your vote does" (yes and no from the explanatory statement), "For this home" (signed-in web only; native shows it in the native sheet that precedes the page), filed arguments for and against as equal serif cards with rebuttal links, and the clerk button.

**Nothing filed.** The shape large, the heading "This office is decided inside this line.", the body "Neither candidate filed a statement for the voters' pamphlet, and no questionnaire reached them. We show that plainly instead of writing a biography nobody filed.", a "What's on file" table with the four materials, candidate cards with filing dates, what the government does in its own words (from its official site, quoted and linked), and official links. This is a finished page, not an error.

**Clerk sheet.** Bottom sheet over the page: title "Clerk" with the violet tile, the scope line, the conversation, two suggestion chips ("Only their words on <topic>", "Where their answers differ"), a text field and a send button. Answers render each line with its quotes in the serif face and numbered source links; plain-language lines carry the violet tag. The voting-choice decline and its two follow-up chips render as in the board. The conversation lives only in the page's memory.

**Native entry.** Tapping "Open" in the native strip opens a native sheet for measures with the levy card (P2) and "Read the measure", and opens candidate races directly. Both open the public page in `SFSafariViewController` or Custom Tabs.

### 7.6 Today, Mail Day and pushes **[Boards: Today in ballot week, The only pushes]**

- **Today card.** Appears from `ballots_mailed − 1 day` to Election Day and on any `needs_action` deadline day. "Ballot week" state: overline "Ballot week", title "Your ballot should arrive today", a Mail Day line when Mail Day matched an elections envelope, the plan line when a device plan exists, buttons "Open your ballot" and "Your plan". The "you moved" line sits under it in the warning well.
- **Push copy (exact).**
  - Ballots mailed: title "Your ballot is in the mail", body "<County> mailed ballots today. Yours should arrive in 1 to 3 days."
  - Registration (lead 7): title "Moved this year? Update your registration", body "Do it online by <Mon day> so your ballot comes to this address." Only for the "you moved" condition.
  - Registration (day of): title "Last day to register online or by mail", body "You can still register in person through Election Day."
  - Return (day before): title "Ballots are due tomorrow by 8 p.m.", body "Drop boxes close at 8 p.m. A mailed ballot needs a <Mon day> postmark."
  - Last call (P2, 6 p.m. local): title "Last call", body "Drop boxes close at 8 p.m. tonight. Already done? Ignore this one."
  - Your day (P2, local, from the plan): title "Today is your voting day", body "You planned <method phrase>. <Place> is open until 8 p.m. <Mon day>."
- **Deep links.** Add `/place/ballot` and `/place/ballot/contest/<key>` to `DeepLinkRouter` on both apps and to web routing; push taps land there.
- **Preferences.** A "Ballot reminders" toggle in notification settings, on by default for users with the P0 flag; honors quiet hours.

### 7.7 Nearby looking mode (P1) **[Board: Nearby: crossing a line]**

- Entering: the user searches or drags the pin anywhere that is not their home. A black "Looking" chip and "Not your ballot. Your home stays under Place." appear under the search field.
- Fetch `GET /api/ballot/looking` debounced 300 ms after the pin settles. Show the governments line (the boundary nearest the pin) in heavy ink.
- Bottom sheet "What this ground decides" with the decisions count and the contest rows. When the pin crosses a line: the line flashes to 7pt and back over 300 ms; rows that leave fade out, rows that arrive fade in, both in 180 ms; the count updates; a removed government becomes an italic muted row "The <government> ends at this line" for 3 seconds.
- Never deadlines, plans, drop boxes, levies or the clerk in this mode.

### 7.8 Voting plan (P2) **[Board: Voting plan]**

- Stored on the device only: iOS `UserDefaults` keyed by election id, Android DataStore, web `localStorage`. Deleted automatically seven days after the election (the plan screen says the date).
- Sections: the timeline with the chosen day as a home-green band; "How will you vote?" radio cards (By mail, Drop box, In person) with the method-specific block (mail advice, three nearest drop boxes from voterInfo with distance and hours, the voting center); "When?" three choices derived from the calendar (the weekend it arrives, the week of the registration deadline, election weekend); "Your household" listing household members from the existing household service with "Send <name> the dates", which opens the share sheet with the deadlines text only; "Reminders" toggles; the privacy line "We never record how or whether you voted. This plan deletes itself on <date>."; "Save plan".
- Local notifications: "Your day" at 10 a.m. local on the chosen day; "Last call" is server-side (section 5.6).
- Funnel: `ballot_plan_saved` with the method only.

### 7.9 Share and compare (P0) **[Board: Share and compare cards]**

- Share button on `/start` and on the Place card: "Compare with a friend". Native uses the system share sheet with the web URL `/start?vs=<token>`; web copies the link or opens the OS share sheet.
- The friend lands on `/start` with a banner "<Name> in <city> sits inside N governments. How many does yours?" After lookup, the compare card shows both counts and the governments in common.

---

## 8. Visual system

Built on the Pantopus tokens (`tools/design-system/out/project/tokens.json`). No new tokens except the material mapping below.

| Material | Ink | Token | Face | Used for |
|---|---|---|---|---|
| Record | `#374151` | `app-text-strong` | system sans, tabular numbers | filings, offices, votes, money, dates |
| Their words | `#0369a1` (quote marks, glyph, overline) with body in `app-text` | `color-link` | serif | statements, answers, arguments, official posts |
| Judgment | `#b45309` ink, slip `#fffbeb` with `#fcd9a8` border, org name `#7c2d12` | `color-warm-amber` | system sans | listed endorsements, ratings |
| Place | `#15803d` on `#dcfce7` | `color-identity-home` | system sans | place charts, home pin, "for this home" |
| Clerk | `#6d28d9` on `#f5f3ff`, border `#ddd6fe` | `color-magic` | system sans | every AI-written line, the clerk button and sheet |
| Needs action | `#9a4a08` on `#fffbeb` | `color-warning` | system sans | registration and return deadlines only |

- **Serif by platform:** web `"Iowan Old Style", Charter, Georgia, serif` (the design system's serif stack); iOS `Font.system(.body, design: .serif)`; Android `FontFamily.Serif`. Serif is used only for candidate or official words, measure text and the headline on the share card.
- **Party:** 11.5–12pt `app-text-secondary`, never colored, never an icon.
- **Buttons:** primary fill `#0369a1` (`color-primary-700`, the accessible choice over `primary-600`), 44–50pt tall, radius 12.
- **Map lines:** selected 3pt ink with 7% ink fill; on ballot 1.5pt ink; nothing this year 1.2pt `#9ca3af` dashed; unselected on the strip map 1pt `#94a3b8`; home pin `#15803d` with white ring; any other pin is dark.
- **Forbidden:** red fills, red and blue pairs, party icons, gradients on data, emoji.
- **Motion:** only the four moments in the table on **[Board: Visual system]**: peel (280 ms per layer, 120 ms stagger), fit a shape (450 ms ease-in-out), cross a line (180 ms cross-fade, 300 ms line flash), open a document (180 ms screen timing). Reduced motion turns all of them into 100 ms cross-fades.

---

## 9. Charts

Hand-built SVG on web (`W/components/ballot/charts/`) and native drawing on iOS and Android only for the timeline and the governments list (the other charts live on the public web page). No charting library. Every mark has a value on hover or tap and every chart has a text alternative. Values in these specs are the canvas samples.

### 9.1 Decisions by government
Horizontal bars, one row per government in stack order. Bar: `record` ink, 14pt tall, value × 30pt wide, right end rounded 4pt, baseline square. Value label at the bar end. Zero: a hollow 10pt square and "none this year" in muted text; never drop the row. Used on the overview and the ballot header (P1).

### 9.2 Deadline timeline
Width = container; line from today to Election Day, 3pt, `#e5e7eb`, with the elapsed portion `#9ca3af`. Scale: real days. Markers: today (5pt home-green dot, label below "Today" and the date), ballots mailed (5pt ink dot, label above), register-by (5pt warning dot, warning label below), Election Day (6pt ink dot with white ring, label above, right-aligned). Labels alternate above and below; if two labels would overlap horizontally (less than 70pt apart), the later one moves to the other side. With a plan, a home-green band marks the chosen day or range.

### 9.3 Money as small multiples (P3)
One chart per candidate, same y scale (round the max up to a clean step), quarters on x, single ink, rounded top 4pt, square base, value label on the latest bar only, "not filed" text in quarters before candidacy. Header per chart: "Raised $X · Cash on hand $Y". Source line with the report-through date and next due date. Source mix as a four-row table with single-ink bars and percentages, and "Totals only. We do not name donors or suggest what a gift means."

### 9.4 Place dot plot
Three rows: the contest geography (home-green dot, bold label), the state and the U.S. (grey dots). Track 2pt `#e5e7eb`; dots 14pt with a 2pt surface ring; values right-aligned in tabular numbers; min and max axis labels under the track. Title is the indicator's plain name; source line with vintage. No sentence interprets it.

### 9.5 Votes on one topic (P3)
List form on phones: a "Yea" chip filled with record ink or a "Nay" chip outlined in record ink, then bill number and short title, then date and result with tally. Strip form on wide screens: 22pt squares, filled for yes, outlined for no, a short dash for not voting, oldest to newest, with a legend. Never green and red. Each item links to the roll call. Challengers: "<Name> has no voting record, which is not a mark against <them>."

### 9.6 Levy for this home (P2)
Formula row of three tiles (rate, assessed value, result in the home-green tile), then "What the $N million pays for" as a single stacked bar with 2pt gaps, three lightness steps of record ink (`#374151`, `#6b7280`, `#9ca3af`) and a legend with amounts, then the estimate note. Never render the cost tile without the breakdown or purpose text.

**Never drawn:** red and blue district fills, ideology axes, polls, odds, gauges, "momentum", match scores, donor lists styled as scandal, countdowns nobody asked for.

---

## 10. Copy

Sentence case everywhere. No exclamation marks. No emoji. Past tense for confirmations ("Plan saved"). Say what failed and what to do. Key strings:

| Where | String |
|---|---|
| `/start` | "Your address sits inside N governments." / "N decide something on <Month day>" / "N have nothing to decide until <year>" / "This address" |
| `/start` minimum | "Your address sits inside at least N governments." |
| Place card title | "Your ballot" |
| Peel final | "You are standing in N governments." / "Six of them put 13 decisions on your ballot." (numbers from the packet) |
| Strip header | "N decisions" / "In the order they are printed on your ballot" |
| Not live yet | "Your full ballot appears here when the county publishes it, usually about four weeks before the election." |
| Did not respond | "Did not respond" / "No answer was filed by <date>. We leave this space empty rather than write one for them." |
| Nothing filed | "This office is decided inside this line." |
| Looking | "Looking" / "Not your ballot. Your home stays under Place." / "What this ground decides" |
| Clerk scope | "Answers only from the N documents on the race page, with a receipt for every sentence." |
| Clerk decline | "That choice is yours, and I don't rank candidates. I can put their answers side by side on any topic, or show what's on the record for each of them." |
| Plain language tag | "Rewritten by the clerk, not the law" / "This rewrite can be wrong. The official text above is what you vote on." |
| Plan privacy | "We never record how or whether you voted. This plan deletes itself on <date>." |
| Share card | "My address sits inside N governments." / "How many does yours?" |
| Compare | "Two addresses, N governments in common." |
| Error | "We couldn't load your ballot. Try again." |

---

## 11. Edge cases

| Case | Behavior |
|---|---|
| Home exactly on a district line | Use the geocoder's answer for the rooftop point. Show "Lines near your home" on the strip map. Never guess between two districts. |
| Split precincts | voterInfo decides contests for the address. The governments list may include a district whose contest voterInfo omits; mark it `on_ballot: false`. |
| No election in 120 days | "Nothing scheduled" state; no pushes. |
| Two elections close together (special plus general) | The packet carries the next one; the card shows "Also: <date> special election" as a link. |
| Primary with party ballots | Show contests as voterInfo returns them with the ballot's own party headings; never pick a party for the user. |
| Top-two or top-four primaries | Show the state's own label ("Top two advance"). |
| Ranked-choice contests (for example Alaska, Maine, New York City) | Show "Ranked choice: rank up to N" from the state sheet and a link to the official explanation. No simulations. |
| Runoffs | New election id; new card when the county publishes it. |
| States without all-mail voting | `voting_method` drives the how-it-works text and the plan choices; polling place from voterInfo when live. |
| Military and overseas voters | Link to FVAP from the official links row when the state sheet flags it. |
| Unopposed contests | Show "1 candidate, unopposed". Keep the row; no question room. |
| Write-in only contests | "No candidates filed. Write-in only." |
| voterInfo down during the season | Serve stale with the as-of time; after 6 hours stale, the strip shows "Couldn't refresh your ballot. Last updated <time>." |
| Document corrected after publication | Page shows "Corrected on <date>" and the new text; the clerk reads only the current text. |
| Candidate withdraws after ballots print | Keep them on the strip with "Withdrew on <date>" from an official source; never remove what is printed. |
| Home not verified (T1 saved place) | P0 card works from the saved place's state and coordinates. voterInfo (P1) needs an address, so T1 users see governments and deadlines and "Claim your place to see your full ballot." |
| Renter | Levy block shows the owners-pay line. |
| Outside the U.S. or in a territory | Hide Ballot. Territories are out of scope. |

---

## 12. Privacy, neutrality and legal

1. **Collected:** nothing new about the user except funnel events (section 5.17) and the plan on their device. No party, no vote history, no "who you support", no questionnaire to the user.
2. **Addresses:** voterInfo receives the home address only for signed-in homes, from the server, never logged; `/start` uses coordinates only.
3. **The clerk:** no conversation text stored; token counts only.
4. **Disclosure:** every AI-written line carries the clerk color and label. The clerk never speaks in a candidate's voice.
5. **Corrections:** "Report a mistake" on every card and page. Target: fix or answer a date or deadline report within 24 hours in season, other reports within 72 hours. Corrections are visible on the page.
6. **Neutrality review:** before each election in a new state, a second person checks ordering, party labels, empty states and that every candidate got the same questions and the same space.
7. **Official sources first:** every deadline and link cites the state or county. Where a state is not curated, link to vote.gov rather than guess.
8. **No political advertising:** no sponsored placements, no promoted candidates, no campaign accounts on Ballot surfaces.
9. **Escalate to the founder:** any request to add endorsements beyond what candidates list, any paid data contract, any change to what is collected, any legal notice from an election office.

---

## 13. Metrics

| Metric | Source | Target |
|---|---|---|
| Addresses typed from a ballot entry point | `ballot_teaser_viewed` with a new anon id | growth week over week in season |
| Place card views per active home in season | `ballot_card_viewed` | 60% of weekly active homes |
| Visitors who open at least one contest | `ballot_contest_opened` / `ballot_card_viewed` | 50% |
| Official link clicks | `ballot_official_link_clicked` | tracked, no target |
| Compares per share | `ballot_compare_viewed` / `ballot_share_clicked` | 0.3 or more |
| Plans saved per activated home | `ballot_plan_saved` | 30% |
| Week-four return of users acquired through Ballot vs others | existing funnel | equal or better |

Never measured: turnout, who anyone voted for, whether anyone voted.

---

## 14. Verification

Per the founder's direction, proof is end to end on the iOS simulator, the Android emulator and the web against a disposable backend with fixture data. Unit tests are optional. Fixtures use the canvas's fictional Fernbrook data and a fictional election id; they never ship to users.

**Fixtures.** Add `ballot-*.json` beside the existing Place fixtures: iOS `PantopusTests/.../intelligence-*.json` and the `UITestStubProtocol` stubs, Android `app/src/test/resources/place/`, web `tests/__mocks__/@pantopus/api.ts`. For live runs, load the fictional election rows and documents into the disposable project with the ingest script.

**P0 journeys (all three platforms unless noted).**
1. Web `/start`: type an address in a seeded state; the teaser shows the count and the next deadline; `ballot_teaser_viewed` is recorded without an address; "Compare with a friend" produces a link; opening it in a private window shows the sharer's city and count and, after a lookup, the in-common view.
2. Place: a verified home shows the "Your ballot" card in season with the timeline, how-it-works text and three official links that open the official sites.
3. States: switch the fixture clock to each state in section 7.2 and confirm the card.
4. Pushes: with the clock on Oct 16 the morning briefing push is "Your ballot is in the mail"; with a moved-in date inside 12 months and the clock on Oct 19 the registration push appears; tapping each lands on the ballot card.
5. Flag off: with `ballot_p0` off for the user, no Ballot fields arrive and no card renders; the calendar still lists the rows.

**P1 journeys.** The animated peel with and without reduced motion; the strip selecting each contest and the map fitting its shape; opening a race and a measure in the in-app browser; Nearby looking across a school district line updating the list; voterInfo unavailable shows the "not live yet" state.

**P2 journeys.** Question room topic switching with a "Did not respond" card; place chart follows the topic; levy block for an owner and the owners-pay line for a renter; the plan saved, its local notification fires on the fixture day, and the plan is gone after the deletion date; the clerk returns quoted lines, declines "who should I vote for", and refuses a date question with the official link; a report is filed and appears for the reviewer.

**Acceptance for every phase.** No red or blue fills; party labels exactly as printed; printed order preserved; every shown fact has a source and as-of; empty states render as designed; screen reader reads the glyph labels and chart alternatives; no personal data in any public URL or page.

---

## 15. Build order

Each item is one reviewable PR unless noted. Check them off in `NEXT_STEPS.md` when the founder adds this track there.

**P0**
1. State sheet `backend/data/ballot/states.json` for Washington (full) and all states (Election Day, voting method, official links; vote.gov fallbacks). Script `scripts/ballot/seed-deadlines.js`.
2. Migration M1 (funnel events) and M2 (election rows).
3. Backend: `services/ballot/governments.js`, `deadlines.js`, `packet.js` summary; extend `composeCivicElection` data; server-side flag gating; usefulness engine election branch; `/api/public/place` teaser; compare token and `GET /api/ballot/compare/:token`.
4. Web: types, Place card, `/start` teaser, share image variant, compare view, Today line.
5. iOS: DTOs, Place card, Today line, deep links, push routing.
6. Android: DTOs, Place card, Today line, deep links, push routing.
7. "You moved" card on all three.
8. P0 journeys on all three platforms; record evidence in the existing acceptance catalog.

**P1**
9. TIGERweb layer ids pinned; `shapes.js` with simplification and peel geometry.
10. Migration M3 (`ElectionDocument`); `scripts/ballot/ingest.js`.
11. `contests.js` (voterInfo), printed order tables for WA and OR, `glyph.js`, full packet and routes.
12. Web public contest page (structure, empty states, candidate cards, measure document) and the strip and map on web.
13. iOS and Android: animated peel, strip and map, contest entry through the in-app browser.
14. Nearby looking mode on all three.
15. P1 journeys.

**P2**
16. Special districts for the test-market county.
17. Document ingestion for the test market's primary and general elections (per election, ongoing).
18. Place charts, levy for this home, question room interactions, judgment slips.
19. Voting plan with local notifications on all three (adds `androidx.work`).
20. Clerk for measures (plain language) behind `ballot_clerk`; evening "Last call" job; migration M4 and "Report a mistake".
21. P2 journeys; neutrality review before the Aug 3, 2027 primary.

**P3**
22. Federal record and money; clerk for candidate races; more states' pamphlets; Democracy Works integration for deadlines; official translations; P3 journeys.

---

## 16. Open decisions and the defaults this guide builds

| Decision | Default until the founder decides |
|---|---|
| Ship P0 for November 3, 2026 | Yes, behind `ballot_p0`, seeded metro first |
| Contest pages as a public web page opened in the in-app browser, or fully native | Public web page (section 7.1 explains why) |
| Show the levy cost for this home | Yes, with the breakdown rule |
| Show bar ratings and listed endorsements | Yes, as judgment slips, only when published or listed |
| Talk to Democracy Works now | Yes, a conversation; no contract before P3 |
| Public name | "Your ballot", inside Pantopus |
| Mail Day ballot envelope rule in P0 | Only if Mail Day already supports sender rules; otherwise P1 |

---

## Appendix A. Canvas boards and where they are specified

| Board | Section |
|---|---|
| Overview and the peel | 1, 7.3 |
| Journey and where it lives | 1, 7.6 |
| Web lookup: 9 governments | 5.8, 7.9 |
| The peel (animated) | 7.3 |
| Place: Your ballot card | 7.2, 9.2 |
| Ballot strip and map | 7.4, 5.5 |
| Race: question room | 7.5, 9.4 |
| Federal race: record and money | 5.11, 9.3, 9.5 |
| Measure as a document | 7.5, 5.13, 9.6 |
| The clerk | 5.14, 7.5 |
| Nothing filed | 7.5, 5.5 |
| Voting plan | 7.8 |
| Today in ballot week | 7.6 |
| The only pushes | 5.6, 7.6 |
| Nearby: crossing a line | 7.7 |
| Share and compare cards | 5.9, 7.9 |
| Visual system | 8 |
| Chart catalog | 9 |
| Architecture | 3, 5 |
| Build plan | 2, 15, 16 |

## Appendix B. Washington, November 3, 2026

| Deadline | Date | Rule |
|---|---|---|
| Ballots mailed | Friday, October 16 | At least 18 days before the election (RCW 29A.40.070) |
| Register online or by mail | Monday, October 26 | Received 8 days before the election (RCW 29A.08.140) |
| Register in person | Through 8 p.m. Tuesday, November 3 | County elections office or voting center |
| Return | 8 p.m. Tuesday, November 3 | Drop box by 8 p.m., or mail postmarked by Election Day |

Confirm each against the Secretary of State's 2026 calendar when writing M2 and cite the page in `source_url`.

## Appendix C. Terms

- **OCD id:** Open Civic Data division id, for example `ocd-division/country:us/state:wa/sldl:18`. Google Civic uses it for districts and elections.
- **GEOID:** the Census identifier for a geography (state 2 digits, county 5, place 7, school district 7, and so on).
- **voterInfo:** Google Civic's per-address ballot and polling lookup, live only when the Voting Information Project has the election.
- **Packet:** the one JSON object the server builds per home and election (section 5.2).
- **Glyph:** the four-part mark showing which kinds of documents are on file for a contest.

## Appendix D. Research review and proposed amendments — September 23

The founder requested a researched critique of usefulness, sign-up value and risks. The [full review](ballot-product-review-2026-09-23.md) contains the evidence, source links, code observations, experiment design and verification limits. These are proposals for a founder decision, not additional build authorization. Original sections above have not been silently rewritten.

**Product direction proposed:** test a smaller official-election-information panel in a named pilot jurisdiction, with clearly labeled official-link fallback elsewhere. The available research supports an information need, but does not establish incremental Pantopus sign-ups or post-election retention. Keep the existing Place/Today navigation and verify the save-place-to-everyday-utility journey before expanding the acquisition surface. Separate P1–P3 investment from the November experiment.

**Amend before implementation:**

1. **Define coverage honestly.** Separate unsupported, unpublished, partial, stale, failed and verified-empty data. Missing data cannot become “nothing scheduled,” “none this year,” or `on_ballot: false`. Replace the assumed four-week provider publication promise with source-specific availability.
2. **Correct identity and order contracts.** Google's contest district ID is relative to scope, not necessarily an OCD ID. Separate internal/provider election IDs, consume candidate ordering fields, preserve provenance and never call generic fallback ordering the exact printed ballot.
3. **Version geography.** Verify election-applicable boundaries instead of pinning 119th congressional maps. The inspected adapter uses geohash-6, not the source table's geohash-7, and does not retain the complete proposed government identity set. Exact-address membership requires a stronger contract. Preserve canonical map geometry separately from decorative peel geometry.
4. **Qualify the count.** Do not make the government count exact merely because county taxing layers were loaded. Establish government versus geographic-area identity, township coverage, school-system status and typed GEOID uniqueness.
5. **Repair deadline semantics.** County-specific titles at state scope are not a safe workaround for calendar precedence. Use explicit event identity and genuine scope. Preserve local timezone, voting method and received/postmarked cutoff semantics. Remove nationwide 8 p.m. assumptions.
6. **Resolve notification contradictions.** “All opt-in” conflicts with the default-on preference. The proposed P0 schedule lists five potential notifications before the mover reminder. Specify one consent and delivery-budget contract, semantic deduplication, quiet hours, changed-date cancellation and a complete disable path including calendar exposure.
7. **Remove unsupported personal claims.** `HomeOccupancy.start_at` is set when occupancy is attached; it does not prove a physical move. A county mailing schedule or sender match does not prove that a particular user's ballot was mailed or will arrive today.
8. **Separate missing content from non-response.** “Did not respond,” “no prior elected office” and “no endorsements” require affirmative source evidence. A hollow glyph describes Pantopus's collection. Corrected documents need atomic publication and cache invalidation; prompt/language identities need to survive ingestion.
9. **Reduce the initial surface area.** Defer compare tokens, animation, arbitrary-pin contest lookup, finance charts, personal levy estimates and the clerk while the simple service is tested. Keep official information accessible without a residence claim, and make saving/reminders optional follow-up actions.
10. **Tighten privacy and AI claims.** Signed tokens do not conceal district combinations; home-keyed caches do not redact payloads; local plans need account/home isolation and truthful expiration. Exact quote matching does not validate the generated interpretation. The full review identifies the relevant boundaries without claiming a reproduced production breach.
11. **Measure product value separately from civic usefulness.** Use incremental saved-place accounts and later non-election use, plus operating cost and accuracy/notification guardrails. Treat the original numerical engagement targets as unvalidated hypotheses. Include a post-election observation window.
12. **Add real-source acceptance.** Fictional fixtures do not prove national coverage, official ballot matching or provider/device delivery. Name a source-maintenance owner and incident backup; validate the pilot's actual data and the existing end-to-end callers before release. Reuse the current acceptance catalog.

**Mockup limit:** all 20 bundled board templates were read, including their authored content. Browser security blocked local HTML rendering, so visual layout and interactive behavior were not verified. Screenshots would enable a separate visual review.
