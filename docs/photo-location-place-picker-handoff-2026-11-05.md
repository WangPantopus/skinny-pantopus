# Photo locations and the place picker: handoff, November 5, 2026

The founder asked a coordinator session to run two tasks at the same time, each in its own Claude session. The coordinator passed on the founder's words and brainstormed the real-world cases. This note records where both tasks stand at handoff, so a new coordinator session can pick up.

## Update, November 6: where this ended

Everything after this section is the state at handoff. Since then:

- **The venue index is published, and production runs the code that reads it.**
  - [Run 42171989645](https://github.com/WangPantopus/skinny-pantopus/actions/runs/42171989645) finished green in about 45 minutes, not the 1.5–2 hours estimated below.
  - It published `places-20261106.bin` (1,442,372 elements) and `venues-20261106.bin` (2,320,646 elements, 100.4 MB, above the 70–90 MB estimate). The backend reads the file in ranges, so its size isn't a limit.
  - [Deploy run 42178189692](https://github.com/WangPantopus/skinny-pantopus/actions/runs/42178189692) was the first real release with #3437 and #3438.
  - Verified: the published file holds real venues in the right areas, and the iOS picker listed them through a local backend, with no Overpass requests.
  - Not verified: the picker against production.
- **[#3461](https://github.com/WangPantopus/skinny-pantopus/pull/3461) is merged, as `917f8e4bf`.**
  - The iOS composer check passed on the merged code, in the simulator with synthetic photos. A poster living far from the venue saw the inline note, and the post was stored with an exact pin at the venue. A second account saw "Photo taken here", also after a relaunch, with the marker at the venue. The refusals worked too.
  - Not verified in the apps: Alerts and Lost & Found in the iOS composer (API only), and Android and web on the merged code (CI only; both were checked in the apps before that merge).
  - It wasn't released when this was written. A release counts only once a Deploy Backend run's "Release backend" job succeeds on a commit containing it.
- **The open items below are still open and not started, apart from the first.** They go to the founder one at a time. New uploads no longer keep a video's location; see item 1.

## What the founder asked for

1. **Post to where your photo was taken.** Until now, a user could post to a place's feed only if they were physically there (fresh GPS) or were a verified resident or business there. In the founder's case, a photo taken in another city and posted later was refused, even though the app had already read the photo's location. The founder asked for a third way in: an attached photo or video taken at a place lets its author post there. The post then shows on the map at the exact spot where the photo was taken.
2. **A place picker that names the actual place.** For that photo, the "Add location" sheet listed only the city, never the restaurant where it was taken. The founder wants the restaurants, schools, churches, parks, venues, stadiums and so on around the photo, or around the user, the way Instagram shows them.

## Founder decisions

- **Always an exact pin** (November 5). A photo-placed post is pinned exactly at the tagged venue or address. With a town tag or no tag, it's pinned at the photo's capture point. That includes at or near the poster's own home: there's no home guard. Only two kinds of post stay approximate:
  - alerts, under an older rule;
  - drafts that asked for less precision.
- **Accepted defaults**, which the founder didn't change:
  - A post shows "Photo taken <date>" once its photo is more than a week old.
  - For alerts and Lost & Found, a photo counts only if it was taken in the last 48 hours.
  - Feed cards say "Photo taken here" instead of "Visitor".
- **The venue index build (#3438) was approved and merged.** The place-picker session then started the index job by hand instead of waiting for the December 3 monthly run.

## Done: the place picker (Task 2)

- **[#3437](https://github.com/WangPantopus/skinny-pantopus/pull/3437) is merged.**
  - Why it showed only the city: Mapbox geocoding no longer returns points of interest. The nearby list and search now use OpenStreetMap, the source the Plans picker already used.
  - Each row has an icon, a kind ("Barbecue restaurant"), the address and the distance.
  - A venue the photo was taken inside comes first. In empty rural areas, the list widens to as far as 6 km.
  - Search finds places by name near the photo, in any country, ignoring accents.
  - Street addresses from search read "Address · …" and have a house icon.
  - An OpenStreetMap credit sits under the list.
  - The Plans picker is unchanged.
  - Venues go on the wire as kind `poi` with an `osm:node|way|relation/<id>` id. The town row is `place`.
- **Verified** against a local backend, with synthetic photos:
  - In the iOS simulator, a photo geotagged at Ben's Chili Bowl in Washington, DC listed that restaurant first. A search for "lincoln" found Lincoln Theatre, and the tagged venue was saved on the post.
  - In the Android emulator, the list and search worked, and a tagged post went through.
  - A second account on Android saw the iOS post with its tag.
- **Not verified:**
  - The town row and address search, which still use Mapbox. There's no Mapbox key locally.
  - The feed after an app relaunch. The simulators wouldn't get a location fix.
- **[#3438](https://github.com/WangPantopus/skinny-pantopus/pull/3438) is merged.** It adds our own US venue index, about 70–90 MB, to the monthly places build.
  - The build was started by hand on master as [run 42171989645](https://github.com/WangPantopus/skinny-pantopus/actions/runs/42171989645), at 06:02 UTC on November 6.
  - It takes about 1.5–2 hours, then publishes the Plans index and the venue index to the `places-index` release. Production picks the new index up within about an hour.
  - If the build fails or comes out too small, nothing is published.
  - Until the index is live, the first look at a new area loads from the public Overpass servers and can take 20–50 seconds. The result is then cached for a day.

## In progress: posting where the photo was taken (Task 1)

**[#3461](https://github.com/WangPantopus/skinny-pantopus/pull/3461) is an open draft** on branch `claude/photo-location-posting`, head `8fecfcf48` at handoff (pushed). The session "Post to where your photo was taken" owns it and merges it itself, per `AGENTS.md`.

What it does:
- **The rule.** `canPostToPlace` (`backend/utils/trustState.js`) allows a post when one attachment was taken within `GPS_PROXIMITY_METERS` (5 km) of the place. That's the same distance a fresh GPS fix gets.
- **What the apps send.**
  - With `POST /api/posts`, they send each geotagged attachment's capture point and capture time as `mediaLocations`.
  - The `place-eligibility` precheck takes the attachment nearest to the place.
- **What's stored.**
  - The post keeps `post_metadata.location_basis = 'photo'` and `photo_taken_at`.
  - There's no migration.
- **Exact pins.**
  - A photo-placed post stored as `exact_place` is the only kind of post that other people see unblurred (`feedService.postPrecisionForOthers`).
- **The composers.**
  - They run the check against the tagged place, inline, before the user taps Post.
  - A refusal offers "Share with your connections instead".
  - "Neighbors" gets the caption "People near ‹place›".
- **Edits.**
  - Moving a Place post to a new point needs its author to live or work there.
  - An edit can't raise a post to an exact pin.
  - Moving a photo-placed post, or removing its photo, drops the basis and the exact pin.
- **Android in-app camera.** Its photos take the device's fix, but only when location permission was already granted.
- **Trust.** The server trusts the capture point the device reports, the same way it already trusts the device's GPS reading. It can't check the point against the files, for three reasons:
  - iOS re-encodes photos before upload.
  - The upload route strips metadata.
  - Media arrives after the post exists.

Verified:
- The API, against a local backend: each way in and each refusal.
- Exact pins for a venue, a town tag, an address, and a photo taken near the poster's home.
- Edits.
- Android emulator end to end, including a fresh app start and the map.
- The web feed badge.
- iOS builds, and its unit tests and SwiftLint pass.

**CI at handoff:** 7 checks passed and none had failed. Four were still running: Android lint and tests, Android instrumented tests, the iOS test build, and the Docker image.

**Left to do:**
1. Drive the iOS composer in the simulator. The simulator tool needs the founder's one-time "Let Claude use it" for a device. The session asked four times and got no answer. The founder can approve it the next time it's asked, or give an OK to merge without the iOS check.
2. Once CI is green, run `gh pr ready 3461`, then merge.

## Open items found along the way (not started)

1. **Videos kept their GPS. New uploads are fixed; videos already stored are the founder's call.**
   - The server now cleans every video it stores, in place and without re-encoding (`backend/services/videoMetadata.js`), through the flow that cleans photos: `routes/upload.js`, `services/chatMediaUpload.js` and `routes/files.js`.
   - No client removes the location first. Measured with a synthetic clip and a made-up location:
     - The iOS post composer and iOS chat use one export, which keeps a `loci` box with the exact coordinates: `exporter.metadata = []` doesn't remove it.
     - The Android post composer on Android 13 sends the file byte for byte, `©xyz` included. Other Android versions weren't tested.
     - The web composer and web chat send the original.
   - Videos already stored: `node backend/scripts/clean-stored-video-locations.js` reports how many still carry a location and changes nothing. `--rewrite` cleans them with the same cleaner, and `--limit=1` tries one first. After a rewrite, the CDN keeps the old bytes until those keys are invalidated.
   - Not removed: the capture time in the movie and track headers, and GPS that some dashcams write between frames, outside any box or track.
2. **Home posts skip the location check.**
   - Posting as a Home with a far-away place tag isn't checked against the home's area. This also predates #3461.
   - Founder decision: should Home posts be limited to places near the home?
   - The code is in `posts.js` and `trustState.js`, which #3461 also changes, so do this after #3461 merges.
3. **Android gallery photos have no GPS.**
   - The system photo picker redacts it on Android 10 and later, so on Android only in-app camera photos qualify.
   - Changing that needs a new permission prompt and a Google Play policy review. That's the founder's call.
4. **The web composer's place picker.**
   - Update, November 6: it now lists nearby venues and searches them by name, like iOS and Android, and a post records the venue as OpenStreetMap's. With no device fix, the list comes from the saved viewing area.
   - Update, November 6: the web composer now places a post by its photo or video, as the apps do. It reads the capture point in the browser, with no new dependency, sends `mediaLocations`, and runs the check on the tagged place with the nearest attachment. The list opens on "Photo location", with "Near me" beside it. PNG and WebP aren't read, because cameras don't write them.
   - Not verified: browsers on phones. iOS Safari and Android Chrome can remove a photo's location before the page sees the file, so on a phone the photo may simply not count.

## Sessions and branches

| Session | Branch | PRs |
|---|---|---|
| Coordinator | `claude/media-location-posting-picker-b28f96` | this note |
| Post to where your photo was taken | `claude/photo-location-posting` | #3461 (open draft) |
| Place picker: show real nearby restaurants and venues | `claude/place-picker-venues`, `claude/places-index-venues` | #3437, #3438 (merged) |
