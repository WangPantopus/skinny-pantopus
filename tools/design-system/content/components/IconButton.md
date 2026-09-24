A square, borderless icon control with an optional count badge.

**Provide:** `icon` (a rendered icon element, usually 20px), `label` (required: becomes `aria-label` and the tooltip), optional `badge` (a number; hidden at 0, "99+" above 99), plus button attributes.

**Rules:** use it for toolbar and header actions whose glyph is unambiguous (notifications, search, settings). Anything else gets a text label. Padding is 8px, radius `radius-lg`; ink is `app-text-muted`, going to `app-text` on hover over `app-hover`.

**Contrast flag:** the badge is white 10px bold on Tailwind red-500 (#EF4444), 3.76:1. Source: `frontend/apps/web/src/components/ui/IconButton.tsx`.
