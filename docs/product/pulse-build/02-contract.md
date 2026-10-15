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
  "status": { "state": "open", "resolution": null, "ends_at": null,    // state: open | resolved
              "ends_when": null },   // S12: "Ends when power returns" while a Heads-up waits on a Right now event (2.16)
  "action": { "kind": "answer", "label": "Answer", "done": false },     // the one action and the viewer's state
  "counts": { "replies": 6, "going": null },                             // going only for events
  "event": null,                  // { starts_at, ends_at, venue } for events
  "lost_found": null,             // { kind: "lost" | "found" }
  "offer": null,                  // { claim_mode, requests_open, gone, viewer_claim } for offers (2.8)
  "viewer": {
    "is_author": false, "following": false, "can_mark_helpful": false,
    "saved": false,               // the viewer saved it; POST /api/posts/:id/save toggles it, as on today's cards
    "can_share": false,           // true only when isPubliclyShareable permits an external link; check before opening a share sheet
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

Query: `view` = `nearby` (default) | `following`; `topic` (enum, optional); `area_id` (optional, default the viewer's town); `earlier_before` (the opaque `earlier_cursor`, or an ISO timestamp for compatibility, for "Show earlier"); `limit` (default 30, max 40).

```jsonc
{
  "view": "nearby",
  "read_at": "2026-10-14T18:00:00Z", // server snapshot boundary; use for /new after and /seen through
  "area": { "id": "uuid", "kind": "town", "name": "Camas", "state": "WA" },
  "areas_available": [{ "id": "uuid", "kind": "town", "name": "Camas", "title": "Camas" }],   // area pill; streets and neighborhoods only when opened
  "quiet": null,   // or { "reason": "sparse" | "no_home" | "empty", "card": "meter" | "set_up_home" | null }
  "right_now": null,                       // R3
  "groups": [
    { "key": "town", "title": "AROUND CAMAS", "area_id": "uuid", "items": [ /* PulsePost */ ] }
  ],                                       // order: street, neighborhood, town; only open areas; newest first inside a group
  "end": { "caught_up": true, "since": "2026-10-14T15:00:00Z", "can_show_earlier": true, "earlier_cursor": "<opaque cursor>" }
}
```

- `quiet` is `no_home` (card `set_up_home`) on any page for a reader without a home. Otherwise only the unfiltered first page has one: on Nearby, `empty` when the area has no open conversation and `sparse` (card `meter`) when it has fewer than five, because the meter describes the town; on Following, only `empty` (no card) when nothing followed is open. A short Following list is not quiet.
- `read_at` is the server time captured before the query; only items created at or before it enter the response. `end.since` is the lower bound of the new-items window, for the end card's wording; it is not a seen acknowledgment. Clients read `read_at` optionally until this backend ships and then use it instead of their device clock for polling and acknowledgments.
- The first response holds items **newer than the viewer's last-seen marker** for that view (at least the last 24 hours if the marker is older), capped at `limit`. `caught_up` is true when nothing newer remains beyond the cap.
- `earlier_cursor` is an opaque string: clients pass it back unchanged. It contains the time/id tie-breaker and the original new-items window, so equal timestamps cannot skip posts and later pages preserve the snapshot. The server also accepts an ISO `earlier_before` for older callers.
- `earlier_before` returns the next older items in one flat group `{ "key": "earlier", "title": "EARLIER", … }` (the client appends it below the end card); nothing loads by itself. If the first page was capped (`caught_up: false`), an earlier page sets `caught_up: true` once all remaining new items have been delivered. The client then updates the end card and can acknowledge the original `read_at` after that end is visible; it must not acknowledge an older page's device time.
- `GET /api/pulse/feed/new?view=&topic=&area_id=&after=<iso>` → `{ "count": 3 }` for the "↑ 3 new conversations" pill (poll about once a minute while the screen is visible, or on a socket event). `area_id` is optional and uses the same area as `/feed`; a client browsing another area passes it to both routes.
- `POST /api/pulse/feed/seen` `{ "view": "nearby", "through": "<iso>" }` advances the marker and returns `{ "ok": true, "through": "<iso>" }`. The stored marker never moves backward, including concurrent taps; a future `through` is capped at the server time. The client calls it when the unfiltered end card has been on screen and `caught_up` is true, never earlier.
- The marker belongs to the view, not to a topic, and there is no per-topic marker. With a `topic` chosen, the page reads from the same marker, and the client does not call `/feed/seen` from it: a topic page shows only part of the view, so moving the view's marker would put the other topics' unseen posts behind "Show earlier". Only the unfiltered page (no `topic`) moves the marker.
- Reader checks (section 5) apply to every item; hidden, muted, blocked and held items never appear. The legacy `/api/posts/feed` keeps its shape for the web.

### 2.4 Conversation

`GET /api/pulse/posts/:id` → `{ "post": PulsePost, "replies": [PulseReply], "plan": null }` (`plan` in R3). `GET /api/pulse/posts/:id/replies?after=<iso>` → `{ "replies": [...] }` for the "↓ 2 new replies" pill. Writing a reply uses the existing `POST /api/posts/:id/comments` (`comment`, `parentCommentId`, `clientRequestId`); its response keeps the existing `{ "message": "Comment added successfully", "comment": ... }` envelope. `comment` gains the `PulseReply` fields alongside its legacy fields; `author` retains its existing identity fields while adding `display_name`, `label`, `distance_text`, `avatar_url` and `is_curator`. Existing `comment`, `user_id`, `is_edited`, attachments and author identity fields are not renamed or removed. An idempotent retry returns the same reply id in that envelope.

### 2.5 Creating a post (Pulse mode)

`POST /api/posts` is the one creation path. A request is in **Pulse mode** when it contains `readScope`. New optional fields (camelCase): `readScope`, `areaId`, `topic` (the 12), `postType` (adds `share`, `offer`), `claimMode`, `expiresAt` (alerts only: the time the heads-up names), `sourceUrl` (official or curator alerts; accepted in every mode since S1, stored as `post_metadata.source_url` only on an Official or curator alert; a `source_url` sent inside `postMetadata` is dropped), `locationName` (Share needs a place: `locationName` or `areaId` besides the town). In Pulse mode the server:

1. requires the adult attestation (`ADULT_ATTESTATION_REQUIRED`) and applies the label limits (section 5);
2. runs the composer checks (PS's `evaluateComposerChecks`); a blocking result returns `422 COMPOSER_BLOCKED` with the same `blocks` list the check endpoint returns, and nothing is created;
3. sets `expires_at` and `claim_mode` from the type; when a hold rule fires the post is still created and the response carries `"moderation": {"state": "held", …}` (only its author can see it);
4. rejects business authorship for Place posts (`BUSINESS_CANNOT_POST`); `postAs: 'business'` stays valid for non-place uses it has today.

The response is the created post as today's endpoint returns it plus `pulse: PulsePost`.

#### S8 details (frozen before the implementation PR)

- **Where it is.** `areaId` is an open town, street or neighborhood; it defaults to the town of the author's primary home, and a person with no home must send it (`400 AREA_REQUIRED`). A town takes `readScope` `public` or `verified_town`; a street or neighborhood takes only `verified_area` and needs the author's primary home verified inside it (`403 NEEDS_VERIFIED_ADDRESS`). Any other pairing, or a `place` area before R4, is `403 AUDIENCE_NOT_ALLOWED`.
- **No device location.** Pulse mode ignores `latitude`, `longitude`, the `gps*` fields, `homeId`, `audience`, `visibility`, `radiusMiles` and `distributionTargets`. The server places the post at the author's primary home with `location_precision: approx_area` (the same snapping as every place post); without a home it stores the area's center with precision `none`, so the post shows no distance. It always distributes to `place` only.
- **Who may start what** (the label in that area, section 5): a Visitor starts Asks only (`403 VISITOR_ASK_ONLY`), one in 24 hours; New here, two posts in 24 hours; both answer `429 DAILY_LIMIT_REACHED { limit, resets_at, scope }` with `scope` `visitor_ask` or `new_here`. Anyone: two Share posts in a rolling 7 days (`429 SHARE_WEEKLY_CAP { limit, resets_at }`). `resets_at` is when the oldest counted post leaves the window. A retry with the same `clientRequestId` returns the first post even after a limit is reached.
- **Per type.** `postType` is one of the six. A Share needs a place: `locationName` (up to 255 characters) or a street or neighborhood `areaId` (`400 SHARE_NEEDS_PLACE`). An Offer takes `claimMode` `choose` (default) or `first`. A Heads-up takes `expiresAt`, after now and at most 14 days ahead (`400 INVALID_EXPIRES_AT`), 48 hours when absent, and the resident kinds of section 1. `expires_at` is set at creation: Ask 7 days, Share 3, Offer 7, Lost and found 14 (the `PostCategoryTTL` rows), an Event 24 hours after its end (or its start), and an Event without a date its type's window. At most 9 photos (`400 TOO_MANY_PHOTOS`).
- **Composer checks.** The create path calls PS's `evaluateComposerChecks(text, media, context)` from `backend/services/pulse/safety/composerChecks.js`, with `context` `{ userId, postType, topic, areaId, readScope, mode: "create" | "edit" }`. Besides the section 2.6 fields it returns `holds: [{ rule }]` for the server path only (a sale, PS's other hold rules). A block returns `422 COMPOSER_BLOCKED { blocks }` and creates nothing; a hold creates the post with `moderation_state: held` and that `moderation_rule`. While the module is absent, or when it fails, nothing blocks or holds (fail open, logged).
- **About.** A Pulse post's `about.label` (2.1) is the `locationName` its author gave, otherwise its area's name; an older row's `location_name` is never shown there. `postMetadata.pulse_about` from a client is dropped.
- **Held posts** reach only their author (section 5) and send no notifications; the response's `pulse.moderation.state` is `held`.
- **S12 additions.** `knownEntryId` links a public Ask to the Known entry it asks again (2.14); `rightNowEventId` tags a Heads-up to an active Right now event in its town (2.16). Either on another type, another town or an entry or event the author can't use answers `400 INVALID_PULSE_POST`.
- **Edits** (`PATCH /api/posts/:id`) of a post with a `read_scope` never change its type, point, precision, audience or window: a changed `postType`, `latitude`, `longitude`, `locationPrecision`, `visibility`, `visibilityScope` or `radiusMiles` answers `400 PULSE_FIELD_LOCKED`, and the same value sent back is ignored. Narrowing goes through section 2.13. A content edit runs the composer checks with `mode: "edit"`: a block answers `422 COMPOSER_BLOCKED` and keeps the old text. At most 9 photos.

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
  - `reason` is one of `spam`, `harassment`, `inappropriate`, `misinformation`, `safety`, `other`; `details` is optional, at most 1,000 characters. One report per person per reply: a retry or a second report answers the same `{ "ok": true }` and never overwrites the first. The reply must be one the reporter can read (`404 REPLY_NOT_FOUND` otherwise, including a removed reply or one across a block); a person cannot report their own reply (`400 OWN_REPLY`). The report is stored in the existing `PostReport` queue with `comment_id` set (section 4.1), so the moderator console lists it under its post until PS shows the reply itself.

### 2.8 Offers

`POST /api/pulse/posts/:postId/claims` `{ "note"? }` → `{ "claim": { "id", "status": "requested" | "chosen" | "enough_requests" | "gone" } }` · `GET /api/pulse/posts/:postId/claims` (giver) → requests with each requester's `author` · `POST /api/pulse/posts/:postId/claims/:claimId/choose` → claimed; the others become `gone` and are told.

The claims-list response is frozen for the giver's screen:

```jsonc
{
  "claims": [{
    "id": "uuid", "status": "requested", // requested | chosen | declined | gone
    "note": null,                        // nullable, at most 500 characters
    "created_at": "<iso>",
    "author": { /* the PulsePost author shape, relative to the giver */ }
  }],
  "offer": { "claim_mode": "choose", "requests_open": true, "gone": false }
}
```

- Only the post's author can list requests or choose; other readers get `403 NOT_POST_AUTHOR`. Rows are oldest first, with id as the tie-breaker, and include the giver's prior decision. The list exposes no home or address fields. Blocked people are omitted and cannot be chosen.
- Creation is idempotent per person and offer: retrying returns the same claim. `choose` returns `claim.status: requested`; `first` atomically gives the first requester `chosen`. A successful choice (including a winning `first` request) adds `post_status: { state: "resolved", resolution: "claimed" }`.
- `POST /claims/:claimId/choose` returns `{ "claim": { "id": "uuid", "status": "chosen" }, "post_status": { "state": "resolved", "resolution": "claimed" } }`; choosing that winner again returns the same success. Choosing another after that returns `409 OFFER_GONE`.
- `PulsePost.offer` (2.1) is `{ "claim_mode", "requests_open", "gone", "viewer_claim" }` on an offer and null otherwise. `requests_open` is true while the offer is open and can take another request (in `choose`, fewer than five open requests; in `first`, nobody has it yet). `gone` is true once it is `claimed`. `viewer_claim` is the reader's own request, `{ "id", "status" }` with the statuses above, or null; it lets a client say "Requested", "It's yours" or "Someone else got this one." after a relaunch, and it never describes anyone else's request. `action.done` on an offer is true while the reader's request is `requested` or `chosen`.
- `note` is optional, at most 500 characters. The giver cannot ask for their own offer (`400 OWN_OFFER`); another type answers `400 NOT_AN_OFFER`. Choosing a request that does not exist on that offer, or from someone across a block, answers `404 CLAIM_NOT_FOUND`.
- Notifications (section 6): each new request sends the giver `offer_request` ("Someone asked for your offer"; in `first` mode, "Your offer was claimed"); a choice sends the winner `offer_chosen` ("It's yours") and every other open requester `offer_gone` ("Someone else got this one."). They carry `metadata` `{ post_id, claim_id, user_id }` (the actor) and follow the post's read check, blocks and quiet hours like the reply notices.
- A sixth distinct request returns `429 ENOUGH_REQUESTS`; an offer that has ended returns `409 OFFER_GONE`. These error bodies retain the normal `error` and `code`, with `claim: { id: null, status: "enough_requests" | "gone" }` for clients using the status descriptor. No request is inserted on either refusal. Requests and choices always recheck post access and current offer state; a stale screen grants nothing.


### 2.9 Follow, preferences, why, mutes

- `PUT /api/pulse/follows` `{ "targetType", "targetId", "areaId"?, "notify": "off", "ends": "on_resolve" }` → `{ "follow": {...} }` (one tap sends the defaults) · `DELETE /api/pulse/follows?targetType=&targetId=&areaId=` · `GET /api/pulse/follows`.
- `GET|PUT /api/pulse/preferences` → `{ "digest": { "enabled", "time_local", "timezone", "channel": "email"|"push"|"both" }, "weekly_street_digest": false, "quiet_hours": { "start_local", "end_local" } (existing fields), "nudge_helper": true }`.
- `GET /api/pulse/preferences/summary` → every follow, mute and alert with an `undo` descriptor, for the preferences page.
- `GET /api/pulse/posts/:id/why` → `{ "reasons": [{ "kind": "area" | "topic" | "follow" | "time", "text": "You're viewing Camas, all topics, newest first." }] }`. Only the reader's own choices.
- Mutes (in force since S4): `POST /api/posts/mute/topic` accepts `{ "topic", "areaId"? }` → `{ "message", "mute": { "topic", "area_id" } }`; without `areaId` the topic is muted everywhere; an unknown topic or a malformed or nonexistent `areaId` is a 400; muting twice keeps one mute. The legacy `{ "postType", "surface"? }` still works. `GET /api/posts/mute` → `{ "muted": [ …people and businesses, unchanged ], "topic_mutes": [{ "topic", "area_id", "muted_at" }] }`. `DELETE /api/posts/mute` `{ "entityType": "topic", "entityId": "<topic>", "areaId"? }` (body or query string) removes that one mute (without `areaId`, the everywhere mute). A topic muted in an area hides that topic's posts in the area and posts that have no area (every post until `Post.area_id` arrives with S5). User mutes as today.
- Topic filter (in force since S4): `GET /api/posts/feed?surface=place&topic=<topic>` returns only that topic's posts, for any of the 12; `sports` keeps its Sports lane.

#### S10 follow envelopes and duration rules

`targetType` is `post`, `topic` or `place`; a person is never a follow target. `targetId` is a post UUID, one of the twelve topic ids, or a place-area UUID respectively. A topic requires `areaId`; post and place targets omit it. All targets must be currently readable and their area open. A follow never grants reading access. Businesses cannot follow.

`notify` is `off` (default), `recap` or `each`. `ends` is `on_resolve` (default for a post), `week` or `keep`; topic/place targets default to `keep` and reject `on_resolve`. Following a post that already ended is allowed only with `week` or `keep`. Repeating the same PUT updates the existing follow, never duplicates it or restarts a running week; switching to `week` starts seven days from the server time. After a week has expired, following again starts a new week. `on_resolve` ends permanently when that conversation ends, even if it is later restored. A retained `keep` follow remains in preferences after the post ends, but the ended post stays out of the Following feed.

`PUT /follows` returns `{ "follow": PulseFollow }`; `GET /follows` returns `{ "follows": [PulseFollow] }` in creation order, oldest first. `DELETE /follows` returns `{ "ok": true }` even when already absent. A `PulseFollow` is:

```jsonc
{
  "id": "uuid", "target_type": "post", "target_id": "uuid-or-topic",
  "area_id": null, "notify": "off", "ends": "on_resolve",
  "until_at": null, "created_at": "<iso>", "updated_at": "<iso>"
}
```

The list contains only active follows whose targets the viewer can still read; no target text, author or home fields are included. Nearby and Following use the same area/topic/time, moderation, block, mute and hide rules. Following additionally requires an active matching post follow, a matching topic-and-area follow, or a matching place follow, before pagination and new-count calculation. A follow does not subscribe to older topic/place posts: those targets match posts created at or after that follow's `created_at`. A post follow can show that conversation regardless of its creation time. `PulsePost.viewer.following` means an active **conversation** follow; a topic follow does not turn that header toggle on.

`GET /preferences/summary` returns `{ "follows": [PulseFollow], "mutes": [...], "alerts": [...] }`. Each list item adds `undo: { method, path, body? }`: follow undo is the DELETE query above, mute undo is the existing `DELETE /api/posts/mute` body, and a follow alert's undo is PUT with its existing target/duration and `notify: off`. Quiet-hours and digest settings remain in `/preferences`; the summary does not expose another person's choices. Muted or unreadable targets never gain visibility because they are followed.

`GET /posts/:id/why` accepts optional `view`, `topic` and `area_id` with the same validation as the feed. It checks current post access first and explains only the viewer's selected area, topic, explicit matching follow and newest-first order. It never asserts a follow the viewer does not have.

### 2.13 Narrower conversation audiences (S9)

`PUT /api/pulse/posts/:id/read-scope` accepts `{ "readScope": "public" | "verified_town" | "verified_area", "areaId"?: "uuid" }` and returns `{ "post": PulsePost }`. Only the author can change it. A repeated request for the current scope and area succeeds; any widening or lateral move returns `409 CANNOT_WIDEN`.

Public can narrow to the post's town, then to an open street/neighborhood inside that town where the author's primary home is currently verified. `areaId` selects that street/neighborhood for `verified_area`; it is required when changing from a town reference, and may be omitted when the existing reference already names the desired street/neighborhood. Town narrowing keeps the post's existing area reference, whose town ancestry supplies the wall. Changing between two street/neighborhood areas is refused even if both contain the author's home: it would admit a different set of readers. No device coordinates are accepted. A closed area or missing primary-home verification returns `403 NEEDS_VERIFIED_ADDRESS`.

Legacy rows with null `read_scope` can narrow only when their existing audience is public; other legacy audience sets are not assumed to contain every verified town resident. The server derives their town from the author's primary home and requires an open town. If no safe town can be derived, it refuses without changing the row. A successful narrowing turns off external sharing. The shared wall immediately revokes direct reads, feeds, replies, notification quotes and share links for readers outside the new audience; stored replies and follows stay.

### 2.10 Areas and eligibility

`GET /api/pulse/areas/mine` → `{ "town": Area|null, "neighborhood": Area|null, "street": Area|null, "home_verified": boolean }`. `Area` is `{ "id": "uuid", "kind": "town|neighborhood|street|place", "name": "Camas", "state": "WA", "title": "Camas" }` (the same area metadata as the feed pill). Only areas whose `opened_at` has arrived appear. The primary home's town is the default; street and neighborhood require address verification for that home. Without a current home, all three areas are null and `home_verified` is false. Reading permissions still use the set of all current verified homes (S24), independently of this default.

`GET /api/pulse/areas/search?q=` → `{ "areas": [Area] }`, open towns only, name order, at most 20; `q` is a literal substring (empty lists available towns), up to 80 characters. Both area endpoints require sign-in. Neither accepts device coordinates nor returns home ids, points, polygons or measured distances. Lookup failure is 503 with a plain `error` sentence; it never invents a home or verification state. `POST /api/pulse/adult-attestation` → `{ "attested_at" }`.

`POST /api/pulse/adult-attestation` (in force since S5's first PR): no body; stores `User.adult_attested_at` once and returns it, the first time again on every later call (a double tap answers the same); `403 AGE_NOT_ELIGIBLE` when the date of birth on file says the person is under 18.

### 2.11 Safety (PS, S11)

`GET /api/pulse/notices` → the author's own held and removed items `{ id, target_type, target_id, state, rule_code, reason_text, created_at, can_appeal }` · `POST /api/pulse/appeals` `{ "noticeId", "message" }` → `{ "appeal": {...} }`. The moderator console uses the existing `backend/routes/adminReports.js` and web `app/admin/reports`, extended.

### 2.12 Ending an Ask (S7)

The asker's two actions on an open Ask, offered by the day-6 reminder (`ask_still_open`, section 6) and on the Ask itself when `viewer.is_author`:

- `POST /api/pulse/posts/:postId/keep-open`, no body → `{ "post_status": { "state": "open", "resolution": null, "ends_at": "<iso>" } }`. Moves the end 7 days past where it was, once per Ask (stored as `post_metadata.kept_open_at`); a second time answers `409 ALREADY_KEPT_OPEN`. On a `PulsePost`, `viewer.can_keep_open` is true exactly when this call would succeed, so clients offer "Keep open 7 more days" only then.
- `POST /api/pulse/posts/:postId/close`, no body → `{ "post_status": { "state": "resolved", "resolution": "closed" | "closed_unanswered" } }`. `closed` when someone other than the asker replied, `closed_unanswered` when nobody did. The Ask leaves the views like any ended post; restoring it from My posts reopens it for another window (section 5).

Both answer `404 POST_NOT_FOUND`, `403 NOT_POST_AUTHOR` (not the asker), `400 NOT_AN_ASK` (another type), and `409 ASK_ENDED` when the Ask is already answered, closed or past its end.

### 2.14 Known (S12)

Known lists short, sourced answers for a town. The curator and staff write entries (PS's drafting and console call PB's functions below); residents confirm, suggest a correction or flag an entry outdated; nobody edits an entry directly. All Known routes require sign-in; `area_id` works as on the feed (default: the reader's town).

`GET /api/pulse/known?area_id=&q=&topic=` → `{ "area": Area, "entries": [KnownSummary] }`: published and stale entries in the town, most recently confirmed first, at most 50. `q` (up to 80 characters) matches titles and answers with search's rules (2.17); `topic` filters.

```jsonc
// KnownSummary
{ "id": "uuid", "title": "Plumbers neighbors recommend", "topic": "home_repairs",
  "kind": "neighbor",              // neighbor | official: clients show them differently
  "status": "published",           // published | stale ("May be out of date")
  "last_confirmed_at": "<iso>", "conversation_count": 7, "item_count": 3 }
```

`GET /api/pulse/known/:id` → `{ "entry": KnownEntry }`:

```jsonc
{
  "id": "uuid", "area": Area, "topic": "home_repairs", "kind": "neighbor", "status": "published",
  "title": "Plumbers neighbors recommend",
  "answer": null,                           // the answer's text; null for an entry that is a list of recommendations
  "items": [{                               // recommendations, most recently recommended first
    "name": "Harbor Plumbing",
    "recommended_by": { "names": ["Priya", "Tom"], "others": 4 },   // first names as the public posts showed them
    "latest_at": "<iso>",
    "quote": { "text": "Fixed our water heater the same day and explained the bill.", "display_name": "Priya",
               "label": "resident", "post_id": "uuid", "reply_id": "uuid" }                  // or null
  }],
  "sources": {
    "conversations": [{ "post_id": "uuid", "title": "Who's a good plumber?", "created_at": "<iso>" }],   // newest first, at most 20
    "conversation_count": 7, "first_at": "<iso>", "last_at": "<iso>",
    "official": [{ "label": "City of Camas", "url": "https://…", "retrieved_at": "<iso>" }]
  },
  "last_confirmed_at": "<iso>",
  "asked_again": { "post_id": "uuid", "at": "<iso>" },                  // the open Ask that will refresh it, or null
  "viewer": { "can_respond": true, "confirmed": false, "suggested_correction": false, "flagged_outdated": false }
}
```

- **Only public conversations and official links feed Known.** A post counts only while it is `read_scope: public`, `live` and not removed from the web view; a reply only while it is live and its author's account exists. A street, neighborhood or town-only post, a held or removed one, one its author narrowed, and a deleted post or account never appear in `items`, a quote, `recommended_by`, `sources` or any count. This is decided when the entry is read, so deleting a post or an account takes its quote and its share of every count away at once. People across a block from the reader are left out of that reader's names, quotes and counts.
- No ratings: `items` are ordered by `latest_at` only. A business appears only as a name residents recommended; nothing about an entry can be bought or edited by a business.
- Official entries (`kind: official`) carry `answer` and `sources.official`; they may cite public property facts the Place tab already shows (school zone, flood zone), never valuations or ownership.
- `POST /api/pulse/known/:id/confirm`, `POST /api/pulse/known/:id/correct` `{ "note" }` (1 to 500 characters) and `POST /api/pulse/known/:id/outdated` `{ "note"? }` → `{ "entry": KnownEntry }`. Only someone with a verified home in the entry's town (`403 NEEDS_VERIFIED_ADDRESS`); business accounts `403 BUSINESS_CANNOT_POST`. A person counts once per kind until the entry is next confirmed (repeating answers the same entry). Confirmations from two different people with different homes since `last_confirmed_at` refresh the entry (`last_confirmed_at` becomes now and a stale entry is published again); two outdated flags from different homes make it `stale`. A correction goes to staff (PS's console) and changes nothing by itself. `viewer.can_respond` says whether these calls would be accepted.
- **Asking again.** The "Ask again to refresh" button opens the composer with the entry's title; the Ask is created through `POST /api/posts` in Pulse mode (2.5) with `knownEntryId`. Its area and topic default to the entry's, and it must be a public Ask in the entry's town (`400 INVALID_PULSE_POST` otherwise). The entry then shows `asked_again`. When that Ask is answered (the asker marks a reply Helpful), the Helpful reply joins the entry's sources if it is public and the entry is refreshed. This replaces the outlined `POST /api/pulse/known/ask-again`.
- `404 KNOWN_NOT_FOUND` for an entry that doesn't exist, is a draft or retired, or is in an area the reader can't open.
- For PS, in process (`backend/services/pulse/known.js`): `saveDraft`, `publish`, `retire`, `openCorrections(areaId)` and `similar(text, areaId)`, which gives the composer check's `existing` items (`{ "kind": "known", "id", "title", "meta" }`, 2.6).

### 2.15 Upcoming (S12)

`GET /api/pulse/upcoming?area_id=&limit=` → `{ "area": Area, "items": [UpcomingItem] }`: the next 14 days, soonest first, at most `limit` (default 20, max 50).

```jsonc
{ "kind": "event", "starts_at": "<iso>", "ends_at": "<iso>|null", "post": PulsePost }   // an Event posted in Pulse, Official and curator events included
{ "kind": "plan",  "starts_at": "<iso>", "ends_at": "<iso>|null", "plan": { /* the card GET /api/plans returns */ } }
```

- Events follow the feed's reader rules (walls, moderation, blocks, mutes, hides) in the town or `area_id`. An event stays until its `ends_at`, or for 3 hours after `starts_at` when it has no end.
- Plans are those `GET /api/plans` would list for the reader within the town's reach (its own rules: kinds, playdates, holds), and only while the `plans` switch is on for the reader.
- "Going" is the only RSVP: the event card's `action` (`going`) and the plan's own request flow. Interest alone counts nobody.

### 2.16 Right now (S12)

The feed's `right_now` (2.3) and `GET /api/pulse/right-now?area_id=` → `{ "right_now": RightNow | null }`:

```jsonc
{
  "id": "uuid",
  "kind": "power_outage",          // power_outage | water_outage | smoke | road_closure | severe_weather | boil_notice; never crime
  "title": "Power outage around Prune Hill",
  "area": Area,                    // the town, or a street or neighborhood in it
  "origin": "official",            // official | neighbors: "Reported by neighbors" until an official source confirms
  "official": { "source_label": "Utility", "text": "About 1,200 homes are without power. Crews expect to restore it by 11pm.",
                "url": "https://…", "updated_at": "<iso>" },      // null while only neighbors report it
  "updated_at": "<iso>",
  "reports": { "me_too": 38, "its_back": 2 },                    // homes, not people
  "ends_when": "The card ends when power is restored.",
  "viewer": { "report": null, "can_report": true }               // report: me_too | its_back | null
}
```

- At most one card, only while something is active, for the town being read or an open street or neighborhood in it: official before neighbors, then the most recently updated.
- `POST /api/pulse/right-now/:id/report` `{ "kind": "me_too" | "its_back" }` → `{ "right_now": RightNow }`; `DELETE /api/pulse/right-now/:id/report` withdraws it. A report belongs to the reporter's verified home inside the event's area (`403 NEEDS_VERIFIED_ADDRESS` without one); a person has one report per event, and a second call replaces the first. `404 RIGHT_NOW_NOT_FOUND`, `409 RIGHT_NOW_ENDED`. No free text.
- **Official start and updates.** Official and curator accounts: `POST /api/pulse/right-now` `{ "areaId", "kind", "title", "text", "sourceLabel", "sourceUrl" }` starts an event, or confirms an active neighbors' event of the same kind in that area (it becomes `official`); `POST /api/pulse/right-now/:id/update` `{ "text" }` and `POST /api/pulse/right-now/:id/clear`. Everyone else `403 NOT_OFFICIAL`; another kind `400 INVALID_RIGHT_NOW`.
- **Neighbors start one.** Pulse Heads-ups of kind `power_outage` from three different verified homes in one town within an hour start a `neighbors` event for that town and are tagged to it.
- **Ending.** An official event ends when its source clears it. A neighbors' event ends when three homes say "It's back", or when no home has reported or posted about it for three hours (the hourly lifecycle job).
- **Heads-ups during an event.** A Pulse Heads-up may be created with `rightNowEventId` (an active event in its town). Without its own `expiresAt` it ends when the event ends: meanwhile its card's `status.ends_at` is null and `status.ends_when` reads "Ends when power returns" (per kind). With an `expiresAt` it keeps that end. `PulsePost.status.ends_when` is null otherwise.
- Starting an event sends no notification in this slice; `pulse_right_now` (section 6) is reserved for it, with PC's noise budget.

### 2.17 Search (S12)

`GET /api/pulse/search?q=&area_id=&cursor=` → `{ "area": Area, "q": "…", "posts": [PulsePost], "known": [KnownSummary], "places": [Area], "next_cursor": "…" | null }`.

- `q` is 2 to 80 characters of plain words: quotes, `&`, `|`, `:*`, accents and emoji are matched as text and never cause an error; `400 INVALID_SEARCH` outside that length. Matching uses English word stems, so "plumbers" finds "plumber"; accents must match as typed.
- `posts`: conversations in the town or `area_id` whose title or text match, newest first, 20 a page (`next_cursor`, opaque, pages `posts` only). **Resolved and ended conversations are included** and their `status` says so. The feed's reader rules apply: never held, removed, muted, hidden, blocked or unreadable posts.
- `known`: up to 5 matching entries in the town (2.14). `places`: up to 5 open areas in the town whose names contain the words (places, and the streets and neighborhoods the reader may open).

## 3. Outlined (shapes are published by the owner before the first client PR)

| Slice | Endpoints (owner) |
|---|---|
| S12 | Frozen in 2.14 (Known), 2.15 (Upcoming), 2.16 (Right now) and 2.17 (Search) (PB data and routes; PS drafting) |
| S13 | Digest content and delivery are jobs, not endpoints (PC); preferences above. PC reads content in process from PB's `backend/services/pulse/content.js`: `digestPosts(viewerId, { since, until?, limit?, perGroup?, areaId? })` → `{ area, since, until, total, groups: [{ key, title, area_id, total, items: [PulsePost] }] }`; `unansweredForHelper(viewerId, { minAgeHours?, limit?, excludePostIds?, areaId? })` → `{ posts: [PulsePost] }`; `followRecaps(viewerId, { since, until? })` → `{ since, until, conversations: [{ follow: PulseFollow, post: PulsePost, replies: [PulseReply] }] }`; `getSeenMarker(viewerId, view)` → ISO time or null. They use the feed's own read rules, carry no distance and no media, and never move a marker (PB) |
| S14 | `GET /api/pulse/posts/:id` fills `plan`; `POST /api/pulse/posts/:id/plan` creates a Plan through the existing Plans services with `Plan.source_post_id` (PB) |
| S15 | `GET /api/public/pulse/areas`, `GET /api/public/pulse/feed?area=`, `GET /api/public/pulse/posts/:id` (public posts only; no distance, no street, first name and label) (PC with PB) |
| S16–S17 | Place pages, area opening, business and official identities (PB, PS) |
| S9 (addition) | Narrower audiences are frozen in §2.13 (PB); the endpoint is not live until its implementation merges |
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
| `Post` | `read_scope text` (check: `public`, `verified_town`, `verified_area`), `area_id uuid` (FK `PulseArea`, after approval), `expires_at timestamptz`, `resolution text` (check, section 1), `claim_mode text default 'choose'`, `moderation_state text not null default 'live'`, `moderation_rule text`, `moderation_note text`, `moderated_at timestamptz`, search over title and text (R3: an expression GIN index on `to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,''))`, not a stored column, so `Post` is not rewritten), `right_now_event_id uuid null` (FK `RightNowEvent`, S12; a Heads-up tagged to an event). Widen `Post_post_type_check` with `share`, `offer`; widen `Post_topic_check` to the 12 topics (plus legacy `sports`); keep `state` in sync (`open` → `solved` when `answered`, `archived` otherwise) so older clients still read it. `expires_at`, `resolution`, `claim_mode` and the two new types are in `20261014070000_pulse_post_lifecycle.sql` (S7); legacy post rows (`/api/posts/feed`, saved, profile lists, `GET /api/posts/:id`) return the three columns as stored (`claim_mode` is on every row and means something only on an offer), and marking an Ask solved (`PATCH /api/posts/:id/solve`, `PATCH /api/posts/resolve/:id`) sets `resolution: answered` with `state: solved`. `moderation_state` (default `live`, check `live`/`held`/`removed`), `moderation_rule`, `moderation_note` and `moderated_at` are in `20261014090000_pulse_post_moderation_state.sql` (S11, PB's half); nothing writes `held` or `removed` until PS's moderation actions (S11) and S8's held sale posts |
| `PostComment` | `helpful_at timestamptz`, `helpful_by uuid`, `moderation_state text not null default 'live'`, `moderation_rule text`. Account deletion must leave a "Reply removed" row instead of cascading (change `user_id` to nullable with `ON DELETE SET NULL`, and soft-delete the text). `moderation_state` (check `live`/`held`/`removed`) and `moderation_rule` are in `20261014091000_pulse_comment_moderation_state.sql` (S11, PB's half, part 2) |
| `PostReport` | `comment_id uuid null` (foreign key to `PostComment`, deleted with it): a report about one reply of the post (S9, 2.7). Post reports leave it null |
| `PostMute` | `area_id uuid null` (the `topic` entity type already exists); its unique index includes `area_id`. Added with `Post_topic_check`'s widening in `20261014031000_pulse_topics.sql` (S4); the foreign key to `PulseArea` comes with that table |
| `User` | `adult_attested_at timestamptz`; `account_type` check widened with `official` |
| `UserFeedPreference` | `pulse_nearby_seen_at timestamptz`, `pulse_following_seen_at timestamptz` (server-only storage finalized before S6; clients use `/feed/seen`, never these columns) |
| `UserNotificationPreferences` | `digest_enabled boolean`, `digest_time_local time`, `digest_channel text`, `weekly_street_digest_enabled boolean` (PC), `nudge_helper boolean default true` |
| `Plan` | `source_post_id uuid null` (R3); S21: `series_id uuid`, `recurrence jsonb`, `co_host_ids uuid[]`, `paused_at timestamptz` |
| `Post` (later slices) | S23: `merged_into_post_id uuid null`; S24: pinned sources live in `post_metadata.pins` (no column) |
| `SupportTrain` | S22: `source_post_id uuid null` |
| `User` (later slices) | S20/S24: `signup_source text` |
| `UserNotificationPreferences` (later slices) | S24: `reading_home_ids uuid[]` |
| `PostCategoryTTL` | rows: `ask_local` 7, `share` 3, `offer` 7, `lost_found` 14, `alert` 2 (default), keeping existing rows (S7 added `share` and `offer`; the others already had these values) |

### 4.2 New tables awaiting founder approval

**Approved by the founder on October 14, 2026; "New tables" is ticked in the README (hold point H3).** The public Census boundary download is approved too. Server-only like the other private tables: RLS on, no client grants. Column lists are sketches for the owner to finalize in the migration PR.

| # | Table | Owner | Purpose and key columns |
|---|---|---|---|
| 1 | `PulseArea` | PB | `id`, `kind` (`town`, `neighborhood`, `street`, `place`), `name`, `slug` unique, `parent_id`, `state`, `boundary geography(MultiPolygon,4326)` with a GiST index, `centroid`, `radius_m` (labeled-radius areas), `opened_at` (null = closed), `source`, `source_url`. Launch rows: the towns of Camas, Washougal and Vancouver WA from US Census place boundaries (public domain), simplified. Created in `20261014195500_pulse_areas.sql` (with nullable `Post.area_id` and the `PostMute.area_id` foreign key). The mute FK enforces new writes without rewriting pre-S5 area UUIDs, which remain removable. `20261014195600_pulse_launch_towns.sql` seeds the three approved towns from January 1, 2026 Census boundaries, simplified at 5 metres |
| 2 | `PulseFollow` | PB | `user_id`, `target_type`, `target_id text`, `area_id`, `notify`, `ends_on_resolve`, `until_at`; unique per user, target and area |
| 3 | `CommentThanks` | PB | `comment_id`, `from_user_id`, `to_user_id`; unique per comment and thanker |
| 4 | `OfferClaim` | PB | `post_id`, `claimer_id`, `status` (`requested`, `chosen`, `declined`, `gone`), `note`; unique per post and claimer |
| 5 | `KnownEntry` | PB | The same table the Pantopus Agent system design plans (`docs/product/pantopus-agent-system-design-2026-10-04.md`: `area`, `topic`, `question`, `answer`, `sources jsonb`, `status`, `last_confirmed_at`, `review_by`, `created_by`, generated full-text column) plus `kind` (`official` or `neighbor`) and `source_post_ids uuid[]`. One table for both products. Final columns (S12): `id`, `area_id` (FK `PulseArea`), `topic`, `kind`, `question` (the title), `answer`, `items jsonb` (recommendations: name and the post or reply that recommended it), `sources jsonb` (official links and conversation post ids), `source_post_ids uuid[]` (GIN), `status` (`draft`, `published`, `stale`, `retired`), `last_confirmed_at`, `review_by`, `asked_post_id`, `asked_at`, `created_by`, `published_by`, `created_at`, `updated_at`, a generated `search tsvector` (GIN) |
| 6 | `KnownConfirmation` | PB | `entry_id`, `user_id`, `kind` (`confirm`, `correct`, `outdated`), `note`. Final columns (S12): plus `id`, `home_id` (the verified home it counted for), `created_at`, `resolved_at` and `resolved_by` (staff closing a correction) |
| 7 | `RightNowEvent` | PB | `area_id`, `kind`, `title`, official source label, url and text, `status`, `origin` (`official` or `neighbors`), `started_at`, `resolved_at`. Final columns (S12): `id`, `area_id`, `kind` (2.16; no crime kind exists), `title`, `origin`, `status` (`active`, `ended`), `official_source_label`, `official_source_url`, `official_text`, `official_updated_at`, `started_at`, `resolved_at`, `end_reason` (`cleared`, `its_back`, `quiet`), `last_activity_at`, `created_by`, `updated_at` |
| 8 | `RightNowReport` | PB | `event_id`, `user_id`, `kind` (`me_too`, `its_back`), `home_id`. Final columns (S12): plus `id`, `created_at`, `updated_at`; one row per event and person |
| 9 | `ModerationAction` | PS | `target_type`, `target_id`, `action` (`hold`, `remove`, `restore`, `warn`, `slow_mode`, `ban`, `unban`), `rule_code`, `reason_text`, `actor_id` (null = system), `expires_at`, `report_id` |
| 10 | `ModerationAppeal` | PS | `action_id`, `user_id`, `message`, `status`, `decided_by`, `decided_at` |
| 11 | `DigestDelivery` | PC | `user_id`, `kind` (`daily`, `weekly_street`), `period_start`, `sent_at`, `channel`, `item_count`; unique per user, kind and period |

Slices that need no new table can start now: rule cleanups, tolerant decoding, the tab bar, topics (columns only), labels with towns held as a constant until `PulseArea` is approved, lifecycle columns, replies' Helpful column.

## 5. Rules the server enforces

**Who can read a post** (`canReadPost(post, viewer)` in `backend/services/pulse/readAccess.js`, with `readablePosts(posts, viewer)` for lists and `POST_READ_SELECT`, the columns it reads; one shared policy, used by direct reads and the query predicates below):
author → yes · `moderation_state` `removed` → the author only; `held` → the author and staff · signed out → only a post that is public with `allow_external_share` not false · `read_scope = public` → yes · `verified_town` → the viewer has a verified address home inside the post's town area · `verified_area` → inside that street or neighborhood area · `read_scope` null (older posts) → today's `canViewPost` rules, unchanged. Feeds apply the same predicate in the query, never after paging. A client can no longer choose coordinates to read restricted posts. Staff are the admin accounts (`User.role = 'admin'`, as for the report console). The moderation rules are in place (S11, PB's half): the feeds, the map, global pins, the household feed and Today's local updates show `live` posts only, for everyone including the author, who still reads a held or removed post on its page and in their own list. Plans uses the same moderation predicate before its existing private venue and guest rules: discovery/map/nearest counts select live posts; held or removed detail and My plans rows remain readable to their author (held detail also to staff), and public previews refuse both. Whoever writes a hold (S8, S11) also holds back that post's notifications until it is live. Replies follow the same rule (`canReadReply`, `onlyShownReplies` in `readAccess.js`): a held or removed reply reads only for its author. The post page and `GET /api/posts/:id/comments` leave it out for everyone else, nobody else can reply to it (`400`) or like it (`404`), and it doesn't count as a reply when an Ask ends (`closed_unanswered`). An answer written before its parent was held or removed stays live; the web lists it, and the apps, which thread replies under their parent, leave it out until S9's conversation shows "Reply removed" in the parent's place.

**How far a Place read reaches** (`feedService`): `GET /api/posts/feed` (the Place surface and its Sports lane) and `GET /api/posts/feed/saved-place/:placeId` read at most 100 miles around their point, the apps' default radius. A larger `radiusMiles` (the apps' 1,000-mile and Global choices) reads 100 miles; a zero, negative or non-numeric one reads the default. `GET /api/posts/map` reads Place posts only in the part of its box within 100 miles of the box's center, north–south and east–west (the connections map is not limited), and returns at most 200 markers per layer. The empty-map hint (`nearest_activity_center`) still searches everywhere; it returns one displayed point, never a post. The stored viewing radius (`PUT /api/location/radius`) keeps accepting every choice; the limit applies when posts are read. This bounds what one request reads; stopping a client from reading somewhere else is the job of the read scopes above.

**Label** (`labelFor(author, area)`, computed at read time, never stored on the post): `pantopus` if `origin = 'curator'` · `official` if `account_type = 'official'` · `business` for a business reply identity · `resident` if the author has a verified address occupancy (postcard, document, landlord or admin; **not** a household invite) for a home whose point is inside the area · `new_here` if a postcard for a home in the area is pending · `nearby` if verified within 15 miles of the area's edge · else `visitor`.

Labels use the author's **primary** home, as posting and limits do. A second verified home adds reading access only; it cannot change the author's label.

**Scope enforcement (S5):** `postScopeAccess(viewer)` derives the viewer's current verified-home set once per request; its query predicate runs before limits, pages and counts on legacy feeds/maps/Sports/global pins, saved and profile lists, household feeds, business/persona/channel post reads, Today local updates and Plans. A second verified home grants reading only; moving it or ending occupancy removes that grant on the next request. Closed/future or missing areas grant no restricted access. Global pin rows are no longer cached across viewers. `read_scope` is nullable (`20261014203000_pulse_read_scopes.sql`); existing null rows retain their legacy rules, and creation does not write new scopes until S8. Failed residency lookups fail closed. New public scopes still require external sharing enabled for signed-out reads.

`notificationPostFilter` applies the same scope predicate to the current referenced post/reply before inbox pagination, unread counts, live badges and a mark-read response. The service-only computed projection contains no home information and is never selected into a client response. Missing posts and deleted replies cannot keep quoting content; held/removed replies are visible only to their author. Socket, desktop and push delivery recheck this predicate before emitting a post-linked notice. An older stored notice is re-evaluated when read; narrowing or moving revokes it immediately. PC's new digest/search paths must call the shared policy before selecting or quoting posts.

**Distance text:** from the reader's verified home to the author's displayed (grid-snapped) point, using the helpers in `backend/utils/locationPrivacy.js` (PRs 2199, 2201, 2203 and 2204 are changing them; build on `master`, not on the old behavior). Round to 0.1 mi under 1 mi, 0.5 mi under 10 mi, whole miles beyond; `"nearby"` when closer than the grid or when fewer than five verified homes fall in the band; `null` for readers without a verified home and on every public or signed-out response.

**Limits** (constants in one file, `backend/services/pulse/limits.js`; the windows are rolling 24 hours and 7 days, details in 2.5): Visitor: Asks only, 1 a day · New here: 2 town posts a day · Share: 2 per person per rolling 7 days · offer requests: 5 per offer · replies: 5 a minute per post (today's) · heated pair: 1 reply an hour to each other in that conversation (PS) · business replies: weekly cap (R4).

**Blocks** (`blockService`) hide two people from each other in both directions: neither reads the other's posts (`canReadPost`), comments or likes; neither can reply to the other's comment (`403`, "You can't reply to this comment."); and the notification list and every unread count (`GET /api/notifications`, `GET /api/notifications/unread-count`, the live badge) leave out notices whose actor (`metadata.user_id`) is across a block, including ones from before it. Unblocking brings those notices back.

**How posts end** (S7, `backend/jobs/autoArchivePosts.js`, hourly): a post with `expires_at` ends at that time, whatever its audience. Older posts (no `expires_at`) end as before, local audiences only: by `PostCategoryTTL` days from `created_at`; events 24 hours after `event_end_date`, or after `event_date` when there is no end; deals by `deal_expires_at`; stories by `story_expires_at`. Ending archives the post and, unless it already has a resolution, sets `resolution` with `state: archived`: an Ask someone other than the asker replied to `closed`, one nobody did `closed_unanswered`; Lost and found `closed`; an Event `happened`; anything else `expired`. An answered Ask keeps `answered` and `state: solved`. The views (`/api/posts/feed`, `/api/posts/map`, the Sports lane and global pins, and `/api/pulse/feed` from S6) leave out a post whose `expires_at` has passed at once, before the job runs. Restoring a post that ended by time, or an Ask its author closed (`POST /api/posts/:id/unarchive`), gives it one more of its type's windows from now and reopens it (`state: open`, `resolution: null`) unless it ended its own way.

## 6. Notifications (additive types)

`pulse_helpful` (a reply was marked Helpful), `pulse_thanks` (private thanks), `offer_request` (instant, to the giver), `offer_chosen` / `offer_gone` (to requesters), `ask_still_open` (the day-6 reminder, once per Ask, sent in the first hour outside the asker's quiet hours on the Ask's last day: "Did a reply help?" when someone else replied, "Still need an answer?" when nobody did; `link` `/posts/<id>`, `metadata` `{ post_id, has_replies }`; its actions are section 2.12; in force since S7), `pulse_moderation_notice` (held, removed, restored, appeal decided). `pulse_follow_reply` (a conversation the reader follows with `notify: each` got a reply from someone else; in-app only, stored by PB with no push, since a follow alert is not about the reader and PC's noise budget decides whether and when it is pushed, at most one such push a day; title "New reply to a post you follow", body the conversation's title or opening words; `link` `/posts/<id>`, `metadata` `{ post_id, comment_id, user_id, follow_id }` with `user_id` the replier; none for a held or removed reply, for the post's author or the parent reply's author, who have their direct notice, or for a follower who can no longer read the post, is across a block from the replier, muted them or hid the post; an "until it ends" follow stops alerting when the conversation ends; in force since PB's content-helpers PR). `pulse_right_now` (a Right now update for an area the reader lives in, S12; the one Pulse push not held by quiet hours or the daily cap). Later slices add `pulse_unanswered_nudge` (the helper nudge, S13), `plan_series_confirm` (the host is asked to confirm before a series pauses, S21) and `pulse_merged` (your conversation was merged, S23). Existing `post_commented` and `comment_replied` stay instant. All respect quiet hours except Right now. Copy is in the build spec's appendix or written by the owning stream in plain words.

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
| 409 | `OFFER_GONE` | Claiming or choosing on an offer already claimed or ended |
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
| 400 | `NOT_AN_OFFER` | A claim or choice on a post that isn't an Offer (2.8) |
| 400 | `OWN_OFFER` | The giver asking for their own offer (2.8) |
| 404 | `CLAIM_NOT_FOUND` | Choosing a request that isn't on the offer, or one across a block (2.8) |
| 400 | `AREA_REQUIRED` | A Pulse post from someone with no home and no `areaId` (2.5) |
| 403 | `VISITOR_ASK_ONLY` | A Visitor starting anything but an Ask (2.5) |
| 400 | `SHARE_NEEDS_PLACE` | A Share with no place attached (2.5) |
| 400 | `INVALID_EXPIRES_AT` | A Heads-up end in the past or more than 14 days ahead (2.5) |
| 400 | `TOO_MANY_PHOTOS` | More than 9 photos on a Pulse post (2.5) |
| 400 | `PULSE_FIELD_LOCKED` | An edit that would change a Pulse post's type, point or audience (2.5) |
| 404 | `REPLY_NOT_FOUND` | A reply action (Helpful, Thanks, report) on a reply the person can't read (2.7) |
| 400 | `OWN_REPLY` | Thanking or reporting your own reply (2.7) |
| 404 | `KNOWN_NOT_FOUND` | A Known entry that doesn't exist, is a draft or retired, or is in an area the reader can't open (2.14) |
| 400 | `NOTE_REQUIRED` | A Known correction without a note, or a note over 500 characters (2.14) |
| 404 | `RIGHT_NOW_NOT_FOUND` | A Right now event that doesn't exist or isn't in an area the reader can open (2.16) |
| 409 | `RIGHT_NOW_ENDED` | A report on, or an update to, an event that has ended (2.16) |
| 403 | `NOT_OFFICIAL` | Starting, updating or clearing a Right now event without an Official or curator account (2.16) |
| 400 | `INVALID_RIGHT_NOW` | A Right now kind outside 2.16, or a missing title, text or source (2.16) |
| 400 | `INVALID_SEARCH` | A search shorter than 2 or longer than 80 characters (2.17) |

## 9. Funnel events

Add to `backend/services/funnelEvents.js` (PB) as each behavior ships; clients post them through the existing app-postable route: see the build spec's metrics section for the names.
