# The Sky, phase A: approximate places, built fully (build contract v1, 2026-11-14)

**Status: accepted, not approved to build.** The founder accepted the design's sixteen decisions, the ten screens
and this contract's nine calls on November 14 ("Yes, all nine"). Building phase A needs the founder's go.

Read first: [the design](01-design.md), screens [4](screens/04-posting-floating.jpg),
[5 (place)](screens/05-posting-at-a-place.jpg), [5 (home)](screens/05-posting-at-home.jpg) and
[9](screens/09-pulse-composer.jpg), [docs/location-privacy-matrix.md](../../location-privacy-matrix.md), and the
Moments contract (`~/pantopus-moments/coord/CONTRACT.md`, v3.9 at the time of writing).

Everything here was read from `dev` at `d57148c4ec` on November 14. A file or line named below may have moved;
find it again before relying on it.

## 1. What phase A is

**What people see change, on a Moment and on a Pulse post:**

- A post floats over an area by default. Today a Moment is an exact pin by default.
- An exact pin is possible only at a public place the author picks by name. Today an exact pin can sit anywhere, a
  residential street included.
- A post made at home is always an area. Today the Post sheet warns and the author still chooses, and a Pulse photo
  post pins at home exactly.
- An area holds at least 100 homes. Today it is one fixed grid cell, however few homes are in it.
- A Moment can be shared later (in 1 hour, in 3 hours, tonight).
- A floating Moment may show its elevation rounded to 100 ft. Today an area Moment shows none.

**What stays:** every screen's layout, the tabs, "Don't show where", how long a Moment lasts, who sees it, the 18+
confirmation, reports, the picture check, the Elevation chip and its floating view, and every rule about who may
read a post. No floating look on the map, no levels: those are phases B and C.

**Where the work is:** the server, a new small data file (homes per cell), the Post sheet's words on iPhone and
Android, and the Pulse composer's place line on web, iPhone and Android.

## 2. Calls this contract makes

These go beyond the design or change a sentence of it. The founder accepted all nine on November 14, and the
design now says what they say.

| # | Call | Why |
| --- | --- | --- |
| C1 | **A floating post stores only its area point.** The exact point is used while the request is handled (home check, place check, "were you there" evidence) and is never written to the database. | It is the strongest promise ("Pantopus doesn't keep where you were") and the simplest code: no read path can leak a point that isn't stored. Cost: nobody, the author and Pantopus included, can later see the exact spot of a floating post. |
| C2 | **The area's point is the centre of its cell, with no secret offset.** The disc is the circle around that cell. | The design said the secret offset stays. Measured against the code, today's offset makes the real uncertainty about half a mile in every direction, a disc four times wider than the one drawn. The 100-home rule now carries the protection, so the disc can be honest and small: about 0.4 mile across at its smallest (the screens drew it at about three quarters of that size). |
| C3 | **Home counts come from the 2020 Census housing counts by block**, for the whole US in one build. | The design said "the address records Pantopus already holds". Those are published state by state, so most of the country would fall back to a town-sized area. The Census counts are public domain and cover every state. |
| C4 | **The largest area is a cell of about 7 by 5 miles**, used where even a 3-mile cell holds fewer than 100 homes, and wherever there is no count (abroad, a failed read). It stands in for "the town". | The app has outlines for three towns. Loading the rest is phase C work. |
| C5 | **"Share later" is for Moments only** in phase A, with three choices: in 1 hour, in 3 hours, tonight at 8. | A Pulse post is a conversation people answer; delaying it is a different feature. |
| C6 | **One server switch, `sky_places`**, a database flag. The apps follow what the server answers, so no app build key. With it on, the rules apply to store builds too: a Moment from a 2.1.2 app floats unless its author picked a place in the place picker, although that app's sheet says "Exact spot". | The safety rules have to protect people who haven't updated. The old sheet then promises more exposure than happens, never less. |
| C7 | **A Pulse photo post keeps an exact pin only at a tagged venue.** An address tag, or a photo taken somewhere with no tag, floats. Photo posts already made follow this when read. | Decision 2. An address may be someone's home. |
| C8 | **Old exact points stay in the database** for posts already made. They are no longer shown. Replacing them with area points is a one-time change to the production database, left for the founder to order. | AGENTS.md: only the founder changes hosted databases. |
| C9 | **Places that can take a pin:** everything the place picker lists today except schools and preschools. | Decision 2 says no homes, apartment buildings or schools. The picker's index holds no homes or apartment buildings. Colleges and universities stay. |

## 3. The three states

Every Moment and every Pulse place post is in exactly one state. The server decides it, in this order:

1. **No place.** The author chose "Don't show where" (a Moment's `location.source: "none"`; a Pulse post with
   precision `none`). Unchanged from today.
2. **Floating.** Any of: the point is within 60 m of a home the author lives at (`momentPlace.isAtHome`,
   `AT_HOME_M`); the author didn't pick a place; the picked place isn't found or isn't allowed (C9); the picked
   place's own point is within 60 m of the author's home.
3. **On the ground.** The author picked a public place and none of the above applies. The pin is the place's own
   point (the venue's centre from the places index), never the phone's or the photo's point.

"Picked a place" means:

- a Moment: `pin: "place"` (new apps), or a `venue_id` from the place picker, or a `place_key` that names a venue
  (old and new apps);
- a Pulse post: a venue tag (`taggedPlaceKind(...) === 'venue'` in `backend/routes/posts.js`) **and** a photo or
  video taken there (`mediaCaptureNear`), as today. A venue tag with no photo taken there floats and keeps the
  venue's name as its label, as today.

## 4. The area

### 4.1 Sizes

Five sizes, each a square of whole base cells (a base cell is today's 0.005° cell):

| Step | Cell | About | Disc across (at 45°N) |
| --- | --- | --- | --- |
| 1 | 0.005° | 0.35 by 0.25 mile | 0.4 mile |
| 2 | 0.01° | 0.7 by 0.5 mile | 0.85 mile |
| 3 | 0.02° | 1.4 by 1 mile | 1.7 miles |
| 4 | 0.05° | 3.5 by 2.4 miles | 4.2 miles |
| 5 | 0.1° | 7 by 5 miles | 8.4 miles |

A step's cells are aligned to multiples of its size, so every base cell sits inside exactly one cell of each step.
A point's step is the smallest one whose cell holds at least 100 homes (`AREA_MIN_HOMES = 100`); if none does, or
there is no count, step 5.

### 4.2 The point and the disc

One pure function, `areaPoint(latitude, longitude)` in a new `backend/utils/areaCells.js`, answers
`{ latitude, longitude, step, radius_m }`:

- `latitude`, `longitude`: the centre of the point's cell at its step, to 5 decimals.
- `radius_m`: half the cell's diagonal in metres at that latitude, rounded up to 10 m.
- The same input always gives the same answer. It depends on the place only: never on the person, the post or the
  time. Two posts from one spot show the same area, and many posts never narrow it down.

Apps draw the disc from `radius_m` (the Post sheet's preview in phase A; the map in phase B).

### 4.3 The homes-per-cell file

- **What it holds:** for every base cell in a 1° by 1° tile, one byte: the step (1 to 5), or 0 for "no count".
  A tile is 200 by 200 cells, 40,000 bytes before compression.
- **Where it lives:** in the private bucket the property index uses, under `area-cells/v1/`, with a
  `manifest.json` (version, built at, source, tile list). That bucket and its release steps belong to the
  property-data lane: ask its coordinator session; do not publish around it.
- **How it is built:** a new script, `backend/scripts/area-cells/build.cjs`, from the 2020 Census block housing
  counts and block points (C3). Each block's homes count toward the base cell that holds the block's point. A new
  workflow, `area-cells.yml`, runs it by hand. Nothing about a person or an address is in the file.
- **How it is read:** `AREA_CELLS_URL` (`s3://…` or `file://…`). Tiles load on first use and the newest 64 stay
  in memory, the way the places index is read (`backend/services/plans/placesIndex.js`). A tile that can't be read
  within 2.5 seconds, a missing tile and an empty `AREA_CELLS_URL` all answer step 5. A failed read is retried on
  the next request and logged once a minute at most.
- **For local rigs:** the build script takes `--bbox` and writes a few tiles to a folder; point `AREA_CELLS_URL`
  at it.

## 5. Moments

These are additions to the Moments contract; publish them there as v4.0 with the server PR. Nothing is removed.
With `sky_places` off for the caller, every answer and rule is today's.

### 5.1 `POST /api/moments/place-preview`

Adds, with the switch on for the caller:

| Field | Meaning |
| --- | --- |
| `sky: true` | The apps draw the new Post sheet when this is present. |
| `area: { label, latitude, longitude, radius_m }` | The area this point floats over: the town's name, the area point and the disc. `null` with no point. |
| `place: { key, label } \| null` | The public place that names the spot, when there is one: what "Pin it at a place" starts with. |
| `can_pin: bool` | False at home. |
| `share_later: [{ key, label, at }]` | The choices on offer now: `1h`, `3h`, and `tonight` only before 7 pm in the author's time zone. `at` is the time each would share. |

`can_show_height` becomes true for any point that isn't at home. `place_label`, `area_label`, `places`, `at_home`,
`pick_within_m`, `adult_confirmed` and `has_connections` stay as they are.

### 5.2 `POST /api/moments`

New optional fields:

| Field | Meaning |
| --- | --- |
| `pin: "place"` | Pin at a place. With `venue_id` or a `place_key` that names a venue, that place. With neither, the place that names the spot (`place` in the preview). No such place: `422 NO_PLACE_HERE`. |
| `share_later: "1h" \| "3h" \| "tonight"` | Hold the Moment until then (section 6). `tonight` after 7 pm local: `422 SHARE_TIME_PASSED`. |

Rules, with the switch on for the author:

- Section 3 decides the state. At home the Moment floats whatever was asked, with no error.
- An old app sends no `pin`. Its `venue_id`, or a `place_key` that names a venue, counts as picking a place. Its
  `show_area: true` always floats. Anything else floats.
- On the ground: the pin is the venue's point, the label its name, `label_kind: "place"`.
- Floating: the stored and shown point is `areaPoint(...)` of the Moment's own point; the label is the town
  (`area_label`).
- `altitude` (section 7).

The Moment's JSON adds `floating: bool`, `area: { radius_m } | null`, and for its author `share_at` and the state
`"scheduled"`. `show_area` stays and is true for every floating Moment, so today's apps draw it as an area.
`earlier: true` marks a Moment that was shared later (section 6).

Ring ids don't change: a floating Moment's ring is keyed on its shown point, as an area Moment's is today.

### 5.3 What a floating Moment stores (C1)

`latitude`, `longitude`, `effective_latitude`, `effective_longitude`: the area point. `location_precision`:
`approx_area`. `post_metadata.moment.show_area: true`, `at_home` as today. New: `post_metadata.area =
{ v: 1, step, radius_m }`. `gps_timestamp` stays (it is a time). The phone's point is not written anywhere, the
request log included.

`momentStore.displayedPoint` returns the stored point untouched when `post_metadata.area` is there. An area Moment
made before the switch (no `post_metadata.area`) keeps today's read until it ends, within 48 hours.

## 6. Share later (Moments)

- The Moment is created at once and its file uploads and is checked at once. Until its time it has the state
  `scheduled`: only its author sees it (`GET /api/moments/mine`, `GET /:id`), nobody is notified, and it is on no
  map.
- At its time it goes live: the push to connections goes out then, and `expires_at` counts from then.
- Every read works out "is it time yet" itself from the stored time, so a Moment goes live on time even with the
  scheduled jobs off, the way a Moment ends on time today. A job tick sends the push.
- The author can delete it before its time (`DELETE /api/moments/:id`, as today). There is no edit.
- A Moment that was shared later says so: `earlier: true`. New apps print "Earlier today" (or "Yesterday") in
  place of "12 min ago". An app from before this prints the time it went live; that can't be helped.
- The 20-a-day limit counts a scheduled Moment on the day it was made.
- Stored in `post_metadata.moment`: `share_at`, and `state: "scheduled"` until it is live.

## 7. Elevation

- On the ground: as today (feet rounded to 10).
- Floating, not at home: feet rounded to 100 (decision 13). `momentStore.shownAltitude` takes the state instead of
  `showArea`.
- At home, or no place: nothing, as today.
- `altitude_ft` in the Moment's JSON carries the rounded number either way; the apps print "About 4,400 ft" for a
  floating Moment.

## 8. Pulse posts

### 8.1 New posts

In `POST /api/posts` (and the Pulse-mode path in `backend/services/pulse/compose.js`), for a personal place post
with the switch on for the author:

- **Exact only at a tagged venue with a photo taken there.** Today's photo rule
  (`backend/routes/posts.js`, "A photo or video taken at the place") gives an exact pin for a venue tag, an
  address tag, and a photo with a town tag or no tag. Only the first stays exact. A venue the picker wouldn't
  list under C9 doesn't count.
- **Everything else floats** and stores the area point (C1): `latitude`, `longitude`, `effective_latitude`,
  `effective_longitude` hold `areaPoint(...)`; `post_metadata.area = { v: 1, step, radius_m }`;
  `location_precision: 'approx_area'`; `location_address: null`; `location_name` is what other people would
  read (`feedService.placeLabelForOthers`), so no street line is stored.
- **A Home post** (`post_as: 'home'`) floats, as it is forced to today, and stores the area point of the home's
  point.
- **An edit** that moves a post (`PATCH /api/posts/:id`) applies the same rules to the new place.
- **"Were you there" evidence** (the GPS fix, the photo's point) is read as today and not stored.
- A post asked for with precision `neighborhood_only` or `none` keeps that, as today.

### 8.2 Posts already made

`feedService.postPrecisionForOthers` gives an exact pin only when all three hold: the row is stored
`exact_place`, `post_metadata.location_basis === 'photo'`, and its tag is a venue
(`taggedPlaceKind(geocode_place_id, geocode_accuracy) === 'venue'`). Otherwise the post shows as an area with
today's read (the 0.005° cell and its offset), because those rows still hold their exact point (C8). The read
selects need `geocode_place_id` and `geocode_accuracy`. This part applies once the switch is on for everyone,
since it doesn't depend on who is reading.

### 8.3 Reading

- A row with `post_metadata.area` passes through `applyPostLocationPrivacy` without being moved again, for the
  author and everyone else, and its JSON carries `area: { radius_m }`.
- The author of a floating post now sees the area too, as a Moment's author does. `locationUnlocked` is true only
  for a ground pin.
- Area queries need no change: a stored area point is the shown point, and the widened read windows
  (`MAX_DISPLAY_OFFSET_DEGREES`, whole neighborhood cells) stay correct for older rows.
- The business match after a post (`postCreationHooksService`) measures from the area point.

## 9. The switch

- A `FeatureFlag` row, `sky_places`, added off by a migration, like `moment_heights`
  (`supabase/migrations/20261112200000_moment_heights_flag.sql`). An admin flips it with
  `POST /api/admin/feature-flags/sky_places`.
- Read per person with the Moments flag helper (`momentStore.flagOnFor`): for the author when a post is made, for
  the caller on the preview. So it can be on for the founder's account first, then everyone.
- Off again: new posts follow today's rules within a minute. Posts stored as areas stay areas; they hold nothing
  else to show.
- Not a launch-cut key. No app build carries a key for it (C6).

## 10. The apps

All words below are final unless the founder changes them. Keep each screen's layout: only the rows named here
change. Each app shows the new sheet only when the preview answers `sky: true`.

### 10.1 The Moment Post sheet (iPhone and Android)

Files: iPhone `Features/Moments/Compose/MomentsPostSheet.swift`, `MomentsPostSheet+Place.swift`,
`MomentsComposerModel.swift`, `MomentsComposerModel+Place.swift`, `MomentsComposerModel+Height.swift`,
`Core/Networking/Models/Moments/MomentsDTOs.swift`; Android
`ui/screens/moments/compose/MomentsPostSheet.kt`, `MomentsComposeViewModel.kt`,
`data/api/models/moments/MomentsDtos.kt`.

| Part | Floating (the default) | At a place | At home |
| --- | --- | --- | --- |
| Map preview | The area's disc (`area.radius_m`) | The pin standing on the place | The area's disc |
| Place row | "Floating over Washougal, WA" · "Area ›" | "At Esther Short Park" · "Exact ›" | "Floating over Vancouver, WA" · "Area" |
| Note | none | none | **"You're at home, so this floats over the area"** / "A Moment made at home never shows the spot. Photos can still show where you are." |
| "Pin it at a place" | Off. "Pick a park, a shop or a venue nearby" | On. "Esther Short Park · Change" | Greyed out. "Not available at home" |
| "Don't show where" | As today | As today | As today |
| "Show elevation" | "About 4,400 ft above sea level" | "180 ft above sea level" | Greyed out. "Not shown at home" |
| "Share later" | Off. "Hold it until a time you pick" | the same | the same |

- "Pin it at a place" replaces "Show the area instead". Turning it on uses the preview's `place` when there is
  one, and otherwise opens the place picker that the place row opens today. "Change" and the place row open the
  picker. With no place within reach, the switch turns back off and says "No place to pin near here".
- "Share later" on shows the choices from the preview ("In 1 hour", "In 3 hours", "Tonight at 8") and then "Shares
  at 6:40 pm". The Post button reads "Share at 6:40 pm · shows for 24 hours".
- A scheduled Moment appears in the author's own row as "Shares at 6:40 pm", and can be deleted.
- The floating icon is a dashed circle with a dot in it.

### 10.2 The Pulse composer (web, iPhone and Android)

Files: web `components/feed/PostComposer.tsx` and `components/feed/composer/mediaLocation.ts`; iPhone
`Features/Compose/PulseCompose/PulseComposeContent.swift`, `PulseComposeViewModel.swift`; Android
`ui/screens/compose/pulse/PulseComposeScreen.kt`, `PulseComposeViewModel.kt`.

- The line that reads "Posting to …" becomes "Floating over Camas, WA", with a small button "Pin it at a place"
  that opens the place picker the composer already has.
- With a venue tagged and a photo taken there: "At Esther Short Park", and "Photo taken here" as today.
- The sentence that explains an exact photo pin ("Your photo was taken here, so you can post to this place…")
  shows only for a venue. For an address or a bare photo it reads "Your photo was taken here. The post floats over
  the area."
- The composer needs the area's label for a point. Add it to what the composer already asks the server when it
  resolves a place (the builder names the route in the PR); do not add a second round trip per keystroke.

## 11. Files the server work touches

Known from reading; the builder confirms and completes the list in the first PR.

- New: `backend/utils/areaCells.js`, `backend/scripts/area-cells/build.cjs`, `.github/workflows/area-cells.yml`,
  a flag migration.
- Moments: `backend/routes/moments.js` (preview, create), `backend/services/moments/momentStore.js`
  (`displayedPoint`, `newMomentRow`, `shownAltitude`, `momentState`, the map reads, `checkPostingRules`),
  `momentPlace.js` (the venue's point for a picked `place_key`, C9), `momentNotify.js` (push at share time),
  `backend/jobs/momentsCleanup.js` or a new tick for scheduled Moments.
- Pulse: `backend/routes/posts.js` (create, edit, `taggedPlaceKind`), `backend/services/pulse/compose.js`,
  `backend/services/feedService.js` (`postPrecisionForOthers`, `applyPostLocationPrivacy`, the read selects),
  `backend/services/pulse/readAccess.js` (its select), `backend/services/postCreationHooksService.js`.
- Shared: `backend/utils/locationPrivacy.js` (leave `approx_area` as it is for old rows; add the pass-through).

**The audit the builder owes, in the first server PR:** every place that reads `Post.latitude`, `longitude`,
`effective_latitude` or `effective_longitude` after a post is created, with one line each on what it does with an
area point. Anything that needs the exact point after creation is a finding for the founder, not a reason to
store it.

## 12. Pull requests, in order

Each goes into `dev`, small, behind the switch, with the store builds run against it before it merges.

| # | What | Where |
| --- | --- | --- |
| 1 | `areaCells.js`, the build script, the workflow, a sample tile for rigs, the flag row. No behaviour change. | Server |
| 2 | Moments: the three states, area-only storage, the preview's new fields, elevation rounding. Moments contract v4.0. | Server |
| 3 | Share later. | Server |
| 4 | Pulse posts: the venue-only exact rule, area-only storage, the read rule for posts already made. | Server |
| 5 | The Post sheet. | iPhone |
| 6 | The Post sheet. | Android |
| 7 | The composer's place line. | Web |
| 8 | The composer's place line. | iPhone |
| 9 | The composer's place line. | Android |
| 10 | `docs/location-privacy-matrix.md`, this folder's README and NEXT_STEPS. | Docs, with 2 and 4 |

## 13. Checks

In the real apps, against a real local backend and database, with a rig's `AREA_CELLS_URL` pointing at built
tiles for the test area (AGENTS.md, "Verify in the real apps").

**With the switch on, on iPhone, Android and web where the screen exists:**

1. Post a Moment in a street of houses: it floats; the map shows it at the area point; the label is the town; the
   database row holds the area point and no other.
2. Post at a café with "Pin it at a place" on: the pin is the café's point, not the phone's.
3. Post from the test account's home: the sheet shows the home state; the Moment floats; no elevation.
4. Pick a place while at home through an old build's place picker: it floats.
5. A rural test point: the area is larger; a point with no tile: step 5.
6. Elevation: a floating Moment says "About … ft" rounded to 100; a ground pin is rounded to 10.
7. Share later: the author sees it scheduled; the second account sees nothing and gets no push; at the time it
   appears and the push arrives; it reads "Earlier today".
8. Pulse: a photo taken at a tagged venue pins exactly; the same photo with an address tag floats; a Home post
   floats; an edit that moves a post follows the rules.
9. A Pulse photo post made before the switch, tagged with an address: after the switch it shows as an area to the
   second account.
10. Relaunch each app and reload the web: everything above is unchanged.
11. The second account's view of each post, on another device.

**Store builds (2.1.2 iPhone and Android) against the new server**, switch off and switch on: nothing crashes;
with it off nothing differs from production; with it on, their Moments float unless a place was picked, and they
draw floating Moments as area Moments.

**With the switch off** on the new builds: the sheet and the composer are today's, pixel for pixel where a
comparison tool exists.

**Not checkable locally, to say so in the PRs:** real phones (real GPS, real pushes), the hosted sites, and the
whole-US cells file until it is published.

## 14. Not in phase A

The floating look on the map, discs on the map, levels, Overhead, "How far", the author's yes, review before
Country and World, the viewer's "Floating over" header, a higher starting level, the terrain, sponsored lift,
areas outside the US, and replacing old exact points in the database (C8).
