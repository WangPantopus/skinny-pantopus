A document row: a round icon disc, a name, metadata, and a chevron, stacked inside a grouped card.

**Provide:** `icon` (Lucide), `name`, optional `meta` ("PDF · 2.4 MB · Added Mar 3"), `onClick` (makes the row a button with a hover wash), `last` (drops the divider), `trailing` (replaces the chevron), `iconBg` and `iconColor` (pass token variables, e.g. `var(--color-identity-home-bg)`).

The disc is 36px on `app-surface-sunken`; the default glyph color is `color-primary-600`. Put rows in a card with `overflow-hidden` so the dividers meet the edges. Source: `frontend/apps/web/src/components/archetypes/primitives/FileChevronRow.tsx`.
