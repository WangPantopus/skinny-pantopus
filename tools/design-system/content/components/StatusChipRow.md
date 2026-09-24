The "bill row" list card: a tinted icon tile, a title and subtitle, and a right-aligned amount above a status chip.

**Provide:** `title`, optional `subtitle`, `amount` (preformatted money, 15px bold), `statusLabel` with `statusVariant` (a Chip variant) and `statusIcon`, `icon` (defaults to Receipt), `iconBg` and `iconColor` (token variables), `onClick` (adds a hover lift), `trailing`, and `below` for follow-up actions.

Without `iconBg`, a tappable row's tile is `color-primary-50`, which stays light in the web dark theme; pass a token pair such as `var(--color-success-light)` / `var(--color-success)` for dark-aware tiles. Status words follow the shared maps in `@pantopus/ui-utils` (Due, Paid, Overdue, Canceled). Source: `frontend/apps/web/src/components/archetypes/primitives/StatusChipRow.tsx`.
