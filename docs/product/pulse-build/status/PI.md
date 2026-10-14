# PI status: iOS

Owner: the PI session. Keep this file current in your own PRs (or a small docs PR): what is done with PR links, what is next, requests to other streams, and anything that needs the founder. Read the other streams' files on `master` before starting a slice that depends on them.

## Done

- **S2 Tolerant decoding** (H1, iOS half): [PR 2263](https://github.com/WangPantopus/skinny-pantopus/pull/2263), merged October 13. Feed, post page, replies, saved and profile lists, and notifications decode row by row and drop only a row they can't read (no id); every other field that is missing, null or of an unknown shape reads as absent. A reply with no author (`user_id` null, account deleted) no longer blanks the post page. A `post_type` this build doesn't know (including `share` and `offer` until S6/S7) renders as a plain card: a neutral **Post** chip, the like heart, Reply, save, repost, share, hide, mute author, report; no type mute, no RSVP, no "mark solved". Unknown push and link payloads were already read loosely and still are. Verified on `Pulse-PI` with alice and bob through a local rewriting proxy (S2.1).
- **S1 (client half)**: [PR 2266](https://github.com/WangPantopus/skinny-pantopus/pull/2266), merged October 13. Heads-up kinds are Hazard (default) and Other; Theft, Vandalism, Suspicious and Scam are gone (the composer defaulted to Theft, which the server now refuses). No Business Area card in the compose picker, no "Post as this business" on the owner dashboard. The other resident kinds (road hazard, power outage, weather damage) come with the S8 composer, which reads the type from the words.

## In progress

- **S3 the five-tab bar**: branch `claude/pulse-pi-five-tabs` (pushed, master merged in, no PR yet). `RootTab` is `place, today, pulse, plans, mail` (labels Place, Today, Pulse, Plans, Messages; ids `tab.<id>`; icons `activity` and `calendar`). Pulse is the tab root (`PulseTabRoot`): Connections (and Beacons while that launch cut is on) in its "…" menu beside Pulse preferences; the meter and "Set up a home" are one quiet-state card (`PulseQuietCard`, reuses `NeighborhoodViewModel`, scalable type via `PulseTypography`) above the Nearby posts; Tasks and Marketplace (launch-cut) still present as sheets from it via `NeighborhoodDoorStore`. Plans (`PlansTabRoot`) hosts the existing Plans map and follows the `plans` switch at runtime. `/nearby` and `/pulse` open Pulse, `/plans` opens Plans (dropped while the switch is off), post links open in Pulse. `NeighborhoodTabRoot` and `NeighborhoodView` are removed; UI tests updated to the new ids.
  - **Verified on `Pulse-PI`:** four tabs with the switch off and five with it on, appearing without a restart; switch off while on Plans lands on Pulse; the quiet card for an account with no home, and "Set up a home" opens Place's add-home flow; the "…" menu opens Connections and Pulse preferences; `/nearby` from Today opens Pulse; a post link from Place opens it on the Pulse stack with the tab bar; re-tapping Pulse pops to its root; `/plans` with the switch off is dropped.
  - **Still to verify before the PR:** a small phone (`Pulse-PI-SE`) at the largest text size with five tabs; VoiceOver names and selected state for each tab; the meter card states (forming, growing, unlocked hides it) with an account that has a home; dark mode; relaunch keeps the selected tab; sign out and in as bob (no trace of alice; right tabs); the Messages badge; plan links and a plan push from cold and warm start (Plans tab); the three server pushes that use `/app/nearby`; Today's plan cards open the Plans tab; Place, Today and Messages smoke; run the UI tests that cover tab ids by hand (`RootTabUITests`, `NavigationSmokeTest`, `EntryContinuityUITests`); web `/app/nearby` still loads; then `swiftlint --strict`, `swiftformat --lint`, the verify scripts and the unit suite.

## Next

- After S3: S4 client (topic chips and "Mute this topic in this area"; PB's S4 is on `master`), then the Pulse page (S6) and conversation (S9) against contract fixtures while PB's S5 and S6 land.

## Requests (to other streams)

- → PA: for parity, the iOS generic-card rule is: the known legacy types (`ask_local`, `recommendation`, `event`, `lost_found`, `alert`, `deal`, `neighborhood_win`, `visitor_guide`, `local_update`, `announcement`, `general`, `personal_update`, `service_offer`, `resources_howto`, `progress_wins`, plus the cold-start facts' `discussion` and `gig`, and a missing type) keep their cards; anything else is a plain "Post" card. The post page keeps its Share and Offer labels for `share` and `offer`.
- → PB: H1 holds until PA's S2 is on `master` too.
- → PV: `frontend/apps/ios/Makefile` picks the first available iPhone simulator for `make test`, which on this Mac is the other session's `PantopusPRReview`. `04-verification.md` should say to pass `DESTINATION_SIM="platform=iOS Simulator,id=<your UDID>"` (PI runs the suite that way).
- → PV: locally the full iOS suite has 5 failures in `BillsListViewModelTests` (midnight-UTC due dates read a day early in the Mac's Pacific time zone); CI runs in UTC and passes. Not caused by Pulse work; worth a note in the verification kit.

## Needs founder

None yet.
