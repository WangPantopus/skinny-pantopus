# Crew Day slices

Who builds what, in what order. One PR per row unless a row says otherwise; keep each PR to one screen, route group
or service. Every app slice is verified against a backend running `crew-day` with the server slices it names merged
(merge `origin/crew-day` into your branch first). Until a slice's server work is merged, build its screens from the
contract and the boards, then verify and merge once the server lands. Never wait idle: take the next slice.

## CDSRV: server (`backend/**`, `supabase/migrations/**`, the shared database)

First, before SRV-1 merges: set up the shared Crew Day database from `crew-day` (one Supabase stack, project id
`pantopus-crewday`, ports 23120–23129), seed the synthetic accounts in [`04-scenarios.md`](04-scenarios.md#accounts),
and write `RIG.md` and `accounts.local.json` (local-only passwords, never in Git) in the notes folder. Apply your
migrations to it as they merge.

| Slice | What | Unblocks |
|---|---|---|
| SRV-1 | `crew_day` key (flags file, notification type map, launch-scope doc row 13); the migration (three tables, indexes, RLS); routers mounted at `/api/crew-days` and `/api/admin/crew-days` answering 403 `CREW_DAY_UNAVAILABLE` while off | every app's flag work |
| SRV-2 | crew: readiness, list, create, edit, submit; operator: list, detail, approve, decline; public read `GET /public/:code`; their notices | invitation, crew list and wizard, admin |
| SRV-3 | quote; bookings (card check, capacity, area, idempotency); household reads (`mine`, `today`, booking page); patch, cancel, ask-release, price answer; crew price/decline/release; `knownInvoiceRecipients`; their notices | booking flow, Your Crew Day, Today cards |
| SRV-4 | crew reads (`/:id/crew`, route, order); on-the-way, running late, gate ready, can't get in; uploads; done (with the invoice); their notices | route, one home, done |
| SRV-5 | money: the shared invoice payment service, `crewDayCharges`, confirm, card failure and the household paying the invoice; problems (open, notes) and the operator's problem actions (release, refund, resolve); their notices | charges, problems, admin problems |
| SRV-6 | rain (propose dates, answers, deadlines), cancel a day (crew and operator), `crewDayReminders`, `crewDayDeadlines`, invite past customers, Today dismiss, street requests and the operator's answer; their notices | new dates, cancellations, requests |
| SRV-7 | the emails for every type in contract §6 and the operator alert emails; the flag-off pass (every route, notice and job) | release readiness |

## CDWEB: web (`frontend/apps/web/**`, `frontend/packages/**`)

| Slice | What | Needs |
|---|---|---|
| WEB-1 | `crew_day` key, middleware gating, the sidebar row; the invitation page `/crew-day/[code]` (all states, light and dark, 200% text); "How Crew Day works" and "Who sees what"; `/crew-day/*` in the app association files | SRV-1, SRV-2 |
| WEB-2 | Your price, sign-in/up and back, Review and book (the existing web add-card form), You're on the route | SRV-3 |
| WEB-3 | `/app/crew-days` (list), the booking page in every state, change or cancel, something needs attention, new dates, share kit and the printable flyer, ask for a Crew Day | SRV-3 to SRV-6 |
| WEB-4 | the dashboard's Crew Days tab, New Crew Day, the crew's day (before the day, the route read on the web, propose dates and answers, after the day) | SRV-2, SRV-4, SRV-6 |
| WEB-5 | the operator pages (20–23) | SRV-2, SRV-5, SRV-6 |

## CDIOS and CDAND: iPhone and Android (`frontend/apps/ios/**`, `frontend/apps/android/**`)

The same slices on each platform, with the same render states, accessibility identifiers / test tags and endpoints
(`frontend/apps/ios/CLAUDE.md` "Parity").

| Slice | What | Needs |
|---|---|---|
| APP-1 | `crew_day` key; the side-menu rows (personal and business); the Today card slot; links (`/crew-day/<code>` universal/app links, notification links by type); DTOs and endpoints from the contract | SRV-1, SRV-2 |
| APP-2 | crew: Crew Days list, New Crew Day (Wizard archetype), Before the day (price checks, release, invite past customers, share, cancel) | SRV-2, SRV-3 |
| APP-3 | household: invitation (native), Your price, Review and book (the existing add-card sheet), You're on the route | SRV-3 |
| APP-4 | household: Your Crew Day in every state, Today cards, Your Crew Days, change or cancel, something needs attention, new dates, share kit (QR code, system share) | SRV-3 to SRV-6 |
| APP-5 | crew on the day: route (reorder, on my way, running late), one home (camera and photo library, upload, mark done, can't get in), propose new dates and answers, after the day | SRV-4 to SRV-6 |
| APP-6 | ask for a Crew Day; dark mode, the largest text size and VoiceOver / TalkBack on every Crew Day screen | SRV-6 |

## CDDESIGN: the remaining boards

Draw in the order the builders need them, publishing each board as it is done:
1. `Price`, `Review`, `Booked`, `CrewDay` (with every state as `Cd*` boards), `Today`.
2. `CrewList`, `CrewDayPrep`, `Route`, `RouteHome`, `NewCrewDay`.
3. `Problem`, `Cancel`, `MyCrewDays`, `AskStreet`, `Share`, `ProposeDates`, `DatesAnswers`, `AfterDay`.
4. `CrewDashboard`, `AdminList`, `AdminDay`, `AdminProblems`, `AdminRequests`.
5. `InvitationLarge`, `CdDoneDark`, `CdDoneLarge`, `AndroidCrewDay`, `RouteDark`, `RouteLarge`, `AndroidRoute`,
   `Messages`, `Flow` (how a booking moves).

## CDCOORD: coordination

Merges this kit; keeps [`05-status.md`](05-status.md) current from the sessions' status files; answers
`QUESTIONS.md` items that are the coordinator's; checks each session's model, effort and context; runs the final
end-to-end pass ([`04-scenarios.md`](04-scenarios.md)) on the `crew-day` head across all three apps; writes the
NEXT_STEPS update and the founder's closing summary.

## Order and parallel work

```text
SRV-1 ──► SRV-2 ──► SRV-3 ──► SRV-4 ──► SRV-5 ──► SRV-6 ──► SRV-7
  │         │         │         │         │         │
  ▼         ▼         ▼         ▼         ▼         ▼
APP-1    WEB-1     WEB-2     APP-5     WEB-5     APP-6
         APP-2     APP-3     WEB-4     (charges) WEB-3/APP-4 finish
                   APP-4 starts
```

Every session starts at once: CDSRV on the rig and SRV-1; the app sessions on the key, the entry points, the models
and the screens whose boards exist, verifying each against the server slice as it merges.
