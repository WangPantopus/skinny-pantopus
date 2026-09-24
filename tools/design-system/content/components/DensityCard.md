"Verified homes nearby" as a k-anonymous bucket: four dots and a label, never a number.

**Provide:** `bucket` (`none`, `forming`, `few`, `growing`), optional `label` (overrides the canonical `PLACE_DENSITY_LABELS`), `ctaLabel` ("Be one of the first to verify on your block"), `onCta`, `onClick`, `showCta`.

**Rule:** never show a neighbor count, on any surface (design doc §4.1). Below the floor, the copy reads as an invitation, never a zero. Filled dots are `color-identity-home-solid`; empty dots `app-border`. Source: `frontend/apps/web/src/components/archetypes/place/DensityCard.tsx`.
