# PB — Backend and data

You own the server side of Pulse: the audience rules, the labels, the areas, the feed, the lifecycle, replies, follows, and the contract file. You lead every slice by about a week; PI and PA build against your PRs. Read [README](../README.md), [build spec](../01-build-spec.md), [contract](../02-contract.md), [delivery plan](../03-delivery-plan.md) and [verification](../04-verification.md) first.

## Owns and does not own

- **Owns:** `backend/` (routes, services, utils, jobs, tests) except the PS and PC files below; `supabase/migrations/`; `pantopus-seeder/`; `docs/product/pulse-build/02-contract.md`; `backend/services/funnelEvents.js`.
- **PS owns:** `backend/services/pulse/safety/*`, `backend/routes/pulseSafety.js`, `backend/routes/adminReports.js`, the web admin pages. **PC owns:** `backend/jobs/pulseDigest*.js`, `backend/services/pulse/digest/*`, the public web pages. You expose small stable functions they call; they never edit `posts.js` or `feedService.js`.
- **Put new code in new files** (`backend/routes/pulse.js`, `backend/services/pulse/*.js`) and call into the shared pieces; change `posts.js` and `feedService.js` only where the contract says an existing path changes. They are large (3.8k and 1.6k lines) and shared with the web.

## Code map (verified on master, October 13, 2026)

| What | Where |
|---|---|
| Post types, alert kinds, business types, create schema | `backend/routes/posts.js` lines ~120–330 (`POST_TYPES`, `SAFETY_ALERT_KINDS`, `BUSINESS_PLACE_TYPES`, `TOPIC_VALUES = ['sports']`, `createPostSchema`) |
| Create handler (trust state, audience rules, place gate, business and home limits) | `posts.js` ~1000–1500; helpers `computeTrustState`, `canPostToAudience`, `canPostToPlace` in `backend/utils/trustState.js` |
| Who can read a post | `canViewPost` and `isPubliclyShareable` in `posts.js` (~611–700); `requireVisiblePost` (~762) |
| Feed | `GET /api/posts/feed` (`posts.js` ~1598 → `feedService.getListFeed` ~812; takes latitude, longitude, radiusMiles from the query, no audience check); `normalizeFeedPostRow` (~168), `applyMuteHideFilters` (~377), `enrichFeedPosts` (~585) |
| Comments, likes, share, solve, report, mute | `posts.js`: comments ~3004–3190 and ~3282–3395, share ~3190, solve ~3689, report ~3596, mute ~2296–2400, topic mute ~2556 |
| Composer precheck (regex, fail-open) | `posts.js` `POST /precheck` ~806 (PS replaces its logic behind a function you call) |
| Auto-archive and windows | `backend/jobs/autoArchivePosts.js` (daily 04:00 UTC), table `PostCategoryTTL` |
| Location privacy | `backend/utils/locationPrivacy.js`, `docs/location-privacy-matrix.md` (PRs 2199, 2201, 2203, 2204 are open or recent: build on `master`) |
| Plans | `backend/routes/plans.js`, `backend/services/plans/*`, migration `20261013060000_nearby_plans.sql` (`Plan.post_id` exists) |
| Funnel events | `backend/services/funnelEvents.js`, route `POST /api/hub/funnel-events` |
| Curator seeder | `pantopus-seeder/` (posts RSS, NWS, USGS, AirNow, seasonal items as `origin = 'curator'`) |

Current schema facts: `Post.visibility` (varchar), `Post.audience` (enum `post_audience`), `distribution_targets text[]` (`place` puts a post on the Pulse feed), `state` (`open|solved|archived`), `archive_reason` (`expired|resolved|manual|moderation`), `topic` (check allows only `sports`), `purpose` (check includes `offer`, `heads_up`), `allow_external_share boolean`; `PostMute.muted_entity_type` already has `topic`; `PostComment.user_id` cascades on delete; PostGIS 3.3 and pg_trgm are installed.

## Slices

Do them in this order; each is its own small PR set. "Done when" is what the owners check in the real apps.

- [ ] **S1 Rule cleanups** (no table). Reject `theft`, `vandalism`, `suspicious`, `scam`, `crime_incident` (and, for non-Official/curator accounts, `official_notice`, `public_safety`) at creation with `ALERT_KIND_NOT_ALLOWED`; reject business authorship to the Place feed with `BUSINESS_CANNOT_POST`; keep old rows readable. *Done when:* the old composers hit the new errors cleanly and old posts still render on web, iOS and Android.
- [ ] **S4 Topics.** Widen `Post_topic_check` to the 12 topics (keep `sports`); `topic` filter on the feeds; topic mute accepts `{ topic, areaId }` and lists/undoes. Add `PostMute.area_id`. *Done when:* a topic chip filters and a topic mute persists and undoes.
- [ ] **S5 Areas, labels, walls** (**needs the table approval**). `PulseArea` migration and the three town polygons (US Census place boundaries, simplified; record source and licence in the migration comment); `read_scope` and `area_id` on `Post`; **`canReadPost`** replacing the ad-hoc checks and **applied to every read path** (see contract section 5 and the matrix in `04-verification.md`); `labelFor`; `distance_text` from the grid-snapped point; `POST /api/pulse/adult-attestation`; label limits; `GET /api/pulse/areas/mine|search`. Hold point H1: do not return new fields older clients decode until S2 is on `master`. *Done when:* the two-account privacy matrix passes on every path, including the legacy feed with chosen coordinates.
- [ ] **S6 The Pulse feed.** `GET /api/pulse/feed`, `/feed/new`, `/feed/seen` (contract 2.3); `UserFeedPreference` seen markers; `quiet` states. Reuse `feedService` internals (mute, hide, block, location privacy); do not fork them. Groups for closed areas never appear.
- [ ] **S7 Lifecycle.** Types `share` and `offer`, `expires_at`, `resolution`, `claim_mode`; `PostCategoryTTL` rows; auto-archive by type with the right `resolution`; `closed_unanswered`; keep `state` in sync; the day-6 `ask_still_open` notification; offers `ENOUGH_REQUESTS`; sale posts held. **H1 first** (clients tolerate the new types). *Done when:* running the job on aged fixtures ends each type as the spec says.
- [ ] **S8 (server half).** Pulse mode in `POST /api/posts` (contract 2.5): attestation, limits, Share cap (`SHARE_WEEKLY_CAP`), call `evaluateComposerChecks` from PS (`422 COMPOSER_BLOCKED`), held posts, expiry.
- [ ] **S9 (server half).** `GET /api/pulse/posts/:id`, `/replies?after=`, Helpful, thanks (`CommentThanks`), claims (`OfferClaim`), `reply_to` and `branch_id`, "Reply removed" on account deletion (change `PostComment.user_id` to `ON DELETE SET NULL` and soft-delete the text in the deletion flow, `routes/users.js`), notifications.
- [ ] **S10 (server half).** `PulseFollow`, follows, preferences and summary, `why`, funnel events.
- [ ] **S11 (shared with PS).** Honor `moderation_state` in `canReadPost` and every feed (PS builds the actions and tables).
- [ ] **S12.** `KnownEntry` (the table the Agent design plans), `KnownConfirmation`, `RightNowEvent`, `RightNowReport`, search column, upcoming; endpoints published in a contract addendum first.
- [ ] **S14.** `Plan.source_post_id`, the plan card in the conversation payload, `POST /api/pulse/posts/:id/plan` through the existing Plans services.
- [ ] **S15–S17 (server half).** Public endpoints, place pages and area opening, business and official identities.

## Rules specific to this stream

- **Walls are server-side only and shared.** One function; every route and query uses it. Never trust coordinates or scopes from the client. Never filter after paging.
- **Old endpoints are part of the wall.** `/api/posts/feed`, `/map`, `/saved`, `/:id` serve the web and old apps; they must not leak what the new rules protect.
- **Migrations:** additive, backward compatible, header and `lock_timeout` as the checker requires, RLS on new tables, nothing applied is edited. Widening a check constraint is additive. New tables only after the founder's approval (H3).
- **Contract first.** If a client needs a field, add it to `02-contract.md` in a small PR *before* the backend PR, and say so in your status file. Never rename or remove a field.
- **Clock-dependent behavior** (windows, reminders, auto-archive) is verified by running the job against aged fixture rows, not by waiting.
- **Fail closed on privacy, fail open on advice.** A failed label or wall lookup hides content; a failed composer check lets the user post.

## Verification you own

The two-account privacy matrix on every audience PR; the aged-fixture run for every lifecycle rule; legacy-endpoint checks after every wall change; the web still loads its feed and post pages (`GET /api/posts/feed`, `/app/feed`).

## Needs from others

PI and PA: tolerant decoding (S2) before S7 and any new field. PS: `evaluateComposerChecks` (S8), moderation tables (S11). The founder: table approval (S5), outage-data accounts (S12), and nothing else.

## First three days

Publish S1 and S4. Draft `canReadPost` and `labelFor` with fixtures and write down the legacy-row mapping (rows with a null `read_scope` keep today's rules). Source and simplify the three town boundaries and prepare the `PulseArea` migration, ready to merge the moment the founder ticks the box. Write your first status entry.
