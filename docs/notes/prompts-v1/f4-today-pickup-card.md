# Tomorrow's pickup (push landing + confirm/correct)
id: f4-today-pickup-card · platforms: web/ios/android · isNew: True · frames: 13

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

CARD: Tomorrow's pickup — push landing plus confirm/correct. A NEW card inside the existing, already-designed Today screen: keep Today as it is and design this card, which sits directly above the 14-day strip.
PLATFORMS/VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.

WHERE IT LIVES: Today tab → Today → this card (four-tab IA: Place · Today · Nearby · Mail). Reached by: opening Today, always, whether notifications are on or off; tapping the night-before evening-briefing push; the Place file's pickup row; the 14-day strip's tonight cell. It must be fully usable by a user who never granted notifications — that is the reason it exists.

THE ONE JOB: state tomorrow's pickup, say how confident we are, and let one tap turn a guessed city schedule into this household's own confirmed day.

CONTENT (today = Monday 19 October 2026; 2418 NW Lacamas Dr, Camas, WA 98607). Kind glyph for garbage / recycling / both / bulk. Headline "Recycling and garbage tomorrow". Instruction line "Bins out tonight." Source with confidence: "City of Camas Public Works · Route B" and, once, the words "City schedule, not yet confirmed". Paired actions, equal weight: "That's my day" and "Not my schedule". Confirmed variant flips the source row to "You · Tuesday" (at a claimed home: "Sam · Tuesday, confirmed 3 Oct 2026") and the caveat disappears. No-rule variant demotes to a single line, "Set your pickup day". Bulk variant: "Bulk pickup tomorrow" / "Curbside by 6am." Draw the push itself as a tray card: title "Recycling and garbage tomorrow — not yet confirmed", body "Bins out tonight. 2418 NW Lacamas Dr."

THE VISUALIZATION DECISION: one emphasis card — kind glyph, one-line headline, one-line instruction, and confidence expressed as the same HOLLOW mark (on record, unconfirmed) / FILLED (official or confirmed) / FILLED-WITH-TICK (you entered it) used on every other Pantopus surface, with the explanatory words appearing exactly once beneath the mark rather than repeated per row — a caveat repeated per row becomes boilerplate precisely where honesty is being measured. The two actions are peers at identical weight: confirming and correcting are both good outcomes, and promoting "That's my day" to a filled primary button biases the honesty counter. In the push, the caveat rides the TITLE as a suffix, never the body tail, because a mark cannot travel in a notification tray and truncation eats tails.

STATES — 10 frames on iOS 393×852: confirmed rule (no caveat, shows who set it); unverified city rule (hollow mark + confirm/correct pair); T1 saved place (same card, footer "Only you will see this."); nothing tomorrow — draw the Today slice with the card simply absent; no pickup rule at all — demoted "Set your pickup day" line; confirming/saving; confirmed just now; error; stale/offline; suppressed low-signal day (card present in-app, no push). Plus 1 notification-tray frame, and 2 platform frames of the unverified state: web 390×844 and Android 412×915.

DO NOT make "That's my day" a filled primary with "Not my schedule" as a quiet text link. Do not repeat "not yet confirmed" on every line of the card. Do not dress this as a red or amber alert banner — it is an emphasis card about a routine chore. Do not design a variant that only exists behind a push.
