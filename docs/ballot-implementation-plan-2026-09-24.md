# Ballot: implementation plan

September 24, 2026. The founder asked for a plan, design where needed, and a build on branch `claude/blissful-dijkstra-n8r31h`, with every screen matching the [Pantopus Ballot canvas](https://claude.ai/artifact/KCuXBiAYYaX13gpoqUCdmq) exactly. This plan turns the [build guide](ballot-build-guide-2026-09-23.md) into something buildable. It folds in the [review](ballot-product-review-2026-09-23.md), the founder's accepted corrections (September 24) and a code check of every contract the guide relies on. Where this plan and the guide disagree, this plan wins. The canvas still wins on appearance.

Nothing here enables Ballot for users. Every surface ships behind the `ballot_p0` flag, which starts off. Section 11 lists what the founder still has to approve.

---

## 1. The decision in one paragraph

Build the corrected thin layer (P0) first. Pilot it in Washington, using the state's uniform general-election calendar and Clark County's links, since Camas is the seeded metro. Everywhere else, show the election date with an official link. Treat P0 as the October edition of the first-person loop, not a separate track. NEXT_STEPS already plans the October voter-registration headline, the `election_deadline` seeds, the voter step in `JustMovedCard` and the compare token. Those are the P0 items under other names, so they get built once. The loop's save → Today bridge (F1) is also unbuilt: `resolveLocation` never reads `SavedPlace`. Until it exists, a visitor who saves a place from a ballot lookup lands on an empty Today. F1 is therefore a prerequisite for measuring Ballot's acquisition value, not an optional extra. P1–P3 follow only on the evidence gates in section 4.

## 2. What the checks changed

Each row is verified against code on master `6688fd84` (September 24), or against the cited official source.

| Guide or canvas said | What is true | What this plan does |
|---|---|---|
| District answers cached per geohash-7 (~150 m) | `composeCivicDistricts` keys `geo:<geohash-6>`, a cell of about 1.2 × 0.6 km, shared by every home and the anonymous preview for 90 days (`placeSectionAdapters.js:806-810`). It keeps display rows and three legislative codes, and no GEOIDs. | Ballot never reads that row. Saved homes: an exact-point geocoder call cached as `home:<homeId>:<geohash-9>` (30 days, 7-day stale limit), so an address change makes a new key. Anonymous: a live call that writes nothing. |
| `readThrough` serves stale data safely | It serves any expired row on fetch failure with no age limit, so in practice up to about 120 days (`placeSectionCache.js:124-131`). | Add an optional `maxStaleMs` to `readThrough`. Existing callers are unchanged. |
| 119th Congress districts | November 2026 fills the 120th Congress, and several states redrew their maps. | P0 draws no real boundaries. P1 pins layer ids and vintage from the TIGERweb service directory at build time and records which election each vintage applies to. |
| Google `district.id` is an OCD id; keep candidates in returned order | `district.id` is relative to its scope. Candidates carry `orderOnBallot`. | P1 keeps internal election ids separate from provider ids, uses `orderOnBallot`, and labels order "not verified" when the field is absent. |
| Ballot data arrives about four weeks out | The Voting Information Project says usually two to three weeks. | Copy says "when the county publishes it" and gives no week count. |
| `HomeOccupancy.start_at` means a move | `_createOccupancy` writes `start_at: now` when the membership is created (`occupancyAttachService.js:582`). | Use `Home.move_in_date`. The user enters it on web, and the native "Just moved" toggle stamps today. `JustMovedCard` already reads it on all three clients. Copy stays conditional ("Moved this year?"). |
| Unknown can render as "nothing this year" | The guide's P0 rules drew unknown governments as `on_ballot: false`. | `on_ballot` has three states: true, false (verified empty) and null (unknown). Coverage has its own states (section 5.2). The dashed "nothing this year" style needs a verified-empty source. |
| Three opt-in pushes | The guide listed five dates, plus a toggle on by default. Election rows would score 0.34 and still pass the push gate under general briefing consent (`usefulnessEngine.js:304`, `providerOrchestrator.js:91-92`). | No pushes in P0. P0.5 adds one explicit opt-in with at most three pushes per user per election (section 4). |
| County deadline as a state-scoped row with a county title | That would show one county's date statewide. County scope also never matches today, because `Home` has no `county` column, and the timezone is always Los Angeles (`addressCalendarService.js:39-55`). | P0 keeps election facts in versioned reference data with event identity, method and timezone. It adds no `AddressCalendarRule` rows. |
| Unverified rows get the pickup "Unconfirmed" suffix | Any `confidence: 'unverified'` row gets "(Unconfirmed — set your pickup day…)" (`usefulnessEngine.js:313`). | P0.5 limits that suffix to pickup kinds before any election signal exists. |
| Quote matching validates the clerk | It proves the words exist, not that a summary of them is fair. | P2 measure summaries are written ahead, checked by a person against the official text, and published as labeled documents. There is no live generation. |
| Mail Day flags the ballot envelope | Mail Day has no sender rules for physical mail. The scan buttons are no-ops (`MailDayViewModel.swift:54`, `RootTabScreen.kt:5815`), and the web has none. | The "Mail Day spotted an envelope" line is removed, not reworded. |
| Ballot lookup drives sign-ups | VOTE411 and Ballotpedia already look up ballots by address. Pew shows a need (45% vs 59%), not a reason to install Pantopus. | Measure incremental saved places, plus later non-election use, against a concurrent control (section 9). |

## 3. How screens match the canvas

The founder's rule: every screen follows the canvas exactly. The guide's rule: the canvas wins on appearance, and behavior must be true. Both hold under these rules:

1. **Appearance is copied exactly.** That covers frame, spacing, type size and weight, color, radius, shadow, icon geometry, chart geometry and motion timing, all measured from the board's markup. Web uses the same px values. iOS uses the same numbers in pt, and Android in dp and sp. Colors use the design-system token that holds the same value (section 6.1).
2. **Copy is the canvas copy whenever the data behind it exists for this address.**
3. **When the data does not exist, the element is left out, not reworded.** Examples: the decisions count, the "nothing this year" legend, "Make a voting plan" before P2.
4. **When leaving an element out changes a screen's meaning, the replacement is drawn on the canvas first,** in the canvas style, on a "Proposed" board for founder approval. The build follows the proposal behind the off flag, and release waits for approval.
5. **Fictional canvas content never ships.** Fernbrook, Alder County and every candidate, statement and number stay in tests and in the dev-only preview route (`/dev/ballot`, a 404 in production).

## 4. Phases and gates

| Phase | Ships | Gate to start | Gate to release |
|---|---|---|---|
| **P0 (now)** | Place "Your ballot" card; the governments view with the peel story; the /start teaser; Today ballot card and deadline line; "Moved this year?" line | This plan | Founder approves the section 11 items; release checks in section 10 pass; `ballot_p0` enabled for internal users, then the pilot |
| **P0.5 (October)** | Election reminders: one opt-in, off by default, at most three per user per election, quiet hours, cancellation when a date changes. The share card (count and city only) through the existing OG route | P0 live internally; push copy approved | Delivery verified on devices; disable path verified |
| **F1 bridge (loop)** | Saving a place sets location for Today and the briefing | Already in NEXT_STEPS section 2 | Its own acceptance (loop design F1) |
| **P1** | The ballot packet; strip and map; public contest pages; the peel's "what it decides" captions and dashed empty layers; the glyph; Nearby looking | Real voterInfo coverage checked for Washington addresses against official sample ballots | Order, labels and empty states reviewed; boundary vintages verified |
| **P2** | Reading room for the Washington and Oregon pamphlets; place charts; levy (rate only until validated); device-only plan; clerk for retrieval, plus pre-published plain-language documents | P0/P1 retained-use evidence (section 9) | Neutrality review, correction workflow, source rights cleared |
| **P3** | Federal record and money, more states, a data partner for deadlines, translations | P2 evidence plus a partnership decision | Per-source methodology documented |

The canvas's Build plan board shows this same order. Only the gates are new.

## 5. P0 contracts

### 5.1 Reference data (versioned, reviewed, no table)

- **`backend/data/ballot/states.json`** holds, per state, the name, `coverage` (`supported` | `links_only`), timezone, and the official links with owner, label and URL. Every state that isn't supported gets vote.gov as its official link. Territories are absent, so Ballot hides for them.
- **`backend/data/ballot/elections.json`** holds one entry per election. `2026-11-03-general` is the federal general election in every state (2 U.S.C. § 7). For each supported state it also holds dates like these Washington ones (the other states are in section 5.1.1):

| Key | Date | Cutoff | Needs action | Source |
|---|---|---|---|---|
| `ballots_mailed` | 2026-10-16 | mailed by | no | RCW 29A.40.070; WA SOS 2026 dates |
| `register_online_mail` | 2026-10-26 | received by | yes | RCW 29A.08.140; WA SOS 2026 dates |
| `register_in_person` | 2026-11-03, 8 p.m. | in person by | yes (detail line only) | RCW 29A.08.140 |
| `return_by` | 2026-11-03, 8 p.m. | drop box by 8 p.m.; mail postmarked by Election Day | yes | RCW 29A.40.091 |

Each deadline carries `key`, `label`, `date`, `time_local`, `timezone`, `cutoff`, `methods`, `needs_action`, `detail`, `source` and `source_url`. Each state block carries `checked_at` and `checked_by`. A loader validates both files at boot and in tests. Display titles are never identifiers.

A state block can also carry wording that a single template can't get right for every state, all optional and validated:

- `far_note` replaces "Registration deadline: <date>, online or by mail."
- `mover_text` replaces the "Moved this year?" sentence. `null` turns the line off where one deadline can't be stated simply (Hawaii's online registration never closes).
- `ballot_week.title_before` and `title_after` replace "Ballots go out by <date>" and "Ballots were mailed by <date>" for states that mail starting a date.
- `no_registration_deadline: true` replaces the required `register_online_mail` in a state that registers people any day (Vermont).

A state entry can carry `election_office_phrase` ("the Oregon Secretary of State") for the after-election sentence. A `polling_places` link shows on Election Day, after drop boxes.

Verification limit: this build environment's egress policy blocks sos.wa.gov, vote.gov, clark.wa.gov and the Census geocoder. The dates above match the review's reading of the SOS page (September 23), the RCW text, and SOS pages found by search on September 24. Release check 1 is a person opening every source URL and link in both files.

#### 5.1.1 The all-mail states (added September 24)

The founder asked for the states that mail every active voter a ballot. They reuse Washington's card, timeline and copy shape; only the data differs. No county links yet.

| State | Ballots mailed | Register (to get a mail ballot) | Return | Main sources |
|---|---|---|---|---|
| California | starting Oct 5 | Oct 19, online or postmarked; then in person through Election Day | drop box or vote center by 8 p.m.; mail postmarked Nov 3, received by Nov 10 | SOS 2026 quick facts and key dates |
| Colorado | Oct 2 to 9 | Oct 26; then register and vote in person | received by 7 p.m.; postmarks don't count | SOS press releases, Sep 14 and Sep 23, 2026 |
| Hawaii | arriving from Oct 16 | paper forms Oct 26; online and at voter service centers through Election Day | received by 7 p.m. | Office of Elections pages |
| Nevada | by Oct 14 (20 days before) | online by Oct 20; then in person when voting | drop box or polling place by 7 p.m.; mail postmarked Nov 3, received by Nov 7 | SOS 2026 election information and FAQ |
| Oregon | starting Oct 14 | Oct 13, online or postmarked | drop box by 8 p.m.; mail postmarked Nov 3, received by Nov 10 | SOS pages; Linn, Josephine and Clackamas county 2026 pages |
| Utah | Oct 13 | Oct 23; then register when voting in person | received by 8 p.m.; postmarks don't count (H.B. 300, 2025); last four ID digits on the envelope from 2026 | 2026 Utah election calendar, vote.utah.gov |
| Vermont | starting Sep 25 | no deadline; register any day, even at the polls | town clerk by Nov 2, or the polling place by 7 p.m. Nov 3 | SOS pages and 2026 elections calendar |

The same limit applies, more so: none of these states' sites opens from this container, and WebFetch is blocked too. Every date and link came from search results citing the official page, a county page or the state's news release. They are marked "pending release check 1". Points to confirm first: Hawaii's online registration after Oct 26, Nevada's results site (results.nv.gov), Colorado's results link (the Secretary of State's home page, where the press release says the link will be posted), and California's results link (the elections page, because the election-night results site changes host each election).

**The USPS postmark rule.** Since December 24, 2025, USPS postmarks mail at regional plants, so a ballot dropped in a mailbox on Election Day can get a later postmark and be rejected. Washington's February 2026 special election rejected 1.3% of returned ballots for late postmarks, 75% of all rejections, and the Secretary of State now tells voters to use a drop box or get a hand postmark at a post office counter. Washington's copy changed on September 24 to match ("mail it a week early so the postmark is on time"; on Election Day, "get it postmarked at a post office counter today"). The postmark states (California, Nevada, Oregon and Washington) use the same wording. The received-by states say "postmarks don't count".

### 5.2 The `civic_election` section, extended (P0 adds no new section id)

When `ballot_p0` is on for the user, `composeCivicElection` keeps `name`, `date`, `days_until`, `polling_place: null` and `ballot: []`. It adds these optional fields:

```json
{
  "election_id": "2026-11-03-general",
  "coverage": "supported",
  "phase": "in_season",
  "state": "WA",
  "voting_method": "all_mail",
  "how_it_works": "Everyone here votes by mail. Your ballot is mailed by Oct 16. Return it in a drop box by 8 p.m. Nov 3, or mail it a week early so the postmark is on time.",
  "deadlines": [{ "key": "ballots_mailed", "label": "Ballots mailed", "date": "2026-10-16", "days_until": 22, "needs_action": false, "source": "…", "source_url": "…" }],
  "official_links": [{ "key": "registration", "label": "Check or update registration", "owner": "Secretary of State", "url": "…" }],
  "governments": { "count": 5, "count_is_minimum": true, "items": [{ "level": "county", "geoid": "53011", "name": "Clark County", "on_ballot": null }] },
  "source_line": "Washington Secretary of State",
  "checked_at": "2026-09-24"
}
```

- `coverage` is `supported` (verified dates and links), `links_only` (election date and official links only), or absent (flag off: today's behavior). A provider failure never turns into "no election".
- `phase` is `far` (61–120 days out), `in_season` (60 days out to the day before), `election_day`, `after` (through certification where the dates are checked, else days 1–7 after; `after_stage` is `counting` or `certified`), or `hidden`. It is computed in the state's timezone from the local date. The phase decides layout only.
- `governments` appears for supported states only. It holds typed ids from the exact-point geocoder: United States, the state, the county, an incorporated place, and a school district (unified, or elementary plus secondary). Items are deduplicated by `level:geoid`. `count_is_minimum` is always true in P0, because special districts are not integrated. `on_ballot` is `true` only for the United States (every U.S. House seat is up in 2026) and `null` for the rest.
- Old clients ignore the new fields, and the existing "Next election" row keeps working.

### 5.3 `/api/public/place` → `ballot_teaser`

This is added only when `ballot_p0` is enabled globally. It is computed inside the preview's existing time budget, and on timeout it is `null`.

```json
{ "coverage": "supported", "election": { "name": "November 3 general election", "date": "2026-11-03", "days_until": 40 },
  "next_deadline": { "key": "register_online_mail", "label": "Register or update by Oct 26.", "days_until": 32, "detail": "In person through Election Day." },
  "governments": { "count": 5, "count_is_minimum": true, "items": [{ "level": "federal", "name": "United States" }] },
  "primary_link": { "label": "…", "url": "…" }, "source_line": "…" }
```

It uses coordinates only. The geocoder call is live and writes no cache row. The route keeps `Cache-Control: no-store`.

### 5.4 Flag and migration

`ballot_p0` gates everything on the server. A client renders only the fields it receives. The web `/start` teaser follows the flag's global setting, because `useFeatureFlag` needs a signed-in user. There is one data migration, which inserts the `FeatureFlag` row with every switch off. It is needed because the admin route can only update an existing flag (`featureFlags.js:51-63`). P0 has no other migration and no new table. Funnel events wait for P0.5, which widens the CHECK constraint once for Ballot and the loop's events together.

## 6. P0 surfaces, measured from the canvas

### 6.1 Tokens (the canvas hex values and the design-system names that hold them)

| Canvas | Web (Tailwind) | iOS | Android |
|---|---|---|---|
| `#0369a1` action and link | `primary-700` / `text-app-link` | `Color.primary700` | `PantopusColors.primary700` |
| `#15803d` on `#dcfce7` home | `text-app-home` / `bg-app-home-bg` | `home` / `homeBg` | `home` / `homeBg` |
| `#111827` text | `text-app-text` | `appText` | `appText` |
| `#374151` body | `text-app-text-strong` | `appTextStrong` | `appTextStrong` |
| `#4e5563` secondary | `text-app-text-secondary` | `appTextSecondary` | `appTextSecondary` |
| `#5f6775` muted | `text-app-text-muted` | `appTextMuted` | `appTextMuted` |
| `#e5e7eb` border | `border-app-border` | `appBorder` | `appBorder` |
| `#9a4a08` on `#fffbeb` needs action | `text-app-warning` / `bg-app-warning-bg` | `warning` / `warningBg` | `warning` / `warningBg` |
| `#f3f4f6` sunken well | `bg-app-surface-sunken` | `appSurfaceSunken` | `appSurfaceSunken` |
| `#eef1f5` stack base (illustration) | `fill-[#eef1f5]` | `ballotStackBase` (new) | `ballotStackBase` (new) |
| `#9ca3af` "waiting for ballots" segment (illustration) | `stroke-[#9ca3af]` | `ballotWait` (new) | `ballotWait` (new) |

The builder confirms each name against the token files before use: `globals.css`, `Colors.swift` together with `ColorTokenTests.swift`, and `Color.kt`. Android CI rejects hex literals under `ui/screens`. iOS `verify-tokens.sh` rejects hex literals and on-scale spacing and radius literals.

### 6.2 Place: "Your ballot" card ([Board: Place: Your ballot card])

- **Placement.** A "This season" overline (11/16, 600, 0.08em tracking, uppercase, secondary) 16 above the card, level with its left edge. It sits before the first group, after the hero card. The existing screen keeps its order otherwise. The civic group then skips `civic_election`, so the election does not appear twice.
- **Frame.** White surface, 1px border, radius 20, padding 16, shadow `0 1px 3px rgba(0,0,0,0.04)`, 14 between rows. This is the existing section-card frame on web. iOS and Android place cards use radius 16 today, and this card uses the canvas's 20. Native insets content by 17 (the border plus the padding, as the CSS box does), so rows are 324 wide on a 390 screen; the 326-wide timeline overflows by 2 on the trailing side, as on the board.
- **Header.**
  - A 34 icon tile, radius 9, home-green. It holds the canvas's ballot-box glyph: three strokes, width 2, round caps, drawn at 19.
  - Title "Your ballot" 15/600. Subtitle "November 3 general election" 12.5, secondary.
  - A chip "N days": radius 999, `#f3f4f6`, 12/600, `#374151`, padding 3×9.
- **Line** (15/21, 500). The canvas reads "13 decisions from 6 of your 9 governments". In P0 there are no decisions, so the line reads "This address sits inside at least N governments." (proposed, section 11).
- **Timeline** (section 6.5), full width, 74 tall.
- **How it works** (13.5/19, `#374151`).
- **Primary button.** Height 44, radius 12, `#0369a1`, 15/600 white. The canvas label is "Open your ballot", which opens the ballot (P1). In P0 it reads "See your governments" and opens the governments view (section 6.4).
- **Official links well.** `#f3f4f6`, radius 14. Each row has padding 12, a 1px `#e5e7eb` divider, title 14/500, owner 12 secondary, and a 16 external-link icon. The canvas's "Make a voting plan" row is P2.
- **Source line** (12/16 muted): "<source> · as of <time>".
- **Compact states** (`far`, `links_only`, `election_day`, `after`) are drawn on the proposal board before they are built.

### 6.3 /start teaser ([Board: Web lookup])

The teaser is a card under the aha card (guide 5.8). The frame matches the Place card, with padding 18×16 and a 14 gap. It holds:

- The overline "On record for this address" in green (11/16, 600, 0.07em tracking).
- An h1 at 24/30, 700, −0.015em.
- The stack SVG (196×168, section 6.4 geometry, scale 0.45, gap 14, stroke 1.25) beside the legend column (13/18, gap 12).
- The needs-action well: `#fffbeb` / `#9a4a08`, radius 14, padding 10×12, an 18 calendar icon, 13.5/19 text with the lead sentence at 600. The icon never shrinks. The canvas's flex row squeezed it to about 12 beside two lines of text, where it read as a bullet. Decided September 24: it stays 18 on every well (one text line tall, the size of the 16 link icons and 19 glyph near it), and the boards now pin it too.
- A primary button 46 tall, then the source line (12.5/18 muted).

In P0:

- **H1.** "Your address sits inside at least N governments."
- **Legend.** Lists the governments by name, with each row using the line sample, then "This address" with its dot. The "decide something" and "nothing until" lines are left out (rule 3).
- **Decisions line.** Left out.
- **Primary action.** "See your governments" opens the governments view. "Compare with a friend" waits for P0.5.
- **Other states.** The links-only teaser is proposed on the canvas.

### 6.4 The stack and the governments view ([Boards: Overview, The peel, Web lookup])

The stack uses the canvas's nine decorative polygons exactly, taken from the Main board's `points`. Each layer is drawn as `translate(cx, baseY − i·gap) scale(S) scale(1, 0.5) rotate(45)`. Sizes:

| Surface | S | Gap | Stroke |
|---|---|---|---|
| Overview | 1 | 36 | 1.5 |
| Peel | 0.82 | 32 | 1.4 |
| Teaser | 0.45 | 14 | 1.25 |

Fills and marks:

- Layer 0 fills `#eef1f5`; the others fill white at 94% opacity.
- The home line is dashed home-green and ends in the home dot with a white ring.
- It shows `min(count, 9)` layers, widest first.

The P0 stroke is solid ink for every layer. The drawing makes no claim about who decides what, because no legend text says it does. The dashed style waits for a verified-empty status.

The governments view is the Peel board, story included ([Board: The peel]; proposed boards "P0: the peel, told" and "P0: governments view, finished frame"):

- A progress bar that fills across the whole story, and the address line with "Skip". "Skip" jumps to the finished frame, where it reads "Close".
- The stack. Each government in turn lifts 8 and takes the green highlight (`#dcfce7` fill, `#15803d` 3-wide stroke) for 1.2 s: in by 0.18 s with ease-out, held to 1.02 s, out by 1.2 s. These are the board's own timings (1.5%, 8.5% and 10% of its 12 s cycle).
- Its caption rises 8 into place and leaves 4 upward: the overline "Government k of at least N" (green, 11/600, 0.07em) and the name (24/30 bold). The board's third line says what each government decides this year. That needs contest data, so it waits for P1, and "at least" keeps the count honest.
- The finished frame: the overline "Your address" (green), then a serif 30/34 title "You are standing in at least N governments.", the governments listed by name at 15/22, and "Done" over the source line "Boundaries: Census Bureau · Special districts are not counted yet".

The board loops only because it is a prototype. The app plays the story once and holds the finished frame. Reduced motion starts on the finished frame.

### 6.5 Deadline timeline ([Chart catalog: Deadlines for the home address])

This is an SVG (web) or Canvas (native), container width × 74 on the card and × 96 in the catalog.

- **Axis.** The line runs from today to Election Day at real day spacing, from x=8 to x=width−8, 3 wide with round caps, `#e5e7eb`. The elapsed part is `#9ca3af`.
- **Markers.**

| Marker | Dot | Label |
|---|---|---|
| Today | r5, home green | Below, left-aligned at x−4: "Today" 11/600 green, then the date 11 secondary |
| Ballots mailed | r5 `#374151` | Above, centered: date 11/600 `#111827`, label 11 secondary |
| Register by | r5 `#9a4a08` | Below, centered: date in warning ink |
| Election Day | r6 `#111827` with a 2 white ring | Above, right-aligned at x+4: "Nov 3", then "By 8 p.m." |

- **Collisions.** Labels alternate above and below. A label less than 70 from a neighbor on the same side moves to the other side.
- **Past deadlines.** A deadline in the past drops off, and today's marker takes its place.
- **Accessibility.** Each chart has a text alternative listing every date.

The canvas's own numbers confirm the scale: September 23 → November 3 is 41 days over 310 px, and October 16 falls at x = 182.

### 6.6 Today ([Board: Today in ballot week])

The ballot card follows the weather block in the existing Today content, as the board puts the conditions first:

| Platform | Where it goes | Data |
|---|---|---|
| iOS | `PlaceTodayDetailContent` | The `civic_election` section already in the payload |
| Android | `PlaceTodayDetailContent` | The `civic_election` section already in the payload |
| Web | The hub Today page | `sections=civic_election` for the primary home |

**When it shows:** from the day before `ballots_mailed` through Election Day, plus any day within 7 days of a `needs_action` deadline.

**Frame:** the Place card frame. The header reads "Ballot week" (overline 11/600, 0.07em tracking, green) above a 15/600 title.

**Titles by date (proposed):**

| When | Title |
|---|---|
| Before the mailing date | "Ballots go out by Oct 16" |
| After it | "Ballots were mailed by Oct 16" |
| Election Day | "Election Day. Return by 8 p.m. today." |

The canvas title "Your ballot should arrive today" claims a delivery date Pantopus cannot know. The Mail Day line and the plan line are left out. The button "Open your ballot" is full width.

**"Open your ballot":** from the Today tab it switches to the Place tab; from the Place Today page it goes back to the dashboard it opened from. A surface that cannot reach the card leaves the button out.

**The warning well:** "Moved this year? Update your registration online by Oct 26. N days left." It uses `#fffbeb` / `#9a4a08`, radius 16, padding 12×14, and an 18 calendar icon. It shows when `Home.move_in_date` falls in the last 365 days and `register_online_mail` is still ahead. Tapping it opens the state's registration page. P0 has no per-device dismissal; the line ends when the deadline passes or the move is a year old.

### 6.7 Files

| Surface | Web | iOS | Android |
|---|---|---|---|
| Types / DTOs | `P/types/src/placeIntelligence.ts`, `P/api/src/endpoints/place.ts` | `PlaceIntelligenceDTOs.swift`, `BallotDTOs.swift` (new) | `PlaceIntelligenceDtos.kt`, `PlaceJsonAdapters.kt`, `BallotDtos.kt` (new) |
| Ballot card, timeline, stack, glyph | `W/components/ballot/*` (new) | `Features/Ballot/*` (new) | `ui/screens/ballot/*` (new) |
| Place placement | `W/components/place/PlaceDashboardView.tsx` | `Features/Place/PlaceDashboardView.swift` | `ui/screens/place/PlaceDashboardScreen.kt` |
| Today | `W/app/(app)/app/hub/today/page.tsx` | `Features/Place/Detail/PlaceTodayDetailContent.swift`; "Open your ballot" wired in `AddressTodayTabView.swift` and `PlaceDetailView.swift` | `ui/screens/place/detail/PlaceTodayDetailContent.kt`; wired in `TodayTabScreen.kt`, `PlaceDetailScreen.kt` and `RootTabScreen.kt` |
| /start teaser | `W/components/place/StartFunnel.tsx` (`PreviewBody`) | not in P0 (web only) | not in P0 (web only) |
| Dev preview | `W/app/dev/ballot/page.tsx` (404 in production) | n/a | n/a |

Why the new component folders are needed: no existing card has a date timeline, a stacked-polygon drawing or a link well. The card frame and the icon tile are reused.

The card fields decode tolerantly on every client. A malformed ballot field drops only that field, and the election section keeps rendering: iOS decodes the card field by field, and Android reads it in `PlaceJsonAdapters` after the section's own adapter has succeeded.

## 7. Backend layout (P0)

| File | Responsibility |
|---|---|
| `backend/data/ballot/states.json`, `elections.json` | Reference data (section 5.1) |
| `backend/services/ballot/referenceData.js` | Load, validate and look up; dates in the state's timezone |
| `backend/services/ballot/governments.js` | Typed governments from geocoder geographies; exact-point fetch for homes (cached) and points (live) |
| `backend/services/ballot/summary.js` | The P0 summary for a home or a point: election, phase, deadlines, links, governments |
| `placeSectionAdapters.composeCivicElection` | Takes `{ userId }`; flag on → summary fields added; flag off → unchanged |
| `placeSectionCache.readThrough` | Optional `maxStaleMs` |
| `routes/public.js` `/place` | `ballot_teaser` when the flag is global |
| `supabase/migrations/<ts>_ballot_p0_flag.sql` | Inserts the flag row with every switch off |

`services/ballot/` holds this code because no existing service composes election reference data. The guide proposed `deadlines.js` and `packet.js`. P0 needs one summary module, and the packet arrives in P1.

## 8. Privacy and neutrality in P0

- No new personal data is stored.
- The anonymous teaser writes no cache row and logs no address.
- Saved-home geography is stored as typed ids only, under a key that changes when the home's coordinates change.
- External links use `rel="noopener noreferrer"` on web, and the system browser or Custom Tabs on native.
- No party, candidate or contest appears in P0.
- A government count is always labeled "at least".

## 9. Measuring whether it helps (after P0.5)

These use the existing funnel, with no political data: useful visits (official link opened), incremental saved places per exposed visitor against a concurrent control, later non-election use (late November through December), and operating cost and harm (corrections, opt-outs, support). The guide's 60/50/30/0.3 targets remain untested hypotheses.

## 10. Verification and its limits

| Check | Where | Status in this session |
|---|---|---|
| Reference data validation, date math, phases, governments parsing, composer on/off, teaser | Backend Jest | Run here |
| Card, timeline, stack, teaser, Today rendering and states | Web Jest + `/dev/ballot` Playwright screenshots beside the rendered canvas boards | Run here. Cards differ from their boards on 0.00–0.02% of pixels; the governments finished frame on 0.09%. Story frames were checked against the Peel board at 0.6 s and 1.8 s |
| iOS and Android card, governments view and Today | Written to the existing patterns, with unit tests for decoding, timeline geometry, placement and story timing | **Compiled and tested in PR CI**, not in this container (it has no Xcode, and the proxy refuses Google Maven). CI run 1518 on `c7cba932` passed `ios-ci` (SwiftLint, SwiftFormat, the build, then unit and snapshot tests on iPhone 16, 16 Pro and SE) and `android-ci` (lint, unit tests, snapshots, assemble, then instrumented tests on an emulator). Here, iOS changes pass SwiftFormat and strict SwiftLint and Android changes pass ktlint and detekt. Still needed: a device pass |
| Real addresses, real links | Release check 1: a person opens every source and link; release check 2: three Clark County addresses and one address outside Washington through the real API | **Not done.** Egress is blocked here |
| End-to-end on the web | A local stack: Postgres 16 with PostGIS, PostgREST 12.2.12, Supabase Auth 2.196.0, a gateway in place of Kong, the real backend and the Next.js app, driven in Chromium through the real UI | **Done September 24** (section 10.1) |
| End-to-end on simulator and emulator | Existing acceptance catalog | **Not done.** No Xcode or Android SDK here |

### 10.1 Web end-to-end run (September 24)

I signed up, confirmed the email and signed in through the web. Everything after that went through the real pages, the real API and the database.

- **Flag off:** the Place page and `civic_election` behave exactly as before ("Election data is not configured yet").
- **Flag on for one user** (`beta_user_ids`):
  - The Place page shows "This season" and the in-season card: 40 days, the timeline, how it works, and the registration, VoteWA and Clark County drop-box links, with the source line dated Sep 24.
  - With the Census lookup failing, the card drops the governments line and button, and the backend logs the failure.
  - With governments, "See your governments" plays the story. Skip and Close go to the finished frame; Done and Escape close it.
- **Today:** on September 24, the "Moved this year?" line shows with 32 days left and links to the state's registration page. On October 17, the "Ballot week" card shows, and "Open your ballot" lands on the Place card.
- **Other states:**
  - On Election Day, the card shows the notice and the mover line is gone.
  - After the election, the card shows only the results link.
  - An Oregon home gets the links-only card.
- **Signed-out /start:** the teaser and its governments view work end to end.
- **The all-mail states (September 24):** with the home's state set to each of California, Colorado, Hawaii, Nevada, Oregon, Utah and Vermont, the Place page showed that state's card, timeline and links. Also checked:
  - California's Today tab on October 17 (ballot week and the mover line).
  - Colorado and Vermont on Election Day (7 p.m.; Vermont's polling-place link).
  - Oregon after the election ("the Oregon Secretary of State").
  - Washington again, in season and on Election Day, with the new mailing wording.
  - The governments line came from the stubbed Census answer for Camas, so it only checks layout for these states.
- **After the election and all year (September 24):**
  - A Clark County home on November 5 showed "Counting" with the results and VoteWA tracking links.
  - On November 25 it showed "Clark County Elections certified the results on Nov 24."
  - On December 5 there was no card.
  - On September 24 and December 5, the Civic page's "Your governments" row opened the governments view; the story played and Done closed it.
  - The counting and certified cards differ from the P0 after board on 0.01% of pixels.

**What was controlled, and why:**

| What | Why | How |
|---|---|---|
| The home | Home creation needs Google or Smarty address validation, which fails closed without keys | Seeded in SQL, as the repo's HTTP fixtures do |
| Mapbox and the Census geocoder | Blocked here | A preloaded module answered in each API's own response format; nothing else was stubbed |
| The clock | Needed for the October and November states | `faketime`, on the backend only |

For the local run, three Postgres 17 details were patched out of a copy of the baseline, never the repo: `transaction_timeout`, `GRANT MAINTAIN`, and the PostGIS version pin. The 92 migrations then applied cleanly, including `ballot_p0`.

**Found and fixed:**

- The governments sheet rendered under the app shell's header, tab bar and floating buttons, so Skip and Close were covered. It now portals to the body, like `SlidePanel`.
- The existing Civic page (Place → Civic) shows the election that `civic_election` carries, so turning Ballot on puts it there. It read the calendar date "2026-11-03" in local time: web showed "Nov 2 · Monday, November 2, 2026" in US time zones, and iOS left the date tile blank because `parseISO` rejects a bare date. Both now read the date in UTC, as `fmtYearMonth` already does. Android parses it with `LocalDate` and was correct. Checked on web in Los Angeles and Tokyo time.
- In the week after the election, the Civic page still showed the November 3 election as "0 days away", because the section keeps it for the Place card's results link. On all three platforms the page now shows its existing "No upcoming election" card once `phase` is `after`. Checked on web on November 5 and on Election Day morning.

**Found and left for a separate task:** `/start?address=` deep links never preview. The autocomplete API returns `center: [lng, lat]`, but the funnel reads `center.lat`. This predates Ballot.

## 11. Founder approvals needed before release

1. **Pilot.** Washington dates statewide, with Clark County links, plus the seven states that mail every voter a ballot (section 5.1.1), which the founder asked for on September 24. Every other state gets the election date and a vote.gov link. The Washington copy about mailing changed for the USPS postmark rule (section 5.1.1).
2. **P0 copy that replaces unbuildable canvas copy.** Drawn on the canvas's "Proposed, September 24" boards:
   - The Place card line and its "See your governments" button.
   - The /start teaser legend and its button.
   - The compact card states.
   - The Today titles.
   - The removal of the Mail Day line.
3. **The P0 stack drawing.** Every layer is solid until verified-empty data exists.
4. **The P0 peel.** It keeps the board's motion, and each caption carries only "Government k of at least N" and the name. It plays once, holds the finished frame, and starts there under reduced motion.
5. **Reminders.** None in P0. P0.5 adds one opt-in, off by default, at most three per election, with the copy on the proposed Pushes board.
6. **Enabling.** `ballot_p0` goes to internal users first, then globally for the pilot. Enable it for native users only once the Ballot builds ship: older builds read `civic_election` as "the next election" and show the past election as "In 0 days" while the card is in `after`.
7. **After the election, and all year.** Approved by the founder on September 24 and built (boards: "Proposed, September 24: after the election, and all year").
   - **Counting, then certified.** Where a state's certification dates are checked, the `after` card stays through certification instead of 7 days. Counting (chip "Counting", results and ballot-tracking links) runs through the day local results are certified: "Ballots are still being counted. Results can change until Clark County Elections certifies them on Nov 24." Certified (results link only) runs from the next day until the card leaves: "Clark County Elections certified the results on Nov 24." Without a known county the sentence says "your county". Counts never appear. `phase` stays `after`; the server sends `after_stage` and every client renders the chip, note and links it already knows. Counting ends the day after certification, not on it, because boards certify during that day (the board's date labels now read "to Nov 24" and "Nov 25 to Dec 3").
   - **Dates per state** (`certification` in `elections.json`; the card leaves after `hide_after`):

     | State | Counties certify | Card leaves after | Why that date |
     |---|---|---|---|
     | Washington | on Nov 24 | Dec 3 | state certifies by Dec 3 |
     | California | by Dec 3 | Dec 11 | state certifies Dec 11 |
     | Oregon | by Nov 30 | Dec 10 | state certifies Dec 10 |
     | Nevada | by Nov 13 | Nov 24 | Supreme Court canvass Nov 24 |
     | Colorado | by Nov 25 | Dec 2 | no state date checked: one week after |
     | Utah | by Nov 17 | Nov 24 | no state date checked: one week after |

     Hawaii (no date found) and Vermont (ballots must arrive by Election Day; the canvass date wasn't confirmed) keep the 7-day card. The dates came from the same search-only sources as section 5.1.1 and need release check 1.
   - **Between elections.** From the day after `hide_after` the card leaves Place until the next election with checked dates. Washington's November 2, 2027 general is in the data (ballots mailed by Oct 15, register by Oct 25, counties certify Nov 23, the state by Dec 2; Secretary of State calendar), so the card returns July 5, 2027. It isn't a federal election, so nothing is marked on the ballot then. Special elections and primaries wait for P1 contest data.
   - **Governments all year.** The Civic page (Place → Civic, also in the desktop Place rail) has a "Your governments" row under Your districts on web, iOS and Android, test id `place.civic.governments`. It opens the governments view with its story. `civic_districts` carries the governments block behind `ballot_p0` for a home in a supported state, outside the election window too. It uses the same exact-point lookup and cache as the card, and nothing is marked on the ballot there.
   - **Results in the app.** None in P0. Washington counts late ballots for three weeks, and P0 doesn't know which contests are on an address's ballot. With P1 contest data, show only certified outcomes per contest; the build plan leaves live results out through 2028.
