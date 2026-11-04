# Ballot: live results (plan, November 3, 2026)

Step 1 is built, approved by the founder on November 3. Steps 2 and 3 are plans. Checked against master `21b3acce2f`
and Washington's results site at 2:30–3:10 p.m. Pacific on November 3. Example numbers and names below are made up.

## What people will see

**Step 1, tonight. Server change only, so it reaches today's iPhone and Android apps and the web with no app update.**
On the "Your ballot" card for a Washington address (the Place tab and a saved address's preview), from the moment the
first count is posted:

```
Your ballot                                                    Counting
Unofficial count, posted 8:16 p.m.
U.S. House, District 3: Candidate A 51.2%, Candidate B 48.6%
State House, District 17, Position 1: Candidate C 50.4%, Candidate D 49.5%
State House, District 17, Position 2: Candidate E 49.9%, Candidate F 49.9%
Initiative IP26-645: Yes 54.0%, No 46.0%
Initiative IL26-001: Yes 41.2%, No 58.8%
Initiative IL26-638: Yes 61.0%, No 39.0%
Ballots are still being counted. Results can change until Clark County
Elections certifies them on Nov 24.
[Election results · Clark County Elections]  [Track your ballot]
```

- Races shown: the address's U.S. House race, its State Senate and State House races, and the statewide measures. These
  come from the address's exact districts (the same Census answer the Place tab already uses for "Your representatives").
  Races that can't be matched for certain are left out. County, city and school races stay on the official results
  page, which the card links to.
- Between 8 p.m. and the first count: "Polls closed at 8 p.m. The first count will show here as soon as Clark County
  Elections posts it."
- The numbers update with each new count until certification. "Posted 8:16 p.m." is the state's own publish time.
- Today's apps get new numbers when someone opens or pulls to refresh the Place tab.
- Unchanged: the card's layout, the "Counting" chip and the links. Every other state keeps today's card.

**Step 2, next app update (iPhone, Android, web).** A real results section in the card. Each race gets rows with
percentages and a gray bar (no party colors), plus "Unofficial · posted 8:16 p.m.". "All races on your ballot" opens a
list of every race at the address: measures, U.S. House, legislature, courts, county, and city, school and district
races once they're matched. The card refreshes itself every 30 seconds while it's on screen during counting. An opt-in
"Tell me when a new count is posted" sends at most one notification per county count, using copy you approve. Older app
versions keep getting the Step 1 text.

**Step 3, more states.** Utah and Nevada run the same results software as Washington (Enhanced Voting; Utah's 2026
General is already loaded in the same API), so the same reader should cover them. Colorado uses Clarity, which has its
own data files. Oregon, California, Hawaii and Vermont each need their own check. Covering all 50 states at TV speed
needs a data contract (Decision Desk HQ first, then AP). That's your money and your call.

## How fast

- **Source.** Washington's results system, results.votewa.gov, is where the Secretary of State publishes the counts.
  All 39 counties are in it. There's no earlier public copy.
- **The state's 60-second copy.** The site serves cached copies up to 60 seconds old (`cache-control: max-age=60`).
  Adding a query string still gets a cached copy (tested). So anyone reading the public site sees a new count up to a
  minute after it's posted.
- **Our check.** The server reads a 1.7 KB summary every 5 seconds on election night and every 15 seconds on later
  counting days. When the state publishes a new count, the summary changes, and the server fetches the results right
  away (about 45 KB compressed statewide). Every card served after that has the new numbers.
- **Result.** New numbers reach Pantopus about 5 to 65 seconds after the state posts them, about 35 seconds on
  average. Without the state's help, no one reading the public site can do better. I'll measure the real gap against
  the official page tonight.
- **Faster than that** needs the state. Ask the Secretary of State's elections division for media access without the
  60-second cache. You'd send it; I can draft it.
- **Reaching people.** In today's apps, people see new numbers when they open or refresh the Place tab. Step 2 adds the
  30-second refresh and the opt-in notification, which arrives within seconds of our server seeing a new count.

## Step 1 in detail (tonight)

1. A results reader on the server (`backend/services/ballot/liveResults.js`) keeps the latest count in memory. It runs
   only while the switch is on and a Washington election is counting.
2. The card's counting text puts the matched races above today's "Ballots are still being counted…" line.
3. The web card keeps the text's line breaks. That's a one-line style change. The iPhone and Android apps already
   show line breaks.
4. A switch, `ballot_results`, turned on by the same release. If anything looks wrong, switching it off brings back
   today's card at once.
5. Safeguards: if the state's site is unreachable or its data looks different from what was checked, the card shows
   exactly today's text. After a failure, the last count we read stays on the card with its posted time.

**Checks before merging.** My own local backend and database, with a Clark County address (District 3, Legislative
District 17) and a Seattle address. A test-only clock set to tonight 8:20 p.m.; it's ignored in production. The card
is checked against two sources:
- the August 4 primary's real counts, from the same system;
- tonight's real zero-vote data, which tests the "first count" line and the measure names.

I check the card on the web, an iPhone simulator and an Android emulator. The apps themselves don't change, so I use
existing builds. Percentages are checked against the official page, and so is a blocked feed, which must show today's
text. I also run the existing backend and web tests.

**Timeline.** About 1.5–2 hours of building and checking, then the PR's CI and master's CI (30–60 minutes each today)
and the release (2–10 minutes). It's live for the first count (~8:15–8:30 p.m.) only if the OK comes by about
3:30 p.m. and the merge queue is clear. Otherwise it goes live for a later count; counting runs until November 24.

## Fairness rules (from the Ballot design)

- "Unofficial", with the posted time and the source. Never "won", "leading" or "projected".
- Ballot order, so rows don't jump around as counts change. Names exactly as the ballot prints them. No party colors.
  Step 2's full list shows each candidate's party preference as printed ("Prefers Democratic Party"); Step 1's one-line
  view leaves it out for space.
- Percentages are worked out the way the official site does, so they match it.

## Risks

- **The state's data isn't a documented API.** It's the data the state's own results page loads, so it could change
  shape. Any surprise falls back to today's card. Our load is about 12 small requests a minute per server, less than
  one person refreshing the results page.
- **Showing the wrong race.** Only exact district matches are shown; anything uncertain is left out.
- **Releasing on election night.** The change is the smallest one possible: one card's counting text, for Washington
  addresses only, behind a switch, with today's text as the fallback.

## Your calls

1. Go ahead with Step 1 tonight (a production release on election night, with the switch on at release).
2. Whether to ask Washington's Secretary of State for media access without the 60-second cache (you send it).
3. Later: Step 2's notification wording and where opt-ins are stored. A new table needs your OK, unless the planned
   reminder opt-in lands first and can carry it.
4. Later: a national data contract.

## Not covered

Production under real election-night load, physical phones, and the first real count before it's posted. If Step 1 is
live by then, I'll watch the first count arrive.

## Build notes

- Summary (poll): `GET https://results.votewa.gov/results/public/api/elections/washington/20261103`. Change fields:
  `publishVersionId`, `publishDate` (shown as "posted"), `lastUpdated`, `asOf`, `ballotsCast`, `isOfficialResults`.
  Contest groups: State Measures (3), U.S. Congressional Representative (10), Legislative (122), Judicial (14), Other
  Contests (24).
- Results: `GET …/elections/washington/20261103/data` gives `ballotItems[]`: `name[0].text`, `contestGroupId`,
  `contestType`, `voteTotal`, `reportingStatus {reportingUnits, totalUnits, asOf}`, and `summaryResults.ballotOptions[]
  {name[0].text, voteCount, party.name[0].text, isWriteIn}`. County data is at `…/elections/clark-county-wa/20261103/data`
  (Step 2).
- Media export, as a backup source: `https://results.votewa.gov/cdn/results/washington/export-20261103.json` answers
  conditional requests (ETag, 304). With precinct results it grows large: the primary's file is 53 MB, so don't parse
  it in the API.
- Name formats differ between elections ("Congressional District 3 - U.S. Representative" tonight, "U.S. Representative
  - Congressional District 3" in the primary). Match `Congressional District (\d+)`, `Legislative District (\d+)` and
  `State Senator` / `State Representative Pos\. (\d)` anywhere in the name, within the right contest group.
- Districts come from `districtsFromGeographies` codes (`cd`, `sldu`, `sldl`) on the cached Census answer.
  `governments.js` caches only its parsed governments. Add the district codes there and bump the point cache key; the
  raw Census answer stays cached for 30 days, so this makes no new lookups.
- Hooks:
  - `composeSummary` gets an optional pre-composed results block and stays pure. `ballotGuideLetters.js` also calls it,
    so leave its default unchanged.
  - The switch is read in `routes/placeIntelligence.js` next to `ballotOptIn`, and in the saved-address preview path.
  - Web: `BallotCard.tsx` note div gets `whitespace-pre-line`.
  - A flag migration in the pattern of `20261008180737_ballot_p0_flag.sql` plus `20261010094000_ballot_p0_on.sql`.
  - The API answers a query string from cache too (`x-cache: TCP_HIT`, `max-age=60`, tested at 3:10 p.m.).
  - Update `ballotP0.test.js` only if an existing expectation changes.
- Request headers: `Accept: application/json`, gzip, and a User-Agent naming Pantopus. Use a timeout and never block a
  card request on the state's site: the reader runs on its own timer.
