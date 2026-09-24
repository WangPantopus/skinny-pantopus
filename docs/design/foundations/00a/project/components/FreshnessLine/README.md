# FreshnessLine

How old a reading is, in words.

**Provide:** `state` (`fresh`, `updated`, `updating`, `refreshing`, `stale`, `fact-stale`, `offline`, `failed`, `widget-horizon`). Strings are "Updated just now", "Updated 12m ago", "Updating…", "as of 7:04 AM". caption 12/16 in `app-text-secondary`.

**Rules**
- Age is always stated in words. Colour never carries it, so the line survives greyscale.
- `updating` draws the platform's indeterminate hairline, not a spinner of ours.
- A date that falls today carries no weekday. Past dates show the date only, never "x days ago".
- Staleness is stated per fact, not once for the whole screen.

**Relates to:** `SourceNote`'s date is a fixed stamp on a published record. FreshnessLine is the live age of the copy the reader is looking at, and the two can disagree: the record is from May, the copy was fetched 12 minutes ago.

Source: Foundations board 00a (the Pantopus Foundations 00a canvas), component 00a-04. Drawn from the house style; no code source yet, so `tools/design-system` will not regenerate this card.