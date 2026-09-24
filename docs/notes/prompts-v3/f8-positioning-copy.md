# Positioning line and contrast line in the hero
id: f8-positioning-copy · platforms: web/ios/android · isNew: False · artboards: 19

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Positioning line and contrast line · f8-positioning-copy

TYPE: EXTENSION of the existing designed screens "/start funnel hero", "Marketing homepage hero", "Place launch (iOS)" and "Place launch (Android)", plus the link unfurl of the "Place OG share card". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.

ATTACH: (1) The web /start hero at 1440 and 390. (2) The /start?vs= compare arrival header at 390. (3) The marketing homepage hero at 1440. (4) The iOS Place launch. (5) The Android Place launch. (6) The compare share card design (with its footer) and how it unfurls in a chat. (7) The web expired-compare-link banner.

PLATFORMS & VIEWPORTS: web 1440x900 and 390x844, plus a 320x568 check · iOS 393x852 · Android 412x915 · a 360px-wide chat unfurl.

WHERE IT LIVES & HOW PEOPLE ARRIVE: web /start is signed-out and has no tab bar. On native, the Place launch is the Place tab's root for someone with no place; keep the tab bar exactly as the screenshot shows. The marketing homepage (pantopus.com) sits outside the app shell. People arrive from a search result, a friend's compare link pantopus.com/start?vs=, a mailed postcard link, or cold. This is step 1 of the stranger journey. Nothing before the address field asks for an account, a location or notifications, and the field is the first interactive element. Next, the person types an address and taps "See your place", which opens the preview.

WHO AND WHEN: A signed-out stranger with no account, on Mon 19 Oct 2026 at lunch, opens Dana's compare link from a chat, has never heard of Pantopus, and is about to type PLACE B's address, 1107 NE Birchfield Ct, Camas (the address Jordan Lee saved; this viewer is someone else).

THE ONE JOB: In two lines, say what Pantopus is and what it is not, so a stranger knows this isn't another neighborhood app.

FIRST FIVE SECONDS: First the H1, second the lede, third the address field. The single primary action is the existing "See your place". The contrast line reads as a caption on the lede.

CONTENT: The H1 is one shared string everywhere. The contrast line is one shared string everywhere, on all three platforms and in the share card footer. The web, native and marketing ledes are separate strings under COPY. The marketing eyebrow, the address field, "See your place" and the privacy proof line stay unchanged. The compare arrival keeps its H1, lede and Dana's collapsed sender strip from the attached header, unchanged.

LAYOUT & VISUALIZATION
- Three type ranks stacked directly: 12pt between the H1 and the lede, 4pt between the lede and the contrast line, so the contrast line groups with the lede as its caption.
  - H1 on /start and native Place launch: h1 30/36/700, text.primary, at every width. The system has no larger display size; do not invent one. On the marketing homepage, the same string keeps the homepage's existing serif display size.
  - Lede: body 16/24/400, text.secondary, max 46ch.
  - Contrast line: label size 13/18. Clause one, "Nextdoor is what your neighbors say.", weight 400 in text.secondary. Clause two, "Pantopus is what's on record about your address.", weight 600 in text.strong. The contrast comes from weight; both clauses pass 4.5:1. In dark mode, clause one uses dark text.secondary and clause two dark text.primary, on web and native.
- Then, unchanged: the field, "See your place" and the privacy line, with 16pt above the field.
- At 640px and wider, the contrast line fits on one line. At 390 it may wrap to two lines; at 320, up to three. At every width the field stays fully inside the first viewport.
- Compare arrival: H1 and lede stay as in the attached header, then Dana's collapsed sender strip, field, button, privacy line; the contrast line moves below the privacy line, so the sender strip and the input keep the first viewport.
- Marketing homepage: keep its serif display type and paper background (the house-style exception). Set the contrast line in the homepage's existing caption sans, with the same two weights, at 4.5:1 or better on paper.
- Share card image: the contrast line stays in the card image's full-width footer, as the design doc specifies; the share card prompt draws that image. This prompt only confirms the two-weight treatment there and shows the unfurl in context. Check that the footer is still readable at 360px bubble width; if it isn't, flag it on Notes rather than removing it.
- Share unfurl text: title, then a description that leads with the contrast line (see COPY). Most chat clients show two description lines; draw it truncated at two lines, as the client does. og:image:alt describes the four readings and the city, never an address (owned by the share card prompt; note it beside the unfurl, not in the bubble).

INTERACTION, MOTION & HAPTICS: The lines are static text. They render with the page, with no skeleton or fade-in. On web, the field autofocuses only at 640px and wider; at 390 there is no autofocus, so the keyboard never covers the hero and screen readers start at the H1. On native, focus moves to the field only after a tap, and the keyboard never opens automatically. No haptics.

FOUNDATIONS COMPONENTS USED: LandingBannerSlot (expired compare link variant, above the hero on web; the contrast line returns under the lede in that state) · OfflineNotice (form offline variant, web and native, below the field). The address field, primary button and privacy line are the host's own.

ACCESSIBILITY: Reading order: H1 (heading level 1), lede, contrast line (one paragraph; the weight change is not announced), field, button, privacy line. On the compare arrival: H1, lede, Dana's collapsed sender strip, field, button, privacy line, contrast line (as in the attached compare header). Text is never truncated in the hero. At iOS AX5 and Android 200%, all three lines wrap, the page scrolls, and the field comes directly after the contrast line with nothing in between. Mobile text is never below 13px. In greyscale, the clause difference still reads through weight. Disabled "See your place" when offline stays focusable with the offline line as its reason.

COPY (verbatim, sentence case)
H1: "See what's true about your address."
Web /start lede: "Flood zone and wildfire hazard, today's air, radon, water, who represents you, and the neighbors who've proven they're real. Free, no account."
Native lede: "Your flood zone, wildfire hazard, today's air and county assessed value, plus verified homes nearby — free, no account."
Native lede fallback, used everywhere on native if the preview can't show county assessed value for every address: "Your flood zone, wildfire hazard and today's air, plus verified homes nearby — free, no account."
Marketing eyebrow: "Your address, answered · Early access"
Marketing lede: "Public records, local risks, today's air, and the neighbors who've proven they're real — free, no account. Then claim it: every address has exactly one page."
Contrast line (hero and share card footer): "Nextdoor is what your neighbors say. Pantopus is what's on record about your address."
Compare unfurl title, name shown: "What's true about Dana's place. Yours?" · name off (the default): "What's true about a place in Camas, WA. Yours?"
Compare unfurl description: "Nextdoor is what your neighbors say. Pantopus is what's on record about your address. Sources: FEMA, USFS, AirNow, EPA."
Plain /start unfurl description (no compare): "Nextdoor is what your neighbors say. Pantopus is what's on record about your address. Flood zone, wildfire hazard, today's air and radon. Free, no account."
Offline (web and native): "You're offline. We can't look up an address right now."
Write "Nextdoor" as plain text only: no logo, colour, link or emphasis, and no claim about Nextdoor.

EDGE CASES: At 320px the lede runs to five lines and the contrast line wraps to up to three, with the field still visible. At 1440 the contrast line is one line. Compare link expired: the LandingBannerSlot banner shows, then the ordinary hero with the contrast line under the lede. Slow network: all text present at first paint; only autocomplete waits. Offline on web and native: hero unchanged; the OfflineNotice form offline line sits below the field and "See your place" stays focusable, disabled, with that line as its reason. Native assessed value: the lede is static text shown before any address, so it can't depend on a reading; if the native preview doesn't show county assessed value on every address, use the fallback lede everywhere on native (founder flag). Signed-in viewers: hero unchanged.

INSTEAD OF
- Instead of text.muted for clause one, draw text.secondary — because text.muted fails contrast at caption size.
- Instead of 31/37 or 42/48 H1 sizes, draw h1 30/36 — because the system has no display size.
- Instead of a second lede-sized paragraph, a pill or a quote block, draw one caption line tucked 4pt under the lede — because three prose blocks push the field below the fold.
- Instead of an us-vs-them table or a coloured "Nextdoor", draw one plain sentence — because a comparison must stay a truthful description.
- Instead of "your home's value", draw "county assessed value" — because modelled values are often wrong and we show only sourced records.
- Instead of "Wildfire and flood risk", draw "Flood zone and wildfire hazard" — because those are the authorities' terms.
- Instead of an unfurl description that leads with "who's verified nearby", draw one that leads with the contrast line and then public records — because the unfurl text, not the image, is what people read at bubble size.
- Instead of dropping the H1 and lede on the compare arrival, keep them above the sender strip — because the stranger still needs to learn what Pantopus is and the page needs its level-1 heading.

DONE WHEN: At 390 and 320, the field is fully visible without scrolling. The contrast line reads as a caption, not a paragraph. Both clauses pass 4.5:1 in light and dark on web and native. The H1 and the contrast line are identical on every platform and in the share card footer. On the compare arrival the H1 and lede are still present, the field stays in the first viewport at 390, the contrast line sits below the field and the privacy line is visible. The unfurl title matches the doc string, with a no-name fallback, and both descriptions lead with the contrast line. Nothing above the field asks for anything, and nothing autofocuses at 390.

ARTBOARDS
1. f8-positioning-copy · web-1440 · 01-start-hero · light: H1, lede, one-line contrast line, focused field, button, privacy line.
2. f8-positioning-copy · web-390 · 02-start-hero · light: the same at mobile width, contrast line wrapped, field not focused.
3. f8-positioning-copy · web-390 · 03-narrow-320 · light: frame is 320x568, not 390 (label it so); contrast line up to three lines, field still in view.
4. f8-positioning-copy · web-390 · 04-compare-arrival · light: H1, lede, Dana's collapsed sender strip, field, button, privacy line, then the contrast line.
5. f8-positioning-copy · web-1440 · 05-marketing-hero · light: homepage hero with the contrast line under its lede.
6. f8-positioning-copy · ios · 06-place-launch · light: native lede and contrast line, tab bar visible.
7. f8-positioning-copy · android · 07-place-launch · light: the same on Android.
8. f8-positioning-copy · web-390 · 08-link-unfurl · light: frame is a 360px chat bubble inside a 390 canvas (label it so); two stacked unfurls, name shown and name off, each with image (footer contrast line), title, and a two-line truncated description; og:image:alt noted beside each.
9. f8-positioning-copy · web-390 · 09-slow-network · light: full text at first paint, autocomplete pending.
10. f8-positioning-copy · web-390 · 10-expired-link-banner · light: LandingBannerSlot expired compare banner, then the ordinary hero with the contrast line under the lede.
11. f8-positioning-copy · web-390 · 11-offline · light: hero unchanged, OfflineNotice form offline line under the field, button disabled with reason.
12. f8-positioning-copy · android · 12-offline · light: the same on Android.
13. f8-positioning-copy · ios · 13-ax5 · light: wrapped lines, field right after the contrast line.
14. f8-positioning-copy · android · 14-200pct · light: the same at 200%.
15. f8-positioning-copy · web-390 · 15-greyscale · light: frame 2 in greyscale.
16. f8-positioning-copy · web-1440 · 16-start-hero · dark: dark twin of 1.
17. f8-positioning-copy · web-390 · 17-compare-arrival · dark: dark twin of 4.
18. f8-positioning-copy · ios · 18-place-launch · dark: dark twin of 6, checking clause contrast on native.
19. f8-positioning-copy · Notes: list every invented string (the no-name unfurl title, both unfurl descriptions, the native fallback lede, the web offline use of the form offline line). Replaced strings with reasons: old web and native ledes ("your home's value" is modelled, neighbors led the first clause); 31/37 and 42/48 sizes (no display size); text.muted (fails 4.5:1); the v1 unfurl title "What's on record at Dana's place. Yours?" (reverted to the doc string); the v1 move of the contrast line out of the OG image (reverted to match the doc and the share card prompt); the flows spec's no-name title "A place in Vancouver, WA · Yours?" (replaced by the doc pattern "What's true about a place in <city>. Yours?"); the plain /start description "Public records, local risks, and who's verified nearby — free, no account." and the sources-only compare description (both now lead with the contrast line, since text belongs in the unfurl text rather than the image). Naming exceptions: frame 3 is 320 wide and frame 8 is a 360 bubble, both under the web-390 name with the true width in the visible label. Founder flags: the flows spec's compare journey must adopt the doc title and this no-name fallback, and the share card prompt owns the unfurl strings and og:image:alt, so these must be kept in sync there; the assessed-value clause needs the native preview to show county assessed value on every address, otherwise ship the fallback lede; the optional privacy line "No location tracking — just the address you type."; research warns text inside preview images becomes unreadable at bubble size, so if the footer fails at 360px, decide between enlarging it and relying on the description alone; the single shared-string module is new build work on every platform.

BATCH PLAN: Turn 1: artboards 1-6, then wait for continue. Turn 2: 7-12, then wait for continue. Turn 3: 13-18, then wait for continue. Turn 4: 19.
