The generic content card: `app-surface`, 1px `app-border`, `radius-2xl` (20px) and `shadow-sm`, with an optional section header.

**Provide:** `children`, optional `overline`, `title`, `action` (as in SectionHeader) and `padding` (`sm` 12px, `md` 16px default, `lg` 24px, `none`).

**Rules:** border plus a light shadow is the only card treatment. No colored left borders; color belongs in chips, dots and icon tiles inside the card. Don't nest cards; use a sunken well (`app-surface-sunken`, `radius-xl`) for an inner group. Source: `frontend/apps/web/src/components/archetypes/primitives/SectionCard.tsx`.
