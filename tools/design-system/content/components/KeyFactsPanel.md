A sunken key/value list for facts and identifiers, with copy buttons for IDs.

**Provide:** `facts`: `{ label, value, monospace?, copyable? }[]`.

Labels are 11px/600 uppercase `app-text-secondary` in a 144px column; values are 14px/500 `app-text`, monospace 13px for IDs. The panel is `app-surface-sunken` with `radius-xl` and hairline dividers. Copy confirms with a check for 1.5s. Native: `KeyFactsPanel` (44pt copy target). Source: `frontend/apps/web/src/components/archetypes/primitives/KeyFactsPanel.tsx`.
