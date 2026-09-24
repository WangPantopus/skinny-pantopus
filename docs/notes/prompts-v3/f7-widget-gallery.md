# Widget gallery entry (name, description, preview)
id: f7-widget-gallery · platforms: ios/android · isNew: True · artboards: 14

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Widget gallery entry (name, description, preview) · f7-widget-gallery

TYPE: NEW. This is preview artwork, plus the OS picker screens that show it. It is not a running widget.

ATTACH:
- the f7-today-widget artboards 01 (the iOS set), 14 (the Android set) and 06 (the medium date-hero layout), so the previews match the real widget exactly;
- the existing Pantopus "Tasks near me" widget on Android, for its picker tile.

PLATFORMS & VIEWPORTS
- iOS: the widget gallery on 393x852. Draw the Pantopus detail page with its size carousel, page dots and the system "Add Widget" button. Previews are 158x158, 338x158 and 338x354pt.
- Android: the widget picker on 412x915 with the Pantopus section expanded, plus the drag preview that appears on touch and hold.
  - The Android widget is one responsive widget, so the picker shows one tile at the 4x2 target size (276x220dp, scaled to the picker), with the size label "4 × 2".
  - The 2x2 and 4x4 layouts appear only after the widget is resized on the home screen.
- Draw OS chrome in neutral system styling. Pantopus tokens apply only inside the previews.

WHERE IT LIVES & HOW PEOPLE ARRIVE
This lives in the OS widget gallery, outside the four tabs.
- iOS: touch and hold the home screen → Edit → Add Widget → search for or pick Pantopus.
- Android: touch and hold the home screen → Widgets → Pantopus. Or touch and hold the Pantopus icon → Widgets.
The how-to sheet ("Put today on your home screen") walks people here. This screen is the whole top of the widget funnel.
Next step: the widget is placed and shows the person's snapshot, or the no-snapshot state if Today has never been loaded.

WHO AND WHEN
- Artboards 01–03: someone new, with no place and no snapshot, browsing an iPhone's widget gallery on the evening of Mon 19 Oct. They see the baked sample.
- Artboard 04: Jordan Lee (PLACE B) on his iPhone, after one Today load. His snapshot was written Mon 19 Oct at 7:50 AM, and the gallery is viewed the same morning.
- Artboard 07: Jordan on a Pixel running Android 15, with the same snapshot.
Each fixture person appears on both platforms with the same data, so the platforms can be compared.

THE ONE JOB
Make someone browsing the widget gallery understand what this widget shows, and want to add it.

FIRST FIVE SECONDS
1. The eye lands first on the preview: a real-looking pickup day, strip and air band.
2. Then on the name, "Today at your address".
3. Then on the description, which starts with a verb.
The single primary action is the system Add Widget button on iOS. On Android, it is dragging the tile or tapping it.

CONTENT
Name: "Today at your address".
Description: "See pickup day, air quality and your next date at your address."

The baked sample is identical on both platforms. It is also the preview for anyone with no place or no snapshot. It reuses HOME A data as of Mon 19 Oct, 7:40 AM, and never shows an age or a stale state.
- Small:
  - row 1: KindGlyph (garbage+recycling), the house ScopeChip glyph, and "Larkspur Loop";
  - row 2: "Recycling and garbage tomorrow";
  - row 3: ProvenanceMark XS (hollow) with "Unconfirmed".
- Medium:
  - the label "Larkspur Loop · Your household";
  - the same hero;
  - the caption "Bins out tonight", then ProvenanceMark XS (hollow), then "Unconfirmed · Waste Connections";
  - the 14-day strip with 6 items: Tue 20 hollow, Fri 23 tick, Mon 26 Washington bar, Tue 27 hollow, Wed 28 tick, Sun 1 Nov tick;
  - the AqiBand micro variant, with the marker low in Good and "AQI 42 · Good · AirNow 7:00 AM" beside it.
- Large:
  - The year band (You · Vancouver · Clark County · Washington), with 9 dates spread across the lanes:
    - HOA dues 1 Nov; water-heater warranty 12 Dec; lease notice 1 Mar and lease end 31 Mar, shown as a March cluster "2" (all ticks);
    - property tax Mon 2 Nov and 30 Apr, and the appeal deadline 1 Jul, all drawn as filled marks in the Clark County lane;
    - online or mail voter registration 26 Oct and general election 3 Nov, both as Washington bars.
  - Below the band, three lines:
    - the pickup hero;
    - "AQI 42 · Good · AirNow, observed 7:00 AM";
    - "Clark Public Utilities bill due · in 4 days · Fri 23 Oct", with a tick and "You added this".
All three provenance shapes appear on the large sample: filled on the Clark County property tax markers, hollow on the pickup, and a tick on the bill. The medium shows hollow and tick marks. This makes the honesty encoding visible before install.

Own-data delta: Jordan Lee's snapshot, written Mon 19 Oct at 7:50 AM. It is used once a snapshot exists.
- Medium label: "Birchfield Ct · Saved place · Only you".
- Hero (the f7-today-widget medium date-hero layout):
  - KindGlyph (voter registration);
  - "Online or mail voter registration must arrive by Mon 26 Oct" in body semibold, on 2 lines;
  - "in 7 days", a filled ProvenanceMark XS and "Official". These continue on line 2 in caption where they fit, and otherwise take their own caption line.
- The air row drops, following the widget's drop order, so the strip keeps its full height.
- Strip: hollow pickup marks on Thu 22 and Thu 29 Oct, and the Mon 26 Oct Washington bar.
- Large and Android 4x2: add the air row "AQI 42 · Good".
List every invented string on Notes.

LAYOUT & VISUALIZATION
- Each preview uses the widget's own layout: the small shows one fact, the medium the strip, and the large the year. The larger size must visibly earn its space. No size may look emptier than the size below it.
- The strip is about half full, the AQI marker sits clearly inside a named band, and the year lanes are spread across the months.
- iOS picker previews use the baked sample until a snapshot exists. After that, they use the person's own data from a local read.
- On Android, the picker shows one tile at 4x2, with Pantopus's existing "Tasks near me" tile beside it, both in Material dynamic colour.
- On Android 15 and later, a generated preview with the person's own data is pushed after their first Today load. Below Android 15, the tile keeps the baked sample.
- The iOS redacted placeholder keeps the geometry: strip cells, band segments and lane rules stay drawn. Only the text becomes rounded bars.
- The preview never shows an empty state.

INTERACTION, MOTION & HAPTICS
The OS owns every interaction:
- swiping the size carousel, which also has page dots;
- tapping Add Widget;
- on Android, dragging the tile after touching and holding it, or tapping the tile to add it.
The previews have no motion of their own. Haptics are the system's.

FOUNDATIONS COMPONENTS USED
ProvenanceMark (XS, drawn with its word) · KindGlyph (widget 16pt) · ScopeChip (glyph on the small, words in the label line) · FourteenDayStrip (widget medium) · AqiBand (widget micro) · YearBand (gallery sample variant) · PickupCard (widget small hero variant).

ACCESSIBILITY
- The description reads in full and wraps at AX5 and 200%.
- In the AX frames, the previews use the widget's text-only form: hero, label and air reading.
- Each preview's spoken label matches the widget's per-region labels.
- Greyscale previews still separate the three mark shapes and the band segments.
- Text in previews is 11pt or larger.

COPY
Today at your address · See pickup day, air quality and your next date at your address. · Recycling and garbage tomorrow · Bins out tonight · Unconfirmed · Waste Connections · Official · You added this · Larkspur Loop · Your household · Birchfield Ct · Saved place · Only you · AQI 42 · Good · AirNow 7:00 AM · AirNow, observed 7:00 AM · Clark Public Utilities bill due · in 4 days · Fri 23 Oct · Online or mail voter registration must arrive by Mon 26 Oct · in 7 days · 4 × 2.
Keep system button text exactly as the OS writes it. Never say "this widget" in the name or the description.

EDGE CASES
- No place, or no snapshot: show the baked sample. Never show "Save an address to see today here", and never a sign-in prompt.
- A snapshot exists on Android below version 15: show the baked sample, in dynamic colour.
- The description at AX5 wraps to 3 lines.
- Dark mode and a non-blue wallpaper: the previews follow the theme, while marks and EPA hues stay fixed.
- Jordan's voter hero is the longest hero. It wraps to 2 lines on the iOS medium (3 on the Android 4x2) without truncating.

INSTEAD OF
- Instead of the live layout bound to real state, draw a dedicated populated sample, and switch to the person's own snapshot when one exists — because the live layout with no data sells the empty state.
- Instead of a feature-style description ("Pickup, air and your next date — no notification needed.") or any phrase naming "this widget", write a sentence that starts with a verb — because the platform guidelines ask for that. The no-notification point lives in the how-to sheet.
- Instead of a filled mark or a typed ○ on the sample pickup, draw ProvenanceMark XS hollow with "Unconfirmed" — because the sample must match what the widget really shows.
- Instead of a 3-line voter hero crammed into the iOS medium, use the 2-line date-hero layout and drop the air row — because the medium has only 126pt of content height.
- Instead of three Android size tiles, draw one 4x2 tile labelled "4 × 2" — because the Android widget is one responsive widget.
- Instead of redaction that collapses into grey rectangles, keep cells, segments and lanes drawn — because the shape is the pitch.
- Instead of a device frame, marketing headline, logo lockup, gloss or gradient, show the OS picker as it is — because this is system chrome.
- Instead of Pantopus blue Android tiles, use dynamic colour — because Android previews must match the device theme.

DONE WHEN
- Someone browsing the gallery sees a populated preview at the correct size for each option.
- A brand-new user never sees an empty state.
- A user with a snapshot sees their own address and the correct scope words, where the platform allows it.
- The description starts with "See".
- Larger sizes show more form, not more text, and every preview fits its widget's height budget.

ARTBOARDS
1. f7-widget-gallery · ios · 01-gallery-medium · light — the gallery detail page with the medium sample preview selected, plus the name, the description and Add Widget.
2. f7-widget-gallery · ios · 02-gallery-large · light — the large sample preview selected, with the filled Clark County markers visible.
3. f7-widget-gallery · ios · 03-gallery-small · light — the small sample preview selected.
4. f7-widget-gallery · ios · 04-own-snapshot · light — Jordan's iPhone: the medium preview with his own data (2-line voter hero, Birchfield Ct label, no air row).
5. f7-widget-gallery · android · 05-picker-grid · light — the Pantopus section expanded: one "Today at your address" tile with the 4x2 sample preview, the label "4 × 2" and the description, and the existing "Tasks near me" tile beside it, all in dynamic colour.
6. f7-widget-gallery · android · 06-drag-preview · light — the 4x2 drag preview, shown on touch and hold, over a home screen.
7. f7-widget-gallery · android · 07-generated-preview · light — Jordan's Pixel on Android 15: the picker tile with his own data.
8. f7-widget-gallery · ios · 08-redacted · light — the redacted placeholder, with its geometry kept.
9. f7-widget-gallery · ios · 09-ax5 · light — 01 at AX5: the description wrapped, and the preview in text-only form.
10. f7-widget-gallery · android · 10-200-percent · light — 05 at 200%.
11. f7-widget-gallery · ios · 11-greyscale · light — 02 in greyscale, so all three mark shapes can be checked.
12. f7-widget-gallery · ios · 12-gallery-medium · dark — the dark twin of 01.
13. f7-widget-gallery · android · 13-picker-grid · dark — the dark twin of 05.
14. f7-widget-gallery · ios · 14-notes · light — the Notes artboard; see the list below.

Notes must cover:
- when previews switch from the sample to the person's own data on each platform, and that Android 15 generated previews are rate-limited to about 2 updates an hour, so the preview can lag the widget;
- that the sample reuses HOME A data, and that the OS picker has no caption slot, so the sample is shown there without a "Sample" label;
- a known trade-off: the sample shows scope words ("Your household") to people who have no place, and to Android users below version 15 who have their own snapshot. This keeps the data realistic (Apple's guidance) and keeps invariant 2, but a stranger's household could be read as theirs. Revisit this if pilot users read the sample as their own;
- that Jordan's filled "Official" voter hero assumes the Washington voter rule is verified against VoteWA before the pilot. If it is not verified, draw that mark hollow. In the sample, the voter date is a bar with no mark;
- "Unconfirmed" as the widget short form;
- the rule never to say "this widget";
- every invented string;
- omitted states.

BATCH PLAN
Turn 1: artboards 1-6, then wait for "continue".
Turn 2: artboards 7-12, then wait.
Turn 3: artboards 13-14.
