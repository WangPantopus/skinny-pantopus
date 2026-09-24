# Foundations handoff packs

The repo copy of the Foundations components published to the
[Pantopus design system](https://claude.ai/artifact/MCub8DTnkdhoFnMbtF8QF5).
Each board's Claude Design session publishes its cards to the design system and hands back the same files here.

| Board | Components | Published | Handoff pack |
| --- | --- | --- | --- |
| 00a Marks, captions and chips | ProvenanceMark, SourceCaption, ScopeChip, FreshnessLine, OfflineNotice, StatusChip, KindGlyph, ChoiceChip (AddressChip now complete) | yes, plus `project/foundations-00a.md` | `00a/` — updated pack with all nine components, plus `REPO-HANDOFF.md` (per-component props, drawing rules and open questions) |
| 00b Data instruments | ScaleStrip, AqiBand, FourteenDayStrip, YearBand, SlotMeter, PublicPointMap, FactCount | yes, plus `project/data-instruments.md` and a "Data instruments" group | `00b/` — verified byte-for-byte against the published files on 22 Sep 2026 |
| 00c Rows and lists | DateRow, FactRow, FirstWeekRow, BillRow, MemberRow, InviteRow, NotificationRow, TextActionRow, LockedActionRow, GrantLimitList, InlineErrorRow, ThumbnailRail | yes, plus `project/foundations-00c.md` | `00c/HANDOVER.md` — engineering spec only; the published card files still live in the artifact |
| 00d States, feedback and asks | QuietDayReceipt, WarmingSkeleton, InlineUndo, DestructiveConfirm, LandingBannerSlot, NotificationAsk, PushCopy, ReminderLeadControl | yes, plus `project/foundations-00d.md` | `00d/HANDOVER.md` — engineering spec only; the published card files still live in the artifact |

Specimen boards (every artboard as PNG, plus the attach set) are in `../exports/`.

## Correction to the HANDOVER files

Both sessions wrote that `tools/design-system/build.mjs` will "drop" these cards on its next run. That is not
what happens, and it was checked against the build:

- `tools/design-system/out/publish-plan.json` lists exactly the 110 files the build generates, and the build
  contains no deletion logic. Publishing replaces the files it lists and leaves every other file alone. The
  hand-published component folders and section files therefore survive a rebuild.
- What a rebuild **does** overwrite is `project/design-system.json`, the index. That is where `docs.sections`
  (the section links) and the asset-group ordering live, so a rebuild-and-publish can drop the
  `foundations-00a.md` / `data-instruments.md` section links and the "Data instruments" group ordering while
  leaving the cards in place.
- Verified after each publish: all 110 generated files still present, the index kept every key and all 22 asset
  records, and only `lastChange` differed.

So the passthrough described in `00b/HANDOVER.md` is still worth adding, but for the index and for
regeneration, not to prevent deletion.

## Token correction (found 22 Sep 2026 in the 00a repo handoff)

The published `tokens.json` carries an AA correction the prompt pack's house style did not:
`app-text-secondary` `#6B7280` → **`#4e5563`**, `app-text-muted` `#9CA3AF` → **`#5f6775`**, and the semantic inks
darkened too: error `#DC2626` → **`#a81a1a`**, warning `#D97706` → **`#9a4a08`**, success `#059669` → **`#047857`**.
There are also three themes, not two: Light, Dark and Dark · iOS.

Recomputed against the corrected values: text.secondary 7.49:1, text.muted 5.70:1, error 7.43:1, warning 6.26:1,
success 5.48:1 — all pass. The one pair that still fails is white on `primary.600` (4.10:1), so filled buttons and
inline links stay on `primary.700` (5.93:1).

Consequence for the boards: every contrast figure drawn on 00a–00d was measured against the old palette, so those
tables read low. The cards name tokens and are unaffected. Code that reads the token gets this right automatically.

## Pillar correction (found 22 Sep 2026 while verifying f1-your-places)

The house style's Pillars line carried the theme package's pre-correction values (`frontend/packages/theme/src/colors.ts`).
The published tokens, like web `globals.css`, are `color-identity-personal` **`#0369A1`** and `color-identity-home`
**`#15803D`**; business stays `#7C3AED`. `#16A34A` is `color-brand-check`, the verification tick only, and there is no
published professional pillar. Every other hex in the house style matches a published token. The house style was fixed
in pack Version 7; sessions 1 and 2 received the old text (`docs/notes/house-style-v2.as-sent-sessions-1-2.txt`), which
did no harm because Claude Design reads `tokens.json`.

## Screen verification rulings (22 Sep 2026)

| Question | Ruling |
| --- | --- |
| "No 200% frame" | A pass unless the manifest names one. Screen prompts carry one enlarged-text frame, usually iOS AX5. Only `f1-email-verify-handoff`, `f8-compare-arrival-header` and `f8-compare-reveal` also name a web-390 200% frame. |
| Notes board named differently from the manifest | Not a failure. Manifests word it differently ("· Notes", "· notes", "· ios · 99-notes · light") because the consistency pass was skipped, and no journey attaches a Notes board. |
| Board titles that are not the manifest names | Map them by manifest order when the counts agree (`tools/export-render/verify_export.py` does it and names the PNGs). Do not rename on the canvas: it has no version history. |
| Check index without the per-artboard files | Not verifiable. Pull the full export (the HTML bundle, or the index with its linked files saved beside it). |

## Founder decisions, 22 Sep 2026 (evening)

| Question | Decision |
| --- | --- |
| Today's location for someone with a home | The claimed home always drives Today; a pin or a recently viewed place never replaces it. The server's default `primary_home` mode already ranks the home first (`backend/services/context/locationResolver.js`), so "Today uses your home" stays true; retire the viewing-location and device-location modes, which the new notification settings no longer offer. |
| Away from home (founder's proposal; design pending) | More than 100 miles from home, Today could follow the person. Only for people who already let Pantopus see their location (the apps ask on the map screens); never ask for location just for this. Recommended: weather, air and alerts follow the person; pickup, dates, bills and household stay with the home, and Today names which place it shows. Not in any prompt yet. |
| Place tab's first screen | The place file of the place Today uses; Your places opens from its Address row. With no place saved, Your places' empty state is the tab's first screen. |
| Offline "+ Add a place" | Disabled, with "Adding a place needs a connection." |
| Jordan's dates | Anchored on the onboarding story: he saves Birchfield when he signs up on Sat 10 Oct (flow-01, the save and email prompts) and has one place through his first week. He saves four more on Sun 18 Oct, his mom's house last, each save moving Today to the newest (design doc F1), and chooses Birchfield again on Mon 19 Oct. Applied to f1-your-places, f1-add-place-sheet (now adds his mom's address on Sun 18 Oct) and flow-06; the drawn pages are corrected by the session-2 fix pass in BOT-BRIEF.md. |
| House style additions (pack Version 8) | A date never breaks inside itself; dark menus, popovers and sheets sit on dark surface.raised with a 1px dark border.strong edge; the logo files (`docs/design/exports/attach/pantopus-logo-*.png`, rendered from the design system's Logos group) go with every session's first message. Session 2 gets them as an addendum. |
| Notification settings (sent to Claude Design) | One push switch per kind of notification, on one page. The brief's five groups, then NEARBY ("Messages", "Posts and follows", "Marketplace", "Gigs and payments", "Beacons you follow") and MAIL ("Mail"), then Account & security last; each Nearby switch is its own Android channel and iOS category, on by default. No Push/Email/SMS chips (Pantopus sends no email or SMS notifications; email is only for sign-in, invitations and bookings; the SMS service is a placeholder), no Pause all, no Quiet hours. This adds two groups to the research brief's five-group model because the app sends these today: Gig updates, Mail summary and Beacon push are shipped switches, and 34 push types (messages, posts, marketplace) have no switch at all. Server work: switches for Messages, Posts and follows, and Marketplace; retire Quiet hours and Briefing location without turning on anything someone turned off. The send kit's "before" image A14.5 was an unbuilt concept. |
| Dates at AX5 / 200% | When a full date cannot fit the column, it may break only before its year ("Sun 18 Oct" / "2026"); nothing else splits. |
| Native date inputs on web | The browser's own input may show its numeric format while typing; the chosen date is always displayed in the house form ("Tue 29 Sep 2026"). |
| Text links | Underlined wherever they sit in running text or rows, so they read without colour (greyscale). |
| Pickup primer from the Date sheet (founder, 23 Sep) | Accepted: the primer appears when a pickup day is first saved from the Date sheet; "That's my day" stays inline and goes straight to the OS dialog. |
| Wildfire scope wording | "USFS · hazard potential within a quarter mile · 2023": the app reads the 2023 WHP map (270 m) and, for a developed lot, the burnable land within a quarter mile (`backend/services/placeSectionAdapters.js`). Never "30 m model". |
| Place section details for a saved place (founder, 23 Sep) | A saved place opens it too: public-record readings and civic deadlines aren't household data. "Saved place · Only you" scope, no household elements; flow-13, the T1 voter row and the 00c-08 crop all land there. Server work: the place-sections route must accept a saved place, not only a home. |
| Lease reminder lead (settled, now propagated) | 30 days: Sat 30 Jan 2027, "Lease notice due in 30 days". The earlier fix left 14-day text in x-date-sheet, x-place-file and f3-household-notifications (fixed in pack Version 10) and in flow-03 and flow-06 (to fix before the journeys). The published 00d PushCopy card still shows the old 14-day example string. |
| Tab icons | As shipped: Place house, Today sun, Nearby compass, Mail envelope on iOS (`RootTabView.swift`) and web (`lib/icons.ts`); Android Today cloud-sun, Nearby map pin, Mail mailbox (`PantopusRoute.kt`). Every screen drawn so far used a pin and a two-people icon; house style Version 11. |
| Web pickup card width | Fills the Today column like its neighbours; no 640 cap. |
| Jordan's pickup wording | The pickup card's "Garbage tomorrow · Recycling: Not set" everywhere; the strip's rows follow it. |
| Warranty | Stored as typed, shown as "Water heater warranty ends" with "Rheem 40-gal" as detail; Only you. |
| Still open (not a date question) | How many places Jordan has: one in f4-today-pickup-card (through its Thanksgiving frame), f1-today-air-band and flow-01, flow-10 and flow-14 (no street label on his pushes); five from Sun 18 Oct in f1-your-places and flow-06. Maya's saved places also differ between the 00d boards (The Blairmont rental, Dad's place) and f1-your-places (Mom's house, Sam's old apartment). This is the skipped consistency pass; the journeys flag it. |

## Do not commit as source

`00b/project/design-system.json.published-reference` is a read-only snapshot of the live index. The index is
live artifact state: re-read it before any publish, and never resend this copy.

## Decisions settled 22 Sep 2026

| Question | Decision |
| --- | --- |
| Card radius | `radius-2xl` for every card, row card and sheet, as `tools/design-system/content/tokens.mjs` documents ("THE card radius"). The prompt pack's earlier "cards use radius-lg 12" line was wrong and has been corrected. `2xl` is 20 on every platform: `frontend/packages/theme/tailwind.cjs` sets `'2xl': '20px'` and `frontend/apps/web/tailwind.config.js` applies it, so web `rounded-2xl` is 20px, not Tailwind's default 16. (Corrected 22 Sep; this row and the house style previously said web was 16px.) |
| Destructive label | House style wins: no red fill, no red text; hue on the glyph and border only. `ModalShell`'s emerald submit and title-case "Go Back" are worth fixing separately. |
| "Yes" on the notification card row | Replace with a verb: "Remind me" paired with "Not now". |
| Push action case | Sentence case ("That's my day"), per the research brief and house style, overriding the contract's title case. |
| "Open Settings" | Keep the capital S: it names the OS Settings app. |
| Lease reminder lead | Keep the four leads 60 / 30 / 7 / 1. The fixture's 14-day lease reminder becomes **30 days → Sat 30 Jan 2027**. |
| Primer vs inline ask | Inline after the first "That's my day", going straight to the OS dialog. The primer sheet is only for indirect entries such as household activity from Mail. |
| Skeleton threshold | Nothing under 1s; skeleton from 1s to 10s; the band stops after four passes and goes static. |
| MemberRow height | Accept ~88pt. Row heights are minimums set by content and 44pt targets. |
| NotificationRow bill reminder | Keep the "you added this" mark when a person entered or confirmed the bill, including from a snap. Hollow is only for facts on record that nobody confirmed. |
| LockedActionRow server-refused | Accept three lines. Never truncate a reason. |
| FactRow `reports-*` | Make them chevron rows that open "Where this fact comes from", where the report's status lives. A row with a status and no way in is a dead end. |
| InviteRow offline reasons | Accept full-width placement under the row while the strings run 45–58 characters. |
| Warning ink `#fbbf24` | Dark surfaces only; light keeps its own `color-warning` value, `#9a4a08` since the AA correction (this row said `#D97706` until 22 Sep). Read the token, never hard-code. |
| BillRow line 1 | Wraps to two lines and never truncates; the amount keeps its own line; the row grows to 92pt. |
