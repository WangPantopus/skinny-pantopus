# Claude Design prompts — start page, aha card, brand mark, native polish

Paste the **Preamble** at the top of every prompt, then one of the numbered
prompts. Attach the design system export you already use (tokens, type scale,
components) and the current screenshot of the screen being redesigned; Claude
Design does far better against a real "before" than from a description.

---

## Preamble (paste first, every time)

> You are designing for Pantopus, an address-first neighborhood app. A person
> types their home address and, with no account, sees what is true about it:
> air today, flood and wildfire risk, radon, permits, the tax and pickup
> calendar, and who nearby has verified their address. Verifying an address is
> the whole product; the network unlocks only once enough households on a block
> have verified. Privacy is the brand: neighbors ever see a first name and a
> street, never a house number.
>
> Use the attached Pantopus design system exactly: its color tokens (primary
> blue, the green "home" accent for identity and verification, neutral surfaces),
> its type scale, its card radius and shadow, and its existing components. Do
> not introduce new colors, fonts, gradients or icon styles. Match the attached
> screenshots for everything you are not asked to change.
>
> Deliver: (1) the design at the sizes requested, (2) a short rationale of the
> three choices that matter most, (3) a token-by-token spec (spacing, type,
> color names from the system) so an engineer can build it without guessing,
> (4) the empty, loading, and error states where they apply, and (5) the
> light and dark versions. Write real copy, never lorem ipsum, and keep the
> voice plain and specific: no exclamation marks, no "welcome to", no emoji.

---

## 1. Start page (web `/start`, iOS and Android launch wall)

> Redesign the signed-out start page. It is the first screen a stranger sees
> from a postcard link, a share card, or a search, so its only job is to get
> them to type their address and tap "See your place".
>
> Current state (attached): a country chip, the headline "See what's true about
> your address.", one sentence, an address field, a disabled primary button, a
> "Just here to follow someone or browse?" link, and a privacy line at the
> bottom. It is clean but empty; nothing shows what they will get.
>
> Requirements:
> - Keep the headline and the address field above the fold on a 390×844 phone
>   and a 1280-wide desktop. The field is the hero; nothing may compete with it.
> - Show, not tell, what the address unlocks: a compact preview of three or
>   four real readings for a sample address (air quality now, flood zone,
>   radon zone, next pickup day), styled with the same cards the real
>   dashboard uses, clearly labeled as an example. It must read as a glimpse,
>   not a second page.
> - Add one line of proof about privacy directly under the field: "Neighbors
>   see a first name and a street. Never your house number." Use the shield
>   glyph from the system.
> - Address entry: the autocomplete dropdown, a "use my location" affordance
>   is NOT wanted (verification never uses GPS), keyboard-open layout on
>   mobile, and the disabled-until-valid button state.
> - The route-capture case: when the page opens from a postcard link
>   (`/start?r=…`) it may show a small "From the card in your mailbox" chip.
>   Design it.
> - The country chip stays but should stop looking like the first control on
>   the page.
> - Deliver phone (390), tablet (768) and desktop (1280) layouts, the
>   keyboard-open mobile state, the autocomplete-open state, and the loading
>   state after "See your place" is tapped (the preview takes 1–3 seconds).

---

## 2. The aha card ("Just moved in? Here's the first week")

> Redesign the first-week card on the Place dashboard. It appears for the first
> 30 days after a move-in date and is the product's whole pitch to a new
> resident: five things the address can do before there are neighbors to meet.
>
> Current state (attached): a card with a truck icon, the title, one sentence,
> and five list rows (Set your pickup day; Send back the previous resident's
> mail; Utilities, rebates, and rates; Who represents you, and the schools;
> Meet the block), each with a chevron, plus a dismiss X. It reads as a
> settings list, not a hero.
>
> Requirements:
> - Make it the one place on the dashboard the eye lands first, without
>   breaking the card grammar of the rest of the page or using a gradient.
>   Consider a two-tone treatment using the system's green "home" tint, a
>   larger title, and a progress cue.
> - Progress is real: each of the five items can be done or not (pickup day
>   set, previous-resident mail handled, and so on). Show "2 of 5 done" and a
>   done state per row. Design what the card looks like at 0, 2 and 5 of 5,
>   and how it retires itself at 5 of 5 (it should not just vanish).
> - Each row needs a one-line payoff, not a description: "Reminders start the
>   night before", "One tap returns it, yours gets filed".
> - Dismissal: a quiet "Not new here" text action instead of an X, since the
>   card is shown from a move-in date the person entered.
> - The same card exists on iOS and Android in native components; deliver the
>   web card at 390 and 1280, and a native variant at 390 that uses the iOS
>   grouped-list conventions already in the app.
> - Deliver light and dark, and the collapsed state when the person scrolls
>   past it (it can shrink to a one-line progress bar pinned under the header
>   if you think that earns its place; argue for or against it).

---

## 3. One brand mark

> Pantopus currently ships three different marks: a green map pin in a rounded
> tile on the start page, a blue four-square grid wordmark on the web app
> header and auth pages, and a blue house glyph above "Pantopus" on the native
> login screens. Pick one and design the mark so it works everywhere.
>
> Requirements:
> - One mark, one wordmark lockup, and the rules for using them: header (24px
>   tall on web), native auth hero (56px), favicon and app icon (16, 32, 180,
>   1024), the share card (`/api/og/place`, 1200×630), and a monochrome
>   version for the status bar and print.
> - It must say "address, verified" rather than "social" or "map app". Avoid
>   the generic location pin, the generic house, and any octopus literalism
>   unless you can make it quiet and abstract. The name comes from the octopus
>   (many arms, one body); a subtle nod is welcome, a mascot is not.
> - Use only the system's primary blue and home green, plus the neutrals. Show
>   the mark on white, on the app's off-white surface, on primary blue, and in
>   dark mode.
> - Deliver the replacement for each of the three current placements as
>   before/after pairs at real size, so the swap is a one-file change per
>   platform.

---

## 4. Android Nearby legend and map card

> Fix the legend under the Nearby map on Android. Four buckets ("No verified
> homes yet", "Forming (under 10)", "A few (10–24)", "Growing (25+)") wrap
> unevenly at 360dp and the third item breaks onto two lines with its swatch
> orphaned.
>
> Requirements:
> - Design the legend for 360dp, 411dp and 600dp widths using the app's
>   Compose components. Options to evaluate: a 2×2 grid, a single scrollable
>   row of chips, or folding the legend into the map's corner as a compact
>   scale. Recommend one.
> - The map card must also handle "map unavailable": the Compose Google Map
>   renders blank when the device has no Maps key or no network. Design the
>   fallback so the 5×5 cell grid still reads (a flat grid drawn without a
>   basemap is acceptable and is what web does).
> - Keep the one-sentence explainer under the legend ("Cells, not rooftops…")
>   and the outlined home cell.
> - Deliver the three widths, the fallback state, and dark mode.

---

## 5. iOS Today tab

> Design the Today tab on iOS as its own screen. Today it reuses the hub
> briefing (weather headline, a summary paragraph, a "Signals" list, and a
> "Coming soon" section); the address calendar the tab exists for is one tap
> deeper on a detail screen.
>
> Requirements:
> - Structure, top to bottom: the address line as the title context, weather
>   now with high/low and the next precipitation, "Good day to…" chips, then
>   the address calendar card (next two weeks: pickup days, council meetings,
>   tax dates; each row with source and an "unconfirmed" tag when the rule is
>   not yet official), then signals, then air quality. No "Coming soon" block;
>   list only what exists.
> - The calendar card is the reason the tab exists. Give it the weight; it
>   should show the next three items inline and expand to the two-week list.
> - Remove any placeholder copy (the current briefing can show "3 members"
>   style text that is not real). Labels are sentence case ("Smoke season").
> - Use the app's existing iOS components (grouped cards, the section header
>   style, the chip style) at 390×844 and 430×932, light and dark, plus the
>   loading skeleton and the "no calendar rules for this address yet" state
>   with a "Set your pickup day" action.
> - Match the Android Today tab's order where it is already right (weather,
>   good-day chips, then air quality) so the two platforms feel like one app.

---

## Order and packaging

Run them in this order: 3 (mark) first, because 1 and 2 use it; then 1, 2, 5,
4. Ask for each as a separate design file so the parity work maps one-to-one
onto the existing screens. When a result comes back, hand me the export and I
will build it to the spec on web, iOS and Android.
