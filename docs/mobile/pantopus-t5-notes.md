# Pantopus T5 — Mobile UI/UX Notes

Reference doc for the T5 batch of mobile screens (My posts, My bids, My tasks
V2, Connections, Notifications, Discover hub, Review claims). Captures the
open-question resolutions, the universal conventions Claude Code must follow,
and the verbatim drift-correction reminders to paste mid-session.

Anchored against the design source at `more-designed-pages/` (cached locally,
not committed) and the existing iOS / Android / theme code in this repo.

---

## 1. Open-question resolutions

Ten decisions made before P7/P8 and the surrounding screens start. Each one
is the answer Claude Code should adopt; quote the relevant entry verbatim if
a session starts re-litigating it.

### 1.1 FAB diameter — **52pt**

All new frames spec 52×52 consistently:
`myposts-frames.jsx:100`, `mytasks-frames.jsx:127`, `mybids-frames.jsx:127`,
`connections-frames.jsx:113`. Notifications explicitly says "NO FAB" at
`notifications-frames.jsx:2`. Android currently ships 56dp at
`ListOfRowsScreen.kt:139`; iOS has no shared FAB yet. Shrink Android by 4dp,
build iOS to spec. 52pt is above HIG's 44pt minimum tap target — safe.

### 1.2 Unread row tint — **add one new token `primary25`; reuse `identity.personalBg` for the border**

- `#dbeafe` (the border in `notifications-frames.jsx:143`) is already
  `identity.personalBg` — exact match in
  `frontend/packages/theme` and the iOS asset catalog at
  `frontend/apps/ios/Pantopus/Resources/Assets.xcassets/Colors/`.
- `#f8fbff` (the unread row background at `notifications-frames.jsx:142`)
  has no current match. `primary50` (`#f0f9ff`) is the closest but visibly
  cooler. Add a new `primary25` = `#f8fbff` to `@pantopus/theme`, iOS asset
  catalog, and Android `Color.kt`. Do not let Claude Code use `primary50` as
  a substitute — the tabbed-list contrast is on a clean white surface and
  the shade difference is visible.

### 1.3 Compact row buttons — **both sizes are intentional, keep both**

Two distinct archetypes that should be codified separately:

- **34pt footer button** — full-width-of-column primary action inside a
  card footer (revise / withdraw / review). Radius 9. See
  `mybids-frames.jsx:170,180` and `mytasks-frames.jsx:214,224`.
- **28–30pt inline-action pill** — inline affordance in a person row
  (message / view). Pad `0 12`, radius 8. Primary is 30pt, secondary is
  28pt. See `connections-frames.jsx:181,186`.

Code as `CompactButton.footer` (34) and `CompactButton.inlineAction`
(28 secondary / 30 primary) layered on top of the existing 44pt
`PrimaryButton`. Don't collapse the two — they live in different
container types.

### 1.4 Connections "verified" overlay — **use existing `VerifiedBadge` as-is**

Design at `connections-frames.jsx:144-150`: 16×16 circle, `#16a34a` green,
2px white border, 9×9 white check, positioned `-2/-2` from the avatar's
bottom-right.

Existing components match almost exactly:

- iOS `VerifiedBadge.swift:14-32`: 16pt default, `.success` color
  (`#16a34a`), 1.5pt white border, white check at 60%.
- Android `VerifiedBadge.kt:32-52`: same signature.

The 1.5→2px border delta is sub-pixel at @2x/@3x. No new variant. Just
overlay at the correct offset.

### 1.5 Bidder stack — **new `BidderStack` primitive, NOT `AvatarWithIdentityRing`**

`AvatarWithIdentityRing.swift:41` and `AvatarWithIdentityRing.kt:51` have a
minimum size of 40pt and no overlap variant; forcing them to 22pt breaks
the ring math.

Design at `mytasks-frames.jsx:180-195`: 22pt plain circular avatar, 2pt
white border, negative-margin overlap, with a `+N` overflow tile at the
same 22×22. Ship a new `BidderStack` component in
`Core/Design/Components/` (iOS) and `ui/components/` (Android). Reusable
for any "social proof" stack later (claimants, attendees, etc.).

### 1.6 My posts intent palette — **design and code already agree**

Both `frontend/apps/ios/Pantopus/Features/Feed/Pulse/PulseIntent.swift:14-86`
and `myposts-frames.jsx:24-28` use the same five active intents:

`ask · recommend · event · lost · announce`

(`all` is a filter, not a post intent.) No `sale`, `share`, or `alert`
anywhere — those are not in production. Wire the chip fg/bg pairs from the
design into a shared `IntentChip(kind:)` styler reused by Pulse feed and
My posts; Android `PulseIntent.kt:14-129` mirrors iOS.

### 1.7 Discover hub section ordering — **People · Businesses · Gigs · Listings**

Confirmed in `discoverhub-frames.jsx:335,344,353,358` and echoed in the
empty-state copy at `:418`. Ship in this order; do not let Claude Code
reorder based on a designer-comment about engagement.

### 1.8 Review claims admin gating — **web only, defer mobile**

File-path header at `reviewclaims-frames.jsx:3` reads
`src/app/admin/review-claims.tsx` (Next-style web path). `:2` calls out
"admin queue, no create action". The mobile codebase has no admin-role
tier today.

Implement under `frontend/apps/web/.../admin/review-claims`. Cut Review
claims out of the mobile P-plan. Revisit if/when a mobile admin role
ships.

### 1.9 Notifications Unread empty-state CTA — **switches to the All tab in place**

`notifications-frames.jsx:317,349` shows the button on the Unread empty
state with `TabStrip` set to `active={1}` (Unread). Behavior: tapping
re-keys the tab to `0` (All). No route push. The button is a tab-filter
collapse, not a navigation event.

### 1.10 Status-derivation backend ownership — **backend prep PR first**

Backend reality in `backend/routes/offersV2.js:152-177`: returns `status`
(only `pending / expired / assigned`), `match_rank`, `match_score`,
`price`, raw timestamps. No derived competition fields.

Design chips needed:

| Chip                              | Source                                   | Owner          |
| --------------------------------- | ---------------------------------------- | -------------- |
| `Closes in 2h` / `Closes in 4h`   | derived from `expires_at`                | client         |
| `Top bid` / `Outbid`              | needs visibility of competing bids       | **new backend field** |
| `Shortlisted`                     | buyer-driven signal, not derivable       | **new backend field** |
| `Reviewing bids` / `No bids yet`  | derived from `bid_count` on task DTO     | confirm/add on backend |

Required prep before P7 (My bids) and P8 (My tasks V2) start:

- Add `shortlisted: boolean`, `your_rank: int | null`, `top_price: number | null`
  to the bid response in `offersV2.js`.
- Confirm `bid_count` is on the task DTO; add it if missing.

Without this PR, P7 cannot ship `Shortlisted` at all and would need a
"fetch sibling bids" workaround for `Top bid` / `Outbid` that wouldn't
scale. Keep the client a thin renderer of authoritative server state so
iOS and Android can't drift on what `Outbid` means.

---

## 2. Prerequisite PRs (sequenced)

Order before any T5 screen starts:

1. **Theme PR** — add `primary25` (`#f8fbff`) to:
   - `frontend/packages/theme` colors source
   - `frontend/apps/ios/Pantopus/Core/Design/Colors.swift` + asset catalog
   - `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/theme/Color.kt`
2. **Backend PR** — extend bid + task DTOs with `shortlisted`, `your_rank`,
   `top_price`, `bid_count` as described in §1.10. Update DTO tests.
3. **Shell PR** — shrink shared FAB to 52pt; add `BidderStack`; add
   `CompactButton.footer` (34) and `CompactButton.inlineAction` (28 / 30)
   styles. Update the iOS `Buttons.swift` and Android `Buttons.kt`
   surfaces.
4. **Cut Review claims from mobile** — remove from the parity audit
   mobile column with a `(web only)` note.

Feature screens (My posts, My bids, My tasks V2, Connections, Notifications,
Discover hub) can land in parallel once 1–3 are merged.

---

## 3. Universal conventions Claude Code must follow

Each prompt in Part 3 re-states these for Claude Code's benefit. Listed
here so you can spot a violation in any PR review:

1. **Read the repo conventions first every session:**
   `frontend/apps/ios/CLAUDE.md`, `frontend/apps/android/CLAUDE.md`,
   `docs/mobile-screen-definition-of-done.md`,
   `docs/mobile-parity-audit.md`, `docs/mobile-wiring-audit.md`.
2. **Archetype reuse.** Every list screen uses the shared shell
   (`Features/Shared/ListOfRows/*` iOS,
   `ui/screens/shared/list_of_rows/*` Android,
   `components/list-of-rows/*` web after P1). Bespoke shells need
   explicit justification in the commit message.
3. **Token-only.** No hex literals, no raw `.dp` / `.sp` / point
   literals, no direct `Image(systemName:)` / `Icons.Default.*`. Use
   `Theme.Color.*` / `PantopusColors.*`, `Spacing.s*`, `Radii.*`,
   `PantopusIcon.*`. `make lint` and `./gradlew detekt` fail on
   violations.
4. **Four states.** Every fetchable screen renders Loading (skeleton),
   Empty (shared `EmptyState`), Loaded, Error (banner with retry). The
   shell handles this when the VM emits the right state.
5. **Real wiring.** No `// lands later`, no `NotYetAvailableView`, no
   dead `Button {}`. Every interactive element hits a real endpoint or
   pushes a typed route.
6. **Parity audit.** After landing a screen, update the row in
   `docs/mobile-parity-audit.md`.
7. **Tests.** Every new ViewModel ships with unit tests covering
   loading / empty / loaded / error transitions and the row-mapping
   logic. Every new screen ships with at least one Compose/SwiftUI
   snapshot test.
8. **No new state libraries.** Web stays on `@tanstack/react-query`.
   iOS stays on `@Observable`. Android stays on Hilt + Compose state.

---

## 4. Reminders to paste mid-session if Claude Code drifts

Keep these in a snippet manager. Paste verbatim when needed.

> "You marked this done but the empty state isn't wired. Implement it
> now using the shared `EmptyState` component. Don't report done again
> until it renders against the design's empty frame."

> "Stop. That decision is in the prompt's open-questions list and the
> answer is [X]. Revert your assumption and use [X] instead."

> "CI is failing with [exact error]. Find and fix it. Don't move on
> until `make lint` and `make test` are both green locally."

> "Re-read `docs/mobile-screen-definition-of-done.md`. Every box must
> be ticked before you mark this PR done."

> "If you're about to add a hex literal, stop. Use a token. If the
> token doesn't exist, add it to `@pantopus/theme` first, then use it
> from feature code."

> "Don't widen the row contract to fix one screen. If the archetype
> is too narrow, propose an additive extension to T5.0 and ask me
> before shipping the fix."

---

## 5. Things you must NEVER let Claude Code do

1. **Modify existing call sites of the row contract in a way that's not
   strictly additive.** If the T5.0 archetype changes break an existing
   call site, the change is wrong.
2. **Invent backend endpoints.** Every endpoint name must be verified
   against `backend/routes/*` before wiring.
3. **Add new state libraries.**
4. **Skip the parity audit update.**
5. **Land a screen behind a feature flag without telling you.**
6. **Treat a designer comment as gospel where it contradicts the rendered
   frame.** When in doubt, the visual frame wins. When still in doubt,
   ask you.
