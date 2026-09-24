# Today at your address (home-screen widget, three sizes)
id: f7-today-widget · platforms: ios/android · isNew: True · frames: 19

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: "Today at your address" — home-screen widget, three sizes.
PLATFORMS + VIEWPORTS: iOS widget family drawn on a 393×852 home screen — systemSmall 170×170pt, systemMedium 364×170pt, systemLarge 364×382pt. Android app widget on 412×915 — 2×2 ≈ 150×150dp, 4×2 ≈ 330×150dp, 4×4 ≈ 330×330dp. No web.
THIS IS: a NEW surface.
IA + ENTRY: it sits outside the four tabs, on the OS home screen. People arrive from the OS widget gallery, from Place → your place file → the row "Put today on your home screen", or from the how-to sheet. A tap deep-links to the Today tab.
THE ONE JOB: give the address a reason to live on the home screen — what's due, what the air is, what's next — with no push and no permission.

CONTENT (render as of Monday 21 September 2026, 7:40 am; short label "Garfield St · Camas" for 1420 NE Garfield St, Camas WA 98607):
- Promoted fact: "Recycling and garbage tomorrow" / "Bins out tonight." — a Camas city schedule, not yet confirmed by the household.
- Air: AQI 138, Unhealthy for Sensitive Groups, PM2.5.
- Next date: "Renters insurance renews · Thu 1 Oct".
- 14 days, Mon 21 Sep → Sun 4 Oct: Tue 22 Sep pickup (unconfirmed); Wed 23 Sep "Chimney sweep, 9:00 am" (you entered it); Sat 26 Sep "Free radon kits — Clark County Public Health" (official); Mon 28 Sep "Camas leaf pickup week begins" (city-wide, not about this house); Tue 29 Sep pickup (unconfirmed); Thu 1 Oct renters insurance (you entered it).
- Year, Sep 2026 → Aug 2027: You — renters insurance 1 Oct, furnace service 4 Dec, lease ends 31 May 2027. Camas — leaf pickup 2–13 Nov, water rate change 1 Jan. Clark County — property tax 2nd half 30 Oct, 1st half 30 Apr. Washington — voter registration deadline 26 Oct, general election 3 Nov, tax appeal window opens 1 Jul.

THE VISUALIZATION DECISION — each size earns its area with a different FORM, never more strings.
One urgency ladder picks the hero on every size: pickup within 1 day > AQI ≥ 101 > nearest date > any pickup > any AQI.
SMALL: exactly one promoted fact — kind glyph, the line, its provenance mark, the place label. Nothing else.
MEDIUM: hero line at top, then the 14-day dot strip (14 equal cells, ~6pt each, ~120pt wide, today leftmost, weekday initial under each cell, weekend cells tinted so the Tuesday pickup cadence reads as rhythm), then AQI as a micro band-bar — the six EPA bands as segments with a marker sitting inside band 3 — never the string "AQI 138 Unhealthy for Sensitive Groups" alone.
LARGE: the 12-month year strip on top — months as columns, four horizontal lanes labelled You / Camas / Clark County / Washington, one marker per rule at its month, today as a vertical rule — above today's three lines. This is the only place the annual promise is visible without opening the app.
Provenance is a shape, everywhere, at every size: FILLED = official or confirmed, HOLLOW = on record but unconfirmed, FILLED-WITH-TICK = you entered it. The pickup marks are hollow here.
DEGRADATION: stale greys the marks but keeps the strip and lane geometry intact, so "nothing due" (cells drawn, no dots) and "stale" (cells drawn, greyed dots) are two different pictures, not the same blank.
Relative day words are computed at render — write "Tomorrow", "Tue", "Thu 1 Oct", never a frozen "in 3 days".

STATES TO DRAW (each its own frame):
1–3. Fresh, iOS small / medium / large. 4–6. Fresh, Android 2×2 / 4×2 / 4×4. 7. Partial — air nil (medium: hero + strip, band-bar row absent, layout rebalanced, not a hole). 8. Partial — pickup nil (medium: AQI promoted to hero, strip carries the rest). 9. Pickup not set — a demoted single line "Set your pickup day", never the hero. 10. Unverified pickup (small, hollow mark). 11. Stale >6h — medium, marks greyed, geometry kept, "Open to refresh". 12. Stale >6h — large. 13. No snapshot ever written. 14–15. No place — "Save an address to see today here" (small and medium). 16–17. Dark mode (medium and large). 18–19. iOS tinted/accented rendering (small and medium) — the filled/hollow/tick marks must still be distinguishable after desaturation.

WHY IT IS SHAPED THIS WAY: three equal text lines would give a lease notice twelve days out the same weight as tomorrow's recycling, and then no size earns its area. The extension renders a stored snapshot and can never call the API, so staleness is a real, frequent state. The place label is the only tell of which address this widget is about — it must never be the line that truncates.

DO NOT: do not draw a percentage, a progress bar, a completion ring or a letter grade. Do not solve medium or large by stacking more text lines. Do not blank a section when a fact is missing — redistribute. Do not let the place label ellipsise while a body line survives. Do not put a chore (pickup) in the hero slot when nothing is actually due.
