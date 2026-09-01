# T6 — Open-question decisions

Locked-in answers to the 17 open questions surfaced in
`docs/t6-buildout-plan.md` §H. Captured live with the product owner;
this doc is the single source of truth — when a session re-litigates a
decision, quote the relevant entry verbatim and proceed.

> **Status**: ✅ All 17 decisions captured.
>
> **Next session**: read this doc + `docs/t6-buildout-plan.md` before
> starting T6.0a. Quote entries verbatim if a session re-litigates a
> decision.

---

## Q1 — Magic Task on My tasks V2 ✅

**Decision**: **Sequenced — plumbing first.** (Matches Recommendation.)

T6.0d ships iOS + Android Magic Task plumbing first: endpoints helper
(11 routes from `backend/routes/magicTask.js`), DTOs (draft / post /
settings / templates), composer screen + view-model, settings store
(`magic_task_instant_post`). The My tasks V2 re-skin PR (P9.5 in the
plan) lands AFTER T6.0d, consuming the new DTOs (specifically the
`task_archetype` + `engagement_mode` / `task_format` fields on the gig
DTO).

**Why this matters**: avoids shipping a re-skinned row with empty
`archetypeOverline` + missing `engagementMode` for every gig posted
before Magic Task ships (and 100% of gigs until the iOS composer
lands). The four shell extensions (`RowLeading.magicArchetypeTile`,
`RowModel.archetypeOverline`, engagement-mode handling,
`FabVariant.magicCreate`) all land in T6.0a *before* the plumbing PR —
the plumbing PR ships a working composer that uses them, and the
re-skin PR is then a pure DTO-to-row mapping change.

---

## Q2 — Bills utility categories ✅

**Decision**: **Client-derive from payee string.** (Diverges from
recommendation.)

The frontend ships a `payeeToCategory(payee: String) -> UtilityCategory?`
helper on iOS + Android + web that matches common payee text to the
8 utility categories (electric / gas / water / internet / hoa /
insurance / trash / phone). Fallback is `generic` (receipt icon over
primary sky tint). **No backend change** to `HomeBill.bill_type` for
this T6 ship.

**Implementation notes**:
- Helper lives in shared mobile feature code:
  `Features/Homes/Bills/PayeeCategory.swift` (iOS),
  `ui/screens/homes/bills/PayeeCategory.kt` (Android),
  `(app)/app/homes/[id]/bills/payee-category.ts` (web).
- Pattern set (case-insensitive substring matches; first-match wins):
  - `electric` — pge, edison, dominion, duke, eversource, conedison
  - `gas` — gas (when not paired with another utility name), socalgas, atmos
  - `water` — water, sewer, municipal water, aqua
  - `internet` — comcast, xfinity, spectrum, att, fios, verizon (internet), tmobile (home), starlink
  - `hoa` — hoa, homeowners association, condo (assn), strata
  - `insurance` — state farm, geico, allstate, progressive, insurance, aaa (auto)
  - `trash` — waste, refuse, recology, trash
  - `phone` — t-mobile, verizon (wireless), att (wireless), sprint, mint mobile, phone
- Fall through to `generic` on no match.
- The match set is a constant table in the helper; future categories
  bolt on without touching the row mapper.

**Why this divergence**: keeps T6 backend untouched on the Bills path,
avoids the schema migration sequencing risk, and ships a useful tile
*today*. **Trade-off**: novel payees (e.g. a small local utility) will
show the generic tile until the helper learns them. This is acceptable
because the user can still see the bill — only the icon tint is
generic. A future tier can promote the field to a backend column once
the patterns settle.

---

## Q3 — Auth phone-OR-email ✅

**Decision**: **Email only for v1.** (Matches Recommendation.)

The rendered Login frame shows email with a `mail` leading icon and
"Email" label (`auth-frames.jsx:113-156`). Backend phone-OTP routes
are MISSING (per §G.5). Shipping phone-OR-email would block T6 on
Twilio wiring + new backend routes (`POST /api/users/login-phone`,
`POST /api/users/verify-phone`) + UX disambiguation between phone-OTP
and password — a separate tier.

Phone-as-identity is filed as a future Tier-N item. The existing
`User.phone_number` column stays as a contact attribute, not an auth
identifier.

---

## Q4 — Auth verify email gating ✅

**Decision**: **Soft-gate with banner.** (Matches Recommendation.)

New users sign in immediately on Create Account success. A persistent
banner ("Verify your email to unlock posting") renders above the main
content on every screen until `user.verified === true`, linking to the
Verify email frame.

The Verify email frame doubles as the landing page from the email-link
deep link (`/verify-email?token=…`) — same screen, different entry
point.

**Wiring**:
- `POST /api/users/verify-email` (users.js:3115) — verify by token /
  code.
- `POST /api/users/resend-verification` (users.js:3049) — banner CTA
  "Resend verification email".
- Banner suppressed once `user.verified` flips true (real-time via
  socket if available, else next refresh).

**Why this matters**: avoids new-user drop-off (every new user has to
leave the app, open mail, click a link, return). Soft-gate keeps
activation high without losing the trust signal — posting / messaging
gate behind the banner if product wants stronger pressure.

---

## Q5 — Hub today-card data source ✅

**Decision**: **Reshape `GET /api/hub` response.** (Matches Recommendation.)

Server-side change to `backend/routes/hub.js` adds three discrete
top-level fields computed from data already in the response:

- `nextPillarEvent: { pillar: 'personal'|'home'|'business', type: string, dueAt: ISO8601, label: string } | null`
  — picks the earliest-by-`dueAt` item from `statusItems[]`.
- `outstandingMail: { personal: number, home: number, total: number }`
  — sums `unreadPersonal` + `homeMail.count` + (any business unread
  count).
- `openGigsNearby: number` — already exists as `gigsNearby` (line 429);
  rename + surface at top level so the field name matches the design.

~30 LOC in `hub.js`. Single round-trip. Both platforms identical
client-side projection.

**Rolled into**: T6.0c backend prep.

**Blocks**: P6 Hub redesign.

---

## Q6 — Me identity gradient header ✅

**Decision**: **Re-skin only — same structure.** (Matches Recommendation.)

Shipped `Features/Me/MeView` already has the 3-color gradient header +
identity switcher + stat tiles + action grid. No VM / routing / endpoint
changes. Visual refresh only:

- 72pt avatar with identity-tinted gradient (sky / green / violet)
- 22pt verified badge overlay (re-use the T5 `VerifiedBadge` at size 22)
- Identity-tinted stat tile cards (replace flat-background tiles)
- 2×3 action grid (replace any existing 3×2 or list-row layout)

Small PR (P7). No feature flag — visual-only changes are reversible
without an enabled-gate.

---

## Q7 — Settings sub-routes ✅

**Decision**: **Wire 6 GroupedList sub-routes in P8; park 2 for P8.5.**
(Matches Recommendation.)

Wired in P8 (each a `GroupedList` variant, ~80 LOC):

| Sub-route | Notes |
|---|---|
| Blocked users | List from `GET /api/blocks` (blocks.js); unblock action. |
| Password | Change password form — wraps `POST /api/users/change-password`. |
| Verification | Status grid (email · phone · home · ID) — reads `user.verified` flags. |
| Help | Static FAQ + contact CTA. No backend. |
| Legal | TOC + links to `legal-frames.jsx` long-form pages. |
| About | Build info, version, OSS attributions. |

Plus the existing P3.1-shipped Notifications + Privacy GroupedList
variants (no change).

Parked for P8.5 (separate PR once dependencies ready):

| Sub-route | Reason for parking |
|---|---|
| Data export | Requires a multi-step Wizard flow + a new backend job runner; out-of-scope for P8. |
| Payments & payouts | Hooks into the Stripe Connect wallet surface (`wallet.js`) — needs the wallet UX to be settled first. |

P8 ships the 6 wired rows + the existing 2; the parked 2 stay on
`.placeholder(label:)` with a tracker-link doc-comment pointing to
P8.5.

---

## Q8 — Mailbox A17 archetype ✅

**Decision**: **New shared shell with 8 slots.** (Matches Recommendation.)

`MailboxA17Shell` lives at:

- iOS: `Features/Shared/MailboxA17/MailboxA17Shell.swift`
- Android: `ui/screens/shared/mailbox_a17/MailboxA17Shell.kt`
- Web: `components/mailbox-a17/MailboxA17Shell.tsx`

Slot contract:

| Slot | Required | Variant-typed? | Notes |
|---|---|---|---|
| `nav` | yes | no | back chevron + uppercase eyebrow + bookmark / kebab |
| `hero` | yes | no | trust chip + category chip + sender + title + reference + optional `Acknowledged` banner |
| `aiElfStrip` | optional | no | sparkles + summary + bulleted key points (gradient sky background) |
| `keyFacts` | optional | no | list of icon+label+value items, optional tags + emphasis |
| `body` | optional | no | body card with paragraphs / formatted text |
| `attachments` | optional | **YES** | sealed `MailboxA17Attachment` enum: `.bookletPages`, `.certifiedChainOfCustody`, `.communityEvent`, `.couponBarcode`, `.packageTimeline` |
| `sender` | yes | no | sender card (avatar + dept + verification kind + proof line) |
| `actions` | yes | no | bottom action row (1–3 buttons) |

The `attachments` slot is the variant point — each design variant
(Booklet / Certified / Community / Package / Coupon) renders its own
attachment payload via the sealed enum. All other slots share the same
component, parameterized by data.

Shell justification: 5 designs share the same composition; one-off
ContentDetail derivatives would duplicate 7 of 8 slots' chrome 5x.
The shell isolates variant logic to one slot.

---

## Q9 — Map+list hybrid sheet ✅

**Decision**: **New shared `MapListHybridShell`.** (Matches Recommendation.)

Lives at:

- iOS: `Features/Shared/MapListHybrid/MapListHybridShell.swift`
- Android: `ui/screens/shared/map_list_hybrid/MapListHybridShell.kt`
- Web: `components/map-list-hybrid/MapListHybridShell.tsx` (CSS-based
  detents via Framer Motion or Vaul, depending on dep policy)

3-detent contract:

| Detent | iOS height | Android dp |
|---|---|---|
| Collapsed | `.height(160)` | 160 |
| Default | `.height(296)` | 296 |
| Expanded | `.height(518)` | 518 |

Iframes the shipped `NearbyMapView` (T2.4) into the new shell — the
old screen's data flow is preserved; only the rendering and gesture
math move into the shell.

Slot contract:

- `topPill` — floating back / title / filter pill (blur background, top edge)
- `categoryChips` — overlay horizontal strip (under topPill)
- `mapControls` — locate-fixed / layers buttons (right edge, floating)
- `sheetHeader` — count + sort selector
- `sheetBody` — vertical list + optional horizontal `GigCard` carousel

Future consumers (Marketplace map mode, Discover businesses map view)
plug into the same shell.

---

## Q10 — Magic Task FAB ✅

**Decision**: **New `FabVariant.magicCreate`.** (Matches Recommendation.)

Adds a fourth case to `FabVariant`:

| Variant | Diameter | Use |
|---|---|---|
| `.canonicalCreate` | 56pt | screen's primary create action (default for back-compat) |
| `.secondaryCreate` | 52pt | non-canonical create (My posts, Connections, Bills *before T6 re-skin*, Pets) |
| `.extendedNav(label:)` | 48pt pill | navigation FAB ("Browse tasks", "Start a train") |
| **`.magicCreate`** | **60pt** | **Magic-Task create — gradient primary600→primary700, plus glyph + 18pt sparkles disc overlay at top-right** |

`magicCreate` consumers in T6:
- My tasks V2 (`.magicCreate`, sparkles+plus, gradient primary600→700)
- Mailbox-A17 root (`.magicCreate` with `scan-line` icon for magic
  ingest — same variant, swappable icon)

Bills' new 60pt home-green-gradient FAB does NOT use `.magicCreate` —
it's a home-tinted variant of `canonicalCreate`. To support that,
`canonicalCreate` gains an optional `tint` parameter (default sky;
override to home-green or business-violet). The geometry stays at 56pt
for tinted canonicals, 60pt only for the magic variant.

> **Open follow-up**: Bills design specifies 60pt for its FAB, not 56pt
> — see `bills-frames.jsx:163-173`. If the 60pt size is intentional
> for the Home pillar's create FABs (and not just My tasks Magic), then
> `canonicalCreate` should pick up a size param too, or we need a
> `homeCreate` variant at 60pt + home-green gradient. Flag for
> designer confirmation. Default: **shrink Bills to 56pt** to match
> the canonical create taxonomy unless the designer pushes back.

---

## Q11 — Support trains identity tone ⚠️

**Decision**: **Switch to home tone when home-anchored.**
(Diverges from recommendation.)

When the train's `recipient_home_id` is set (the recipient is anchored
to a verified household), the screen renders in **home-green**:
- Tab underline → home-green
- FAB ("Start a train") → home-green pill
- Status-chip "Active" → home-green (replaces sky-blue)
- Inner type-tile gradients unchanged (they encode train kind, not
  identity)

Otherwise (no `recipient_home_id` — purely person-to-person mutual aid),
the screen stays **personal sky-blue** as the design says.

The warm cream intro band (`#fff7ed`) on the "My trains" tab remains
unchanged in both modes — it's a hospitality warmth signal, not an
identity tone.

**Implementation**:
- `SupportTrainsViewModel` exposes `identityTone: IdentityTone`
  derived from the active train context (or list-level: if all
  visible trains are home-anchored, render home tone; otherwise
  personal).
- For the **list screen** (where multiple trains may have different
  anchors), tone is **personal sky-blue** — the screen aggregates
  across many trains. Tone-per-row would be visually noisy.
- For the **train detail screen** (per train), tone follows the
  single train's anchor.

**Why this divergence**: the user's read is that home-anchored trains
are "household coordination" surfaces and inherit the home pillar's
green; pure mutual-aid trains (e.g. for a parent going through cancer
treatment, no household scope) stay personal. The design's "Personal
blue" assertion holds for the unanchored case but is over-broad for
the anchored case.

**Trade-off**: introduces tone variance within the support-trains
surface. Mitigated by the rule that the *list screen* always renders
personal — only detail screens flip.

**Open follow-up**: confirm with designer that this conditional tone
matches their intent, since the original design comment explicitly
says "Personal blue — not Home." If designer pushes back, fall back
to personal always.

---

## Q12 — Hub redesign cutover ⚠️

**Decision**: **Direct cutover for everyone.** (Diverges from recommendation.)

The Hub redesign ships to 100% of users on T6 release. No
`t6_hub_redesign` feature flag. Hub is the first screen users see —
the user accepts the regression risk for simpler shipping and zero
flag debt.

**Mitigation that must accompany this decision**:

1. **Q5 backend reshape lands FIRST**. The new Hub view expects
   discrete `nextPillarEvent`, `outstandingMail`, `openGigsNearby`
   fields. Cutting over before the backend ships those fields would
   render a broken today-card. Sequence T6.0c (backend prep) →
   `/api/hub` reshape → P6 (Hub view cutover).
2. **Comprehensive snapshot + UI-test sweep before cutover**.
   Paparazzi baselines (Android) + SwiftUI snapshots (iOS) for every
   Hub state: skeleton, first-run, populated (each identity scope),
   error, offline. UI tests for: bell tap → notifications,
   menu tap → settings, today-card tap → respective destination,
   pillar grid → pillar destination, jump-back-in → resolved route.
3. **Rollback plan**: revert PR ready to land in <30 minutes if
   first-paint telemetry shows regression in the first 24 hours
   post-ship.
4. **Beta release** (Android internal track + iOS TestFlight)
   minimum 72 hours before App Store / Play Store production push.

**Why this divergence**: the user's read is that flag debt on Hub
risks becoming permanent (T4.1 had similar flag debt). Direct cutover
with a strong pre-flight gate is simpler. The risk is acknowledged.

---

## Q13 — `engagement_mode` enum collision ✅

**Decision**: **Rename the design's concept to `task_format`.**
(Matches Recommendation.)

The backend's existing `engagement_mode` enum
(`instant_accept | curated_offers | quotes`) keeps its name — it
encodes the **offer-acceptance mode** (Magic Task fast-path vs
curated bidding vs quote-based negotiation).

A NEW `task_format` column is added to the `Gig` table with values
`in_person | drop_off | remote | hybrid` — the **helper-engagement
format** (does the helper come on site, drop something off, work
remotely, or a mix).

The two axes are orthogonal — store both. A gig can be
`engagement_mode='curated_offers'` + `task_format='remote'` (curated
bids for a remote tutoring task), or `engagement_mode='instant_accept'`
+ `task_format='drop_off'` (Magic Task instant-post for a package
pickup).

**Implementation** (folded into T6.0c):
- Migration: `ALTER TABLE Gig ADD COLUMN task_format TEXT NOT NULL DEFAULT 'in_person'`.
- Constraint: `Gig_task_format_chk CHECK (task_format IN ('in_person', 'drop_off', 'remote', 'hybrid'))`.
- Add field to: `POST /api/gigs/magic-post` (magicTask.js:395),
  `POST /api/gigs` (gigs.js:749), `GET /api/gigs/my-gigs`
  (gigs.js:1169 — for the My tasks V2 row to render the badge).
- iOS DTO + Android DTO + Web DTO get the new `task_format` field,
  mapped to an enum.
- Design files and Claude-instruction sessions MUST use `task_format`
  going forward — never `engagement_mode` for the design's concept.

**Why this matters**: storing both axes prevents data corruption
from name collision (`engagement_mode='in_person'` would otherwise
silently violate the backend constraint) and keeps the two
orthogonal product concepts cleanly separated.

---

## Q14 — Mailbox-A17 root replaces T1.3 ✅

**Decision**: **Replaces.** (Matches Recommendation.)

The shipped T1.3 `MailboxListView` (`Features/Mailbox/MailboxListView.swift`,
`ui/screens/mailbox/MailboxListScreen.kt`) is migrated to the new
A17 root:

- **Top-level**: drawer pills (`Me / Home / Biz / Earn`) driven by
  the user's identity list — replaces the single-list-of-mail view.
- **Inner tabs**: `Incoming / Counter / Vault` — replaces the
  `All / Unread / Starred` tabs.
- **Per-row state**: `unread` becomes a row-state filter applied
  inside Incoming (e.g. an "Unread only" toggle), not a top-level
  tab.
- **FAB**: magic-ingest scan-line FAB (variant `.magicCreate` with
  `scan-line` icon, primary600 disc).
- **Search**: existing search icon stays in the top bar; opens a
  search overlay over the current drawer's inbox.

**Migration plan**:
- Old tab ids `tab.all`, `tab.unread`, `tab.starred` deprecated.
- New tab ids `tab.incoming`, `tab.counter`, `tab.vault`.
- Drawer pill ids `drawer.me`, `drawer.home`, `drawer.biz`,
  `drawer.earn`.
- Deep links / push notifications that pointed at
  `/app/mailbox?tab=unread` get rewritten to
  `/app/mailbox?drawer=me&tab=incoming&filter=unread`.
- Parity audit row for T1.3 marked **superseded by P19 (T6)**.

**Why this matters**: the drawer pill is a more meaningful identity
scope than the All/Unread/Starred filter — mail belongs to a
*pillar* (your personal mail vs your home's mail vs your business's
mail), and the unread/starred state is per-row, not a separate axis.

---

## Q15 — MyHomes refresh replaces T1.4 row ✅

**Decision**: **Replaces.** (Matches Recommendation.)

The shipped T1.4 row (40pt icon + title + subtitle + chevron) is
replaced by the new richer row:

- 56pt address tile (initials over home-green gradient; map-pin glyph
  reserved for empty/loading)
- Address line + verification check
- Locality + role chip (`Owner / Resident / Manager / Tenant / Guest`)
  + member count
- Inline stats strip (packages · bills · tasks counts)
- "Current" affordance pinned on the home the user is actively
  switched into

Same data shape — only the rendering changes. Single row-shape per
screen is the convention. Drop the old layout.

**Backend additions needed?** The stats strip needs aggregate counts
(packages / bills / tasks). The shipped `GET /api/homes/my-homes`
returns the home rows but not aggregate counts per home. **Folded
into T6.0c backend prep**: extend the response to include per-home
`{packages_count, bills_count, tasks_count}` aggregates (or surface
these from the existing data already loaded for the dashboard, if
cheap).

**Open follow-up**: confirm with backend that the aggregate counts
can be computed cheaply per home (probably yes via 3 small COUNT()
queries with a `WHERE home_id IN (...)` filter against
`HomePackage`, `HomeBill`, `HomeTask`). If expensive, fall back to a
lazy-load pattern (counts populate after first paint).

---

## Q16 — Beacon backend mapping ✅

**Decision**: **`/api/personas/:handle`.** (Matches Recommendation.)

The Public Beacon profile is the creator-persona public surface,
distinct from the generic user public profile at `/api/users/id/:id`.

**Routes (all real, used by existing Audience + Handshake surfaces)**:
- `GET /api/personas/:handle` — persona profile (name, bio, avatar,
  cover, tier list)
- `GET /api/personas/:handle/posts` — broadcasts feed
- `GET /api/personas/:handle/tiers` — paid-tier list
- `POST /api/personas/:handle/follow` — handshake initiation

The 4 frames map to states of the same surface:
- **Persona visitor** — `viewer != owner`, `is_follower=false` →
  Follow CTA
- **Persona owner** — `viewer == owner` → Edit CTA + draft-broadcasts
- **Local visitor** — `viewer != owner`, viewer is a local neighbor
  → may unlock additional tabs / content
- **Empty** — persona has no broadcasts yet

The "Local visitor" frame's additional unlock state (if it requires
new backend fields beyond what `/api/personas/:handle` returns today)
is filed as a backend follow-up to confirm before P16.5.

---

## Q17 — Web parity scope ✅

**Decision**: **Required only where web route exists today; defer the
10 home-pillar deep screens to T7.** (Matches Recommendation, after
revisit.)

> **Note**: this entry was initially decided as "Required for ALL 46
> new screens" and revisited later in the session. The revisit pulled
> back the scope expansion. The 10-screen web scope expansion is
> **cancelled**.

Web companion required for:
- All 12 T5-original re-issues (already have web routes from T5.4.3)
- All refresh PRs whose mobile screens have existing web routes —
  Auth (`/auth`), Hub (`/app/hub`), Me (`/app/profile`), Settings
  (`/app/settings`), Chat (`/app/chat`), Marketplace
  (`/app/marketplace`), Pulse (`/app/feed`), Gigs (`/app/gigs`),
  Mailbox-A17 root (`/app/mailbox`), MyHomes (`/app/homes`),
  MyBusinesses (`/app/businesses`), MyListings (`/app/my-listings`),
  MapListHybrid (`/app/map`), Bills (`/app/homes/[id]/bills`), Pets
  (`/app/homes/[id]/pets`), Discover Hub (`/app/discover-hub`),
  Discover Businesses (`/app/discover`), Connections
  (`/app/connections`), Notifications (`/app/notifications`), Offers
  (`/app/offers`), Listing offers (`/app/listing-offers`), My bids
  (`/app/my-bids`), My tasks (`/app/my-gigs`), My posts
  (`/app/my-pulse`), Support trains (`/app/support-trains`).

Web companion **deferred to T7** (no existing web route today;
mobile-only for T6):
- Maintenance (`/app/homes/[id]/maintenance` — to add in T7)
- Calendar (`/app/homes/[id]/calendar`)
- Documents (`/app/homes/[id]/docs`)
- Vault (`/app/mailbox/vault`)
- Members (`/app/homes/[id]/members`)
- Owners (`/app/homes/[id]/owners`)
- Access codes (`/app/homes/[id]/access`)
- Emergency info (`/app/homes/[id]/emergency`)
- Polls (`/app/homes/[id]/polls`)
- Packages (`/app/homes/[id]/packages`)
- Household tasks (`/app/homes/[id]/tasks`)

**Scope impact**:
- T6 keeps a mobile-first cadence for the home-pillar deep screens.
- Per-PR scope: each home-pillar feature PR (P10–P15, P15.5) ships
  iOS + Android only in the same commit; web sweep is a separate T7
  effort.
- Document each deferral in `docs/mobile-parity-audit.md` with
  `(mobile-only this tier — T7 web sweep)` annotation.

**Why this matters**: these screens are household-internal admin
surfaces (chore logs, code rotations, member rosters). Desktop usage
is rare compared to mobile (the user is at home, opening the app
when they remember to log something). Shipping mobile-first this
tier lets the team move faster; the T7 web sweep can collapse the 11
pages into a single multi-PR effort using the shared
`<ListOfRowsShell />` web mirror.

**Per-PR acceptance gate** (unchanged from T5):
- iOS + Android land in the same commit.
- Web companion ships in the same commit ONLY for screens with an
  existing web route.
- Parity audit row records the new web route OR the `(mobile-only)`
  deferral note.

---

## Decision summary at a glance

| # | Question | Decision | Aligned? |
|---|---|---|---|
| 1 | Magic Task on My tasks V2 | Sequenced — plumbing first | ✅ |
| 2 | Bills utility categories | Client-derive from payee string | ⚠️ Diverged |
| 3 | Auth phone-OR-email | Email only for v1 | ✅ |
| 4 | Verify email gating | Soft-gate with banner | ✅ |
| 5 | Hub today-card data source | Reshape /api/hub response | ✅ |
| 6 | Me identity gradient header | Re-skin only — same structure | ✅ |
| 7 | Settings sub-routes | Wire 6 GroupedList; park 2 | ✅ |
| 8 | Mailbox A17 archetype | New shared shell with 8 slots | ✅ |
| 9 | Map+list hybrid sheet | New shared shell | ✅ |
| 10 | Magic Task FAB | New `FabVariant.magicCreate` | ✅ |
| 11 | Support trains identity tone | Switch to home tone when home-anchored | ⚠️ Diverged |
| 12 | Hub redesign cutover | Direct cutover for everyone | ⚠️ Diverged |
| 13 | engagement_mode enum collision | Rename design → task_format | ✅ |
| 14 | Mailbox-A17 root replaces T1.3 | Replaces | ✅ |
| 15 | MyHomes refresh replaces T1.4 row | Replaces | ✅ |
| 16 | Beacon backend mapping | /api/personas/:handle | ✅ |
| 17 | Web parity scope | Existing-route only; defer 10 to T7 | ✅ (after revisit) |

**Aligned**: 14 / 17. **Diverged**: 3 — Q2 (Bills), Q11 (trains tone),
Q12 (Hub flag).

## Cross-cutting follow-ups surfaced by the decisions

1. **Designer confirmation needed** (none of these block T6.0a, but
   should land before the consuming PR):
   - Q10: Is Bills' 60pt FAB intentional (vs 56pt canonical)?
   - Q11: Conditional home-tinted support-trains tone matches intent?
   - Q15: MyHomes per-home aggregate counts in the stats strip.
   - Q16: Beacon "Local visitor" frame's unlock state requires new
     backend fields?

2. **Backend prep additions to T6.0c** (folded into the same PR):
   - Add `phone` to `HomeBill.bill_type` enum — **CANCELLED** per Q2
     (client-derive instead).
   - Add `ceremonial` to `mail_object_type` or `is_ceremonial` flag
     (Q14 doesn't change this; still needed for ceremonial mail).
   - Add `task_format` column to Gig + constraint + DTO additions
     to `/magic-post`, `/api/gigs`, `/my-gigs` (Q13).
   - Reshape `/api/hub` to add discrete `nextPillarEvent` /
     `outstandingMail` / `openGigsNearby` (Q5).
   - Add per-home `{packages_count, bills_count, tasks_count}` to
     `/api/homes/my-homes` (Q15).
   - PATCH/DELETE for Documents + Emergencies at `home.js`.
   - Maintenance CRUD (4 new routes).

3. **Deferred to T7**:
   - Q17: 10 home-pillar deep screens stay mobile-only this tier
     (Maintenance / Calendar / Documents / Vault / Members / Owners /
     Access codes / Emergency / Polls / Packages / Household tasks).
     T7 will run a single web-sweep effort to collapse these into web
     routes using the shared `<ListOfRowsShell />` mirror.

4. **Flag debt avoided**: no feature flags introduced (Q6 / Q12 / Q15
   all rejected flag-gating). Hub cutover relies on pre-flight snapshot
   + UI tests + beta soak + revert-ready rollback instead.


