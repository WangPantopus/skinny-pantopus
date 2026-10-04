# Pantopus next steps

The founder's single checklist. Check items off as they ship. Started September 16, 2026; rewritten October 3, 2026 for the mobile pilot.

**Agents: build from the [mobile pilot build brief](docs/mobile-pilot-build-brief-2026-10-03.md).** It says exactly what to build, on which platforms, against which code, in what order, and what not to build. This file tracks status and decisions; the brief holds the instructions.

Sources, in order of authority for this work:

1. [Mobile pilot build brief](docs/mobile-pilot-build-brief-2026-10-03.md): what to build now, on iOS and Android, plus the backend they need.
2. The September 26 launch direction and its amendments, in `docs/launch-boundary-2026-09-26/` ([PR 1499](https://github.com/WangPantopus/skinny-pantopus/pull/1499) until merged). The brief carries every part this build needs.
3. [First-person loop design](docs/first-person-loop-design-2026-09-16.md): the full F1 to F12 designs. The brief says which parts are in.
4. Claude Design exports in `docs/design/exports/`, checked in `docs/design/exports/VERIFICATION.md`: the look of the screens that have one.
5. Background: the [design docs review](https://claude.ai/code/artifact/09276a14-1587-41be-86ef-54e95505d2d8), the [idea ledger](https://claude.ai/code/artifact/51f601e7-1e56-416e-b549-fbd036e421ba) and the [Wedge v2 strategy](https://claude.ai/artifact/GLUkeCRhnFZnsj7tRr1L4D).

Rules of the road stay [AGENTS.md](AGENTS.md) and the live coordination guide (`docs/workstreams/README.md` on the `codex/workstream-coordination` branch). Stream 1 runs the merge queue and assigns work.

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

**Made by the founder on October 3.**

- [x] New builds are mobile only: iOS and Android. Web waits. Backend, database and seeder changes the apps need are in scope and must not break the current web.
- [x] F1 to F12 for the pilot: build F1, F4 and the rest of F9's truthfulness fixes; build small versions of F2, F3 and F5; ship F3b's server gate with F3; leave F7, F8, F10 and F12's appeal windows for later; drop F6 and F11; park the stylized home picture and the address QR inbox.

**Made on October 3 under the founder's standing instruction to go with the recommended option. Change any of them here.**

- [x] Pickup reminders push only for a pickup day the household confirmed. City defaults show as unconfirmed in the app and never push.
- [x] Pickup and radon reminders need a home. A private setup counts, so a household gets reminders the day it adds its home, without waiting for verification. A saved place without a home gets Today and an "Add your home" row where a reminder would be.
- [x] The radon card and the first-use card live on the Today tab, so they work for private-setup homes, which have no Place dashboard. Radon answers are stored as home tasks; "Not now" is remembered on the device.
- [x] The night-before pickup push rides the existing evening briefing. No new schedule.
- [x] Holiday moves come from city-level holiday rows that shift that week's pickups. No per-home edits and no new table.
- [x] F3b's server gate ships with the household step. Everyone verified before it ships stays verified.
- [x] The election feature is shelved until the 2027 Washington local elections. Its canvas and guide stay as they are.

**Still open. The brief builds the default until you decide.**

- [ ] Confirm the September 26 promise and pilot shape: "Know what matters for your home, and stay on top of it"; first-time homeowners in Vancouver, Camas and Washougal; five households, then 30 to 50, for eight weeks each. Default: as written.
- [ ] Who builds each package. Default: the routing in section 11 of the brief; Stream 1 assigns.
- [ ] Whether invited household members see pickup days and bills. Default: not in the pilot; they see and complete shared tasks.
- [ ] Where the new promise appears. Default: the store listings and the app's first screen.
- [ ] The pilot start date. Default: when section 2 below is done and one full journey works on the hosted backend.
- [ ] Creator network and Places order. Decide in late November with the pilot's week-four number.
- [ ] Record these decisions in `docs/pantopus-product-design-index-2026-09-09.md`, `docs/PROJECT_HANDOFF.md` and section 13 of the Wedge v2 page.

## 1. Done since September 16 (checked on master October 3)

- [x] Coordinate leak: non-authors never get a post's exact point (fixed September 30).
- [x] Founding label fails closed when its lookup fails.
- [x] The radon follow-up no longer promises a reminder that didn't exist.
- [x] Hub mail counts read the real `Mail` columns.
- [x] The eight first-launch cuts sit behind launch flags (`docs/launch-scope-flags-2026-10-01.md`).
- [x] The loop design and this checklist were written and committed.

## 2. Before the pilot (founder-owned; agents can prepare but never hold credentials)

- [ ] Turn the hosted backend on. One scheduled reminder reaches a physical iPhone and a physical Android phone.
- [ ] Production keys the backend reads; the database baseline adopted in production; TestFlight; a Play internal testing track.
- [ ] Confirm the Camas, Vancouver and Washougal pickup schedules and their holiday rules by hand for Thanksgiving (November 26), Christmas (December 25) and New Year's Day (January 1). Mark each official or unconfirmed. Today only Camas has rows, and all are unconfirmed.
- [ ] Talk to ten first-time homeowners and ten meal-train organizers before and during the build.
- [ ] Five strangers, ten seconds on the app's first screen: "What does this do, and why would you type your address?"
- [ ] Review and merge PR 1499 (the September 26 drafts and the marketing draft), then reconcile it with this file.
- [ ] Verify Lob and USPS Every Door Direct Mail rate cards before budgeting any mail drop.
- [ ] Agents' closing-gift kit (draft in PR 1499), the first homeowners association conversation, the business walk.
- [ ] Optional: draw the radon card in Claude Design. Agents build it from the brief and existing components if it isn't ready.

## 3. Build now: the mobile pilot (instructions in the brief)

- [ ] WP1 Truthfulness fixes: hide the Hub's "Earn today" offers line; label curator posts on iOS and Android; remove the seeder's engagement-question and neighbor-voice prompt lines and exclude curator posts from organic counts.
- [ ] WP2 Today works for a saved place and for a newly added home in private setup (F1).
- [ ] WP3 Night-before pickup reminders people can act on (F4): an evening push for confirmed pickup days, nothing on quiet days, holiday moves, a "Bins out" button, and a way to set a pickup day in cities with no calendar yet (today, everywhere but Camas).
- [ ] WP4 Radon, from fact to reminder (F5, small): "Was it tested?", a home task with a date, a reminder with "Done" and "Not now". Includes two fixes to the task reminder job: finished tasks still get pushes, and pushes ignore a task's visibility.
- [ ] WP5 One first-use prompt (F2, small).
- [ ] WP6 The smallest household journey and the invite verification fix (F3 small, F3b gate).
- [ ] WP7 Pilot measurement: app events, reminder events and the report.
- [ ] WP8 Support Train slot reminders for helpers who signed up by email, and the day-of reminder that never fires after the 24-hour one.

## 4. The pilot

- [ ] Start with five households once one full journey works on the hosted backend and a scheduled reminder has reached a physical phone. Expand to 30 to 50 after two pickup weeks with no wrong or missed reminder. Eight weeks per household.
- [ ] Measure activation within seven days; reminders sent, acted on, completed and found helpful; discoveries; household follow-through; week-four and week-eight return counted as handling a responsibility, not opening the app; founder minutes per household; zero unconfirmed dates pushed as confirmed.
- [ ] Interview each household in weeks two and eight: "What did Pantopus help you notice or handle that would otherwise have slipped through?"
- [ ] Decide from the numbers what comes next from section 5.

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

## 6. Dropped, parked or shelved

- Dropped: F6 (just-moved ticks on the account and the voter step) and F11 (the keeper).
- Parked: the stylized home picture; the address QR inbox; the Place tab rebuilt around a "place file" and "Your places"; the one-page notification settings redesign.
- Shelved: the election feature until the 2027 local elections ([build guide](docs/ballot-build-guide-2026-09-23.md), [review](docs/ballot-product-review-2026-09-23.md) and the design canvas kept).
- Creator network and Places: ten conversations first (five hobbyist photographers or hikers, five creators), then decide in late November.

## 7. Documentation

- [ ] Wedge v2 page: add a v3 note; fix "Clark County sits in Zone 2", the "permanent 0% marketplace fee" line and "Android batches later"; record the decisions in section 13.
- [ ] The five September source docs, per the design review: rewrite the nationwide doc's entry section as a change over `/start`; shrink P1 to the smaller first slice; fix appendix A.7's stale citations; mark the v1 brief's navigation retired in the design index; narrow the places doc to libraries and parks with two records; add a true cold-start example to the prototype.
- [ ] Ballot guide: fold the reviewer's twelve amendments into the body; correct the canvas lines the code can't support. Only when the feature is revived.
- [ ] Add Places and Creator sections to the idea ledger.
- [ ] Claude Design pack: stop drawing and fixing cut features; finish fix passes only for the pilot screens listed in section 12 of the brief.
- [ ] Decide whether strategy documents belong on a public repository.

## Not now (decided)

Bill paying by an assistant · generic shopping and deals · any navigation relabel · the source-discovery engine and new owner-scoped tables · a news feed against Nextdoor · Recent conditions and Moment posts · photoreal 3D homes · per-city permit adapters · nationwide paid acquisition before the pilot.

## Parallel, unchanged

The acceptance backlog continues under the coordination guide. This checklist adds the packages in section 3, which Stream 1 assigns.
