# Keeper strip on Today
id: f11-keeper-strip · platforms: web/ios/android · isNew: False · artboards: 26

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Keeper strip on Today · f11-keeper-strip

TYPE: EXTENSION of the existing designed screen "Today". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. The changes are one strip in Today's keeper slot, between the 14-day strip and the weather block, plus the landing highlights listed under INTERACTION (BillRow, FourteenDayStrip rows, QuietDayReceipt and PickupCard). Every other section keeps its order and look. Never place the strip above the location row, above an alert or above a pinned briefing.

ATTACH: Today on iOS 393x852 for HOME A (dense, light and dark); Today on Android 412x915, web 1440x900 and web 390x844; Today with the air alert pinned; Today with a pinned briefing; Today for PLACE B with the "Saved place · Only you" chip; the place file (Place tab) top section with its FactCount header and Keeper row; the Bills list with a BillRow and its overflow menu.

PLATFORMS & VIEWPORTS: iOS 393x852 (primary), Android 412x915, web 1440x900 (left sidebar, main column) and web 390x844 (bottom tab bar).

WHERE IT LIVES & HOW PEOPLE ARRIVE: Today tab (bottom bar on phones, sidebar on desktop). Entry points:
- The Today tab; the deep links /app/today and pantopus://today; a widget tap (pantopus://today?src=widget).
- The pickup and briefing push landings. On a briefing landing the pinned briefing sits above the strip, and the mood line must agree with the push that caused the visit.
- Coming back from the naming sheet. The sheet hands over a name and species; the pose settles in place and the caption "Ollie is on Today now." sits under the strip until the person leaves Today.
- From the claim receipt (flow-06): after PLACE B is claimed, Pepper stays Pepper, and the strip switches to household mood inputs and FactCount V2. The receipt, not the strip, states that everyone in the household will now see the keeper.
The strip hands off in three places: the mood line opens the item it summarises, and that item offers a correction; the count opens the place file, which shows the same number; the name opens the keeper menu.

WHO AND WHEN: Maya Chen at HOME A on Mon 19 Oct, 6:10 PM, checking whether bins go out tonight. She named the River otter "Ollie" last week. Sam Ortega (member) sees the same keeper. Jordan Lee at PLACE B named a Red fox "Pepper".

THE ONE JOB: Put a calm face on what is really due at this address in the next 7 days, in words first.

FIRST FIVE SECONDS: First the mood line (the fact). Second the pose and name. Third "14 on file". There is no primary action: the strip asks for nothing. Its only targets are the mood line, the count and the name.

CONTENT (fixture deltas only; list every invented string on Notes)
- Keeper: Ollie, River otter. Species set: Octopus, River otter, Great blue heron, Red fox, Raccoon, Douglas squirrel.
- Fixture delta: HOME A's pickup day is confirmed by Maya (You · Tuesday), so HOME A pickup lines carry no unconfirmed mark.
- Mood inputs: the bills, tasks, mail items and calendar rows people here added (at a saved place, only you), plus seeded pickup and seeded property tax, due or overdue in the next 7 days (rolling, not a calendar week). Pickup counts only on the day before. Seeded voter registration rows are excluded, so the keeper never implies whether anyone is registered. Mood never comes from app opens or time away.
- Mood states. The mood word is a caption after the name; the mood line is the fact:
  1. Calm · "No bills or dates due in the next 7 days." Wed 21 Oct, 8:00 AM; both utility bills marked paid by Sam · Sun 18 Oct. Shown only when the keeper's own bill, task, mail and calendar checks all succeeded (the host QuietDayReceipt being ticked is not enough). Pose: sitting, settled.
  2. On it · "Recycling and garbage tomorrow." Mon 19 Oct; Clark Public Utilities marked paid by Sam · Sun 18 Oct. One thing in the window. Pose: upright, looking toward the line.
  3. Busy (dense default, TODAY exactly) · "Recycling and garbage tomorrow. Clark Public Utilities is due in 4 days · Fri 23 Oct." Two or more things, none overdue. Pose: holding a small stack of papers. With 3 or more: "3 things due in the next 7 days." (Fri 30 Oct, both utility bills marked paid by Sam, water marked paid by Sam · Tue 27 Oct: HOA dues Sun 1 Nov, Comcast Mon 2 Nov, property tax 2nd half Mon 2 Nov).
  4. 1 overdue (internal name: needs you) · "The Clark Public Utilities bill is past its due date. 1 more due in the next 7 days." Sat 24 Oct, 9:00 AM, not marked paid. Pose: holding up an envelope toward the line.
- Unavailable: no mood word, neutral pose, "Couldn't check what's due. Your bills didn't load." and "Retry". Two failed inputs: "Your bills and mail didn't load."
- Offline: "On it · as of 7:04 AM", the line kept, the avatar desaturated.
- Count: FactCount V2 "14 on file" with Place · Dates · Money · People, the same number as the place file header for HOME A. Proof is unknown, so nothing is drawn for it.
- PLACE B, Wed 21 Oct, 6:10 PM: "On it · Pickup tomorrow." followed by a hollow ProvenanceMark (at least 12pt) with no words; the PickupCard below carries "City schedule, not yet confirmed" once. Mood comes only from pickup and dates Jordan added. Count: FactCount V3 T1 "7 on file" with Place · Dates only.
- Guest without bill access at HOME A, Mon 19 Oct: "On it · Recycling and garbage tomorrow." and "8 on file" with Place · Dates · People, no Money pip; their place file shows the same 8.
- Worst case: the 24-character name "Captain Wigglebottom the" with the 1 overdue line, at 393pt and at AX5.

LAYOUT & VISUALIZATION
- Phones (393pt / 412dp / 390px), one row as the KeeperStrip contract defines: the 44pt avatar on the left; a text column holding the name line (name in bodyMedium 16/24/500, then the mood word in caption 12/16 text.secondary, then a small chevron-down glyph) and the mood line (bodySmall text.primary); FactCount V2 on the right, exactly as Foundations draws it: a right-aligned vertical block at most 160pt wide, the integer in h3 with "on file" in caption on line 1, and word-pill pips below (Place · Dates · Money on one pip line, People wrapping to the next). The mood line wraps to as many lines as it needs in the remaining column and never truncates. 12pt vertical padding, no card chrome beyond the host's section spacing.
- Pips are always words in pills on surface.sunken, never a dot or circle glyph, so nothing can be read as a provenance mark next to PLACE B's hollow ProvenanceMark.
- Web 1440: one row; FactCount V2 trailing, at most 160px wide.
- AX5 (iOS) or 200% (Android): avatar on top, name and line full width, and the FactCount block moves below the name and mood line, full row width.
- Pose carries mood; colour never does. Every species has 4 clearly different postures that read at 44pt, plus a neutral front-facing pose for Unavailable in a single text.secondary outline with no fill. Nothing sad: no tears, drooping, illness, cowering or darker scenery.
- FactCount is an open set of pills, never a closed shape, so nothing reads as a share of a goal. A saved place shows a smaller complete set.
- Mood line targets: one item opens that item. Several items (3 or more) is one target that scrolls Today to the FourteenDayStrip rows and highlights those rows once. Calm scrolls Today to the QuietDayReceipt.
- Missing data: a failed input gives Unavailable, never Calm. Offline keeps the last-known state with its time. With no keeper, Today is drawn exactly as today.

INTERACTION, MOTION & HAPTICS
- The overdue line lands on its BillRow, highlighted once, with an "Already paid?" text button (44pt) on the highlighted row. It opens the row's existing overflow menu (Mark paid · Paid a different amount · Skip this month). Choosing Mark paid shows InlineUndo, and the household hears nothing until Undo closes.
- The PLACE B line lands on the PickupCard, whose confirm reads "Yes, Thursday is right" beside "Change pickup day".
- FactCount opens the place file.
- The name opens a native menu (iOS menu, M3 dropdown, web popover): Rename · Change species · Hide keeper for now · Remove keeper. Each is also a screen-reader custom action. Rename and Change species open the naming sheet.
- Hide keeper for now hides it only on the viewer's Today; others still see it. Options: "Hide for 7 days · until Mon 26 Oct" and "Hide for 31 days · until Thu 19 Nov". The slot closes to InlineUndo "Keeper hidden until Mon 26 Oct · Undo". It returns early from the place file's Keeper row, "Show keeper now".
- Remove keeper removes at once, no dialog. The slot closes and InlineUndo reads, at HOME A, "Ollie removed for everyone in this household · Undo"; at PLACE B, "Keeper removed · Undo". The removal reaches Sam's Today only after Maya leaves Today without tapping Undo.
- Offline: menu items are disabled with the caption "You're offline. You can change the keeper when you're back."
- Unnamed invitation: appears only after a first value moment (a confirmed pickup day or a saved date) and after the FirstWeekRow has gone, for at most 14 days. A row with an outline silhouette in text.secondary, "Give your place a keeper" (PLACE B: "Give this place a keeper") and a 44pt "Skip" button. The row opens the naming sheet. Skip closes the slot for good; Today then matches a no-keeper Today, with InlineUndo "Skipped. You can add a keeper from your place file. · Undo". When the 14 days end without a Skip, the slot closes the same way, silently and with no Undo; the place file row remains the way back.
- Motion: a pose change is one transition of 300ms or less; the idle loop runs 5s or less, then holds still; the count changes silently. Reduce Motion: static poses and a cross-fade. No haptics.

FOUNDATIONS COMPONENTS USED: KeeperStrip (calm, on it, busy, needs you, unavailable, offline; loading, hidden after Skip, suppressed under an active alert, permission-limited) · FactCount (V2 keeper strip; V3 T1 for PLACE B; loading and offline states) · ProvenanceMark (hollow, PLACE B only) · InlineErrorRow (Unavailable glyph and Retry) · WarmingSkeleton · FreshnessLine and OfflineNotice (host) · InlineUndo (hide, remove, skip, mark paid) · LockedActionRow (place file Keeper row, member) · PickupCard, FourteenDayStrip, BillRow, QuietDayReceipt, FirstWeekRow (landings and host) · ScopeChip (host location row).

ACCESSIBILITY
- Reading order: name, mood word, mood line, count. The avatar is decorative. Strip label is the fact, with the mood word: "Ollie, busy: Recycling and garbage tomorrow. Clark Public Utilities is due in 4 days, Friday 23 October."
- Count: "14 on file: place, dates, money, people. Opens your place file." Name button: "Ollie, keeper options". Retry: "Retry checking your bills". PLACE B mark: "on record, not confirmed".
- Targets 44pt / 48dp / 44px with 8dp gaps; the FactCount block is one target of at least 44pt.
- Mood is words plus pose, never hue; the greyscale frame must read fully. Unavailable and offline are announced politely.
- Permission-limited: the line, the pose, the mood word and FactCount are all computed from the same viewer-visible data. A guest without bill access on Mon 19 Oct sees "On it · Recycling and garbage tomorrow." with the On it pose, never Busy or the envelope, and "8 on file" with Place · Dates · People, no Money pip.

COPY: "Calm" · "On it" · "Busy" · "1 overdue" · "No bills or dates due in the next 7 days." · "Recycling and garbage tomorrow." · "Recycling and garbage tomorrow. Clark Public Utilities is due in 4 days · Fri 23 Oct." · "3 things due in the next 7 days." · "5 things due in the next 7 days." · "The Clark Public Utilities bill is past its due date. 1 more due in the next 7 days." · "Already paid?" · "Mark paid" (inside the BillRow overflow menu only) · "Paid a different amount" · "Skip this month" · "Couldn't check what's due. Your bills didn't load." · "Your bills and mail didn't load." · "Retry" · "On it · as of 7:04 AM" · "14 on file" · "7 on file" · "8 on file" · "Give your place a keeper" · "Give this place a keeper" · "Skip" · "Skipped. You can add a keeper from your place file. · Undo" · "Rename" · "Change species" · "Hide keeper for now" · "Hide for 7 days · until Mon 26 Oct" · "Hide for 31 days · until Thu 19 Nov" · "Keeper hidden until Mon 26 Oct · Undo" · "Show keeper now" · "Remove keeper" · "Ollie removed for everyone in this household · Undo" · "Keeper removed · Undo" · "Rename or change · only Maya" · "Only Maya can rename this keeper." · "You're offline. You can change the keeper when you're back." · "Pickup tomorrow." · "Yes, Thursday is right" · "Change pickup day" · "Ollie is on Today now."

EDGE CASES
- Longest name plus the 1 overdue line wraps fully at 393pt and AX5, no ellipsis.
- 128 on file: the pips wrap to further pip lines inside the 160pt block; nothing truncates.
- Five items due (stress case): "5 things due in the next 7 days.", opening the strip rows.
- No place: the strip is absent.
- Slow network: the skeleton reserves the exact height (78pt for the FactCount block), so the weather never jumps.
- Air alert (AQI 118, Unhealthy for Sensitive Groups, 4:00 PM) pinned: the whole slot collapses; the alert owns the screen.
- Sam (member): same keeper. The name opens a native menu with "Hide keeper for now" (Sam's Today only) and a disabled item "Rename or change · only Maya" (iOS: a menu section footer reading "Only Maya can rename this keeper."; Android and web: a disabled item with that text as supporting text). Sam's menu has no Remove keeper item. The full LockedActionRow "Only Maya can rename this keeper." appears in the place file's Keeper row.
- Guest: the permission-limited line and "8 on file" above.

INSTEAD OF
- Instead of a five-segment ring with outlined empty slots, draw FactCount V2 "14 on file" with word pills for known categories only — because a closed shape with gaps reads as "almost done".
- Instead of "Ollie knows 14 things", a level or XP, draw "14 on file" — because the count is the place file's record, not the keeper's growth.
- Instead of a worried or tearful creature for an overdue bill, draw it holding up the envelope — because distress makes people avoid the display.
- Instead of a calm face when a check fails, draw the neutral outline pose with the failed input named — because a quiet face on an overdue day is a lie.
- Instead of a hollow ProvenanceMark on Unavailable, draw the InlineErrorRow glyph — because hollow means only "on record, not confirmed".
- Instead of a one-tap Mark paid button on the BillRow face, draw "Already paid?" opening the row's overflow menu — because the contract forbids one-tap Mark paid on the row face.
- Instead of a "Remove Ollie?" dialog, remove at once with InlineUndo naming who else is affected — because a name and species is a cheap, undoable delete.
- Instead of "You missed the water bill", "Ollie is worried", "Needs you", a badge, a dot or a "check in" button, write the thing as the subject and draw nothing that asks — because the strip is ambient and never pushes.

DONE WHEN: Every mood traces to a named record in the next 7 days. Calm appears only when the keeper's own checks succeeded, and Unavailable can never be mistaken for it. The count equals the place file's number for the same viewer (14 for Maya, 7 for Jordan, 8 for the guest). The greyscale and AX5 frames read without loss. After Skip or Remove, Today matches a no-keeper Today, with Undo. The keeper never sits beside an alert, and a guest never learns of a bill through the pose, the line or the count.

ARTBOARDS
1. f11-keeper-strip · ios · 01-busy-dense · light — HOME A Today, Busy, one-row strip with FactCount V2 "14 on file" right-aligned, full host context.
2. f11-keeper-strip · ios · 02-on-it · light — "Recycling and garbage tomorrow.", no unconfirmed mark (pickup confirmed by Maya).
3. f11-keeper-strip · ios · 03-needs-you · light — Sat 24 Oct, "1 overdue", envelope pose.
4. f11-keeper-strip · ios · 04-landings · light — BillRow highlighted with the "Already paid?" text button and its overflow menu open, plus an inset of the Fri 30 Oct strip ("3 things due in the next 7 days.") and its landing with the three FourteenDayStrip rows highlighted.
5. f11-keeper-strip · ios · 05-calm · light — Wed 21 Oct, calm line, all checks succeeded; inset of the QuietDayReceipt landing.
6. f11-keeper-strip · ios · 06-unavailable · light — neutral outline pose, bills named, Retry.
7. f11-keeper-strip · ios · 07-invitation · light — HOME A unnamed row with Skip.
8. f11-keeper-strip · ios · 08-skipped · light — slot closed, InlineUndo line.
9. f11-keeper-strip · ios · 09-menu-open · light — the four menu items.
10. f11-keeper-strip · ios · 10-hide-choice · light — two hide options in relative-then-date order, then the hidden InlineUndo line.
11. f11-keeper-strip · ios · 11-removed-undo · light — HOME A slot closed with the household-consequence InlineUndo line.
12. f11-keeper-strip · ios · 12-member-view · light — Sam's native menu with the disabled item and footer and no Remove, plus a guest inset showing On it and "8 on file" (Place · Dates · People).
13. f11-keeper-strip · ios · 13-saved-place · light — PLACE B, Pepper, "Pickup tomorrow." with a wordless hollow ProvenanceMark, FactCount V3 "7 on file", PickupCard landing inset carrying the caveat once.
14. f11-keeper-strip · ios · 14-alert-suppressed · light — AQI 118 pinned, no strip.
15. f11-keeper-strip · ios · 15-loading · light — skeleton at exact height, FactCount loading block.
16. f11-keeper-strip · ios · 16-offline · light — "On it · as of 7:04 AM", FactCount offline state, menu inset with disabled items and caption.
17. f11-keeper-strip · ios · 17-no-place · light — Today with no strip.
18. f11-keeper-strip · android · 18-busy-dense · light — one-row strip, M3 menu anchor, 48dp.
19. f11-keeper-strip · web-1440 · 19-busy-dense · light — main column, one row, FactCount V2 at most 160px, popover menu.
20. f11-keeper-strip · web-390 · 20-busy-dense · light — one-row strip, bottom tab bar.
21. f11-keeper-strip · ios · 21-ax5 · light — worst-case name plus 1 overdue line, avatar on top, FactCount block below the name and line.
22. f11-keeper-strip · ios · 22-greyscale · light — 1 overdue and calm side by side.
23. f11-keeper-strip · ios · 23-pose-sheet · light — 6 species by 4 poses plus the neutral pose, at 44pt and 88pt, each labelled.
24. f11-keeper-strip · ios · 24-busy-dense · dark — dark twin of 01.
25. f11-keeper-strip · ios · 25-unavailable · dark — dark twin of 06.
26. f11-keeper-strip · Notes — assumptions; omitted states; invented strings; normalisations; open items, as follows.
- Assumptions: HOME A pickup day confirmed by Maya (You · Tuesday); the guest's 8 on file; Sam's paid dates (Sun 18 Oct, Tue 27 Oct); property tax 2nd half due Mon 2 Nov; pickup counts only on the day before, so Tue 27 garbage does not break Wed 21's calm line; the text column is narrow beside the 160pt FactCount block at 393pt, so check the busy line wraps cleanly.
- Merged here: the briefing kicker surface. On a briefing landing the pinned briefing sits above the strip, and the mood line must agree with the push.
- Omitted states: invitation expiry after 14 days (the slot closes silently; the place file row remains the way back); the flow-06 post-claim strip (same as 13 with household inputs and FactCount V2).
- Invented strings: every COPY string not in the fixtures, including the four mood words, the hide options and dates, "Already paid?", "Paid a different amount", "Skip this month", "Ollie, keeper options", "Retry checking your bills", "on record, not confirmed" as a spoken label, the guest and "8 on file", Sam's paid dates, the Sat 24, Wed 21 and Fri 30 frame times, Pepper, the 14-day invitation window and the after-the-FirstWeekRow condition.
- Doc string replacements: "Nothing due this week." → "No bills or dates due in the next 7 days." (rolling window; pickup excluded until the day before); "Recycling tomorrow." → "Recycling and garbage tomorrow." (glossary); "Tax due in 3 days." → folded into "3 things due in the next 7 days."; "A bill is overdue." → "The Clark Public Utilities bill is past its due date." (the thing as subject); "Ollie knows 6 things" → "7 on file" (Foundations V3 T1); flow-09 steps 6, 8 and 9 need the new strings (step 6 says "6 on file").
- Resolved: the count is "14 on file" for HOME A and "7 on file" for PLACE B per Foundations 00b-07; "11 on file" is used only as the claim-receipt count. Mark paid lives in the BillRow overflow, matching the contract.
- Open items: seeded voter registration excluded from mood (deviation from the doc); contract KeeperStrip offline example still says "Attentive", replaced by "On it"; contract KeeperStrip label example "Ollie: A bill is overdue." replaced by the mood-word label; Foundations 00b-07's in-context crop reads "Recycling and garbage go out tomorrow by 6:30 AM", this surface uses "Recycling and garbage tomorrow."; contract DestructiveConfirm still lists a "Remove Ollie?" variant, which the flow and the merge decision replace with Undo; flow-09 says "Only Sam can rename", here Maya is the owner; flow-06 step 13 says the naming scope line reads "Everyone in this household sees this." — the claim receipt must state the visibility change, and the strip only carries the keeper over; the species list differs from the doc (otter, owl, fox, heron, cat, dog); art may be cut to three species.

BATCH PLAN
Turn 1: 1-6, then wait for "continue".
Turn 2: 7-12, then wait for "continue".
Turn 3: 13-18, then wait for "continue".
Turn 4: 19-24, then wait for "continue".
Turn 5: 25-26.
