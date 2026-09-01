# Pantopus Mobile — Performance Smoke Test Matrix

> Walk through each flow on both iOS and Android after deploying the performance optimization branch.
> Mark each cell Pass (P) or Fail (F). Add notes for any regressions, visual glitches, or unexpected behavior.
> Date: 2026-04-11

---

## Test Conditions

- **iOS device:** _________________ (model, OS version)
- **Android device:** _________________ (model, OS version)
- **Build:** EAS preview profile (`APP_ENV=preview`)
- **Branch:** `claude/review-mobile-architecture-iBhWP`
- **Tester:** _________________
- **Date tested:** _________________

---

## Smoke Matrix

| # | Flow | Steps | Expected Result | iOS | Android | Notes |
|---|------|-------|-----------------|-----|---------|-------|
| 1 | **Cold boot → Hub** | Kill app. Tap icon. Time until Hub content is scrollable. | Hub renders within ~1.5s. Splash screen < 800ms. No loading spinner longer than 1s. | | | Target: ~1.2s (Phase 3-4) |
| 2 | **Tab switching** | After first load, tap each tab: Hub → Feed → Gigs → Chat → Profile → Hub. | Each tab shows cached content instantly (< 300ms). No loading spinners on revisit. React Query stale-while-revalidate shows cached data immediately. | | | |
| 3 | **Feed scroll 100 posts** | Open Feed tab. Scroll continuously through 100+ posts. | Smooth 60 FPS scrolling. No visible jank or dropped frames. Images load from disk cache on revisit (no blank flashes). FlashList recycling works correctly — no content from wrong post visible during fast scroll. | | | |
| 4 | **Pull-to-refresh: Feed** | On Feed tab, pull down to refresh. | Spinner appears, new data loads, spinner dismisses. Posts update. No crash. | | | |
| 5 | **Pull-to-refresh: Gigs** | On Gigs tab, pull down to refresh. | Spinner appears, gig list refreshes, spinner dismisses. | | | |
| 6 | **Pull-to-refresh: Hub** | On Hub tab, pull down to refresh. | All cards refresh. Today card updates. No card disappears during refresh. | | | |
| 7 | **Pull-to-refresh: Chat** | On Chat tab, pull down to refresh. | Conversation list refreshes. Unread counts update. | | | |
| 8 | **Create a gig (Magic Task)** | Tap + on Gigs tab → Magic Task flow. Enter task description. Submit. | Gig created successfully. Redirects to gig detail. No crash during composition. | | | Verifies unified draft path still works |
| 9 | **Create a listing with photos** | Go to Marketplace → Create listing. Add 3+ photos. Fill details. Submit. | Listing created. Photos upload correctly. OptimizedImage renders thumbnails in the form. Disk cache works for preview images. | | | Verifies expo-image migration (P1.8-P1.10) |
| 10 | **Create a post with photos** | On Feed tab → Compose. Select posting target. Add 2+ photos. Post. | Post appears in feed. Images render correctly. Live photos play if selected. Optimistic rendering shows post immediately. | | | Verifies P3.1 usePostComposer split |
| 11 | **Chat: receive incoming message** | Open a chat room with 50+ messages. Have another device/user send a message. | Message appears within 1s without delay. No visible re-layout or flicker. Auto-scroll to bottom works. 100ms batching (P3.7) does not cause visible delay. | | | |
| 12 | **Chat: send message (optimistic)** | In a chat room, type and send a message. | Message appears immediately (optimistic render). After server confirms, no duplicate or flash. Failed messages show retry button. | | | |
| 13 | **Chat: emoji picker** | In a chat room, tap emoji button. Select an emoji. | Emoji picker loads on first tap (may show brief spinner — lazy load P4.1). Subsequent opens are instant. Selected emoji inserts into input. | | | First open may take ~200ms to load module |
| 14 | **Background → foreground** | Log in. Background app for 60s. Return to app. | Socket reconnects (verify via chat message delivery). Badge counts refresh. No crash. No stale data visible. Biometric unlock prompt if enabled. | | | Verifies P1.3 event-based token sync, P2.4 badge backoff |
| 15 | **Logout → login** | Tap Profile → Settings → Log out. Log back in with same account. | Session clears completely. Login succeeds. Hub loads. Push token re-registers. All tabs show fresh data. No stale cached data from previous session. | | | Verifies P1.1 AuthContext memo, P0.3 QueryClient |
| 16 | **AI assistant** | From Chat tab → tap Pantopus AI row. Send a message. | AI response streams in. Messages render correctly. Back navigation returns to chat list with cached data. | | | |
| 17 | **Listing detail + gallery** | Open a listing from Marketplace. Scroll reviews. Tap gallery image. | Listing renders. Reviews scroll smoothly. Gallery carousel uses FlatList (P3.3) — swiping works, dots update, tap opens lightbox. Lightbox swipe-to-dismiss works. | | | |
| 18 | **Business profile tabs** | Navigate to a business profile. Switch between tabs (Activity, Reviews, Inbox, Profile). | Each tab renders. Images load via OptimizedImage. No crashes on tab switch. | | | |
| 19 | **Mailbox** | Open Mailbox from hamburger menu or Hub. | Mailbox screen renders. Mail items display correctly. | | | |
| 20 | **Deep link: push notification (killed state)** | Kill the app. Send a push notification for a gig. Tap the notification. | App cold boots. After auth gate, navigates directly to gig detail screen. Gig content renders correctly. | | | Verifies notification routing still works after all provider changes |
| 21 | **Gigs map view** | On Gigs tab, tap map icon. | Map renders with gig markers. Clustering works. Tap a marker to see detail. Search this area button works. | | | Verifies react-native-maps not broken by optimization changes |
| 22 | **Feed map view** | On Feed tab, switch to map view. | Map renders with post markers. Toggle back to list — list shows cached posts instantly. | | | |
| 23 | **Context/location switch** | Open context sheet. Switch location (e.g., to a home). | Feed refreshes for new location. Context bar updates. Sheet close does not cause full-screen re-render (P2.3 PantopusContext split). | | | Verifies P2.3 context split |
| 24 | **Identity switch** | Open hamburger menu. Switch from Personal → Home → Business identity. | Identity updates across all tabs. Access permissions update correctly. No crash or stale data. | | | Verifies P3.5 IdentityContext memos |
| 25 | **Mute/hide chat conversation** | On Chat tab, swipe a conversation. Tap Mute. Swipe another, tap Hide. | Muted conversation shows mute icon, excluded from badge count. Hidden conversation disappears from list. Mute/hide persists after app restart (debounced write P4.3). | | | |
| 26 | **Discover search** | Tap search on Hub. Type a query. Results appear. | Results load within debounce window. No out-of-order results visible. | | | AbortController not yet implemented (P4.2 blocker) — verify no crash |

---

## Summary

| Result | Count |
|--------|-------|
| Total flows | 26 |
| iOS Pass | ___ / 26 |
| iOS Fail | ___ / 26 |
| Android Pass | ___ / 26 |
| Android Fail | ___ / 26 |

### Blocking Issues Found

| # | Flow | Platform | Description |
|---|------|----------|-------------|
| | | | |

### Non-Blocking Issues Found

| # | Flow | Platform | Description | Severity |
|---|------|----------|-------------|----------|
| | | | | |

---

## Sign-off

- [ ] All blocking issues resolved or documented
- [ ] iOS smoke pass rate ≥ 24/26
- [ ] Android smoke pass rate ≥ 24/26
- [ ] Ready for production release candidate

**Tester signature:** _________________
**Date:** _________________

---

## Rollback Plan

> Rollback mechanism: EAS OTA update to a known-good commit. No runtime feature flags.
> Each phase boundary is a natural rollback point. Within a phase, some prompts
> have forward dependencies that prevent clean individual revert.

### Phase Boundary Rollback Points

| Rollback to | Commit | What you lose | Safe? |
|-------------|--------|---------------|-------|
| **Before Phase 1** | `d54be90` (pre-P1.1) | All optimizations | Yes — clean baseline, zero risk |
| **After Phase 1** | `1114715` (P1.10) | Phases 2-4 | Yes — Phase 1 is self-contained |
| **After Phase 2** | `81fad1c` (P2.11) | Phases 3-4 | Yes — Phase 2 builds on Phase 1 cleanly |
| **After Phase 3** | `8726e0f` (P3.9) | Phase 4 | Yes — Phase 3 builds on Phase 2 cleanly |
| **After Phase 4** | `dbd512d` (P4.7) | Nothing — full suite | Yes — current state |

### Per-Prompt Revert Scope

#### Phase 1 — Critical Fixes

| Prompt | Commits | Independently revertable? | Notes |
|--------|---------|--------------------------|-------|
| **P1.1** AuthContext memo | `1e3d577` | Yes | No dependents |
| **P1.2** Token change emitter | `23bc493` | No — **P1.3 depends on it** | Must revert P1.2 + P1.3 together |
| **P1.3** Socket event sync | `ed6a800` | Yes (if P1.2 stays) | Revert restores 1s polling |
| **P1.4** React.memo list items | `2369c61` | Yes | No dependents within Phase 1 |
| **P1.5** FlatList props | `7f90925` | No — **P3.9 removes these props** | After P3.9, reverting P1.5 alone is a no-op (props already gone). Revert P3.9 first to restore FlatList, then P1.5 props are relevant again. |
| **P1.6** Feed memo | `4184572` | Yes | No dependents |
| **P1.7–P1.10** Image migration | `fdd9cdb`..`1114715` | Revert as a group | P1.8-P1.10 depend on P1.7 (OptimizedImage wrapper). Revert all 4 together. |

#### Phase 2 — High-Impact

| Prompt | Commits | Independently revertable? | Notes |
|--------|---------|--------------------------|-------|
| **P2.1** Startup audit | `9c2fb42` | Yes (doc only) | |
| **P2.2** Startup fixes | `cd041eb` | Yes | Reverts parallelization + InteractionManager deferrals |
| **P2.3** PantopusContext split | `6706ccb` | No — **P3.4 and P3.5 depend on it** | Revert P3.4 + P3.5 first (they import `usePlace`, `useActor`, `useCollections` from the split). Then revert P2.3. |
| **P2.4** BadgeContext | `75e5687` | Yes | Reverts debounce + backoff, restores setInterval + message:new listener |
| **P2.5** Chat double sort | `568aa90` | Yes | 1-line change |
| **P2.6** Binary insert | `b1d919e` | No — **P3.7 depends on it** | P3.7 batching calls `insertMessageSorted`. Revert P3.7 first, then P2.6. |
| **P2.7** useHomeAccess RQ | `52e1558` | Yes | Reverts to useState+useEffect pattern |
| **P2.8** Hub RQ | `9acdc63` | Yes | Reverts to manual staleness refs |
| **P2.9** useGigsData RQ | `312f991` | Yes | Reverts to useState+useEffect. Also revert `dbd512d` (P4.7 test wrapper) |
| **P2.10** useFeedData RQ | `bc3f2c8` | No — **P3.1 depends on it** | P3.1 splits the React Query-based hook. Revert P3.1 first, then P2.10. Also revert `dbd512d` (P4.7 test wrapper) |
| **P2.11** Chat list RQ | `81fad1c` | Yes | Reverts to manual fetch + useFocusEffect |

#### Phase 3 — Medium Optimizations

| Prompt | Commits | Independently revertable? | Notes |
|--------|---------|--------------------------|-------|
| **P3.1** Split useFeedData | `d94cc1d` | Yes (if P2.10 stays) | Reverts to monolithic hook. Must keep P2.10's React Query migration. |
| **P3.2** Chat pagination blocker | `14e718e` | Yes (doc only) | |
| **P3.3** ListingGallery FlatList | `830f69c` (partial) | Grouped commit — see below | |
| **P3.4** LocationContext memos | `830f69c` + `dd010ea` | No — **depends on P2.3** | Uses `usePlace`, `useCollections` from the split. Revert reverts to `usePantopus()`. |
| **P3.5** IdentityContext memos | `830f69c` + `dd010ea` | No — **depends on P2.3** | Uses `useActor`, `useCollections` from the split. Revert reverts to `usePantopus()`. |
| **P3.6** Hub ScrollView decision | `830f69c` + `ade6da8` | Yes (comment only) | |
| **P3.7** Chat batching | `830f69c` (partial) | No — **depends on P2.6** | Uses `insertMessageSorted`. Revert P3.7 first if reverting P2.6. |
| **P3.8** activeRoomIds stabilize | `830f69c` (partial) | Yes | |
| **P3.9** FlashList migration | `8726e0f` | Yes | Reverts to FlatList. Must re-add P1.5 FlatList props if keeping Phase 1. |

**Note:** P3.3–P3.8 were committed together in `830f69c`. To revert individual changes within that commit, cherry-pick or manually edit rather than `git revert`.

#### Phase 4 — Polish

| Prompt | Commits | Independently revertable? | Notes |
|--------|---------|--------------------------|-------|
| **P4.1** Lazy emoji picker | `512b77f` | Yes | Reverts to eager import |
| **P4.2** AbortSignal blocker | `c6f1d46` | Yes (doc only) | |
| **P4.3** AsyncStorage batching | `ade4a5f` | Yes | Reverts to direct AsyncStorage.setItem |
| **P4.4** CDN resize blocker | `68e73cb` | Yes (doc only) | |
| **P4.5** Lazy-load spike | `e02a304` | Yes (doc only) | |
| **P4.6** Profiling checklist | `c1489ff` | Yes (doc only) | |
| **P4.7** Test fixes | `dbd512d` | No — **depends on P2.9 + P2.10** | Tests need QueryClient wrapper because hooks use React Query. Only revert if also reverting P2.9/P2.10. |

### Critical Dependency Chains

These are the changes that **cannot be cleanly reverted independently** because later prompts build on them:

```
P1.2 (token emitter) ──► P1.3 (socket sync)
P1.7 (OptimizedImage) ──► P1.8 ──► P1.9 ──► P1.10 (image migrations)
P2.3 (context split) ──► P3.4 (LocationContext) + P3.5 (IdentityContext)
P2.6 (binary insert) ──► P3.7 (chat batching)
P2.10 (feed RQ) ──► P3.1 (hook split)
P2.9/P2.10 (React Query) ──► P4.7 (test wrapper)
P1.5 (FlatList props) ──► P3.9 (FlashList removes them)
```

### Emergency Rollback Procedure

1. **Identify the failing phase** from the smoke matrix or crash reports
2. **Pick the nearest phase boundary** before the failure
3. **EAS OTA publish** the rollback commit:
   ```bash
   git checkout <rollback-commit>
   eas update --branch preview --message "Rollback to pre-Phase-N"
   ```
4. **If the failure is within a phase** and a full phase rollback is too aggressive:
   - Check the dependency chain above
   - Revert the specific prompt + its dependents in reverse order
   - Run `pnpm --filter pantopus-mobile test` to verify
   - EAS OTA publish the surgical revert
