# PA — Android

You own every Android screen of Pulse. Read [README](../README.md), [build spec](../01-build-spec.md), [contract](../02-contract.md), [delivery plan](../03-delivery-plan.md), [verification](../04-verification.md) and `frontend/apps/android/CLAUDE.md` first. PI builds the same screens on iOS with no shared UI code, so match the build spec's copy and the contract's field names exactly.

## Owns and does not own

- **Owns:** `frontend/apps/android/`.
- **Does not own:** the backend, the contract (propose changes by PR to `02-contract.md`; PB reviews), iOS, web.
- **Shared files with one writer per patch:** `ui/screens/root/*`, `core/routing/DeepLinkRouter.kt`, `core/LaunchFeatures.kt`. In this build you are that writer. Other sessions have recently edited Android (connections, settings, place detail, saved copies); merge `master` often and keep your diffs small.

## Code map (verified on master; under `frontend/apps/android/app/src/main/java/app/pantopus/android/`)

| What | Where |
|---|---|
| Tabs: `PantopusRoute.entries = [Place, Today, Nearby, Mail]` (Mail is Messages while the mailbox is off), `owningTab` maps the pillars (Pulse, Tasks, Marketplace) to Nearby and Messages to Mail | `ui/screens/root/PantopusRoute.kt` |
| The bar (KDoc says four tabs; badges map) | `ui/screens/root/PantopusBottomBar.kt` |
| Tab content, the Plans map mount (`PlansMapScreen`, ~line 2691) and the Pulse route (~2705, 2772) | `ui/screens/root/RootTabScreen.kt` (large; edit narrowly) |
| Pulse feed screen and model | `ui/screens/feed/FeedScreen.kt`, `feed/pulse/PulseFeedViewModel.kt`, `feed/pulse/PulsePostCard.kt` |
| Composer | `ui/screens/compose/pulse/*` |
| Conversation | `ui/screens/posts/*` |
| Plans (map, host, plan, change, chat) | `ui/screens/plans/*`, `data/plans/PlansFeature.kt` (the server switch) |
| Networking and DTOs | `data/posts/PostsRepository.kt`, `data/api/models/feed/FeedDtos.kt`, `data/api/models/posts/PostActionDtos.kt` |
| Deep links and launch features | `core/routing/DeepLinkRouter.kt`, `core/LaunchFeatures.kt` |
| Components and theme | `ui/components`, `ui/theme/*` |
| Tests | JVM unit tests (`src/test`), Paparazzi snapshots (CI runs `paparazziVerify`), instrumented tests in `src/androidTest` (5 files reference the bottom bar; they run on an emulator in CI) |

Known facts: text scales (sp) and was checked at 2×; **Release builds are R8-shrunk** and CI does not shrink, so only a Release build shows enum-name and reflection crashes (the October 13 crash came from an enum stored in saved copies; PR 2207 keeps app enum field names; check any new enum you serialize). The debug application id is `app.pantopus.android.debug`. The emulator reaches your Mac at `10.0.2.2`.

## Slices

- [ ] **S2 Tolerant decoding. First.** Feed, post detail, comments, notifications, deep-link payloads: unknown `post_type`, unknown enum values, extra and missing fields decode to a generic case and render as a generic card. No other change. Hold point H1: PB cannot create `share` or `offer` posts until your PR and PI's are on `master`.
- [ ] **S1 (client)** Remove crime/suspicious kinds from the Heads-up picker; no business-to-Place option.
- [ ] **S3 Five tabs.** `entries = [Place, Today, Pulse, Plans, Mail]`; `Pulse` (`root/pulse`) becomes a bar tab; add `Plans` (`root/plans`, label "Plans"); `Nearby` stays only as a deep-link alias resolving to Pulse; `owningTab` maps Tasks and Marketplace to Pulse. The Plans tab shows only while `PlansFeature` says plans are on and must react to it changing (selection falls back to Pulse). The bar draws four or five tabs; update its KDoc. Connections opens from the Pulse top-right menu. The neighborhood meter and "Set up a home" become one quiet-state card on the Pulse page (reuse the Nearby view model). Keep test tags (`tab.mail` stays); update the instrumented tests you break. Check five tabs on a small screen at 2× font and with TalkBack.
- [ ] **S4 Topics**, **S5 (client)** labels and distance (text, not color alone), area pill, adult confirmation, **S6 The Pulse page** (wireframes 1 and 4: groups with headers only as the response has them, topic chips, "↑ N new conversations", "You're caught up", "Show earlier", quiet state, Following shell, Follow off the card), **S7 (client)** status and endings.
- [ ] **S8 Composer** (wireframe 2): one box, Type/About/Topic rows, "Who can read" and "Shown to", first-post review, "Posting as", photos, drafts that survive app switch, process death and sign-up, the call-out sheet, the private-detail prompt, the existing-answers card.
- [ ] **S9 Conversation** (wireframe 3): two levels with "Replying to", Helpful, Thank, "↓ N new replies", offers, Going and Seen it, Follow in the header, labels on replies, "Reply removed", "Who can read" in the author's "…" (narrower only).
- [ ] **S10 Following and controls:** Follow sheet, Following view, preferences page, "Why am I seeing this?", the "…" entries, "Seeing too much?". **S11 (client)** notices, appeals, held state, report on replies, the Rules screen.
- [ ] **S12–S24** as the plan lists; the owner of each publishes shapes first. Known, Upcoming, Right now and search (wireframe 4; S12); the plan card, the "Going" chip on replies and "Suggest a plan" from a conversation or Event (wireframe 5; S14); guest browsing, "Pick a town to look around" and the neighbors-only link card (S15); place pages, dated observations and Residents only (S16); business replies, the Official label and the "Local offers" spot (S17); **S20** the sign-up sheet (draft carried across the code step and process death, "Welcome back", errors, set-a-password in settings); **S21** the Repeats row, series controls, "Going every time", "Not this time", co-host invites; **S22** "Start a Support Train" in the "…"; **S23** the merged stub; **S24** the second-home picker and pins. **S25 is reserved** (Crew Day and welcome cards); build nothing for it.

## Rules specific to this stream

- Copy is **exact** (build spec appendix); shorten only with the same meaning and say so in the PR.
- Existing components and tokens; do not redesign working screens beyond a slice.
- Every new screen: TalkBack names for every control and state, dark mode, sp text, offline behavior like the Instant Screens contract, no information by color alone.
- New backend fields are optional in the DTO until PB's PR is on `master` (H4).
- When a screen with a Paparazzi snapshot changes, re-record that snapshot in the same PR; do not add snapshots for new screens unless a slice asks.
- `.env` is gitignored and local.

## Verification you own

Run every scenario for your slices in [`05-scenarios.md`](../05-scenarios.md) on your emulator (section A on every screen, section B for the slice), then look at the same server-created content on **web** (your stream has a web dev server). PV runs the cross-client round trips (section C). No unit tests, no instrumented-test code, no coverage work.

On your own emulator (`pulse-pa`, console port 5574), against your own backend: each slice's screens with two accounts; relaunch and process-death persistence; 2× font; dark mode; TalkBack; five tabs on a small screen; every route you touched; and **one Release build** (R8) of the merged state before you call a slice done. `./gradlew ktlintCheck detekt :app:lintDebug test` (+ `paparazziVerify`) before pushing.

## First three days

Start your runtime and emulator (`04-verification.md`), merge S2, then S3. Build the Pulse page and conversation against fixture JSON that matches the contract exactly while PB's S5 and S6 land, then finish against the real backend. Write your first status entry.
