# Compare with a friend (mint + consent)
id: f8-compare-sheet · platforms: web · isNew: True · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Compare with a friend (mint + consent)
THIS IS: a NEW sheet. It opens over the existing, already-designed /start funnel preview step — keep that screen exactly as it is except for one addition: a tertiary text-button row under the aha card reading "Share this address" and "Compare with a friend".
PLATFORM / VIEWPORTS: web only. 390×844 mobile web as a bottom sheet (the primary case) and 1440×900 desktop as a centred 480-wide modal.
WHERE IT LIVES: not inside the four-tab app. /start is the signed-out door that precedes Place · Today · Nearby · Mail, and this sheet sits on its preview step. Reached by: the "Compare with a friend" text button under the aha card in the T0 preview; "Send yours back" on the compare reveal. It is deliberately NOT in the WallBar footer, which already carries share plus app-download.
THE ONE JOB: Mint and send a compare link in one tap, showing — before the link exists — exactly what the card will and will not reveal.

CONTENT, verbatim:
- Sheet title "Compare with a friend".
- Live card preview, showing what will unfurl: city line "Camas, WA"; the four scale strips (Flood "Zone X — minimal risk"; Wildfire "Moderate — 3 of 5"; Air today "AQI 42 — Good"; Radon "Zone 1 — highest predicted", hollow mark); headline "Voter registration for November 3 closes October 26 in Washington."; footer "Nextdoor is what your neighbors say. Pantopus is what's on record about your address."
- Privacy line directly beneath the preview: "This card shows readings and your city, never your address."
- Toggle, OFF by default: "Show my first name on the card", with a first-name field that appears only when it is on (value "Dana").
- Action last: "Copy link" on desktop, "Share" on mobile.
- Minted URL shown truncated: pantopus.com/start?vs=eyJ2IjoxLCJjIjoiQ2FtYXM…

THE VISUALIZATION DECISION: the card preview IS the top of the sheet, rendered at true share-card proportions (1.91:1, i.e. 1200×630 scaled), not a thumbnail and not an icon — the user sees the artifact their friend will see in a messenger thread. The privacy sentence sits immediately under it, and the button is last, so consent is read before the link exists rather than after. On mobile the preview, the privacy line, the toggle and the button must all fit above the fold at 390×844 without scrolling. Keep the first-name toggle between the privacy line and the button, because turning it on is the one thing that changes what the card reveals.

STATES TO DRAW (one frame each, light and dark):
1. Idle — toggle off, anonymous card.
2. Name field shown — toggle on, "Dana" in the field, the preview updating live to "Dana · Camas, WA".
3. Minting — button disabled with an inline spinner, preview unchanged.
4. Mint error — inline message, button returns to ready, preview kept.
5. Rate limited — its own copy, "You've made several links today. Try again in about an hour.", visibly not a generic error.
6. Copied — the 18-second confirmation replacing the button label, URL row visible.
7. Share sheet opened — the OS share sheet over the dimmed sheet (mobile).
8. Share cancelled — the sheet returns to idle with the link still available; this must not read as a failure.
9. Reciprocal variant, arrived from the reveal — title "Send yours back", button "Send my card", everything else identical.
10. Desktop 1440×900 centred modal, idle.

WHY IT IS SHAPED THIS WAY: the source doc puts the privacy sentence in its own section further down. If consent lands after the link is minted, the consent is retroactive — the link already exists.

DO NOT: do not place the privacy line below or after the button. Do not default the first-name toggle to on. Do not show the street address, a map pin, coordinates or a house image anywhere in the preview. Do not style "share cancelled" as an error. Do not add this as a third link in the WallBar footer, which becomes a 3-up row on a phone.
