# Mover's civic deadline: seasonal aha → plan → reminder → self-report (Jordan, PLACE B)
id: flow-13 · platforms: ios/android/web-390/web-1440 · artboards: 15

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

JOURNEY: flow-13 · Mover's civic deadline: seasonal aha → plan → reminder → self-report

TYPE: NEW (storyboard). Every screen here already has its own design project. This project does not redesign any of them. It lays the journey out as one connected sequence so the founder can see what is carried across, what the person sees at each moment of truth, and where the failure branches go. When an attached export and this prompt disagree, draw the export and add the delta this prompt lists, and mark each delta with a small 'Δ' tag.

NAMING EXCEPTION: Storyboard projects use "storyboard" in place of the platform value in artboard names (an exception to the house-style ARTBOARDS rule '<surface-id> · <ios|android|web-390|web-1440> · <NN-state> · <light|dark>'). Every other part of the convention applies.

ATTACH (exact exported artboards, by name):
- f8-seasonal-aha · ios · 18-voter-7-days · light
- f8-seasonal-aha · web-390 · 01-voter-7-days-unconfirmed · light
- f8-seasonal-aha · web-390 · 02-voter-official · light
- f8-seasonal-aha · web-390 · 06-in-person-phase · light
- f8-seasonal-aha · web-390 · 09-deadline-passed-ranked · light
- f8-seasonal-aha · android · 19-voter-7-days · light
- f1-today-tab · ios · 02-saved-place-quiet · light
- f1-today-tab · ios · 03-warming · light
- f1-today-tab · ios · 13-after-claim · light
- f4-briefing-optin-card · web-390 · 04-morning-grant-evening-also-on · light (specimen for F02b's granted state)
- f4-notification-settings · web-1440 · 16-browser-blocked · light
- x-place-file · ios · 02-saved-place-first-week · light
- x-place-file · ios · 04-hide-skip-undo · light
- x-date-sheet · ios · 07-view-seeded-voter · light
- x-date-sheet · ios · 08-voter-after-deadline · light
- x-date-sheet · ios · 09-voter-marked-done · light
- x-date-sheet · web-390 · 33-view-seeded-voter · light
- f5-today-calendar-strip · ios · 03-saved-place-unconfirmed · light
- f5-today-calendar-strip · ios · 06-reminder-landing · light
- f6-place-section-details · ios · 02-civic-dense · light
- f6-place-section-details · ios · 07-civic-unverified-multi-home · light
- f6-place-section-details · ios · 08-civic-in-person-only · light
- f6-place-section-details · ios · 09-civic-absent-states · light
- f6-place-section-details · android · 12-offline · light
- The Foundations board (prompt 00), including the PushCopy date-reminder tray preview (V7) and the hidden-preview placeholders (V8).
No export exists yet for: the briefing permission step on iOS (F02b), the Move-in date sheet at a saved place (F04), the place file with Jordan's Just moved rows (F05), the voter sheet on Sat 10 Oct (F06), a voter reminder push (F07), the VoteWA in-app browser (F10), the Today voter row after the self-report (F12), the offline self-report (B08), the tray 'Done' result (B10) and the web browser notification (artboard 10). Redraw those frames faithfully from the descriptions below, using the attached neighbours as the visual base, and label each 'Redrawn from description'.

PERSONA & SITUATION (recast; flows-spec's Jordan in Vancouver moving in September is replaced by the fixture)
- Jordan Lee, 36, moved from Portland, OR to PLACE B, 1107 NE Birchfield Ct, Camas, WA 98607, on Fri 9 Oct 2026. He has never registered to vote in Washington. He created his account and saved the place on Sat 10 Oct ('Saved place · Only you', tier T1, not claimed). His City of Camas pickup weekday is Thursday; his frequency is Not set.
- He means to register online, which needs a Washington driver's licence or ID card. He expects his licence before the deadline, so on Sat 10 Oct he makes a plan and a reminder instead of registering.
- The journey starts Sat 10 Oct 2026 at 2:30 PM, moves to TODAY (Mon 19 Oct 2026, 7:00 AM push, opened at 6:10 PM Pacific), and ends with silent days on Sun 25 Oct and Mon 26 Oct. Each frame says its date and time.
- Civic fixture: online or mail voter registration must arrive by Mon 26 Oct 2026; in person until 8:00 PM Tue 3 Nov 2026 (the general election). The storyboard treats the Washington Secretary of State rule as checked, so its mark is FILLED ('Official') on every surface; B04 shows the unchecked version.

GOAL: Know which registration path is still open, make a plan, be reminded before that path's deadline, and record it for himself only.

§5 METRIC THIS JOURNEY MOVES
- Activation: within 7 days of sign-up (Sat 10–Sat 17 Oct), Jordan has a SavedPlace, a briefing on (F02b), and a date. Tag F02b 'Activation: briefing on', and F04 and F06 'Activation: F5 date?', and put the open definition on Notes (does a move-in date, or a seeded voter rule with his plan and reminder, count as 'an F5 date'?).
- Return with attribution: the Mon 19 Oct open writes session_open { trigger: 'push', kind: 'date' }. Tag the F07→F08 arrow.
- Spread: F01 writes t0_aha_viewed. Tag F01.
- Honesty: no surface ever states or implies whether Jordan is registered. Tag F06, F09, F11 and F13 'Honesty'. Notes: §5's honesty counter counts only pickup; propose counting 'This isn't right' reports on the voter row as well.

THE HAPPY PATH (frames F01, F02, F02b, F03–F14; iOS 393x852)

F01 · Sat 10 Oct, 2:30 PM · iOS, signed out, Place launch preview · f8-seasonal-aha · voter card · from 'f8-seasonal-aha · ios · 18-voter-7-days · light'.
- Δ: chip 'in 16 days · Mon 26 Oct'; FILLED mark with the word 'Official' (as in 'f8-seasonal-aha · web-390 · 02-voter-official · light'); source 'Washington Secretary of State · statewide · as of Sat 10 Oct'.
- Shows: overline 'WHAT STANDS OUT'; headline 'Online or mail voter registration for Nov 3 must arrive by Oct 26 in Washington.'; detail 'In person: until 8:00 PM Tue 3 Nov at your county elections office.' and 'Moved recently? Registration is per address.'; follow-up row 'Keep this address to set a reminder before Mon 26 Oct'; outbound row 'Check or update at VoteWA ↗'; the share pair 16pt below the card.
- Jordan does: taps the follow-up row. The preview scrolls to the sticky wall ('Keep this address handy').
- Carried forward: the typed address (held on the server) and the card's promise, 'set a reminder before Mon 26 Oct'. Nothing carries the voter intent itself.
- MOMENT OF TRUTH: 'The copy is specific to each method, says must arrive by, and cites the Washington Secretary of State. It says nothing about whether this person is registered.'

COLLAPSED GAP (a bracket, not frames): 'Sat 10 Oct, 2:31–2:35 PM · account, email code and save · see flow-01'. The bracket ends at save; Today is the first screen after save, and every ask happens inline there (research brief §2).

WARMING THUMBNAIL (between the bracket and F02, 20%): 'f1-today-tab · ios · 03-warming · light' (PLACE B seconds after 'See Today', FreshnessLine 'Setting up Today for Birchfield Ct'), with the arrow 'providers return' into F02. F02 is Today after warming resolved.

F02 · Sat 10 Oct, 2:35 PM · iOS · f1-today-tab · saved place, first open after warming · from 'f1-today-tab · ios · 02-saved-place-quiet · light'.
- Δ: dated Sat 10 Oct. The 14-day card runs Sat 10 Oct–Fri 23 Oct: two hollow Thursday rows (Thu 15 Oct and Thu 22 Oct), no voter row (Mon 26 Oct is outside the window) and no renters-insurance row (Jordan has not added one). The property-tax signal is removed: on Sat 10 Oct, Mon 2 Nov is 23 days out, outside its 14-day heads-up. The QuietDayReceipt source times are redated to Sat 10 Oct: 'weather 2:15 PM · air 2:00 PM · alerts 2:30 PM · your calendar 2:35 PM'.
- Unchanged from the export: the FirstWeekRow 'Next: set your pickup day →' and the briefing opt-in card (f4-briefing-optin-card) in its never-asked state (slot 10), with both rows asking: row 1 'The night before pickup?' and row 2 'A morning heads-up?' (caption 'Date reminders at 7:00 AM').
- Jordan does: scrolls to the briefing opt-in card (F02b).
- MOMENT OF TRUTH (Check): 'The promise from F01 is not carried. On Sat 10 Oct, Today cannot show a Mon 26 Oct date, and nothing on this screen points to the voter reminder. Draw it as it is and flag it.'

F02b · Sat 10 Oct, 2:36 PM · iOS · f1-today-tab · briefing opt-in card (f4-briefing-optin-card) Yes → OS permission · Redrawn from description, a small frame (three states side by side) based on the card in 'f1-today-tab · ios · 02-saved-place-quiet · light', with 'f4-briefing-optin-card · web-390 · 04-morning-grant-evening-also-on · light' (frame 4) cited as the specimen for state (c).
- Shows: (a) Jordan taps 'Yes' on row 2, 'A morning heads-up?' (caption 'Date reminders at 7:00 AM'); row 1 has never been answered. (b) the iOS system notification dialog over Today, with Jordan tapping Allow. (c) the card in its granted state: row 2 collapsed to 'Morning briefing · 7:00 AM · Change', and row 1 collapsed to 'The night before pickup · 6:00 PM · Change' with the status 'Also on: the night before pickup' (a morning grant turns on the evening briefing only when the night-before row was never answered).
- Margin note: 'The OS grant is what F07 needs. Date reminders are on by default only where a reminder is set (Dates & bills). The morning row only sets their 7:00 AM time.' Put a 'Check' glyph on the note (see check 13).
- Tags: 'The permission that lets F07 reach him.' and 'Activation: briefing on'.
- Jordan does: then looks for the reminder the F01 card promised, does not find it, and taps the Place tab.
- MOMENT OF TRUTH: 'Permission is asked inline on Today, after a Yes, never at launch.'

F03 · 2:37 PM · iOS · x-place-file · saved place, first week · from 'x-place-file · ios · 02-saved-place-first-week · light'.
- Δ: the Set up caption reads 'For your first week · until Sat 17 Oct'. In the Set up block, 'Turn on a reminder or add the widget' is ticked (from F02b; checklist state syncs, and Today and the place file read the same step status); 'Set your pickup day' stays the Next step. The Dates voter row reads 'Register or update your voter registration' · 'Online or by mail · in 16 days · must arrive by Mon 26 Oct' · 'In person, Clark County Elections — until 8:00 PM Tue 3 Nov' · 'Statewide — WA' · filled · Washington Secretary of State. The Place row reads 'Moved in · Not set · Add' with the helper 'Add it to see a moving list for 60 days'. There is no Just moved section.
- Jordan does: taps 'Moved in · Add'.
- Carried to F04: scope = saved place, kind = Move-in date.
- MOMENT OF TRUTH: 'The moving list needs a move-in date, and this is the one row that asks for it at T1. The Dates voter row is already here as a second way in (see B03).'

F04 · 2:37 PM · iOS · x-date-sheet · create, Move-in date, saved place · Redrawn from description, based on 'x-date-sheet · ios · 07-view-seeded-voter · light' chrome.
- Shows: 'Close'; title 'Add a date'; collapsed row '[glyph] Move-in date · Change'; date field with 'Fri 9 Oct 2026' under it (a past date, valid for this kind); Remind me hidden, with 'No reminders for past dates.'; no 'Visible to' choice; footer 'Only you will see this.'; Save.
- Jordan does: types or picks Fri 9 Oct 2026 and taps Save. The status reads 'Saved to your calendar. Only you.' and the sheet closes.
- Carried to F05: move-in date = Fri 9 Oct 2026, which switches on the Just moved rows for 60 days.
- MOMENT OF TRUTH: 'Scope is stated at input, and a saved place never offers household words.'

F05 · 2:38 PM · iOS · x-place-file · saved place with Just moved · Redrawn from description, based on 'x-place-file · ios · 02-saved-place-first-week · light' and the mover rows of 'x-place-file · ios · 01-dense-home · light'.
- Shows: FactCount '3 on file' (address, the hollow Thursday seed, moved in), with a small frame note 'Per the x-place-file count rule: "County and state rules are shown but not counted."' (the voter rule is on this screen but not in the count). 'Moved in · Fri 9 Oct 2026' with the you-added tick. A new section, JUST MOVED, with the caption 'Shown until Tue 8 Dec, 60 days after you moved in', and three rows, each with a leading 'Mark done' tick control, a body and a trailing 'Hide': 'Forward your mail' · USPS; 'Move your utilities' (draw the title only, with the provider line greyed and labelled 'Camas providers: to confirm'); 'Update your voter registration' · 'Registration is per address. Online or mail must arrive by Mon 26 Oct · in person until 8:00 PM Tue 3 Nov' · SourceCaption 'Washington Secretary of State · statewide'.
- Jordan does: taps the body of 'Update your voter registration'.
- Carried to F06: the seeded statewide rule id. At a saved place the body opens the DateSheet in view-seeded voter mode, because PLACE B cannot open Place › Civic (see check 5).
- MOMENT OF TRUTH: 'The mover row appears at T1 because move-in was asked for, and it names both methods with the source.'

F06 · Sat 10 Oct, 2:39 PM · iOS · x-date-sheet · view-seeded voter registration + plan · Redrawn from description, based on 'x-date-sheet · ios · 07-view-seeded-voter · light'.
- Δ from the export: dated Sat 10 Oct. Method row 1 'Online or by mail — must arrive by Mon 26 Oct 2026', caption 'in 16 days'. Method row 2 'In person, Clark County Elections — until 8:00 PM Tue 3 Nov 2026', caption 'in 24 days'. Remind me: 60 and 30 disabled with the line '60 and 30 days have passed for this date.'; Jordan selects 7 days. Timeline ticks: 'Mon 19 Oct 2026 · 7 days before', 'Sun 25 Oct 2026 · Day before', 'Mon 26 Oct 2026 · Day of', with the caption 'We'll also remind you the day before and on the day.'
- Unchanged from the export: title 'Voter registration'; filled mark; caption 'Washington Secretary of State · statewide · checked Oct 2026'; headline 'General election · Tue 3 Nov 2026'; the line 'If you moved, update your registration to this address. We can't see whether you're registered.'; plan 'How will you register?' Online · Mail · In person, with Online picked; primary 'I did this'; 'Check or update at VoteWA ↗'; footer 'Only you will see this.'
- Jordan does: picks Online and 7 days. The status reads 'Reminders updated'. He taps Close without 'I did this'.
- Carried forward: plan = Online, which anchors the reminder series to Mon 26 Oct (not Tue 3 Nov); reminders at 7:00 AM on Mon 19 Oct, Sun 25 Oct and Mon 26 Oct; scope = Only you.
- MOMENT OF TRUTH: 'The plan decides which deadline the reminder follows, and the sheet says in words that it cannot see registration status.'

TIME GAP: 'Nine days later · Mon 19 Oct 2026 · 7:00 AM', with a broken-axis mark.

F07 · Mon 19 Oct, 7:00 AM · iOS lock screen · ext:os-push-tray · date reminder · Redrawn from description, as a Foundations PushCopy tray preview.
- Shows (PROPOSED copy; no prompt defines a voter reminder): title 'Update your voter registration' (30 characters); body 'Online or mail must arrive by Mon 26 Oct' (40 characters); one action 'Done'; Active level on iOS, DEFAULT importance on Android (Dates & bills); morning slot; no address and no place label.
- Jordan does: nothing until evening. At 6:10 PM (TODAY) he taps it in Notification Center. The tap clears the delivered item.
- Arrow F07→F08: 'push tap at 6:10 PM · rule link · Mon 26 Oct is inside the 14-day strip → Today row'. Tag: session_open { trigger: 'push', kind: 'date' }.
- MOMENT OF TRUTH: 'The push names the method and the must-arrive date. It never says he is unregistered.'

F08 · Mon 19 Oct, 6:10 PM · iOS · f5-today-calendar-strip inside Today · reminder landing · 'f5-today-calendar-strip · ios · 06-reminder-landing · light' (an export of HOME A's window).
- Δ: PLACE B context — location row ScopeChip 'Saved place · Only you'; hollow Thursday marks on Thu 22 and Thu 29 Oct; footer 'Only you will see this.'; the window as in 'f5-today-calendar-strip · ios · 03-saved-place-unconfirmed · light' with the renters-insurance row dropped, so the summary reads 'Next 14 days: 3 items' and the strip's spoken label says 3 items to match.
- Shows: the Mon 26 Oct cell filled by a full-height bar; the highlighted, focused row 'Register or update to vote: online or mail' · 'in 7 days · must arrive by Mon 26 Oct' · 'In person: until 8:00 PM Tue 3 Nov' · region chip 'Statewide — WA' · 'Washington Secretary of State · statewide · 2026 general election' · official.
- Carried to F09: the rule id; the DateSheet opens in view-seeded mode.
- MOMENT OF TRUTH: 'Mon 26 Oct is a full-height bar with a region chip, so it is visibly not a claim about his house.'

F09 · 6:10 PM · iOS · x-date-sheet · view-seeded voter, Mon 19 Oct · 'x-date-sheet · ios · 07-view-seeded-voter · light'.
- Δ PROPOSED (check 7), labelled so on the frame: Remind me shows 7 days selected and enabled, as Jordan's choice (its reminder was sent today at 7:00 AM); 1 day is not selected. 60 and 30 are disabled with the line '60 and 30 days have passed for this date.' The first tick reads 'Mon 19 Oct 2026 · 7 days before · sent 7:00 AM'; the other ticks are 'Sun 25 Oct 2026 · Day before' and 'Mon 26 Oct 2026 · Day of'. Beside it, draw a small inset of the export's own control (1 day selected, with the line '60, 30 and 7 days have passed or fall today.') so both versions are visible.
- Unchanged: plan Online, selected; everything else as exported, including 'in 7 days' and 'in 15 days'.
- Jordan does: taps 'Check or update at VoteWA ↗'.
- MOMENT OF TRUTH: 'The check goes to the official state site. The app never answers it.'

F10 · 6:11–6:24 PM · iOS · ext:votewa · in-app browser · Redrawn from description: a system in-app browser sheet with 'Done' and the address bar 'votewa.gov', its content drawn as a flat grey block labelled 'State site — not drawn'.
- Jordan does: registers online (he has had his Washington licence since Fri 16 Oct) and taps Done. The DateSheet is still open underneath.
- MOMENT OF TRUTH: 'The detour keeps his place: Done returns to the same sheet with focus on the VoteWA row.'

F11 · 6:25 PM · iOS · x-date-sheet · 'I did this', person-scoped · 'x-date-sheet · ios · 09-voter-marked-done · light' exactly.
- Shows: 'You marked this done · Mon 19 Oct · Only you'; 'We won't remind you again about this.'; InlineUndo 'Marked done · Undo'. One light haptic tick.
- Carried forward: the Sun 25 Oct and Mon 26 Oct reminders cancelled; the delivered 7:00 AM item is already cleared from Notification Center by his F07 tap, and its row in the in-app Notifications list updates to done; the self-report stored for Jordan only. (The tray-replacement rule applies when 'Done' is tapped in the tray; see B10.)
- MOMENT OF TRUTH: 'This records what he did, for him only. It is never shown as a fact about the place or to a household.'

F12 · 6:25 PM · iOS · f5-today-calendar-strip · voter row after self-report · Redrawn from description, based on F08 without the highlight.
- Shows: the same row with the line 'You marked this done' under it; the Mon 26 Oct bar unchanged (the statewide rule still exists); focus on the row.
- MOMENT OF TRUTH: 'The rule stays; only his reminder and his status line change.'

F13 · 6:26 PM · iOS · x-place-file · mover row ticked · from the voter mover row crop in 'x-place-file · ios · 04-hide-skip-undo · light'.
- Δ: 'You marked this done Mon 19 Oct · We can't check registration status' with the static per-date chip 'Only you' (the export says Sat 17 Oct for Maya).
- Frame note (Check): 'Mover ticks at a saved place need a per-user saved-place store; the design doc stores them on HomeOccupancy (just_moved_done), which does not exist at T1.'
- Arrow F12→F13: 'tab tap: Place'.
- MOMENT OF TRUTH: 'The tick means he marked it, and the row says the app cannot check.'

F14 · Silent days · Redrawn from description: two grey lock-screen ghosts, 'Sun 25 Oct · 7:00 AM · no reminder (cancelled Mon 19 Oct)' and 'Mon 26 Oct · 7:00 AM · no reminder (cancelled Mon 19 Oct)'. Caption: 'Silence is the designed result.'

LAYOUT
- One horizontal lane per storyboard artboard, frames at 50% scale (F02b at 35%), left to right, each labelled above: 'F06 · Sat 10 Oct, 2:39 PM · iOS · x-date-sheet · view-seeded voter'. Mark redrawn frames 'Redrawn from description', deltas 'Δ' and proposed strings 'PROPOSED'.
- Branch crops are drawn at 35% so the lower lane holds them without overlap.
- Arrows are labelled with the trigger: 'tap follow-up row', 'sign up and save (flow-01)', 'providers return', 'tap Yes on A morning heads-up?', 'tap Allow', 'tab tap: Place', 'tap Moved in · Add', 'tap Save', 'tap mover row', 'tap Close', 'push at 7:00 AM', 'push tap at 6:10 PM', 'sheet opens', 'tap VoteWA', 'tap Done in browser', 'tap I did this', 'tap Close', 'tab tap: Place'.
- Time jumps and collapsed steps are labelled gaps or brackets, never plain arrows.
- Moment-of-truth callouts sit in a margin lane above the frames on surface.raised cards with an 'MOT' overline. Broken handoffs get a warning glyph and the word 'Check' (glyph colour only).
- Failure branches sit in a lower lane. Each branch leaves from the frame where it starts, with a downward arrow labelled by its condition, and rejoins with an upward arrow labelled 'rejoins F0N', or ends at a labelled terminal chip naming the surface it lands on. A branch placed on the artboard of its origin frame starts from that frame. A branch whose origin or rejoin is on another artboard (including every branch on the branches-only artboards 02 and 05) draws a ghost thumbnail (20%, greyed) labelled 'from F0N (artboard N)' or 'rejoins F0N (artboard N)'.
- §5 tags are small neutral pills on the arrows or frames they belong to.

FAILURE BRANCHES (lower lane; draw each one)
- B01 · After the online deadline (Tue 27 Oct onward) · from F09 (artboard 4), if Jordan had not registered · three crops: 'x-date-sheet · ios · 08-voter-after-deadline · light' (the online row closed in words, 'Online and mail registration have closed. You can still register in person until 8:00 PM Tue 3 Nov.', plan limited to In person, ticks 'Mon 2 Nov 2026 · Day before' and 'Tue 3 Nov 2026 · Day of'); 'f6-place-section-details · ios · 08-civic-in-person-only · light'; 'f8-seasonal-aha · web-390 · 06-in-person-phase · light' ('You can still register in person for Nov 3 — until 8:00 PM on Election Day.'). Callout: the Online plan does not switch to In person by itself; Jordan picks In person to get the new reminders. Nothing is suppressed. Ends with 'rejoins F11's state (dated Tue 27 Oct or later, In person plan)' (ghost, artboard 6).
- B02 · No seeded rule for the state · from F01 and F05 (ghost, artboard 3) · crops: 'f6-place-section-details · ios · 09-civic-absent-states · light' (block absent, crop a); the place file with no voter mover row and no Dates voter row (no empty shell); the DateSheet kind grid with no Voter registration tile; the preview falling back to the ranked card ('f8-seasonal-aha · web-390 · 09-deadline-passed-ranked · light'). Ends on x-place-file.
- B03 · No move-in date · from F03, if Jordan skips 'Moved in' · the mover rows never appear, but the Dates voter row 'Register or update your voter registration' opens the same view-seeded sheet. Draw the arrow from the F03 Dates row straight to F06. Rejoins F06 (ghost, artboard 3). Callout (Check): the design doc keys mover rows on Home.move_in_date and stores mover ticks on HomeOccupancy (just_moved_done), and neither exists at a saved place; the saved-place Move-in kind is new in x-place-file and x-date-sheet, so the server must support a saved-place move-in date and a per-user saved-place store for mover ticks (F13).
- B04 · Unverified seed · from F01 (ghost, artboard 1) · crops: 'f8-seasonal-aha · web-390 · 01-voter-7-days-unconfirmed · light' (HOLLOW, 'On record, not confirmed', 'as of Mon 19 Oct'); the sheet's hollow mark with 'Not yet checked against the Washington Secretary of State'; the f5 row caption ending '· not yet checked against the source'; 'f6-place-section-details · ios · 07-civic-unverified-multi-home · light', labelled 'specimen from HOME A' with a Δ: remove the block's named-home chip 'Larkspur Loop · Your household' (Jordan has one home); the page-header chip 'Your household' stays; the hollow mark stays; and an x-place-file crop of the Dates voter row drawn FILLED with the SourceCaption 'not yet checked against the state site', marked with a 'Check' glyph, because x-place-file keeps an unchecked official seed filled. Callout: 'f8, x-date-sheet, f5 and f6 show the hollow mark with the source; x-place-file shows a filled mark with a not-yet-checked caption. House-style invariant 1 says HOLLOW = on record, not confirmed.' Rejoins F02 (ghost, artboard 1; the same path, hollow on every surface except the x-place-file row).
- B05 · Every deadline has passed (after 8:00 PM Tue 3 Nov; drawn on Wed 4 Nov) · from F01 (ghost, artboard 1) or F09 (ghost, artboard 4) · crops: 'f8-seasonal-aha · web-390 · 09-deadline-passed-ranked · light'; 'f6-place-section-details · ios · 09-civic-absent-states · light' crop b ('No upcoming election'); the sheet line 'The deadline for November 3 has passed.' with the existing election banner. No reminders exist. Ends on Place › Civic (claimed home) or x-place-file (saved place).
- B06 · Notifications off (Jordan said Not now on both rows of the briefing opt-in card in F02b) · from F06 · the sheet line 'Notifications are off. These show on Today and in your place file.' under Remind me; F07 does not happen. On Mon 19 Oct he opens the app himself and sees the voter row in 'f5-today-calendar-strip · ios · 03-saved-place-unconfirmed · light' (the Mon 26 bar is inside the window from Tue 13 Oct). Tapping the row opens F09. Rejoins F09 (ghost, artboard 4; trigger: organic). Callout (Check): Remind me can be set with no push permission, and nothing asks for it.
- B07 · Jordan claims PLACE B before Mon 26 Oct (flow-06) · from F05 · crops: 'f1-today-tab · ios · 13-after-claim · light' (chip 'Your household', notice 'Birchfield Ct is now your home · See what moved'); the mover row body now opens Place › Civic ('f6-place-section-details · ios · 02-civic-dense · light', labelled 'specimen from HOME A' with a Δ: remove the block's named-home chip if the export shows one (one home); the page-header chip 'Your household' stays; with 'Check or update at VoteWA ↗' and a separate 'Remind me'); after 'I did this', the block line 'You marked this done · Only you will see this.' ('f6-place-section-details · ios · 07-civic-unverified-multi-home · light', labelled 'specimen from HOME A' with a Δ: remove the block's named-home chip 'Larkspur Loop · Your household' (one home), the page-header chip 'Your household' stays, and the mark is drawn FILLED to match this storyboard's checked seed). His plan and reminders carry across the claim, and voter registration stays Only you with no choice offered. Rejoins F11 (ghost, artboard 6).
- B08 · Offline at the self-report · from F10 (ghost, artboard 4) · Redrawn from description: the sheet shows 'You marked this done · Will save when you're back online.'; the VoteWA row is disabled with 'You're offline. You can open this when you're back.' (as in 'f6-place-section-details · android · 12-offline · light'). Rejoins F11 (ghost, artboard 6) once synced.
- B09 · Mis-tap on 'I did this' · from F11 · 'Marked done · Undo' tapped: the done line goes, the Sun 25 Oct and Mon 26 Oct reminders are restored, and the status reads 'Reminders updated'. Rejoins F09 (ghost, artboard 4).
- B10 · Jordan taps 'Done' in the tray instead of opening (the flow-03 B12 pattern) · from F07 (ghost, artboard 4) · Redrawn from description: the tray item is replaced (not left behind), the Sun 25 Oct and Mon 26 Oct reminders are cancelled, the self-report is stored for Jordan only, and on his next open the Today voter row shows 'You marked this done' with a PROPOSED InlineUndo 'Marked done from a notification · Undo'. Rejoins F12 (ghost, artboard 6).

HANDOFF CHECKS (draw on the handoff artboard; each item joins its frames and quotes both strings)
1. F01 and F02 must agree on the promise. F01 says 'Keep this address to set a reminder before Mon 26 Oct', but on Sat 10 Oct Today's strip ends Fri 23 Oct and nothing on Today or the save confirmation leads to the voter reminder. Propose one pointer (for example, a FirstWeekRow or save-confirmation line) or reword F01 to 'Keep this address handy'.
2. F01, F03, F05, F06, F08 and F13 must agree on the row title: 'Update your voter registration' (x-place-file mover row), 'Register or update your voter registration' (x-place-file Dates row), 'Register or update to vote: online or mail' (f5), 'Voter registration' (x-date-sheet title) and 'Your registration for the Tue 3 Nov election' (f6). Keep the action-first form and never imply status.
3. F01, F06 and F08 must agree on the method wording: 'must arrive by Oct 26' (f8 headline, no weekday), 'Online or by mail — must arrive by Mon 26 Oct 2026' (x-date-sheet), 'in 7 days · must arrive by Mon 26 Oct' (f5), 'Online or mail must arrive by Mon 26 Oct' (x-place-file mover row). The in-person line also varies: 'In person: until 8:00 PM Tue 3 Nov at your county elections office.' (f8), 'In person, Clark County Elections — until 8:00 PM Tue 3 Nov 2026' (x-date-sheet), 'In person: until 8:00 PM Tue 3 Nov' (f5). (flows-spec gap: x-place-file once showed 'October 26, 2026 · Statewide — WA' as one date; confirm it now shows both methods.)
4. F01 and F06 must agree on the mark and the source caption at the same moment: f8 ships the seed HOLLOW 'as of Mon 19 Oct', while x-date-sheet, f5, f6 and x-place-file draw it FILLED ('checked Oct 2026', '2026 general election', 'statewide'). One confidence value must drive every surface. For an unchecked seed the surfaces also disagree on the mark itself: x-place-file says 'An official seed not yet checked against its authority stays filled; its SourceCaption reads "not yet checked against the state site".', while f8, x-date-sheet and f5 draw it HOLLOW, and house-style invariant 1 reads 'HOLLOW = on record, not confirmed'. Quote the x-place-file rule against the hollow rule (B04). The unchecked caption also varies: 'Not yet checked against the Washington Secretary of State' (x-date-sheet), '· not yet checked against the source' (f5) and 'not yet checked against the state site' (x-place-file).
5. F05 and F06 must agree on where the voter row goes at T1. f6 says PLACE B cannot open Place › Civic, and flows-spec step 3 assumed it could. The storyboard uses the f6 proposal (DateSheet view-seeded voter at a saved place; Civic at a home, B07). (flows-spec gap: f6's 'Check or update' once opened the Date sheet; it now goes to VoteWA, with 'Remind me' separate.)
6. F03 and F05 must agree on the move-in trigger: the mover rows appear only after the Move-in date is saved, and the Just moved caption date equals the move-in date plus 60 days ('Shown until Tue 8 Dec').
7. F06 and F09 must agree on the reminder series. On Sat 10 Oct the 7-day lead is open and Jordan picks it; on Mon 19 Oct the x-date-sheet 07 export shows 1 day selected with '60, 30 and 7 days have passed or fall today.', while f5-06 says the landing follows 'its 7-day reminder'. F09 draws 7 days selected and enabled (sent 7:00 AM today) with '60 and 30 days have passed for this date.', labelled PROPOSED, beside an inset of the export's control. Record the PROPOSED 'lead day is today' rule on Notes (the same open decision as flow-03 check 18).
8. F07 and F08 must agree on the landing rule: Mon 26 Oct is 7 days away, inside the 14-day strip, so the push lands on Today's row (f5, f3-household-notifications route), not the place file.
9. F11, F12 and F13 must agree on the done wording: 'You marked this done · Mon 19 Oct · Only you' (x-date-sheet), 'You marked this done' (f5), 'You marked this done Mon 19 Oct · We can't check registration status' + chip 'Only you' (x-place-file), 'You marked this done · Only you will see this.' (f6). The honesty line also varies: 'We can't see whether you're registered.' (sheet) vs 'We can't check registration status' (place file). The button is 'I did this' everywhere (flows-spec called it 'You marked this done').
10. F11, F14 and B10 must agree that resolving the item cancels the Sun 25 Oct and Mon 26 Oct reminders. In F11 the delivered 7:00 AM item was already cleared by the tap and its in-app Notifications row updates to done; in B10 ('Done' in the tray) the tray item is replaced, not left behind.
11. F02, F03 and x-place-file / f1-today-tab must agree on Jordan's save date. Those prompts moved it to Sat 17 Oct (x-place-file's caption reads 'until Sat 24 Oct') so that he is inside his first week on Mon 19 Oct; this storyboard uses the fixture, Sat 10 Oct, so his first week ends Sat 17 Oct and the Set up block and FirstWeekRow are gone by F08.
12. B06 and F06 must agree on permission: the sheet lets a person set a reminder with notifications off, and no surface asks for permission from that moment.
13. F02b and F07 must agree on which switch lets a 7:00 AM date reminder through. Quote side by side: the research brief §3 table ('Briefings | Evening (6:00 PM) pickup …; morning (7:00 AM) date items | … | Evening on; morning on only if chosen on the card'); the f4-briefing-optin-card morning row ('A morning heads-up?' · 'Date reminders at 7:00 AM'); and f4-notification-settings ('date reminders are controlled only by Dates & bills; the morning briefing only shares their send time'). F02b draws the morning row granted, so F07 arrives under either reading; under the brief's reading, an evening-only Yes would not deliver F07.

ACCESSIBILITY IN THE JOURNEY (draw on the accessibility artboard as a lane under F01–F13 thumbnails, including F02b)
- F01: the follow-up row is one target; after the tap, the preview scrolls once and focus moves to the wall's heading. The card reads headline → chip → detail → source (with 'official') → follow-up → VoteWA.
- F02: after save, Today opens with focus at the top (the location row and its chip), with no tour. While warming, nothing steals focus as each slot fills in.
- F02b: 'Yes' on the morning row is one target; the system dialog takes focus; after Allow, focus returns to the briefing opt-in card, whose granted state ('Morning briefing · 7:00 AM' and 'Also on: the night before pickup') is announced as a polite status.
- F03: the Place tab opens with focus on the title 'Your place file'. The band's spoken summary includes the Oct statewide bar. The ticked Set up step is spoken 'Turn on a reminder or add the widget, done'.
- F04: the sheet opens with focus on its title; Save gives the polite status 'Saved to your calendar. Only you.'; on close, focus returns to 'Moved in, Friday 9 October 2026, you added this'. A second polite status (PROPOSED) reads 'Just moved: 3 steps added above.', because the new section appears above the focused row.
- F06: focus lands on the title 'Voter registration'. Reading order: title, date, source, method rows, plan, reminders, I did this, VoteWA link, footer. Chips are spoken 'Online, selected'; disabled leads are focusable and read their reason; the timeline is spoken 'Reminders on Mon 19 Oct, Sun 25 Oct and Mon 26 Oct.'; 'Reminders updated' is a status message.
- F07: VoiceOver reads the title, body and 'Done, button'. With previews hidden, the placeholder is 'Date reminder' (Foundations PushCopy V8; the research brief's placeholder list lacks it).
- F08: the landing scrolls once and moves focus to the row, spoken 'Register or update to vote, online or mail, must arrive by Monday 26 October, in 7 days, applies across Washington, Washington Secretary of State, official'. The strip summary is spoken with 3 items. Under Reduce Motion it jumps and cross-fades.
- F09→F10: the link is spoken 'Check or update at VoteWA, opens the state voter site'. The in-app browser has a visible Done; on return, focus goes back to the VoteWA row.
- F11: one light haptic tick; 'Marked done' and 'We won't remind you again about this.' are status messages; Undo stays focusable with no countdown.
- F12: on close of the sheet, focus returns to the Today voter row, spoken '…, you marked this done'.
- F13: after 'tab tap: Place', focus lands on the place file title. When the mover row is reached, it is spoken '…, you marked this done Monday 19 October, only you, we can't check registration status'.
- No-notifications path (B06): draw a thin parallel lane from F06 to F09 labelled 'No push: what carries the deadline' — the Mon 26 bar and row on Today from Tue 13 Oct, the place file Dates row, and the band's Oct bar.
- Greyscale: filled, hollow and tick marks, the statewide bar and the done line all read without colour.

INSTEAD OF
- Instead of a single 'closes Oct 26' date, draw both methods with their own deadlines on every frame, because in-person registration stays open until 8:00 PM Tue 3 Nov.
- Instead of a registered or unregistered badge anywhere, draw 'I did this' with 'Only you' and 'We can't check registration status', because the app cannot know.
- Instead of hiding the F01→F02 break, draw it and flag it, because the storyboard exists to show what breaks between screens.
- Instead of collapsing the briefing Yes into the sign-up bracket, draw it on Today (F02b), because the brief puts every ask inline on Today after save.
- Instead of an unnamed 'Yes on the briefing card', name the row Jordan answers (the morning row), because each row gives a different granted state and a different answer to check 13.
- Instead of Place › Civic at a saved place, draw the DateSheet view-seeded voter mode, because PLACE B cannot open Civic today.
- Instead of a dot on Mon 26 Oct, draw the full-height statewide bar with 'Statewide — WA', because it is not a fact about his house.
- Instead of saying web has no push, draw the web reminder as a browser notification when the browser allows it, because f4-notification-settings sends to 'this iPhone and one browser'.
- Instead of redrawing any attached export, place it as-is and mark only the listed deltas; where a delta changes an export's content (F09), label it PROPOSED and show the export's version beside it.

DONE WHEN
- The main lane reads Sat 10 Oct to Mon 26 Oct 2026. The overview and branches extend to Wed 4 Nov. Every frame is dated and every gap labelled.
- The briefing permission is drawn on Today after save (F02b), with the answered row named, before the push that depends on it.
- The plan (Online) visibly decides the reminder dates, and the same three dates appear in F06, F07, F09 and F14.
- The push lands on the Today row inside the strip, with focus there, and the sheet opens on it.
- No frame states or implies whether Jordan is registered, and the self-report reads Only you on every surface it touches.
- The F01→F02 break and the other 12 handoff checks are drawn with both strings quoted.
- All 10 branches are drawn with their recovery and where they land or rejoin, including the in-person-only path after Mon 26 Oct.
- Every invented or proposed string is on Notes.

ARTBOARDS (each label is shown above its artboard)
1. flow-13 · storyboard · 01-aha-to-place-lane · light — F01, the flow-01 bracket, the warming thumbnail, F02, F02b and F03, callouts, and branches B02 (with a ghost of F05, 'artboard 3') and B03 (rejoin ghost of F06, 'artboard 3').
2. flow-13 · storyboard · 02-aha-branches · light — branch B04 at 35%, from a ghost of F01 ('artboard 1') with its five crops and a rejoin ghost of F02 ('artboard 1').
3. flow-13 · storyboard · 03-move-in-and-plan-lane · light — F04–F06, callouts, and branches B06 (rejoin ghost of F09, 'artboard 4') and B07 (rejoin ghost of F11, 'artboard 6').
4. flow-13 · storyboard · 04-reminder-lane · light — the nine-day gap, F07–F10 (with F09's PROPOSED Δ and export inset), callouts and the metric tag.
5. flow-13 · storyboard · 05-reminder-branches · light — branches B01, B05, B08 and B10 at 35%, each from a ghost of its origin (F01 'artboard 1'; F07, F09 or F10 'artboard 4'), with rejoin ghosts of F11's state, F11 and F12 ('artboard 6').
6. flow-13 · storyboard · 06-self-report-lane · light — F11–F14, callouts, and branch B09 (rejoin ghost of F09, 'artboard 4').
7. flow-13 · storyboard · 07-journey-overview · light — one time axis (Sat 10 Oct → Mon 19 Oct → Sun 25 Oct → Mon 26 Oct → Tue 3 Nov → Wed 4 Nov) with F01–F14 (and F02b) as 20% thumbnails, the two method deadlines as labelled bars, the three reminder ticks (the last two struck with 'cancelled Mon 19 Oct') and the §5 tags.
8. flow-13 · storyboard · 08-handoff-checks · light — the 13 checks as joined crops with the strings quoted side by side (12pt minimum).
9. flow-13 · storyboard · 09-accessibility-lane · light — focus landings, announcements and the no-notifications lane.
10. flow-13 · storyboard · 10-platform-lane · light — the same moments on other platforms: 'f8-seasonal-aha · web-390 · 02-voter-official · light' (the web /start preview), 'f8-seasonal-aha · android · 19-voter-7-days · light', 'x-date-sheet · web-390 · 33-view-seeded-voter · light' (VoteWA opens a new tab), a Redrawn-from-description web browser notification for Mon 19 Oct, 7:00 AM ('Update your voter registration' / 'Online or mail must arrive by Mon 26 Oct', PROPOSED), and 'f4-notification-settings · web-1440 · 16-browser-blocked · light' as the blocked case. Label: 'On web the Mon 19 Oct reminder arrives as a browser notification if this browser allows it; otherwise through the Notifications list and the B06 path.' On web, the briefing opt-in card's Yes opens the browser's own permission dialog.
11. flow-13 · Notes — 
  - Recast: Jordan moved from Portland to PLACE B in Camas on Fri 9 Oct, not Vancouver in September; account and save Sat 10 Oct; f8's unnamed visitor becomes Jordan.
  - Specimens: the f6 07 and 02 crops in B04 and B07 are HOME A exports; the storyboard removes the block's named-home chip 'Larkspur Loop · Your household' (Jordan has one home), keeps the page-header chip 'Your household', and in B07 draws the mark filled. The f4-briefing-optin-card frame 4 specimen is web-390; F02b draws the same state on iOS.
  - Resolved in this storyboard: F02b answers the morning row, not the evening row, so that the 7:00 AM date reminder in F07 arrives under both readings of check 13; the evening briefing turns on with it ('Also on: the night before pickup').
  - Sourced from x-date-sheet (not invented): 'No reminders for past dates.'; 'You marked this done · Will save when you're back online.'. Sourced from x-place-file's count rule: seeded statewide rules are not counted in FactCount ('3 on file' in F05).
  - Invented and proposed strings: 2:30 PM and the 2:31–2:35 PM bracket; F02b's timing and the granted-state announcement; F02's redated receipt times ('weather 2:15 PM · air 2:00 PM · alerts 2:30 PM · your calendar 2:35 PM') and Sat 10 Oct strip rows; 'Next 14 days: 3 items' (F08, derived); Jordan's licence arriving Fri 16 Oct; the push 'Update your voter registration' / 'Online or mail must arrive by Mon 26 Oct' (iOS and web); 'sent 7:00 AM'; '60 and 30 days have passed for this date.' (F06, F09); 'Just moved: 3 steps added above.'; 'Shown until Tue 8 Dec, 60 days after you moved in'; 'Camas providers: to confirm'; 'State site — not drawn'; 'Marked done from a notification · Undo' (B10); the F02b margin note; every frame label and callout. ('Date reminder' is not invented: it is Foundations PushCopy V8. The research brief's placeholder list lacks it; add it there. 'votewa.gov' is the real state domain.)
  - Open decisions: which surface carries the F01 promise (check 1); one title and one method wording (checks 2–3); one confidence value, whether an unchecked official seed is drawn filled (x-place-file) or hollow (f8, x-date-sheet, f5, house-style invariant 1), and one unchecked caption (check 4, B04); the T1 civic destination (check 5); the PROPOSED 'lead day is today' rule — a lead whose day is today stays selected and enabled once its reminder has been sent, and the passed-lead line names only leads before today (check 7, shared with flow-03 check 18); one done line and one honesty line (check 9); which switch gates a 7:00 AM date reminder — the morning briefing (brief §3, the card's morning caption) or Dates & bills alone (f4-notification-settings) (check 13); whether tray 'Done' needs an Undo on next open (B10); where mover ticks are stored at a saved place, since HomeOccupancy does not exist at T1 (B03, F13); whether a move-in date or a seeded voter plan counts as the activation date; whether 'Add one date that matters' is ticked by a move-in date; whether the Set up block and Next row persist after Sat 17 Oct; whether Remind me should lead to a permission ask (check 12); counting voter-row reports in the honesty counter.
  - Omitted: Mail as the plan (same as Online), the evening-row-only answer on the briefing card (see check 13), the 'Move your utilities' destinations at PLACE B, the Sun 25 Oct reminder landing (identical to F08 with 'Tomorrow'), and dark twins.

BATCH PLAN (at most 6 artboards per turn)
- Turn 1: artboards 1–4, then wait for 'continue'.
- Turn 2: artboards 5–8, then wait for 'continue'.
- Turn 3: artboards 9–11.
