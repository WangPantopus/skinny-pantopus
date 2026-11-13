# Moment heights and the photo-details ideas: handoff

Written 2026-11-12 (about 21:50 UTC) by the session that did the work, for a new session on the same Mac under a
different Claude account. Everything a new session needs is in this file or at a path this file names. Nothing here
is a secret: no passwords, keys or tokens.

## 1. Where things stand, in five lines

1. The founder asked for new, shareable ideas built on what a phone saves with each photo (place, height, direction,
   time, light). Eight ideas came out of it, and 22 design boards were drawn for four of them.
2. The founder picked **height** to build first, with the brief "the best visualization way, that no one have ever
   seen it before, make it addictive and beautiful".
3. Height has a five-step build plan. **Step 1 (the server) is built, merged as PR #3969 and released to production**
   on 2026-11-12, behind a new switch `moment_heights` that is **off**.
4. The shipped apps (2.1.2 code on iPhone and Android) were run against the new server with the switch off and on.
   Nothing broke.
5. **Next: step 2**, the "Show height" switch when posting, on iPhone and Android. It is **not approved yet**: the
   founder was asked and has not answered. Ask before building.

The other three drawn ideas (Retake, the year picture, tonight's sky) are designs only. Nothing about them is
approved to build.

## 2. What the founder said, in order

| When (UTC) | Founder | What it led to |
| --- | --- | --- |
| 11-12 ~05:00 | Brainstorm what phone photo details (latitude, longitude, altitude, direction, speed…) could become, "something revolutionary that we do not have anything in the world yet" | Eight ideas (section 3) |
| 11-12 ~05:25 | "Yeah, please draw" and "is the design difficult for users who like to show their altitude, higher elevation they show in the map, like a color or something" | 17 boards: Retake, year picture, tonight's sky, height on the map |
| 11-12 ~19:00 | "Yes please plan it, we have to design in the best visualization way, that no one have ever seen it before, make it addictive and beautiful so everyone falls in love with it" | 5 more boards (Moments float, lanterns, The Climb) and the five-step plan |
| 11-12 ~19:30 | "Yes, start step 1" | Server change, PR #3969 |
| 11-12 ~20:40 | "make sure merging will not break anything currently working first, we have production iOS and Android apps" | The shipped-app check (section 6) and a small speed fix |
| 11-12 ~21:15 | "Yes, merge when green" | Merged and released |
| 11-12 ~21:40 | Asked for this handoff and a strategy for not breaking the released apps | This file, section 8 |

## 3. The eight ideas

The thinking behind them: one photo's details make a caption, and that has been done. The new thing is what many
photos say together (same spot, same second, same direction).

| # | Idea | In one line | Drawn? |
| --- | --- | --- | --- |
| 1 | Your year, from where you stood | A picture of your year made on the phone from heights, directions and hours; no photo, no map | Yes (Y1–Y4) |
| 2 | A Moment with a heartbeat | The viewer feels the poster's heart rate as taps; needs a watch | No |
| 3 | Retake | Stand where someone stood, line up with a faint copy of their photo, add yours; the chain plays as a time-lapse | Yes (R1–R6) |
| 4 | Crossed paths | "You and Maya were 40 feet apart at 8:41 pm"; both sides opt in | No |
| 5 | Every angle of a Plan | One event's photos sorted by the second and by where each person stood | No |
| 6 | What everyone is looking at | A beam from each photo in the direction it faced; where beams cross is the thing | No |
| 7 | Tonight's sky | One band of color per neighbor's sky photo, in time order | Yes (S1–S3) |
| 8 | Moments at their real height | The idea being built | Yes (H1–H4, F1–F5) |

The session's recommendation at the time: Retake as the lasting format, the year picture as a December opener. The
founder chose to build height first.

## 4. The drawings

**Canvas:** "Photo details: Retake, year picture, sky, height",
https://claude.ai/artifact/AdGDqjvoHKtpPix4QZAkBb. It is **private to the Claude account that made it**. A session on
another account cannot open it unless the founder shares it from the canvas page's Share menu. A session cannot
change sharing.

So that nobody depends on that link, every board is also here as a picture, and the editable sources are on disk:

- Pictures: [`screens/`](screens/) in this folder (22 boards and two overview sheets).
- Sources: `~/pantopus-moments/photo-details-design-src/` (`project/` holds one `.dc.html` per board plus
  `canvas.json` and `pd.css`; `assets/` the art; `tools/make_art.py` and `tools/make_climb.py` draw the art;
  `tools/preview.sh <board>` renders a board locally; `blobs.json` maps the canvas's picture ids to files).
- To put the canvas on another account: make a new Design canvas there, upload the files in `assets/` as its
  assets, replace the `/_blob/<id>` addresses in the boards with the new ones (`blobs.json` says which file each id
  was), and publish `project/`.

The boards were checked as local renders in headless Chrome. The canvas page itself was never opened by the
session.

Overview: [first 17 boards](screens/all-17-first-boards.jpg) · [the five floating boards](screens/five-floating-boards.jpg)

### Retake (design only)

| Board | Shows |
| --- | --- |
| [R1](screens/R1-moment-you-can-retake.jpg) | A Moment with a "Retake" button and "14 retakes" |
| [R2](screens/R2-get-to-the-spot.jpg) | Map to the spot, the direction to face, when the light matches |
| [R3](screens/R3-line-it-up.jpg) | Camera with the original shown faintly, "Turn a little right" |
| [R4](screens/R4-lined-up.jpg) | Lined up: green, shutter ready |
| [R5](screens/R5-chain-of-retakes.jpg) | The chain playing as a time-lapse |
| [R6](screens/R6-front-door-every-year.jpg) | Household-only: the same front door every year |

### Your year (design only)

| Board | Shows |
| --- | --- |
| [Y1](screens/Y1-before-it-reads-your-photos.jpg) | Before it reads your photos: made on this phone, nothing uploaded |
| [Y2](screens/Y2-year-picture.jpg) | The shareable poster |
| [Y3](screens/Y3-how-high-you-stood.jpg) | The year's height line |
| [Y4](screens/Y4-which-way-and-when.jpg) | Which way you faced, and at what hours |

### Tonight's sky (design only)

| Board | Shows |
| --- | --- |
| [S1](screens/S1-pulse-sky-right-now.jpg) | A live card in Pulse |
| [S2](screens/S2-tonights-sky.jpg) | The finished strip, one band per neighbor |
| [S3](screens/S3-one-band-opened.jpg) | One band opened as a Moment |

### Height (the idea being built)

| Board | Shows | Build step |
| --- | --- | --- |
| [H1](screens/H1-posting-show-height.jpg) | Posting with "Show height" on | 2 |
| [H2](screens/H2-map-colored-by-height.jpg) | Map: ring color by height band, a number tag, the key | 3 |
| [H3](screens/H3-tilted-moments-rise.jpg) | Tilted map: Moments rise on stalks | 3 |
| [H4](screens/H4-watching-a-high-moment.jpg) | Watching a Moment: a height scale on the edge | 3 |
| [F1](screens/F1-by-day-moments-float.jpg) | By day: Moments float; higher looks bigger; shadows fall where the real sun puts them | 3 |
| [F2](screens/F2-after-sunset-lanterns.jpg) | After sunset: lanterns on strings on the tilted map | 3 |
| [F3](screens/F3-the-climb.jpg) | The Climb: a side view scrolled upward, with your own height as a live line | 4 |
| [F4](screens/F4-new-personal-height.jpg) | "Your highest Moment yet" and high points near you | 5 |
| [F5](screens/F5-the-climb-whole-way-up.jpg) | The Climb, the whole way from the river to the stars | 4 |

### What the height boards mean, exactly

- **Bands** (ring color, always beside the number, never color alone): under 500 ft `#15803D`; 500 to 2,000
  `#84CC16`; 2,000 to 6,000 `#F59E0B`; over 6,000 `#BE123C`; flying `#0284C7` with a dashed ring and a plane.
- **Float (F1):** the pin stays on its point; it grows a little with height; its shadow is offset away from the
  sun and gets softer with height. The sun's direction is worked out on the phone from the time and the place.
- **Lanterns (F2):** after local sunset the map is dark, each ring glows in its band color, hangs on a string
  from its ground point and lights the ground under it.
- **The Climb (F3, F5):** a vertical scroll on a square-root scale, so 30 ft and 30,000 ft both fit. Scenery is
  drawn generically (water, town, hills, peaks, clouds, sky, stars); landmarks and Moments sit at true heights; a
  line shows the viewer's own height right now. "The Climb" is a working name the founder has not confirmed.
- **Hooks (F4):** your highest Moment yet, "highest on the ground today" (flights don't count), and a list of
  high points near you to reach.

### Where the drawings are only approximate

- **H1 is not the real Post sheet.** The real one (see `ios-p1-postsheet.png` under the rig's shots, section 9)
  is a sheet with two switch rows, "Show the area instead" and "Don't show where". Step 2 adds a third row in
  that style. Follow the real sheet, not H1's layout (AGENTS.md: keep working screens' layouts).
- The tab bar and Pulse top row in S1, H2, H3, F1, F2 are approximate. The 2.1.2 apps' tabs are Place · Today ·
  Pulse · Moments · Plans, and the Moments map is its own tab.
- No dark-mode boards were drawn except F2, which is dark by design.

## 5. Step 1: what was built (done, merged, released)

- **PR:** [WangPantopus/skinny-pantopus#3969](https://github.com/WangPantopus/skinny-pantopus/pull/3969), two
  commits (`f0d35ecb1f`, `3cea586588`), merged 2026-11-12 21:18:11 UTC as master `293d9336dd`.
- **Release:** master CI passed; "Deploy Backend to production" succeeded about 21:28 UTC, including its migration
  step; `https://api.pantopus.com/health` answered healthy afterwards.
- **Files:** `backend/routes/moments.js`, `backend/services/moments/momentStore.js`,
  `docs/location-privacy-matrix.md`, `supabase/migrations/20261112200000_moment_heights_flag.sql`.

### The contract (also in `~/pantopus-moments/coord/CONTRACT.md` as v3.8)

- `POST /api/moments` takes an optional `altitude: { meters, accuracy_m?, speed_mps? }`: metres **above sea level**
  from the location fix or the album photo, how far off the phone says that may be, and the phone's speed. A phone
  sends it only when the author turned "Show height" on.
- A `Moment` and each map `Ring` return `altitude_ft: number | null` (feet above sea level, rounded to 10) and
  `flying: boolean` (speed of 60 m/s or more). A ring's are its newest Moment's. The name is not `height`, because
  `height` already means the picture's pixel height.
- `POST /api/moments/place-preview` returns `can_show_height: boolean`: true only when the switch is on for the
  caller and the point is not their home.
- **Nothing is kept** (and `altitude_ft` is null) for a Moment at home, shown as an area, or with no location; for
  a reading below -500 m or above 15,000 m; for `accuracy_m` under 0 or over 60 (150 when flying); and while the
  switch is off for the author. A bad reading never fails the post. Only a non-number is a 400.
- **Viewers get heights only while the switch is on for them.**
- Stored in `Post.post_metadata.moment` as `altitude_ft` and `flying`. No table, no column.
- The code: `shownAltitude` (what is kept), `shownHeight` (what is returned), `heightsOn` (the switch), all in
  `momentStore.js`. `heightsOn` answers from the cached flag row, so it costs no database read while the switch is
  off.

### The switch

`moment_heights` is a row in `FeatureFlag`, added off by the migration. It can be on for everyone, for the internal
team, or for named user ids (`beta_user_ids`). The server re-reads it at most once a minute. Only the founder turns
it on in production.

## 6. How step 1 was checked

**Against a local backend from the branch and the shared local test database:**

| Check | Result |
| --- | --- |
| No switch row at all: post with a height | Posted; nothing kept; `can_show_height` false |
| The migration, run twice | One row, off |
| Switch on for one account: exact pin, 1338.1 m | Kept and returned as 4,390 ft |
| "Show the area" with a height | Nothing kept |
| 10,363 m at 230 m/s | 34,000 ft, flying |
| 99,999 m; a reading 90 m rough | Posted; nothing kept |
| `meters` not a number | 400 |
| No location | Nothing kept |
| An account without the switch posts with a height | Nothing kept |
| That account opens the first account's Moment and the map | No heights |

**The shipped apps against the new server** (the founder's ask before merging). Builds of the 2.1.2 code (no app
file differs from the `ios-v2.1.2` / `android-v2.1.2` tags) on an iPhone simulator and an Android emulator, two
different accounts:

| State | iPhone | Android |
| --- | --- | --- |
| Switch off | Map loads, opens another person's Moment, Post sheet opens, posts, Pulse loads | Same, and opens the Moment the iPhone posted |
| Switch on for everyone, Moments carrying heights | Map loads, opens the Moment with a height, Play all, posts | Same |

No server error in either run. Every store version that has Moments (iPhone 2.0.20 to 2.1.2, Android 2.1.1 and
2.1.2) reads only the fields it names; that was checked in the code at each tag, not by running those versions.

**Repository checks:** whole backend Jest suite, privacy gates, migration-history check, and CI on the PR and on
master.

**Not proven:**

- The App Store and Play Store binaries themselves, and a real phone. The check used simulator and emulator builds
  of the same code.
- The at-home rule with an account that really has a home. No rig account has one. The rule was checked on its
  function, and the route feeds it the same "at home" answer the place label uses. That answer reads as "not at
  home" if the home lookup fails (existing behavior of `momentPlace.isAtHome`); worth tightening for heights.
- The switch row in the production database was not read by the session. The release's migration step reported
  success.

## 7. What is left: steps 2 to 5

Each step needs the founder's OK before it starts. Each is small PRs: server first when there is a server part,
then iPhone, then Android. File references are on master `293d9336dd`.

### Step 2: "Show height" when posting (iPhone and Android; no server change)

**What the person sees:** on the Post sheet, a third switch row under "Show the area instead" and "Don't show
where": **Show height**, with a second line such as "4,390 ft above sea level". The row is there only when the
server says so (`can_show_height`) and the phone has a usable reading. It disappears when "Show the area instead" or
"Don't show where" is on. Once a person turns it on it stays on for their next Moments (remembered on the phone,
per account), but it is never shown at home.

iPhone, in `frontend/apps/ios/Pantopus/`:

- `Core/Networking/Models/Moments/MomentsDTOs.swift`: `MomentPlacePreviewDTO` (line 333) gains `canShowHeight`
  from `can_show_height`, read with `decodeIfPresent`, default false. `MomentCreateBody` (line 462) gains an
  optional `altitude` body (`meters`, `accuracy_m`, `speed_mps`), left out when nil.
- `Features/Moments/Compose/MomentsComposerModel.swift`: the album photo's place is read at line 233 from
  `asset.location`, a `CLLocation`; carry its `altitude`, `verticalAccuracy` and `speed` too. The live fix comes
  from the `LocationProviding` passed in at line 122; the location bodies are built at lines 482 to 491. On
  iPhone `CLLocation.altitude` is already above sea level. A negative `verticalAccuracy` means the altitude is not
  valid (send nothing); a negative `speed` means unknown (leave it out).
- `Features/Moments/Compose/MomentsPostSheet.swift`: copy the shape of `areaRow` (line 276);
  `MomentsPostSheet+Place.swift` line 99 has the "Don't show where" row. Test id `moments.post.height`.
- The number on the row must be what the server will show: `round(meters × 3.28084 / 10) × 10`.

Android, in `frontend/apps/android/app/src/main/java/app/pantopus/android/`:

- `data/api/models/moments/MomentsDtos.kt`: `MomentPlacePreviewDto` (line 162) gains
  `@Json(name = "can_show_height") val canShowHeight: Boolean = false`; `CreateMomentBody` (line 207) gains a
  nullable `altitude`.
- `data/moments/MomentMedia.kt`: `MomentCapture` (line 66) carries the album photo's place from EXIF; add the
  altitude (`ExifInterface.getAltitude`) and speed. It needs `ACCESS_MEDIA_LOCATION`, as the place already does.
- `ui/screens/moments/compose/MomentsComposeViewModel.kt`: the request is built at lines 569 and 618
  (`CreateMomentBody(`); the live fix comes from `locations.newFix()`.
- `ui/screens/moments/compose/MomentsPostSheet.kt`: the area row is around line 148. Test tag
  `moments.post.height`.
- **Sea level on Android:** `Location.getAltitude()` is height above the ellipsoid, not sea level. Send mean sea
  level: `mslAltitudeMeters` where the phone has it (Android 14 and later), otherwise convert with
  `AltitudeConverterCompat` from `androidx.core.location.altitude`. Check which version the project has before
  relying on it. The difference around Vancouver, WA is roughly 20 m (the previous session's estimate, not
  measured). Whether an album photo's EXIF altitude is sea level or ellipsoid varies by camera app: decide and
  say which.

Done looks like, on both phones against a local backend:

- Switch off on the server: the Post sheet is pixel-for-pixel what it is today, and the post request carries no
  `altitude`.
- Switch on for the test account: the row shows with the number; posting keeps it (`altitude_ft` on the Moment);
  the row is gone with "Show the area instead", "Don't show where", and at home.
- The other account still opens that Moment in the 2.1.2 app (section 8's old-app check).
- Simulators have no real height sensor. The Android emulator takes one (`adb emu geo fix <lng> <lat> <meters>`);
  the iPhone simulator needs a location scenario or GPX file with elevation. A real phone is the founder's check.

### Step 3: the map and the viewer (small server part, then iPhone, then Android)

- **Server:** add `heights_on: boolean` to the `GET /api/moments/map` answer, so an app shows the "Heights"
  control only when heights are on for that person. Additive.
- **Apps read** `altitude_ft` and `flying` on rings and Moments, as optional fields.
- **Map (H2, F1):** band color on the ring, the number tag, a slightly bigger ring when higher, the sun-true
  shadow. Decide how a cluster shows heights (not designed).
- **Tilt (H3, F2):** iPhone's map is SwiftUI `Map` with `Annotation` views in
  `Features/Moments/Map/MomentsMapView.swift`; it allows only pan and zoom today (`interactionModes: [.pan, .zoom]`,
  line 233) and reads the camera only when it stops (`.onEnd`, line 280). Strings that follow a tilting map need
  the pitch while it moves; measure with 300 rings before committing to it. Android is Google Maps Compose with
  its own overlay (`ui/screens/moments/map/MomentsMapOverlay.kt`).
- **Lanterns (F2):** needs a dark map after sunset. Android is light-only in practice today; this is a design
  decision to put to the founder.
- **Viewer (H4):** the height scale on the edge and the "highest near you today" line.

### Step 4: The Climb (new screen on both phones)

- Put it behind **its own switch** (suggested `moment_climb`, returned as `climb_on` beside `heights_on`), so
  heights can go live before the Climb is finished and a store build cut in between shows no half-built screen.
- The viewer's live height: iPhone can use the location's altitude with no new permission; Android as in step 2.
- Landmarks at true heights: not sourced yet. Peaks in OpenStreetMap carry an `ele` tag, and the Moments place
  picker already reads OpenStreetMap; whether that data reaches the server is unchecked.

### Step 5: personal best, highest today, high points, share picture

- Needs somewhere to remember a person's best and the high points they reached. That may mean one new table,
  which needs the founder's approval (AGENTS.md). Ask then, not before.
- Flights are kept out of "highest today".

### Offered but not built

- When a Moment is pinned to a named peak, show the peak's surveyed height instead of the phone's reading, so
  Silver Star always reads 4,390 ft. The founder has not answered this.

## 8. Not breaking the released apps: the strategy

**Recommendation: merge each small step straight to master, behind the switches. Do not collect the work on one
long feature branch.**

Why direct merges are safe here:

- **The server is the only part that reaches users when it merges** (a merge to master releases the backend).
  Server changes for this work are additive and behind the switch, and the shipped apps were run against them.
- **App code on master reaches nobody until a store build is cut** from a tag (`ios-vX.Y.Z`, `android-vX.Y.Z`),
  on the founder's word. But any session may cut the next build for another reason, so app code on master must
  be invisible while the switch is off. That is the rule that makes direct merges safe, and it is checkable.
- **The switch is a real off switch.** Off means the server keeps no height and returns none, within a minute.

Why not one feature branch merged at the end:

- The Moments files change daily (about ten Moments PRs merged in the two days before this work). A long branch
  drifts and ends in one large merge, which is the riskiest moment for the released apps.
- CI and TestFlight builds come from master and tags, so the founder could not try anything on a phone until the
  end.
- The server would have to reach master early anyway, so the branch would protect only app code, which a switch
  already hides.

### Rules for every PR in this work

1. **Additive on the server.** Never rename, remove or change the type of a field or route the apps read. New
   fields are optional. New behavior sits behind a switch.
2. **Server first, apps second.** An app PR merges only after the server part it needs is released. Apps read
   every new field as optional (`decodeIfPresent` with a default on iPhone, a default value on Android).
3. **Old-app check on every server PR that touches a Moments answer** (recipe below), with the switch off and on.
4. **Switch-off check on every app PR:** with the switch off, the changed screens look and behave exactly as on
   master before the PR. Compare screenshots.
5. **Switch-on check on every app PR:** the new thing works, and the other person's view still works on the
   2.1.2 app.
6. **The Climb and the hooks get their own switch** (section 7, step 4).
7. **Merge only on the founder's yes**, through the shared queue: read
   `/Users/yingpengwang/skinny-pantopus/launch-streams/status/REQUESTS.md` for an open HOLD, append your own HOLD
   line, run `gh pr view` first, merge with `gh pr merge <n> --merge --match-head-commit <sha>`, check the merge
   commit's second parent is that sha, append a RELEASE line. The repository has no required checks and
   auto-merge is off, so "merge when green" means waiting for the PR's one CI run yourself.
8. **After a server merge:** watch master's CI, then "Deploy Backend to production", then
   `https://api.pantopus.com/health`.
9. **Turning the switch on in production is the founder's act.** First for the founder's own user id only
   (`beta_user_ids`), on a TestFlight or Play internal build, then for everyone. Not for everyone before step 3
   is in a store build, or people could show a height nobody can see.
10. **Going back:** turn the switch off. The repository also has a `rollback-backend.yml` workflow for the
    server. A store build cannot be pulled back, which is why rules 4 and 6 exist.

### The old-app check, as it was run

- Builds of the 2.1.2 code already exist from the MOMRING rig, pointed at backend port **33511**:
  - iPhone: `/Volumes/Studio-Extended/launch-kit/streams/MOMRING/ios/DerivedData/Build/Products/Debug-iphonesimulator/Pantopus.app`
    (bundle id `com.pantopus.app`).
  - Android: `~/.config/pantopus/launch-kit/streams/MOMRING/android/build/app/outputs/apk/debug/app-debug.apk`
    (package `com.pantopus.app.debug`).
- Run your branch's backend on 33511 (section 9), install the iPhone app on a simulator and the APK on an
  emulator, sign a different test account into each, and on both: open the Moments tab, open another account's
  Moment, Play all, open the Post sheet, post a text card, open Pulse. Then turn the local switch on for everyone,
  post Moments with heights from two more accounts through the API, and repeat. Read the backend log for errors.
- Those builds can disappear (the kit's caches are cleaned on a schedule). If they are gone, build the apps at the
  newest release tags with the kit's build scripts. When a newer version is in the stores, use its tag.
- The simulator `0DD5D987-892F-4E81-AEDF-958B95366E02` ("Pantopus MOMRING") and the AVD `pantopus_momring` were
  borrowed from a finished session and left with the app removed. Make your own if another session is using them.

## 9. What is on this Mac for you

| What | Where |
| --- | --- |
| This handoff, also outside git | `~/pantopus-moments/moment-heights-handoff/` |
| Board sources, art tools, local renders | `~/pantopus-moments/photo-details-design-src/` |
| Moments API contract (v3.8 has heights; backup `.bak-heights`) | `~/pantopus-moments/coord/CONTRACT.md` |
| The test rig made for this work | `~/.config/pantopus/launch-kit/streams/HEIGHTS/` |
| Screenshots from the shipped-app check | `~/.config/pantopus/launch-kit/streams/HEIGHTS/shots/` (`ios-p1-*`, `ios-p2-*`, `and-p1-*`, `and-p2-*`; p1 is switch off, p2 is switch on) |
| The kit's own instructions | `~/.config/pantopus/launch-kit/README.md` |
| Shared merge queue file | `/Users/yingpengwang/skinny-pantopus/launch-streams/status/REQUESTS.md` |
| The previous session's notes | `/Users/yingpengwang/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/` (`MEMORY.md` is the index; `photo-details-ideas-design-2026-11-11.md` is this work; `index-moments.md` lists the Moments notes) |
| The worktree this was written in | `/Volumes/Studio-Extended/worktrees/estimate-rescue/skinny-pantopus/photo-metadata-visualization-bddf63` (branch `claude/moment-heights-handoff`, cut from master `293d9336dd`) |

### The HEIGHTS rig

- **Database:** the shared local stack `pantopus-attomtrust` (API `127.0.0.1:63831`, database `63832`), shared
  with other sessions. Use your own accounts' data only; run no schema tests on it. Its `moment_heights` row
  exists and is off.
- **Backend:** `node tools/launch-backend-heights.cjs --worktree <your worktree> --port <free port>` from the rig
  folder. It refuses anything that is not the local stack, sends no email or texts, and needs
  `pnpm install --frozen-lockfile --prefer-offline --filter pantopus-backend` in the worktree first. Port 33711
  was used for API checks, 33511 for the shipped-app check. Stop it by the listener's process id, never by name.
- **API helper:** `node tools/api-heights.cjs --worktree <worktree> '<js>'` signs test accounts in and gives
  `api(WHO, method, url, body)`, `q(sql, params)` and `show()`. It talks to `HEIGHTS_API`
  (default `http://127.0.0.1:33511`). `tools/snip-a.js` and `tools/snip-c.js` are the checks in section 6.
- **Accounts:** `accounts-HEIGHTS.env` (mode 600) holds ten local test accounts (AISHA, OMAR, VERA, VINCE, NORA,
  WADE, IVAN, CORA, MILO, BREE). AISHA and OMAR are connected. None has a home. All are in the local `moments`
  switch. Never print the file.
- **Typing a sign-in without showing it:** `tools/ios-type-env-heights.py` (iPhone) and
  `tools/adb-login-heights.py` (Android). **Driving the apps:** `tools/ui-ios-heights.py` and
  `tools/ui-heights.py`.
- **Devices:** `~/.config/pantopus/launch-kit/devices.sh` makes and starts simulators and emulators per rig name.

### Things that went wrong, so you don't repeat them

- **Docker Desktop can hang** while its ports still listen: every `docker` command answers 500 or hangs for
  minutes. Test the stack with `curl http://127.0.0.1:63831/auth/v1/health`. `docker desktop restart` fixed it in
  under a minute and the stacks came back by themselves. Leave a line in REQUESTS.md first.
- **The session's scratch folder was wiped between turns.** Keep anything that matters under
  `~/pantopus-moments/` or the rig folder.
- **zsh does not split a variable into words:** `U="python3 tool.py"; $U ids` runs nothing. Use a function.
- **Android's camera permission prompt comes back** on the second "Add a Moment" and swallows every tap until
  it is dismissed.
- **The full backend test suite failed twice while an emulator was shutting down**, a different unrelated test
  each time ("Expected 200, Received 404"). Each passed alone and two quiet runs were clean. Don't run it while
  the Mac is busy.
- **The server's flag answer is cached for a minute.** After changing a switch row, wait for it (poll
  `place-preview` for `can_show_height`) before testing.

## 10. Open questions for the founder

1. Go ahead with step 2?
2. Is "The Climb" the name?
3. A named peak's surveyed height instead of the phone's reading?
4. A dark map after sunset on Android (it is light-only today)?
5. One new table for personal bests and high points (step 5)?
6. Share the canvas with the new account, or is the picture set here enough?
7. Retake, the year picture and tonight's sky: build any of them, and when?

## 11. Prompt to start the next session

Paste this into a new session opened on the repository (same Mac):

```text
You are picking up "Moment heights" for Pantopus from a previous session that ran under another Claude account on
this same Mac. Start by reading, in this order:

1. AGENTS.md at the repository root (the project's rules).
2. The handoff: docs/product/moment-heights/HANDOFF.md if it is on your branch, otherwise
   ~/pantopus-moments/moment-heights-handoff/HANDOFF.md (same file, with the board pictures in screens/ beside it).
   Read all of it, and look at the board pictures it links.
3. The previous session's notes, if they are not already loaded for you:
   /Users/yingpengwang/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/MEMORY.md, then
   photo-details-ideas-design-2026-11-11.md and index-moments.md in that folder. They hold the founder's standing
   preferences and the traps on this Mac.

Where things stand: step 1 (the server keeps and returns a Moment's height, behind the switch moment_heights, off)
is merged as PR #3969 and released to production. The shipped 2.1.2 iPhone and Android apps were checked against
it. Steps 2 to 5 are not built and not approved.

Your first job is step 2: the "Show height" switch on the Post sheet, on iPhone and Android, exactly as section 7
of the handoff describes. Do not start building yet. First:

- Check the current state yourself: git fetch, the newest master commit, open pull requests and other sessions
  touching the Moments compose or Post sheet files, and whether a newer app version than 2.1.2 has been tagged.
- Read the real Post sheet code on both phones and confirm the file references in the handoff still hold.
- Then give me a short plan in plain words (what the person will see, which files change, how you will check
  it, what you cannot check) and wait for my OK.

Rules that matter most here:

- We have released iPhone and Android apps. Nothing may break them. Follow section 8 of the handoff on every
  pull request: server changes are additive and behind the switch; server first, apps second; with the switch
  off the apps must look and behave exactly as today; run the old-app check on any server change.
- Merge small pull requests to master one at a time, only after I say yes, through the shared queue in
  /Users/yingpengwang/skinny-pantopus/launch-streams/status/REQUESTS.md. No long-lived feature branch.
- Check your work in the real apps (iPhone simulator, Android emulator, a local backend and database), including
  the other person's view, and tell me plainly what you could not check. Do not write new unit tests.
- Reuse what is on this Mac: the test rig at ~/.config/pantopus/launch-kit/streams/HEIGHTS/ (backend launcher,
  API helper, test accounts, app-driving tools), the 2.1.2 app builds the handoff names, and the board sources at
  ~/pantopus-moments/photo-details-design-src/. Make your own rig name, ports and devices if another session is
  using those.
- Work in your own git worktree and branch, cut from the newest master. Do the build work yourself, without
  subagents.
- The repository is public: no passwords, keys, tokens or real people's data in git, pull requests, screenshots
  or chat. Never print the rig's accounts file.
- Never touch the founder's own running environment, another session's rig, or production settings. Only I turn
  switches on in production.
- Write to me in plain words. Ask me only when a decision is really mine; the handoff's section 10 lists the
  ones still open.
```
