# Share + compare actions on the native T0 preview
id: f8-native-share-compare · platforms: ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Share + compare actions on the anonymous address preview.
PLATFORMS: iOS 393×852 and Android 412×915. Light and dark for both.
THIS IS: an EXTENSION of the existing designed screen "Place launch / T0 address preview" (iOS PlacePreviewBody, Android PlaceLaunchScreen) — this already exists and is already designed in the Pantopus design system. Open it, keep everything — the hero, the aha card, the Band-A section groups, the sticky wall — and add only the action row described below. On iOS both controls are net-new; on Android there is already a single "Share this address" link to extend into a pair.
WHERE IT LIVES: Place tab → launch screen → typed-address preview. On both natives this screen IS the Place tab's root for anyone with no saved place.
HOW THE USER GETS HERE: types an address into the Place launch field and taps "See your place"; the action row sits directly under the aha card, roughly one screen down.
THE ONE JOB: let someone hand this reading to a friend in one tap, without building a native compare screen.

CONTENT (exact strings, realistic density):
Address in the header: "3218 NW Sierra St, Camas, WA 98607". Aha card above the new row, unchanged: overline "WHAT STANDS OUT", grade chip "Zone 1", headline "Your county is EPA radon Zone 1 — the highest", detail "One in four homes tested in Clark County came back above the action level.", source caption "County radon zone (EPA)", follow-up row "Claim this address to know the morning that changes."
The new row, immediately beneath the aha card: two tertiary TEXT buttons side by side — "Share this address" and "Compare with a friend". One caption line under them, at caption weight: "The card shows your city and your readings — never your address, and no name."
Sticky wall at the bottom, untouched: "Keep this address handy." with "Continue" as the single filled primary.
Error copy: "Couldn't make that link. Try again." Offline copy on the compare button: "Compare needs a connection." Android empty chooser: "No apps to share with."

THE VISUALIZATION DECISION: a row of two text buttons — no fills, no borders, no icons competing with the aha card's chevron — separated by a thin vertical rule or by spacing alone, sitting on the page surface rather than in a card of their own. They must NOT live inside the sticky wall: the wall's "Continue" is the single primary at the exact moment the funnel wants a sign-up, and a third filled control there becomes a 3-up row on a phone. Weight order top to bottom is aha card → tertiary text row → sections → sticky primary, so the spread action is available but never outranks the conversion. Compare mints a token and hands the web URL /start?vs=<token> to the system share sheet; since v1 has no first-name field, the card is anonymous — the caption says so in words rather than letting the button imply a personalised card.

STATES TO DRAW (each its own frame):
iOS — 1. idle. 2. minting (compare button disabled with an inline spinner, share still live). 3. SystemShareSheet presented over the preview carrying the pantopus.com/start?vs= link. 4. mint error (inline message, buttons re-enabled). 5. offline (compare disabled and explained, share still enabled).
Android — 6. idle. 7. minting. 8. Material 3 bottom-sheet chooser presented. 9. no share targets. 10. offline.

DO NOT: do not turn these into filled or outlined buttons, do not move them into the sticky wall, and do not write copy that implies the recipient will see the sender's name — there is no name on the card in v1.
