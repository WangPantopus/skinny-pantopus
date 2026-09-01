# T5 — Mobile UI/UX buildout: PR summary

Single-pane summary of every PR that landed for the Tier-5 buildout
(12 designed list screens shipped on iOS + Android + the web reskin,
plus the shared archetype extension that made them possible). PRs are
listed in landing order; each row carries the canonical title, the
scope, the file-touch count and test-file count from the merge
commit, and the parity-audit row delta the PR introduced or updated.

## Reference docs

- **Plan of record:** [`docs/t5-buildout-plan.md`](../t5-buildout-plan.md)
- **Conventions:** [`docs/mobile/pantopus-t5-notes.md`](../mobile/pantopus-t5-notes.md)
- **Definition of Done:** [`docs/mobile-screen-definition-of-done.md`](../mobile-screen-definition-of-done.md)
- **Parity audit (live):** [`docs/mobile-parity-audit.md`](../mobile-parity-audit.md)
- **Wiring audit (live):** [`docs/mobile-wiring-audit.md`](../mobile-wiring-audit.md)
- **Lint reports:** [`docs/lint-reports/`](../lint-reports/)

## PR sequence

PR ordering reflects landing order. P-numbers match the buildout-plan
prerequisite/screen plan; T-numbers are the canonical scope IDs used
in commit messages.

| # | Commit | T-id / P-id | Title | Files | Test files | Parity-audit delta |
|---|---|---|---|---|---|---|
| 1 | `ef956a1` | T5.0 (P1) | Archetype evolution: extend `ListOfRows` for all 12 design row shapes | 27 | 3 | Added §"T5.0 archetype evolution" preamble enumerating all additive surfaces (`RowLeading` extensions, `RowTrailing` extensions, `RowSection.{count,onSeeAll,style}`, `FABAction.Variant`, `searchBar/chipStrip/banner` slots, new `primary25` theme token, `CompactButton` + `BidderStack` primitives, web `<ListOfRowsShell />` mirror). |
| 2 | `25f24bf` | T5.1 (P5) | Notifications V2 (canary): iOS + Android + web | 27 | 3 | Updated existing Notifications row to **Notifications V2 (T5.1)** — 2 tabs (All / Unread), Today/Earlier date sections, 7 type chips, unread-tint highlight, real Hub-bell wiring. Documented the web-divergence (legacy `read` filter + context-filter dropped from mobile per F2/F8). |
| 3 | `2676915` | T5.2.1 (P15) | Pets (iOS + Android + web): list + Add wizard | 33 | 3 | Added **Pets list (T5.2.1)** row in Tier 1: 64pt thumbnail leading + species chip + breed subtitle + notes body + kebab, secondaryCreate FAB, 3-step Wizard on iOS/Android (web keeps single-page modal). |
| 4 | `fe12db4` | T5.2.2 (P13) | Bills — list + detail + Add wizard on iOS, Android, web | 32 | 2 | Added **Bills list (T5.2.2 / P13)**, **Bill detail (T5.2.2)**, and **Add Bill wizard (T5.2.2)** rows: 3 tabs (Upcoming / Paid / All), `amountWithChip` trailing, 4 chip statuses, secondaryCreate FAB; flagged backend gaps (no `DELETE` route, splits read-only). |
| 5 | `e487778` | T5.2.3 (P6) | Connections screen on iOS + Android + web reskin | 29 | 2 | Added **Connections (T5.2.3)** row: 3 tabs (All / Neighbors / Pending), search bar slot, 44pt verified-badge avatars, circularAction message-CTA + verticalActions Accept/Ignore pair, secondaryCreate FAB. Real chat-conversation push from row CTA. Deep link `pantopus://connections`. |
| 6 | `0afddcc` | T5.2.4 (P9) | Offers (cross-listing): iOS + Android + web reskin | 23 | 5 | Added **Offers V2 (T5.2.4)** row: 2 tabs (Received / Sent), priceStack with asking-price sublabel, 8-state status derivation, top-bar filter. Web rewritten on top of `<ListOfRowsShell />`. |
| 7 | `2ceabdb` | T5.3.1 (P7) | My bids on iOS + Android + web reskin | 32 | 4 | Added **My bids (T5.3.1)** row: 4 tabs (Active / Accepted / Rejected / Done), 11-variant status chip, per-tab footer with `CompactButton.footer`, `RowHighlight.muted` (additive), `BannerConfig` summary, extendedNav `"Browse tasks"` pill FAB. Backend-prep gaps noted (`shortlisted` / `your_rank` / `top_price`). |
| 8 | `380ed4d` | T5.3.2 (P8) | My tasks V2 on iOS + Android + web + my-gigs canonicalization | 30 | 2 | Added **My tasks V2 (T5.3.2)** row: 4 tabs (Open / Active / Done / Closed), inline `BidderStack` on the chip line, 9-variant status, per-status footer, 56pt canonicalCreate FAB. Web `my-gigs-v2` route deleted (canonical V2 lives at `/app/my-gigs`). Backend `/my-gigs` now inlines `top_bidders[≤3]` (no N+1). |
| 9 | `ee69506` | T5.3.3 (P14) | My posts on iOS + Android + web reskin | 26 | 3 | Added **My posts (T5.3.3)** row: 2 tabs (Active / Archived), Shape C6 (no leading; intent chip in `headerChips`; primary-emphasis body; engagement strip; kebab → action sheet). New additive shell fields: `RowModel.headerChips`, `RowModel.engagement`, `RowModel.bodyEmphasis = .primary`. Archive / Restore local-only optimistic (no backend route yet — documented). |
| 10 | `810f369` | T5.3.4 (P10) | Listing offers on iOS + Android + web reskin | 27 | 2 | Added **Listing offers (T5.3.4)** row: NO tabs / NO FAB, `ListingContextConfig` hero card (additive shell slot), priceStack with sublabel, 7-state status chip, optional counter pill + italic note, `RowHighlight.leading` amber LEADING badge on top pending row. |
| 11 | `cf8f828` | T5.4.1 (P11) | Discover hub on iOS, Android, web | 25 | 2 | Added **Discover hub (T5.4.1 / P11)** row: 4-chip filter strip, 4 typed `SectionStyle.card` sections (People · Businesses · Gigs · Listings) in design-spec order, per-section `count` + `See all` CTA, mixed leading (avatarWithBadge / categoryGradientIcon / thumbnail), priceStack trailing on Gigs+Listings. First consumer of P1's `RowSection.onSeeAll` + `SectionStyle.card` + `AvatarBadgeSize.Small`. Deep link `pantopus://discover-hub`. |
| 12 | `14a512d` | T5.4.2 (P12) | Discover businesses on iOS + Android + web reskin | 20 | 3 | Added **Discover businesses (T5.4.2 / P12)** row: 9-chip category filter strip (first consumer of `chipStrip` for category filtering), search bar slot, category-grouped `RowSection.card` in chip order when "All" / single section when filtered, 40pt categoryGradientIcon + chevron, two distinct empty states. Two deliberate divergences from the buildout-plan verification line (no FAB, top-bar filter icon vs "search") documented inline. Replaces `(app)/app/discover/page.tsx` legacy rich map/list view (preserved at `(app)/app/map`). |
| 13 | `54430e8` | T5.4.3 (P16) | Review claims (web only) reskin on shared list-of-rows shell | 6 | 0 | Added **Review claims (T5.4.3 / P16)** row in §"Tier 5 — Web-only screens". 3 tabs (Pending / Approved / Rejected), banner above Pending, Shape C row with paperclip evidence chip + 34pt review-claim footer. Mobile deferred per F9 + §1.8 (no admin tier on iOS/Android today). |

### Totals

- **13 PRs** (1 prereq + 12 feature screens; T5.0 + T5.1 through T5.4.3).
- **Files touched:** 357 (sum across the 13 merge commits, with overlap on shared shell files counted per commit).
- **Test files:** 34 (`*ViewModelTests.swift` / `*ViewModelTest.kt` / web `*.test.tsx`). Counts exclude the `T5.4.3` web-only PR which had no fresh test scaffolding because the existing admin page tests cover the projection.
- **CI follow-up fixes:** 5 commits (`c90358f`, `d0953d6`, `a9933a3`, `426ad72`, `4250414`, plus T5.3.1's lint-fix chain `222f166` / `a2173ad` / `d24436e` / `08cd433` / `c0240c1`).

## Parity-audit coverage

Every screen above maps to a row in
[`docs/mobile-parity-audit.md`](../mobile-parity-audit.md) §1. Coverage matrix:

| Screen | iOS view | Android composable | Parity-audit row | 4-state coverage |
|---|---|---|---|---|
| Notifications V2 | `NotificationsView` | `NotificationsScreen` | Tier 1 row 2 | Loading / Loaded / Empty / Error |
| Connections | `ConnectionsView` | `ConnectionsScreen` | Tier 1 row 3 | Loading / Loaded / Empty / Error |
| Bills list | `BillsListView` | `BillsListScreen` | Tier 1 row 14 | Loading / Loaded / Empty / Error |
| Bill detail | `BillDetailView` | `BillDetailScreen` | Tier 1 row 15 | Loading / Loaded / Error |
| Add Bill wizard | `AddBillWizardView` | `AddBillWizardScreen` | Tier 1 row 16 | per-step |
| Pets list | `PetsListView` | `PetsListScreen` | Tier 1 row 7 | Loading / Loaded / Empty / Error |
| Offers V2 | `OffersView` | `OffersScreen` | Tier 2 row 8 | Loading / Loaded / Empty / Error |
| My bids | `MyBidsView` | `MyBidsScreen` | Tier 2 row 9 | Loading / Loaded / Empty / Error |
| My tasks V2 | `MyTasksView` | `MyTasksScreen` | Tier 2 row 10 | Loading / Loaded / Empty / Error |
| My posts | `MyPostsView` | `MyPostsScreen` | Tier 2 row 11 | Loading / Loaded / Empty / Error |
| Listing offers | `ListingOffersView` | `ListingOffersScreen` | Tier 2 row 12 | Loading / Loaded / Empty / Error |
| Discover hub | `DiscoverHubView` | `DiscoverHubScreen` | Tier 2 row 13 | Loading / Loaded / Empty / Error |
| Discover businesses | `DiscoverBusinessesView` | `DiscoverBusinessesScreen` | Tier 2 row 14 | Loading / Loaded / Empty / Error |
| Review claims | (web only) | (web only) | Tier 5 row 1 | Loading / Loaded / Empty / Error |

All rows carry verbatim endpoint paths, root accessibility identifiers /
test tags, and chrome-slot descriptions.

## Outstanding follow-ups (out of scope for T5)

These were called out in PR notes or buildout-plan §F questions and
are tracked separately:

1. **Mobile admin role.** Review claims ships web-only. Mobile lands
   when `me.is_admin` + role-guard infrastructure is added (own tier).
2. **`shortlisted` / `your_rank` / `top_price` on bid DTO.** My bids
   `Top bid` / `Shortlisted` / `Outbid` chips degrade to `Pending` until
   the backend prep PR (P3) lands. Optional decoders are already in
   place — no mobile change needed when the fields appear.
3. **Posts archive endpoints.** My posts Archive / Restore are
   local-only optimistic. `POST /api/posts/:id/archive` + `/unarchive`
   + `GET /api/posts/me?status=archived` are tracked as a backend
   follow-up.
4. **Bills splits write endpoints.** Splits are read-only on the bill
   detail. `POST/PATCH/DELETE /api/homes/:id/bills/:billId/splits` are
   tracked separately.
5. **Bill DELETE handler.** No `DELETE /api/homes/:id/bills/:billId`;
   detail screen soft-deletes via `PUT { status: "cancelled" }`.
6. **`me.home.bills` Me-tab tile wiring.** The Active Home pillar's
   Bills tile (`MeViewModel.homeActionTiles()`) falls through to the
   generic placeholder. Bills is reachable from the Home Dashboard
   quick-action tile instead. Adding the homeId payload to
   `MeIdentityContent` + plumbing through the YouTabRoot dispatcher
   is a parallel-entry-point cleanup for a future PR.
7. **`@pantopus/theme` category accents.** Web's
   `discover-businesses/categories.ts` and `discover-hub/page.tsx`
   inline 6–7 hex constants for category accent palettes (handyman,
   cleaning, petCare, tech, tutoring, childCare, moving). The
   `@pantopus/theme/src/colors.ts` module doesn't expose category
   tokens on the web today — adding `colors.category.<name>` makes
   these inline constants unnecessary.
8. **Notifications tab strip width parity.** iOS+Android render the
   2-tab strip as shrink-to-fit (shared shell behavior); web renders
   them as `flex: 1` equal-width. Behaviour + data + a11y identical;
   visual-only divergence flagged in the parity audit.
9. **Android `StoreScreenshotsTest` scaffolding.** Placeholder-only;
   wiring the Hilt-graph stub + fixture composition for the 20+ screens
   is a release-prep milestone of its own.

## Gates

- **Web lint:** `pnpm -F @pantopus/web lint` → 0 errors / 543 warnings,
  none in T5 feature dirs. Captured in
  [`docs/lint-reports/web-lint.txt`](../lint-reports/web-lint.txt).
- **Web type-check:** `pnpm -F @pantopus/web type-check` → pre-existing
  errors only, none in T5 feature dirs. Captured in
  [`docs/lint-reports/web-typecheck.txt`](../lint-reports/web-typecheck.txt).
- **iOS / Android:** authoritative CI gates remain `ios-ci.yml` and
  `android-ci.yml`. The remote-execution container has no Swift
  toolchain / Android SDK; the hex-grep guard was reproduced manually
  (zero matches in any T5 feature dir on either platform — see
  [`docs/lint-reports/README.md`](../lint-reports/README.md)).
- **Hex-literal grep:** zero matches across all iOS + Android T5
  feature dirs. Web has 7 documented exceptions in
  `discover-businesses/categories.ts` (token-resolution constants for
  category accents not yet exposed by `@pantopus/theme`) + 6 in the
  existing `discover-hub/page.tsx`.
