# Widget tap landing (attribution + forced refresh)
id: f7-widget-tap-landing · platforms: ios/android · isNew: False · artboards: 20

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Widget tap landing (attribution + forced refresh) · f7-widget-tap-landing

TYPE: EXTENSION of the existing designed screen "Today (one composition, both payloads)". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. One listed change: the header shows ScopeChip "Your household" on the claimed HOME A too. The component contract wins over the older rule that claimed homes show no chip, because the contract says the chip appears on every surface that shows address data. Record this on Notes as a change to the host screen.

ATTACH:
- Today for HOME A (loaded), on iOS and on Android.
- Today for PLACE B (saved place).
- Today's pinned slot with an active air crossing, and the air band in its alert state.
- Today's air band (sixth section) on a normal day.
- Today's empty state ("Today starts with a place") and the Add a place sheet, on iOS and on Android.
- The f4-today-pickup-card screenshot.
- The f7-today-widget medium artboards 01 and 04, so the tapped hero matches.

PLATFORMS & VIEWPORTS
iOS 393x852 and Android 412x915. There is no web version, because the widget is native only.

WHERE IT LIVES & HOW PEOPLE ARRIVE
This is the Today tab, opened by a tap on any size of the "Today at your address" widget. The link is pantopus://today?src=widget&section=pickup, strip or air.
- section=year does not land here. It opens Place → Your place file at its year band.
- With no section, Today opens at the top.
- With no place, the Add a place sheet opens.
- Push arrivals use a different link (see Notes).
What arrives: the section, the source (widget), and a snapshot that may be hours old.
What this screen hands on:
- A forced refresh, which is a real reload even when the app is already open.
- A new widget snapshot when the refresh succeeds, so the widget drops "Open to refresh".
- A logged open. The event details are on Notes; nothing about them is drawn.
Android must land on this same Today composition, never on the separate briefing screen, which shows different data and errors for a saved place.

WHO AND WHEN
- Maya Chen at HOME A, Mon 19 Oct, 7:41 AM. A minute ago her widget said "Recycling and garbage tomorrow", and she tapped it.
- Maya again on Thu 22 Oct at 4:10 PM, when she taps the widget's air hero.
- Maya on Mon 19 Oct at 7:41 AM, when she taps the large widget's air line on a normal day.
- Jordan Lee at PLACE B, Mon 19 Oct, 7:50 AM, when he taps his widget's strip on his Pixel.
Each fixture person appears on both platforms with the same data, so the platforms can be compared.

THE ONE JOB
Open the exact fact the widget showed, refresh it in place, and prove that the refresh happened.

FIRST FIVE SECONDS
1. The eye lands first on the tapped section, already in view and highlighted.
2. Then on the header freshness line ("Updated just now").
3. Then on the rest of Today, unchanged.
There is no new action. The section keeps its own controls, and the pickup card keeps its two equal buttons.

CONTENT
- Header: "2418 NE Larkspur Loop" · ScopeChip "Your household" · FreshnessLine "Updated just now".
- PickupCard contents:
  - KindGlyph (garbage+recycling);
  - "Recycling and garbage tomorrow";
  - the instruction "Bins out tonight — curbside by 6:30 AM";
  - SourceCaption: ProvenanceMark S (hollow), then "Waste Connections · City schedule, not yet confirmed";
  - two equal outlined buttons: "Yes, Tuesday is right" and "Change pickup day".
- FourteenDayStrip, Mon 19 Oct to Sun 1 Nov, with 6 items:
  - Tue 20: recycling and garbage (hollow);
  - Fri 23: Clark Public Utilities bill (tick);
  - Mon 26: online or mail voter registration must arrive by this date (full-height bar);
  - Tue 27: garbage only (hollow);
  - Wed 28: City of Vancouver water bill (tick);
  - Sun 1 Nov: HOA dues (tick).
- AqiBand: "AQI 42 · Good" · "Air quality is satisfactory, and air pollution poses little or no risk." · "AirNow · nearest monitors · observed 7:00 AM".
- Weather, alerts and signals: keep them exactly as the attached screenshot shows, and list their values on Notes.

Deltas (list each one on Notes):
- Air arrival, Thu 22 Oct, 4:10 PM, with section=air:
  - The pinned slot at the top of Today shows "AQI 118 · Unhealthy for Sensitive Groups · PM2.5", "Crossed 101 at 4:00 PM", the AqiBand in its alert variant, "Members of sensitive groups may experience health effects. The general public is less likely to be affected." and "AirNow · nearest monitors · observed 4:00 PM".
  - The pickup card shows the next pickup: "Garbage only · in 5 days · Tue 27 Oct", with the same hollow SourceCaption and the same two buttons. If the attached pickup-card screenshot shows a different layout for this state, follow the screenshot.
  - The sixth-section air band shows the same reading, in place and not highlighted.
- Air arrival with no crossing, Mon 19 Oct, 7:41 AM, with section=air: the sixth-section air band at AQI 42 is the target.
- Failed refresh, the same Monday at 6:10 PM: "Couldn't refresh · Retry" above "Updated 10h ago". The air caption goes stale: "Observed 7:00 AM · AirNow — 11 hours ago".
- Offline: "You're offline · as of 7:41 AM". Both pickup buttons are disabled, with the caption "Confirming needs a connection."
- PLACE B, Jordan, with section=strip: "1107 NE Birchfield Ct" · "Saved place · Only you". His strip shows hollow Thursday pickups on Thu 22 and Thu 29 Oct and the Mon 26 Oct voter bar.
Worst case: AX5 text with the pickup card highlighted.

LAYOUT & VISUALIZATION
Change only these:
1. Landing for section=pickup and section=strip: scroll the section into view once, just below the header, and highlight it. Accessibility focus moves to the section. Keep the section order exactly as it is.
2. Landing for section=air on a crossing day: the pinned crossing slot is the target.
   - Do not scroll.
   - Highlight the pinned slot and move focus to it.
   - The pinned slot is complete above the fold, so the tapped fact needs no scrolling.
   - The sixth-section air band stays where it is, not highlighted.
3. Landing for section=air with no crossing: scroll once to the sixth-section air band, then highlight it and move focus to it.
4. The highlight is an infoBg wash with a 2px inset outline in text.secondary ink.
   - It appears within 300ms.
   - It stays until the first scroll or tap, then fades over 300ms. It has no timer.
   - The focus ring keeps the platform style and its offset, so selection and focus look different.
5. FreshnessLine sits directly under the location row.
   - It reads "Updated just now", then ages as "Updated 12m ago" and "Updated 2h ago", using system relative time.
   - This line is where state is shown. There is no toast.
6. "Updating…" and a 2pt indeterminate hairline under the header appear only when the refresh takes longer than 1s.
   - A faster refresh only changes the line to "Updated just now".
   - Cards never dim, collapse or reflow.
7. Failed refresh: "Couldn't refresh · Retry", with a 44pt Retry target. All earlier content stays, and each stale fact shows its own age.
8. Only a cold start shows the full WarmingSkeleton, with the address already resolved.
9. Android lands on this composition.

INTERACTION, MOTION & HAPTICS
- The screen scrolls once, if at all. It never scrolls again, even when content is added.
- With Reduce Motion on, the screen jumps straight to the section, the highlight cross-fades, and the hairline is a static 2pt line.
- Retry is a button. Nothing depends on pull-to-refresh.
- Android opens with the system launch transition from the widget.
- The only haptic is the existing light tick when "Yes, Tuesday is right" is confirmed.

FOUNDATIONS COMPONENTS USED
- FreshnessLine: fresh, refreshing, failed, offline and per-fact stale variants.
- WarmingSkeleton: section skeleton, on cold start only.
- OfflineNotice: read-only cached screen.
- ScopeChip: also shown on the claimed home.
- PickupCard: highlighted on arrival, and offline.
- FourteenDayStrip: highlighted on arrival.
- AqiBand: the alert variant in the pinned slot and the sixth section, and the normal variant highlighted on a no-crossing arrival.
- ProvenanceMark.
- SourceCaption.
- InlineErrorRow: only if a single provider fails.

ACCESSIBILITY
- Focus moves to the highlighted section or pinned slot. Its label is read first, then the header.
- The FreshnessLine is a polite live region and announces each change once.
- The highlight is readable without colour, because it has an outline, and it looks different from the focus ring.
- Retry reads "Retry refreshing Today".
- The pickup buttons are labelled "Confirm Tuesday pickup" and "Change pickup day, opens date sheet", and are 44pt / 48dp.
- At AX5 or 200%, the freshness line wraps and the buttons stack.
- Disabled offline buttons stay focusable and read their reason.

COPY
Today starts with a place · 2418 NE Larkspur Loop · Updated just now · Updated 12m ago · Updated 2h ago · Updated 10h ago · Updating… · Couldn't refresh · Retry · You're offline · as of 7:41 AM · Confirming needs a connection. · Your household · Saved place · Only you · Recycling and garbage tomorrow · Bins out tonight — curbside by 6:30 AM · Waste Connections · City schedule, not yet confirmed · Yes, Tuesday is right · Change pickup day · Garbage only · in 5 days · Tue 27 Oct · AQI 42 · Good · Air quality is satisfactory, and air pollution poses little or no risk. · AirNow · nearest monitors · observed 7:00 AM · AQI 118 · Unhealthy for Sensitive Groups · PM2.5 · Crossed 101 at 4:00 PM · Members of sensitive groups may experience health effects. The general public is less likely to be affected. · AirNow · nearest monitors · observed 4:00 PM · Observed 7:00 AM · AirNow — 11 hours ago · Add a place.

EDGE CASES
- Longest address: "1107 NE Birchfield Ct" with its chip. It wraps and never truncates.
- The section is missing from the data (for example, there is no pickup rule): land at the top with no highlight.
- section=air arrives with no active crossing: scroll once to the air band and highlight it (artboard 10).
- An unknown section value: land at the top.
- A slow refresh over 10s: keep the hairline and keep the content.
- The refresh fails twice: the line stays, and no dialog opens.
- No place: Today's "Today starts with a place", with the Add a place sheet over it. Where the signed-in Add a place sheet does not exist yet (Android today), land on "Today starts with a place" with no sheet.
- A saved place never shows an error on Android.

INSTEAD OF
- Instead of a skeleton, dimmed cards or a spinner on a warm screen, keep the content and add only the late hairline and the freshness line — because blanking the fact someone tapped to see is the one thing this landing must never do.
- Instead of a toast saying "Refreshed", change the header line, which stays on screen — because the proof has to stay visible.
- Instead of landing at the top of Today for a pickup, strip or no-crossing air tap, scroll to the tapped section and highlight it once — because the tapped fact can sit below the fold.
- Instead of scrolling past the pinned slot on a crossing-day air tap, land on the pinned crossing — because it already holds the whole fact above the fold.
- Instead of a highlight that fades on a timer or copies the focus ring, keep an outlined wash until the first interaction — because people using large text or a screen reader need time to find it.
- Instead of a manual Refresh button, a pull-to-refresh overlay or a "came from widget" badge, use the freshness line, with Retry only on failure — because the refresh already runs on arrival.
- Instead of reordering sections for the widget, use the pinned slot for an active crossing — because moving sections confuses people.
- Instead of the briefing screen on Android, use this composition — because the widget mirrors this data.

DONE WHEN
- A tap on the pickup hero lands on the pickup card, highlighted, with "Updated just now".
- A tap on the air hero on a crossing day lands on the highlighted pinned crossing without scrolling. With no crossing, it lands on the highlighted air band.
- Content never blanks, and a refresh under 1s shows no "Updating…".
- After a successful refresh, the widget stops showing "Open to refresh". After a failed or offline landing, it keeps showing it.
- A saved-place user on Android sees Today, not an error.

ARTBOARDS
1. f7-widget-tap-landing · ios · 01-arrived-pickup · light — Mon 7:41 AM, section=pickup: the pickup card highlighted, and "Updated just now".
2. f7-widget-tap-landing · ios · 02-refreshing · light — the refresh has run past 1s: "Updating…" and the hairline, with content unchanged.
3. f7-widget-tap-landing · ios · 03-arrived-air · light — Thu 4:10 PM, section=air: no scroll, the pinned crossing slot highlighted and focused, and the pickup card showing Tue 27 Oct below it.
4. f7-widget-tap-landing · ios · 04-arrived-strip · light — section=strip: the strip highlighted.
5. f7-widget-tap-landing · ios · 05-refresh-failed · light — 6:10 PM: "Couldn't refresh · Retry", "Updated 10h ago", and the stale air caption.
6. f7-widget-tap-landing · ios · 06-cold-start · light — the skeleton with the address resolved.
7. f7-widget-tap-landing · ios · 07-offline · light — cached content, with the pickup buttons disabled and their reason shown.
8. f7-widget-tap-landing · ios · 08-no-place · light — the Add a place sheet over Today's "Today starts with a place" empty state.
9. f7-widget-tap-landing · ios · 09-saved-place · light — PLACE B, "Saved place · Only you", with the strip highlighted.
10. f7-widget-tap-landing · ios · 10-arrived-air-no-crossing · light — Mon 7:41 AM, AQI 42: scrolled once to the air band, which is highlighted and focused.
11. f7-widget-tap-landing · android · 11-arrived-pickup · light — the Android version of 01, on the root Today.
12. f7-widget-tap-landing · android · 12-arrived-air · light — the Android version of 03.
13. f7-widget-tap-landing · android · 13-saved-place · light — Jordan on his Pixel, Mon 7:50 AM: PLACE B renders with the strip highlighted and no briefing-screen error.
14. f7-widget-tap-landing · android · 14-refresh-failed · light — the Android version of 05.
15. f7-widget-tap-landing · ios · 15-ax5 · light — 01 at AX5: the line wraps and the buttons stack.
16. f7-widget-tap-landing · android · 16-200-percent · light — 11 at 200%.
17. f7-widget-tap-landing · ios · 17-greyscale · light — 03 in greyscale. The highlight reads as an outline.
18. f7-widget-tap-landing · ios · 18-arrived-pickup · dark — the dark twin of 01.
19. f7-widget-tap-landing · android · 19-arrived-air · dark — the dark twin of 12.
20. f7-widget-tap-landing · ios · 20-notes · light — the Notes artboard; see the list below.

Notes must cover:
- the forced refresh, a real reload even on a warm app;
- the snapshot write, reported as its own client event, which counts toward activation;
- one session_open event with trigger widget, logged separately and once per open, which is the first funnel-event client either native app has had;
- the link formats: pantopus://today?src=widget&section=… for the widget, and pantopus://hub-today?deliveryId=… for push. The two must not collide;
- pantopus://today?src=email, which reuses this landing later;
- that the highlight lasts until the first interaction, replacing the contract's decaying highlight, because people using large text or a screen reader need time to find it; plus the Reduce Motion behaviour;
- the ScopeChip on the claimed home, as a change to the host screen;
- the Android no-place fallback, used until the signed-in Add a place sheet exists;
- the rule that a fast refresh shows no hairline;
- that failed and offline landings leave "Open to refresh" on the widget;
- the weather values;
- every invented string;
- omitted states.

BATCH PLAN
Turn 1: artboards 1-6, then wait for "continue".
Turn 2: artboards 7-12, then wait.
Turn 3: artboards 13-18, then wait.
Turn 4: artboards 19-20.
