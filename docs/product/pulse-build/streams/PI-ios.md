# PI — iOS

You own every iOS screen of Pulse. Read [README](../README.md), [build spec](../01-build-spec.md), [contract](../02-contract.md), [delivery plan](../03-delivery-plan.md), [verification](../04-verification.md) and `frontend/apps/ios/CLAUDE.md` first. PA builds the same screens on Android with no shared UI code, so match the build spec's copy and the contract's field names exactly; parity is by those, not by sharing files.

## Owns and does not own

- **Owns:** `frontend/apps/ios/` (`Pantopus/`, `PantopusTests/`, `PantopusUITests/`, `Config/`).
- **Does not own:** the backend, the contract (propose changes by PR to `02-contract.md`; PB reviews), Android, web.
- **Shared files with one writer per patch:** `Features/Root/RootTabView.swift`, `Core/Routing/DeepLinkRouter.swift`, `Core/Environment/*`. In this build you are that writer.

## Code map (verified on master)

| What | Where (under `frontend/apps/ios/Pantopus/`) |
|---|---|
| Tabs: `RootTab { place, today, nearby, mail }`, the `TabView`, tab ids `tab.<id>` | `Features/Root/RootTabView.swift` (the Messages tab keeps id `mail`) |
| Nearby root: opens the Plans map when `plansFlags.plans`, else `NeighborhoodView`; presents Pulse as a **sheet** via `NeighborhoodDoorStore` | `Features/Root/NeighborhoodTabRoot.swift`, `Features/Neighborhood/NeighborhoodView.swift`, `NeighborhoodDoorStore.swift`, `NeighborhoodViewModel` |
| Today (plan cards already exist), Place | `Features/Root/TodayTabRoot` (in `RootTabView.swift`), `Features/Place/…` |
| Pulse feed screen and model | `Features/Feed/FeedView.swift`, `PulseFeedViewModel.swift`, `Feed/Pulse/PulsePostCard.swift` |
| Composer | `Features/Compose/PulseCompose/*` (flow, purposes, form) |
| Conversation | `Features/Posts/PulsePostDetail*` |
| Plans (map, host, plan page, push) | `Features/Plans/{Map,Host,Plan,Push,Shared}`, `PlansNavigator`, `Core/Environment/PlansFlags.swift` |
| Networking and DTOs | `Core/Networking/Endpoints/PostsEndpoints.swift`, `Models/Feed/FeedDTOs.swift`, `Models/Posts/PostDetailDTO.swift` |
| Deep links | `Core/Routing/DeepLinkRouter.swift` |
| Components | `Core/Design/Components` (`EmptyState`, `ErrorState`, `Shimmer`, `Toast`, `StatusChip`, `ActionChip`, `SectionHeader`, `OfflineBanner`), `Features/Shared/Feed/FeedComponents.swift`, tokens in `Core/Design/*.swift` |
| Tests | `PantopusTests/` (XCTest; Pulse feed, compose and detail have about 90), `PantopusUITests/` (26 files use `tab.*` ids; CI skips this target) |

Known facts that change how you work: iOS type styles are **fixed sizes** (the app does not follow system text size); **every new Pulse screen uses scalable type** (Plans already does; copy that pattern). Pulse is a sheet today; it becomes the Pulse tab's root. There is no shared bottom-sheet or "N new" pill component: build one and reuse it for "↑ N new conversations" and "↓ N new replies". Search in the feed today only filters loaded rows.

## Slices

- [ ] **S2 Tolerant decoding. First.** Feed, post detail, comments, notifications, deep-link payloads: unknown `post_type`, unknown enum values, extra and missing fields decode to a generic case and render as a generic card. No other change. This is hold point H1: PB cannot create `share` or `offer` posts until your PR and PA's are on `master`.
- [ ] **S1 (client)** Remove crime/suspicious kinds from the Heads-up picker; no business-to-Place option.
- [ ] **S3 Five tabs.** `RootTab`: `place, today, pulse, plans, mail`; labels Place, Today, Pulse, Plans, Messages; ids `tab.place|today|pulse|plans|mail`; icons from the design system (Pulse: reuse the compass or an activity icon; Plans: calendar/map pin; ask the founder only if none fits). The Plans tab exists only while `plansFlags.plans` is on and must react when it changes (selection falls back to Pulse). Pulse becomes the tab root (not a sheet); `NeighborhoodDoorStore` hand-offs (feed, post) select the Pulse tab; plan links select Plans; `/nearby` resolves to Pulse. Connections opens from the Pulse tab's top-right menu. The neighborhood meter and "Set up a home" become one quiet-state card on the Pulse page (reuse `NeighborhoodViewModel`; do not delete it). Update `PantopusUITests` ids you break. Check five tabs on an iPhone SE-size simulator at the largest text size.
- [ ] **S4 Topics:** chips and the topic mute. **S5 (client):** labels and distance on cards and replies (text, not color alone), the area pill, the adult confirmation.
- [ ] **S6 The Pulse page:** wireframe 1 and 4: groups with headers (only the groups the response has), topic chips, "↑ N new conversations" pill (poll `/feed/new` about once a minute while visible), "You're caught up", "Show earlier" (nothing loads by itself), quiet state, Following view as an empty shell until S10, search button (R3). Move Follow off the card.
- [ ] **S7 (client):** status and ending states on cards ("✓ Answered", "Gone", "Reunited", "Happened · N went").
- [ ] **S8 Composer:** wireframe 2: one box, the Type/About/Topic rows, "Who can read" and "Shown to", first-post review, "Posting as", photos, drafts that survive app switch and sign-up, the call-out sheet, the private-detail prompt, the existing-answers card. Replace the nine-purpose grid with the one-box flow; keep the old composer reachable only if some path still needs it.
- [ ] **S9 Conversation:** wireframe 3: two levels with "Replying to", Helpful, Thank, "↓ N new replies", offers ("I'd like it" and the giver's request list), Going and Seen it, Follow in the header, labels on every reply, "Reply removed".
- [ ] **S10 Following and controls:** the Follow sheet, Following view, preferences page, "Why am I seeing this?", the "…" menu entries, "Seeing too much?" line.
- [ ] **S11 (client):** notice and appeal screens, the held state on your own post, report on replies. **S12–S17** as the plan lists; the owner of each publishes shapes first.

## Rules specific to this stream

- Copy is **exact** (build spec appendix). If a string does not fit, shorten it with the same meaning and say so in the PR.
- Use existing components and tokens; the wireframes show behavior, not visual style. Do not redesign working screens beyond what a slice says.
- Every new screen: VoiceOver names for every control and state, dark mode, scalable type, offline behavior like the Instant Screens contract (stale-while-revalidate where the store exists), no information by color alone.
- A new field from the backend is optional in the DTO until PB's PR is on `master` (H4).
- Release-config check: the `.env` and `Config/Secrets.xcconfig` are gitignored and local; never commit them.

## Verification you own

Run every scenario for your slices in [`05-scenarios.md`](../05-scenarios.md) on your simulator (section A on every screen, section B for the slice), then look at the same server-created content on **web** (your stream has a web dev server). PV runs the cross-client round trips (section C). No unit tests, no UI-test code, no coverage work.

On your own simulator (`Pulse-PI`), against your own backend: each slice's screens with two accounts; relaunch persistence; large text; dark mode; VoiceOver labels via the accessibility inspector; the five-tab bar on a small phone; every push and link route you touched. `swiftlint lint --strict`, `swiftformat --lint .`, the two `verify-*.sh` guards and `make test` before pushing.

## First three days

Start your runtime and simulator (`04-verification.md`), merge S2, then S3. While S5 and S6 land, build the Pulse page and conversation against fixture JSON that matches the contract exactly, and finish against the real backend as PB merges. Write your first status entry.
