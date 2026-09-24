# Compare arrival header on /start
id: f8-compare-arrival-header · platforms: web · isNew: False · frames: 8

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Compare arrival header on /start
THIS IS: an EXTENSION of the existing designed screen "/start funnel — hero step". That screen already exists and is already designed in the Pantopus design system — open it, keep everything (H1, lede, address field, privacy proof line, sticky WallBar), and change only what is listed below. The nearest precedent in the system is the existing "from the card in your mailbox" pill; match that slot's shape.
PLATFORM / VIEWPORTS: web only. 390×844 mobile web is the primary case — nearly every compare link is opened on a phone. Also draw 1440×900.
WHERE IT LIVES: not inside the four-tab app; /start is the signed-out door in front of Place · Today · Nearby · Mail. Reached one way only: tapping a friend's pantopus.com/start?vs=<token> link from iMessage, WhatsApp, or an email unfurl.
THE ONE JOB: Show a stranger what their friend's place reads, and put their own address field in the still-empty second column so the only obvious next move is to type.

CONTENT, verbatim:
- Left / sender, decoded from the token: "Dana · Camas, WA"; the four scale strips — Flood "Zone X — minimal risk" (FEMA flood zone), Wildfire "Moderate — 3 of 5" (USFS, quarter-mile), Air today "AQI 42 — Good" (AirNow), Radon "Zone 1 — highest predicted" (County radon zone, EPA, hollow mark); aha headline "Voter registration for November 3 closes October 26 in Washington."; freshness caption "Dana's card, as of Sep 12, 2026".
- Right / "Your place": empty, holding the address field (placeholder "Enter your address"), button "See your place", and the privacy proof line "We don't post this anywhere. Nobody sees what you look up."
- Contrast line "Nextdoor is what your neighbors say. Pantopus is what's on record about your address." moves BELOW the address field on this arrival, so the sender card and the input keep the first viewport.

THE VISUALIZATION DECISION: above 640px, two columns of equal width — the sender's four strips on the left, an empty framed column on the right whose only content is the field and the button, so the emptiness reads as an invitation. Below 640px the sender column does NOT stack as a full card: it collapses to a ONE-LINE strip — first name · city · four tiny markers in layer order, with a chevron to expand — sitting directly above a still-autofocused address field. The doc's "compare header above the hero" would push the field below the fold on a phone, which is the exact opposite of the spread goal, so the collapsed strip is load-bearing, not a nicety. Marks keep the product encoding: FILLED = official/confirmed, HOLLOW = on record but unconfirmed.

STATES TO DRAW (one frame each, light and dark):
1. Verifying token — sender skeleton in the left column, address field already live and focused; never block typing on a token fetch.
2. Valid, sender named — "Dana · Camas, WA".
3. Valid, anonymous — sender line reads "A place in Camas, WA", no name slot left empty.
4. Expired or tampered — quiet banner "That comparison link has expired. Type an address to see your own place." above the ordinary hero, sender column gone entirely.
5. Token verify offline — either decodable chips rendered from the token itself, or the same expired banner; never a spinner that never resolves.
6. Signed-in viewer — the page header swaps "Sign in" for "Save this address"; everything else identical.
7. Below 640px — collapsed one-line sender strip above the autofocused field.
8. Below 640px, expanded — the strip opened to the four full rows, field still on screen.

WHY: a signed-in pilot user opening a friend's link is the most likely recipient in a 30-mover pilot, and today this header tells them to sign in to an account they are already in.

DO NOT: do not render the "from the card in your mailbox" pill and this header at the same time — one slot, defined precedence. Do not push the address field below the fold at 390×844. Do not show the sender's street address, a map, or a house photo — city and readings only. Do not draw the expired state as an error page or a modal. Do not put letter grades or a score on the sender's card.
