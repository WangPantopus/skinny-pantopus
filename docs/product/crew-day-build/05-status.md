# Crew Day build status

Kept by the coordinator from the sessions' live status files in the notes folder
(`…/side-session-notes/local_a7fd3221-2d44-4cf6-a613-11c7438a9c85/crewday/status/`). Times are Pacific; merge times
are GitHub's.

**Where it stands (November 5, evening):** every slice is merged into `crew-day` (head `9f98fa7b9a`) and the final
end-to-end pass passed on the web, the iPhone and Android. Nothing is on `master` or in production; releasing is the
founder's ([Release](#release)).

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
- 08:32: this page's first update merged (#3406).
- 08:37: iPhone APP-6 merged (#3405); every iPhone slice is in.
- 08:54–10:12: the coordinator's final pass ([below](#final-pass)).
- 09:03: the refund without an open problem merged (#3407).
- 09:19 and 10:11: server fixes from the final pass merged: rain answers and the cutoff while new dates are open
  (#3411); a reminder on the day says "today", and the crew's done page counts and refunds read right (#3415).
- 10:14 and 11:00: iPhone fixes from the final pass merged: the out-of-area notice at once (#3413); the words after a
  support refund, for the household and the crew (#3414).
- 10:57: Android APP-2 merged (#3397). GitHub's Android runners were slow and flaky all day (timeouts, a crashed
  daemon, a runner shutdown); see the Android decision below.
- 16:20–16:22: the Android CI memory fix (#3426) and Android APP-3 to APP-6 (#3403, #3408, #3409, #3410) merged; every
  slice is in. `crew-day` head `9f98fa7b9a`.
- Evening: the coordinator's last checks on that head: the iPhone app rebuilt from it (#3413 and #3414 together), and
  the Android code compared with the build used in the final pass ([below](#final-pass)). Six money-wording gaps
  remained where support takes money off. Some came from CDSRV-2's notes on #3407, which had reached only the iPhone;
  the rest turned up in these checks. The coordinator fixed them in #3455 (web, iPhone, Android), checked in all three
  apps.

## Sessions

| Session | State | Merged |
|---|---|---|
| CDSRV → CDSRV-2 | complete | SRV-1 … SRV-7, #3394, #3395, #3407, #3411, #3415 |
| CDWEB → CDWEB-2 | complete | WEB-1 … WEB-5 |
| CDIOS → CDIOS-2 | complete | APP-1 … APP-6, #3413, #3414 |
| CDAND → CDAND-2 | complete | APP-1 … APP-6, #3426 |
| CDDESIGN | complete | 42 boards |
| CDCOORD | complete | the kit, this page, the final pass, #3455 |

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
| Operator refund without an open problem (server and web) | #3407 | merged |
| Final-pass server fixes: rain answers and cutoff; a reminder on the day, done counts, refunded rows | #3411, #3415 | merged |
| WEB-1 … WEB-5 | #3378, #3387, #3390, #3399, #3400 | merged |
| iOS APP-1 … APP-5 | #3380, #3385, #3391, #3401, #3402 | merged |
| iOS APP-6 dark mode, the largest text, VoiceOver | #3405 | merged |
| Final-pass iOS fixes: out of area at once; the words after a support refund | #3413, #3414 | merged |
| Android APP-1 | #3393 | merged |
| Android APP-2 … APP-6 | #3397, #3403, #3408, #3409, #3410 | merged |
| Android CI memory: Kotlin compiles inside the Gradle process | #3426 | merged |
| Last money words: after an amount off or a refund before the charge (web, iPhone, Android) | #3455 | merged |
| Boards (5 groups) | canvas | done, 42 boards |
| Final end-to-end pass | | passed |

## Final pass

The coordinator's integration pass on the merged slices, on top of each session's own platform steps of E1–E16 (their
status files). Backend and web from `crew-day`, the iPhone simulator, the Android emulator, the shared database and
Stripe test mode. Day F1 "Gutter Day on Maple Lane" carried the main story and its repeat; day F2 "Leaf Day on Maple
Lane" carried rain and cancelling. Times (the evening before, the day, a charge due, the payout hold, a rain deadline)
were moved with local-only SQL on the shared database, each move recorded in the coordinator's notes.

| # | Result | What ran, and where |
|---|---|---|
| E1 | pass | Dana set up and sent F1 on the web; signed out, its link said "isn't available" until Ops approved on the web; Dana told (notice and email). |
| E2 | pass | Alex, signed out at phone width on the web, saw $180 for two stories, signed in and booked with 4242; on the iPhone it is in Your Crew Days; Dana told "1 of 10 booked". |
| E3 | pass after #3413 | Drew booked on the iPhone with the declining card; Blair on Android. Fran, outside the area, was told at once on the web and Android, but on the iPhone only after Continue, under the footer: fixed in #3413. (Evan's Not for me stays gone after a relaunch: CDIOS-2 and CDAND.) |
| E4 | pass | Casey asked for a three-story price on the web; Dana saw the address at once and set $260 on the iPhone; Casey approved on the web. |
| E5 | pass | Signed out and as Evan: counts only. Luis's crew read: "Home 1" before the evening, addresses and first names on the day. With the key off, a backend answered 403 on every route and a web build said "isn't available"; the apps' flag-off entry points were checked by CDIOS and CDAND-2. |
| E6 | pass | Blair cancelled free before the cutoff on Android; Dana told, the count dropped. Inside 48 hours Casey could only ask the crew on the web, and Dana released the home at no charge on the iPhone. |
| E7 | pass after #3415 | The reminder job told Alex, Drew and Blair (notice and Mailpit email); Alex's iPhone Today shows the day; Luis's route has addresses. A reminder sent on the day said "tomorrow": fixed in #3415. |
| E8 | pass | Luis (crew seat) on Android: On my way, Running late, done with photos; Alex saw each on the web and tapped Gate is ready there; Alex's iPhone shows the photos and the charge time; the invoice is in both invoice lists. |
| E9 | pass | Alex tapped Everything looks good on the iPhone: charged at once, receipt email, Dana's paid notice; after the hold the transfer job paid $162 out to the crew. |
| E10 | pass | The charge job declined Drew's card; Drew paid the invoice on the iPhone with 4242; the booking is Paid everywhere. |
| E11 | pass | Blair reported a problem on Android; the charge paused; Ops refunded $60 of $140 on the web; Blair saw it on Android. Ops refunded Alex's paid booking with no problem open (#3407), and Alex saw it on the iPhone. |
| E12 | pass after #3411 | Dana proposed two dates on the web; Alex picked on the iPhone, Casey on the web; Drew didn't answer and was cancelled free at the deadline. The no-answer home dropped out of the crew's answers, and the cutoff ignored the deadline: fixed in #3411. |
| E13 | pass | Dana cancelled F2 on the web with a reason; every household told, nobody charged; Alex's iPhone says the crew cancelled, and the signed-out invitation says the day was cancelled. (Ops cancelling: CDWEB-2.) |
| E14 | pass | Fran asked on the iPhone; Ops answered "No crew yet" with a note on the web; Fran saw it on the iPhone and Android. (Offer ready: CDWEB-2 and CDAND-2.) |
| E15 | pass | Dana offered F1 again on the web (form prefilled); Ops approved; Invite past customers reached Alex, who booked from the notice on the iPhone. |
| E16 | pass | Spot checks: dark mode at the largest text size on the iPhone; Android's crew page. The full sweeps (dark mode, largest text, VoiceOver, TalkBack, 200% web text) and the edges (the day fills, booking after it closes, double taps, failed reads) were run by CDIOS-2, CDAND-2, CDWEB and CDSRV on their slices. |

Last checks on the head `9f98fa7b9a`:

- Android: the only Android change since the build used above (`04d0b91fdc`, the #3410 head) is `gradle.properties`
  (#3426, how CI compiles); the app's code is the same.
- iPhone, rebuilt from the head:
  - Fran's Your price says the day doesn't reach 456 Oak Street right under Your home, with no price or Continue
    (#3413).
  - After support refunded Casey's finished home in full before its charge, Casey's page says "Pantopus support
    cancelled this booking. Nothing was charged." (#3414)
  - Drew's charge for the rest failed after $40 off, and Drew's page asks for $140 with Pay now (#3414).
  - Dana's finished day reads "Every home is done" (#3414).
- #3455, checked on its own builds:
  - Web: after $40 off and a failed charge for the rest, Drew sees "Your card didn't go through · Pay $140" with Pay
    now, not the case's outcome.
  - Web and iPhone: Drew's price row reads "$40 refunded · $140 due", not "$140 paid". Blair's paid home still reads
    "$60 refunded · $80 paid".
  - iPhone: Dana's finished day reads "Charged · 2 homes · $220", not "1 home".
  - Android: a problem refunded in full before the charge reads "We cancelled the $180 charge. Nothing was charged.",
    not "Refunded $180 to Visa ending 4242"; Drew's failed charge asks for $140, not $180.

## Coordinator decisions

- A repeat day's invite says "Book again: your price is $180", but Your price opens on One story ($140) and the
  household picks Two stories itself. The spec doesn't name a default option. Preselecting the household's last option
  needs a suggested option on the public read and a change on three platforms, so it's a founder follow-up, not built
  now.
- With `crew_day` off, an old Crew Day link does what each platform already does for every launch-cut link: iOS stays
  where it is, Android hands it to the browser, and the web page says "This Crew Day isn't available." Accepted.
- The Problems list's photos (CDWEB-2's second request) aren't added to the list read: the operator's Problems page
  reads them from each day's detail, which works.
- Android's stacked slices merged in order on one fully green CI run of the top of the stack (#3410), since every
  lower slice's head is contained in it and no branch changed afterwards; the slower runs of the lower slices kept
  failing on GitHub's runners, not on the code.

## Follow-ups for the founder

None blocks a release; none is built.

- On a repeat day, Your price opens on One story, though the invite says "your price is $180" (decision above).
- The crew's Gate is ready push goes to the business owner and the day's creator, not to the seat working the route.
- Android's route doesn't refresh on its own; pulling down or reopening shows changes.
- A refund after the crew's payout isn't taken back from the crew. Alex's $180 was refunded after the $162 payout, and
  Pantopus covered it. This is how the existing invoice refunds work.
- The Android app is light-only, app-wide, from before Crew Day.
- On the iPhone and Android, a case closed with nothing charged still offers "See receipt", which opens the void
  invoice; the web shows it only after a charge.

## Release

- Master was brought into `crew-day` on November 6 (#3460), at 118 commits behind. Two files conflicted: the iOS and
  Android deep-link routers (`DeepLinkRouter.swift`, `DeepLinkRouter.kt`). Master's 69566bc657 (business notices
  open their dashboard section) had added cases in the same place as Crew Day's links; both are kept. Master's
  13aa84cebf had moved every web page into `src/app/(site)`. Crew Day's pages moved there too. Left outside, they
  lost the site layout and broke the production build. URLs are unchanged. If master moves on before the release,
  bring it in again the same way.
- The migration is renamed on the branch `claude/cd-release` (`crew-day` plus one commit, to
  `20261106054000_crew_day.sql`, after master's newest), not on `crew-day`. CI's migration check treats
  `crew-day`'s file as applied and refuses the rename on a PR into `crew-day`; on a PR into `master` it passes.
  The founder chose this on November 6. A local database that applied the old name needs `supabase migration repair
  --local --status reverted 20261105100000` and `--local --status applied 20261106054000`, or a reset.
- The release is that branch's PR into `master`. If master gains a newer migration first, rename again.
- Merging `crew-day` into `master` deploys the server and runs the migration on the production database (Deploy
  Backend), and deploys the web, all with Crew Day off. Turning it on is `crew_day` in `LAUNCH_FEATURES`,
  `NEXT_PUBLIC_LAUNCH_FEATURES` and the iOS and Android `PANTOPUS_LAUNCH_FEATURES`, then new app builds.
- Nothing else is needed in production: photos use the existing gig-completion bucket, the three jobs run in the
  existing worker's schedule and skip while the key is off, emails use the existing email service and operator
  alert address, and charges are ordinary invoice payments.
