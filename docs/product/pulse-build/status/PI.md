# PI status: iOS

Owner: the PI session. Keep this file current in your own PRs (or a small docs PR): what is done with PR links, what is next, requests to other streams, and anything that needs the founder. Read the other streams' files on `master` before starting a slice that depends on them.

## Done

- **S2 Tolerant decoding** (H1, iOS half): [PR 2263](https://github.com/WangPantopus/skinny-pantopus/pull/2263), merged October 13. Feed, post page, replies, saved and profile lists, and notifications decode row by row and drop only a row they can't read (no id); every other field that is missing, null or of an unknown shape reads as absent. A reply with no author (`user_id` null, account deleted) no longer blanks the post page. A `post_type` this build doesn't know (including `share` and `offer` until S6/S7) renders as a plain card: a neutral **Post** chip, the like heart, Reply, save, repost, share, hide, mute author, report; no type mute, no RSVP, no "mark solved". Unknown push and link payloads were already read loosely and still are. Verified on `Pulse-PI` with alice and bob through a local rewriting proxy (S2.1).

## In review

- **S1 (client half)**: [PR 2266](https://github.com/WangPantopus/skinny-pantopus/pull/2266). Heads-up kinds are Hazard (default) and Other; Theft, Vandalism, Suspicious and Scam are gone (the composer defaulted to Theft, which the server now refuses). No Business Area card in the compose picker, no "Post as this business" on the owner dashboard. The other resident kinds (road hazard, power outage, weather damage) come with the S8 composer, which reads the type from the words.

## Next

- **S3 the five-tab bar** (branch `claude/pulse-pi-five-tabs`, built and partly verified): `RootTab` `place, today, pulse, plans, mail`; Pulse is the tab root with Connections in its top-right menu and the meter / "Set up a home" as a quiet-state card; the Plans tab follows the `plans` switch at runtime; `/nearby` and `/pulse` open Pulse, `/plans` opens Plans.
- Then the Pulse page and conversation against contract fixtures while PB's S5 and S6 land; S4 topic chips once PB's S4 is on `master`.

## Requests (to other streams)

- → PA: for parity, the iOS generic-card rule is: the known legacy types (`ask_local`, `recommendation`, `event`, `lost_found`, `alert`, `deal`, `neighborhood_win`, `visitor_guide`, `local_update`, `announcement`, `general`, `personal_update`, `service_offer`, `resources_howto`, `progress_wins`, plus the cold-start facts' `discussion` and `gig`, and a missing type) keep their cards; anything else is a plain "Post" card. The post page keeps its Share and Offer labels for `share` and `offer`.
- → PB: H1 holds until PA's S2 is on `master` too.
- → PV: `frontend/apps/ios/Makefile` picks the first available iPhone simulator for `make test`, which on this Mac is the other session's `PantopusPRReview`. `04-verification.md` should say to pass `DESTINATION_SIM="platform=iOS Simulator,id=<your UDID>"` (PI runs the suite that way).
- → PV: locally the full iOS suite has 5 failures in `BillsListViewModelTests` (midnight-UTC due dates read a day early in the Mac's Pacific time zone); CI runs in UTC and passes. Not caused by Pulse work; worth a note in the verification kit.

## Needs founder

None yet.
