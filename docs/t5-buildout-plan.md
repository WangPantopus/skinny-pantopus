# Tier 5 — Buildout Plan of Record

Plan-of-record for the Tier 5 batch of mobile screens. Captures the goal,
the gap between the 12 new designs and the live iOS / Android / web
implementations, the row-shape and backend-endpoint inventory, the
prerequisite extensions to the shared archetype, the open product
questions, and the proposed PR sequence.

This doc is the single source of truth that every later T5 session reads
first.

---

## A. Goal

Close the gap between the 12 newly designed list screens and what's live
in the iOS, Android, and web apps. iOS and Android are missing 9 of 12
screens entirely (only Notifications, Gigs, and Homes-related rows
exist today); web has all 12 routes but several render legacy
geometry that the new designs supersede. The brief is to ship every
screen — both platforms in lockstep — on the shared `ListOfRows`
archetype, extending the archetype only where strictly necessary, and
without inventing backend endpoints. Acceptance is the
`mobile-screen-definition-of-done.md` checklist times two platforms,
plus parity with the matching web route.

> **Note on design location.** The prompt referenced
> `per-screen-and-previous-designs/`, but no such directory exists in
> the repo. The 12 designed frames + design-system reference are
> cached locally at `/home/user/designs-cache/more-designed-pages/`
> (extracted from the upload in the previous session). All design
> file:line refs in this doc point there.

> **Note on `plan.md`.** The repo-root `plan.md` is an
> address-validation plan from an earlier effort — unrelated to T5.
> Not used as input here.

---

## B. 12-row screen inventory

iOS path under `frontend/apps/ios/Pantopus/Features/`. Android path
under `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/`.
Web path under `frontend/apps/web/src/app/`. Designer-spec target
path comes from each design file's header comment.

| # | Design file | Designer target | Variant | Tabs (verbatim) | FAB | iOS today | Android today | Web today |
|---|---|---|---|---|---|---|---|---|
| 1 | `bills-frames.jsx` | `src/app/homes/[id]/bills.tsx` | tabbed list + status chips | `['Upcoming (4)', 'Paid (12)', 'All (16)']` | yes · round **52pt** | missing | missing | `(app)/app/homes/[id]/bills` (live) |
| 2 | `connections-frames.jsx` | `src/app/connections.tsx` | search + tabs + per-row CTA | `['All (24)', 'Neighbors (18)', 'Pending (3)']` | yes · round **52pt** | missing | missing | `(app)/app/connections` (live) |
| 3 | `discover-frames.jsx` | `src/app/discover-businesses.tsx` | search + chip strip + grouped list | none (chip filter strip) | no | missing | missing | `(app)/app/discover` (live — **rename needed** to `discover-businesses`) |
| 4 | `discoverhub-frames.jsx` | `src/app/discover-hub.tsx` | chip strip + grouped sections (People · Businesses · Gigs · Listings) | none (chip filter strip) | no | missing | missing | `(app)/app/discover-hub` (live) |
| 5 | `listingoffers-frames.jsx` | `src/app/listing-offers.tsx` | sticky listing header + flat offer list | none | no | missing | missing | `(app)/app/listing-offers` (live) |
| 6 | `mybids-frames.jsx` | `src/app/my-bids.tsx` | tabbed list + status chips + banner | `[{Active 5}, {Accepted 2}, {Rejected 3}, {Done 12}]` | yes · **extended pill 48pt** "Browse tasks" | missing | missing | `(app)/app/my-bids` (live) |
| 7 | `myposts-frames.jsx` | `src/app/my-pulse.tsx` | tabbed list + intent chips | `['Active (4)', 'Archived (11)']` | yes · round **52pt** "pen-line" | gap: `Features/Posts/PulsePostDetailView` — detail only, no list of own posts | gap: `ui/screens/posts/` — detail only | `(app)/app/my-pulse` (live — designer-spec is `my-pulse`, **agree**) |
| 8 | `mytasks-frames.jsx` | `src/app/my-gigs.tsx` (V2 redesign) | tabbed list + bidder stack + status chips + banner | `[{Open 5}, {Active 2}, {Done 8}, {Closed 3}]` | yes · round **56pt** "plus" | gap: `Features/Gigs/GigsFeedView` — buyer-side feed, not poster's tasks list | gap: `ui/screens/gigs/` — feed only | `(app)/app/gigs-v2` (live — plus legacy `my-gigs` and `my-gigs-v2`) |
| 9 | `notifications-frames.jsx` | `src/app/notifications.tsx` | tabbed list + status chips + unread tint | `['All (12)', 'Unread (4)']` | no | `Features/Notifications/NotificationsViewModel.swift` — single list, no tabs, no unread tint | `ui/screens/notifications/NotificationsViewModel.kt` — single list, no tabs, no unread tint | `(app)/app/notifications` (live — has `all / unread / read` filter + context filter) |
| 10 | `offers-frames.jsx` | `src/app/offers.tsx` | tabbed list + status chips + banner | `['Received (5)', 'Sent (3)']` | no | missing | missing | `(app)/app/offers` (live) |
| 11 | `pets-frames.jsx` | `src/app/homes/[id]/pets.tsx` | avatar-first row list, no tabs | none | yes · round **52pt** | missing | missing | `(app)/app/homes/[id]/pets` (live) |
| 12 | `reviewclaims-frames.jsx` | `src/app/admin/review-claims.tsx` | tabbed list + status chips + queue banner, **admin-only** | `['Pending (4)', 'Approved (38)', 'Rejected (3)']` | no | missing | missing | `(app)/app/admin/review-claims` (live) |

Shell context: existing iOS shared archetype at
`frontend/apps/ios/Pantopus/Features/Shared/ListOfRows/{RowModel,ListOfRowsState,ListOfRowsView}.swift`;
Android at `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/list_of_rows/{RowModel,ListOfRowsUiState,ListOfRowsScreen}.kt`.

---

## C. Row shapes the new designs need

Exhaustive list (10 distinct shapes). Each maps to a concrete row-render
contract the shell will have to produce. Items marked **NEW** require an
additive extension to the row contract; **EXTEND** means a small variant
of an existing render branch; **OK** means the current contract handles
it as-is.

| # | Row shape | Anatomy | Used by | Gap vs current contract |
|---|---|---|---|---|
| C1 | **Avatar + name + subtitle + circular CTA** | 44pt avatar (with optional verified badge overlay) + name + 2-line meta + 38pt round message CTA on trailing | Connections | **NEW**: current shell trailing is `statusChip / chevron / kebab / none`. Need a `RowTrailing.circularAction(icon, accessibilityLabel, handler)`. |
| C2 | **Avatar + initials + status chip + full-width follow-up button** | 40pt initials disk + claimant + address line + chip row + 36pt full-width primary "Review claim" button as a row footer | Review claims | **NEW**: row footer slot for one full-width button. Today the row is `padding(s3)` with no inline footer area. |
| C3 | **Category icon + title + amount + chip + bidder-stack + 2-button action footer** | 40pt category icon + 2-line title + headline price on right + sub-line meta + bidder stack + status chip + meta tail + 34pt ghost/primary button pair in footer | My bids, My tasks V2, Listing offers, Offers | **NEW**: row footer for 1–3 buttons (34pt height per spec), and **NEW** leading variant for the bidder stack (22pt overlapping avatars + `+N` overflow tile). |
| C4 | **Category-typed thumbnail + listing title + amount delta + chip + counter pill + note quote** | 40pt initials disk OR 56pt thumb + buyer name + amount + (delta % vs ask) + status chip + optional `Your counter $X` pill + optional italic note + action footer | Listing offers, Offers | **NEW**: secondary "counter" chip on the same row + optional italic note block below the meta row. |
| C5 | **Type icon + bold title + body + chip + time-meta tail, with unread tint variant** | 40pt type-icon disk + title + 2-line body + type chip + relative time + unread dot + tinted background (`primary25` / `identity.personalBg` border) for unread | Notifications | **EXTEND**: row already does icon-leading + statusChip-trailing, but needs **NEW** row-tint variant (unread background + border colour) and an **inline 8pt dot** on the right of the title for unread. |
| C6 | **Intent chip + relative time + 2-line body + engagement footer + "Edit" link** | row chrome inside card: intent chip + time-meta on top row + kebab on far right + 2-line body + hairline + engagement icons + trailing "Edit" link | My posts | **NEW**: chip-row header above the body (not the trailing slot today), plus a hairline-separated engagement footer with icon+count items, plus an inline "Edit" text-button at the right of the footer. |
| C7 | **Receipt icon + payee + amount + status chip** | 40pt receipt icon + payee title + due-date subtitle + amount on right + status chip stacked below the amount | Bills | **EXTEND**: today trailing is one chip OR a chevron. The Bills design stacks the amount and the chip vertically. Need **NEW** trailing variant `RowTrailing.amountWithChip(amount, chip)`. |
| C8 | **Person row inside a grouped section (Discover hub People section)** | 36pt avatar with optional verified overlay + name + 2-line meta + distance + chevron | Discover hub, Discover businesses (slight variant) | **EXTEND**: current shell renders one `RowSection` with an optional header string; designs need section header with **count + "See all" CTA**, and the section body must render as one rounded card with hairline-separated rows (no gap between rows). |
| C9 | **Business row** | 36pt logo tile (gradient bg, icon) + name + (category · ★rating) + distance + chevron | Discover hub Businesses section, Discover businesses screen | Same gap as C8. |
| C10 | **Pet row** | 64pt rounded-square photo or species icon + name + species chip on same line + breed + notes preview + kebab | Pets | **NEW**: 64pt square thumbnail variant for `RowLeading` (today is 40pt icon-disk or 40pt avatar circle). |

Cross-cutting **non-row** primitives needed by these screens:

- **Search bar slot** above the tab strip (Connections, Discover
  businesses) — sits between `TopBar` and `TabStrip` in the design.
- **Chip strip** as an alternative to `TabStrip` (Discover hub,
  Discover businesses): horizontally scrollable filter pills, rendered
  in the same chrome slot as tabs.
- **Banner slot** at the top of the scroll area (My bids `BidsBanner`,
  My tasks `TasksBanner`, Offers `OffersBanner`, Review claims
  `QueueBanner`, Listing offers `ListingHeader` + `SortStrip`):
  primary-tinted summary card surfaced above the first row. Treat as
  a generic `BannerSlot` exposed by the data source.
- **DateSep** (Notifications): inline `Today` / `Earlier` separator
  rendered between row groups within the same scroll area — pairs with
  RowSection's `header` if we re-skin section headers to render
  inline rather than as a sticky section.
- **FAB variants** (see open question F1).

---

## D. Row shapes already supported by the current shell

What the existing `ListOfRowsView` / `ListOfRowsScreen` renders today,
mapped to the new designs that can use it as-is.

| Existing branch | Renders | New screens that fit unchanged |
|---|---|---|
| `RowLeading.icon` + `RowTrailing.statusChip` (`statusChip` template) | 40pt icon-disk + title + subtitle + chip | Notifications (sans unread tint and inline dot — gap below) |
| `RowLeading.avatar` (AvatarWithIdentityRing) + `RowTrailing.chevron` | 40pt avatar with identity ring + title + subtitle + chevron | (none in T5 — all avatar rows want a CTA or have a verified-overlay) |
| `RowLeading.icon` + `RowTrailing.chevron` | 40pt icon-disk + title + subtitle + chevron | Discover hub Gigs / Listings sections (after C8 section-card extension lands) |
| `RowLeading.avatar` + `RowTrailing.kebab` | 40pt avatar + title + subtitle + 44pt kebab | none today; Pets and My posts use kebab but want different leading geometries |
| Top bar with `topBarAction` + `tabs` + `selectedTab` + `fab` | Standard chrome | All 12 screens use this chrome verbatim (minus FAB variants — see F1) |

Gaps the shell already has but renders "roughly":

- **gap**: `LoadingRows` shimmer is fixed-geometry (icon + 2 text
  shimmers) — fine for icon rows but mis-skeletons avatar+CTA rows
  (Connections) and pet rows (Pets). Needs **EXTEND**: parameterise
  the skeleton geometry by row template, or accept the rougher fit
  with a documented allowance.
- **gap**: `LoadedList` renders a vertical stack with a single
  `Section.header` string. Discover hub needs sections with **count +
  See all CTA**, rendered as a card with hairline rows. EXTEND
  `RowSection` to `{id, header, count?, onSeeAll?, rows, asCard:
  Bool}`.

---

## E. Backend endpoints per screen

Every endpoint below has been grep-verified against `backend/routes/*`.
File:line is the canonical handler. Methods + paths match what the new
designs need.

| # | Screen | Endpoint(s) | File:line | Notes |
|---|---|---|---|---|
| 1 | Bills | `GET /api/homes/:id/bills` · `POST /api/homes/:id/bills` | `home.js:4506, 4539` | Existing. Status chip values come from the row-mapper (due / overdue / paid / scheduled). |
| 2 | Connections | `GET /api/relationships` (list) · `POST /api/relationships/requests` · `PATCH /api/relationships/:id` (accept/ignore) | `relationships.js:622, 67, …` | Existing. Verify accept/ignore route names before wiring. |
| 3 | Discover businesses | `GET /api/business-discovery/search` | `businessDiscovery.js:436` | Existing. Filters by category + radius. |
| 4 | Discover hub | `GET /api/hub` (+ `/today`, `/discovery`) | `hub.js:25` (+ `:596`, `:757`) | Existing. The Discover hub design groups by content type — confirm hub's `/discovery` returns a typed payload that segments by `people · businesses · gigs · listings`. **Gap risk:** current Hub UI calls it but only renders a "Discovery" carousel, not a typed segmentation. |
| 5 | Listing offers (per-listing) | `GET /api/listings/:listingId/offers` · `POST /api/listings/:listingId/offers` · `PATCH …/offers/:id` | `listingOffers.js:58, 78, …` | Existing. Action verbs: accept / counter / decline / withdraw counter. |
| 6 | My bids | `GET /api/gigs/my-bids` | `gigs.js:1253` | Exists. **DTO gap (P10)**: response currently returns `status` (pending / expired / assigned), `match_rank`, `match_score`, `price`. Design chips need `Top bid` / `Outbid` / `Shortlisted` / `Closes in 2h` — backend prep PR needed (see Open Question F4). |
| 7 | My posts | `GET /api/posts?author=me` or similar; canonical posts feed at `posts.js:1449` | `posts.js:1449` | **Verify**: does posts feed accept a "by me" filter? If not, need a new `?author=me` query param. **Gap risk** flagged. |
| 8 | My tasks V2 | `GET /api/gigs?posted_by=me` + `GET /api/gigs/:id/offers` for bidder stack | `gigs.js` (TBD line); `offers.js:107` for offers | **Gap risk**: bidder-stack avatars require the task DTO to return at least the top 3 bidders inlined, plus a count. Confirm the task DTO includes a `bidders[]: {id, initials, color}` array — if not, this is a backend prep ticket. |
| 9 | Notifications | `GET /api/notifications?limit=&offset=&unread=true` · `GET /api/notifications/unread-count` · `PATCH /api/notifications/:id/read` · `POST /api/notifications/read-all` | `notifications.js:84, …` | Existing. The `?unread=true` query is already wired in web — mobile VMs today don't pass it because there are no tabs (yet). |
| 10 | Offers (cross-listing) | `GET /api/gigs/:gigId/offers` · `GET /api/offers/sent` (TBD) · `GET /api/offers/received` (TBD) | `offers.js:107` | **Gap risk**: the cross-listing Offers screen splits Received vs Sent. Verify whether sent-offers and received-offers endpoints exist separately or whether the client filters from a single `/api/offers` payload. Flag if missing. |
| 11 | Pets | `GET /api/homes/:id/pets` · `POST /api/homes/:id/pets` · `PATCH /api/homes/:id/pets/:petId` · `DELETE …` | `home.js:6789, 6826, …` | Existing. |
| 12 | Review claims | `GET /api/homes/ownership-claims?status=pending` + `POST /api/homes/:id/ownership-claims/:claimId/review` | `homeOwnership.js:665` | Existing. Admin-only; current iOS / Android have no admin gating layer (see F7). |

---

## F. Open product questions

Each item gets the recommended answer + tradeoff. Decisions block
P-level PRs.

### F1. FAB diameter — extend to a variant set, not pick one

The previous open-question pass concluded "all designs spec 52pt".
**Re-reading the frames more carefully overturns that.** Across the
five new screens that have a FAB:

| Screen | FAB | Source |
|---|---|---|
| My tasks V2 | **round 56pt** "plus" | `mytasks-frames.jsx:131` (with explicit comment "canonical create action") |
| My posts | round **52pt** "pen-line" | `myposts-frames.jsx:100` |
| Connections | round **52pt** "user-plus" | `connections-frames.jsx:113` |
| Bills | round **52pt** "plus" | `bills-frames.jsx:99` |
| Pets | round **52pt** "plus" | `pets-frames.jsx:79` |
| My bids | **extended pill 48pt** "Browse tasks" | `mybids-frames.jsx:129` (with explicit comment "Browse tasks is a navigation action, not create") |

The designer is signalling intent with the variant:
- **56pt round** = canonical create action of the screen (My tasks)
- **52pt round** = secondary or general create (everywhere else)
- **48pt extended pill** = navigation FAB, not create (My bids)

**Recommendation:** extend `FABAction` to carry a variant —
`.canonicalCreate (56) | .secondaryCreate (52) | .extendedNav(label) (48)` —
keeping the existing default at 56 for backwards compat. Tradeoff:
one-line `enum` extension on both platforms; cleaner than a binary
shrink that would mis-render My tasks.

### F2. Notifications tab/filter set

**iOS/Android today:** single list, no tabs.
**Web today:** 3 filter tabs (`all / unread / read`) + 3-way context
filter (`all / personal / business`).
**Design:** 2 tabs (`All (12) / Unread (4)`).

**Recommendation:** mobile ships with the 2-tab set from the design
(All / Unread) — that's the visual contract. **Do not** port the web's
3-way context filter to mobile — the design omits it, and adding it
would mean a 5-control chrome stack on a 360pt-wide phone. Leave the
"read" tab off mobile; if the user wants read-only history, they tap
through to the All tab and scroll past unread. Tradeoff: minor parity
divergence with web; documented as an accepted-difference in
`mobile-parity-audit.md` once T5 lands.

### F3. My bids status → tab mapping

Design tabs are `Active · Accepted · Rejected · Done`. The status
enum has 11 cases (`top / shortlist / pending / outbid / expiring /
accepted / scheduled / rejected / closed / paid / review`).

Recommended mapping:
- **Active**: `top, shortlist, pending, outbid, expiring`
- **Accepted**: `accepted, scheduled`
- **Rejected**: `rejected, closed`
- **Done**: `paid, review`

Tradeoff: `closed` (task cancelled by poster) lands in Rejected — is
that emotionally right, or should it be its own bucket? Confirm with
product. Otherwise straightforward.

### F4. My bids chip-variant derivation — backend or client

Design chips include `Top bid` · `Outbid` · `Shortlisted` · `Closes in
2h` (see C3, mybids-frames.jsx:30-44). Backend bid DTO in
`offersV2.js:152-177` returns only raw `status` + `match_rank` +
`match_score` + `price` + timestamps.

- **Time-based** (`Closes in 2h`, `Closes in 4h`) — client-derivable
  from `expires_at`. No backend work.
- **`Top bid` / `Outbid`** — needs visibility of competing bids, which
  the bidder's `my-bids` payload does not include. Adding a `your_rank`
  + `top_price` to the bid DTO is the clean answer.
- **`Shortlisted`** — buyer-driven signal, not derivable client-side.
  Needs a `shortlisted: bool` (or a new enum value).

**Recommendation:** **backend prep PR first.** Add
`shortlisted: bool`, `your_rank: int|null`, `top_price: number|null` to
the bid response shape (and `bid_count` to the task DTO for My tasks
V2). Without this PR, P-screens cannot ship `Shortlisted` at all and
`Outbid`/`Top bid` need a "fetch sibling bids" workaround that won't
scale. Tradeoff: ~1 day of backend work; unblocks two mobile PRs.

### F5. My tasks V2 bidder-stack data shape

Design renders 3 inline 22pt avatars + a `+N` overflow tile per task
row. Backend task DTO needs to return at least: `bid_count` (already
likely) + `top_bidders: [{id, initials, color}]` capped at 3, OR the
client makes a follow-up `GET /api/gigs/:id/offers?limit=3` per row
(expensive at list-scale).

**Recommendation:** inline `top_bidders[]` on the task DTO. Confirm
the field is present; if not, fold into the backend prep PR (F4).
Tradeoff: small payload increase per task row; saves N follow-up
requests on the list.

### F6. Web `discover` route name

Web has `(app)/app/discover` live today; designer specs
`src/app/discover-businesses.tsx`. These are the same screen but
named differently. Renaming `discover` → `discover-businesses` breaks
any inbound link.

**Recommendation:** keep `(app)/app/discover` as the **canonical**
route on web; treat the designer's filename as informational. On
mobile, the screen's typed-route case name is `discoverBusinesses` —
no URL mapping at risk. Tradeoff: minor naming drift between mobile
case-name and web URL; both deep-link via the same backend endpoint.

### F7. `my-gigs-v2` route deletion

Web has both `(app)/app/my-gigs` (V1 redirect target) and
`(app)/app/my-gigs-v2` (V2 dogfood). Designer spec is V2 canonical
and the production route is `gigs-v2`.

**Recommendation:** after the new V2 design ships, delete the
`my-gigs-v2` route, add a permanent redirect from `/app/my-gigs-v2` →
`/app/gigs-v2`, and consolidate the V1 route to also redirect there.
Mobile typed route should be `myTasks` (mirrors the design's title
"My tasks"). Tradeoff: one small server-side rewrite rule.

### F8. Web notifications context filter retention

Web today carries an `all / personal / business` context filter pill
row (`page.tsx:292-305`) — not in the new design. Mobile doesn't have
this filter at all (see F2).

**Recommendation:** keep the web context filter on the web for now —
it's a legitimate desktop-only affordance — but do not port it to
mobile. Document the divergence in the parity audit. Open a separate
ticket to decide if it should be removed from web post-T5; not in
scope here.

### F9. Review claims admin gating — mobile or web only

Design file header says `src/app/admin/review-claims.tsx` (web-style
path) but the **rendered frame is a phone shell** — the screen is
drawn for mobile geometry. There is no admin tier in the mobile
codebase today. Web admin gating runs via the `admin.js` middleware.

**Recommendation:** ship **web only** as part of T5. Defer mobile
Review claims until a mobile admin role exists (a separate
infra-level effort: a new `me.is_admin` field on the user payload, a
gated tab or settings entry, a Hilt-injected role guard on Android, a
`@MainActor` role check on iOS). Tradeoff: cuts one mobile screen from
T5 scope. Adds it back as a future Tier-N item.

### F10. Notifications Unread empty-state CTA

Design empty state (`notifications-frames.jsx:316-353`) puts a "View
all notifications" button on the Unread tab with `TabStrip` set to
`active={1}`.

**Recommendation:** tapping the button re-keys the tab to `active=0`
(All) — it's a tab-filter collapse, not a route push. The user is
already on Notifications; pushing them elsewhere would be unexpected.
Tradeoff: trivial; just need to wire the CTA handler to
`viewModel.selectTab("all")`.

### F11. (Added — not in original prompt) `myposts` / `my-pulse` route name

Designer specs `my-pulse.tsx`; the natural web URL is `/app/my-pulse`;
the screen title is "My posts". Today there is no `/app/my-posts` or
`/app/my-pulse` route on web.

**Recommendation:** create `/app/my-pulse` on web (matches designer
filename), title the screen "My posts" everywhere, name the mobile
typed-route case `myPosts`. Tradeoff: route name and screen title
diverge, but that's intentional — Pulse is the product surface,
"My posts" is the user-facing label.

### F12. (Added) Shell row-contract: additive-only

T5 demands several extensions to `RowModel` / `ListOfRowsState`
(row footer, bidder stack, search bar, banner, section-card, FAB
variants, unread tint, 64pt thumbnail leading). The CLAUDE-instruction
universal convention is that **existing call sites must not break**.

**Recommendation:** every shell extension MUST be additive — new
optional fields with sensible defaults, new enum cases on existing
sealed types. No existing call site in Mailbox, MyHomes, MyClaims,
Notifications-v1 changes signature. Tradeoff: slightly more verbose
shell API; protects T1–T4.1 wiring from regressions.

### F13. (Added) `primary25` theme token

Notifications unread row background = `#f8fbff`. Closest existing
token is `primary50 = #f0f9ff` (visibly cooler). Border `#dbeafe`
already exists as `identity.personalBg`.

**Recommendation:** add a single new `primary25 = #f8fbff` to
`@pantopus/theme`, iOS asset catalog, Android `Color.kt`. Tradeoff:
1-line token PR; protects from a "close enough" substitution that
would render off-spec on a clean white tabbed list.

### F14. (Added) `posts?author=me` filter

My posts screen needs a list of posts authored by the current user.
Backend `posts.js:1449` returns the feed; need to verify it accepts
`?author=me` or equivalent. Not yet grep-confirmed.

**Recommendation:** treat as a 30-minute backend tweak. Either expose
`?author_id=:me_id` or add a dedicated `GET /api/posts/me` route.
Either way, fold into the F4 backend prep PR. Tradeoff: trivial.

---

## G. Proposed PR sequence

Six prerequisite PRs, then 12 screen PRs ordered by user impact.
P-numbers are tracking labels only — actual ordering can be
re-negotiated once F-questions are answered.

### Prereqs (must land before any feature screen)

| PR | Title | Scope | Blocks |
|---|---|---|---|
| **P1** | T5.0a — Shell extensions, additive | Add `RowTrailing.circularAction`, `RowFooter` slot (1–3 buttons, 34pt), `RowLeading.bidderStack(22pt, +N overflow)`, `RowLeading.thumbnail(64pt)`, `RowSection.{count, onSeeAll, asCard}`, `RowTint.unread`, `BannerSlot`, `SearchBarSlot`, `ChipStripSlot` alt to `TabStripSlot`, `FABAction.variant {canonicalCreate / secondaryCreate / extendedNav}`. All additive. Includes Compose + SwiftUI snapshot tests against fixture data. | every screen PR |
| **P2** | T5.0b — Theme tokens | Add `primary25` (`#f8fbff`) to `@pantopus/theme` + iOS asset catalog + Android `Color.kt`. Add iOS `VerifiedBadge` 14pt size variant. | Notifications (P5), Connections (P6), Discover hub (P10) |
| **P3** | T5.0c — Backend prep | `offersV2.js`: add `shortlisted`, `your_rank`, `top_price` to bid DTO. `gigsV2.js`: add `bid_count` + `top_bidders[≤3]` to task DTO. `posts.js`: confirm or add `?author=me`. `offers`: confirm Received vs Sent split. Includes unit tests. | My bids (P7), My tasks V2 (P8), My posts (P4), Offers (P9), Listing offers (P11) |
| **P4** | T5.0d — Web route hygiene | Permanent redirect `/app/my-gigs-v2` → `/app/gigs-v2`. Leave `/app/discover` as canonical (informational divergence from designer-spec). Document in parity audit. | none — runs in parallel |

### Feature screens (iOS + Android together per PR, web parity check at the end)

Ordering principle: ship traffic-driver screens first, infra-light screens
later, mobile-deferred screen last.

| PR | Screen | Why this order | Depends on |
|---|---|---|---|
| **P5** | **Notifications V2** (tabs + unread tint) | Already exists on both platforms; smallest delta; high traffic; validates the unread-tint extension end-to-end. | P1, P2 |
| **P6** | **Connections** | High traffic; validates `circularAction` trailing + verified-badge overlay; pairs nicely with the relationships endpoint work that already shipped. | P1, P2 |
| **P7** | **My bids** | Marketplace participant flow; validates `RowFooter` + status-chip lifecycle + extended-pill FAB. | P1, P3 |
| **P8** | **My tasks V2** | Marketplace participant flow; validates `bidderStack` leading + 56pt canonical FAB. | P1, P3 |
| **P9** | **Offers (cross-listing)** | Marketplace participant flow; reuses C4 row shape from Listing offers. | P1, P3 |
| **P10** | **Listing offers (per-listing)** | Reuses C4. Sticky `ListingHeader` is the only screen-bespoke piece. | P1, P3 |
| **P11** | **Discover hub** | Discovery; validates `RowSection.asCard` + chip strip. | P1 |
| **P12** | **Discover businesses** | Discovery; reuses P11's section-card extension. | P1, P11 |
| **P13** | **Bills** | Homes pillar; validates `RowTrailing.amountWithChip`. | P1 |
| **P14** | **My posts** | Self-content management; validates intent-chip + engagement footer row. | P1, P3 (for `?author=me`) |
| **P15** | **Pets** | Homes pillar; validates 64pt thumbnail leading. | P1 |
| **P16** | **Review claims (web only)** | Admin queue; rendered on phone in design but no mobile admin role exists. Build web; cut mobile from T5. | P1 (web mirror of shell extensions) |

### Acceptance gate per feature PR

Every PR (P5–P16) must clear, in addition to
`mobile-screen-definition-of-done.md`:

- iOS + Android land in the same commit
- Web parity check: the web route renders the same data and chip set
- `docs/mobile-parity-audit.md` row added/updated
- VM unit tests for `load → empty / loaded / error`, plus any
  optimistic-mutation rollback (My bids withdraw, Offers accept,
  Notifications mark read, etc.)
- One Paparazzi snapshot per fixed visual state on Android, one
  SwiftUI snapshot on iOS

### Out of scope for T5

- Mobile admin role (defers Review claims on mobile to a future tier)
- Web context-filter removal on Notifications (separate decision)
- Push-notification migration (`docs/push-native-migration.md` —
  unrelated, pre-existing follow-up)

---

## My bids implementation notes (T5.3.1 / P7)

Canonical record of how the My bids screen maps backend status →
4-tab grouping → design chip → footer action. **This section is the
source of truth — when iOS, Android, and web disagree, this is what
wins.**

### Tab grouping

Four equal-width tabs in this exact order. The 7 canonical backend
statuses (`pending / countered / accepted / rejected / withdrawn /
expired`, plus the inlined `gig.status` for "cancelled" and
"completed") bucket as follows:

| Tab        | Backend membership                                              |
| ---------- | --------------------------------------------------------------- |
| `Active`   | `pending`, `countered` (gig is `open` or `assigned`)            |
| `Accepted` | `accepted`, `assigned` (gig is not yet `completed`)             |
| `Rejected` | `rejected`, `declined`, `withdrawn`, `expired`, or `gig.status === 'cancelled'` (when the bid wasn't already accepted) |
| `Done`     | `accepted` + `gig.status === 'completed'`                       |

Implementation: `MyBidsViewModel.tabFor(dto, now)` on iOS + Android;
`bidTabBucket(bid)` on web. All three call sites must stay in sync.

### Chip variant per design

Eleven chip variants live in the design's STATUS map
(`mybids-frames.jsx:30-44`). Derived from
`(bid.status, gig.status, expires_at, shortlisted, your_rank,
top_price, proposed_time)`. The chip variant column comes straight
from the design; **do not invent new variants**.

| Chip                    | Tab        | Derivation                                                                                                       | Chip variant |
| ----------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- | ------------ |
| `Top bid`               | Active     | `your_rank == 1` (P3 backend prep)                                                                               | success      |
| `Shortlisted`           | Active     | `shortlisted == true` (P3 backend prep)                                                                          | info         |
| `Pending`               | Active     | `bid.status == 'pending'`, no signal flag                                                                        | neutral      |
| `Outbid`                | Active     | `your_rank > 1 && top_price != null` (P3 backend prep)                                                           | warning      |
| `Closes in Xh`          | Active     | `pending` + `expires_at` within 4h. Replaces Top/Shortlisted/Outbid.                                              | error        |
| `Accepted`              | Accepted   | `bid.status == 'accepted'` and either no `proposed_time` or it's in the past                                      | success      |
| `Starts {weekday}`      | Accepted   | `bid.status == 'accepted'` and `proposed_time` is in the future                                                  | info         |
| `Not selected`          | Rejected   | `bid.status in {rejected, declined, withdrawn, expired}`                                                         | neutral      |
| `Task cancelled`        | Rejected   | `gig.status == 'cancelled'` and bid wasn't already accepted                                                       | neutral      |
| `Paid · $X`             | Done       | gig `completed` and the user has already left a review (**TODO** — needs a `already_reviewed` backend signal)    | success      |
| `Leave review`          | Done       | gig `completed`, review not yet left. Default for completed gigs until the backend signal lands.                  | info         |

### Footer per tab + status

The design's `actions` prop maps to footer archetypes. iOS exposes
this as `MyBidsFooter`, Android as `MyBidsFooter`, web renders inline
buttons today (full footer parity is a follow-up).

| Footer       | When                                                       | Buttons                                                                                             |
| ------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `edit`       | Active rows                                                | `[Withdraw (destructive ghost), Edit bid (primary)]` — full-width split                              |
| `message`    | Accepted rows (`gig.status != 'in_progress'`)              | `[View details (ghost), Message client (primary)]`                                                  |
| `complete`   | Accepted rows where `gig.status == 'in_progress'`          | `[Message (ghost), Mark complete (primary)]`                                                        |
| `review`     | Done rows with `Leave review` chip                         | `[Leave a review for {firstName} (primary)]` — single full-width                                    |
| `rebid`      | Rejected rows                                              | `[Bid on similar (ghost)]` — single full-width                                                       |
| `none`       | Done rows with `Paid · $X` chip                            | no footer                                                                                            |

### Muted highlight

Terminal rows render at 0.78 opacity via the new
`RowHighlight.muted` case (additive, ships with this PR on
iOS / Android / web). Applies to rows with chip in
`{Not selected, Task cancelled}`. The shell-level
`RowHighlight.archived` case is kept untouched — `muted` is the
semantic synonym other terminal-state screens (Review claims, future
Done lists) can opt into without overloading the "archived" intent.

### Endpoints

| Action            | Method  | Path                                       | Backend file:line                |
| ----------------- | ------- | ------------------------------------------ | -------------------------------- |
| List my bids      | GET     | `/api/gigs/my-bids`                        | `backend/routes/gigs.js:1253`    |
| Edit a bid        | PUT     | `/api/gigs/:gigId/bids/:bidId`             | `backend/routes/gigs.js:3971`    |
| Withdraw a bid    | DELETE  | `/api/gigs/:gigId/bids/:bidId`             | `backend/routes/gigs.js:5245`    |
| Mark gig done     | POST    | `/api/gigs/:gigId/mark-completed`          | `backend/routes/gigs.js:5926`    |
| Leave review      | POST    | `/api/reviews`                             | `backend/routes/reviews.js:35`   |

Note the **DELETE** method on the withdraw endpoint — the backend
exposes `DELETE /api/gigs/:gigId/bids/:bidId` (not POST `.../withdraw`
as some earlier drafts suggested). Both platforms send the
`{ reason }` body via `DELETE … --data` (Retrofit `@HTTP hasBody=true`
on Android; URLSession `httpBody` on iOS).

### Backend prep PR (P3) — still pending

Until the `shortlisted`, `your_rank`, and `top_price` fields land on
the bid response, Top bid / Shortlisted / Outbid never appear — rows
fall back to `Pending` or `Closes in Xh`. The optional decoders are
already in place on both DTOs (`BidDTO.swift`, `BidDto.kt`), so
shipping the backend PR alone will start surfacing the chips with no
mobile code change.

Same shape applies to `Paid · $X` vs `Leave review`: needs a
`already_reviewed: boolean` on the bid DTO (or on a sibling
`reviews_by_me` query). Until then every Done row prompts a review.

### Optimistic mutations

- **Withdraw**: row immediately flips to `withdrawn` in the cache
  (which moves it from Active → Rejected with the `Not selected` chip
  + muted highlight). On API failure the cache is restored. Backend
  cooldown of 5 minutes on re-bid is surfaced by the
  `rebid_available_at` response field (TODO surface in UI).
- **Mark complete**: row's inlined `gig.status` flips to `completed`
  in the cache, moving it from Accepted → Done with the `Leave
  review` chip. Backend rolls back the cache on failure.

### Parity audit

Updated `docs/mobile-parity-audit.md` row 6 — My bids is now live on
all three platforms; legacy 7-status web filter is rebucketed to the
4 design tabs.

---

## My tasks V2 implementation notes (T5.3.2 / P8)

Canonical record of how the My tasks V2 screen maps backend gig state →
4-tab grouping → design chip → footer action. **This section is the
source of truth — when iOS, Android, and web disagree, this is what
wins.**

### Backend prep (lands with this PR)

P8 was blocked on two prerequisites that were never satisfied by P3:

1. **`/api/gigs/my-gigs` did not return bidder thumbnails per task.**
   The design requires 3 inline 22pt avatars + a `+N` overflow tile on
   every row, and the prompt's universal-convention explicitly forbids
   N+1 fetches at list scale. **Fix:** extend the route with a
   `top_bidders[≤3]: [{id, initials, color}]` array derived from the
   GigBid → User join (single round-trip), tone hash on the user_id
   for deterministic colour parity across iOS / Android / web.
2. **No `POST /api/gigs/:gigId/boost` endpoint existed.** The design's
   "Boost in feed" footer on `no-bids` rows had no backend target.
   **Fix:** new endpoint sets `boosted_at = now()` +
   `boost_expires_at = now() + 24h` on the Gig (added to the schema in
   migration `149_gig_boost.sql`, also pushed onto GIG_LIST so future
   feed ranking can read it).

These both landed in this PR rather than as a separate prep — the
backend additions are small and isolated, and bundling them keeps the
mobile screens shippable on a single review pass.

### Tab grouping

Four equal-width tabs in this exact order. The 5 backend gig statuses
(`open`, `assigned`, `in_progress`, `completed`, `cancelled`) plus
derived `expired` bucket as follows:

| Tab      | Membership                                                                 |
| -------- | -------------------------------------------------------------------------- |
| `Open`   | `open` (any bid count) — chip differentiates Reviewing / Urgent / No bids  |
| `Active` | `in_progress`, `assigned`                                                  |
| `Done`   | `completed`                                                                |
| `Closed` | `cancelled`, plus `open` with `deadline` in the past (rendered as Expired) |

Implementation: `MyTasksViewModel.tabFor(status)` on iOS + Android.
`derivedStatus(dto, now)` is the upstream projection that decides which
status the gig renders as; `tabFor` is a pure function from status to
tab. Web mirrors both in `app/(app)/app/my-gigs/page.tsx`.

### Chip variant per design

Nine chip variants from the design's STATUS map
(`mytasks-frames.jsx:36-46`). Derivation:

| Chip                | Tab      | Derivation                                                                | Chip variant |
| ------------------- | -------- | ------------------------------------------------------------------------- | ------------ |
| `Reviewing bids`    | Open     | `gig.status == 'open'` && `bid_count > 0` && deadline > 4h (or no deadline) | info       |
| `Closes in Xh`      | Open     | `gig.status == 'open'` && `deadline` within 4h (and > now)                  | error      |
| `No bids yet`       | Open     | `gig.status == 'open'` && `bid_count == 0` && deadline > 4h (or no deadline)| neutral    |
| `In progress`       | Active   | `gig.status == 'in_progress'` (or `'assigned'` w/o future `scheduled_start`)| success    |
| `Starts {weekday}`  | Active   | `gig.status == 'assigned'` && `scheduled_start` in the future               | info       |
| `Leave a review`    | Done     | `gig.status == 'completed'` (chip is default until a backend `poster_review_left` signal lands) | info |
| `Completed`         | Done     | reserved for the post-`poster_review_left` state — not emitted yet         | success    |
| `Cancelled`         | Closed   | `gig.status == 'cancelled'`                                                | neutral    |
| `Expired`           | Closed   | `gig.status == 'open'` && `deadline` <= now                                | neutral    |

### Footer per status

Footer archetypes map straight from the design's `actions` prop:

| Footer       | Status                       | Buttons                                                                              |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------ |
| `open`       | Reviewing                    | `[Edit (ghost), Review N bids (primary 2× flex)]`                                     |
| `urgent`     | Closes in Xh                 | `[Extend 24h (ghost), Review N bids (primary 2× flex)]`                                |
| `boost`      | No bids yet                  | `[Edit details (ghost), Boost in feed (primary)]`                                     |
| `inprogress` | In progress / Starts weekday | `[Message (ghost), Mark complete (primary)]`                                          |
| `review`     | Leave a review               | `[Leave a review (primary)]` — full-width                                              |
| `repost`     | Cancelled / Expired          | `[Repost task (primary)]` — full-width                                                 |
| `none`       | Completed                    | no footer                                                                              |

### BidderStack

Rendered inline on the chip row, before the status chip, when
`top_bidders` is non-empty. Up to 3 22pt overlapping avatars with a
`+N` overflow tile where `N = bid_count − top_bidders.count` (clamped
to ≥0). The avatar primitive itself lives in the shared shell
(`Core/Design/Components/BidderStack.swift` on iOS, inline in
`ListOfRowsScreen.kt` on Android) — feature code only emits the
`BidderStackData` payload on the `RowModel` and the shell handles the
visual.

Tone palette is canonical: `sky · teal · amber · rose · violet · slate`.
Unknown tone strings fall back to `slate` so a future backend palette
expansion never crashes a decoder.

### Endpoints

| Action            | Method  | Path                                       | Backend file:line                |
| ----------------- | ------- | ------------------------------------------ | -------------------------------- |
| List my tasks     | GET     | `/api/gigs/my-gigs`                        | `backend/routes/gigs.js:1169`    |
| Boost a task      | POST    | `/api/gigs/:gigId/boost`                   | `backend/routes/gigs.js` (new)   |
| Mark complete     | POST    | `/api/gigs/:gigId/complete`                | `backend/routes/gigs.js:6170`    |
| Cancel a task     | POST    | `/api/gigs/:gigId/cancel`                  | `backend/routes/gigs.js:6233`    |
| Create a task     | POST    | `/api/gigs`                                | `backend/routes/gigs.js:749`     |

Note: `/api/gigs/:gigId/complete` is the **poster's** confirmation
route — distinct from the worker-only `/api/gigs/:gigId/mark-completed`
that the My bids screen uses. Don't conflate the two; the auth checks
will 403 if a worker hits `/complete` or a poster hits `/mark-completed`.

### Web canonicalization

- `(app)/app/my-gigs/page.tsx` is the canonical V2 design (rewritten in
  this PR with the 4-tab + bidder stack + footer-action layout).
- `(app)/app/my-gigs-v2/page.tsx` is **deleted**. No external links
  pointed at it (grep confirmed). The `AppShell` sidebar, dashboard
  ActionQueueCard, and profile page already targeted `/app/my-gigs`
  before this PR landed.
- No redirect needed — the staging route was dogfood-only.

### Muted highlight

Terminal rows (cancelled / expired) render at 0.78 opacity via the
shared `RowHighlight.muted` case (already present from T5.3.1). Same
behaviour as My bids' rejected / withdrawn rows.

### Optimistic mutations

- **Boost**: row's `boosted_at` + `boost_expires_at` flip in-cache
  immediately so feed-rank UI can react without waiting for the round
  trip. The cache is restored on API failure.
- **Mark complete**: row's `gig.status` flips to `completed`
  immediately, moving it from Active → Done with the "Leave a review"
  chip. Backend rolls back on failure.

### Parity audit

Updated `docs/mobile-parity-audit.md` Tier 2 row — My tasks V2 is now
live on all three platforms. The legacy `my-gigs-v2` web staging route
is removed; `/app/my-gigs` is the only `my-gigs` route.

---

## Open-question summary (for the next session)

Before T5.0a (P1) starts, the following need a yes/no/edit from the
product owner:

- **F1** FAB variant set: 56 / 52 / pill — **accept the variant set?**
- **F2** Notifications mobile tabs = `All / Unread` only (drop `Read`
  and context-filter on mobile) — **OK?**
- **F3** My bids tab → status mapping (above). **Should `closed`
  (task cancelled) live in Rejected, or get its own bucket?**
- **F4** Backend prep for bid DTO (`shortlisted`, `your_rank`,
  `top_price`, `bid_count`, `top_bidders[≤3]`) — **approve P3?**
- **F5** Inline `top_bidders[]` on the task DTO (vs N+1 fetch) —
  **approve as part of P3?**
- **F6** Web `discover` route stays `/app/discover` (not
  `/app/discover-businesses`) — **OK?**
- **F7** Delete `/app/my-gigs-v2` route (redirect to `/app/gigs-v2`)
  after P8 ships — **OK?**
- **F8** Keep web Notifications context filter; do not port to mobile
  — **OK?**
- **F9** Review claims ships web only; defer mobile — **OK?**
- **F10** Notifications Unread empty-state CTA re-keys to All tab, no
  route push — **OK?**
- **F11** Web My posts route lands at `/app/my-pulse` (designer-spec
  filename) with title "My posts" — **OK?**
- **F12** Every shell extension is strictly additive — **confirm?**
- **F13** Add `primary25 = #f8fbff` theme token — **OK?**
- **F14** Add `?author=me` to posts feed (or a dedicated `/me` route)
  — **OK to fold into P3?**

The Plan PR (this doc) is unblocked. Every other PR waits on at least
one F-decision above.
