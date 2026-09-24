The page title row for list and hub pages: overline, 22px bold title, subtitle, and up to a few actions.

**Provide:** `title`, optional `overline`, `subtitle` (one sentence, max 720px), `primaryAction` and `secondaryActions` (`{ label, onClick, icon?, variant?: 'primary' | 'ghost' | 'danger', disabled? }`; secondary defaults to ghost), and `children` for a filter or search row below.

Actions are 40px tall, `radius-lg`, 14px/600. Keep one primary action. Archetype-migrated pages use it instead of the older `PageHeader`, which still exists. Source: `frontend/apps/web/src/components/archetypes/primitives/ArchetypePageHeader.tsx`.
