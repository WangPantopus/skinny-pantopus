# Rotating seasonal aha card
id: f8-seasonal-aha · platforms: web/ios/android · isNew: False · frames: 11

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: the rotating seasonal aha card — the single headline above the fold on the anonymous address preview.
PLATFORMS: web 390×844 mobile and 1440×900 desktop, iOS 393×852, Android 412×915. Light and dark.
THIS IS: an EXTENSION of the existing designed screen "Aha card (What stands out)" — this already exists and is already designed in the Pantopus design system. Open it, keep the frame exactly: overline "WHAT STANDS OUT" at the left of a header row, grade chip at the right, 42px rounded icon tile, headline, detail, source caption, and one sunken follow-up row with a chevron. Change only what is listed below.
WHERE IT LIVES: Place tab → address preview (web /start, native Place launch), first card under the hero. The same card's headline is also what the sender's column shows in the compare arrival header.
HOW THE USER GETS HERE: types an address and taps "See your place", or opens a friend's /start?vs= link.
THE ONE JOB: make the one headline on the anonymous preview be the fact that is actually urgent this month at this address.

CONTENT (exact strings; frames dated 8 October 2026, address in Camas, WA):
Seasonal deadline: headline "Voter registration for November 3 closes October 26 in Washington.", detail "Moved recently? Registration is per address.", source "Washington Secretary of State · election deadline", date chip "Oct 26 · 18 days", internal follow-up "Claim this address to know the morning that changes."
A second deadline frame at "Oct 26 · 9 days" in warning tokens.
January radon: grade chip "Zone 1", headline "Your county is EPA radon Zone 1 — the highest", source "County radon zone (EPA)", outbound row "Free test kits · Washington Dept of Health".
Ranked fallback: grade "High", headline "Wildfire hazard here is High", source "USFS Wildfire Hazard Potential".
Calm fallback: grade "Quiet", headline "Quiet on every layer", detail "Minimal flood risk, no active alerts, low earthquake demand. That's rarer than you'd think."
Seeded row source: "Clark County seed · on record, not yet confirmed".

THE VISUALIZATION DECISION: the header row gains a DATED CHIP beside the existing grade chip — a small calendar glyph plus "Oct 26 · 18 days", info tokens above 14 days, warning tokens at 14 or fewer. Never a ring, bar or countdown dial. Provenance rides as a mark, not a word: the filled / hollow / filled-with-tick shape from the shared encoding sits inline at the head of the source caption, and the caption is the tap target for the provenance sheet. The card now carries TWO follow-up affordances that must not be confusable: the existing sunken internal row with a chevron-right (scrolls to the wall) stays first, and a visibly secondary OUTBOUND row sits under it — border only, no fill, caption weight, external-link glyph, clearly leaving the product. "Claim this address" stays unambiguously primary; this is the only outbound link before the wall, at the moment of highest intent. Degradations: no program_url for the state → headline plus internal follow-up only, the outbound row is absent, not an empty slot; the deadline already passed → the seasonal card is suppressed entirely and the ranked aha renders instead. The headline must also truncate to 90 characters for the compare token and OG card while KEEPING its unverified mark and source — draw that truncated variant.

STATES TO DRAW (each its own frame), all at web 390×844: seasonal match (deadline), deadline ≤14 days, no match (existing ranked aha), calm fallback, seeded, unverified (hollow mark + source), no program_url, date already passed (draw what shows instead), and the 90-character token/OG truncation. Then the seasonal-match state once each at web 1440×900, iOS 393×852 and Android 412×915.

WHY IT IS SHAPED THIS WAY: the seeded civic and tax rows ship at confidence 'unverified', so a headline reading "Registration closes October 26" with no caveat is precisely the honesty failure the pilot scores at zero — the mark and the source must survive every size, including the 90-character token.

DO NOT: do not repurpose the single existing follow-up button for the outbound link — one button doing two different things depending on the month is worse than two buttons. Do not draw a countdown ring, a progress bar or a percentage. Do not ever render a deadline that has passed. Do not drop the provenance mark when space is tight.
