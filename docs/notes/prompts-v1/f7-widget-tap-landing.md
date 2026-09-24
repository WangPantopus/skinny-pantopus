# Widget tap landing (attribution + forced refresh)
id: f7-widget-tap-landing · platforms: ios/android · isNew: False · frames: 12

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Widget tap landing — what Today does when it is opened from the home-screen widget.
THIS IS: an EXTENSION of the existing designed screen "Today (one composition)". This already exists and is already designed in the Pantopus design system — open it, keep everything (location row, pickup lead card, 14-day strip, weather, air band, alerts, signals, in that order), and change only what is listed below.
PLATFORMS + VIEWPORTS: iOS 393×852 and Android 412×915. No web — the widget is native only.
IA + ENTRY: Today tab. The user gets here by tapping any size of the "Today at your address" home-screen widget, which opens the deep link with ?src=widget.
THE ONE JOB: make the tap honest — open the exact surface the widget summarised, refresh it in place so the widget's snapshot is rewritten, and show the user that the refresh happened.

WHAT CHANGES (only these):
1. The Today header gains a freshness line under the address row: "Updated just now" on arrival, ageing to "Updated 12m ago", "Updated 2h ago".
2. A refresh-in-place treatment: a thin 2pt indeterminate progress line pinned directly under the header while the forced refresh runs. Content below it stays exactly as it was.
3. An inline failure treatment: a quiet "Couldn't refresh" line with a Retry affordance in the header area, last-known content still fully rendered beneath it.
4. Android only: the landing must be this Today composition, not the hub briefing screen.

CONTENT (render as of Monday 21 September 2026, 7:41 am, one second after the tap):
Header: "1420 NE Garfield St" · chip "Saved place · Only you" · "Updated just now".
Pickup lead card: bin glyph, "Recycling and garbage tomorrow", "Bins out tonight.", "City schedule, not yet confirmed" with a hollow provenance mark, and the two equal-weight peer actions "That's my day" and "Not my schedule".
14-day strip Mon 21 Sep → Sun 4 Oct with dots on Tue 22 Sep (hollow pickup), Wed 23 Sep "Chimney sweep, 9:00 am" (tick), Sat 26 Sep "Free radon kits — Clark County Public Health" (filled), Tue 29 Sep (hollow), Thu 1 Oct "Renters insurance renews" (tick), plus a full-height bar on Mon 28 Sep for "Camas leaf pickup week begins".
Air band: AQI 138, Unhealthy for Sensitive Groups, PM2.5, six EPA bands with the marker in band 3, "Observed 7:00 am · AirNow".

THE VISUALIZATION DECISION: refresh-in-place. The progress hairline is the ONLY thing that moves — cards do not dim, do not collapse to skeletons, do not reflow. The freshness line is where the state is expressed, changing word by word: "Updating…" → "Updated just now". Blanking a screen that someone tapped a widget to reach is the one thing this landing must never do. A cold start is the single exception: with no prior content on screen there is nothing to protect, so the full skeleton is allowed there and only there.

STATES TO DRAW (each its own frame, on iOS and on Android — 12 frames):
1. Loaded, arrived from the widget, "Updated just now".
2. Refreshing in place — progress hairline live, all content unchanged beneath it.
3. Refresh failed — "Couldn't refresh" inline, last content intact, freshness line still reading "Updated 2h ago".
4. Cold start — full skeleton, header address already resolved.
5. No place — Today hands straight off to the "Add a place" sheet over this screen.
6. Offline — cached content, freshness line "Updated 2h ago", the pickup card's two actions disabled.

WHY IT IS SHAPED THIS WAY: two real defects make this landing load-bearing rather than cosmetic. Android currently routes "today" to a different payload than the widget showed, and for a saved-place user that screen has no empty state at all. And both Today view models are idempotent once loaded, so "Open to refresh" can open an already-warm app, write no snapshot, and leave the widget permanently grey. The freshness line is the user-visible proof that the forced refresh actually ran.

DO NOT: do not skeleton, dim, spin or blank a warm screen on the widget path. Do not confirm the refresh with a toast that disappears — the proof has to persist in the header. Do not add a manual "Refresh" button, a pull-to-refresh spinner overlay, or a "came from widget" badge. Do not change the section order, the card styling or the address row you inherited.
