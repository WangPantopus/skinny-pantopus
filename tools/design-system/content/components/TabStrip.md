Under-header tabs with optional counts.

**Provide:** `tabs` (`{ key, label, count? }[]`), `activeKey`, `onChange`, optional `scrollable` (tabs keep their width and scroll instead of filling).

The active tab is 14px/600 `color-primary-600` with a 2px underline; inactive tabs are 14px/500 `app-text-secondary`; counts are `app-text-muted` in parentheses. Tabs are `role="tab"` inside a `tablist`.

**Contrast flag:** the active label is `color-primary-600` (4.10:1 on white). Source: `frontend/apps/web/src/components/archetypes/primitives/TabStrip.tsx`.
