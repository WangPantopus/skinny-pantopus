# Location Privacy Matrix

Defines how location coordinates are exposed across entity types, viewer
relationships, and precision levels. **Every API response that includes
coordinates MUST pass through `applyLocationPrecision()` before serialization.**

## Precision Levels

| Level              | Coordinate Treatment            | Address Text       | Map Pin         |
|--------------------|---------------------------------|--------------------|-----------------|
| `exact_place`      | Full lat/lng (6+ decimals)      | Full address       | Exact pin       |
| `approx_area`      | Grid cell + keyed ~500m offset (below) | City, State only | Fuzzy circle |
| `neighborhood_only`| Rounded to ~0.01 (~1km)         | Neighborhood/City  | Area indicator  |
| `none`             | `null` / omitted                | Omitted            | No pin          |

## Entity Rules

### Homes

| Viewer Relationship | Coordinates Returned     | Address  |
|---------------------|--------------------------|----------|
| Household member    | exact (from Home record) | Full     |
| Non-household       | **NEVER**                | City/State only |
| Public/anonymous    | **NEVER**                | City/State only |

> Homes are the most sensitive entity. Exact coordinates must never leak to
> anyone outside the household. The `Home` table's `location` column is only
> used for server-side distance calculations — it is never serialized to
> non-household API responses.

### Businesses

| Viewer Relationship | Coordinates Returned     | Address  |
|---------------------|--------------------------|----------|
| Owner / team member | exact                    | Full     |
| Public              | exact (owner controls)   | Full     |

> Business locations are intentionally public and discoverable. Owners opt-in
> to showing their address. No precision downgrade is applied.

### Gigs

| Viewer Relationship            | Coordinates Returned                       | `locationUnlocked` |
|--------------------------------|--------------------------------------------|---------------------|
| Creator / beneficiary          | exact (always)                              | `true`             |
| Accepted helper (assigned/active/in_progress/completed) | exact | `true`             |
| Browsing (not assigned)        | Respect `location_precision` field          | `false`            |
| `reveal_policy = after_assignment` | `approx_area` until assigned, then exact | status-dependent   |
| `reveal_policy = never_public` | `approx_area` always for non-owner          | `false`            |

Default `location_precision`: **`approx_area`**
Default `reveal_policy`: **`after_assignment`**

**Progressive disclosure:** When a bid is accepted, the accepted helper's gig
status transitions to `assigned`. At that point `resolveGigPrecision()` returns
`exact_place` + `locationUnlocked: true`. A system message with the address is
also posted to the gig chat, and the bid-accepted notification includes the
address.

### Listings (Marketplace)

| Viewer Relationship            | Coordinates Returned                       | `locationUnlocked` |
|--------------------------------|--------------------------------------------|---------------------|
| Creator                        | exact (always)                              | `true`             |
| Address grantee (in `ListingAddressGrant`) | exact                       | `true`             |
| Browsing, `approx_area`        | the approximate point (below)               | `false`            |
| Browsing, `exact_place`        | the approximate point, unless `reveal_policy = public` | `false`  |
| Browsing, `neighborhood_only`  | none; `location_name` kept                  | `false`            |
| Browsing, `none`               | none; no name or address                    | `false`            |

Default `location_precision`: **`approx_area`**

Browsing viewers get the same point as posts: the grid-cell point under
[Approximate-area points](#approximate-area-points). Every listing from one
address shows one stable point, and it can't be recomputed without
`LOCATION_JITTER_SECRET`. Listing responses are built without `reveal_policy`,
so in practice an `exact_place` listing shows the approximate point to browsing
viewers as well.

**Searches use the shown point.** Every area filter, count, distance and sort
order a viewer gets is computed from the point that viewer is shown, never from
the stored point. The API reads stored points from the area widened by
`MAX_DISPLAY_OFFSET_DEGREES` (for radius searches, the same margin in meters),
applies location privacy, and keeps the
listings whose shown point is inside the requested area. A listing shown without
a point (`neighborhood_only`, `none`) is placed by its approximate point, which
is never returned. Searches read at most 500 candidates near the area, newest
first (1000 for counts). Specifically:

- `GET /api/listings/browse`, `/discover`, `/autocomplete`, `/in-bounds`, `/nearby`,
  `/search` and `/carousel` filter, measure `distance_meters` and order "nearest"
  by shown points. The "nearest" cursor carries the shown distance.
- Counts (`total_in_bounds`, `free_count`) and Discover's category sections are
  counted on the points a signed-out viewer is shown, because they are cached
  for everyone. Discover's cached sections are built as a signed-out viewer.
- `nearest_activity_center` (empty map) is the nearest shown point among
  listings shown on a map.
- The `listing:new` socket event carries the point a signed-out viewer is shown.
- `find_listings_in_bounds_v2` returns stored points to the API and only the
  service role may run it.

**Progressive disclosure:** Listing authors can explicitly reveal their address
to a buyer via `POST /api/listings/:id/reveal-address`. This creates a row in
the `ListingAddressGrant` table. The grantee then receives exact coordinates
and `locationUnlocked: true`. Authors can list grants (`GET`) and revoke them
(`DELETE`). A system message is posted to the listing chat upon grant creation.

### Posts (Feed)

| Viewer Relationship | Coordinates Returned                       | `locationUnlocked` |
|---------------------|--------------------------------------------|---------------------|
| Author              | exact (always)                              | `true`             |
| Other viewers, photo-placed post stored `exact_place` | exact | `true` |
| Other viewers, any other post | **Minimum `approx_area`** (permanent blur)  | `false`   |
| Everyone, the author included, a floating post (the Sky, below) | its stored area point, unmoved, with `area: { radius_m }` | `false` |

Default `location_precision`: **`approx_area`**
Home-place posts forced to: **`approx_area`** (enforced at creation time)

**Permanent blur:** Non-authors never see exact post locations, even if the
author set `location_precision = exact_place` and `reveal_policy = public`,
except for a photo-placed post (below). The feed service and post detail
endpoint enforce a floor of `approx_area` via `postPrecisionForOthers()`
(`services/feedService.js`).

**Photo-placed posts (decided 2026-11-05):** the founder asked that a post whose
photo or video was taken at the place show on the map exactly where it was
taken. The apps and the web composer read each attachment's capture point from
its own metadata and send it with the post (`mediaLocations`); the points are
evidence, never stored. When one was taken within 5 km of the tagged place
(`trustState.mediaCaptureNear`), `POST /api/posts` stores
`post_metadata.location_basis = 'photo'` (and `photo_taken_at`) and stores
`exact_place`: at the tagged venue or address, or at the capture point when the
tag is a town or an area or there is no tag. The founder chose an exact pin
everywhere, the author's own home included, over a home guard (2026-11-05).
It stays `approx_area` only for an alert (alerts never take `exact_place`) and
when the author asked for less.
Only `POST /api/posts` sets the basis (it drops a client's copy of either key);
an edit that moves the post or leaves it no photo or video clears the basis and
any exact pin, and an edit can't raise a post to `exact_place`.

**The Sky's places (phase A; `sky_places` flag, off everywhere until the founder
turns it on; accepted 2026-11-14).** With the flag on for the author, a personal
place post keeps an exact pin only at a **tagged venue where its own photo or
video was taken** (looked up again by its picker id), and not when that venue
is within ~60 m of a home the author lives at, nor when the author's homes can't
be read (a failed lookup counts as at home, founder 2026-11-20; the post still
goes up, floating, and `moments.at_home_failed` is logged). Schools and preschools take a pin
like any venue: the founder reversed call C9 on 2026-11-17 ("schools and
preschools should be allowed as a pin").
Everything else floats over its area ([Areas of at least 100 homes](#areas-of-at-least-100-homes)):
an address or town tag, a bare photo, no photo, a venue with no photo, and every
Home post (`POST /api/posts`, the Pulse-mode composer in `services/pulse/compose.js`,
and an edit that moves a post, `PATCH /api/posts/:id`). A floating post stores
**only the area's point** (`latitude`, `longitude`, the effective pair, and so
the PostGIS `location`), `approx_area`, no `location_address`, no
`location_basis`, an address tag's id removed, and `post_metadata.area =
{ v: 1, step, radius_m }`. Its `location_name` is what others read: a venue's or
town's name or the home's city, never a street line, else the area's town; at
home always the town. A post asked for with `neighborhood_only` or `none` keeps
that. The GPS fix and the photos' points are read as evidence and never stored.
Readers get the stored area point unmoved (`applyPostLocationPrivacy`,
`distanceText.displayedPoint`), the author too. The composers' place check
(`GET /api/posts/place-eligibility`) adds `sky: true` and `area: { label,
latitude, longitude, radius_m }` for a caller with the flag on, for their
"Floating over …" line; the label is the town at the area's own point.
In the apps (web, iPhone, Android; 2026-11-16) the composer's "Posting to …"
line becomes "Floating over Camas, WA" with a "Pin it at a place" button that
opens the place picker, and "At Esther Short Park" only when a venue is tagged
and one of the draft's photos was taken within 5 km of it (the server's rule);
the photo note says "The post floats over the area" otherwise. The web asks the
route once per place picked, a device spot included, for that line. With no
`sky` in the answer the composers are as before.

**Posts made before (the Sky on for everyone).** Old rows keep their exact
points (the founder decides any clean-up). Once `sky_places` is on for everyone,
`postPrecisionForOthers` shows an old photo-placed `exact_place` post exactly
only when its tag is a venue (`utils/postPlaceTag.js`: `geocode_place_id`,
`geocode_accuracy`, now in the feed's select but never in an answer); an address
tag or a photo with a town tag or none shows as an approximate-area point, without
"Photo taken here". The author still sees their own exact point.

A post made with the composer's "current location" target stores the device's
GPS fix, which differs by a few metres from post to post. Non-authors see the
grid-cell point described under [Approximate-area points](#approximate-area-points),
so every post from the same spot shows the same pin.

**Place label:** the author's own `location_name` is theirs to see. Everyone else
(signed in or not) reads a place or a town, never a street address or the home
itself (`placeLabelForOthers` in `services/feedService.js`, decided 2026-10-23):

- A Home post says its home's city. New Home posts have been labelled that way
  since October 6. Older ones carry the home's name, which is often its street
  address, and iOS sends the address for a home with no city.
- Any other label that starts with a house number is a street line, and nobody
  else sees it. That happens when an address is tagged as the place, or when a
  picker found no town. Place names ("Crown Park", "Near Prune Hill") and towns
  ("Camas, WA") are kept.

The full `location_address` is removed for these viewers like any other
address.

### Nearby Plans

A plan is a `Post` (the public card) plus a `Plan` row. The exact place never
goes on the Post: its point, venue name, street address and home live only on
`Plan` (server-only table), and reach only the host and people who are in,
through `PlanDetail` (`backend/services/plans/planService.js`).

| Viewer | Point | Place, address, note, people |
|--------|-------|------------------------------|
| Host, people who are in | exact, in `place` | yes |
| Anyone else allowed to see the plan | the public area point | never |

- **The area point is stored on the Post** when the plan is made: the exact
  point through `applyLocationPrecision` (`approx_area`, the grid-cell point
  under [Approximate-area points](#approximate-area-points); `neighborhood_only`
  for playdates). The map layer, lists, distance bands and radius filters all
  use the stored area point, never the exact one, so moving the viewer's
  point (or a reported GPS fix) around can't trilaterate the exact place.
- **Distances are bands** (`under_1_mi` … `about_5_mi`, none past 10 miles).
- **Plan posts are kept out of the generic surfaces:** `distribution_targets`
  is `{plans}` and `visibility` is `private`, so the Pulse feed, the posts map
  layer, other people's profile lists and `GET /api/posts/:id` don't show them
  to anyone but the host.
- **Playdates** don't exist for viewers without a verified address (or with
  the `plans_playdates` flag off), and show the part of the day instead of the
  time until the viewer is in.

### Moments

A Moment (a photo, a short video or a text card for 1–48 hours, on the Moments map; behind the `moments` flag) is
a `Post` with `is_story = true` (`backend/services/moments/momentStore.js`). Its pin is where the phone was when
posting (a GPS fix at most 5 minutes old) or, for a library photo or video taken in the last 24 hours, where it was
taken. Others see only what the author chose on the Post sheet, which shows the pin and the label first.

| Moment | Point everyone sees (author included) | Place label |
|--------|---------------------------------------|-------------|
| Exact pin (default) | the exact point | a named place, else the street's name without a number, else the town |
| "Show the area instead" | the grid-cell point under [Approximate-area points](#approximate-area-points) | the town |
| Posted within ~60 m of the author's own home | as chosen (the Post sheet warns first) | the town |

**With the Sky's places on for the author** (`sky_places` flag; the Sky design's phase A, accepted 2026-11-14, with
the rule the founder set on 2026-11-17 after trying it: a Moment is where it was taken, not at the middle of an
area), the server decides, whatever an app's sheet says:

| Moment | Point stored and seen (author included) | Place label |
|--------|-----------------------------------------|-------------|
| Where it was taken (the default) | the exact point | a named place (a school or a preschool too, since 2026-11-17), else the street's name without a number, else the town |
| "Pin it at a place": a public place close by, picked by name | the place's own point (from the venues index); the photo's own point when the place's is farther off than a place may be picked (the middle of a big park) | the place's name |
| Within ~60 m of the author's own home, always | only its area's spot: a public street close to the middle of the quarter-mile cell the home is in (below), never the home | the town at that spot |
| "Don't show where" | none | none |

- **How close a picked place must be** depends on how built-up the spot is, from the same homes file as the areas
  (`momentPlace.pickWithinM`): a mile (1,600 m) on the two most built-up steps (a quarter-mile cell with 100 homes or
  more, downtown, Manhattan, and the next), a mile and a half (2,400 m) on the middle step, and two miles (3,200 m)
  on the two most open; a mile where nobody counted the homes (abroad). The founder set these on 2026-11-17 in the
  evening ("when users pick a spot, we can allow a bit more further distance places to be searched, although still
  not too far"); before that they were 400 m, 800 m, 1,600 m, 2,400 m and 3,200 m. The preview's `pick_within_m`
  says it and the apps' place picker lists and finds no place farther. A place whose outline holds the spot is 0 m
  away. A `venue_id` farther off, or one nobody finds, is `422 PLACE_NOT_NEARBY`. So no pin is ever farther from
  where the photo was taken than that distance. A place nobody picked ("Pin it at a place" with nothing picked: the
  place at the spot itself) keeps the earlier distances: its pin moves to the place's own point only within 400 m,
  800 m, 1,600 m, 2,400 m or 3,200 m by the same steps, else it stays where the photo was taken.
- **A place is picked** with `pin: "place"`, a `venue_id` from the place picker, or a venue's `place_key`. A place
  within ~60 m of the author's home takes no pin: the Moment stays where it was taken. Schools and preschools take a
  pin like any place (founder 2026-11-17, reversing call C9 of the Sky design).
- **A Moment at home floats over a street close by** (founder 2026-11-17: at home it stays an area, but a very
  close one, never miles off). Its spot is worked out from the cell only (`momentPlace.closeArea`): the 0.005° cell
  holding the home (about 0.35 by 0.25 mile), then the point on a public street (OpenStreetMap: residential to
  primary roads, no driveways or footpaths) closest to the cell's middle and within 200 m of it; with no street
  there, or none found in time, the cell's middle. Every home in the cell shows the same spot, so many Moments never
  narrow it down, and it is at most about a third of a mile from the home. This is closer than the 100-homes areas
  Pulse posts use: in the countryside a cell holds few homes. The street spot is looked up once per cell and kept
  for a month (`services/geo/streets.js`).
- **At home the phone's point is never written:** `latitude`, `longitude` and the effective pair hold that spot,
  with `location_precision` `approx_area`, `show_area` true (so apps from before draw an area) and
  `post_metadata.area = { v: 1, step: 1, radius_m }` (`radius_m` reaches the whole cell from the spot). The exact
  point is used only while the request is handled (the home check). The same goes for a Moment sent with
  `show_area: true`: the "Show the area instead" of an app from before the Sky, and a Post sheet built between
  November 16 and 17, which showed the area unless a place was picked.
- **On the map a Moment over its area floats:** its ring says `floating: true` and the apps draw the disc with no
  pointer, low over its spot with a soft shadow under it, by day and by night, so it never reads as an exact pin.
- **Height:** a Moment over its area away from home (one sent with `show_area`) keeps feet rounded to 100; a pin
  keeps 10; at home, none.
- **The preview** (`POST /api/moments/place-preview`) adds `sky`, `area` (the town, the street spot and
  `radius_m`: what a Moment at home shows), `place` (the public place a pin would use) and `can_pin` (false at home)
  for a caller with the flag on; its names include schools and preschools (since 2026-11-17).
- **Share later** (`share_later: "1h" | "3h" | "tonight"`): the Moment is made at once but until its time only its
  author can read it (`state: "scheduled"`, `share_at`); it is on no map, in no ring and in no push. At its time its
  `created_at` becomes the time it went live, so nobody reads when its author was there; new apps say "Earlier today"
  (or "Yesterday") for it (`earlier: true`).
- **In the apps** (iPhone and Android, 2026-11-17): the Post sheet draws the Sky only when the preview answers `sky:
  true`: the name of where it was taken with the exact pin and "Exact" by default; "Pin it at a place" (the place
  naming the spot, else the place picker, schools and preschools included since 2026-11-17) sends `pin: "place"` and shows "At
  Esther Short Park"; at home "Around Washougal, WA" with the area's disc and a note, with the pin and the elevation
  greyed out; "Share later" sends `share_later`. A Moment at home also sends `show_area: true`, so it shows only its
  area even if the flag went off meanwhile.
- Area Moments made before the flag keep the grid read below until they end (48 hours at most).

- **No live location, no trail:** only the posted point is stored; nothing joins one Moment to the next.
- **The author may pick the name, never write it:** the Post sheet lists the names that fit an exact pin
  (`places` on `POST /api/moments/place-preview`: the places at or within about 100 m, then the street's name
  without a number, then the town). Posting sends back only a key from that list (`place_key`); the server works
  the list out again for the Moment's own point, and an area or at-home Moment says the town whatever was picked.
- **The push to connections says no more than the ring:** "Priya added a Moment" / "At Esther Short Park" ("On" a
  street's name, "In" a town; an area or at-home Moment always says the town), the same label everyone reads, with
  no picture, caption or card text (`backend/services/moments/momentNotify.js`). It goes only to accepted
  connections who could open the Moment and whose app has Moments.
- **Rings group by what viewers see:** an exact pin's ring is its 0.005° cell, an area pin's ring (a floating
  Moment's too) its displayed point, so grouping never places an area Moment more precisely than its own point.
- **Map queries filter on displayed points:** `GET /api/moments/map` reads stored points in a box widened by
  `MAX_DISPLAY_OFFSET_DEGREES` on whole neighborhood cells, then keeps the Moments whose displayed point is in view.
- **Height is the author's choice, and never at home:** with "Show height" on (behind the `moment_heights` flag),
  the phone sends how high above sea level the Moment was made. The server keeps feet rounded to 10 in the Moment's
  own details (`altitude_ft`, `store.shownAltitude`), and nothing for a Moment at home, shown as an area or with no
  location, for a reading that can't be right or that the phone says is rough, or while the flag is off for the
  author. No speed is kept, only whether the Moment was posted from the air (`flying`). Viewers get the height only
  while the flag is on for them (`GET /api/moments/…`, and each ring of `GET /api/moments/map`). The map answer's
  `heights_on` says only whether the flag is on for the caller.
- **The Live mark, never at home:** a photo or video the app's camera made reads "Live from here" for 15 minutes,
  then "Taken here" (`taken_here`, `live_until`; [API v4.1](product/moments/api-v4.1.md), 2026-11-20). The server keeps
  it only for a fresh GPS fix shown at its exact pin away from home: never at home (asked where the author stands, and
  dropped when their homes can't be read), shown as an area, floating or with no location, nor for an album item,
  and every read checks again. A map ring carries `live_until` only when the Moment its point shows is such a pin. A
  Moment shared later reads "Taken here", never "Live". Its weather stamp is read by the server at the pin (a phone's
  value is never stored) and kept only with the mark; the preview looks the weather up only away from home.
- **A home lookup that fails counts as at home** (founder, 2026-11-20): when the author's homes can't be read, posting
  a Moment treats them as at home for everything that shows where they are. With the Sky on it floats over its area;
  either way it says its town and keeps no height or Live mark, a place picked beside a home takes no pin, and the
  preview answers `at_home: true`, so the Post sheet shows what the post will do. The post still succeeds and the
  failure is logged (`moments.at_home_failed`). Someone with no home is never at home. Before, a failed read counted
  as "not at home" and a Moment made at home kept its exact pin, the place's name and its height.
- **Files carry no location:** photo EXIF and video location tags are removed on upload (`photoMetadata.js`,
  `videoMetadata.js`); files sit in private storage behind 15-minute signed links and are deleted 7 days after the
  Moment ends (sooner when its author deletes it) unless a report holds them. Deleting the account deletes all of
  its Moment files at once (`DELETE /api/users/account`, `momentMedia.removeAccountFiles`).
- **Kept out of the generic surfaces:** `distribution_targets` is empty, `visibility` is `private`, they're off
  profiles, and `feedService.onlyShownPosts` and `readAccess.canReadPost` refuse `is_story` rows, so no feed, posts
  map layer, profile list or post route shows one, its author's included.
- **The pin and label can't be changed afterwards:** the generic post routes that act on an author's own row
  (`PATCH`, `DELETE`, archive and restore under `/api/posts/:id`, and `POST /api/upload/post-media/:postId`) refuse
  an `is_story` row, so a Moment's point, place label and text stay what the Moments routes stored, and it ends
  only through `DELETE /api/moments/:id` (which also deletes its private files, or keeps them for a review).

### Travelling Christmas cards

A Christmas card that travels (launch key `card_travel`; `docs/product/travelling-card-2026-11-21`, decided by the
founder 2026-11-21) collects one stop per town it reaches. A stop is a town and a state, never a person's point.

| Field | Where it comes from | Who sees it |
|-------|---------------------|-------------|
| Town and state ("Boise, ID") | the person's home's town, else the town they keep in their profile (`User.city`, `state`) | the public journey page (`GET /api/mailbox/cards/journeys/:journey`, web `/cards/journey/<id>`), the envelope's postmarks, the share pictures, the notices |
| `lat` / `lon` | **the town's own centre** from the bundled Census lists (`backend/data/travelTowns.json`), the same for everyone in that town | the public journey page (to draw the map) |
| A home's or person's own point | — | **NEVER** stored on the card or sent to any app |
| Names, addresses, notes, ids of people or mail | — | **NEVER** on the journey page, the share pictures or the link preview |

- Someone outside the United States is the stop "Abroad", with no point.
- The journey's id is random and long; it is in the page's address and nowhere else public.
- `GET /cards/towns` with no text suggests the nearest town to the person's resolved location; the location itself
  is never returned or kept.

### Saved / Viewing Places

These are per-user preferences stored locally or in `SavedPlace`.
**Never exposed to other users** in any API response.

## Implementation

### Backend Utility

`backend/utils/locationPrivacy.js` exports:

```js
applyLocationPrecision(obj, precision, isOwner, opts)
// opts.setUnlockedFlag (default true) — sets obj.locationUnlocked
resolveGigPrecision(gig, viewerId)
// Returns { precision, isOwner, locationUnlocked }
precisionRank(precision)
leastPrecise(a, b)
```

- If `isOwner === true` → return coordinates unchanged, `locationUnlocked: true`
- If `precision === 'exact_place'` → return coordinates unchanged, `locationUnlocked: true`
- If `precision === 'approx_area'` → grid-cell point (below), strip address, `locationUnlocked: false`
- If `precision === 'neighborhood_only'` → round to 2 decimals (~1km), strip address, `locationUnlocked: false`
- If `precision === 'none'` → null out lat/lng, strip address and location_name, `locationUnlocked: false`

#### Areas of at least 100 homes

A floating post (the Sky, behind `sky_places`) stores and shows `areaPoint(lat, lng)` from
`backend/utils/areaCells.js`: the centre of a square of whole 0.005° cells in one of five sizes (0.005°, 0.01°, 0.02°,
0.05°, 0.1°; each aligned to multiples of its size), rounded to 5 decimals, with no secret offset, and `radius_m`,
half the square's diagonal rounded up to 10 m, for the disc apps draw. The size is the smallest whose square holds
at least 100 homes counting only the places that share that square at that size (so a post shown over a square
always stands for 100 homes), read from a file built from the 2020 Census housing counts by block
(`backend/scripts/area-cells/build.cjs`). The file ships with the server (`backend/data/area-cells`, the whole US), so
every server reads the same areas with nothing to publish or set; `AREA_CELLS_URL` points a server elsewhere. Where
that isn't so even at 0.05°, abroad, and if the file can't be read, it is 0.1° (about 7 by 5 miles). The answer depends on the place only, so many posts from
one spot show one area and never narrow it down.

#### Approximate-area points

`approx_area` never offsets the true point directly. It uses the fixed grid of
0.005° cells (200 per degree; about 555 m north–south and 390 m east–west at
45.6°N):

1. Find the cell that holds the true point: `floor(lat × 200)`, `floor(lng × 200)`.
2. Move the cell's center by up to ±0.005° on each axis. The offset is an HMAC
   of the cell's indices keyed with `LOCATION_JITTER_SECRET` (falling back to
   the service-role key), so it can't be recomputed without the secret.
3. Round to 3 decimals.

Every point in the same cell therefore gets the same displayed point, and it
stays the same across reloads. Posting again from the same spot with a slightly
different GPS fix shows the same pin and reveals no more than one post would;
averaging many posts no longer narrows down where they were made. The displayed
point is less than 0.008° from the true point on each axis. A place within a few
metres of a cell edge can fall in either cell, so its posts may show two pins.
Owners (`isOwner`) always keep their exact values.

`backend/services/marketplace/locationPrivacy.js` exports:

```js
applyLocationPrivacy(listing, viewerUserId, opts)
// opts.grantedUserIds — Set of user IDs with address grants
applyLocationPrivacyBatch(listings, viewerUserId, opts)
// opts.grantsByListingId — Map<listingId, Set<userId>>
applyLocationPrivacyWithSearchPoints(listings, viewerUserId, opts)
// the shown listings, each with the point searches may use
widenBounds(bounds), widenRadiusMeters(radiusMeters), isPointInBounds(point, bounds)
```

- Grantees (users in `ListingAddressGrant`) get exact coords + `locationUnlocked: true`
- Browsing viewers get the approximate point from `applyLocationPrecision`

### API Response Flag

All entity endpoints now include a `locationUnlocked` boolean:
- `true` — client may show exact pin, full address string, remove blur circle
- `false` — client should show radius circle, hide street-level address

### Where Applied

| Route / Service                         | Entity   | Status |
|-----------------------------------------|----------|--------|
| `GET /api/gigs/:id`                     | Gig      | Fixed  |
| `GET /api/gigs` (list)                  | Gig      | Fixed (per-viewer `resolveGigPrecision`) |
| `GET /api/gigs/browse` (v2 RPC)        | Gig      | Fixed (privacy loop before sectioning) |
| `GET /api/gigs/nearby`                  | Gig      | Fixed (privacy loop on results) |
| `GET /api/gigs/in-bounds`              | Gig      | Fixed (privacy in enrichment) |
| `feedService.normalizeFeedPostRow()`    | Post     | Fixed (permanent blur via `leastPrecise`) |
| `GET /api/posts/:id`                    | Post     | Fixed (permanent blur for non-authors) |
| `GET /api/posts/feed` (Nearby, saved place, Sports) | Post | Fixed (displayed points only, see [Post Feed Rules](#post-feed-rules)) |
| `GET /api/posts/:id/matched-businesses` | Post     | Fixed (no stored-point distances or order for non-authors, see [Post Feed Rules](#post-feed-rules)) |
| `GET /api/posts/map` (posts layer)      | Post     | Fixed (displayed points only, see [Post Map Rules](#post-map-rules)) |
| `GET /api/posts/map` (`nearest_activity_center`) | Post | Fixed (`findNearestMapPost`, see [Post Map Rules](#post-map-rules)) |
| `GET /api/listings/:id`                 | Listing  | Fixed (grant-aware, `locationUnlocked`) |
| `GET /api/listings/browse`, `/discover`, `/autocomplete` | Listing | Fixed (filters, counts, distances and order on shown points) |
| `GET /api/listings/search` (RPC)        | Listing  | Fixed (radius and distances on shown points) |
| `GET /api/listings/search` (fallback)   | Listing  | Fixed (viewer-aware) |
| `GET /api/listings/user/:userId`        | Listing  | Fixed (viewer-aware) |
| `GET /api/listings/carousel`            | Listing  | Fixed (radius, ranking and one-per-seller on shown points) |
| `GET /api/listings/in-bounds`           | Listing  | Fixed (box on shown points; stored points from the RPC) |
| `GET /api/listings/nearby`              | Listing  | Fixed (radius, distances and order on shown points) |
| `listing:new` socket event              | Listing  | Fixed (signed-out viewer's point) |
| `POST /api/listings/:id/reveal-address` | Listing  | New (creates grant + chat msg) |
| `GET /api/listings/:id/address-grants`  | Listing  | New (author-only) |
| `DELETE /api/listings/:id/address-grants/:userId` | Listing | New (revoke grant) |
| Home routes (all)                       | Home     | No coordinates returned to non-members (verified) |
| Business discovery                      | Business | exact (intentional) |

## Pin Visibility Rules

### Verified vs Unverified Pin Rendering

Businesses with a verified address (`BusinessLocation.decision_status = 'ok'`)
are returned with `verified: true` in the map marker response. The frontend
should render these with a distinct visual treatment (e.g., checkmark badge,
solid border) to distinguish them from unverified listings.

| Entity Type     | Pin Visible On Map? | Verified Badge? | Coordinate Source            |
|-----------------|---------------------|-----------------|------------------------------|
| Verified Business | Yes (public)       | Yes (`verified: true`) | Address validation pipeline |
| Unverified Business | Yes (public)     | No              | Mapbox geocode               |
| Home            | **NEVER** (public)   | N/A             | N/A (household-only access)  |
| Gig             | Yes (public)         | No              | Precision-controlled         |
| Listing         | Yes (public)         | No              | Precision-controlled         |
| Post            | Yes (public)         | No              | Precision-controlled         |

### Home Pin Rules (Critical)

Home pins are **only** visible to household members. Even verified homes with
verified addresses must NEVER appear on public map surfaces:

- `GET /api/businesses/map` — only returns businesses, never homes
- `GET /api/posts/map` — returns post locations, not home coordinates
- `GET /api/gigs/in-bounds` — returns gig locations, not home coordinates
- `GET /api/homes/:id` — requires `checkHomePermission` (403 for non-members)
- `GET /api/homes/:id/public-profile` — returns text address only, no coordinates
- `GET /api/location` — returns authenticated user's own homes only
- `GET /api/hub` — returns authenticated user's own homes only

**Verification does NOT equal public visibility.** A verified home address
confirms the user lives there; it does not make the location public.

### Post Feed Rules

`GET /api/posts/feed` (Nearby, the saved-place feed and the Sports lane) and
the post page work the same way for anyone who isn't the post's author:

- **Radius and `distance_meters`.** Both use the post's displayed point. A post
  with no point of its own (placed by its home) uses its displayed effective
  point. The query searches stored points in the radius's box widened by
  `MAX_DISPLAY_OFFSET_DEGREES` and grown to whole neighborhood cells (see
  [Area query windows](#area-query-windows)), then keeps the posts displayed
  inside the radius. The Sports lane's local box, Local radius and "nearby"
  ranking work the same way.
- **No displayed point.** A post with precision `none` shows no point, so it is
  left out of a non-author's area results, already in the database query.
- **Matched businesses.** The match job measures `distance_miles` from the
  stored point and ranks partly by it. Non-authors get the snapshot without
  distances and sorted by rating, and `matched_business_ids` in ID order.

Authors keep exact values.

### Post Map Rules

`GET /api/posts/map` works only with the points a viewer is shown, never with
a post's stored point:

- **Pins.** A post's pin is its displayed point for this viewer: the location
  rule above, applied once (an author sees their own posts exactly). A post
  with no displayed point (`none`) has no pin; the query doesn't read it.
- **Viewport.** A post is in a viewport only when its displayed point is. The
  query searches stored points in the viewport widened by
  `MAX_DISPLAY_OFFSET_DEGREES` (0.01°, more than the rule ever moves a
  point) and grown to whole neighborhood cells, then keeps the posts displayed
  inside the viewport itself.
- **Empty-viewport hint (`nearest_activity_center`).** Sent only when the posts
  layer was requested and came back empty. It is the displayed point of the
  nearest post the viewer's map would show (same surface, post type, mute, hide,
  block and politics filters), measured from the viewport center to displayed
  points and searched within ±0.1°, ±1° and ±10°, then anywhere
  (`feedService.findNearestMapPost`). Moving the map to it shows that post's pin.
- **Posts with no place (`unplaced_posts`, Connections only).** The posts the
  Connections list holds that show this viewer no point (none stored, or a
  place only their author sees) have no pin, so the map lists them apart,
  newest first, whatever the viewport: at most 50, with `unplaced_more` when
  there are more (`feedService.getUnplacedConnectionPosts`). They carry the
  pins' fields with `latitude` and `longitude` null.
- `find_nearest_activity_center` has no post branch since
  `20261013052405_nearest_activity_without_posts.sql`; it still serves gigs,
  businesses and listings.

### Area query windows

The post feed, the Sports lane's local side and the map read stored points in
a box and keep only so many rows, newest first. If the box edge could stop
anywhere, a caller moving the center in small steps could watch the rows a
query reads, `pagination.hasMore` or the last pins change at the exact moment
an edge crossed one post's stored point. Two rules keep that window from
saying more than the displayed points do:

- **Whole cells.** The box is grown to whole neighborhood cells
  (`snapToNeighborhoodCells`): the 0.01° cells `neighborhood_only` rounds to,
  each two approximate-area cells. Which rows a query reads then depends only
  on the cell a stored point is in. For a `neighborhood_only` post, its
  displayed point already shows that cell; for an `approx_area` post it is at
  most the approximate-area cell its displayed point is keyed on. Each edge is
  the first or last number the rounding puts in its cell, so a stored point on
  a cell line counts in the cell its displayed point comes from.
- **No `none` rows.** Another person's `none` post is never read (its author
  still sees it), since even its cell would say more than it shows.

### Verified Coordinate Guard

Rows with `geocode_mode: 'verified'` are protected from non-verified overwrites.
See `backend/utils/verifiedCoordinateGuard.js`:
- `shouldBlockCoordinateOverwrite()` blocks non-verified writes to verified rows
- Applied to: `PATCH /api/homes/:id`, `PATCH /api/businesses/:id/locations/:id`
- Verified-to-verified overwrites are allowed (re-validation pipeline)

## Audit Checklist

- [x] Home coordinates never sent to non-household (verified: discover + public-profile omit lat/lng)
- [x] Gig detail enforces location_precision + reveal_policy + `locationUnlocked`
- [x] Gig list applies per-viewer `resolveGigPrecision`
- [x] Gig nearby/in-bounds/browse enforce location privacy
- [x] Post detail enforces permanent blur for non-authors (`leastPrecise`)
- [x] Post place labels shown to non-authors never name a street address or the home (`placeLabelForOthers`)
- [x] Feed service enforces permanent blur on every row
- [x] `approx_area` points come from the fixed grid cell, so repeat posts from one spot show one pin
- [x] Post feed and map filters, distances, the empty-map hint and matched-business distances and order never measure a non-author's stored point
- [x] Post feed, Sports and map queries read whole neighborhood cells and never another person's `none` post, so the rows they read say nothing finer than a cell
- [x] Listing detail enforces location_precision + grant-awareness + `locationUnlocked`
- [x] Listing browse enforces location_precision
- [x] Listing search/user/carousel pass viewer ID for privacy
- [x] Listing in-bounds/nearby enforce `applyLocationPrivacyBatch`
- [x] Listing area filters, counts, distances, "nearest" order, the empty-map point and the new-listing event use shown points
- [x] Listing address grants: create, list, revoke endpoints
- [x] Business discovery returns exact (intentional, owner-controlled)
- [x] Business map markers include `verified` flag based on address decision_status
- [x] Business search results include `address_verified` flag
- [x] Chat location messages: only share sender's own location (no home leak)
- [x] Shareable links / SEO pages: no coordinates in HTML meta or URL params
- [x] Verified coordinates protected from non-verified overwrites
- [x] `locationUnlocked` boolean included in all entity API responses
- [x] Gig bid acceptance posts address system message to chat
- [x] Listing reveal-address posts system message to chat
- [x] `ListingAddressGrant` table with RLS policies created
- [x] Posts map pins, viewport and empty-viewport hint use displayed points only
- [x] Nearby Plans: the exact place only in `PlanDetail` (host and people who are in); the Post holds the area point; bands and filters use the area point
