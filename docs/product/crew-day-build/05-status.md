# Crew Day build status

Kept by the coordinator from the sessions' live status files in the notes folder
(`…/side-session-notes/local_a7fd3221-2d44-4cf6-a613-11c7438a9c85/crewday/status/`). Times are Pacific; merge times
are GitHub's.

## November 5, 2026

- 01:22 PST: the coordinator started, after the founder chose to build Crew Day in the apps on the feature branch
  `crew-day` (cut from master `96451b75e2`).
- About 01:35: questions 3–9 answered "All recommended": scope, payment model, roles, the `crew_day` key, the three
  tables, four build sessions, Stripe test keys. Questions 1 (by-hand lessons) and 2 (the private Crew Day Kit) remain
  open.
- 01:40: the design plan approved; the sample board (the invitation, light and dark) drawn on the
  [Crew Day designs](https://claude.ai/artifact/WbwmCoReKrDHGN2mGNg9oP) canvas.
- About 01:47: "Draw the rest", then: keep working to the end without asking, start sessions to go faster.
- 01:59: this kit in PR #3373; sessions started (see the table).
- 02:03: the kit merged into `crew-day` (33a1cf8203).
- 02:08–02:12: CDSRV set up the shared Crew Day database (`pantopus-crewday`) and seeded the synthetic accounts.
- 02:29–03:14: SRV-1 to SRV-6 merged.
- 03:05: CDDESIGN finished: 42 boards on the canvas, in seven rows by person.
- 03:15–05:12: CDSRV, CDWEB, CDIOS and CDAND handed off to their successors at about 80–85% context.
- 03:52–04:19: SRV-7 and two server follow-ups merged; every server slice is in.
- 03:19–05:34: WEB-1 to WEB-5 merged; the web steps of scenarios E1–E16 pass on the shared database.
- 03:32–07:33: iPhone APP-1 to APP-5 merged.
- 07:04: Android APP-1 merged.
- 08:28: the operator's per-booking refund without an open problem (spec 21, board `AdminDay`) assigned to CDSRV-2,
  with the operator day page's web change, since CDWEB-2 is at 85% context.

## Sessions

| Session | State | Merged | In review | Next |
|---|---|---|---|---|
| CDSRV → CDSRV-2 | back on one change | SRV-1 … SRV-7, #3394, #3395 | | refund without an open problem, server and web |
| CDWEB → CDWEB-2 | complete | WEB-1 … WEB-5 | | |
| CDIOS → CDIOS-2 | working | APP-1 … APP-5 | APP-6 #3405 | merge APP-6 |
| CDAND → CDAND-2 | working | APP-1 | APP-2 #3397, APP-3 #3403 | APP-4 … APP-6 |
| CDDESIGN | complete | 42 boards | | |
| CDCOORD | coordinating | the kit | | the final end-to-end pass once the app slices merge |

## Slices

| Slice | PR | State |
|---|---|---|
| SRV-1 key, tables, gated routers | #3377 | merged |
| SRV-2 days, approval, the public invitation | #3379 | merged |
| SRV-3 quotes, bookings, the household's reads | #3381 | merged |
| SRV-4 the route, the day's updates, done with its invoice | #3383 | merged |
| SRV-5 charges, card failures, problems | #3384 | merged |
| SRV-6 rain, cancellations, reminders, deadlines, requests | #3386 | merged |
| SRV-7 emails, operator alerts, the flag-off pass | #3392 | merged |
| Server follow-ups: invite price, money after an amount off, presets; four read fields for the apps | #3394, #3395 | merged |
| Operator refund without an open problem (server and web) | | CDSRV-2 |
| WEB-1 … WEB-5 | #3378, #3387, #3390, #3399, #3400 | merged |
| iOS APP-1 … APP-5 | #3380, #3385, #3391, #3401, #3402 | merged |
| iOS APP-6 dark mode, the largest text, VoiceOver | #3405 | in CI |
| Android APP-1 | #3393 | merged |
| Android APP-2, APP-3 | #3397, #3403 | in CI |
| Android APP-4 … APP-6 | | pushed; PRs follow one at a time |
| Boards (5 groups) | canvas | done, 42 boards |
| Final end-to-end pass | | after the app slices merge |

## Coordinator decisions

- A repeat day's invite says "Book again: your price is $180", but Your price opens on One story ($140) and the
  household picks Two stories itself. The spec doesn't name a default option. Preselecting the household's last option
  needs a suggested option on the public read and a change on three platforms, so it's a founder follow-up, not built
  now.
- With `crew_day` off, an old Crew Day link does what each platform already does for every launch-cut link: iOS stays
  where it is, Android hands it to the browser, and the web page says "This Crew Day isn't available." Accepted.
- The Problems list's photos (CDWEB-2's second request) aren't added to the list read: the operator's Problems page
  reads them from each day's detail, which works.
