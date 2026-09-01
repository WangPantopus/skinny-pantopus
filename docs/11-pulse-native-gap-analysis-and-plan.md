# Pulse (Feed + Post Detail) — Native iOS Gap Analysis & Plan

Scope: **Pulse feed screen** (`Features/Feed/`) and **Pulse post detail screen**
(`Features/Posts/`) in `frontend/apps/ios`. Compose flow is explicitly out of
scope for this pass.

Sources compared:

1. **Designs** — `A03 — Tab: Pulse feed` (`Feed.html` + `feed-frames.jsx` +
   `pulse-archetype.jsx`) and `A10 — Detail: Content / A10.4 Post`
   (`post-frames.jsx`), with `colors_and_type.css` tokens.
2. **Reference feature implementation** — RN app at
   `pantopus/frontend/apps/mobile/` (`FeedScreen.tsx`, `PostCard.tsx`,
   `PostMediaGrid.tsx`, `CommentSection.tsx`, `LivePhotoMedia.tsx`,
   `ImageViewerModal.tsx`, `src/app/post/[id].tsx`).
3. **Current native iOS** — `FeedView` / `PulseFeedViewModel` /
   `PulsePostCard` / `PulseIntent`, `PulsePostDetailView(Model)` /
   `BodyReactionsBody` / `PostThreadComponents` / `PostAuthorHeader`.
4. **Backend** — `backend/routes/posts.js`, `backend/routes/upload.js`,
   `backend/services/feedService.js`.

---

## 1. What already matches

| Area | Status |
|------|--------|
| Feed chip-row filter (All/Ask/Recommend/Event/Lost & Found/Announce) → `postType` query | ✅ matches A03 |
| Feed card recipe (16pt radius card, 32pt avatar + verified disc, name 13/meta 10.5, intent chip, 3-line body clamp, event title + attendee strip + RSVP chip) | ✅ matches A03 |
| Intent chip palette (amber/success/violet/rose/slate) via `Theme.Color` tokens | ✅ |
| Per-intent reaction verb strips on cards (helpful/going/seen/shared) | ✅ shape matches (one verb mismatch, §2.5) |
| Feed loading skeleton, empty state (icon disc + headline + CTA + locality footer chip), error + retry, pull-to-refresh, compose FAB | ✅ |
| Detail shell: back top bar, 44pt author header + verified + intent `StatusChip`, 15/22 body, media grid, reactions bar (heart/hand/eye pills + comment summary), divider, inline composer, comment bubbles with Reply/heart row, 1-level indent, "View N more replies", dashed "Be the first to reply" card with intent-shaped quick-reply chips | ✅ matches A10.4 closely |
| Optimistic like toggle with reconcile + rollback (feed + detail) | ✅ |
| Targeted tests for feed/detail/compose VMs + snapshots | ✅ |

---

## 2. Design gaps (vs A03 / A10.4)

### Feed (A03)

1. **Top-bar actions missing** — design shows `search` + `sliders-horizontal`
   icon buttons right of the "Pulse" title (`feed-frames.jsx` TopBar).
   Current `FeedView.topBar` renders title only.
2. **Card list spacing** — design: card gap 10, list padding 12 top / 12 h /
   100 bottom. Current: gap `s2` (8), padding `s3` (12). Cosmetic.
3. **Chip-row skeleton** — A03 loading frame shimmers the chip row too
   (`ChipRow skeleton` in `pulse-archetype.jsx`); ours renders live chips
   above skeleton cards. Cosmetic.
4. **Empty-state copy** — `Feed.html` frame 2 uses "No posts yet" headline
   (archetype uses "Nothing here yet"). Verify `FeedSurface.emptyContent`
   copy against the A03.1 frame.
5. **Announce reaction verbs** — design announce card: `eye "seen"` +
   `heart`. `PulseIntent.reactionTemplate(.announce)` currently emits
   `lightbulb "helpful"` + heart.

### Post detail (A10.4)

6. **Top bar: share + overflow for everyone** — design shows `share` and
   `more-horizontal` buttons for every viewer. Current shows a single
   overflow only for the owner, containing only "Edit post".
7. **Composer affordances** — design: 32px avatar, `arrow-up` send glyph.
   Current: 28pt avatar, `send` (paper-plane) glyph. Cosmetic.
8. **Media location badge** — A10.4 media grid renders a `map-pin + "5th &
   Elm"` badge overlaid on a media tile. We have no overlay support.
   Optional — only when the post has `location_name`.
9. **Meta line uses post location** — design meta "22m · Elm Park · 5th &
   Elm" is the *post's* place. `PulsePostDetailViewModel` builds it from
   `creator.locality ?? home.city`; should prefer the post's
   `location_name` (needs the field added to `PostDetailDTO`, backend
   already returns it).

---

## 3. Feature gaps (vs RN mobile app)

Backend readiness verified against `backend/routes/posts.js` /
`upload.js` — everything marked ✅ is callable today.

### High priority

| # | Feature | RN reference | iOS today | Backend |
|---|---------|--------------|-----------|---------|
| F1 | **Live Photo display** — yellow LIVE dot on tile; long-press: haptic + crossfade (150ms) to paired video at 1.05 scale, release fades back; "Live" replay in full-screen viewer (play-once) | `LivePhotoMedia.tsx`, `ImageViewerModal.tsx` | Nothing. `PostDetailDTO` decodes `mediaLiveURLs` but UI ignores it; `FeedPostDTO` doesn't even decode `media_live_urls`/use `media_types` | ✅ `media_live_urls` + `media_types('live_photo')` in feed & detail payloads |
| F2 | **Full-screen media viewer** — paged lightbox from any media tile: images, videos (native controls), Live Photos (Live button), index display | `ImageViewerModal.tsx` | None anywhere in the iOS app | n/a (client-only) |
| F3 | **Video tiles** — thumbnail + centered play-circle overlay in grids, playback in viewer | `PostMediaGrid.tsx`, `VideoPlayer` | Grids treat every URL as an image | ✅ `media_types('video')`, `media_thumbnails` |
| F4 | **Comment likes** — heart toggle with optimistic count | `toggleCommentLike` | `CommentRow` heart button action is empty `{}`; counts render only | ✅ `POST /:postId/comments/:commentId/like` (posts.js:2983) |
| F5 | **Reply to a comment** — Reply button arms "Replying to @name" banner; send passes `parentCommentId`; reply-to-reply allowed (RN caps *visual* indent at 4; design shows 1 level — keep our flatten-to-1 rendering, support arbitrary parents) | `CommentSection.tsx` | Reply button is a no-op; composer always sends `parentCommentId: nil` | ✅ `POST /:id/comments {parentCommentId}` |
| F6 | **Feed pagination** — infinite scroll, cursor-based | `useFeedList` (cursorCreatedAt/cursorId) | Single `limit=20` fetch; cursor params exist in `PostsEndpoints.feed` but unused | ✅ `GET /feed` pagination block |
| F7 | **Share post** — system share sheet + count via share endpoint; also the A10.4 top-bar share button | `sharePost` | None | ✅ `POST /:id/share` (posts.js:2829) |
| F8 | **Report post** — overflow → reason picker (`spam/harassment/inappropriate/misinformation/safety/other`) | post detail more-menu | None | ✅ `POST /:id/report` (posts.js:3167) |
| F9 | **Delete own post / delete own comment** — confirm alert | post detail | Overflow has Edit only; no comment delete | ✅ `DELETE /:id`, `DELETE /:postId/comments/:commentId` |

### Medium priority

| # | Feature | RN reference | iOS today | Backend |
|---|---------|--------------|-----------|---------|
| F10 | **Comment media** — display attachment grid on comments; compose with up to 4 images | `CommentSection` attachments | `PostCommentDTO` has no attachments field; no UI | ✅ `POST /upload/comment-media/:commentId` (max 4) |
| F11 | **Emoji picker in composer** — sheet picker inserting into text | `LazyEmojiPicker` | None (system keyboard only — native iOS arguably covers this; decide) | n/a |
| F12 | **Emoji reaction picker** — long-press like → 👍 ❤️ 🔥 😂 💯 🎉 popover; selection still maps to the binary like toggle (no per-emoji backend) | `PostReactionPicker.tsx` | None | ⚠️ backend persists binary like only |
| F13 | **Save/bookmark post** | save toggle | `userHasSaved` decoded, no UI | ✅ `POST /:id/save` |
| F14 | **Repost** | repost via share endpoint | `userHasReposted` decoded, no UI | ✅ `POST /:id/share {shareType:'repost'}` |
| F15 | **Detail pull-to-refresh** | RefreshControl | `refresh()` exists; verify `ContentDetailShell` exposes `.refreshable` | n/a |
| F16 | **Tap comment author name → profile** (avatar already navigates) | yes | avatar only | n/a |

### Lower priority / follow-ups

| # | Feature | Notes |
|---|---------|-------|
| F17 | Matched businesses section under detail (when `service_category` present) | ✅ `GET /:id/matched-businesses`; RN renders at end of scroll |
| F18 | Hide post / mute author / mark not-helpful | ✅ endpoints exist; RN exposes report only today |
| F19 | Mark solved/resolved (`PATCH /:id/solve`) | no RN UI yet; A10.4 narrative only |
| F20 | Likes list (`GET /:id/likes`) | no UI on either platform |

### Known hacks to fix while in here

- `PulseFeedViewModel.project`: `authorVerified: … || post.userHasLiked` —
  "I liked it" is not "author is verified". Drop the `userHasLiked` arm
  (keep business heuristic until backend `creator.verified` lands).
- Feed card maps `commentCount` into the *secondary reaction count*
  (e.g. shows as hearts on an Ask card). Design's card has a `Reply`
  affordance; wire the real comment count there ("Reply · 5" or
  message-circle + count) and stop conflating it with a reaction.
- Detail reactions: `hand`/`eye` pills are hardcoded 0 (no per-kind backend
  counts). Keep display-only zeros for now; revisit when reactions API
  exists.
- 4+ media: feed caps at 4 tiles with "+N" (design-correct); ensure the
  viewer (F2) pages through **all** items, not just 4.

---

## 4. RN features intentionally **not** in the A03/A10.4 designs — decide/defer

These exist in the RN app (visible in the reference screenshot) but the
locked native designs don't include them. Recommendation: **defer all**;
revisit after parity.

- Nearby/Connections surface tabs, location selector row, persona chip
- List/Map toggle + clustered map view (`FeedMapView`)
- Topic lanes (Sports module, sports chips/modes)
- Seeded "Neighborhood Insight / Milestone" fact cards + dismiss
- Radius-suggestion banner, place-eligibility precheck
- Extended post types (Alerts/Deals/Wins/Guide chips + type-specific meta
  cards) — native collapses these onto the 5 design intents for now

---

## 5. Implementation plan (feature/pulse branch)

> **Status (2026-06-12): P1–P4 complete** — implemented and verified
> end-to-end in the iPhone 16 simulator against the local backend (cloud dev
> Supabase). Deferred from P4 (assessed, tracked as follow-ups):
> comment-compose image attachments (upload path exists server-side) and the
> matched-businesses section. Comment `userHasLiked` is not returned by the
> detail route (same gap exists in the RN app) — heart state persists in
> count only across refetch.
>
> **Compose-flow pass (2026-06-12, same session):** the three-step compose
> flow (`Features/Compose/PulseCompose/`) was redesigned and hardened:
> target + purpose pickers rebuilt as card-based screens; Deal drafts now
> collect the backend-required `dealExpiresAt` (previously every Deal post
> 400'd); Lost & Found gained contact-preference chips (DM/Comments/Phone +
> number); Event gained an optional end time and dropped the dead capacity
> field; flow mode drops the duplicate announce-audience chips (the "Who can
> see this" radio governs, and Connections selection now maps to
> `audience=connections`); dark-mode `TextEditor` background fixed
> (`.scrollContentBackground(.hidden)`); place-eligibility precheck banner
> on the draft step (`GET /api/posts/place-eligibility`); fresh device GPS
> captured at submit; the Pulse feed now observes `pulsePostsDidChange` and
> refreshes after posting (previously only My Posts did). Verified e2e in
> the simulator: Deal, Lost & Found (phone contact), Neighborhood Win,
> Event (with end date), Recommend (4★ + photo upload to CloudFront), and
> a Connections-only post, plus dark-mode visual pass.

### Phase P1 — Media foundation (unlocks F1/F2/F3) ✅
1. `FeedDTOs`: add `mediaTypes` use + `mediaLiveURLs` (+ `CodingKeys`);
   introduce a shared `PostMediaItem { url, type(image/video/livePhoto), thumbnailURL, liveVideoURL }`
   built from the parallel arrays.
2. Shared `PostMediaTile` (AsyncImage still + LIVE dot + play overlay) and
   `LivePhotoTileView` (AVPlayer layer, long-press gesture: haptic →
   crossfade in/scale 1.05 → play from 0; press-end reverses; deferred
   player creation; pause/release off-screen).
3. `MediaViewerView` full-screen pager (image zoom optional v1, video via
   `VideoPlayer`/AVPlayerViewController, Live button = play-once).
4. Swap both grids (`PulsePostMediaStrip`, detail `PostMediaGrid`) onto
   `PostMediaItem` + tiles; tiles open the viewer (card body tap still
   navigates to detail from the feed).

### Phase P2 — Detail interactions (F4/F5/F7/F8/F9/F15/F16 + §2.6–2.9) ✅
1. Comment like toggle (optimistic, per-row) — endpoint + VM + wiring.
2. Reply flow: reply banner state in VM, `parentCommentId` on send,
   cancel button; keep flatten-to-1 rendering.
3. Top bar: share button (everyone) → `UIActivityViewController` + share
   endpoint; overflow for everyone → Report (reason dialog); owner adds
   Edit/Delete (confirm alert).
4. Delete own comment (context menu or swipe), meta line → post
   `location_name`, comment author-name tap → profile, `.refreshable`.
5. DTO additions: `locationName` on `PostDetailDTO`, comment `attachments`
   (display-only grid, F10 phase-able).

### Phase P3 — Feed parity (F6 + §2.1–2.5 + hacks) ✅
1. Cursor pagination: `loadMoreIfNeeded` on last-row appear, footer
   spinner.
2. Top-bar search + sliders buttons (search can push a simple filter UI or
   be wired later — at minimum render per design and gate behind a flag).
3. Announce verb fix, verified-flag fix, comment-count → Reply affordance
   (navigates to detail), spacing/copy polish, chip-row skeleton.

### Phase P4 — Decisions/extras (F11–F14, F17+, §2.8 location badge) ✅
Emoji reaction popover (maps to like), save/repost, location badge — done.
Comment-compose attachments and matched businesses deferred (see status
note above).

Each phase: targeted unit tests only (touched VMs), mirrored
`accessibilityIdentifier`s, snapshot updates where geometry changes.
Android parity is required by repo convention — tracked as follow-up per
phase, not blocking iOS.
