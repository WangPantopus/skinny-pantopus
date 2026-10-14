# Pulse contract

The API, data and routing that the backend (PB, PS, PC), iOS (PI) and Android (PA) share. **R1 and R2 are frozen**: names, enums and shapes below are what all three codebases build against. **R3 and R4 are outlined**: the owning stream publishes the exact shapes in a small PR to this file before the first client PR of that slice. PB owns this file. To change something frozen, open a PR to this file, say so in your status file, and wait for PB's review (clients never invent fields).

Checked against `master` on October 13, 2026: `backend/routes/posts.js`, `backend/services/feedService.js`, `backend/utils/trustState.js`, the live schema (`Post`, `PostComment`, `PostMute`, `Plan`, enums), and the iOS and Android tab code.

## 0. Conventions

- **Namespaces.** New Pulse endpoints live under `/api/pulse/…` (new files; `backend/routes/pulse.js` is PB's, `backend/routes/pulseSafety.js` is PS's). Existing post endpoints stay and change only by adding fields. The web and older app builds keep using them.
- **JSON.** Requests camelCase, responses snake_case (as the posts API does today). Times are ISO 8601 UTC. Ids are UUID strings.
- **Auth.** `verifyToken` unless marked public. Signed-out reads exist only on the public routes of R4 and on `GET /api/posts/:id` for public posts.
- **Errors.** `{ "error": "<plain sentence>", "code": "<CODE>", …details }` with the HTTP codes in section 8. The sentence is safe to show; clients branch on `code`.
- **Unknown values.** Clients must tolerate unknown enum values and extra fields everywhere (decode to a generic case, never crash). This is slice S2 and hold point H1.
- **Additive only.** No removed or renamed fields. A new client field is read as optional until the backend PR that adds it is on `master` (H4).
- **Read checks are shared.** One server function decides "can this viewer read this post"; every read path uses it: `/api/posts/feed`, `/api/posts/map`, `/api/posts/saved`, `/api/posts/:id`, comments, likes, share, the new `/api/pulse/*` routes, search, digests and notifications that quote a post.

## 1. Enums

| Name | Values |
|---|---|
| `type` (new composer) | `ask_local`, `share`, `offer`, `alert`, `event`, `lost_found`. Any other stored `post_type` reads as `legacy` (the raw value is in `legacy_type`) |
| `topic` | `around_here`, `outdoors`, `gardening`, `home_repairs`, `food`, `kids_schools`, `pets`, `arts_culture`, `sports`, `getting_around`, `local_government`, `volunteering` |
| `read_scope` | `public` (anyone), `verified_town` (verified homes in the post's town), `verified_area` (verified homes in the post's street or neighborhood area) |
| `resolution` | `answered`, `closed`, `closed_unanswered`, `claimed`, `expired`, `happened`, `reunited` (null while open) |
| `author_label` | `resident`, `new_here`, `nearby`, `visitor`, `official`, `business`, `pantopus` |
| `action.kind` | `answer`, `reply`, `claim`, `seen_it`, `going`, `its_mine` |
| `claim_mode` | `choose` (default), `first` |
| `moderation_state` | `live`, `held`, `removed` |
| `follow.target_type` | `post`, `topic`, `area`, `place` |
| `follow.notify` | `off` (default), `recap`, `each` |
| `follow.ends` | `on_resolve`, `week`, `never` |
| `area.kind` | `town`, `neighborhood`, `street`, `place` |

Heads-up kinds a resident may create: `road_hazard`, `power_outage`, `weather_damage`, `hazard`, `other`, and `missing_pet` (an existing alert template, kept). Official and curator accounts additionally: `official_notice`, `public_safety`, `crime_incident`, each with `sourceUrl`. `theft`, `vandalism`, `suspicious`, `scam` are rejected at creation for everyone (`ALERT_KIND_NOT_ALLOWED`) and remain valid when reading old rows (older posts store them as `crime_incident` or `public_safety`). An edit may change a post's kind only to one its author may create. `hazard` and `other` are stored as themselves (before S1, `other` was stored as `public_safety`).

## 2. Frozen shapes

### 2.1 `PulsePost` (feed items and the conversation header)

```jsonc
{
  "id": "uuid",
  "type": "ask_local",            // enum above, or "legacy"
  "legacy_type": null,            // raw post_type when type = "legacy"
  "topic": "gardening",           // enum or null
  "title": null,
  "text": "First autumn in Camas. What grows well in a shady garden?",
  "media": [{ "url": "…", "type": "image", "thumbnail_url": null }],
  "created_at": "2026-10-13T20:11:00Z",
  "author": {
    "id": "uuid",                 // null for public/signed-out responses
    "display_name": "Dana",       // first name for public town posts
    "label": "new_here",
    "distance_text": "0.6 mi",    // null unless the reader has a verified home; never on public responses
    "avatar_url": null,
    "is_curator": false
  },
  "about": { "label": "Camas", "area_id": "uuid" },         // the place or area the post is about; label may be null
  "read_scope": "public",
  "status": { "state": "open", "resolution": null, "ends_at": null },   // state: open | resolved
  "action": { "kind": "answer", "label": "Answer", "done": false },     // the one action and the viewer's state
  "counts": { "replies": 6, "going": null },                             // going only for events
  "event": null,                  // { starts_at, ends_at, venue } for events
  "lost_found": null,             // { kind: "lost" | "found" }
  "offer": null,                  // { claim_mode, requests_open, gone } for offers
  "viewer": {
    "is_author": false, "following": false, "can_mark_helpful": false,
    "saved": false,               // the viewer saved it; POST /api/posts/:id/save toggles it, as on today's cards
    "can_keep_open": false        // the asker's own open Ask, not yet kept open (2.12); false for everyone else
  },
  "moderation": { "state": "live" }   // "held" / "removed" only ever reaches the author
}
```

### 2.2 `PulseReply`

```jsonc
{
  "id": "uuid",
  "post_id": "uuid",
  "parent_comment_id": "uuid|null",   // the real parent
  "branch_id": "uuid",                // the first-level reply this one sits under (itself if first-level)
  "reply_to": { "comment_id": "uuid", "display_name": "Priya" },   // null for first-level
  "text": "Sword ferns, salal and Oregon grape all love fir shade.",
  "created_at": "…", "edited": false,
  "author": { /* same as above */ },
  "helpful": true, "helpful_to": "Dana",   // helpful_to = the Ask's author's display name when helpful
  "can_thank": true, "thanked_by_viewer": false,
  "removed": false,                    // true → show "Reply removed"; text is empty
  "moderation": { "state": "live" }
}
```

Replies are returned oldest first, flat. Clients show first-level replies and one indented level; anything deeper stays in its `branch_id`.

### 2.3 `GET /api/pulse/feed`

Query: `view` = `nearby` (default) | `following`; `topic` (enum, optional); `area_id` (optional, default the viewer's town); `earlier_before` (ISO, for "Show earlier"); `limit` (default 30, max 40).

```jsonc
{
  "view": "nearby",
  "area": { "id": "uuid", "kind": "town", "name": "Camas", "state": "WA" },
  "areas_available": [{ "id": "uuid", "kind": "town", "name": "Camas", "title": "Camas" }],   // area pill; streets and neighborhoods only when opened
  "quiet": null,   // or { "reason": "sparse" | "no_home" | "empty", "card": "meter" | "set_up_home" | null }
  "right_now": null,                       // R3
  "groups": [
    { "key": "town", "title": "AROUND CAMAS", "area_id": "uuid", "items": [ /* PulsePost */ ] }
  ],                                       // order: street, neighborhood, town; only open areas; newest first inside a group
  "end": { "caught_up": true, "since": "2026-10-14T15:00:00Z", "can_show_earlier": true, "earlier_cursor": "2026-10-13T20:11:00Z" }
}
```

- The first response holds items **newer than the viewer's last-seen marker** for that view (at least the last 24 hours if the marker is older), capped at `limit`. `caught_up` is true when nothing newer remains beyond the cap.
- `earlier_before` returns the next older items in one flat group `{ "key": "earlier", "title": "EARLIER", … }` (the client appends it below the end card); nothing loads by itself.
- `GET /api/pulse/feed/new?view=&topic=&after=<iso>` → `{ "count": 3 }` for the "↑ 3 new conversations" pill (poll about once a minute while the screen is visible, or on a socket event).
- `POST /api/pulse/feed/seen` `{ "view": "nearby", "through": "<iso>" }` advances the marker. The client calls it when the end card has been on screen, never earlier.
- The marker belongs to the view, not to a topic, and there is no per-topic marker. With a `topic` chosen, the page reads from the same marker, and the client does not call `/feed/seen` from it: a topic page shows only part of the view, so moving the view's marker would put the other topics' unseen posts behind "Show earlier". Only the unfiltered page (no `topic`) moves the marker.
- Reader checks (section 5) apply to every item; hidden, muted, blocked and held items never appear. The legacy `/api/posts/feed` keeps its shape for the web.

### 2.4 Conversation

`GET /api/pulse/posts/:id` → `{ "post": PulsePost, "replies": [PulseReply], "plan": null }` (`plan` in R3). `GET /api/pulse/posts/:id/replies?after=<iso>` → `{ "replies": [...] }` for the "↓ 2 new replies" pill. Writing a reply uses the existing `POST /api/posts/:id/comments` (`comment`, `parentCommentId`, `clientRequestId`); its response is a `PulseReply`-compatible object plus the legacy fields.

### 2.5 Creating a post (Pulse mode)

`POST /api/posts` is the one creation path. A request is in **Pulse mode** when it contains `readScope`. New optional fields (camelCase): `readScope`, `areaId`, `topic` (the 12), `postType` (adds `share`, `offer`), `claimMode`, `expiresAt` (alerts only: the time the heads-up names), `sourceUrl` (official or curator alerts; accepted in every mode since S1, stored as `post_metadata.source_url` only on an Official or curator alert; a `source_url` sent inside `postMetadata` is dropped), `locationName` (Share needs a place: `locationName` or `areaId` besides the town). In Pulse mode the server:

1. requires the adult attestation (`ADULT_ATTESTATION_REQUIRED`) and applies the label limits (section 5);
2. runs the composer checks (PS's `evaluateComposerChecks`); a blocking result returns `422 COMPOSER_BLOCKED` with the same `blocks` list the check endpoint returns, and nothing is created;
3. sets `expires_at` and `claim_mode` from the type; when a hold rule fires the post is still created and the response carries `"moderation": {"state": "held", …}` (only its author can see it);
4. rejects business authorship for Place posts (`BUSINESS_CANNOT_POST`); `postAs: 'business'` stays valid for non-place uses it has today.

The response is the created post as today's endpoint returns it plus `pulse: PulsePost`.

### 2.6 Composer check (PS)

`POST /api/pulse/composer/check` → fail-open; never blocks by itself.

```jsonc
// request
{ "text": "…", "mediaCount": 0, "areaId": "uuid", "postType": "ask_local", "topic": null }
// response
{
  "ok": true, "degraded": false,
  "suggest": { "type": "ask_local", "topic": "gardening",
               "about": { "label": "Camas", "area_id": "uuid" }, "read_scope": "public",
               "shown_to": { "area_name": "Camas", "topic": "gardening" } },
  "existing": [{ "kind": "known", "id": "uuid", "title": "Shade plants that do well here", "meta": "Known · 3 answers · confirmed May 2026" }],
  "blocks": [{ "code": "names_home", "detail": null, "options": ["private_note", "city_form", "edit"] },
             { "code": "private_detail", "detail": "house_number", "options": ["edit"] }],   // detail: house_number | plate | phone
  "suggestions": [{ "code": "tone", "message": "…" }, { "code": "politics", "message": "…" }],
  "needs": { "adult_attestation": false, "audience_review": true }
}
```

Private note to a home (signed): `POST /api/pulse/notes` `{ "toHomeId"? | "toPostId", "template": "lights_on" | … }`. Templates and wording are PS's; the note carries the sender's first name and street.

### 2.7 Replies: Helpful, thanks, report

- `POST /api/pulse/posts/:postId/replies/:replyId/helpful` `{ "helpful": true }` (the Ask's author only) → `{ "reply": PulseReply, "post_status": { "state": "resolved", "resolution": "answered" } }`. Unmarking the last Helpful reopens the Ask if it has not closed.
- `POST /api/pulse/posts/:postId/replies/:replyId/thanks` → `{ "thanked": true }` (idempotent; one per person per reply; not for your own reply). The helper gets a private notification.
- `POST /api/pulse/posts/:postId/replies/:replyId/report` `{ "reason", "details" }` (reasons as today's post report) → `{ "ok": true }`.

### 2.8 Offers

`POST /api/pulse/posts/:postId/claims` `{ "note"? }` → `{ "claim": { "id", "status": "requested" | "enough_requests" | "gone" } }` · `GET /api/pulse/posts/:postId/claims` (giver) → requests with each requester's `author` · `POST /api/pulse/posts/:postId/claims/:claimId/choose` → claimed; the others become `gone` and are told.

### 2.9 Follow, preferences, why, mutes

- `PUT /api/pulse/follows` `{ "targetType", "targetId", "areaId"?, "notify": "off", "ends": "on_resolve" }` → `{ "follow": {...} }` (one tap sends the defaults) · `DELETE /api/pulse/follows?targetType=&targetId=&areaId=` · `GET /api/pulse/follows`.
- `GET|PUT /api/pulse/preferences` → `{ "digest": { "enabled", "time_local", "timezone", "channel": "email"|"push"|"both" }, "weekly_street_digest": false, "quiet_hours": { "start_local", "end_local" } (existing fields), "nudge_helper": true }`.
- `GET /api/pulse/preferences/summary` → every follow, mute and alert with an `undo` descriptor, for the preferences page.
- `GET /api/pulse/posts/:id/why` → `{ "reasons": [{ "kind": "area" | "topic" | "follow" | "time", "text": "You're viewing Camas, all topics, newest first." }] }`. Only the reader's own choices.
- Mutes (in force since S4): `POST /api/posts/mute/topic` accepts `{ "topic", "areaId"? }` → `{ "message", "mute": { "topic", "area_id" } }`; without `areaId` the topic is muted everywhere; an unknown topic or a malformed `areaId` is a 400; muting twice keeps one mute. The legacy `{ "postType", "surface"? }` still works. `GET /api/posts/mute` → `{ "muted": [ …people and businesses, unchanged ], "topic_mutes": [{ "topic", "area_id", "muted_at" }] }`. `DELETE /api/posts/mute` `{ "entityType": "topic", "entityId": "<topic>", "areaId"? }` (body or query string) removes that one mute (without `areaId`, the everywhere mute). A topic muted in an area hides that topic's posts in the area and posts that have no area (every post until `Post.area_id` arrives with S5). User mutes as today.
- Topic filter (in force since S4): `GET /api/posts/feed?surface=place&topic=<topic>` returns only that topic's posts, for any of the 12; `sports` keeps its Sports lane.

### 2.10 Areas and eligibility

`GET /api/pulse/areas/mine` → `{ "town": {...}|null, "neighborhood": {...}|null, "street": {...}|null, "home_verified": true }` (only areas that are open) · `GET /api/pulse/areas/search?q=` → towns for "another place" · `POST /api/pulse/adult-attestation` → `{ "attested_at" }`.

`POST /api/pulse/adult-attestation` (in force since S5's first PR): no body; stores `User.adult_attested_at` once and returns it, the first time again on every later call (a double tap answers the same); `403 AGE_NOT_ELIGIBLE` when the date of birth on file says the person is under 18.

### 2.11 Safety (PS, S11)

`GET /api/pulse/notices` → the author's own held and removed items `{ id, target_type, target_id, state, rule_code, reason_text, created_at, can_appeal }` · `POST /api/pulse/appeals` `{ "noticeId", "message" }` → `{ "appeal": {...} }`. The moderator console uses the existing `backend/routes/adminReports.js` and web `app/admin/reports`, extended.

### 2.12 Ending an Ask (S7)

The asker's two actions on an open Ask, offered by the day-6 reminder (`ask_still_open`, section 6) and on the Ask itself when `viewer.is_author`:

- `POST /api/pulse/posts/:postId/keep-open`, no body → `{ "post_status": { "state": "open", "resolution": null, "ends_at": "<iso>" } }`. Moves the end 7 days past where it was, once per Ask (stored as `post_metadata.kept_open_at`); a second time answers `409 ALREADY_KEPT_OPEN`. On a `PulsePost`, `viewer.can_keep_open` is true exactly when this call would succeed, so clients offer "Keep open 7 more days" only then.
- `POST /api/pulse/posts/:postId/close`, no body → `{ "post_status": { "state": "resolved", "resolution": "closed" | "closed_unanswered" } }`. `closed` when someone other than the asker replied, `closed_unanswered` when nobody did. The Ask leaves the views like any ended post; restoring it from My posts reopens it for another window (section 5).

Both answer `404 POST_NOT_FOUND`, `403 NOT_POST_AUTHOR` (not the asker), `400 NOT_AN_ASK` (another type), and `409 ASK_ENDED` when the Ask is already answered, closed or past its end.

## 3. Outlined (shapes are published by the owner before the first client PR)

| Slice | Endpoints (owner) |
|---|---|
| S12 | `GET /api/pulse/known?area=&q=`, `GET /api/pulse/known/:id`, `POST /api/pulse/known/:id/{confirm,correct,outdated}`, `POST /api/pulse/known/ask-again` (PB data, PS drafting); `GET /api/pulse/upcoming?area=`; `GET /api/pulse/right-now`, `POST /api/pulse/right-now/:id/report` `{kind: me_too\|its_back}`; `GET /api/pulse/search?q=&area=` (PB) |
| S13 | Digest content and delivery are jobs, not endpoints (PC); preferences above |
| S14 | `GET /api/pulse/posts/:id` fills `plan`; `POST /api/pulse/posts/:id/plan` creates a Plan through the existing Plans services with `Plan.source_post_id` (PB) |
| S15 | `GET /api/public/pulse/areas`, `GET /api/public/pulse/feed?area=`, `GET /api/public/pulse/posts/:id` (public posts only; no distance, no street, first name and label) (PC with PB) |
| S16–S17 | Place pages, area opening, business and official identities (PB, PS) |
| S9 (addition) | `PUT /api/pulse/posts/:id/read-scope` `{ "readScope" }`: the author only, toward narrower only, `409 CANNOT_WIDEN` (PB) |
| S11 (addition) | `GET /api/pulse/rules` → `{ "rules": [...], "review_hours": "…", "appeals_text": "…", "law_enforcement_text": "…" }`; the text is the founder's and counsel's, PS serves it (PS) |
| S17 (addition) | Local offers: `POST /api/businesses/:businessId/offers`; staff approve in the console; `GET /api/pulse/local-offer?area=` → the one offer to show, or null (PB, PS) |
| S20 | `POST /api/users/code/start` `{ "email", "firstName" }` → always `{ "ok": true }` (no account enumeration); `POST /api/users/code/verify` `{ "email", "code", "deviceId" }` → the same session body as `POST /api/users/login` plus `is_new`. Codes are 6 digits, valid 10 minutes, single use, 5 tries. Errors: `CODE_INVALID`, `CODE_EXPIRED`, `TOO_MANY_ATTEMPTS`, `CHANNEL_UNAVAILABLE` (text codes, until a provider exists). The `authEndpointLimiter`, DPoP and device rules that cover login cover these (PB) |
| S21 | The plan create body gains `repeats` (`none`, `weekly`, `biweekly`, `monthly`) and `until`; `POST /api/plans/:id/series/{pause,resume,end}`; the going call gains `scope` (`occurrence` or `series`); `POST\|DELETE /api/plans/:id/co-hosts`; all through the existing Plans services (PB) |
| S22 | `POST /api/support-trains` accepts an optional `sourcePostId` (stored, never returned); the conversation payload's `support_train` is `{ "line": "…" }` only when the organizer chose to post the line (PB) |
| S23 | `POST /api/admin/pulse/posts/:id/merge` `{ "intoPostId" }` and `…/unmerge`; reading a merged post returns `merged_into: { "id", "title" }` (PS console, PB reads) |
| S24 | `PUT /api/pulse/preferences` gains `reading_home_ids`; `POST\|DELETE /api/pulse/posts/:id/pin` (Official or curator) → `PulsePost.pins: [{ "label", "url", "text", "pinned_at" }]`; `signup_source` is set by S20 and the public pages (PB) |
| S25 (reserved) | `service_options: []` in the plan sheet's payload; nothing else until Crew Day and the Street Organizer's welcome cards exist |

## 4. Data changes

### 4.1 Columns on existing tables (no new table needed; each is one additive migration)

| Table | Change |
|---|---|
| `Post` | `read_scope text` (check: `public`, `verified_town`, `verified_area`), `area_id uuid` (FK `PulseArea`, after approval), `expires_at timestamptz`, `resolution text` (check, section 1), `claim_mode text default 'choose'`, `moderation_state text not null default 'live'`, `moderation_rule text`, `moderation_note text`, `moderated_at timestamptz`, `search_tsv tsvector` generated + GIN (R3). Widen `Post_post_type_check` with `share`, `offer`; widen `Post_topic_check` to the 12 topics (plus legacy `sports`); keep `state` in sync (`open` → `solved` when `answered`, `archived` otherwise) so older clients still read it. `expires_at`, `resolution`, `claim_mode` and the two new types are in `20261014070000_pulse_post_lifecycle.sql` (S7); legacy post rows (`/api/posts/feed`, saved, profile lists, `GET /api/posts/:id`) return the three columns as stored (`claim_mode` is on every row and means something only on an offer), and marking an Ask solved (`PATCH /api/posts/:id/solve`, `PATCH /api/posts/resolve/:id`) sets `resolution: answered` with `state: solved`. `moderation_state` (default `live`, check `live`/`held`/`removed`), `moderation_rule`, `moderation_note` and `moderated_at` are in `20261014090000_pulse_post_moderation_state.sql` (S11, PB's half); nothing writes `held` or `removed` until PS's moderation actions (S11) and S8's held sale posts |
| `PostComment` | `helpful_at timestamptz`, `helpful_by uuid`, `moderation_state text not null default 'live'`, `moderation_rule text`. Account deletion must leave a "Reply removed" row instead of cascading (change `user_id` to nullable with `ON DELETE SET NULL`, and soft-delete the text). `moderation_state` (check `live`/`held`/`removed`) and `moderation_rule` are in `20261014091000_pulse_comment_moderation_state.sql` (S11, PB's half, part 2) |
| `PostMute` | `area_id uuid null` (the `topic` entity type already exists); its unique index includes `area_id`. Added with `Post_topic_check`'s widening in `20261014031000_pulse_topics.sql` (S4); the foreign key to `PulseArea` comes with that table |
| `User` | `adult_attested_at timestamptz`; `account_type` check widened with `official` |
| `UserFeedPreference` | `pulse_seen_nearby_at timestamptz`, `pulse_seen_following_at timestamptz` |
| `UserNotificationPreferences` | `digest_enabled boolean`, `digest_time_local time`, `digest_channel text`, `weekly_street_digest_enabled boolean` (PC), `nudge_helper boolean default true` |
| `Plan` | `source_post_id uuid null` (R3); S21: `series_id uuid`, `recurrence jsonb`, `co_host_ids uuid[]`, `paused_at timestamptz` |
| `Post` (later slices) | S23: `merged_into_post_id uuid null`; S24: pinned sources live in `post_metadata.pins` (no column) |
| `SupportTrain` | S22: `source_post_id uuid null` |
| `User` (later slices) | S20/S24: `signup_source text` |
| `UserNotificationPreferences` (later slices) | S24: `reading_home_ids uuid[]` |
| `PostCategoryTTL` | rows: `ask_local` 7, `share` 3, `offer` 7, `lost_found` 14, `alert` 2 (default), keeping existing rows (S7 added `share` and `offer`; the others already had these values) |

### 4.2 New tables awaiting founder approval

**Nothing here merges until the founder ticks "New tables" in the README (hold point H3).** Server-only like the other private tables: RLS on, no client grants. Column lists are sketches for the owner to finalize in the migration PR.

| # | Table | Owner | Purpose and key columns |
|---|---|---|---|
| 1 | `PulseArea` | PB | `id`, `kind` (`town`, `neighborhood`, `street`, `place`), `name`, `slug` unique, `parent_id`, `state`, `boundary geography(MultiPolygon,4326)` with a GiST index, `centroid`, `radius_m` (labeled-radius areas), `opened_at` (null = closed), `source`, `source_url`. Launch rows: the towns of Camas, Washougal and Vancouver WA from US Census place boundaries (public domain), simplified |
| 2 | `PulseFollow` | PB | `user_id`, `target_type`, `target_id text`, `area_id`, `notify`, `ends_on_resolve`, `until_at`; unique per user, target and area |
| 3 | `CommentThanks` | PB | `comment_id`, `from_user_id`, `to_user_id`; unique per comment and thanker |
| 4 | `OfferClaim` | PB | `post_id`, `claimer_id`, `status` (`requested`, `chosen`, `declined`, `gone`), `note`; unique per post and claimer |
| 5 | `KnownEntry` | PB | The same table the Pantopus Agent system design plans (`docs/product/pantopus-agent-system-design-2026-10-04.md`: `area`, `topic`, `question`, `answer`, `sources jsonb`, `status`, `last_confirmed_at`, `review_by`, `created_by`, generated full-text column) plus `kind` (`official` or `neighbor`) and `source_post_ids uuid[]`. One table for both products |
| 6 | `KnownConfirmation` | PB | `entry_id`, `user_id`, `kind` (`confirm`, `correct`, `outdated`), `note` |
| 7 | `RightNowEvent` | PB | `area_id`, `kind`, `title`, official source label, url and text, `status`, `origin` (`official` or `neighbors`), `started_at`, `resolved_at` |
| 8 | `RightNowReport` | PB | `event_id`, `user_id`, `kind` (`me_too`, `its_back`), `home_id` |
| 9 | `ModerationAction` | PS | `target_type`, `target_id`, `action` (`hold`, `remove`, `restore`, `warn`, `slow_mode`, `ban`, `unban`), `rule_code`, `reason_text`, `actor_id` (null = system), `expires_at`, `report_id` |
| 10 | `ModerationAppeal` | PS | `action_id`, `user_id`, `message`, `status`, `decided_by`, `decided_at` |
| 11 | `DigestDelivery` | PC | `user_id`, `kind` (`daily`, `weekly_street`), `period_start`, `sent_at`, `channel`, `item_count`; unique per user, kind and period |

Slices that need no new table can start now: rule cleanups, tolerant decoding, the tab bar, topics (columns only), labels with towns held as a constant until `PulseArea` is approved, lifecycle columns, replies' Helpful column.

## 5. Rules the server enforces

**Who can read a post** (`canReadPost(post, viewer)` in `backend/services/pulse/readAccess.js`, with `readablePosts(posts, viewer)` for lists and `POST_READ_SELECT`, the columns it reads; one function, used everywhere; today it is the post page's rule, and the scopes below arrive with S5):
author → yes · `moderation_state` `removed` → the author only; `held` → the author and staff · signed out → only a post that is public with `allow_external_share` not false · `read_scope = public` → yes · `verified_town` → the viewer has a verified address home inside the post's town area · `verified_area` → inside that street or neighborhood area · `read_scope` null (older posts) → today's `canViewPost` rules, unchanged. Feeds apply the same predicate in the query, never after paging. A client can no longer choose coordinates to read restricted posts. Staff are the admin accounts (`User.role = 'admin'`, as for the report console). The moderation rules are in place (S11, PB's half): the feeds, the map, global pins, the household feed and Today's local updates show `live` posts only, for everyone including the author, who still reads a held or removed post on its page and in their own list. Whoever writes a hold (S8, S11) also holds back that post's notifications until it is live. Replies follow the same rule (`canReadReply`, `onlyShownReplies` in `readAccess.js`): a held or removed reply reads only for its author. The post page and `GET /api/posts/:id/comments` leave it out for everyone else, nobody else can reply to it (`400`) or like it (`404`), and it doesn't count as a reply when an Ask ends (`closed_unanswered`). An answer written before its parent was held or removed stays live; the web lists it, and the apps, which thread replies under their parent, leave it out until S9's conversation shows "Reply removed" in the parent's place.

**How far a Place read reaches** (`feedService`): `GET /api/posts/feed` (the Place surface and its Sports lane) and `GET /api/posts/feed/saved-place/:placeId` read at most 100 miles around their point, the apps' default radius. A larger `radiusMiles` (the apps' 1,000-mile and Global choices) reads 100 miles; a zero, negative or non-numeric one reads the default. `GET /api/posts/map` reads Place posts only in the part of its box within 100 miles of the box's center, north–south and east–west (the connections map is not limited), and returns at most 200 markers per layer. The empty-map hint (`nearest_activity_center`) still searches everywhere; it returns one displayed point, never a post. The stored viewing radius (`PUT /api/location/radius`) keeps accepting every choice; the limit applies when posts are read. This bounds what one request reads; stopping a client from reading somewhere else is the job of the read scopes above.

**Label** (`labelFor(author, area)`, computed at read time, never stored on the post): `pantopus` if `origin = 'curator'` · `official` if `account_type = 'official'` · `business` for a business reply identity · `resident` if the author has a verified address occupancy (postcard, document, landlord or admin; **not** a household invite) for a home whose point is inside the area · `new_here` if a postcard for a home in the area is pending · `nearby` if verified within 15 miles of the area's edge · else `visitor`.

**Distance text:** from the reader's verified home to the author's displayed (grid-snapped) point, using the helpers in `backend/utils/locationPrivacy.js` (PRs 2199, 2201, 2203 and 2204 are changing them; build on `master`, not on the old behavior). Round to 0.1 mi under 1 mi, 0.5 mi under 10 mi, whole miles beyond; `"nearby"` when closer than the grid or when fewer than five verified homes fall in the band; `null` for readers without a verified home and on every public or signed-out response.

**Limits** (constants in one file): Visitor: Asks only, 1 a day · New here: 2 town posts a day · Share: 2 per person per rolling 7 days · offer requests: 5 per offer · replies: 5 a minute per post (today's) · heated pair: 1 reply an hour to each other in that conversation (PS) · business replies: weekly cap (R4).

**Blocks** (`blockService`) hide two people from each other in both directions: neither reads the other's posts (`canReadPost`), comments or likes; neither can reply to the other's comment (`403`, "You can't reply to this comment."); and the notification list and every unread count (`GET /api/notifications`, `GET /api/notifications/unread-count`, the live badge) leave out notices whose actor (`metadata.user_id`) is across a block, including ones from before it. Unblocking brings those notices back.

**How posts end** (S7, `backend/jobs/autoArchivePosts.js`, hourly): a post with `expires_at` ends at that time, whatever its audience. Older posts (no `expires_at`) end as before, local audiences only: by `PostCategoryTTL` days from `created_at`; events 24 hours after `event_end_date`, or after `event_date` when there is no end; deals by `deal_expires_at`; stories by `story_expires_at`. Ending archives the post and, unless it already has a resolution, sets `resolution` with `state: archived`: an Ask someone other than the asker replied to `closed`, one nobody did `closed_unanswered`; Lost and found `closed`; an Event `happened`; anything else `expired`. An answered Ask keeps `answered` and `state: solved`. The views (`/api/posts/feed`, `/api/posts/map`, the Sports lane and global pins, and `/api/pulse/feed` from S6) leave out a post whose `expires_at` has passed at once, before the job runs. Restoring a post that ended by time, or an Ask its author closed (`POST /api/posts/:id/unarchive`), gives it one more of its type's windows from now and reopens it (`state: open`, `resolution: null`) unless it ended its own way.

## 6. Notifications (additive types)

`pulse_helpful` (a reply was marked Helpful), `pulse_thanks` (private thanks), `offer_request` (instant, to the giver), `offer_chosen` / `offer_gone` (to requesters), `ask_still_open` (the day-6 reminder, once per Ask, sent in the first hour outside the asker's quiet hours on the Ask's last day: "Did a reply help?" when someone else replied, "Still need an answer?" when nobody did; `link` `/posts/<id>`, `metadata` `{ post_id, has_replies }`; its actions are section 2.12; in force since S7), `pulse_moderation_notice` (held, removed, restored, appeal decided). Later slices add `pulse_unanswered_nudge` (the helper nudge, S13), `plan_series_confirm` (the host is asked to confirm before a series pauses, S21) and `pulse_merged` (your conversation was merged, S23). Existing `post_commented` and `comment_replied` stay instant. All respect quiet hours except Right now. Copy is in the build spec's appendix or written by the owning stream in plain words.

## 7. Routing (tabs)

- **iOS** `RootTab`: `place`, `today`, `pulse`, `plans`, `mail` (Messages keeps `mail`; labels `Place`, `Today`, `Pulse`, `Plans`, `Messages`; test ids `tab.place|today|pulse|plans|mail`). `nearby` is removed from `allCases`; deep links to nearby resolve to `pulse`.
- **Android** `PantopusRoute.entries = [Place, Today, Pulse, Plans, Mail]`; `Pulse` (`root/pulse`, exists) becomes a bar tab, `Plans` (`root/plans`) is new, `Nearby` stays only as a deep-link alias that resolves to `Pulse`; `owningTab` maps the former Nearby pillars to `Pulse`. The bar draws four or five tabs (`plans` off or on).
- **Plans tab visibility** follows the existing `plans` switch (`PlansFlags.shared.plans` on iOS, `PlansFeature` on Android) and must react to it changing at runtime.
- **Server pushes and links** that used `/app/nearby` now resolve to Pulse; plan notifications resolve to Plans.

## 8. Error codes

| HTTP | `code` | When |
|---|---|---|
| 403 | `SHARE_NOT_ALLOWED` | An external share of a post that is not public (PR 2252, once merged) |
| 403 | `ADULT_ATTESTATION_REQUIRED` | First Pulse post or reply without the attestation |
| 403 | `AGE_NOT_ELIGIBLE` | `POST /api/pulse/adult-attestation` when the date of birth on file is under 18 |
| 403 | `NEEDS_VERIFIED_ADDRESS` | Street or neighborhood post or read without a verified home in that area |
| 403 | `AUDIENCE_NOT_ALLOWED` | The chosen `readScope` or `areaId` isn't one the author may use |
| 403 | `BUSINESS_CANNOT_POST` | A business identity posting to the Place feed: `POST /api/posts` with `postAs: 'business'` (or a `businessId`) and a local audience or the `place` target, and every `POST /api/businesses/:businessId/posts` (in force since S1) |
| 400 | `ALERT_KIND_NOT_ALLOWED` | A Heads-up kind the author may not create, or an Official or curator notice without `sourceUrl`; on create and on an edit that changes the kind (in force since S1) |
| 422 | `COMPOSER_BLOCKED` | A call-out or private detail; body carries `blocks` |
| 429 | `DAILY_LIMIT_REACHED` | `{ limit, resets_at, scope }` |
| 429 | `SHARE_WEEKLY_CAP` | The third Share in a rolling week |
| 409 | `OFFER_GONE` | Claiming or choosing on an offer already claimed |
| 429 | `ENOUGH_REQUESTS` | The sixth request on an offer |
| 404 | `POST_NOT_FOUND` | The post doesn't exist (section 2.12) |
| 403 | `NOT_POST_AUTHOR` | Someone other than the asker keeps open or closes an Ask (section 2.12) |
| 400 | `NOT_AN_ASK` | Keep-open or close on a post that isn't an Ask (section 2.12) |
| 409 | `ASK_ENDED` | Keep-open or close on an Ask already answered, closed or past its end (section 2.12) |
| 409 | `ALREADY_KEPT_OPEN` | A second keep-open on the same Ask (section 2.12) |
| 409 | `CANNOT_WIDEN` | A read-scope change toward wider (S9) |
| 400 | `CODE_INVALID` | A wrong sign-up code (S20) |
| 410 | `CODE_EXPIRED` | An expired or already used sign-up code (S20) |
| 429 | `TOO_MANY_ATTEMPTS` | Five wrong tries, or a per-email, per-device or per-network limit (S20) |
| 503 | `CHANNEL_UNAVAILABLE` | A text code before an SMS provider exists (S20) |
| 409 | `ALREADY_MERGED` | Merging a merged post, or a post into itself (S23) |

## 9. Funnel events

Add to `backend/services/funnelEvents.js` (PB) as each behavior ships; clients post them through the existing app-postable route: see the build spec's metrics section for the names.
