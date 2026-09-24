# Today at your address (home-screen widget, three sizes)
id: f7-today-widget · platforms: ios/android · isNew: True · artboards: 25

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Today at your address (home-screen widget, three sizes) · f7-today-widget

TYPE: NEW. This is a home-screen widget, drawn as artwork on a phone home screen. It is not an in-app screen.

ATTACH: the existing Pantopus "Tasks near me" widget on iOS and on Android (use it for widget chrome and corner radius only), and the Foundations board frames for ProvenanceMark, KindGlyph, ScopeChip, FourteenDayStrip, AqiBand, YearBand, DateRow, FreshnessLine and QuietDayReceipt.

PLATFORMS & VIEWPORTS
iOS: draw on a 393x852 home screen. Small is 158x158pt, medium 338x158pt and large 338x354pt, with 16pt inner margins. That leaves content areas of 126x126, 306x126 and 306x322. Use the system widget corner radius.
Android: one responsive widget. Assume the Pixel Launcher 5-column portrait grid, where a block of cells measures (73 × columns − 16) by (118 × rows − 16) dp. That gives 2x2 = 130x220dp, 4x2 = 276x220dp and 4x4 = 276x456dp. The declared minimums are 2x2 at 109x115dp and 4x2 at 245x115dp. Use the system corner radius (28dp at most). Write the assumed grid on Notes.
There is no web version.

WHERE IT LIVES & HOW PEOPLE ARRIVE
The widget lives on the phone's home screen, outside the four tabs. People add it from three places:
- the OS widget gallery ("Today at your address");
- the "Put today on your home screen" row in Place → Your place file;
- the how-to sheet. On Android, its "Add to home screen" button places the widget directly.
The widget never fetches anything. It only reads the snapshot the app last wrote. It reloads from that snapshot about every 30 minutes and at each of its timeline entries.
Every tap opens Today with pantopus://today?src=widget&section=…
- Small: the whole widget is one target. It opens the hero's own section: section=pickup for a pickup hero, section=air for an air hero, section=strip for a date hero.
- Medium: two link regions, each at least 44pt / 48dp tall. The hero region opens the hero's section. The strip-and-air region opens section=strip.
- Large: four link regions, each at least 44pt tall.
  - The year band opens section=year, which goes to Place → Your place file at its year band.
  - Each of the three lines opens its own fact: a pickup line opens section=pickup, the air line opens section=air, and a date line opens section=strip.
  - On a day with no crossing, the landing handles section=air by scrolling to the air band.
- No place: pantopus://today?src=widget opens the Add a place sheet.
What changes the snapshot:
- Confirming pickup rewrites the snapshot immediately and reloads the widget. This applies to "Yes, Tuesday is right" on Today and to the notification's "That's My Day" action, which works without opening the app. The hollow mark becomes a tick with "You · Tuesday".
- A confirm rewrites only the pickup facts. The air reading keeps its original observation time.
- Claiming the address also rewrites the snapshot. The street label stays the same, and the scope changes from "Saved place · Only you" to "Your household".
- A widget tap forces Today to refresh. A successful refresh writes a new snapshot, which clears "Open to refresh".

WHO AND WHEN
Maya Chen at HOME A, Mon 19 Oct, 7:40 AM. Today has just refreshed while she makes coffee. Tomorrow is recycling week, and she hasn't confirmed the pickup schedule yet. At 6:10 PM she glances at her phone again without opening the app. The hero now reads "Bins out tonight", and the morning air reading is 11 hours old. Every fixture person appears on both platforms with the same data, so the platforms can be compared.

THE ONE JOB
Show what's due at this address, what the air is like and what's next, right on the home screen, with no notification and no permission.

FIRST FIVE SECONDS
1. The eye lands first on the hero line ("Recycling and garbage tomorrow").
2. Then on its drawn mark and the word "Unconfirmed".
3. Then on the instrument for that size: the 14-day strip on the medium, the year band on the large.
The only action is a tap, which opens that fact in Today.

CONTENT
The snapshot was written Mon 19 Oct at 7:40 AM for HOME A. The place label is "Larkspur Loop" (the street name only), and the scope is "Your household". The snapshot holds only dates this viewer is allowed to see.

One urgency ladder picks the hero at every size on both platforms, in this order:
1. pickup today or tomorrow;
2. AQI 101 or higher;
3. the nearest date;
4. any pickup;
5. any AQI.
Day words are worked out at render time from the stored dates. They are never stored as text.

Pickup hero wording over time:
- Before 5:00 PM on Mon 19 Oct: the hero reads "Recycling and garbage tomorrow", and the caption reads "Bins out tonight".
- From the 5:00 PM entry: the hero reads "Bins out tonight", and the caption reads "Recycling and garbage · curbside by 6:30 AM tomorrow".
- From midnight: the hero reads "Recycling and garbage today", and the caption reads "Curbside by 6:30 AM".
- From the 6:30 AM entry on Tue 20 Oct: the pickup leaves the hero, and the ladder picks the next rung: "Clark Public Utilities bill due · in 3 days · Fri 23 Oct".
The pickup hero also carries:
- KindGlyph (garbage+recycling). "Garbage only" lines use KindGlyph (garbage).
- ProvenanceMark XS (hollow) with the word "Unconfirmed".
- The authority, "Waste Connections".

Air: AQI 42 · Good · AirNow · observed 7:00 AM.

Next date: "Clark Public Utilities bill due" · "in 4 days · Fri 23 Oct" · a tick mark with "You added this". The widget shows no amounts anywhere.

The next 14 days run Mon 19 Oct to Sun 1 Nov and hold 6 items:
- Tue 20 Oct: recycling and garbage (hollow).
- Fri 23 Oct: Clark Public Utilities bill (tick).
- Mon 26 Oct: "Online or mail voter registration must arrive by Mon 26 Oct" (a Washington rule, drawn as a full-height bar).
- Tue 27 Oct: garbage only (hollow).
- Wed 28 Oct: City of Vancouver water bill (tick).
- Sun 1 Nov: HOA dues (tick).

The year runs Oct 2026 to Sep 2027. It has four lanes (You · Vancouver · Clark County · Washington) and 9 dates:
- You: HOA dues 1 Nov · water-heater warranty ends 12 Dec · lease notice deadline 1 Mar · lease ends 31 Mar. The last two form a March cluster marked "2". All are ticks.
- Vancouver: pickup service weeks, drawn as a light rhythm and not counted.
  - Draw the holiday-moved weeks (Memorial Day, 31 May, and Labor Day, 6 Sep) as moved.
  - Draw the weeks after the last published city calendar (assumed to run through Dec 2026) in projected styling.
- Clark County: property tax 2nd half due Mon 2 Nov (moved from Sat 31 Oct) · property tax 1st half 30 Apr · tax appeal deadline 1 Jul (or 60 days after your notice). All are filled.
- Washington: online or mail voter registration must arrive by 26 Oct · general election 3 Nov.
Utility bills are not lanes in the year band, because the place file's money section comes in phase 2. That is why the year's "Next" is the voter deadline, while the date line shows the Fri 23 Oct bill.

Deltas (list each one on Notes):
- Date hero, Wed 21 Oct, 8:00 AM: "Clark Public Utilities bill due · in 2 days · Fri 23 Oct".
- Air hero, Thu 22 Oct, 4:10 PM (the house style alert variant):
  - The hero reads "AQI 118 · Unhealthy for Sensitive Groups", observed 4:00 PM, with a filled mark and "Official".
  - The small and the Android minimum use the short form "AQI 118 · Sensitive groups".
  - The large's three lines are the air hero, "Clark Public Utilities bill due · Tomorrow" and "Garbage only · in 5 days · Tue 27 Oct".
  - The strip runs Thu 22 Oct to Wed 4 Nov: Fri 23 bill (tick) · Mon 26 Washington bar · Tue 27 garbage only (hollow) · Wed 28 water bill (tick) · Sun 1 Nov HOA dues (tick) · Mon 2 Nov property tax (filled) and Comcast bill (tick) · Tue 3 Nov recycling and garbage (hollow), plus the general election bar.
- Confirmed: a tick with "You · Tuesday".
- Holiday move, Tue 1 Jun 2027, 7:40 AM (Memorial Day was Mon 31 May). This assumes Waste Connections moves pickups one day later after a Monday holiday.
  - The hero reads "Recycling and garbage tomorrow".
  - The caption reads "Moved to Wed 2 Jun for the holiday", followed by the hollow mark and "Unconfirmed".
  - In the strip, the hollow mark sits on Wed 2 Jun and a struck-through ghost stays on Tue 1 Jun. Tue 8 Jun shows garbage only (hollow).
  - This frame shows no other dates.
- No pickup rule and a quiet fortnight: a saved place labelled "NE 99th St · Saved place · Only you" with no city pickup schedule. The snapshot is from Mon 11 Jan 2027, 7:40 AM. Nothing is dated between Mon 11 and Sun 24 Jan. Air reads "AQI 42 · Good · AirNow 7:00 AM".
- Stale air, same day: the Mon 7:40 AM snapshot seen at 6:10 PM. It shows the evening hero, and the air row reads "Observed 7:00 AM · AirNow — 11 hours ago".
- Stale air, earlier day: when the observation is not from today, put the weekday first: "Observed Mon 7:00 AM · AirNow — 2 days ago".
- Past the horizon: the same snapshot seen on Tue 3 Nov.
Worst case: the air hero at the 245x115dp Android minimum.

LAYOUT & VISUALIZATION
Each size earns its space with a different form, not with more lines: the small shows today, the medium shows the next 14 days, and the large shows the year. At every size, leave out any keeper, avatar, keeper mood text, logo and amount.
Marks: filled means official, hollow means on record but not confirmed, and a tick means you added it. Draw every mark as a shape. Never type a ○ character. Every text line prints its word next to the mark. Strip and lane marks have no room for words, so the spoken label carries them.

SMALL (126x126). Draw exactly three rows with 8pt gaps. The height budget is 16 + 72 + 16 + 2×8 = 120 of 126pt.
- Row 1 (16pt): KindGlyph at widget size (16pt), an 8pt gap, the ScopeChip glyph alone (12pt: a house for Your household, a person for Only you), a 4pt gap, then the place label in caption ("Larkspur Loop").
- Row 2 (up to 72pt): the hero in body semibold (16/24), up to 3 lines, for every kind of hero. Truncate the title if needed, but never the day words. Keep the full title in the spoken label.
- Row 3 (16pt): ProvenanceMark XS and its word.
Air hero on the small:
- Row 1 drops the KindGlyph and keeps the scope glyph and the place label.
- Row 2 holds "AQI 118 · Sensitive groups" (2 lines, 48pt), followed by the AqiBand widget micro variant across the full width (8pt bar, 8pt gap).
- Row 3 is the filled mark with "Official".
- The hero line directly above the band prints the category name.
Add nothing else: no air chip, no date and no logo.

MEDIUM, pickup hero (306x126). Top to bottom, with 4pt gaps. The height budget is 16 + 24 + 16 + 32 + 16 + 4×4 = 120.
1. The label line, in caption: "Larkspur Loop · Your household".
2. KindGlyph (garbage+recycling), then the hero in body semibold.
3. The caption "Bins out tonight", then ProvenanceMark XS (hollow, 12pt, with an 8pt gap), then "Unconfirmed · Waste Connections".
4. FourteenDayStrip in its widget medium variant (32pt tall), spanning the full 306pt (about 21.9pt per cell).
   - Use XS 12pt marks.
   - Label only "Today" under cell 1 and "Mon 26" under cell 8.
   - Give weekend cells a lower-opacity fill.
5. AqiBand in its widget micro variant: six ColorVision Assist segments with 2px gaps, a keyline, and a two-tone marker low in Good. Print "AQI 42 · Good · AirNow 7:00 AM" beside the bar, never on the fill.
Rows 1–3 form the hero region. Rows 4–5 form the strip-and-air region.

MEDIUM, air hero (Thu 22 Oct). Top to bottom, with 4pt gaps:
1. The label line.
2. The hero "AQI 118 · Unhealthy for Sensitive Groups" in body semibold, starting at the content edge with no KindGlyph (the contract has no air glyph).
   - It wraps to 2 lines.
   - The caption continues on the hero's second line: "AirNow · observed 4:00 PM", then a filled ProvenanceMark XS, then "Official".
3. The AqiBand widget micro row, directly under the hero, with its marker in segment 3 and "Sensitive groups" printed beside the bar.
   The hero, caption and band form one link region, which opens section=air.
4. The strip, as the second region (section=strip).
The budget is 16 + 48 + 16 + 32 + 3×4 = 124. "Clark Public Utilities bill due · Tomorrow" appears only on the large.

MEDIUM, date hero (artboard 06, and the gallery's own-data preview). Top to bottom:
1. The label line.
2. KindGlyph, then the title in body semibold, up to 2 lines.
3. The caption: the relative date, ProvenanceMark XS and its word (for example "in 4 days · Fri 23 Oct", a tick, "You added this").
   - It continues on the title's last line when it fits.
   - Otherwise it takes its own caption line. In that case the air row drops, following the drop order.
4. The strip.
5. The air row, when it fits.
The budget is 16 + 48 + 16 + 32 + gaps, or at most 126.

LARGE (306x322). Top to bottom:
1. The label line (16pt), then an 8pt gap.
2. YearBand in its widget large variant (148pt):
   - Month labels: 16pt, with 12 full-width month columns and three-letter labels.
   - Four lanes of 30pt each, with 4pt gaps. Each lane is a 16pt caption label over a 14pt marker row.
   - Group markers per month per lane, and add a count when a group has 2 or more.
   - Draw statewide rules as bars the full height of the lane.
   - Add a 1.5px today rule and a shaded 14-day window.
   Then an 8pt gap.
3. Three lines in DateRow grammar at widget density:
   - Each row is 44pt with a 16pt KindGlyph. The air line uses a small AqiBand swatch instead.
   - Line 1 of each row: the title in bodySmall 14/20.
   - Line 2 of each row: the relative date · mark · word · authority, in caption 12/16.
   - The lines are the hero, then air ("AQI 42 · Good · AirNow, observed 7:00 AM"), then the next date.
   - On an air day, the lines are the air hero, the bill tomorrow, and garbage in 5 days.
The height budget is 16 + 8 + 148 + 8 + 3×44 = 312 of 322pt.

ANDROID BREAKPOINTS
a. 2x2 at 130x220dp: the small composition, centred vertically. The spare height lets the hero take up to 4 lines.
b. 4x2 at 276x220dp: the medium composition. Split the extra height between the hero (up to 3 lines) and the band row.
c. 4x2 at the 245x115dp minimum:
   - Clamp the hero to 1 line. Truncate the title and keep the day word, for example "Recycling and gar… tomorrow". The full text goes in the spoken label.
   - The caption merges into the label line as "Larkspur Loop · Unconfirmed". Put the scope glyph before the label and the drawn mark before "Unconfirmed".
   - The strip stays (213dp ÷ 14 ≈ 15dp per cell, XS marks, anchor labels only).
   - The scope words and the air row drop out.
   - For an air hero, the hero reads "AQI 118 · Sensitive groups".
d. 4x4 at 276x456dp: the large composition, with the extra height going to the three lines.
e. 2x2 at the 109x115dp minimum: use 12dp padding. Keep rows 1 and 3. Clamp the hero to 2 lines of body semibold (48dp). That is about 80dp plus two 4dp gaps.
When space runs out, drop things in this order: the scope words (the scope glyph stays), then the air row, then the caption line (by merging it into the label). The strip and the place label never drop. The hero clamps to fewer lines, and its full text always stays in the spoken label.

Degraded states. Each one must look different:
- Air missing: the air row goes and the layout rebalances. There is no hole and no failed widget.
- Pickup missing: the next rung of the ladder takes the hero, using the date-hero layout.
- No pickup rule: "Set your pickup day" appears as a demoted caption line with no mark, above the strip. It is never the hero.
- Nothing due: the strip's cells are drawn with no marks, plus "Checked — nothing in the next two weeks".
- Stale, judged per fact:
  - Pickup and dates keep rendering for the 14-day snapshot horizon.
  - Only the AQI row goes stale, after 6 hours. Its band segments and marker drop to 50% opacity. Its text stays at full text.secondary and gives the age: "Observed 7:00 AM · AirNow — 11 hours ago" (on an earlier day, "Observed Mon 7:00 AM · AirNow — 2 days ago").
  - Every frame set at 6:10 PM on Mon 19 Oct shows this stale air row, including the frames after a confirm.
- Past the horizon: marks and cells dim, the geometry stays, and text stays at full contrast. The line reads "As of Mon 19 Oct, 7:40 AM · Open to refresh".
- No snapshot: "Open Pantopus to see today at your address", with a glyph and no cells.
- No place: "Save an address to see today here", with a glyph and no cells. This appears only on a platform where the signed-in Add a place sheet exists. Until then, show the no-snapshot text instead.

INTERACTION, MOTION & HAPTICS
- Widgets respond to taps only. There are no gestures. The link regions are listed above.
- There is no motion inside the widget.
- Timeline entries fall at each local midnight for 14 days, at 5:00 PM on the evening before pickup, and at 6:30 AM on pickup day. The words change without the app being opened.
- On Android, the app opens with the system launch transition from the widget background.
- There are no haptics.
- Smart Stack relevance (for Notes):
  - high from 5:00 PM on the evening before pickup until 6:30 AM on pickup day, and whenever AQI is 101 or higher;
  - medium for a date within 3 days;
  - zero on quiet days.
  Today donates an intent each time it opens.

FOUNDATIONS COMPONENTS USED
- ProvenanceMark, XS size. On iOS it is widgetAccentable, and the tick stays knocked out when tinted. On Android it uses fixed ink.
- KindGlyph at widget 16pt: garbage+recycling, garbage and bill.
- ScopeChip, as a glyph only on the small and the Android minimum, and as words in the label line elsewhere.
- FourteenDayStrip, widget medium variant.
- AqiBand, widget micro variant, with EPA hues kept fixed on Android.
- YearBand, widget large variant, with place-name lanes, holiday moves and projected weeks.
- DateRow, at the widget density given for the large lines.
- FreshnessLine, in the per-fact stale and widget past-horizon variants.
- QuietDayReceipt, strip empty variant.
- PickupCard, widget small hero variant, including the holiday-moved and no-rule variants.

ACCESSIBILITY
- Text is 11pt or larger and is never rasterised.
- The small is one element with one label: "Larkspur Loop, your household. Recycling and garbage tomorrow, bins out tonight, Waste Connections, on record, not confirmed."
- The medium and large have one element per link region, read top to bottom:
  - Medium region 1 and the large hero line: "Larkspur Loop, your household. Recycling and garbage tomorrow, bins out tonight, Waste Connections, on record, not confirmed."
  - Medium region 2: "Next 14 days: 6 items; next, recycling and garbage Tuesday 20 October. Air quality index 42, Good, category 1 of 6, AirNow, observed 7 AM."
  - Large year band: "Next 12 months: 9 dates. Next: online or mail voter registration must arrive by Monday 26 October."
  - Large air line: "Air quality index 42, Good, category 1 of 6, AirNow, observed 7 AM."
  - Large date line: "Clark Public Utilities bill due in 4 days, Friday 23 October, you added this."
  - A stale air label adds "observed 11 hours ago".
  - A saved place's label says "Saved place, only you".
- At AX5 (iOS) and 200% (Android), the strip, band and lanes drop out:
  - The small shows only the hero, with the drawn mark. The hero is shortened to its day words first ("Recycling and garbage tomorrow" becomes "Pickup tomorrow"). The place label and the air reading move into the spoken label.
  - The medium keeps the hero and the place label as wrapping text.
  - The large keeps the hero, the place label and the air reading as wrapping text.
  - Nothing ever truncates the day words.
- In tinted, clear, StandBy and greyscale renderings, meaning survives through shape, gaps, opacity and words.
- Tap regions are at least 44pt / 48dp.

COPY
Today at your address · Larkspur Loop · Your household · Saved place · Only you · Recycling and garbage tomorrow · Recycling and garbage today · Pickup tomorrow · Bins out tonight · Recycling and garbage · curbside by 6:30 AM tomorrow · Curbside by 6:30 AM · Garbage only · in 5 days · Tue 27 Oct · Moved to Wed 2 Jun for the holiday · Unconfirmed · Official · You added this · You · Tuesday · Waste Connections · AQI 42 · Good · AirNow 7:00 AM · AirNow, observed 7:00 AM · AQI 118 · Sensitive groups · AQI 118 · Unhealthy for Sensitive Groups · AirNow · observed 4:00 PM · Observed 7:00 AM · AirNow — 11 hours ago · Observed Mon 7:00 AM · AirNow — 2 days ago · Clark Public Utilities bill due · in 4 days · Fri 23 Oct · in 3 days · in 2 days · Tomorrow · Online or mail voter registration must arrive by Mon 26 Oct · Today · Mon 26 · You · Vancouver · Clark County · Washington · Set your pickup day · Checked — nothing in the next two weeks · As of Mon 19 Oct, 7:40 AM · Open to refresh · Open Pantopus to see today at your address · Save an address to see today here.

EDGE CASES
- Longest label: "Birchfield Ct · Saved place · Only you" on the medium and large. The small and the Android minimum show the person glyph and "Birchfield Ct".
- Highest AQI: 301 or more puts the marker in the last segment, labelled "Hazardous".
- A day with 4 items shows 3 marks, then "+1".
- Holiday move: see the delta above. The year band shows moved and projected weeks.
- Widget added before any Today load: show the no-snapshot state.
- No place: the no-place text ships only once the signed-in Add a place sheet exists on that platform. Until then, show "Open Pantopus to see today at your address".
- A household member without permission to see bills gets no bill lines or bill marks. The snapshot holds only dates the viewer may see.
- Saved place or claimed home: the scope words and the scope glyph change. The street label stays the same.
- More than one place: the widget mirrors the last place Today showed, so the label is the only clue. The pilot has one address per person. The label never truncates.
- The app has not been opened for two days: pickup and date lines still render correctly, and only the air row greys, using the earlier-day age string.

INSTEAD OF
- Instead of three equal text lines, draw one hero picked by the ladder, above that size's instrument — because a lease notice months away must not weigh the same as tomorrow's recycling.
- Instead of a 120pt strip with 6pt dots and an initial under every cell, draw a full-width strip with 12pt marks and anchor labels only — because 11pt text and a readable tick need about 21pt per cell.
- Instead of greying the whole widget, or the AQI text, after 6 hours, dim only the AQI band and marker and add their age in full-contrast text, in every evening frame — because pickup rules and dates stay true for weeks and text must stay readable.
- Instead of a typed ○ or "AQI 42 Good" on a coloured fill, draw ProvenanceMark XS and the micro band with the name beside it — because the mark and the category must survive tinting.
- Instead of stacking rows until the small overflows, keep the three-row, 120pt budget and clamp the hero — because Claude Design must not quietly shrink the type below 11pt.
- Instead of every tap opening the top of Today, give each region its own section — because the tapped fact can be below the fold.
- Instead of Ollie, a percentage, a progress ring or a grade, draw marks in cells and lanes and nothing else — because the widget states facts and does not score or nag.
- Instead of Pantopus blue chrome on Android 12 and later, use Material dynamic roles (surface, primary, primaryContainer) with Pantopus tokens as the fallback. Marks and EPA hues stay fixed — because Android's widget quality bar requires device theming.

DONE WHEN
- After one Today load, the widget shows the hero, the strip and the air reading.
- With the app closed:
  - "Tomorrow" becomes "Bins out tonight" at 5:00 PM;
  - "Today" appears at midnight;
  - the pickup leaves the hero at 6:30 AM.
- A pickup confirmed from the tray shows a tick without the app being opened, and the 11-hour-old air stays marked stale.
- Someone with no place sees the no-place text only where the Add a place sheet exists.
- "Nothing due", "stale" and "no snapshot" look like three different pictures.
- On the AQI 118 day, the widget and Today agree on the hero, and the same string order is used everywhere.
- Every size fits its stated height budget.
- Every size reads as text at AX5, and the strip survives the Android minimum.

ARTBOARDS
1. f7-today-widget · ios · 01-dense-set · light — two home-screen pages side by side at Mon 19 Oct, 7:40 AM. Page 1 has the small and the medium, page 2 has the large. Pickup hero with the drawn hollow mark.
2. f7-today-widget · ios · 02-tap-regions · light — the medium and large from 01. Outline each link region in dashes and label it with its section: two regions on the medium, four on the large.
3. f7-today-widget · ios · 03-small-ladder · light — four small widgets: pickup tomorrow, pickup today, the Wed 21 Oct date hero (3 lines), and the air hero ("AQI 118 · Sensitive groups" with the band under it).
4. f7-today-widget · ios · 04-air-hero · light — the medium at 338x158 on Thu 22 Oct, 4:10 PM: the 2-line hero "AQI 118 · Unhealthy for Sensitive Groups" with the caption on its second line, the band with "Sensitive groups" under it, then the strip. Beside it, the large with its three air-day lines.
5. f7-today-widget · ios · 05-evening-confirmed · light — the medium at 6:10 PM with the "Bins out tonight" hero. Next to it, the small and the medium after a tray confirm, showing the tick and "You · Tuesday". In all three, the air band and marker are at 50% with "Observed 7:00 AM · AirNow — 11 hours ago".
6. f7-today-widget · ios · 06-partial · light — two mediums: air missing (rebalanced), and pickup missing (the Fri 23 Oct bill in the date-hero layout).
7. f7-today-widget · ios · 07-no-rule-quiet · light — the NE 99th St small and medium on Mon 11 Jan 2027: "Set your pickup day" demoted, empty cells, and "Checked — nothing in the next two weeks".
8. f7-today-widget · ios · 08-holiday-move · light — the medium on Tue 1 Jun 2027: the moved caption, a hollow mark on Wed 2 Jun, and a struck ghost on Tue 1 Jun. Beside it, a detail of the large's Vancouver lane with the moved and projected weeks.
9. f7-today-widget · ios · 09-stale-air · light — the medium and large at 6:10 PM: only the AQI band and marker dimmed, with the text at full contrast and its age. Below them, one medium air row with the earlier-day string "Observed Mon 7:00 AM · AirNow — 2 days ago".
10. f7-today-widget · ios · 10-past-horizon · light — the medium and large on Tue 3 Nov: marks and cells dimmed, geometry kept, and "As of Mon 19 Oct, 7:40 AM · Open to refresh".
11. f7-today-widget · ios · 11-no-snapshot-no-place · light — the two placeholders, at small and medium sizes.
12. f7-today-widget · ios · 12-tinted-clear · dark — accented (tinted) and clear renderings of all three sizes, with the strip, band and marks still readable.
13. f7-today-widget · ios · 13-standby · dark — StandBy: two small widgets scaled up on black with no background, greyscale shapes and larger type, plus a red low-light copy.
14. f7-today-widget · android · 14-dense-set · light — two home-screen pages in dynamic colour. Page 1 has the 2x2 and the 4x2, page 2 has the 4x4.
15. f7-today-widget · android · 15-minimum-size · light — the 2x2 at 109x115dp with the pickup hero, and the 4x2 at 245x115dp twice: once with the pickup hero, and once with the "AQI 118 · Sensitive groups" air hero (the worst case). Label merged with the scope glyph, strip kept, scope words and air row dropped.
16. f7-today-widget · android · 16-dynamic-nonblue · light — the 4x2 and 4x4 on a green wallpaper palette, with marks and EPA hues unchanged.
17. f7-today-widget · ios · 17-ax5 · light — all three sizes at AX5, as text only. The small shows "Pickup tomorrow" and its mark.
18. f7-today-widget · android · 18-200-percent · light — the 4x2 and 4x4 at 200%, as text only.
19. f7-today-widget · ios · 19-greyscale · light — artboard 01 in greyscale.
20. f7-today-widget · ios · 20-dense-set · dark — the dark twin of 01.
21. f7-today-widget · ios · 21-air-hero · dark — the dark twin of 04.
22. f7-today-widget · android · 22-dense-set · dark — the dark twin of 14.
23. f7-today-widget · ios · 23-height-budgets · light — the small, the three medium layouts (pickup, air and date hero) and the large, drawn with their row heights annotated, to show that each fits its content area.
24. f7-today-widget · ios · 24-stale-past-horizon · dark — the dark twins of 09 and 10 side by side, so the 50% band dimming and the dimmed cells can be checked on black.
25. f7-today-widget · ios · 25-notes · light — the Notes artboard; see the list below.

Notes must cover:
- the assumed Android grid;
- the height budgets (small 16 + 72 + 16 + 2×8 = 120 of 126pt; large 312 of 322pt);
- the Smart Stack rules, and that CarPlay gets the same treatment as StandBy (removable background, larger type, greyscale shapes) rather than being declared a disfavored location;
- the three timeline entries, including the 6:30 AM pickup-day entry;
- that strip and lane marks carry no words;
- "Unconfirmed" as the widget short form of "On record, not confirmed" (it matches the push caveat);
- that the scope words are left off the small and the Android minimum and replaced by the ScopeChip glyph, with the full string kept in the spoken label (a proposed deviation from invariant 2);
- the dated "As of Mon 19 Oct, 7:40 AM · Open to refresh" as a proposed update to the contract string "As of Mon 7:40 AM · Open to refresh" (the date is needed when the widget is viewed two weeks later);
- the earlier-day age string;
- that the medium air hero has no glyph;
- that the small air hero prints the category name in the hero directly above the band, not beside the band;
- that the medium shows "AirNow 7:00 AM" for lack of width, while the large and the spoken labels say "observed";
- that bills are not lanes in the year band;
- that the holiday-moved weeks, the Dec 2026 calendar end and the one-day holiday shift are assumptions;
- the rule that a confirm or claim rewrites the snapshot at once, and that a confirm keeps the old air observation;
- the flow's wording "Tomorrow has become Tonight", drawn here as the 5:00 PM "Bins out tonight" hero;
- the AX5 short form "Pickup tomorrow";
- the research wish to keep the band at the Android minimum, dropped in favour of the strip;
- the no-place condition;
- the permission rule for bill lines;
- the no-amounts and no-keeper choices;
- the design doc's shorthand strings and their replacements:
  - "Recycling + garbage Tue" → "Recycling and garbage tomorrow" (via the ladder);
  - "Garbage tomorrow" → "Garbage only tomorrow";
  - "AQI 42 Good" → "AQI 42 · Good";
  - "Lease notice · 12d" → the DateRow relative date;
  - "Tax due Oct 31" → "Property tax due · Mon 2 Nov" (moved from Sat 31 Oct);
- the doc's whole-widget 6-hour staleness rule, replaced by per-fact staleness;
- every invented string;
- omitted states.

BATCH PLAN
Turn 1: artboards 1-6, then wait for "continue".
Turn 2: artboards 7-12, then wait.
Turn 3: artboards 13-18, then wait.
Turn 4: artboards 19-24, then wait.
Turn 5: artboard 25.
