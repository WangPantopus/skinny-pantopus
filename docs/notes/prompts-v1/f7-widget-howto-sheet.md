# Add the widget (how-to, with a live preview)
id: f7-widget-howto-sheet · platforms: ios/android · isNew: True · frames: 7

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: "Add the widget" — a how-to sheet that shows the reward first, then teaches three OS gestures.
THIS IS: a NEW sheet.
PLATFORMS + VIEWPORTS: iOS .sheet at a medium detent over the Place tab, 393×852 device, sheet body ≈ 430pt tall. Android ModalBottomSheet on 412×915, body ≈ 470dp. No web.
IA + ENTRY: Place tab → your place file → the row "Put today on your home screen" opens this sheet. Second entry: Settings → Notifications, offered to a user who has just declined or revoked push permission.
THE ONE JOB: no public API can place a widget for the user, so convert them by showing their own real widget filled with their own real data, then teaching the three gestures that put it on their home screen.

CONTENT (render as of Monday 21 September 2026, for 1420 NE Garfield St, Camas WA 98607):
Title: "Add the widget".
Live preview — the user's OWN medium/4×2 widget rendered at true size from their real snapshot: "Recycling and garbage tomorrow" with a hollow provenance mark, "Bins out tonight.", label "Garfield St · Camas", the 14-day dot strip for Mon 21 Sep → Sun 4 Oct (dots on Tue 22 Sep pickup, Wed 23 Sep chimney sweep, Sat 26 Sep free radon kits, Tue 29 Sep pickup, Thu 1 Oct renters insurance, plus the Mon 28 Sep "Camas leaf pickup week" bar), and the AQI micro band-bar with the marker in EPA band 3 at 138.
iOS steps: 1 "Touch and hold an empty spot on your home screen." 2 "Tap the plus in the corner, then look for Pantopus." 3 "Pick a size and add it."
Android steps: 1 "Touch and hold an empty spot on your home screen." 2 "Tap Widgets, then scroll to Pantopus." 3 "Touch and hold the size you want and drag it into place."
Footer: a single "Done" action. Nothing else.

THE VISUALIZATION DECISION: the preview, not the instructions, is the top of the sheet. Render the widget at TRUE pixel size — 364×170pt on iOS, 330×150dp on Android — sitting on a small patch of neutral home-screen ground (surface.sunken, rounded to the platform's widget radius) so it reads as a thing already on a home screen rather than a card inside the app. Beneath it, three compact numbered steps laid out as a vertical list, each with a small line illustration of the GESTURE — a finger holding a blank home-screen grid, a plus in a corner, a tile being dragged — never a screenshot of a menu. The whole composition must fit the medium detent with no scrolling: preview roughly the top 45% of the sheet, steps the rest, Done pinned. The user sees their own recycling day before being asked to do anything.
DEGRADATION: when there is no snapshot yet, the same true-size preview slot carries the gallery's sample composition with a small caption "Sample"; when there is no place at all, that sample renders at reduced emphasis and the footer action changes rather than the layout.

STATES TO DRAW (each its own frame):
1. iOS default — live preview from the real snapshot, iOS step set, Done.
2. Android default — live preview, Android step set, Done.
3. No snapshot yet (iOS) — gallery sample in the preview slot, captioned "Sample", steps unchanged.
4. No place (iOS) — sample preview de-emphasised, footer action becomes "Save an address first".
5. No place (Android) — same, Material bottom-sheet treatment.
6. Dark mode — iOS default.
7. Dark mode — Android default.

WHY IT IS SHAPED THIS WAY: nothing in this sheet can place the widget, so the only lever is desire, and desire comes from seeing your own address's real pickup day at real size. Keep the steps to gestures rather than exact menu items, and never screenshot a specific OS version — menu labels drift between releases and a wrong label is worse than a vague one. Ranking this sheet above the briefing opt-in for a user who just declined push is deliberate: the widget is the only return trigger in the product that needs no permission at all.

DO NOT: do not add an "Add it for me", "Install widget" or "Take me there" button — no API can do it and a button that cannot work is the failure mode for this screen. Do not put the steps above the preview. Do not use OS screenshots or version-specific menu names. Do not let the sheet scroll or grow past the medium detent. Do not show a generic widget mock-up when the user's real snapshot exists.
