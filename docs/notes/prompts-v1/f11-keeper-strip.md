# Keeper strip on Today
id: f11-keeper-strip · platforms: web/ios/android · isNew: False · frames: 12

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Keeper strip on Today
THIS IS: an EXTENSION. The host is the existing screen "Today (one composition, both payloads)" — the Today tab on each platform (web /app/today, iOS TodayTabRoot, Android TodayTabScreen). This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below. Add one strip, directly above the weather block and below the pickup lead card.
PLATFORMS / VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
WHERE IT LIVES: Today tab, always, once the place has a keeper. Also arrived at from the naming sheet on save, and cross-linked from the place file's category ring.
THE ONE JOB: Give the return surface a face — who is looking after this address, what is due, and how much the place file knows.

CONTENT (exact strings, real density)
Around it on Today, unchanged: location row "2416 NE Ingle Rd, Camas · Updated 4m ago", pickup lead card "Recycling goes out tonight", 14-day strip, weather "58° · Rain later".
The strip: a species avatar; name "Ollie"; mood word "Attentive"; the mood line verbatim, one of "Nothing due this week." / "Recycling tomorrow." / "A bill is overdue."; and a fact count reading "11 on file".
Six species, each drawn in four moods (relaxed, attentive, fidgeting, worried): Octopus, River otter, Great blue heron, Red fox, Raccoon, Douglas squirrel.

THE VISUALIZATION DECISION
One horizontal strip, height of a single list row plus padding. Left: 44pt species avatar. Centre: name at bodyMedium with the mood word as a caption in text.secondary, and the mood line beneath at bodySmall. The mood word never replaces the mood line — the line is the fact, the word is the face. Mood must read at 44pt from POSE alone, four genuinely different postures per species; do not encode mood as a colour swap or a badge.
Right: the fact count as a five-segment RING, 36pt, 3px stroke, 2px gaps, the integer "11" at label size centred inside and "on file" at caption beneath. Five segments in a fixed clockwise order from 12 o'clock — place, dates, money, people, proof — each filled in primary.600 if anything at all is known in that category and drawn as a border.strong hairline outline if nothing is. Here: place, dates, money, people filled; proof outlined. The whole right side is the tap target into the place file. This is deliberately NOT a progress bar and NOT a percentage, so nothing reads as "you are 60% complete" and a saved place reads as a smaller instrument rather than a failing one. Same ring geometry and same segment order as the place file's ring, so the two are recognisably one instrument at two sizes.
Mood must be nullable end to end, and the unavailable state is the one that matters: the bill and mail counts behind the mood can fail silently, so a broken check would otherwise render a cheerful relaxed face on the day a bill is overdue — a lie on the metric the pilot scores at zero. Draw "unavailable" as its own thing: the species in a neutral resting pose at reduced contrast, a HOLLOW provenance mark where the mood word sits, the line "Couldn't check what's due." and a quiet Retry. It must be impossible to mistake for relaxed.

STATES TO DRAW (one frame each, in situ on Today)
1. Loading — reserved space at the strip's exact height, skeleton avatar circle, two text bars, ring outline; the weather must not jump when the keeper lands. 2. Unnamed — generic silhouette in text.muted, "Give your place a keeper", a quiet inline invitation that expands on tap; Today is fully usable ignoring it. 3. Relaxed, quiet day — "Nothing due this week." 4. Attentive — "Recycling tomorrow." 5. Fidgeting — "Two bills due this week." 6. Worried — "A bill is overdue." 7. Mood unavailable. 8. Offline — last-known mood, greyed, "Attentive · as of 7:04 am". 9. T1 saved place — mood from the calendar only, copy says "this place", never "household"; ring shows money/people/proof as outlined segments, integer 4. 10. No place — the strip is absent entirely; draw Today without it. 11. Alert on screen — an air-quality alert is present, the avatar and mood are suppressed and the ring is gone; the alert owns the screen. 12. Permission-denied — a household member sees the strip and the name; the overflow carries no Rename / Change species / Remove and explains "Only Sam can rename this keeper."

DO NOT
Do not draw the fact count as a progress bar, a percentage, a completeness meter, XP, a streak or a level. Do not add a "knows 11 things" growth game or a target number to reach. Do not render mood-unavailable as the relaxed face or as any cheerful default. Do not place the keeper above the location row, and never above an alert.
