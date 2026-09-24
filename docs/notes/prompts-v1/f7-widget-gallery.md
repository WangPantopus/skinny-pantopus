# Widget gallery entry (name, description, preview)
id: f7-widget-gallery · platforms: ios/android · isNew: True · frames: 8

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Widget gallery entry — the name, description and preview artwork for "Today at your address" as a person browsing their phone's widget picker sees it.
THIS IS: a NEW surface. It is preview ARTWORK plus two OS-chrome frames, not a running widget.
PLATFORMS + VIEWPORTS: iOS widget gallery sheet on 393×852 (the app's detail page with the swipeable size carousel and the "Add Widget" button). Android widget picker on 412×915 (the expandable Pantopus section in the picker grid, plus the long-press drag preview).
IA + ENTRY: outside the four tabs entirely. The only route is the OS widget gallery — the user long-presses their home screen and browses. This is the whole top of the widget funnel.
THE ONE JOB: be the only place a person browsing their phone's widget gallery learns this exists, and make them want it.

CONTENT (use these exact strings):
Name: "Today at your address".
Description: "Pickup, air and your next date — no notification needed."
Sample data for the preview artwork, identical across both platforms:
- Small: "Recycling + garbage Tue" with the bin glyph and a filled provenance mark, label "Garfield St · Camas".
- Medium: hero "Recycling + garbage Tue", the 14-day dot strip half-populated (dots on cells 2, 3, 7, 9, 12 — one pickup pair, one civic, two yours), then the AQI micro band-bar reading "AQI 42" with the marker sitting low in the first EPA band.
- Large: the 12-month year strip with four lanes — You, Camas, Clark County, Washington — carrying about nine markers spread across the year (renters insurance 1 Oct, furnace service 4 Dec, leaf pickup 2–13 Nov, property tax 30 Oct and 30 Apr, voter registration 26 Oct, election 3 Nov) above the same three sample lines.

THE VISUALIZATION DECISION: build a DEDICATED preview composition with baked sample content — never the live layout bound to real state. Every instrument is present and populated: the strip is half-full rather than empty or crammed, the AQI marker is mid-low in a named band, the year lanes have visible spread. The provenance shapes (filled / hollow / filled-with-tick) appear in the sample so the honesty encoding is visible before install. The label reads "Garfield St · Camas" so the preview obviously belongs to an address without exposing a full street number. Sample content is chosen to show the FORM of each size — the small sells one fact, the medium sells the strip, the large sells the year — which is the only reason a browser would pick the larger tile.
DEGRADATION: iOS redaction must keep the geometry. When the system renders the placeholder redacted, the strip cells, band segments and lane rules stay drawn as shapes with text replaced by bars — a redacted frame that collapses to grey rectangles teaches nothing.

STATES TO DRAW (each its own frame):
1. iOS gallery detail sheet, small preview selected, name + description + Add Widget.
2. iOS gallery detail sheet, medium preview selected.
3. iOS gallery detail sheet, large preview selected.
4. Android widget picker, Pantopus section expanded, three preview tiles in the grid with name and description.
5. Android long-press drag preview at 4×2.
6. iOS redacted placeholder rendering.
7. Dark mode — iOS medium preview.
8. Dark mode — Android picker grid.

WHY IT IS SHAPED THIS WAY: the app's existing Android widget points its preview at the live layout, so cloning that pattern would sell the widget to a brand-new user with the words "Save an address to see today here" — the empty state as the advertisement. iOS falls into the same trap when the placeholder returns nothing. The description promises a fact, not a feature, because a gallery browser is deciding whether the tile is worth screen space.

DO NOT: do not reuse the live layout as preview artwork. Do not show "Save an address to see today here", a sign-in prompt, or any empty state in a preview. Do not wrap the preview in a device frame, add App Store gloss, a marketing headline, a logo lockup or a gradient. Do not show a size whose preview is emptier than the size below it.
