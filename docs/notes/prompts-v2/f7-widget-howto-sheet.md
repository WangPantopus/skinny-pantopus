# Add the widget (how-to, with a live preview)
id: f7-widget-howto-sheet · platforms: ios/android · isNew: True · artboards: 15

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Put today on your home screen (how-to sheet) · f7-widget-howto-sheet

TYPE: NEW sheet.

ATTACH:
- Your place file (Place tab) on iOS and on Android, with the "Put today on your home screen" row visible.
- The Notifications settings page.
- The Add a place sheet (signed-in), on iOS.
- The f7-today-widget artboards for the iOS set (01) and the Android set (14). They supply the preview this sheet shows.

PLATFORMS & VIEWPORTS
- iOS: a sheet over the Place tab on 393x852.
  - It uses a custom detent sized to its content, about 600pt at the default text size.
  - At the default size, nothing scrolls.
  - At accessibility sizes, it grows to the large detent and scrolls.
- Android: a Material 3 ModalBottomSheet on 412x915, sized to its content and scrolling when needed.
- There is no web version.

WHERE IT LIVES & HOW PEOPLE ARRIVE
The sheet opens over Place → Your place file. Entry points:
1. The "Put today on your home screen" row. This is the durable entry. It is hidden while the person has no place, and it disappears once the app knows a widget is placed.
2. Notifications settings → the "Home screen widget" row, so the sheet stays reachable after a dismissal.
   - This is the only entry that can be reached with no place.
   - On a platform where the signed-in Add a place sheet does not exist yet (Android today), hide this row for people with no place.
3. A one-line inline hint, shown once, right after "Yes, Tuesday is right" confirms a pickup on Today. It also appears after the notification's "That's My Day" action, the next time Today opens.
4. After push is declined, the Today line "Pickup still shows here on Today · Or put it on your home screen".
Hints appear at most once every 24 hours, and never as a blocking modal. For someone who declined push, the widget ranks above the briefing ask, because it is the only return trigger that needs no permission.
What this sheet receives: the person's latest snapshot, if one exists.
What it hands on:
- on Android, the system pin dialog, then the placed widget;
- on iOS, the OS widget gallery.

WHO AND WHEN
- Maya Chen at HOME A, Mon 19 Oct, 7:45 AM. She has just seen her pickup on Today and taps the place file row. On Android she has the same data, and her launcher supports pinning.
- Jordan Lee (PLACE B) has no snapshot yet.
- Someone new, with no place at all, arrives from Notifications settings on iOS.
Each fixture person appears on both platforms with the same data, so the platforms can be compared.

THE ONE JOB
Show people their own widget first, then get it onto the home screen: with one button on Android, or with three pictured steps on iOS.

FIRST FIVE SECONDS
1. The eye lands first on the preview of her own widget.
2. Then on the "Your widget" caption.
3. Then on the action.
The single primary action is "Add to home screen" on Android. On iOS it is the three steps, followed by "Done".

CONTENT
- Title: "Put today on your home screen".
- Line: "Pickup, air and your next date, right on your home screen. No notifications needed."
- Preview: Maya's own medium widget, drawn from her snapshot at true size (338x158pt on iOS, 276x220dp on Android). It shows:
  - "Larkspur Loop · Your household";
  - KindGlyph (garbage+recycling) and "Recycling and garbage tomorrow";
  - the caption "Bins out tonight", then ProvenanceMark XS (hollow, drawn as a shape), then "Unconfirmed · Waste Connections";
  - the 14-day strip with 6 items;
  - "AQI 42 · Good · AirNow 7:00 AM" beside the micro band.
  Caption: "Your widget".
- iOS steps:
  1. "Touch and hold an empty spot on your home screen."
  2. "Tap Edit, then Add Widget, and search for Pantopus."
  3. "Pick a size and add it."
  Then the button "Done".
- Android, when the launcher supports pinning: the primary button "Add to home screen" and the secondary "Done". The steps are hidden.
- Android fallback, when pinning is not supported:
  1. "Touch and hold the Pantopus app icon."
  2. "Tap Widgets."
  3. "Touch and hold the widget, then drag it into place."
  Then "Done".
- Android after the pin succeeds: "Added to your home screen." · "Done".
- No snapshot (Jordan): the baked gallery sample (HOME A, Larkspur Loop), captioned "Sample — yours will show your address".
- No place, on a platform where the signed-in Add a place sheet exists:
  - The same sample at reduced emphasis, with the same caption.
  - The footer has two buttons of the same size, stacked. "Save an address first" is the filled primary. "Done" is an outlined button directly below it.
  - "Save an address first" closes this sheet, then opens the Add a place sheet.
- No place, where that sheet does not exist yet (only if reached anyway): the de-emphasised sample, the caption, the line "Your widget will show today once you save an address in Pantopus." and a single "Done".
List every invented string on Notes, including the sheet's line (a variant of the earlier line "Pickup, air and your next date. No notifications needed.").

LAYOUT & VISUALIZATION
- The preview is at the top of the sheet, above any instructions. Draw it clearly as an illustration:
  - it cannot be tapped;
  - it sits on a small home-screen ground patch (surface.sunken, with the widget radius);
  - it carries its caption.
  Never reuse this widget look anywhere else in the app.
- Below the preview, at default text sizes, draw three compact numbered steps. Each step has a small line illustration of the gesture, with a text label:
  - a finger holding an empty home-screen grid;
  - generic labelled pills reading "Edit" and "Add Widget" (not the exact button shapes);
  - a size being picked.
  Never use OS screenshots.
- iOS height budget at default size: the title, the 2-line line, the preview patch, the caption, three 2-line steps, then "Done" pinned at the bottom. All of it fits the content-sized detent with no scrolling.
- On Android with pinning supported, the primary button sits directly under the preview.
- Draw the Android pin dialog as neutral Material 3 system chrome, with the system's own Add and Cancel buttons. Pantopus tokens appear only inside the dialog's widget preview.
- At AX5 or 200%:
  - the preview becomes the widget's text-only form (hero, label and air reading) and stays first;
  - the steps follow as wrapping text;
  - the footer buttons stay pinned, with scroll padding.
- Degraded states keep the same layout:
  - No snapshot shows the sample with its caption.
  - No place shows the de-emphasised sample and the no-place footer described above.

INTERACTION, MOTION & HAPTICS
- "Add to home screen" opens the Android system pin dialog. The app hears back only if the person adds the widget.
- "Done", the drag handle, Back (Android) and swipe-down all close the sheet. A visible "Done" is always present.
- Step illustrations may play one short loop of 300ms or less, which stops within 5s. With Reduce Motion on, they are static.
- One light haptic tick on a successful Android pin.
- No sheet opens on top of this one. "Save an address first" closes this sheet before the Add a place sheet opens.

FOUNDATIONS COMPONENTS USED
ProvenanceMark (XS, drawn) · KindGlyph · FourteenDayStrip (widget medium) · AqiBand (widget micro) · PickupCard (widget small hero variant, inside the preview) · ScopeChip wording in the preview label.

ACCESSIBILITY
- The sheet's unique title is read first, then the preview, then the steps or the button.
- The preview is one image. Its label reads: "Your widget preview: Larkspur Loop, your household. Recycling and garbage tomorrow, bins out tonight, Waste Connections, on record, not confirmed; next 14 days, 6 items; air quality index 42, Good, category 1 of 6, AirNow, observed 7 AM."
- The sample's label reads "Sample widget preview, not your address", followed by the same facts.
- Step illustrations are decorative, because their text sits beside them.
- At AX5 or 200%:
  - the sheet reaches the large detent and scrolls;
  - the preview stays first, in its text-only form;
  - the footer stays pinned, with scroll padding so it never covers the focused item.
- Buttons are 44pt / 48dp.
- The Android success line is a polite status message.

COPY
Put today on your home screen · Pickup, air and your next date, right on your home screen. No notifications needed. · Your widget · Sample — yours will show your address · Touch and hold an empty spot on your home screen. · Tap Edit, then Add Widget, and search for Pantopus. · Pick a size and add it. · Touch and hold the Pantopus app icon. · Tap Widgets. · Touch and hold the widget, then drag it into place. · Add to home screen · Added to your home screen. · Save an address first · Your widget will show today once you save an address in Pantopus. · Done · Home screen widget.

EDGE CASES
- Longest label in the preview: "Birchfield Ct · Saved place · Only you".
- The person cancels the pin dialog: return to the sheet unchanged, with no error.
- The launcher can't pin: show the fallback steps.
- A widget is already placed: the entry rows are hidden. If the sheet is reached anyway, it shows the Android success line, or the iOS steps unchanged.
- No place: the place file row is hidden, so this state is reachable only from the Notifications settings row.
- No place where the signed-in Add a place sheet does not exist yet: that settings row is hidden too, so the state is unreachable. If it is reached anyway, show only "Done".
- Offline: everything still works, because the preview is local.
- Saved place or home: the preview label shows the matching scope words.

INSTEAD OF
- Instead of an "Add it for me" or "Install widget" button on iOS, draw the three pictured steps — because iOS has no way for an app to place a widget.
- Instead of gesture steps on an Android launcher that supports pinning, draw "Add to home screen" — because the system pin dialog does the placing.
- Instead of "Tap the plus in the corner", write "Tap Edit, then Add Widget" — because that is Apple's current wording.
- Instead of "scroll to Pantopus" in the full picker, or "touch and hold a size", teach the app-icon route and "Touch and hold the widget" — because that route opens straight to Pantopus's one responsive widget.
- Instead of a preview that looks like a live, tappable widget, draw a captioned illustration on a ground patch — because a fake widget that doesn't behave like one confuses people.
- Instead of a generic mock-up when a snapshot exists, show her own data, and caption the sample as a sample — because seeing her own recycling day is the reason to act, and a stranger's household must not read as hers.
- Instead of a "Save an address first" button that leads nowhere on a platform without the signed-in Add a place sheet, hide that entry and offer only "Done" — because a dead-end button breaks trust.
- Instead of forcing everything into a fixed detent at AX sizes, let the sheet grow and scroll, with the preview's text form first — because large text must wrap, not truncate.

DONE WHEN
- The first thing on the sheet is the person's own widget, including at AX5.
- On Android, one tap places it.
- On iOS, the steps match the current OS wording, and nothing scrolls at the default size.
- Where the Add a place sheet exists, "Save an address first" leads to the same sheet as the widget's no-place tap, and "Done" is still there. Where it does not exist, no path reaches a dead end.
- After placement, the place file row is gone.

ARTBOARDS
1. f7-widget-howto-sheet · ios · 01-default · light — Maya's preview, "Your widget", the three iOS steps and "Done", over the place file, on the content-sized detent.
2. f7-widget-howto-sheet · android · 02-pin-button · light — the preview with "Add to home screen" and "Done".
3. f7-widget-howto-sheet · android · 03-pin-dialog · light — the neutral Material 3 system pin dialog, with the system's Add and Cancel, over the sheet.
4. f7-widget-howto-sheet · android · 04-pin-added · light — "Added to your home screen."
5. f7-widget-howto-sheet · android · 05-steps-fallback · light — pinning not supported: the app-icon steps, ending with "Touch and hold the widget, then drag it into place."
6. f7-widget-howto-sheet · ios · 06-no-snapshot · light — Jordan sees the sample, captioned "Sample — yours will show your address".
7. f7-widget-howto-sheet · android · 07-no-snapshot · light — Jordan on Android: the 4x2 sample at 276x220dp, with the same caption and "Add to home screen".
8. f7-widget-howto-sheet · ios · 08-no-place · light — the sample de-emphasised, with the filled "Save an address first" and the outlined "Done" of the same size below it.
9. f7-widget-howto-sheet · android · 09-no-place-no-sheet · light — the Android fallback, if reached anyway: the de-emphasised sample, the caption, "Your widget will show today once you save an address in Pantopus." and a single "Done".
10. f7-widget-howto-sheet · ios · 10-ax5 · light — the large detent, scrolling: the text-only preview first, then the wrapped steps, with "Done" pinned.
11. f7-widget-howto-sheet · android · 11-200-percent · light — 02 at 200%.
12. f7-widget-howto-sheet · ios · 12-greyscale · light — 01 in greyscale.
13. f7-widget-howto-sheet · ios · 13-default · dark — the dark twin of 01.
14. f7-widget-howto-sheet · android · 14-pin-button · dark — the dark twin of 02.
15. f7-widget-howto-sheet · ios · 15-notes · light — the Notes artboard; see the list below.

Notes must cover:
- the trigger rules: at most once every 24 hours, never modal, the widget ranked above the briefing ask after push is declined, and the two confirm triggers ("Yes, Tuesday is right" on Today, and the notification's "That's My Day");
- how the app learns a widget is placed: on iOS it asks the system for its current widget configurations; on Android it checks the placed widget IDs or hears the pin-success callback;
- that the pin flow assumes Android's pin-widget request works for this classic (non-Glance) widget, which must be verified before build;
- the rule to check step wording against Apple and Pixel help at each OS release;
- that the no-place state is reachable only from settings, and that the "Home screen widget" row is hidden for people with no place until the signed-in Add a place sheet exists on that platform (Android today), plus the fallback footer if the state is reached anyway;
- every invented string, including the sheet's line, the sample caption, "Home screen widget" and the no-place fallback line;
- omitted states.

BATCH PLAN
Turn 1: artboards 1-6, then wait for "continue".
Turn 2: artboards 7-12, then wait.
Turn 3: artboards 13-15.
