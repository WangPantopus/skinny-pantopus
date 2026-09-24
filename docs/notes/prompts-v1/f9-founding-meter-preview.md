# Founding slots meter — honest, fails closed
id: f9-founding-meter-preview · platforms: web/ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: The block_density card in the anonymous T0 address preview, and the sticky wall bar
PLATFORMS / VIEWPORTS: web 1440×900 and 390×844 · iOS 393×852 · Android 412×915
THIS IS: an EXTENSION of the existing designed Pantopus density card in the T0 preview (web DensityCard, iOS and Android PreviewSections) and of the existing sticky wall bar. These already exist and are already designed in the Pantopus design system — open them, keep everything, and change only what is listed below.

WHERE IT LIVES: this is PRE-AUTH, ahead of the four tabs — the anonymous address preview reached by typing an address in the /start funnel, and the same preview reached from a friend's compare link /start?vs=<token>, where the sticky wall bar sits at the bottom of the scroll. Do not add a tab or a nav entry for it.

THE ONE JOB: never promise a Founding Neighbor slot the system cannot honour — including when the founding-window lookup fails, which today defaults to "open".

CONTENT (exact strings, this density):
- Address: 2914 NW Lacamas Dr, Camas, WA 98607
- Existing density content, unchanged: four qualitative dots, 3 of 4 filled, "A few verified homes nearby"
- NEW slot line, open: "3 of 5 Founding Neighbor slots open on this block" · "This window closes Nov 27, 2026" (day 15 of 21)
- No slots / window ended: no meter, no line, silently — the card renders density only
- Lookup failed: render NO density card at all
- CTA follows founding_open: open → "Claim this address and be one of the first here"; not open → "Claim this address"
- Sticky wall bar, same geohash-6 as the sender AND slots remain: the line REPLACES (does not stack on) "Keep this address handy." with "3 Founding Neighbor slots are still open on this block."

THE VISUALIZATION DECISION: a 5-SEGMENT slot meter — filled = taken, hollow = open, ALWAYS exactly five segments so the denominator is visible without reading the label. Draw it as one bounded horizontal track split by hairline dividers into five capsule segments, full card width, ~10px tall, radius sm — deliberately a DIFFERENT shape from the density card's four round qualitative dots, or readers will read density dots as slots. Keep both on the card, separated by a divider and their own labels, so the difference is visible in one glance. Under the meter, a thin 2px 21-day bar filled left to right for elapsed days (15 of 21), with the closing date as a caption at its right end — a date, not a live countdown number that implies precision we do not have. Degrade, and this is the point of the whole entry: an EMPTY meter would read as "five open", which is exactly the false promise the fails-open fix exists to kill — so a failed lookup renders nothing at all. No skeleton, no grey meter, no em-dash, no "checking…" — the card is absent and the cards above and below close the gap.

STATES TO DRAW (one frame each, 10 total):
1. Web desktop T0 preview — founding open: density dots + slot meter + 21-day bar + CTA
2. Web mobile T0 preview — founding open
3. Zero slots or window ended — web mobile, density only, silently
4. Lookup failed — web mobile, NO density card at all, neighbouring cards closed up
5. Preview loading — web mobile
6. Legacy free-tiles fallback — web mobile, old payload with no block_density object and no meter anywhere
7. iOS preview section — founding open
8. Android preview section — founding open
9. Sticky wall bar on a compare arrival, same block — the slot line replacing "Keep this address handy."
10. Sticky wall bar, different block — the ordinary "Keep this address handy."

UX REASONING TO KEEP: the same-block sentence is about the BLOCK's remaining slots, never about the sender. The compare card's whole promise is "readings and a city, never your address" — "you two are on the same block" tells the recipient something the sender never agreed to share.

DO NOT: never render an empty or all-hollow five-segment meter; never draw a skeleton or grey meter that could survive a failed lookup; do not reuse or extend the four round density dots as slots, and do not add a fifth dot; do not name or hint at the sender in the wall line; do not let the CTA say "be one of the first here" when the label just said there are no slots; no percentages, no "60% claimed", no progress bar for slots.
