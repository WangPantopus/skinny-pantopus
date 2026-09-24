The Place section card: one pattern with six states (loaded, stale, empty, unavailable, error, loading) plus an inline single-line rhythm.

**Provide:** `icon`, `title` (sentence case), `state`, and for readings `value`, `caption`, `chip` (`{ label, variant, icon }`), `statusDot`, `sparkline`, `asOf` ("May 2026", "9:40 AM"), or an `action` (`{ label, onClick }`) in place of the value. Also `onRetry` for errors, `onClick` for tap-through (adds the chevron), `inline` and `compact`.

**State copy (built in):** empty "Nothing here yet / We'll show this once it's available."; unavailable "Not available for your area yet. / Coverage is expanding. Check back later."; error "Couldn't load this" + "Try again". A stale card turns its "as of" stamp `color-warning` with a refresh glyph.

**Rules:** always show freshness (`asOf`) for data that ages. Captions qualify, they don't alarm: "Screening, not a diagnosis". Loading shows shimmer bars, never a spinner. Source: `frontend/apps/web/src/components/archetypes/place/SectionCard.tsx`.
