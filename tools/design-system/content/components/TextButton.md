The verbs-first sky text action, the call-to-action voice inside Place cards.

**Provide:** `children` (the verb phrase), `onClick`, optional `arrow` (default true; set false for "Try again") and `type`.

**Rules:** one text action per card, placed last. Copy says what you get or keep: "Claim home", "Verify address", "Be one of the first to verify on your block"; never "Unlock". Use `Button` when the action is the screen's main job.

**Contrast flag:** the label is `color-primary-600` (4.10:1 on `app-surface`). `color-link` (5.93:1) is the AA ink the web introduced for this role but this component has not moved to it yet.

Source: `frontend/apps/web/src/components/archetypes/place/primitives.tsx`.
