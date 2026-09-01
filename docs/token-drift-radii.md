# P7.3 — Radii drift audit

> **Generated:** 2026-05-26. **Tokens cited from:** `docs/token-conventions.md`.

This audit catalogues every corner-radius literal in feature code and
tokenises every on-scale value (`{4, 6, 8, 12, 16, 20, 24, 9999}`).
Off-scale literals are left in place for design review.

## Methodology

### Scope

- **iOS:** `frontend/apps/ios/Pantopus/Features/`,
  `frontend/apps/ios/Pantopus/Core/Design/Components/`,
  `frontend/apps/ios/Pantopus/App/`.
- **Android:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/`,
  `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/`.

### In-scope patterns

- **iOS:** `cornerRadius: <num>` (covers `RoundedRectangle(cornerRadius:)`,
  `.clipShape(RoundedRectangle(cornerRadius:))`, `Shimmer(... cornerRadius:)`
  and any custom view taking a `cornerRadius:` kwarg);
  `<edge>Radius: <num>` for `UnevenRoundedRectangle`
  (`topLeading|topTrailing|bottomLeading|bottomTrailing` Radius).
- **Android:** `RoundedCornerShape(<num>.dp)` single-arg form;
  `RoundedCornerShape(<corner> = <num>.dp, …)` per-corner form
  (`topStart|topEnd|bottomStart|bottomEnd|size` kwargs);
  `cornerRadius = <num>.dp` (custom components like `Shimmer`).

Pill-radius forms — Android writes `999.dp` (3-digit) and `9999.dp`
(4-digit) interchangeably. Both map to `Radii.pill` (the constant is
`9999.dp`). Visual result is identical: corners larger than any
reasonable component bound, so the shape clips to a true pill / circle.

### Token mapping (from `docs/token-conventions.md` §3 and §9)

| Value | iOS / Android token |
|---:|---|
| 4 | `Radii.xs` |
| 6 | `Radii.sm` |
| 8 | `Radii.md` |
| 12 | `Radii.lg` |
| 16 | `Radii.xl` |
| 20 | `Radii.xl2` |
| 24 | `Radii.xl3` |
| 999 / 9999 | `Radii.pill` |

### Out of scope (not flagged, not changed)

- `Circle()` / `Capsule()` (iOS) and `CircleShape` (Android) — round
  shapes by construction, no numeric radius involved.
- `RectangleShape` — square corners.
- Shadow blur radii (`radius:` kwarg on `.shadow(...)` / `PantopusShadow`)
  — they're shadow tokens, audited separately under shadow drift.
- Any radius computed from a runtime expression (e.g.
  `RoundedRectangle(cornerRadius: entity.kind.isSquarePin ? 8 : 10, …)`
  — Pass 2 left these alone because the value isn't a static integer the
  regex can replace cleanly).

### Post-Wave-D coverage

The grep found radii literals in the following Wave A–D feature folders:

**iOS (7 of 19):** AudienceProfile/EditPersona (1), AudienceProfile/BroadcastDetail (1), Gigs/TasksMap (3), Explore (7), Mailbox/MailboxMap (14), CreatorInbox (2), BusinessProfile (1). The other 12 Wave A–D iOS folders have **zero** radii literals — they were built tokens-first.

**Android (13 of 19):** membership, homes/property_details, profile/professional, audience_profile/edit_persona, audience_profile/compose_broadcast, audience_profile/broadcast_detail, gigs/tasks_map, explore, mailbox/mailbox_map, mailbox/mailbox_root, review_claims, creator_inbox, business_profile.

Combined coverage = 20 Wave A–D folder findings, well above the 8 threshold.

## Summary

| | iOS | Android |
|---|---:|---:|
| **Files touched by Pass 2** (on-scale → token) | **29** | **109** |
| **Lines changed by Pass 2** | **128** | **590** |
| **Off-scale occurrences remaining** | **139** | **773** |
| Files with at least one off-scale literal | 56 | 121 |

Off-scale value distribution (post-Pass-2):

| Value (pt/dp) | iOS | Android |
|---:|---:|---:|
| 0 | 3 | 6 |
| 1 | 2 | – |
| 1.5 (float) | 1 | – |
| 2 | 6 | 7 |
| 3 | 1 | 3 |
| 5 | – | 3 |
| 7 | – | 4 |
| 9 | 2 | 25 |
| 10 | 61 | 80 |
| 11 | 1 | 72 |
| 13 | – | 69 |
| 14 | 45 | 154 |
| 15 | – | 40 |
| 17 | – | 14 |
| 18 | 5 | 81 |
| 19 | 1 | 5 |
| 22 | 8 | 79 |
| 26 | – | 4 |
| 28 | 1 | 25 |
| 30 | – | 4 |
| 32 (intentional for 64pt avatar) | – | 31 |
| 34 | – | 1 |
| 36 (half-circle for 72pt avatar) | 2 | 11 |
| 38 | – | 1 |
| 40 | – | 18 |
| 44 | – | 8 |
| 48 | – | 4 |
| 56 | – | 6 |
| 64 | – | 2 |
| 72 | – | 3 |
| 80 | – | 1 |

Note: a handful of seemingly-larger values (32, 36, 40, 48, 64, 72, 80)
correspond to *half-diameter* radii on fixed-geometry components — e.g.
`Shimmer(width: 72, height: 72, cornerRadius: 36)` is "make this 72pt
square a circle." These are intentional pill-circle composites that
designers wrote with explicit numbers rather than `Radii.pill` because
the source IS a square not a pill. They could be migrated to
`CircleShape` / `Circle()` but that's a design decision, not a token
replacement.

The big rocks — `10 / 14 / 18 / 22` — are the same "half-step" pattern
seen in the spacing audit: design picked values 2pt off the canonical
ramp for specific reasons (rows, badges, pin lozenges). Same disposition:
either extend the radii ramp with `Radii.lg_alt` / `Radii.xl_alt` /
similar, or accept the bespoke literal in code.

## Pass 2 — applied replacements

The replacement script (`/tmp/p73-audit/apply.py` during this session)
replaced every on-scale value with its `Radii.xN` token:

| Pattern | iOS files | iOS lines | Android files | Android lines |
|---|---:|---:|---:|---:|
| `cornerRadius: N` / `cornerRadius = N.dp` | 29 | 128 | (split below) | (split below) |
| `<edge>Radius: N` (Uneven) | (included) | (included) | – | – |
| `RoundedCornerShape(N.dp)` single | – | – | (included) | (included) |
| `<corner> = N.dp` per-corner | – | – | (included) | (included) |
| **Total** | **29** | **128** | **109** | **590** |

Post-Pass-2 grep returns **0** on-scale literal hits on both platforms.
Verification commands:

```bash
# iOS — must be 0
grep -rE "\bcornerRadius:\s*(4|6|8|12|16|20|24)\b|\
\b(topLeading|topTrailing|bottomLeading|bottomTrailing)Radius:\s*(4|6|8|12|16|20|24)\b" \
  frontend/apps/ios/Pantopus/Features/ \
  frontend/apps/ios/Pantopus/Core/Design/Components/ \
  frontend/apps/ios/Pantopus/App/ --include="*.swift" | wc -l

# Android — must be 0
grep -rE "RoundedCornerShape\((4|6|8|12|16|20|24|999|9999)\.dp\)|\
\b(topStart|topEnd|bottomStart|bottomEnd|size|cornerRadius)\s*=\s*(4|6|8|12|16|20|24|999|9999)\.dp" \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/ --include="*.kt" | wc -l
```

### Out-of-scope verification

`git diff` inspection confirms **0** modifications to `.frame(...)`,
`Icon(..., size:)`, `Modifier.size(...)`, `.padding(...)`, or any
non-radius construct. The only diff lines mention `RoundedRectangle`,
`UnevenRoundedRectangle`, `RoundedCornerShape`, or `cornerRadius` /
`<edge>Radius` kwargs.

### Snapshot tests

`Radii.xs/.sm/.md/.lg/.xl/.xl2/.xl3/.pill` resolve at runtime to the
same `CGFloat`/`Dp` values as the literals they replaced (per
`Core/Design/Radii.swift` and `ui/theme/Radii.kt`). The rendered pixel
output is identical.

---

## Off-scale entries (DESIGN REVIEW)

Per-file enumeration of every remaining off-scale literal. Each entry
carries a heuristic component-role hint (button / card / input / pill /
shimmer / etc.) to help the design conversation about whether to extend
the ramp or accept the bespoke value.

Per the system README, the design rules are:

- **Buttons:** 12 (lg) or 16 (xl).
- **Cards:** 16 (xl) or 20 (xl2).
- **Inputs:** 8 (md).
- **Chips / pills:** 9999 (pill).

Off-scale values flagged below imply either (a) a design intent that
doesn't fit those four rules, or (b) drift from the design pack worth
reconciling.


## iOS — off-scale radii

**31 files**, 138 off-scale occurrences.

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/AudienceProfileView.swift`** (7; values: 10×3, 14×3, 22×1)
- L122: `22` in `cornerRadius: N` (shimmer/loading) — off-scale, design review
- L124: `14` in `cornerRadius: N` (shimmer/loading) — off-scale, design review
- L606: `14` in `cornerRadius: N` (container) — off-scale, design review
- L609: `14` in `cornerRadius: N` (container) — off-scale, design review
- L623: `10` in `cornerRadius: N` (container) — off-scale, design review
- L951: `10` in `cornerRadius: N` (container) — off-scale, design review
- L954: `10` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/BroadcastDetail/BroadcastDetailView.swift`** (1; values: 2×1)
- L320: `2` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/AudienceProfile/EditPersona/EditPersonaView.swift`** (1; values: 2×1)
- L1087: `2` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/BusinessProfile/BusinessProfileView.swift`** (1; values: 36×1)
- L749: `36` in `cornerRadius: N` (shimmer/loading) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/CeremonialMail/CeremonialMailWizardView.swift`** (14; values: 10×14)
- L122: `10` in `cornerRadius: N` (container) — off-scale, design review
- L125: `10` in `cornerRadius: N` (container) — off-scale, design review
- L163: `10` in `cornerRadius: N` (container) — off-scale, design review
- L166: `10` in `cornerRadius: N` (container) — off-scale, design review
- L190: `10` in `cornerRadius: N` (container) — off-scale, design review
- L193: `10` in `cornerRadius: N` (container) — off-scale, design review
- L225: `10` in `cornerRadius: N` (container) — off-scale, design review
- L228: `10` in `cornerRadius: N` (container) — off-scale, design review
- L329: `10` in `cornerRadius: N` (container) — off-scale, design review
- L332: `10` in `cornerRadius: N` (container) — off-scale, design review
- _…4 more in this file_

**`frontend/apps/ios/Pantopus/Features/CeremonialMailOpen/CeremonialMailOpenView.swift`** (10; values: 3×1, 9×2, 14×3, 18×4)
- L82: `18` in `cornerRadius: N` (shimmer/loading) — off-scale, design review
- L83: `18` in `cornerRadius: N` (shimmer/loading) — off-scale, design review
- L84: `14` in `cornerRadius: N` (shimmer/loading) — off-scale, design review
- L382: `3` in `cornerRadius: N` (container) — off-scale, design review
- L1009: `14` in `cornerRadius: N` (container) — off-scale, design review
- L1012: `14` in `cornerRadius: N` (container) — off-scale, design review
- L1064: `18` in `cornerRadius: N` (container) — off-scale, design review
- L1067: `18` in `cornerRadius: N` (container) — off-scale, design review
- L1119: `9` in `cornerRadius: N` (container) — off-scale, design review
- L1122: `9` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Chat/ChatListView.swift`** (2; values: 2×1, 22×1)
- L284: `2` in `cornerRadius: N` (container) — off-scale, design review
- L300: `22` in `cornerRadius: N` (shimmer/loading) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Chat/ConversationRow.swift`** (4; values: 0×2, 2×2)
- L38: `0` in `<edge>Radius: N` (container) — off-scale, design review
- L39: `0` in `<edge>Radius: N` (container) — off-scale, design review
- L40: `2` in `<edge>Radius: N` (container) — off-scale, design review
- L41: `2` in `<edge>Radius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Chat/NewMessage/NewMessageView.swift`** (1; values: 19×1)
- L147: `19` in `cornerRadius: N` (shimmer/loading) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Compose/ListingCompose/ListingComposePhotoStep.swift`** (4; values: 14×2, 18×1, 28×1)
- L282: `28` in `cornerRadius: N` (container) — off-scale, design review
- L286: `18` in `cornerRadius: N` (container) — off-scale, design review
- L291: `14` in `cornerRadius: N` (container) — off-scale, design review
- L295: `14` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Compose/ListingCompose/SuggestionsBanner.swift`** (2; values: 10×1, 14×1)
- L160: `10` in `cornerRadius: N` (container) — off-scale, design review
- L163: `14` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/ContentDetail/TransactionalDetailShell.swift`** (6; values: 10×4, 14×2)
- L417: `14` in `cornerRadius: N` (container) — off-scale, design review
- L420: `14` in `cornerRadius: N` (container) — off-scale, design review
- L471: `10` in `cornerRadius: N` (container) — off-scale, design review
- L474: `10` in `cornerRadius: N` (container) — off-scale, design review
- L496: `10` in `cornerRadius: N` (container) — off-scale, design review
- L512: `10` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/CreatorInbox/CreatorInboxView.swift`** (2; values: 14×2)
- L293: `14` in `cornerRadius: N` (container) — off-scale, design review
- L296: `14` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Explore/ExploreMapView.swift`** (7; values: 1×1, 10×1, 14×4, 22×1)
- L268: `1` in `cornerRadius: N` (container) — off-scale, design review
- L343: `22` in `cornerRadius: N` (container) — off-scale, design review
- L789: `14` in `cornerRadius: N` (container) — off-scale, design review
- L792: `14` in `cornerRadius: N` (container) — off-scale, design review
- L868: `10` in `cornerRadius: N` (container) — off-scale, design review
- L887: `14` in `cornerRadius: N` (container) — off-scale, design review
- L890: `14` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Gigs/TasksMap/TasksMapView.swift`** (3; values: 10×1, 14×2)
- L420: `10` in `cornerRadius: N` (container) — off-scale, design review
- L461: `14` in `cornerRadius: N` (container) — off-scale, design review
- L464: `14` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/MailDetailView.swift`** (2; values: 14×2)
- L512: `14` in `cornerRadius: N` (container) — off-scale, design review
- L518: `14` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/BookletDetailLayout.swift`** (1; values: 14×1)
- L143: `14` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CertifiedDetailLayout.swift`** (6; values: 10×4, 14×2)
- L328: `14` in `cornerRadius: N` (container) — off-scale, design review
- L334: `14` in `cornerRadius: N` (container) — off-scale, design review
- L536: `10` in `cornerRadius: N` (container) — off-scale, design review
- L539: `10` in `cornerRadius: N` (container) — off-scale, design review
- L558: `10` in `cornerRadius: N` (container) — off-scale, design review
- L561: `10` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailDetail/Variants/CommunityDetailLayout.swift`** (15; values: 10×13, 14×2)
- L281: `10` in `cornerRadius: N` (container) — off-scale, design review
- L284: `10` in `cornerRadius: N` (container) — off-scale, design review
- L510: `10` in `cornerRadius: N` (container) — off-scale, design review
- L513: `10` in `cornerRadius: N` (container) — off-scale, design review
- L533: `10` in `cornerRadius: N` (container) — off-scale, design review
- L536: `10` in `cornerRadius: N` (container) — off-scale, design review
- L571: `10` in `cornerRadius: N` (container) — off-scale, design review
- L574: `10` in `cornerRadius: N` (container) — off-scale, design review
- L603: `10` in `cornerRadius: N` (container) — off-scale, design review
- L606: `10` in `cornerRadius: N` (container) — off-scale, design review
- _…5 more in this file_

**`frontend/apps/ios/Pantopus/Features/Mailbox/MailboxMap/MailboxMapView.swift`** (14; values: 1×1, 2×1, 10×7, 14×3, 22×2)
- L246: `2` in `cornerRadius: N` (container) — off-scale, design review
- L293: `22` in `cornerRadius: N` (container) — off-scale, design review
- L507: `22` in `cornerRadius: N` (container) — off-scale, design review
- L614: `10` in `cornerRadius: N` (container) — off-scale, design review
- L617: `10` in `cornerRadius: N` (container) — off-scale, design review
- L668: `14` in `cornerRadius: N` (container) — off-scale, design review
- L747: `10` in `cornerRadius: N` (container) — off-scale, design review
- L754: `1` in `cornerRadius: N` (container) — off-scale, design review
- L968: `10` in `cornerRadius: N` (container) — off-scale, design review
- L971: `10` in `cornerRadius: N` (container) — off-scale, design review
- _…4 more in this file_

**`frontend/apps/ios/Pantopus/Features/Marketplace/MarketplaceView.swift`** (5; values: 0×1, 14×4)
- L335: `14` in `cornerRadius: N` (container) — off-scale, design review
- L338: `14` in `cornerRadius: N` (container) — off-scale, design review
- L388: `0` in `cornerRadius: N` (shimmer/loading) — off-scale, design review
- L403: `14` in `cornerRadius: N` (container) — off-scale, design review
- L406: `14` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Nearby/NearbyMapView.swift`** (5; values: 10×2, 14×2, 22×1)
- L274: `22` in `cornerRadius: N` (container) — off-scale, design review
- L560: `10` in `cornerRadius: N` (container) — off-scale, design review
- L605: `14` in `cornerRadius: N` (container) — off-scale, design review
- L608: `14` in `cornerRadius: N` (container) — off-scale, design review
- L625: `10` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/PrivacyHandshake/PrivacyHandshakeWizardView.swift`** (7; values: 10×4, 14×3)
- L97: `14` in `cornerRadius: N` (container) — off-scale, design review
- L100: `14` in `cornerRadius: N` (container) — off-scale, design review
- L144: `10` in `cornerRadius: N` (container) — off-scale, design review
- L150: `10` in `cornerRadius: N` (container) — off-scale, design review
- L214: `10` in `cornerRadius: N` (container) — off-scale, design review
- L360: `14` in `cornerRadius: N` (shimmer/loading) — off-scale, design review
- L361: `10` in `cornerRadius: N` (shimmer/loading) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Profile/PublicProfileView.swift`** (1; values: 36×1)
- L198: `36` in `cornerRadius: N` (shimmer/loading) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Settings/About/AboutView.swift`** (1; values: 22×1)
- L33: `22` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/Identity/IdentitySwitcherSheet.swift`** (2; values: 14×2)
- L146: `14` in `cornerRadius: N` (container) — off-scale, design review
- L149: `14` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/ListOfRows/ListOfRowsView.swift`** (1; values: 11×1)
- L1105: `11` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridPreview.swift`** (4; values: 10×2, 14×2)
- L326: `10` in `cornerRadius: N` (container) — off-scale, design review
- L346: `14` in `cornerRadius: N` (container) — off-scale, design review
- L349: `14` in `cornerRadius: N` (container) — off-scale, design review
- L361: `10` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Shared/MapListHybrid/MapListHybridShell.swift`** (1; values: 22×1)
- L207: `22` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/Status/StatusWaitingView.swift`** (2; values: 10×2)
- L196: `10` in `cornerRadius: N` (container) — off-scale, design review
- L211: `10` in `cornerRadius: N` (container) — off-scale, design review

**`frontend/apps/ios/Pantopus/Features/TokenAccept/TokenAcceptView.swift`** (6; values: 10×3, 14×3)
- L125: `14` in `cornerRadius: N` (container) — off-scale, design review
- L128: `14` in `cornerRadius: N` (container) — off-scale, design review
- L210: `10` in `cornerRadius: N` (container) — off-scale, design review
- L241: `10` in `cornerRadius: N` (container) — off-scale, design review
- L260: `10` in `cornerRadius: N` (container) — off-scale, design review
- L276: `14` in `cornerRadius: N` (shimmer/loading) — off-scale, design review


## Android — off-scale radii

**134 files**, 775 off-scale occurrences.

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/AvatarWithIdentityRing.kt`** (1; values: 56×1)
- L142: `56` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/DataRow.kt`** (1; values: 14×1)
- L118: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/EmptyState.kt`** (1; values: 32×1)
- L72: `32` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/OfflineBanner.kt`** (1; values: 18×1)
- L65: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/PantopusCheckbox.kt`** (1; values: 14×1)
- L90: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/PantopusTextField.kt`** (2; values: 18×2)
- L172: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L179: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/PersonaCard.kt`** (1; values: 9×1)
- L185: `9` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/SectionHeader.kt`** (1; values: 14×1)
- L75: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/StatusChip.kt`** (1; values: 14×1)
- L71: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/VerifiedBadge.kt`** (1; values: 28×1)
- L61: `28` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/_internal/ComponentGalleryScreen.kt`** (2; values: 28×1, 56×1)
- L155: `56` in `<corner> = N.dp` (pill) — off-scale, design review
- L166: `28` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/_internal/IconGalleryScreen.kt`** (1; values: 28×1)
- L72: `28` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/AudienceProfileScreen.kt`** (27; values: 9×1, 10×3, 11×1, 13×2, 14×8, 15×3, 22×3, 30×1, 32×4, 40×1)
- L210: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L244: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L295: `22` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L296: `14` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L338: `30` in `<corner> = N.dp` (container) — off-scale, design review
- L377: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L456: `40` in `<corner> = N.dp` (container) — off-scale, design review
- L593: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L906: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L928: `14` in `<corner> = N.dp` (container) — off-scale, design review
- _…17 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/broadcast_detail/BroadcastDetailScreen.kt`** (9; values: 2×1, 11×1, 14×2, 22×2, 28×2, 40×1)
- L113: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L139: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L186: `40` in `<corner> = N.dp` (container) — off-scale, design review
- L293: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L323: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L511: `2` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L604: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L750: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L790: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/compose_broadcast/ComposeBroadcastScreen.kt`** (15; values: 9×1, 11×5, 14×4, 15×1, 18×1, 19×1, 22×1, 28×1)
- L222: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L413: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L434: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L454: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L537: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L550: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L588: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L609: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L684: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L733: `11` in `<corner> = N.dp` (container) — off-scale, design review
- _…5 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/audience_profile/edit_persona/EditPersonaScreen.kt`** (16; values: 2×1, 3×1, 10×2, 11×2, 13×3, 14×1, 15×3, 18×1, 19×1, 40×1)
- L169: `40` in `<corner> = N.dp` (container) — off-scale, design review
- L299: `19` in `<corner> = N.dp` (container) — off-scale, design review
- L390: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L428: `3` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L515: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L594: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L689: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L815: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L914: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L965: `10` in `<corner> = N.dp` (container) — off-scale, design review
- _…6 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/LoginScreen.kt`** (1; values: 48×1)
- L246: `48` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/auth_error/AuthErrorScreen.kt`** (1; values: 56×1)
- L73: `56` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/forgot_password/ForgotPasswordScreen.kt`** (1; values: 22×1)
- L121: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/reset_password/ResetPasswordScreen.kt`** (1; values: 22×1)
- L132: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/sign_up/SignUpScreen.kt`** (3; values: 3×1, 11×1, 18×1)
- L386: `3` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L626: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L656: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/auth/verify_email/VerifyEmailScreen.kt`** (1; values: 80×1)
- L128: `80` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/business_profile/BusinessProfileScreen.kt`** (8; values: 14×1, 18×2, 28×1, 32×1, 36×1, 40×1, 72×1)
- L271: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L316: `72` in `<corner> = N.dp` (container) — off-scale, design review
- L587: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L636: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L650: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L796: `40` in `<corner> = N.dp` (container) — off-scale, design review
- L977: `36` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L1056: `32` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/businesses/BusinessWaitlistScreen.kt`** (2; values: 22×1, 32×1)
- L69: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L128: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail/CeremonialMailWizardScreen.kt`** (15; values: 10×10, 14×3, 18×1, 56×1)
- L134: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L189: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L191: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L225: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L254: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L256: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L269: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L298: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L303: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L420: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- _…5 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt`** (21; values: 3×1, 9×2, 11×1, 13×2, 14×6, 15×2, 18×5, 22×1, 36×1)
- L204: `18` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L205: `18` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L206: `14` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L230: `36` in `<corner> = N.dp` (container) — off-scale, design review
- L284: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L375: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L506: `3` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L624: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L696: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L881: `13` in `<corner> = N.dp` (container) — off-scale, design review
- _…11 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/compose/gig/GigComposeMagic.kt`** (9; values: 11×1, 13×1, 14×3, 15×2, 17×1, 18×1)
- L179: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L215: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L262: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L295: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L370: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L386: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L517: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L531: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L563: `17` in `<corner> = N.dp` (tile) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/compose/gig/GigComposeWizardScreen.kt`** (6; values: 14×1, 18×3, 22×2)
- L255: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L262: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L282: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L403: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L415: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L650: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/compose/listing/ListingComposeWizardScreen.kt`** (16; values: 9×1, 10×1, 11×2, 13×1, 14×5, 15×1, 18×3, 28×1, 32×1)
- L485: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L561: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L608: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L702: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L797: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L840: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L868: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L966: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L990: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L1022: `14` in `<corner> = N.dp` (container) — off-scale, design review
- _…6 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/compose/pulse/PulseComposeScreen.kt`** (4; values: 10×1, 14×1, 18×1, 28×1)
- L360: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L577: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L804: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L834: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/ContentDetailShell.kt`** (18; values: 5×1, 9×1, 10×5, 11×1, 13×1, 14×4, 15×1, 36×1, 40×1, 44×1, 56×1)
- L131: `40` in `<corner> = N.dp` (container) — off-scale, design review
- L321: `56` in `<corner> = N.dp` (container) — off-scale, design review
- L337: `5` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L472: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L533: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L535: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L541: `44` in `<corner> = N.dp` (avatar) — off-scale, design review
- L554: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L583: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L634: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- _…8 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/InvoiceDetailScreen.kt`** (1; values: 36×1)
- L79: `36` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/creator_inbox/CreatorInboxScreen.kt`** (22; values: 0×5, 9×2, 11×2, 14×5, 15×1, 19×2, 22×2, 32×1, 38×1, 40×1)
- L140: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L173: `19` in `<corner> = N.dp` (container) — off-scale, design review
- L185: `19` in `<corner> = N.dp` (container) — off-scale, design review
- L209: `22` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L231: `40` in `<corner> = N.dp` (container) — off-scale, design review
- L301: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L479: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L543: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L544: `0` in `<corner> = N.dp` (container) — off-scale, design review
- L544: `0` in `<corner> = N.dp` (container) — off-scale, design review
- _…12 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/discoverhub/DiscoverHubScreen.kt`** (10; values: 11×2, 13×4, 18×1, 22×1, 28×1, 32×1)
- L331: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L448: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L475: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L657: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L691: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L774: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L865: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L925: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L975: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L1002: `28` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/explore/ExploreMapScreen.kt`** (19; values: 5×1, 10×1, 13×3, 14×6, 18×1, 22×4, 28×1, 44×1, 48×1)
- L384: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L541: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L583: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L762: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L762: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L764: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L764: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L1001: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L1072: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L1077: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- _…9 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/FeedScreen.kt`** (5; values: 13×1, 15×1, 22×1, 32×1, 40×1)
- L126: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L189: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L225: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L251: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L304: `40` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/feed/pulse/PulsePostCard.kt`** (4; values: 10×2, 22×1, 32×1)
- L131: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L188: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L216: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L333: `10` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/GigsFeedScreen.kt`** (11; values: 9×1, 11×2, 13×2, 14×1, 15×1, 17×1, 22×1, 32×1, 40×1)
- L158: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L220: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L252: `17` in `<corner> = N.dp` (container) — off-scale, design review
- L346: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L390: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L446: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L481: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L519: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L636: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L685: `9` in `<corner> = N.dp` (container) — off-scale, design review
- _…1 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/quickpost/PostGigV1Screen.kt`** (7; values: 11×2, 14×2, 18×1, 28×1, 30×1)
- L490: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L588: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L693: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L721: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L756: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L814: `30` in `<corner> = N.dp` (container) — off-scale, design review
- L872: `28` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/gigs/tasks_map/TasksMapScreen.kt`** (13; values: 10×2, 13×1, 14×6, 18×2, 22×1, 28×1)
- L177: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L295: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L471: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L472: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L477: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L489: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L496: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L588: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L590: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L599: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- _…3 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/handshake/PrivacyHandshakeScreen.kt`** (8; values: 10×2, 14×3, 36×3)
- L93: `14` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L94: `10` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L112: `36` in `<corner> = N.dp` (container) — off-scale, design review
- L181: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L183: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L340: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L530: `36` in `<corner> = N.dp` (container) — off-scale, design review
- L563: `36` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/HomeDashboardScreen.kt`** (5; values: 14×1, 18×3, 22×1)
- L415: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L452: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L562: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L614: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L903: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/accesscodes/AccessCodesScreen.kt`** (1; values: 14×1)
- L146: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/accesscodes/EditAccessCodeFormScreen.kt`** (2; values: 18×2)
- L399: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L415: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/add_home/AddHomeWizardScreen.kt`** (10; values: 10×1, 14×5, 15×1, 18×3)
- L502: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L547: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L782: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L820: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L933: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L1027: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L1080: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L1097: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L1236: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L1401: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/bills/AddBillWizardScreen.kt`** (3; values: 14×1, 18×1, 32×1)
- L277: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L357: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L404: `32` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/bills/BillDetailScreen.kt`** (1; values: 11×1)
- L331: `11` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/calendar/AddEventFormScreen.kt`** (4; values: 14×2, 18×2)
- L312: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L563: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L655: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L776: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/calendar/EventDetailScreen.kt`** (1; values: 10×1)
- L346: `10` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/calendar/MonthStripHeader.kt`** (1; values: 14×1)
- L177: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/claim_ownership/ClaimOwnershipWizardScreen.kt`** (5; values: 11×1, 13×1, 15×2, 18×1)
- L194: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L234: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L295: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L338: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L517: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/documents/DocumentDetailScreen.kt`** (3; values: 14×1, 18×1, 32×1)
- L223: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L493: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L758: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/documents/UploadDocumentFormScreen.kt`** (3; values: 10×1, 28×1, 32×1)
- L240: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L535: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L837: `32` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/emergency/AddEmergencyInfoFormScreen.kt`** (1; values: 14×1)
- L253: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/emergency/EmergencyInfoDetailScreen.kt`** (1; values: 14×1)
- L357: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/guests/AddGuestFormScreen.kt`** (2; values: 11×1, 15×1)
- L232: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L302: `15` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/invite_owner/InviteOwnerFormScreen.kt`** (2; values: 14×1, 15×1)
- L410: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L571: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/maintenance/LogMaintenanceFormScreen.kt`** (7; values: 14×1, 18×4, 22×1, 28×1)
- L455: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L606: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L883: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L901: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L977: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L1006: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L1026: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/maintenance/MaintenanceDetailScreen.kt`** (2; values: 18×1, 28×1)
- L437: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L480: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/members/InviteMemberWizardSheet.kt`** (2; values: 18×1, 22×1)
- L217: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L390: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/packages/PackageDetailScreen.kt`** (1; values: 22×1)
- L255: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/pets/AddPetWizardSheet.kt`** (2; values: 18×1, 22×1)
- L229: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L334: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/polls/PollResultBar.kt`** (1; values: 14×1)
- L107: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/polls/StartPollFormScreen.kt`** (4; values: 14×1, 18×3)
- L267: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L330: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L558: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L615: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/property_details/PropertyDetailsScreen.kt`** (2; values: 13×1, 15×1)
- L300: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L441: `15` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/tasks/AddHouseholdTaskFormScreen.kt`** (2; values: 14×2)
- L326: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L504: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/hub/sections/HubSections.kt`** (10; values: 10×1, 13×2, 14×2, 15×1, 17×2, 26×1, 32×1)
- L251: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L298: `26` in `<corner> = N.dp` (container) — off-scale, design review
- L320: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L371: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L528: `17` in `<corner> = N.dp` (container) — off-scale, design review
- L615: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L691: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L785: `17` in `<corner> = N.dp` (container) — off-scale, design review
- L869: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L920: `15` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/hub/today/TodayDetailScreen.kt`** (5; values: 13×1, 15×1, 18×1, 22×1, 30×1)
- L202: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L327: `30` in `<corner> = N.dp` (container) — off-scale, design review
- L547: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L620: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L643: `13` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/identity_center/IdentityCenterScreen.kt`** (4; values: 18×1, 22×2, 40×1)
- L150: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L290: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L511: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L597: `40` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ChatListScreen.kt`** (6; values: 13×1, 15×1, 17×1, 22×1, 30×1, 40×1)
- L155: `17` in `<corner> = N.dp` (container) — off-scale, design review
- L286: `22` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L317: `30` in `<corner> = N.dp` (container) — off-scale, design review
- L350: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L376: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L418: `40` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/chat/ConversationRow.kt`** (5; values: 9×1, 32×2, 44×2)
- L93: `44` in `<corner> = N.dp` (avatar) — off-scale, design review
- L105: `44` in `<corner> = N.dp` (container) — off-scale, design review
- L121: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L137: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L142: `32` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/conversation/ChatConversationScreen.kt`** (40; values: 7×2, 9×4, 10×3, 11×9, 13×3, 14×3, 15×2, 17×1, 18×4, 22×1, 32×6, 40×1, 64×1)
- L414: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L456: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L514: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L552: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L591: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L651: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L663: `32` in `<corner> = N.dp` (avatar) — off-scale, design review
- L664: `32` in `<corner> = N.dp` (avatar) — off-scale, design review
- L670: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L678: `32` in `<corner> = N.dp` (container) — off-scale, design review
- _…30 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/conversation/ai/AiComponents.kt`** (1; values: 13×1)
- L87: `13` in `<corner> = N.dp` (chip) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/inbox/newmessage/NewMessageScreen.kt`** (8; values: 10×3, 14×1, 15×1, 28×1, 32×1, 40×1)
- L238: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L368: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L411: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L439: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L496: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L613: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L634: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L720: `40` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/disambiguate/DisambiguateMailFormScreen.kt`** (2; values: 28×1, 36×1)
- L203: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L272: `36` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/MailboxItemDetailShell.kt`** (3; values: 14×2, 36×1)
- L232: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L261: `36` in `<corner> = N.dp` (container) — off-scale, design review
- L338: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/CategoryBodies.kt`** (7; values: 11×1, 13×2, 14×3, 15×1)
- L170: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L271: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L338: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L363: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L380: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L458: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L485: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/CommunityBody.kt`** (10; values: 7×1, 9×1, 11×1, 13×1, 14×3, 18×2, 26×1)
- L174: `26` in `<corner> = N.dp` (container) — off-scale, design review
- L187: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L244: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L263: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L415: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L542: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L696: `7` in `<corner> = N.dp` (container) — off-scale, design review
- L757: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L812: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L905: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/CouponBody.kt`** (5; values: 15×1, 18×4)
- L189: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L207: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L253: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L302: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L379: `15` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/GigBody.kt`** (1; values: 14×1)
- L213: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/MemoryBody.kt`** (7; values: 10×1, 11×3, 13×3)
- L165: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L214: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L258: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L355: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L438: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L466: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L550: `13` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/BidderProfileCard.kt`** (3; values: 9×1, 13×2)
- L128: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L170: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L276: `13` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/BookletPageSwiper.kt`** (1; values: 22×1)
- L174: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CertifiedConfirmGate.kt`** (2; values: 14×1, 22×1)
- L154: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L279: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CertifiedTermsSheet.kt`** (3; values: 13×2, 18×1)
- L166: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L220: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L238: `13` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/CouponHero.kt`** (4; values: 10×1, 13×1, 15×1, 22×1)
- L180: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L320: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L342: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L408: `15` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/OtherBidsStrip.kt`** (1; values: 9×1)
- L120: `9` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/PolaroidFrame.kt`** (1; values: 32×1)
- L127: `32` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/item_detail/bodies/components/PostSummaryCard.kt`** (5; values: 9×1, 11×2, 13×1, 22×1)
- L91: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L142: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L159: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L184: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L205: `13` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/MailDetailScreen.kt`** (9; values: 9×2, 10×1, 11×1, 13×1, 14×3, 17×1)
- L403: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L441: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L462: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L523: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L550: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L609: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L708: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L715: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L779: `17` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/BookletPager.kt`** (4; values: 2×2, 10×1, 14×1)
- L284: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L302: `2` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L311: `2` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L489: `10` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/components/CertifiedComponents.kt`** (4; values: 9×2, 14×1, 18×1)
- L245: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L287: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L317: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L393: `9` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/BookletDetailLayout.kt`** (5; values: 11×1, 13×1, 14×2, 17×1)
- L231: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L287: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L377: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L392: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L452: `17` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CertifiedDetailLayout.kt`** (11; values: 10×4, 11×2, 13×2, 14×2, 15×1)
- L494: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L496: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L512: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L531: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L533: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L549: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L577: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L604: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L830: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L834: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- _…1 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mail_detail/variants/CommunityDetailLayout.kt`** (32; values: 7×1, 9×1, 10×13, 11×6, 13×3, 14×5, 18×2, 26×1)
- L310: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L312: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L329: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L356: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L402: `26` in `<corner> = N.dp` (container) — off-scale, design review
- L420: `9` in `<corner> = N.dp` (container) — off-scale, design review
- L469: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L492: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L617: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L638: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- _…22 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mailbox/mailbox_map/MailboxMapScreen.kt`** (29; values: 0×1, 2×1, 10×5, 11×2, 13×3, 14×3, 18×1, 22×8, 28×1, 44×3, 48×1)
- L249: `0` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L485: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L541: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L560: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L633: `2` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L677: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L677: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L679: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L679: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L775: `14` in `<corner> = N.dp` (container) — off-scale, design review
- _…19 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/marketplace/MarketplaceScreen.kt`** (13; values: 13×1, 14×5, 15×1, 17×1, 22×2, 32×1, 34×1, 40×1)
- L144: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L181: `17` in `<corner> = N.dp` (container) — off-scale, design review
- L223: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L295: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L342: `32` in `<corner> = N.dp` (container) — off-scale, design review
- L380: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L418: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L467: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L469: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L532: `34` in `<corner> = N.dp` (container) — off-scale, design review
- _…3 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/membership/MembershipDetailScreen.kt`** (11; values: 10×1, 13×3, 14×2, 15×1, 17×2, 22×1, 40×1)
- L131: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L204: `40` in `<corner> = N.dp` (container) — off-scale, design review
- L330: `17` in `<corner> = N.dp` (container) — off-scale, design review
- L369: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L519: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L566: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L585: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L655: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L668: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L708: `17` in `<corner> = N.dp` (container) — off-scale, design review
- _…1 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/my_bids/LeaveReviewSheet.kt`** (1; values: 32×1)
- L203: `32` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/my_bids/MyBidsScreen.kt`** (1; values: 18×1)
- L325: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/my_posts/MyPostsScreen.kt`** (1; values: 18×1)
- L257: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/nearby/map/NearbyMapScreen.kt`** (14; values: 5×1, 10×2, 13×1, 14×3, 18×1, 22×5, 28×1)
- L453: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L620: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L620: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L622: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L622: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L822: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L867: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L938: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L943: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L945: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- _…4 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/EditProfileScreen.kt`** (2; values: 13×1, 15×1)
- L655: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L754: `15` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileChrome.kt`** (7; values: 10×2, 11×1, 13×3, 18×1)
- L168: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L232: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L285: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L318: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L344: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L353: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L362: `13` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileNeighbor.kt`** (9; values: 11×4, 14×1, 22×1, 28×1, 32×1, 72×1)
- L333: `72` in `<corner> = N.dp` (avatar) — off-scale, design review
- L350: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L428: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L608: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L681: `32` in `<corner> = N.dp` (card) — off-scale, design review
- L728: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L759: `28` in `<corner> = N.dp` (avatar) — off-scale, design review
- L820: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L828: `11` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileScreen.kt`** (1; values: 36×1)
- L321: `36` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/profile/professional/ProfessionalProfileScreen.kt`** (12; values: 11×3, 13×1, 14×2, 15×3, 18×2, 22×1)
- L239: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L289: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L558: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L664: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L724: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L819: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L846: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L906: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L960: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L1014: `13` in `<corner> = N.dp` (container) — off-scale, design review
- _…2 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/review_claims/ReviewClaimDetailScreen.kt`** (2; values: 18×1, 22×1)
- L820: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L922: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/root/PantopusBottomBar.kt`** (1; values: 22×1)
- L128: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/settings/about/AboutScreen.kt`** (1; values: 22×1)
- L54: `22` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/CTAs.kt`** (2; values: 18×1, 26×1)
- L80: `26` in `<corner> = N.dp` (container) — off-scale, design review
- L144: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/ContentDetailShell.kt`** (2; values: 22×2)
- L122: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L153: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/Headers.kt`** (1; values: 14×1)
- L66: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/BodyReactionsBody.kt`** (7; values: 11×1, 13×1, 14×1, 18×1, 22×2, 28×1)
- L272: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L328: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L385: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L427: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L470: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L586: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L641: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/bodies/StatsTabsBody.kt`** (1; values: 40×1)
- L394: `40` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/headers/PostAuthorHeader.kt`** (1; values: 44×1)
- L122: `44` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/content_detail/headers/ProfileHeader.kt`** (2; values: 28×1, 72×1)
- L109: `72` in `<corner> = N.dp` (container) — off-scale, design review
- L118: `28` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/form/FormShell.kt`** (1; values: 22×1)
- L276: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/grouped_list/GroupedListScreen.kt`** (4; values: 2×2, 22×1, 40×1)
- L120: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L519: `2` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L529: `2` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L587: `40` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/identity/IdentitySwitcherPillRow.kt`** (1; values: 11×1)
- L89: `11` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/identity/IdentitySwitcherSheet.kt`** (3; values: 14×2, 22×1)
- L124: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L129: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L148: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/list_of_rows/ListOfRowsScreen.kt`** (22; values: 9×1, 10×1, 11×5, 13×3, 14×2, 15×1, 17×1, 18×2, 19×1, 22×3, 28×1, 40×1)
- L502: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L572: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L628: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L656: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L955: `40` in `<corner> = N.dp` (container) — off-scale, design review
- L1159: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L1187: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L1242: `19` in `<corner> = N.dp` (container) — off-scale, design review
- L1285: `11` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L1296: `22` in `<corner> = N.dp` (container) — off-scale, design review
- _…12 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/mail_item_detail/MailItemDetailShell.kt`** (7; values: 10×1, 11×1, 13×1, 14×1, 18×2, 22×1)
- L210: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L284: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L313: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L397: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L440: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L489: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L608: `14` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridPreview.kt`** (12; values: 10×2, 13×1, 14×3, 18×1, 22×5)
- L124: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L124: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L126: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L126: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L189: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L372: `13` in `<corner> = N.dp` (container) — off-scale, design review
- L425: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L430: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L432: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L441: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- _…2 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/map_list_hybrid/MapListHybridShell.kt`** (4; values: 22×4)
- L318: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L318: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L320: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L320: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/search_list/SearchListShell.kt`** (2; values: 18×1, 22×1)
- L262: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L374: `18` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/WizardShell.kt`** (1; values: 22×1)
- L191: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/blocks/SuccessHeroBlock.kt`** (1; values: 48×1)
- L61: `48` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/blocks/TimelineBlock.kt`** (1; values: 10×1)
- L144: `10` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/wizard/blocks/UploadSlotsBlock.kt`** (3; values: 22×2, 28×1)
- L154: `28` in `<corner> = N.dp` (container) — off-scale, design review
- L181: `22` in `<corner> = N.dp` (container) — off-scale, design review
- L238: `22` in `<corner> = N.dp` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/status/StatusWaitingScreen.kt`** (5; values: 10×2, 14×1, 18×1, 64×1)
- L123: `64` in `<corner> = N.dp` (container) — off-scale, design review
- L203: `18` in `<corner> = N.dp` (container) — off-scale, design review
- L257: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L297: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L317: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/support_trains/start_train/StartSupportTrainWizardScreen.kt`** (13; values: 10×3, 14×8, 15×1, 56×1)
- L323: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L357: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L409: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L455: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L513: `15` in `<corner> = N.dp` (container) — off-scale, design review
- L613: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L659: `10` in `<corner> = N.dp` (container) — off-scale, design review
- L739: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L784: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L912: `14` in `<corner> = N.dp` (container) — off-scale, design review
- _…3 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/token_accept/TokenAcceptScreen.kt`** (13; values: 10×3, 14×6, 32×1, 36×3)
- L118: `14` in `cornerRadius = N.dp` (shimmer/loading) — off-scale, design review
- L158: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L160: `14` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L181: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L321: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L342: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L376: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L411: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L429: `10` in `RoundedCornerShape(N.dp)` (container) — off-scale, design review
- L475: `36` in `<corner> = N.dp` (container) — off-scale, design review
- _…3 more in this file_

**`frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/you/me/MeView.kt`** (6; values: 11×2, 14×1, 17×2, 40×1)
- L230: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L299: `11` in `<corner> = N.dp` (container) — off-scale, design review
- L488: `17` in `<corner> = N.dp` (container) — off-scale, design review
- L509: `14` in `<corner> = N.dp` (container) — off-scale, design review
- L557: `17` in `<corner> = N.dp` (container) — off-scale, design review
- L586: `40` in `<corner> = N.dp` (container) — off-scale, design review

