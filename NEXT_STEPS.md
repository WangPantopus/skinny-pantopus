# Pantopus next steps

The founder's single checklist. Check items off as they ship. Started September 16, 2026; rewritten October 3, 2026 for the mobile pilot. The street and social designs and PR 625 were folded in the same day.

**Agents: build from the [mobile pilot build brief](docs/mobile-pilot-build-brief-2026-10-03.md).** It says exactly what to build, on which platforms, against which code, in what order, and what not to build. This file tracks status and decisions; the brief holds the instructions.

Sources, in order of authority for this work:

1. [Mobile pilot build brief](docs/mobile-pilot-build-brief-2026-10-03.md): what to build now, on iOS and Android, plus the backend they need.
2. The September 26 launch direction and its amendments, in `docs/launch-boundary-2026-09-26/` (merged from [PR 1499](https://github.com/WangPantopus/skinny-pantopus/pull/1499) on October 5). The brief carries every part this build needs.
3. [First-person loop design](docs/first-person-loop-design-2026-09-16.md): the full F1 to F12 designs. The brief says which parts are in.
4. Claude Design exports in `docs/design/exports/`, checked in `docs/design/exports/VERIFICATION.md`: the look of the screens that have one.
5. Background: the [design docs review](https://claude.ai/code/artifact/09276a14-1587-41be-86ef-54e95505d2d8), the [idea ledger](https://claude.ai/code/artifact/51f601e7-1e56-416e-b549-fbd036e421ba) and the [Wedge v2 strategy](https://claude.ai/artifact/GLUkeCRhnFZnsj7tRr1L4D).

**Designed, outside the mobile build.** The [Street Organizer](docs/product/street-organizer-design-2026-09-27.md) (Crew Day first), [Pulse](https://github.com/WangPantopus/skinny-pantopus/pull/625) (local conversation; see its [review comment](https://github.com/WangPantopus/skinny-pantopus/pull/625#issuecomment-5974324844)) and [Porchlight](docs/product/porchlight-product-design-2026-09-26.md) (check-ins for someone living alone). The [Pantopus Agent](docs/product/pantopus-agent-product-design-2026-10-04.md) ([system design](docs/product/pantopus-agent-system-design-2026-10-04.md)) is the one box that ties them together. Crew Day's first two phases run by hand beside the pilot (section 4A). The rest waits for evidence (sections 5 and 7).

**Who works on what (from October 6).** Four launch streams work in parallel. Each merges its own PRs after green CI and a check in the real apps; ground rules are in [AGENTS.md](AGENTS.md).

- **L1 Place, Today and reminders:** WP1 to WP5 and WP7 in section 3, the seeder, provider data and every reminder push.
- **L2 Home and household:** WP6, Add Home and verification, members, tasks, documents, guests and home privacy.
- **L3 Accounts, community, Mail, Support Trains and money:** WP8, sign-in, Nearby, chat, Mail, payments and the AI assistant.
- **L4 Release, production and quality:** hosted staging and production, store builds and listings, CI, security, performance and the final release-candidate sweep. L4 keeps this checklist current from the streams' PRs and prepares every founder step in section 2.

## 0. Decisions

**Made September 16. All stand.**

- [x] Navigation stays Place · Today · Nearby · Mail; no relabel.
- [x] Density meter: scarcity gates status only, never access.
- [x] Seeder stays as a visibly labeled platform publisher; strip the engagement-question and neighbor-voice prompt lines; exclude it from organic metrics.
- [x] General ban stays; a Moment category only with an explicit place attachment, and not before place pages exist.
- [x] No SavedItem / Action / Watch tables; extend `SavedPlace` and `HomeRecordWatch` instead.
- [x] Pilot is available nationwide and observed locally; paid spend only after week-four return is measured.
- [x] Cash Earn hidden until a balance is withdrawable.
- [x] Address-verified vs household-verified: only postcard, document, landlord or admin verification unlocks attested artifacts and neighbor messaging; an accepted household invite gives household tools only (design doc F3b).

**Made September 27.**

- [x] Eight features leave the first launch behind launch flags, with their code kept ([launch-scope-flags-2026-10-01.md](docs/launch-scope-flags-2026-10-01.md)).
- [x] Rebooking a known crew, the repeat Crew Day of the Street Organizer design, replaces the open gigs marketplace. Payments, tips, invoices and the scheduling engine stay.

**Made by the founder on October 3.**

- [x] New builds are mobile only: iOS and Android. Web waits. Backend, database and seeder changes the apps need are in scope and must not break the current web.
- [x] F1 to F12 for the pilot: build F1, F4 and the rest of F9's truthfulness fixes; build small versions of F2, F3 and F5; ship F3b's server gate with F3; leave F7, F8, F10 and F12's appeal windows for later; drop F6 and F11; park the stylized home picture and the address QR inbox.

**Made on October 3 under the founder's standing instruction to go with the recommended option. Change any of them here.**

- [x] Pickup reminders push only for a pickup day the household confirmed. City defaults show as unconfirmed in the app and never push.
- [x] Pickup and radon reminders need a home. A private setup counts, so a household gets reminders the day it adds its home, without waiting for verification. A saved place without a home gets Today and an "Add your home" row where a reminder would be.
- [x] The radon card and the first-use card live on the Today tab, so they work for private-setup homes, which have no Place dashboard. Radon answers are stored as home tasks; "Not now" is remembered on the device.
- [x] The night-before pickup push rides the existing evening briefing. No new schedule.
- [x] Holiday moves come from city-level holiday rows that shift that week's pickups. No per-home edits and no new table.
- [x] F3b's server gate ships with the household step. Everyone verified by postcard, document, landlord or admin stays verified; people who joined by invitation become household-verified.
- [x] The election feature is shelved until the 2027 Washington local elections. Its canvas and guide stay as they are.
- [x] On a pickup evening the pickup leads the push; only a serious weather alert beats it. Nearby updates never lead an evening push.
- [x] Task reminders arrive the morning of the due day in the household's time zone; Support Train reminders use the train's local time.
- [x] The task-completed push doesn't name the task or the person on the lock screen.

**Still open. The brief builds the default until you decide.**

- [ ] Confirm the September 26 promise and pilot shape: "Know what matters for your home, and stay on top of it"; first-time homeowners in Vancouver, Camas and Washougal; five households, then 30 to 50, for eight weeks each. Default: as written.
- [x] Assign package owners. On October 6 the four launch streams at the top of this file replaced the October 5 assignment.
- [ ] Whether invited household members see pickup days and bills. Default: not in the pilot; they see shared tasks and complete the ones assigned to them.
- [ ] Where the new promise appears. Default: the store listings and the app's first screen.
- [ ] The pilot start date. Default: when section 2 below is done and one full journey works on the hosted backend.
- [ ] Creator network and Places order. Decide in late November with the pilot's week-four number.
- [ ] Crew Day by hand this fall, beside the pilot (section 4A). Default: talk to the crews now; choose the first streets only if the crews pass Gate 1.
- [ ] The by-hand Crew Day's tools. Default: a form, texts, email, and payment through the crew or a payment link, with no Pantopus web build, so the mobile-only rule holds. The Street Organizer's Phase 1 assumes a browser booking page.
- [ ] Pulse's six approvals in [PR 625](https://github.com/WangPantopus/skinny-pantopus/pull/625): navigation, place pages, labels and permissions, adult-only posting, paid moderation, and following the Crew Day launch. Default: decide when Pulse is scheduled; the review comment recommends an answer for each.
- [ ] The Pantopus Agent's open decisions: working name, Stage 1 entry point and languages, autonomy defaults and memory retention ([product design](docs/product/pantopus-agent-product-design-2026-10-04.md#open-decisions)). Default: its recommendations; nothing is built before the pilot's first read.
- [ ] Record these decisions in `docs/pantopus-product-design-index-2026-09-09.md`, `docs/PROJECT_HANDOFF.md` and section 13 of the Wedge v2 page.

## 1. Done since September 16 (checked on master October 3)

- [x] Coordinate leak: non-authors never get a post's exact point (fixed September 30).
- [x] Founding label fails closed when its lookup fails.
- [x] The radon follow-up no longer promises a reminder that didn't exist.
- [x] Hub mail counts read the real `Mail` columns.
- [x] The eight first-launch cuts sit behind launch flags (`docs/launch-scope-flags-2026-10-01.md`).
- [x] The loop design and this checklist were written and committed.
- [x] The Porchlight, Street Organizer and Pulse designs were written on September 26 and 27, and Pulse was reviewed on PR 625 on October 3.
- [x] The Pantopus Agent product and system designs were written on October 4.

## 2. Before the pilot (founder-owned; agents can prepare but never hold credentials)

The ordered steps, with exact values and checks, are in the [launch checklist](docs/release/prod-config-checklist.md); its section 1 lists the decisions it needs from you.

- [ ] Turn the hosted backend on. One scheduled reminder reaches a physical iPhone and a physical Android phone.
  - [x] Prepared by L4 on October 6: every step with values and checks in the launch checklist (PR 1556); deploys stop a crash-looping release within seconds (PR 1576); the reminder Lambdas are ready for hosted runs, with 7 AM Pacific task reminders through daylight saving and failure alarms (PR 1584); backup and restore including uploaded files, rehearsed end to end (PR 1586). Your steps are listed in order in `launch-streams/status/FOUNDER.md`.
- [ ] Production keys the backend reads; the database baseline adopted in production; TestFlight; a Play internal testing track.
  - [ ] Store builds in review: Android targets API 36 as Google Play requires (PR 1601); iOS release settings and privacy manifest (PR 1567).
- [ ] Confirm the Camas, Vancouver and Washougal pickup schedules and their holiday rules by hand for Thanksgiving (November 26), Christmas (December 25) and New Year's Day (January 1). Mark each official or unconfirmed. PR 1552 added draft holiday rows for the three cities; all stay unconfirmed and never push until you confirm them (FOUNDER.md).
- [ ] Talk to ten first-time homeowners and ten meal-train organizers before and during the build. Ask the homeowners whether they would add their home to a Crew Day on their street, and what they would type into a box that answers questions about their home. Their questions become the agent's first test set.
- [ ] Five strangers, ten seconds on the app's first screen: "What does this do, and why would you type your address?"
- [x] Review and merge PR 1499 (the September 26 drafts and marketing draft): merged October 5 in batch 358, commit `f391ac5ee`.
- [ ] Finish reconciling the merged planning/marketing drafts with this checklist and the remaining strategy-document updates; the merge alone does not complete that reconciliation.
- [ ] Verify Lob and USPS Every Door Direct Mail rate cards before budgeting any mail drop.
- [ ] Agents' closing-gift kit (draft in PR 1499), the first homeowners association conversation, the business walk.
- [ ] Optional: draw the radon card in Claude Design. Agents build it from the brief and existing components if it isn't ready.

## 3. Build now: the mobile pilot (instructions in the brief)

A checked subitem means the named implementation or local check is complete; a package stays open until its remaining items work in the real apps. [PR 1533](https://github.com/WangPantopus/skinny-pantopus/pull/1533) (mobile Today, pickup and task reminder flows) merged on October 6 together with PRs 1502, 1510, 1514, 1515, 1516, 1530 and 1532, so the work below is on master.

- [x] WP1 Truthfulness fixes: hide the Hub's "Earn today" offers line; label curator posts on iOS and Android; remove the seeder's engagement-question and neighbor-voice prompt lines and exclude curator posts from organic counts.
  - [x] Backend offers gate and pilot/organic reporting work merged in PR1509; existing curator-exclusion evidence retained.
  - [x] Native curator-card labels and constrained-width repair integrated. Actual rebuilt iOS curator/ordinary attribution and chip readability passed; Android exact retained curator/ordinary attribution and report/mute permissions passed through accessibility. Android pixel readability is not established.
  - [x] Non-sports publisher-voice/question/SKIP guards and bounded provider-error logging implemented and integrated; 119 focused and 507 seeder CI checks passed. Sports question behavior is preserved.
  - [x] Six genuine non-sports curator posts from real providers (L1, PR 1557, October 6).
  - [x] The "Pantopus curator" chip shows on curator posts in Pulse on both apps, readable; ordinary neighbor posts stay unlabeled (L1, October 6). Sports-lane questions are kept, as recorded.

- [ ] WP2 Today works for a saved place and for a newly added home in private setup (F1).
  - [x] Actual iOS retained Save → Today content/chip → persisted prompt stamp with both briefings off → Not now → reentry → remove/no-place → resave → cold restoration passed at the retained baseline.
  - [x] Both native save confirmations now implement See Today. Android signed-in first-save entry, honest provider error, fresh Retry and Cancel passed; no redundant login or saved row was introduced.
  - [x] Failed-stamp Not now recovery implemented on both apps; five focused Android recovery tests and integrated CI passed. Actual native fault-path acceptance remains open.
  - [x] Actual iOS synthetic Home takes priority over the retained Saved Place.
  - [x] iOS: real sign-up → address → Save → See Today → morning card, re-entry, remove, cold relaunch and the daylight-saving end window (L1, October 6).
  - [x] Android: real sign-up → verify → save the previewed address → saved-place Today and morning card; failed-stamp Not now recovery; cold start; Add Home → private setup in the same session. The native fault path passed on both apps (L1, October 6).
  - [ ] iOS Add Home → private setup (waits on PR 1585).

- [ ] WP3 Night-before pickup reminders people can act on (F4): an evening push for confirmed pickup days, nothing on quiet days, holiday moves, a "Bins out" button, and the pickup editor opening on its own in cities with no pickup rows yet (today, everywhere but Camas).
  - [x] Existing calendar/briefing implementation and holiday recurrence-preservation repair integrated (PR1540); service round-trip regressions passed.
  - [x] Actual iOS no-city editor autoopened; Tuesday garbage/alternating-Tuesday recycling persisted and reopened correctly. The first-save primer stayed usable; Remind me/OS Allow persisted evening-only opt-in; unchanged resave did not repeat the primer.
  - [x] The same stored schedule produced the correct combined evening pickup preview and morning pickup exclusion through the whole producer. These were two previews with no delivery or notification writes.
  - [x] Both apps: pickup push with the holiday "Moved a day" line, OS Bins out → reminder action, tap → Today, iOS cold start from the push; editor auto-open and primer; Android permission denied then granted; unconfirmed city defaults never push (L1, October 6).
  - [x] The scheduled evening delivery fired on its own (seeder scheduler + jobs backend) on Android and iOS; private-setup push and Bins out; severe alerts lead the composer, moderate ones don't (injected alerts) (L1, October 6).
  - [ ] A live severe-weather night, and delivery to a physical phone from the hosted backend.

- [ ] WP4 Radon, from fact to reminder (F5, small): "Was it tested?", a home task with a date, a reminder with "Done" and "Not now". Includes two fixes to the task reminder job: finished tasks still get pushes, and pushes ignore a task's visibility.
  - [x] Actual iOS No/not sure → dated radon HomeTask → task-detail Done → persisted completion and Today Done passed.
  - [x] Both apps' task date edit/save/reopen preserves the chosen local day at 09:00 (16:00Z in the tested zone); reopening does not dirty the editor.
  - [x] Native reminder date-picker routes and capability-aware categories integrated: Done + Not now for editors/completers, Done only for complete-only recipients, no actions for unknown capabilities. Finished-task/visibility producer repairs are retained; 22 producer, 12 APNs and 14 Android routing regressions passed. This is not OS-button acceptance.
  - [x] Android: No → dated task → due-day push → OS Done; iOS: Yes path (L1, October 6).
  - [x] OS Not now, card Not now, Change date and member Done-only on both apps, plus the overdue "was due" copy, member visibility, a completion push naming nobody and a private-setup home on Android (L1, October 6).
  - [ ] Delivery to a physical phone.

- [ ] WP5 One first-use prompt (F2, small).
  - [x] On the synthetic iOS Home, the initial two rows were observed; Set pickup focused the editor; saving pickup removed its row.
  - [x] The first-use card disappears once its items are handled (L1, October 6).
  - [x] Later, re-entry and cold start on both apps; private setup on Android (L1, October 6).
  - [ ] iOS private setup (waits on PR 1585).

- [ ] WP6 The smallest household journey and the invite verification fix (F3 small, F3b gate).
  - [x] Household provenance/F3b server gates, invitation copy and private completion-notice source integrated.
  - [x] Actual iOS owner invitation/assignment → Android member household acceptance/completion → owner Android generic in-app notice → exact Done task passed using the retained synthetic Home/task. Invitation acceptance supplied household access, not address proof.
  - [x] iOS Done/reopen controls, immediate Add → saved detail and Back/list refresh repaired. Actual creation with the keyboard open succeeded without Retry and persisted one task; all 45 final scoped access/routing tests passed.
  - [x] False mailbox postcard proof and stale native caches repaired; truthful copy passed on both apps. Invited-member letter/pass/RealRent/RateWatch restrictions were observed on Android; 93 backend and native cache regressions passed.
  - [x] Reciprocal: Android owner invites → iOS member accepts → task Done → FCM/APNs pushes open the task (L2, October 6).
  - [ ] A household member's postcard journey (PR 1598, in review), Android invite accept with its push, the remaining F3b consumers and roles, the external invitation email and hosted delivery.

- [ ] WP7 Pilot measurement: app events, reminder events and the report.
  - [x] Backend event migration, authenticated collection, delivery-qualified reporting and activation/report work merged in PR1509 with its bounded accepted API/report evidence.
  - [x] Actual iOS/Android organic session events and iOS radon decision writes persisted with safe metadata; accepted cold/short-return evidence is retained.
  - [x] Android normal 31-minute background return persisted exactly one session event; immediate short return persisted none, in the same process with no clock manipulation.
  - [x] The admin funnel summary matches the FunnelEvent rows exactly; iOS cold start from a push records `session_open` with push as the source (L1, October 6).
  - [x] Android cold start from a push records `session_open` with push as the source; the iOS 30-minute return records exactly one `session_open` and a 15-second return none (L1, October 6).
  - [ ] `reminder_sent` checked against accepted delivery on the hosted backend.

- [ ] WP8 Support Train slot reminders for helpers who signed up by email, and the day-of reminder that never fires after the 24-hour one.
  - [x] PR1512 backend is merged: Train-local evening and independent day-of reminders, guest email, privacy, repeat/retry and no-start-time behavior passed normal API → DB → whole jobs → local SMTP acceptance (seven simulated clock phases; ten accepted messages and one deliberate refusal). The 15 captured temporary rows were already cleaned in that accepted run.
  - [x] Existing accepted normal mobile Train/create/publish/signup/cancel/organizer/lifecycle journeys remain reusable because their relevant source is unchanged; no duplicate replay was needed.
  - [ ] Verify natural scheduling, actual signed-in native pushes and real external inbox/physical delivery. Concurrent exactly-once delivery and atomic cancellation-versus-send were not established by the local SMTP acceptance. L3 is running the natural-timing check on local jobs on October 6.

## 4. The pilot

- [ ] Start with five households once one full journey works on the hosted backend and a scheduled reminder has reached a physical phone. Expand to 30 to 50 after two pickup weeks with no wrong or missed reminder. Eight weeks per household.
- [ ] Measure activation within seven days; reminders sent, acted on, completed and found helpful; discoveries; household follow-through; week-four and week-eight return counted as handling a responsibility, not opening the app; founder minutes per household; zero unconfirmed dates pushed as confirmed.
- [ ] Interview each household in weeks two and eight: "What did Pantopus help you notice or handle that would otherwise have slipped through?"
- [ ] Decide from the numbers what comes next from section 5.

## 4A. Crew Day by hand, beside the pilot

Phases 0 and 1 of the [Street Organizer launch plan](docs/product/street-organizer-design-2026-09-27.md#launch-plan). Founder-run, with no app build. Each gate must hold before the next step.

- [ ] Phase 0, now to mid-October: talk to five to eight local crews about route savings, per-home prices, weather rules and paying for postcards. Pick one or two exterior services.
- [ ] Gate 1: crews confirm the route savings and accept the rules for payment, cancellation, weather and problems.
- [ ] Phase 1, this fall: Crew Days on two or three streets in Camas or Washougal, growing toward the design's five to ten. Use crew-funded postcards with per-home codes and the tools chosen in section 0. Track founder minutes and cost per Crew Day.
- [ ] Gate 2: invitations convert into bookings, crews want more routes, problems are resolved within the promise, and each Crew Day earns money after all costs.
- [ ] Offer the app to Crew Day households after their job is done. They can join the pilot in section 4.
- [ ] On a street that completes a Crew Day, test one porch coffee with a resident host.

## 5. After the pilot's first read (designed, not scheduled)

- [ ] Web versions of everything in section 3.
- [ ] F7 home-screen widgets.
- [ ] F8 compare link, rotating headline and positioning line.
- [ ] F10 photograph-your-mail with bill reminders.
- [ ] F12 appeal windows computed from the owner's notice date, and radon kit links if a state program exists.
- [ ] F3 extras: member permission defaults for pickup, calendar and bills; bill-paid and calendar notifications; roster and invitation-list redesigns.
- [ ] F5 extras: lease, notice, insurance, warranty and dues dates; reminders for a saved place without a home.
- [ ] F2's full first-week checklist.
- [ ] F9 growth rows: referral rewards, tier rename, one Founding Neighbor name.
- [ ] Ledger "Next" ideas: city founding map, open-slots card, seasonal card, weekly email digest, address-change watches, home-file chat, draft-and-approve replies, home handover, national library, health and market sections, the density-lock change, saved-place snapshot columns, an audit of shipped screens against the September docs' checklist.
- [ ] Street Organizer Phase 2 software, only after Gate 2: plans, My plans, Nearby and Household inside existing surfaces, crew route tools, postcards with codes and the weekly digest. Its invitation pages are web, so it reopens the mobile-only decision.
- [ ] Pulse, after Crew Day launches, per [PR 625](https://github.com/WangPantopus/skinny-pantopus/pull/625) and its review: one town-wide space first, with street areas opening on Crew Day streets. Aim for the place people ask their town, alongside the Facebook groups they already use, not a replacement for them.
- [ ] Porchlight stays an option: at most a by-hand trial with five families after the pilot.
- [ ] The Pantopus Agent, in four stages, each only after the one before passes its gate ([product design](docs/product/pantopus-agent-product-design-2026-10-04.md), [system design](docs/product/pantopus-agent-system-design-2026-10-04.md)):
  - [ ] Stage 1, Know: one box on the Today tab answering from what Pantopus already knows, with sources, and tasks and reminders after one tap. In the pilot area first.
  - [ ] Stage 2, Ask people: questions routed to people who opted in to help, built once together with the Street Organizer's small asks.
  - [ ] Stage 3, Act for you: quotes, bookings and selling with approval, once marketplace and open gigs return. This is also the paid household assistant ("take this off my plate").
  - [ ] Stage 4, Anywhere: groups and topics with "Catch me up", visiting mode, translation, then other countries.

## 6. Dropped, parked or shelved

- Dropped: F6 (just-moved ticks on the account and the voter step) and F11 (the keeper).
- Parked: the stylized home picture; the address QR inbox; the Place tab rebuilt around a "place file" and "Your places"; the one-page notification settings redesign.
- Parked: a feed of permits, land-use cases, sales and assessment changes near an address. It needs the per-city adapters listed under Not now; it can return as the Street Organizer's civic facts and as Pulse content.
- Shelved: the election feature until the 2027 local elections ([build guide](docs/ballot-build-guide-2026-09-23.md), [review](docs/ballot-product-review-2026-09-23.md) and the design canvas kept).
- Creator network and Places: ten conversations first (five hobbyist photographers or hikers, five creators), then decide in late November.

## 7. Documentation

- [ ] Wedge v2 page: add a v3 note; fix "Clark County sits in Zone 2", the "permanent 0% marketplace fee" line and "Android batches later"; record the decisions in section 13.
- [ ] The five September source docs, per the design review: rewrite the nationwide doc's entry section as a change over `/start`; shrink P1 to the smaller first slice; fix appendix A.7's stale citations; mark the v1 brief's navigation retired in the design index; narrow the places doc to libraries and parks with two records; add a true cold-start example to the prototype.
- [ ] Ballot guide: fold the reviewer's twelve amendments into the body; correct the canvas lines the code can't support. Only when the feature is revived.
- [ ] Add Places and Creator sections to the idea ledger.
- [ ] Claude Design pack: stop drawing and fixing cut features; finish fix passes only for the pilot screens listed in section 12 of the brief.
- [ ] Decide whether strategy documents belong on a public repository.
- [ ] Founder review of the Pantopus Agent designs; record each answer in the product design's Open decisions table.
- [ ] PR 625 (Pulse): revise per the [review comment](https://github.com/WangPantopus/skinny-pantopus/pull/625#issuecomment-5974324844) before merging it as a proposal. First its eight fixes: where the Street Organizer's Nearby goes and which screen opens first; the Street Organizer's "no feed, no public comments" rule; one ask-and-offer model for the street; a text channel; street areas opening on Crew Day streets; offers not first-come by default; unanswered asks counted apart from answered ones; signed private notes. Then its fourteen smaller items.
- [ ] Street Organizer design: when Pulse is adopted, amend its non-goals, "What we never build" and moderation sections, and record the by-hand Phase 1 tools.

## Not now (decided)

Bill paying by an assistant · generic shopping and deals · any navigation relabel · the source-discovery engine and new owner-scoped tables · a news feed against Nextdoor · Recent conditions and Moment posts · photoreal 3D homes · per-city permit adapters · nationwide paid acquisition before the pilot.

## Background backlog

The September acceptance backlog ([REMAINING_WORK](docs/REMAINING_WORK_2026-09-11.md)) is background; its row IDs are handy names, not a process. The launch streams verify their areas end to end, and L4 runs the final release-candidate sweep on iOS, Android and the web before the pilot.
