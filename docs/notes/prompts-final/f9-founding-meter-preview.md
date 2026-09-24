# Founding slots meter in the address preview (honest, fails closed)
id: f9-founding-meter-preview · platforms: web/ios/android · isNew: False · artboards: 21

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Founding slots meter on the preview density card, plus the sticky wall line · f9-founding-meter-preview

TYPE: EXTENSION of the existing designed "density card" in the signed-out address preview (web /start; the iOS and Android preview sections) and of the existing sticky wall bar on web /start. This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.

ATTACH: (1) The web /start preview with the density card, at 1440 and 390. (2) The iOS preview sections with the density card. (3) The Android preview sections with the density card. (4) The web sticky wall bar ("Keep this address handy." + Continue + the share/app-download footer) at 390. (5) The web compare arrival header (/start?vs=). (6) The existing preview loading skeleton. (7) The legacy free-tiles fallback. (8) The existing native preview CTA on iOS and Android.

PLATFORMS & VIEWPORTS: web 1440x900 and 390x844 · iOS 393x852 · Android 412x915. The wall line is web only: native compare links open web /start, and there is no native compare screen.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Before sign-in; add no tab or nav entry. On web the preview sits outside the four tabs. On iOS and Android the preview sits inside the Place tab launch for someone with no place; keep the tab bar exactly as the screenshot shows. The density card sits in the preview that appears after someone types an address at pantopus.com/start and taps "See your place". The same preview opens from a shared pantopus.com/start?address= link, a postcard link pantopus.com/start?r=, a tap on a share card, a friend's compare link pantopus.com/start?vs=, and the signed-out Place launch preview on iOS and Android. The previous step hands over only the typed address and, on a compare arrival, the sender's card: readings and a city, never an address. The next step is "Claim this address" on the card, or "Continue" on the wall.

WHO AND WHEN: A signed-out visitor with no account types PLACE B's address, 1107 NE Birchfield Ct, Camas, WA 98607 (the same address Jordan Lee saved; this visitor is someone else), on Mon 19 Oct 2026. Dana (Camas, WA) sent them her compare card, dated Sat 12 Sep. The typed address's block has its window on day 15 of 21: 2 slots taken, 3 open, closes Sun 25 Oct. A postcard code usually takes 5–7 days, so this person may not verify before the window closes; the copy must not imply otherwise.

THE ONE JOB: Show a Founding Neighbor slot only when the system has confirmed one is open, and show nothing when it can't confirm that.

FIRST FIVE SECONDS: First the density line "A few verified homes nearby", second the slot meter with "3 of 5 open", third the one primary action, "Claim this address".

CONTENT (deltas only)
- Density, text unchanged: "A few verified homes nearby", level 3 of 4, plus the card's existing source line.
- Slots: 2 taken, 3 open. 21-day window, 15 days elapsed. Closes Sun 25 Oct.
- Worst cases: "1 of 5 open"; closing today; 5 of 5 open in a brand-new window; the long address "12004 NE Pacific Crest Heights Loop, Unit 1402, Vancouver, WA 98684".

LAYOUT & VISUALIZATION
- The card keeps its density block on top, then a divider, then the slot block, then the CTA. Each block has its own label, so the two never merge.
- Density glyph: replace the four filled/hollow dots with four rising bars. Reached bars are solid in text.secondary ink. Unreached bars are a short baseline tick with no outline. The glyph can no longer be read as provenance or as slots; the qualitative words still carry the meaning. Never print a count.
- Slot meter: SlotMeter, preview card variant. One full-width track split into five capsule segments, about 10pt tall, radius sm, 2px surface gap. Taken = solid primary.600. Open = hatch at 45°, 1.5px strokes, 4px pitch, in text.secondary ink, clipped to the capsule, on surface.base. Every segment edge in text.secondary ink. Always exactly five segments, so the total is visible. The label "3 of 5 open" sits beside the track. Below the track, a 2px elapsed bar in neutral tokens (15 of 21 filled), with the neutral date pill "Closes Sun 25 Oct" at its right end, no warning tint. House-style exception: a Founding closing date never carries the relative count ("in 6 days"), because house AVOID forbids warning-tinted countdowns on perks. Apply this exception only to Founding dates.
- Data source: slot numbers and the date come only from the window's slots_open and ends_at, never from the density bucket or a count of verified homes.
- Degrade:
  - Zero slots, or the window has ended: density block only; no meter, no slot line, no divider.
  - Lookup failed: no density card at all; close the gap between the neighbouring cards.
  - Loading: the existing whole-preview skeleton, with no shape for the density card or meter. The whole payload arrives together, so nothing shifts.
  - Legacy fallback (no density object): no card, no meter.
- Wall line (web): on any wall where the typed address's block has confirmed open slots, the SlotMeter wall-line text replaces "Keep this address handy." and never stacks on it, whether or not the visitor came from a compare link. The benefit line "Today and a night-before pickup reminder run on it.", the Continue button and the footer row stay. The wall line is bodySmall 14/20 text.primary and may wrap to two lines at 390; the bar grows and reserves matching scroll padding; Continue stays 44px tall and moves to its own row if needed. The closing date lives on the card's pill, not in the wall.

INTERACTION, MOTION & HAPTICS: The whole card is not a target; only the CTA and "What's this?" are. "What's this?" expands in place in 200ms, instantly under Reduce Motion. The meter never animates, pulses or counts. The wall line changes without animation. No haptic.

FOUNDATIONS COMPONENTS USED: SlotMeter (preview card variant; wall line replacement variant) · WarmingSkeleton (existing preview skeleton; no meter shape) · InlineErrorRow (fail-closed variant: render nothing) · OfflineNotice (form offline variant, web and native) · LandingBannerSlot (unchanged above the compare arrival). ProvenanceMark is not drawn on this card; filled vs hollow appears nowhere on the card.

ACCESSIBILITY: Reading order: density words, slot label, date, caption, "What's this?", CTA. The meter is one element: "Founding Neighbor slots: 3 of 5 open, closes Sunday October 25." The density glyph is decorative; the words carry the meaning. The open and closing facts are printed as text beside the meter, so the meter needs no other alternative. Segment edges and hatch at least 3:1; text at least 4.5:1. Targets 44pt / 48dp / 44px. At iOS AX5 and Android 200%, the label and pill stack under the track and the CTA wraps. In greyscale, taken vs open reads by solid vs hatch. The wall line is announced politely when it replaces the default line.

COPY
Slot label: "3 of 5 Founding Neighbor slots open on this block" · meter numeral "3 of 5 open" · pill "Closes Sun 25 Oct" (last day: "Closes today").
Caption: "A badge for the first 5 homes here to verify. You can claim this address either way." + disclosure "What's this?" → "A slot goes to a home only once its address is verified before the window closes (Sun 25 Oct). A postcard code usually takes 5–7 days. It doesn't change any fees."
Web CTA, every state: "Claim this address".
iOS and Android CTA: keep the existing string from the attached screenshot; it must never mention a slot or being first.
Wall, slots open on the typed address's block: "3 Founding Neighbor slots are still open on this block." One slot left: "1 Founding Neighbor slot is still open on this block." Every other case: "Keep this address handy."
Offline (web and native): "You're offline. We can't look up an address right now."
Never: "You two are on the same block", any mention of the sender, percentages, "60% claimed", a live clock.

EDGE CASES: The long address wraps above the card and never truncates. "1 of 5 open": four solid segments, one hatched. A new window at 5 of 5 open is a real confirmed reading: all five hatched. Closing day: pill "Closes today", elapsed bar full, CTA still "Claim this address". Zero slots or closed window: ordinary wall. Compare arrival or not: same wall rule. Slow network: skeleton stays, no meter shape. Offline: OfflineNotice form offline variant and no card; "See your place" stays focusable, disabled, with that line as its reason. Lookup failed on iOS and Android: no card, gap closed, same as web. Signed-in viewers skip the wall (owned by the compare header).

INSTEAD OF
- Instead of filled vs hollow segments, draw solid vs hatched — because filled vs hollow means provenance everywhere in Pantopus.
- Instead of a grey, empty or skeleton meter on failure, draw no card — because an empty meter reads as "five open".
- Instead of "closes in 6 days" in warning amber, draw the neutral pill "Closes Sun 25 Oct" — because a badge must not borrow a deadline's urgency.
- Instead of reusing the density dots as slots, draw rising bars for density and capsules for slots — because two quantities need two shapes.
- Instead of "You two are on the same block" or a line shown only to a sender's neighbours, draw the typed block's slot count on any wall — because the sender shared readings and a city, not where they live.
- Instead of a percent bar, draw five segments with the numeral — because the total must stay visible.
- Instead of "Claim this address and be one of the first here", draw "Claim this address" — because a postcard can take longer than the days left.
- Instead of truncating the wall line to one row, let it wrap to two — because text never truncates.

DONE WHEN: A failed lookup shows no density card on web, iOS and Android. Zero open or a closed window shows no meter. The CTA never promises a slot or firstness. Density and slots can't be confused in greyscale (frame 18). The wall line replaces, never stacks, wraps rather than truncates, and never names or locates the sender. No warning tint, no clock, no relative count on the pill. The caption says claiming works either way, and the disclosure states the verify-before-close condition.

ARTBOARDS
1. f9-founding-meter-preview · web-1440 · 01-open · light: full preview for PLACE B with density bars, meter, date pill and "Claim this address".
2. f9-founding-meter-preview · web-390 · 02-open · light: the same at mobile width, "What's this?" expanded.
3. f9-founding-meter-preview · web-390 · 03-density-vs-slots-specimen · light: a specimen board outside the card: density bars and slot meter, labelled, hatch spec called out; in a separate strip labelled "Not on this card", the three provenance marks, showing the three shapes can't be confused.
4. f9-founding-meter-preview · web-390 · 04-no-slots-or-closed · light: density only, plain CTA.
5. f9-founding-meter-preview · web-390 · 05-lookup-failed · light: no density card; neighbouring cards close the gap.
6. f9-founding-meter-preview · web-390 · 06-wall-open-slots · light: compare arrival from Dana; the slot line replaces "Keep this address handy.", wrapped to two lines, Continue on its own row, scroll padding shown.
7. f9-founding-meter-preview · web-390 · 07-wall-no-open-slots · light: an address whose block has zero open slots, ordinary wall.
8. f9-founding-meter-preview · web-390 · 08-loading · light: existing skeleton, no meter shape.
9. f9-founding-meter-preview · web-390 · 09-legacy-fallback · light: free tiles, no card.
10. f9-founding-meter-preview · web-390 · 10-meter-extremes · light: three stacked cards: 1 of 5 open; 5 of 5 open (new window); closing today with a full elapsed bar and the plain CTA; the long address above the first.
11. f9-founding-meter-preview · web-390 · 11-offline · light: OfflineNotice form offline line under the field, button disabled with reason, no card.
12. f9-founding-meter-preview · ios · 12-open · light: iOS preview section inside the Place tab launch, tab bar visible, existing CTA.
13. f9-founding-meter-preview · android · 13-open · light: Android preview section, tab bar visible, existing CTA.
14. f9-founding-meter-preview · ios · 14-lookup-failed · light: no card, gap closed.
15. f9-founding-meter-preview · android · 15-offline · light: OfflineNotice form offline variant, no card.
16. f9-founding-meter-preview · ios · 16-ax5 · light: stacked label and pill, wrapped CTA.
17. f9-founding-meter-preview · android · 17-200pct · light: the same at 200%.
18. f9-founding-meter-preview · web-390 · 18-greyscale · light: frames 2 and 3 in greyscale, side by side.
19. f9-founding-meter-preview · web-1440 · 19-open · dark: dark twin of 1.
20. f9-founding-meter-preview · web-390 · 20-wall-open-slots · dark: dark twin of 6.
21. f9-founding-meter-preview · Notes: list every invented string (caption, the disclosure sentences including the fee sentence, singular wall line, "Closes today", the long address). Record the doc's wall string "You two are on the same block. {slots_open} Founding Neighbor slots still open, closes {date}." as replaced by the SlotMeter wall-line text: the first sentence reveals the sender's location, which they never agreed to share; the date moves to the card's pill (founder may append " · Closes Sun 25 Oct" since the bar may now take two lines). Record that the doc's rule (show the line only on same-block compare arrivals) was replaced by "any wall where the typed address's block has open slots", because the same-block-only rule itself hints that the sender lives nearby; the founder can restore it, but only after confirming what the same-block check reads, since the compare token has no location field. Record the Founding relative-count exception to house style. Record that the wall is bodySmall and may wrap to two lines at 390. Founder flags: (a) the web open-state CTA "Claim this address and be one of the first here" is parked as an option; if restored, show it only when 8 or more days remain and never on closing day; (b) confirm "It doesn't change any fees" is true in the pricing model, or drop the sentence; (c) the derive label "Be one of the first verified here" was dropped as a softer promise; (d) native CTAs keep their existing strings; (e) slot numbers must come only from slots_open and ends_at.

BATCH PLAN: Turn 1: artboards 1-6, then wait for continue. Turn 2: 7-12, then wait for continue. Turn 3: 13-18, then wait for continue. Turn 4: 19-21.
