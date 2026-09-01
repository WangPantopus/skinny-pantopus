# Lint reports — T5 sweep

Captured during the T5 final-audit sweep. Each platform's section
links to the artifact + records the gate outcome.

## Status

| Target | Result | Notes |
|---|---|---|
| `pnpm -F @pantopus/web lint` | **0 errors / 543 warnings** | All 543 warnings are `@typescript-eslint/no-explicit-any` in pre-T5 files (`useChatMessages.ts`, `useHomeData.ts`, `usePromoTriggers.ts`, etc.). **Zero warnings in T5 feature directories** (Discover Businesses, Discover Hub, My Bids / Tasks / Posts, Connections, Bills, Pets, Offers, Listing Offers, Notifications V2). Captured in `web-lint.txt`. |
| `pnpm -F @pantopus/web type-check` | **717 errors (all pre-existing)** | Errors come from `hooks/useChatMessages.ts`, `hooks/useHomeData.ts`, `lib/marketplace-icons.ts`, `packages/api/src/endpoints/mailboxV2.ts`, and various test fixture files — none of them touched by T5. **Zero TypeScript errors in T5 feature directories.** Captured in `web-typecheck.txt`. |
| `cd frontend/apps/ios && make lint` | **deferred (no toolchain in this container)** | The remote-execution container has no Swift toolchain. Local + CI gates remain authoritative; iOS lint reports are produced by `ios-ci.yml`. The T5 hex-grep guard was reproduced via `rg`: zero hex literals in any iOS T5 feature directory (Bills, Pets, Connections, MyBids, MyTasks, MyPosts, Offers, ListingOffers, DiscoverHub, DiscoverBusinesses, Notifications). |
| `cd frontend/apps/android && ./gradlew detekt ktlintCheck` | **deferred (no Android SDK in this container)** | Same constraint — no SDK in the agent container. CI's `android-ci.yml` is the authoritative gate. Hex-grep guard reproduced: zero `Color(0x…)` literals in any Android T5 feature directory. |

## Hex-literal grep

The token-discipline check from `mobile-screen-definition-of-done.md` §2:
"hex literals in feature code will trip the CI hex-grep guard". A
single-shot reproduction of that guard across all T5 feature
directories:

```bash
# iOS
grep -rnE '#[0-9a-fA-F]{6}\b' frontend/apps/ios/Pantopus/Features/Homes/Bills \
  frontend/apps/ios/Pantopus/Features/Homes/Pets \
  frontend/apps/ios/Pantopus/Features/Connections \
  frontend/apps/ios/Pantopus/Features/MyBids \
  frontend/apps/ios/Pantopus/Features/MyTasks \
  frontend/apps/ios/Pantopus/Features/MyPosts \
  frontend/apps/ios/Pantopus/Features/Offers \
  frontend/apps/ios/Pantopus/Features/ListingOffers \
  frontend/apps/ios/Pantopus/Features/DiscoverHub \
  frontend/apps/ios/Pantopus/Features/DiscoverBusinesses \
  frontend/apps/ios/Pantopus/Features/Notifications
# → 0 matches

# Android
grep -rnE 'Color\(0x[0-9A-Fa-f]{8}\)' frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/bills \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/homes/pets \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/connections \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mybids \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/mytasks \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/myposts \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/offers \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/listing_offers \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/discoverhub \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/discoverbusinesses \
  frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/notifications
# → 0 matches

# Web (T5-relevant component dirs)
grep -rnE '#[0-9a-fA-F]{6}\b' frontend/apps/web/src/components/list-of-rows \
  frontend/apps/web/src/components/discover-businesses
# → 7 matches, all in `discover-businesses/categories.ts`
```

### Documented exceptions (zero unexpected matches)

- **iOS `Core/Design/SpeciesPalette.swift`** — the Pets-screen species
  accent palette is the canonical exception called out in the T5
  notes. Lives outside `Features/**`, defines the token surface that
  feature code references.
- **Web `components/discover-businesses/categories.ts`** — 7 inline
  hex constants (`HANDYMAN`, `CLEANING`, `PET_CARE`, `TECH`,
  `TUTORING`, `CHILD_CARE`, `MOVING`) for the category accent
  palette. `@pantopus/theme/src/colors.ts` doesn't expose category
  accents on the web today (only identity + semantic + primary
  tokens); the gradient's *other* stop comes from
  `colors.primary[500]` / `colors.semantic.warning` / etc. — proper
  token references. Tracked as a small `@pantopus/theme` follow-up:
  add `colors.category.<name>` and import here.
- **Web `app/(app)/app/discover-hub/page.tsx`** — 6-tone palette
  array on the DiscoverHub page (T5.4.1 / P11 precedent). Same shape
  / same future-cleanup.

Every other T5 file is hex-clean.

## Re-running locally

Use the gate commands above directly — they all run on a developer
laptop with the relevant toolchain installed. CI workflows
(`ios-ci.yml`, `android-ci.yml`, `web-ci.yml`) capture artifacts
under `Actions → Workflow run → Artifacts` on every PR.
