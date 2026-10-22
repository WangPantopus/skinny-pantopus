# Lost pet alerts: the contract between the server, the web and the apps

October 21, 2026 · Status: decided, ready to build. The founder chose the recommended option for all 13 decisions on the [design page](https://claude.ai/artifact/Jcd3FHddeyXRKjE2sXPdZW) and said: "Use the recommended option for every decision and start the work in the order D13 recommends." The decisions are recorded in [NEXT_STEPS.md](../../NEXT_STEPS.md), "Made by the founder on October 21 (Lost pet alerts)". The design page has the principles, the ten screen sketches (O1–O4, N1–N2, W1–W2, F1, R1) and the reasons; this file is what the lanes build against. Code references are to master `4289603b4`.

## 1. What it is

When a pet goes missing, the owner adds a photo, the pet's name and kind, and where and when it was last seen. Pantopus then:

1. alerts people whose home or saved place is within the radius (held during their quiet hours);
2. makes a print-ready flyer with a QR code and one short link for Facebook groups, Nextdoor and texts;
3. opens a public pet page where anyone can report "I saw them" without an account, and the household sees each sighting on a map;
4. compares photos of found pets and sightings with missing pets nearby, after the founder's privacy step (section 3, rule 8);
5. ends when the owner marks the pet home, closes it, or it expires; the people who helped hear "home".

Found pets use the same flow with "Found" in place of "Lost".

## 2. Decisions

| # | Decision | Chosen |
|---|---|---|
| D1 | Name | "Lost pet alert" in the app; the pet page may say "Help bring Biscuit home" |
| D2 | Who can send | Signed in, with a home, a saved place, or a GPS fix under 5 minutes old, within 5 km of the last-seen spot; a private home setup counts |
| D3 | Reach | 1 mile (1609 m) for dogs and other pets; half a mile (805 m) for cats |
| D4 | Who is alerted | People with a home (active occupancy) or a saved place inside the radius, with the new "Lost pets near me" switch, which starts on |
| D5 | Night | Pushes wait for each person's quiet hours to end (default 9 pm to 8 am); the pinned Nearby card shows right away |
| D6 | Reports without an account | Yes, on a web page; where and when required; photo, note and contact optional; strict limits. An exception to the mobile-only rule, like the Plans share preview |
| D7 | Who sees sightings | The household sees exact points; everyone else sees an area label and the time |
| D8 | Contact | Through Pantopus; no phone number unless the owner adds one; no reward field |
| D9 | Photo matching | Yes; found-pet and sighting photos against open lost alerts within 3 miles from the last 14 days; the household is told directly, not as a Suggestion |
| D10 | Found pets | Alert the same people under the same caps |
| D11 | Saved pets | After alerts are live: bring back only the pets list from `household_extras`, with "Report missing" on each pet (a later wave; not in this contract's first release) |
| D12 | Tables | `PetAlert` and `PetSighting` |
| D13 | Rollout | Behind a new `pet_alerts` flag: detailed screens on a design canvas while the backend is built, then the apps, then staging, then the pilot area (Vancouver, Camas, Washougal), then everyone |

## 3. Rules that hold everywhere

1. **Flag.** A `FeatureFlag` row `pet_alerts`, inserted off, as `plans` was (`supabase/migrations/20261013060000_nearby_plans.sql`). Signed-in routes use `requireFeatureFlag('pet_alerts')` (`backend/middleware/requireFeatureFlag.js:28`). The public endpoints and web pages answer 404 unless the alert's creator has the flag, as the Plans preview works only while the host has Plans. With the flag off for everyone, nothing new is visible anywhere.
2. **The home is never shown.** The true last-seen point and sighting points are stored and returned to the household only. Everyone else gets the area rule post pins already follow (`backend/utils/locationPrivacy.js:106`: snap to the 0.005° grid, then the keyed jitter) and a generated label. The label names the nearest named public place within 400 m from the source the Plans place picker uses, else the neighborhood or city. Typed place names are never shown publicly (today a post keeps `location_name`; the alert writes its own).
3. **No names on public surfaces.** The public endpoint and pages show the pet's name and "Biscuit's family", never the owner's name, handle, avatar, home or account id. The public endpoint returns a fixed list of safe fields (section 5.2), like `backend/services/plans/planPublic.js`, never a whole row.
4. **Phone numbers and rewards.** No phone number unless the owner turns on "Show my phone number" (off by default) and types one; there is no reward field. The pet page, the flyer and the first message from someone new carry: "Never pay anyone or read out a code before your pet is home."
5. **Photos.** A lost alert needs 1 to 4 photos; a found alert needs 1. They use the post-media upload path (`backend/routes/upload.js:1093`), which strips location data, with one change for these uploads: if stripping fails, refuse the upload instead of keeping the original. Images only (no GIF, video or Live Photo). Sighting photos are private: stored outside the public post-media path and served to the household through short-lived signed links, never as public URLs.
6. **Pushes.** The nearby alert goes out through held pushes (`backend/services/heldPushes.js`, `pushOrHold`), so quiet hours hold it. Per person, at most one nearby lost-or-found push a day and three a week; alerts over the cap still appear pinned in Nearby and in the morning briefing. Never to anyone in the sender's household. Only people with `lost_pets` on (default true).
7. **Limits.** One open alert per pet and at most two open per household. Sightings: at most 5 per device an hour, 3 per device per alert an hour, and 60 per alert an hour across everyone; links are removed from notes; a device is an HMAC of the IP and user agent with a server secret, never the raw IP. Rate limiters live in `backend/middleware/rateLimiter.js` (in-memory per process).
8. **AI waits for the privacy step.** The photo check (section 7.2) and photo matching (section 7.3) send photos to the AI provider. They stay off on every hosted environment until the founder's privacy step is done: [#2472](https://github.com/WangPantopus/skinny-pantopus/pull/2472) merged, the Anthropic retention setting confirmed, and the policy covering photos from people without an account. A server switch `PET_ALERT_PHOTO_AI` (default `off`) controls both. Until then an alert's push goes out without the check, and matching is the existing word-only pairing. Locally the lanes may run them on to build and verify.
9. **Links stay native-resolvable.** Every notification link is `/pet/<code>`, which both apps route (section 8.2). See `frontend/apps/web/src/lib/notificationRoutes.ts` for how other types are remapped.
10. **No new unit tests.** Verify by using the web app, the iOS simulator and the Android emulator against a local backend and database (AGENTS.md). Additive migrations only.

## 4. Data (one additive migration, plus later small ones if needed)

### 4.1 `PetAlert` (one per lost or found pet)

| Column | Notes |
|---|---|
| `id` uuid pk | |
| `post_id` uuid not null unique → `Post(id)` on delete cascade | The public card in the feed: `post_type` `lost_found`, `lost_found_type` = kind, `location_precision` `approx_area`, public and externally shareable |
| `home_id` uuid null → `Home(id)` | The household that manages it (null for a person without a home) |
| `created_by` uuid not null → `User(id)` | |
| `home_pet_id` uuid null → `HomePet(id)` | For D11 later; null now |
| `kind` text: `lost` \| `found` | |
| `species` text: `dog` \| `cat` \| `other` | |
| `species_label` text null, ≤ 30 | For `other`: "bird", "rabbit"; drives the flyer headline ("LOST BIRD") |
| `pet_name` text null, ≤ 40 | Required for `lost`, optional for `found` |
| `description` text not null, ≤ 280 | |
| `seen_at` timestamptz not null | Last seen (lost) or found at (found) |
| `seen_point` geography(Point) not null | True point; household only |
| `seen_label` text not null, ≤ 80 | Public label (rule 2) |
| `radius_m` int not null | 1609 or 805 (D3) |
| `status` text: `open` \| `home` \| `not_home` \| `closed` \| `expired`, default `open` | |
| `show_phone` boolean not null default false; `contact_phone` text null | Phone only when `show_phone` |
| `code` text not null unique | 6 characters, Crockford base32, for `pantopus.com/pet/<code>` |
| `photo_check` text: `pending` \| `passed` \| `failed` \| `skipped`, default `pending` | `skipped` while `PET_ALERT_PHOTO_AI` is off |
| `pushed_at`, `repushed_at` timestamptz null; `push_recipients` int not null default 0 | |
| `watchers` uuid[] not null default '{}' | "Keep an eye out", at most 1000 |
| `expires_at` timestamptz not null; `extended_at` timestamptz null | 14 days; one extension of 14 days |
| `ended_at` timestamptz null; `thanks_note` text null, ≤ 280 | |
| `created_at`, `updated_at` timestamptz | |

Indexes: `(status, expires_at)`, GiST on `seen_point`, `(home_id)`, `(created_by)`.

### 4.2 `PetSighting`

| Column | Notes |
|---|---|
| `id` uuid pk; `alert_id` uuid not null → `PetAlert(id)` on delete cascade | |
| `seen_at` timestamptz not null | Not in the future; not before the alert's `seen_at` minus 1 hour |
| `point` geography(Point) not null | Exact; household only. Within 25 km of `seen_point` |
| `area_label` text not null, ≤ 80 | "near 8th St", same rule as section 3 rule 2 |
| `note` text null, ≤ 280 | Links removed |
| `photo_key` text null | Private storage key |
| `reporter_user_id` uuid null → `User(id)` | Set when signed in |
| `reporter_contact` text null, ≤ 120 | Email or phone; household only |
| `device_hash` text not null | Rule 7 |
| `hidden_at` timestamptz null; `muted_device` boolean not null default false | Set by the household |
| `created_at` timestamptz | |

Indexes: `(alert_id, created_at desc)`, `(device_hash, created_at)`.

### 4.3 Other additive changes

- `UserNotificationPreferences.lost_pets boolean not null default true`.
- A SQL function returning the user ids to alert: active occupants of homes within `radius_m` of the point, plus owners of saved places within it, minus the sender's household and people with `lost_pets` false. Build it on the same occupancy rule as `count_neighbors_within` (application baseline migration). The old `find_homes_nearby` was never created in a migration; don't depend on it.
- The `FunnelEvent` CHECK widened with the events in section 9, and the `pet_alerts` flag row.
- The post's `resolution` uses existing values: `reunited` when the pet is home, `closed` for not home or closed, `expired` when it times out.

## 5. API

### 5.1 Signed in (`verifyToken`, `requireFeatureFlag('pet_alerts')`)

- `GET /api/pet-alerts/reach?lat&lng&species` → `{ "count_label": "About 140" | "Fewer than 10" }`. Rounded to the nearest 10 from 10 up; below 10 always "Fewer than 10".
- `POST /api/pet-alerts` with `{ kind, species, species_label?, pet_name?, description, media_urls[], seen_at, seen: {lat, lng}, home_id?, show_phone?, contact_phone? }` → 201 `{ alert, share_url, flyer_url }`. Checks D2 with `canPostToPlace` (`backend/utils/trustState.js:488`) or a home or saved place within 5 km, and the limits in rule 7. Creates the post and the alert in one go, then queues the photo check and the push (section 7).
- `GET /api/pet-alerts/:id` → the household view (exact points, phone, watchers count, sighting count, match notices) or the neighbor view (section 5.2's fields plus `is_watching`).
- `GET /api/pet-alerts/mine` → the household's alerts, open first.
- `GET /api/pet-alerts/nearby` → open alerts whose radius covers the person's home or saved places, for the pinned Nearby card. Neighbor view fields only.
- `PATCH /api/pet-alerts/:id` (household) with any of `{ description, seen, seen_at, show_phone, contact_phone, extend: true, end: "home" | "not_home" | "closed", thanks_note }`. Moving `seen` more than 800 m sends one more push, only to people near the new spot who weren't alerted before (`repushed_at`, once per alert). `extend` works once, from the day before it ends.
- `GET /api/pet-alerts/:id/sightings` → exact for the household; `{ area_label, seen_at }` for everyone else; hidden sightings only for the household.
- `POST /api/pet-alerts/:id/sightings` → a signed-in report, same body as 5.2's.
- `PATCH /api/pet-alerts/:id/sightings/:sid` (household) `{ hidden: true, mute_device?: true }`.
- `POST` / `DELETE /api/pet-alerts/:id/watch` → "Keep an eye out".

Ending: `home` sets `status` home, the post's `resolution` `reunited`, notifies helpers (section 6) and shows the reunion card; `not_home` and `closed` notify nobody; `not_home` shows no celebration anywhere.

### 5.2 No account (under `/api/public`, own rate limiters)

- `GET /api/public/pets/:code` → `{ kind, species, species_label, pet_name, description, photos[], seen_label, seen_at, status, area: {lat, lng}, sightings: [{area_label, seen_at}] (visible, newest 20), phone (only if shown), thanks_note (only when home), ends_at, share_url }`. 404 when the code is unknown or the creator lacks the flag. No ids, names, handles, avatars or exact points.
- `POST /api/public/pets/:code/sighting-photo` (multipart, one image ≤ 10 MB) → `{ photo_token }`. Rule 5; rate-limited like sightings.
- `POST /api/public/pets/:code/sightings` with `{ seen_at, point: {lat, lng}, note?, photo_token?, contact? }` → 201 `{ ok: true }`, or 429 with "Too many reports from this device. Try again in a few minutes." Only while the alert is open.

### 5.3 Web pages (Next.js; signed in or not)

- `/pet/[code]`: the pet page (sketch W1). Indexed while open; `noindex` once ended, showing "Biscuit is home" or "This alert has ended". Share preview image from the pet's photo with "LOST DOG · Biscuit · near Esther Short Park". Footer: "Get alerts for lost pets near you" with the store buttons (reuse `getStoreDownloadCta` and `OpenInAppButton`). The middleware must not send signed-in visitors elsewhere: everyone sees this page.
- `/pet/[code]/seen`: the "I saw them" form (W2): a real map to place the point (Leaflet with the web app's Mapbox tiles), "Use my location", when (Just now / 15 min ago / Earlier with a time), photo, note, contact, and the line "Only Biscuit's family will see this."
- `/pet/[code]/flyer`: letter size, print styles, `window.print()` (the fridge card's pattern), a real QR code (`frontend/apps/web/src/components/ui/QRCode.tsx`) for `https://pantopus.com/pet/<code>`, six tear-off tabs with the short link, the scam line, and the phone only if shown. Fine in black and white.

## 6. Notifications

| Type | Who | When | Limits | Opens |
|---|---|---|---|---|
| `pet_alert_nearby` | Section 4.3's recipients | Through `pushOrHold` | 1 a day, 3 a week per person (lost and found together) | `/pet/<code>` |
| `pet_sighting` | Household | Right away, any hour | Grouped: more than 3 in 10 minutes become one "3 new sightings" | `/pet/<code>` (owner view) |
| `pet_match` | Household of the lost alert | Right away | At most 3 per alert a day | `/pet/<code>?match=<id>` |
| `pet_home` | Watchers, signed-in reporters; one email to reporters who left an email | Through `pushOrHold` | Once | `/pet/<code>` |
| `pet_alert_ending` | Household | The morning before `expires_at` | Once | `/pet/<code>` |

Words: title "Missing dog near Esther Short Park" / body "Biscuit, small tan terrier, last seen 6:40 pm. Tap to help." (found: "Found dog near the library" / "Small tan terrier, red collar. Is he yours?"). Lock-screen text never names the owner or an address. The morning briefing lists open alerts covering the person (no extra push). Android posts these to a new "Lost pets" channel.

## 7. Jobs

1. **Push** (`pet_alert_push`): after the photo check passes or is skipped; runs the recipient function, applies the caps, writes notifications through `pushOrHold`, and records `pushed_at` and `push_recipients`.
2. **Photo check** (`pet_alert_photo_check`, only with `PET_ALERT_PHOTO_AI=on`): one model call through `backend/services/ai/background.js` within the existing budgets (`assistantBudget.js`): an animal is shown; no people, faces, house numbers or license plates. Passed: push. Failed or unavailable: the alert still posts and shares, the push waits, and an admin alert email goes out (`backend/services/adminAlerts.js`).
3. **Photo match** (`pet_photo_match`, only with `PET_ALERT_PHOTO_AI=on`): when a found alert or a sighting with a photo arrives, compare it with open lost alerts of the same species within 3 miles from the last 14 days, at most 6 candidates per call; a "likely" verdict sends `pet_match` to the household with both photos, and never shares anyone's contact automatically. With the switch off, the existing word-only pairing in `backend/services/ai/nudges/nearby.js` keeps running as today.
4. **Lifecycle** (hourly): `pet_alert_ending` the morning before; `expired` at `expires_at` (post `resolution` `expired`); 30 days after an alert ends, delete its sightings, their photos and reporters' contact details.

## 8. Apps (iOS and Android)

### 8.1 Screens (the design canvas has the detailed boards; the sketch ids are on the design page)

- **Report (O1, O2):** entered from the Nearby composer's Lost & Found ("Lost pet" / "Found pet"), from the missing-pet heads-up (iOS gains that option), and from Ask. Photo picker (1–4), name, kind chips, description, the last-seen map with the radius drawn as an area, time chips, then the reach line (`/reach`), "Show my phone number" (off), the scam line and "Send alert". Afterwards: "Make flyer" (opens `flyer_url` in the browser for printing), "Copy link", the system share sheet.
- **Owner's page (O4):** map with the area and sighting pins (exact), the sightings list, the match banner, Share, Flyer, "Biscuit is home", the day-before "Keep it open 14 more days", and Close (with "Not coming home").
- **Neighbor's page:** photo(s), details, last-seen area and time, sighting areas, "I saw him" (an in-app form like W2), Share, "Keep an eye out".
- **Pinned card (N2):** at the top of Nearby › Pulse while an open alert covers the person; dismissable per alert on the device.
- **Match (F1)** and **Home (R1)** as sketched; "Not coming home" closes quietly with no card.
- **Settings:** "Lost pets near me" in notification settings on web, iOS and Android; the Android "Lost pets" channel.

### 8.2 Links

`https://pantopus.com/pet/<code>` and `pantopus://pet/<code>` open the pet page: the owner's view for the household, the neighbor's view for everyone else. iOS: add `/pet/*` to `frontend/apps/web/public/.well-known/apple-app-site-association` and the deep-link router. Android already claims every pantopus.com path; add the route.

### 8.3 Flag

The apps show every entry point only when the server's flags include `pet_alerts`, the way they read `plans`.

## 9. Funnel

Events: `pet_alert_created`, `pet_flyer_opened`, `pet_link_shared`, `pet_page_viewed` (anonymous beacon), `pet_sighting_sent` (anonymous), `pet_app_clicked` (anonymous), `pet_home`. A `pets` block in `backend/services/funnelReport.js`, like the `plans` block, with the success signals on the design page.

## 10. Who builds what

| Lane | Builds | Merges |
|---|---|---|
| PD design | A design canvas "Lost Pet Alerts Screens" on the Pantopus design system: every screen in section 8.1 with its states (empty, nobody nearby, limits, errors, ended), the web pages in 5.3, the flyer for dog, cat and other in color and black and white, light and dark | Nothing to merge; the founder reviews the canvas |
| PB backend + web | Sections 3–7 and 9, the web pages and the web settings switch. PR 1: data, flag, create and push, reach, public endpoint, web pet page and flyer. PR 2: sightings (signed in and public), owner and neighbor views, watch, end and extend, lifecycle and cleanup, notifications. PR 3: photo check and matching behind the switch | First, in that order |
| PI iOS | Section 8 | After PB's PR 2 |
| PA Android | Section 8 | After PB's PR 2 |

Every lane follows AGENTS.md, keeps PRs small, verifies in the real apps, and merges its own PRs through the shared queue (HOLD and RELEASE in `launch-streams/status/REQUESTS.md`). A backend merge releases to production with its migration; the flag stays off there until the founder turns it on.

## 11. Done when

With `pet_alerts` on locally, verified in the real apps against a local backend and database, with two or more accounts and a signed-out browser:

1. An owner reports a lost dog on iOS; a neighbor inside the radius gets the push on Android, one outside doesn't, the owner's household doesn't, and a neighbor in quiet hours gets it when they end.
2. The flyer prints from the web; its QR code opens `/pet/<code>`.
3. A signed-out visitor reports a sighting with a photo and an email; the household gets a push and sees the exact pin and photo; another neighbor sees only the area and time; the public endpoint shows no names, ids, phone or exact points.
4. A found dog posted on Android with the switch on locally reaches the owner as a match; with it off, nothing is sent to the AI provider.
5. "Biscuit is home" notifies watchers and reporters once (push and one email), the page shows the ended state and drops out of search; "Not coming home" sends nothing.
6. The limits hold: two open alerts per household, the sighting limits, the per-person caps, and the "Lost pets near me" switch.
7. Links from every notification and from `/pet/<code>` open the right screen in both apps, after a relaunch too.
8. With the flag off, nothing new shows anywhere and the public page answers 404.

## 12. The founder's steps

1. The privacy step (rule 8) before `PET_ALERT_PHOTO_AI` is turned on anywhere hosted.
2. Turning `pet_alerts` on: staging first, then the pilot area, then everyone. The flag has no map, so "the pilot area" means adding the pilot households' accounts to the flag's beta list through the admin route; "everyone" is `enabled_globally`, through the admin route or a migration like `20261020082000_plans_on`.
3. Store builds with the new screens, and a check on physical phones.
