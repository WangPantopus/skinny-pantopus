The design-system empty state: a 72px identity-tinted disc, a headline, subcopy and up to two actions.

**Provide:** `icon`, `headline`, optional `subcopy` (max 260px), `tone` (`home` default, `personal`, `business`, `neutral`), `ctaLabel` with `onCtaClick` (primary, with a plus glyph), `secondaryCtaLabel` with `onSecondaryCtaClick` (ghost).

Native `EmptyState` matches it (72pt disc, 32pt glyph, h3 headline, small subcopy, primary button). Every fetchable screen needs one. Source: `frontend/apps/web/src/components/archetypes/primitives/ArchetypeEmptyState.tsx`.
