A dashboard group: an overline label over a stack of Place cards.

**Provide:** `label` (the group name: "Today", "Your home", "Risk & readiness") and `children` (cards).

Mobile stacks cards 8px apart. From 1024px the cards pair up two across (10px gap); a lone card, or the odd one out at the end, spans the full row so the grid never leaves a hole. The label is 11px/600, 0.08em, `app-text-muted`. Groups are 24px apart. Source: `frontend/apps/web/src/components/archetypes/place/Group.tsx`.
