# Tomorrow's pickup card (push landing + confirm/correct)
id: f4-today-pickup-card · platforms: web/ios/android · isNew: True · artboards: 33

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Tomorrow's pickup card · f4-today-pickup-card

TYPE: NEW card placed inside the existing designed screen "Today". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed: add this card, its states and its notification artwork.

ATTACH: Today on iOS 393, Android 412, web 390 and web 1440, showing the location row, the 14-day strip card and the briefing card, in both the "Your household" and the "Saved place · Only you" versions. Also attach exports of the Foundations boards 00a–00d.

PLATFORMS & VIEWPORTS: iOS 393x852 (primary), plus one 320pt-wide iOS frame for the densest case. Android 412x915. Web 390x844 and 1440x900. Draw the notification insets at true truncation widths for iOS 393 and Android 412.

WHERE IT LIVES & HOW PEOPLE ARRIVE
Today tab → Today. The card sits directly above the FourteenDayStrip card. It shows whenever tomorrow has a pickup, with notifications on or off. It is the in-app version of the push, so someone who never allowed notifications can still do everything here.
Entry points:
- Opening Today. This always works.
- The night-before push, sent with the 6:00 PM evening briefing. It opens pantopus://today?section=pickup (web: /app/today?section=pickup). Today pins the card under the location row and highlights it once. If Today is already open, show no banner; just highlight the card.
- The notification action "That's My Day". It confirms in the background without opening the app and rewrites the widget snapshot.
- A tap on the widget hero. It opens pantopus://today?src=widget&section=pickup and lands the same way.
- The place file's Pickup day row, and the strip's list row for tomorrow.
Hand-offs:
- "Change pickup day" opens the ProvenanceSheet in its schedule-fact variant. Its first action is "Set my pickup day". Under that is an optional checkbox, "Also tell us the city's schedule looks wrong". When the rule is already household-confirmed (frame 2), the sheet opens with "Set my pickup day" only and no city-report checkbox. "Set my pickup day" swaps the sheet's content for the DateSheet in pickup mode, with Tuesday pre-filled and a Back control. It does not stack a second sheet. Saving closes the sheet and returns to this card in the corrected-just-now state. Every correction is recorded as a "not my schedule" correction, which the honesty counter reads. If the box was ticked, a report is filed too.
- The source row (the SourceCaption inside its full-width row) opens the same ProvenanceSheet.
- The first confirm opens the reminder ask inside this card. For this entry, the inline ask replaces the notification primer sheet. While the ask is open, hide the briefing card's night-before row. "Turn on reminders" switches that row on, and it then reads "The night before pickup · 6:00 PM · Change". "Not now" or "No thanks" here counts as that row's answer, so the briefing card never asks about the night before afterwards.

WHO AND WHEN: Maya Chen at HOME A, Mon 19 Oct, 6:10 PM, in a recycling week. The neighbours' carts are already out, and she opens Today to check that tomorrow really is her day. Second person: Jordan Lee at PLACE B, his only place, first in an ordinary week and then in Thanksgiving week.

THE ONE JOB: Say what goes out tonight and how sure we are, and let one tap turn the city's schedule into this household's own pickup day.

FIRST FIVE SECONDS: The eye lands on three things, in this order: (1) the headline "Recycling and garbage tomorrow" with its KindGlyph tile, (2) the instruction "Bins out tonight — curbside by 6:30 AM (Waste Connections)", (3) the hollow mark with "City schedule, not yet confirmed". The one decision is a pair of peer buttons, and neither is primary.

CONTENT (deltas to FIXTURES)
- Unconfirmed, HOME A: Headline "Recycling and garbage tomorrow". Instruction "Bins out tonight — curbside by 6:30 AM (Waste Connections)". SourceCaption "○ City schedule, not yet confirmed · Waste Connections for the City of Vancouver · 2026 route calendar, read Thu 1 Oct 2026". The recycling week is read from that published route calendar, never worked out from the garbage day. (This is an assumption that departs from the research rule "seed the weekday only"; list it on Notes.) Buttons: "Yes, Tuesday is right" and "Change pickup day".
- What confirming writes: exactly what the card shows. At HOME A, that is Tuesday plus the recycling week from the route calendar. Where the card shows "Recycling: Not set" (PLACE B), confirming sets the weekday only, and recycling stays Not set until it is set in the DateSheet.
- Confirmed by another household member (frame 2): filled mark, SourceCaption "● Confirmed by Sam on Sat 3 Oct · Tuesday". No caveat and no button pair. One text button: "Change pickup day".
- Confirmed just now, HOME A: SourceCaption "✓ You added this · Tuesday". Status line "Saved to your household calendar.". Footer "Everyone in this household will see this.". The reminder ask opens below: "Remind you the night before? 6:00 PM", with a PushCopy tray preview captioned "This is the whole thing." showing "Recycling + garbage tomorrow" / "Bins out tonight · Larkspur Loop". Buttons: "Turn on reminders", "Not now", "No thanks".
- Corrected just now, HOME A (frame 4). This is a what-if where the route calendar was wrong for Maya. In the DateSheet she set garbage weekly on Tuesday and recycling every other week, next on Tue 27 Oct.
  - Headline "Garbage only tomorrow". Caption "✓ You added this · Tuesday".
  - Status line "Saved. Garbage every Tuesday · recycling next in 8 days · Tue 27 Oct.", then the footer "Everyone in this household will see this.".
  - If she did not tick the report box, show a quiet 44pt text row: "Also tell us the city's schedule looks wrong". It opens the ProvenanceSheet at its report step. If she ticked it, show the ProvenanceMark (reported variant) line "You reported this · checking" instead.
  - If the new day is not tomorrow, the card shows "Saved. Your next pickup is in 2 days · Wed 21 Oct." until she leaves Today, then disappears.
- Saved place, unconfirmed, PLACE B. This frame is dated Wed 21 Oct, 6:10 PM.
  - Headline "Garbage tomorrow" (not "Garbage only": recycling here is Not set, not known to be off). Instruction "Bins out tonight — curbside by 6:30 AM (City of Camas)".
  - SourceCaption "○ City schedule, not yet confirmed · City of Camas · 2026 collection calendar, read Thu 1 Oct 2026". Second caption "Recycling: Not set".
  - Buttons "Yes, Thursday is right" and "Change pickup day". Footer "Only you will see this. No night-before reminder until you confirm your day."
- Saved place, confirmed just now, PLACE B: headline "Garbage tomorrow", "✓ You added this · Thursday", "Recycling: Not set", status line "Saved to your calendar. Only you.", footer "Only you will see this.", then the reminder ask. Its PushCopy tray preview reads "Garbage tomorrow" / "Bins out tonight" — no street label, because Jordan has one place, and no recycling, because it is Not set. Never copy HOME A's preview here.
- Holiday move, PLACE B. This frame is dated Thu 26 Nov 2026, 6:10 PM. Earlier, Jordan set garbage only, weekly, on Thursday.
  - Headline "Garbage only tomorrow — moved for Thanksgiving". Instruction "Bins out tonight — curbside by 6:30 AM (City of Camas)".
  - A struck ghost "Thu 26 Nov" next to "Fri 27 Nov".
  - Captions "● Official · Thanksgiving — moved to Fri 27 Nov · City of Camas 2026 calendar" and "✓ You added this · Thursday". Footer "Only you will see this.".
  - The evening briefing in the week before carries one line: "Next week: garbage moves to Fri 27 Nov".
- No pickup rule: the card becomes a single FactRow, "Set your pickup day", with the action "Add". "Add" opens the DateSheet in pickup mode.
- Worst case, HOME A: Maya booked a bulk pickup for Tue 20 Oct.
  - Headline "Recycling, garbage and bulk pickup tomorrow", with two KindGlyph tiles.
  - Instruction "Bins and bulk items out tonight — curbside by 6:30 AM (Waste Connections)".
  - The hollow city caption, plus "✓ You added this · bulk pickup booked for Tue 20 Oct".
- Guest (frame 19): the viewer is Priya, shown as having accepted Maya's invite as a guest.
- Pushes (PushCopy). Every pickup push is Active on iOS and DEFAULT importance on Android, never Time Sensitive.
  - Unconfirmed: "Unconfirmed: pickup tomorrow" / "Recycling + garbage · city schedule", with the action "That's My Day". This body carries no street label: adding " · Larkspur Loop" would take it past 40 characters.
  - Confirmed: "Recycling + garbage tomorrow" / "Bins out tonight · Larkspur Loop".
  - Holiday move, sent Thu 26 Nov and never Wed 25 Nov: "Holiday move: pickup tomorrow" / "Moved from Thu · bins out tonight".
  - Hidden-preview placeholder "Pickup reminder". Android public version "Pantopus · Pickup reminder".
  - Show the street label only when the person has more than one place. Assume Maya has a second saved place.
List every string you invent, and every assumption above, on the Notes artboard.

LAYOUT & VISUALIZATION
Draw one PickupCard as an emphasis card, in this order: KindGlyph tile at 42pt, then the h3 headline naming the bins, then the one-line instruction, then the source row, then the two peer outlined buttons side by side.
- The source row is a full-width 44pt (48dp, 44px) row. It holds the SourceCaption with its ProvenanceMark at size S and a trailing chevron. The row is the target, never the mark.
- The mark shows where the fact came from:
  - hollow = on record, not confirmed (the city's schedule)
  - filled = official or confirmed (a holiday notice, or a day another household member confirmed)
  - tick = you added this (the viewer set it)
- This card is a push landing, so print the mark's word next to every glyph.
- The caveat words appear once, directly under the headline block. The caption may wrap but must never separate from the headline, so a screenshot never reads as a confirmed claim.
- Status line: caption 12/16 text.secondary directly under the source row, a polite live region.
- Holiday move: the new day carries the mark, and the usual day is a struck ghost.
- In frame 3, draw the briefing card below this card with its night-before row hidden and its morning row still asking.
- Reminder ask: the three buttons "Turn on reminders", "Not now" and "No thanks" are equal outlined buttons in the NotificationAsk card row style, side by side; they stack full width at AX5.
- Guest (frame 19): the card shows the headline, instruction and source row. The button pair is replaced by LockedActionRow (names who can act) reading "Maya or Sam can change the pickup day", with no link.
- Web 1440: the card sits in Today's main column, at most 640 wide, with the buttons side by side at their natural width.
- Degraded states:
  - No rule: the card becomes one FactRow line.
  - Nothing tomorrow: the card is absent and the strip moves up.
  - Stale (frame 15): the content and marks stay at full strength; only the FreshnessLine reads "Updated 2h ago". A pickup day is a rule, so it is not dimmed. Dim a mark only when the city calendar it was read from has expired, and then append the age words to its caption.

INTERACTION, MOTION & HAPTICS
- "Yes, Tuesday is right" saves in place. The ring becomes the tick and the caveat cross-fades to "You added this · Tuesday", in 300ms or less. Under Reduce Motion, use a plain cross-fade.
- When the save succeeds, play one light tick: iOS light impact, Android confirm haptic. Play nothing on the tap itself, and nothing on web.
- The reminder ask appears only after the first successful confirm or correction, never after a failed save.
  - iOS and Android 13+: "Turn on reminders" opens the system permission dialog directly.
  - Web: the ask appears only once a web briefing push channel exists; until then, the web card ends at the confirmed state with no ask.
  - OS permission already granted but the evening briefing off: "Turn on reminders" switches the briefing on directly, with no dialog, and the status line shows "Saved · 6:00 PM".
  - Android denied once: the ask shows again, and "Turn on reminders" re-asks once.
  - Android blocked: the ask reads "Notifications are off for Pantopus" and offers only "Open settings", plus "Not now".
  - "Not now" never opens the system dialog.
  - If the system dialog is declined, the ask is replaced by "Pickup still shows here on Today". On native only, a widget offer follows, "Put today on your home screen" with "Show me how": at most once every 24 hours, and never if a widget is already placed.
  - If reminders are already on, the confirm shows only that widget hint.
- "Not now" collapses the ask to the InlineUndo "No reminder for now · Undo". "No thanks" collapses it to "You can turn this on in Notification settings · Undo". Both declines are stored on the server, and Undo stays until the person leaves Today.
- "That's My Day" failing in the background: the card stays hollow, the push is not rewritten, and the next open shows the unconfirmed state.
- A push arrival scrolls once, moves focus to the card and fades a highlight. Under Reduce Motion, jump there, then fade.
- No action is gesture-only.

FOUNDATIONS COMPONENTS USED: PickupCard (variants: unconfirmed, confirmed, holiday moved, no rule, bulk, T1, tray preview; states: saving, confirmed just now, error, offline, highlighted on arrival), KindGlyph (tile), ProvenanceMark (including its reported variant), SourceCaption, ScopeChip (footer sentence form), PushCopy, NotificationAsk (card row form, inline), DateSheet (pickup kind), ProvenanceSheet (schedule fact, report step), FactRow, InlineUndo, InlineErrorRow, FreshnessLine, OfflineNotice, LockedActionRow (names who can act).

ACCESSIBILITY
- Reading order: headline, instruction, source row, buttons, status, footer.
- The card reads: "Recycling and garbage tomorrow. Bins out tonight, curbside by 6:30 AM. Waste Connections, on record, not confirmed."
- Frame 2 source row reads "Tuesday, confirmed by Sam". Your own row reads "Tuesday, you added this".
- The source row is spoken "Where this fact comes from, Waste Connections".
- Spoken button labels always start with the visible text: "Yes, Tuesday is right", with the hint "Confirms Tuesday as your pickup day"; and "Change pickup day", with the hint "Opens where this comes from".
- Targets are at least 44pt on iOS, 48dp on Android and 44px on web.
- "Saving", "Saved" and errors are polite live regions.
- The struck day is spoken "moved from Thursday 26 November".

COPY: Use every string in CONTENT and INTERACTION, plus these.
- "Saving…"
- "We couldn't save your pickup day" with "Retry"
- "You're offline · as of 6:02 PM", with "Confirming needs a connection." under the disabled buttons
- Guest: "Maya or Sam can change the pickup day"

EDGE CASES
- AX5: headline and caption wrap, and the buttons stack full width.
- 320pt: the bulk case keeps the caveat directly under the headline, with the buttons stacked.
- A skipped or low-signal evening briefing (no push) leaves the card unchanged.
- A saved place with no day the person set never gets a push.
- If a household member later confirms a different day, the household rule wins and the caption names who set it.
- Dates past the last published city calendar read "projected" and never look confirmed.
- Slow network: the buttons stay live and show "Saving…". A warm screen never shows a skeleton.

INSTEAD OF
- Instead of a filled primary "Yes" beside a quiet text link, draw two identical outlined buttons, because confirming and correcting are both good outcomes and favouring one skews the honesty count.
- Instead of "Change pickup day" jumping straight into a date picker, open the source sheet with "Set my pickup day" first and the report as an optional box, because each correction must be counted.
- Instead of repeating "not yet confirmed" on every line, print it once beside the hollow mark, because repeated caveats become boilerplate.
- Instead of a red or amber banner, draw a calm emphasis card on surface.base, because this is a weekly chore.
- Instead of a toast that fades while the caveat stays, rewrite the caption in place, because the change must survive a reload.
- Instead of "Bins out tonight" on the usual evening in a holiday week, move the headline and push to the moved day, because a reminder on the wrong night is false.
- Instead of a primer sheet after the first confirm, expand the ask inline, because a third ask after the card and before the OS dialog trains dismissal.
- Instead of greying the card when the snapshot is two hours old, keep the marks at full strength and let only the FreshnessLine age, because a pickup day is a rule that stays true for weeks.

DONE WHEN
- A person with notifications off can read, confirm and correct tomorrow's pickup on all three platforms.
- After a confirm, the tick shows, the caveat is gone, the scope is stated, and the widget and strip show the tick.
- A correction shows immediately, and it is counted.
- Every mark on the card has its word beside it, and every date carries its weekday.
- Every push fits 30/40 characters, puts the caveat first, has no house number and is annotated iOS Active / Android DEFAULT.
- The holiday frame names its source and the moved day.
- Only one notification ask is ever visible at a time.
- All frames read correctly in greyscale.

ARTBOARDS
1. f4-today-pickup-card · ios · 01-unconfirmed · light — dense default in Today at HOME A
2. f4-today-pickup-card · ios · 02-confirmed-by-sam · light — filled mark, "● Confirmed by Sam on Sat 3 Oct · Tuesday", one "Change pickup day" text button
3. f4-today-pickup-card · ios · 03-confirmed-just-now-reminder-ask · light — tick, household footer, inline ask and tray preview, briefing card below with the night-before row hidden
4. f4-today-pickup-card · ios · 04-corrected-just-now · light — "Garbage only tomorrow", recycling Tue 27 Oct, report row
5. f4-today-pickup-card · ios · 05-holiday-move · light — PLACE B, Thu 26 Nov, struck Thursday, "Garbage only tomorrow — moved for Thanksgiving"
6. f4-today-pickup-card · ios · 06-saved-place-unconfirmed · light — PLACE B, "Garbage tomorrow", Recycling: Not set
7. f4-today-pickup-card · ios · 07-saved-place-confirmed-just-now · light — "Saved to your calendar. Only you.", ask with the "Garbage tomorrow" / "Bins out tonight" preview
8. f4-today-pickup-card · ios · 08-no-pickup-day · light — single "Set your pickup day" row
9. f4-today-pickup-card · ios · 09-nothing-tomorrow · light — card absent, strip moved up
10. f4-today-pickup-card · ios · 10-bulk-worst-case · light — three kinds, two tiles
11. f4-today-pickup-card · ios · 11-bulk-worst-case-320 · light — same at 320pt, stacked buttons
12. f4-today-pickup-card · ios · 12-saving · light — "Saving…" under live buttons
13. f4-today-pickup-card · ios · 13-save-error · light — hollow mark kept, Retry
14. f4-today-pickup-card · ios · 14-offline · light — disabled buttons, "Confirming needs a connection."
15. f4-today-pickup-card · ios · 15-stale · light — marks at full strength, only the FreshnessLine reads "Updated 2h ago"
16. f4-today-pickup-card · ios · 16-notifications-denied-widget-offer · light — "Pickup still shows here on Today" plus "Put today on your home screen" / "Show me how"
17. f4-today-pickup-card · ios · 17-reminders-already-on-widget-hint · light
18. f4-today-pickup-card · ios · 18-declined-undo · light — "No reminder for now · Undo"
19. f4-today-pickup-card · ios · 19-guest-locked · light — LockedActionRow in place of the buttons
20. f4-today-pickup-card · ios · 20-arrived-from-push · light — pinned under the location row, highlight
21. f4-today-pickup-card · ios · 21-tray · light — PushCopy inset illustrations (collapsed, expanded with "That's My Day", hidden-preview placeholder, confirmed, holiday), each with the level "iOS Active" printed as an artboard annotation outside the inset; no wallpaper, no system chrome
22. f4-today-pickup-card · android · 21-tray · light — PushCopy inset illustrations (collapsed, expanded with the action, public version), each with the level "Android DEFAULT" printed as an artboard annotation outside the inset
23. f4-today-pickup-card · android · 01-unconfirmed · light
24. f4-today-pickup-card · android · 22-reminder-ask-denied-once · light — "Turn on reminders" re-asks
25. f4-today-pickup-card · android · 23-reminder-ask-blocked · light — only "Open settings" plus "Not now"
26. f4-today-pickup-card · web-390 · 01-unconfirmed · light
27. f4-today-pickup-card · web-1440 · 01-unconfirmed · light — main column, max 640
28. f4-today-pickup-card · ios · 24-ax5 · light — frame 1 at AX5, stacked buttons
29. f4-today-pickup-card · ios · 25-greyscale · light — frame 1 in greyscale
30. f4-today-pickup-card · ios · 01-unconfirmed · dark
31. f4-today-pickup-card · ios · 05-holiday-move · dark
32. f4-today-pickup-card · ios · 03-confirmed-just-now-reminder-ask · dark
33. f4-today-pickup-card · Notes — this list:
- Invented strings: every string in CONTENT, INTERACTION and COPY that is not in the house style, the component contract or the research brief's canonical strings, including the read dates, the briefing line, the holiday push pair, both InlineUndo lines, "Opens where this comes from", the offline reason, the save error, the guest line, "Recycling: Not set", the PLACE B tray preview and the report receipt.
- Assumptions: Maya has a second saved place; the frame 4 what-if; Waste Connections publishes a per-route recycling-week calendar for Vancouver. That last one departs from the research rule "seed the weekday only; frequency is Not set until confirmed" and needs founder sign-off; the caption names that page as the source of the recycling claim. The guest viewer is Priya, who accepted Maya's invite as a guest — this departs from the fixture, where her invite is still pending.
- Terms: "Garbage only tomorrow" (glossary and flow term) is used where recycling is known to be off (frames 4 and 5). "Garbage tomorrow" (the design doc's string) is kept for PLACE B, where recycling is Not set rather than off.
- Omitted states: a low-signal night with no push (the card is unchanged); a failed background confirm; quiet hours, a timezone-shifted evening time or iOS Scheduled Summary delaying the push — the card on Today is unchanged, and the notification settings row carries the explanation.
- Superseded: flow-01's primer after the first confirm is replaced by the inline ask, so the notification primer is not reached from here. Push copy follows the research brief's canonical strings, replacing the design doc's parenthetical caveat "(Unconfirmed city schedule. Set your pickup day to make it yours.)" and PushCopy's longer unconfirmed body (over 40 characters). The widget offer "Put today on your home screen" / "Show me how" (flow-07 wording, shared with the briefing card) overrides the NotificationAsk board's "Put Today on your home screen" / "Add the widget".
- Merges: the old "tonight" row on Today is deleted; the separate pickup-day editor now lives in this card plus the DateSheet.
- Dependency: a saved place's own pickup rule must outrank the city rule, or unverified pickups must not be pushed to saved places. The web "Turn on reminders" needs the web briefing push channel; until it ships, the web ask is not shown. The iOS app's launch-time notification permission request must be removed, or the inline ask never reaches the system dialog.
- Questions for the contract owner: filled mark for a household confirmation; "You added this · Tuesday" replaces "You · Tuesday"; "Confirmed by Sam on Sat 3 Oct · Tuesday" replaces "Sam · Tuesday, confirmed 3 Oct 2026"; the contract's button labels ("Confirm Tuesday pickup") fail Label in Name, so spoken names now start with the visible text; PushCopy's unconfirmed body should become "Recycling + garbage · city schedule"; "Open settings" casing.

BATCH PLAN
Turn 1: 1-6, then wait for continue.
Turn 2: 7-12, then wait for continue.
Turn 3: 13-18, then wait for continue.
Turn 4: 19-24, then wait for continue.
Turn 5: 25-30, then wait for continue.
Turn 6: 31-33.
