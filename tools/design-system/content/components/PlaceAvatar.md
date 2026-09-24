The trust avatar: a verified green disc with a check badge, a claimed slate disc with an amber home badge, or a neutral disc when signed out.

**Provide:** `initials` (empty shows a person glyph), `status` (`verified` default, `claimed`, `none`), `size` (40), optional `label` (a small uppercase pill under the disc, used for "Claimed").

The badge is 42% of the disc with a 2px surface ring; badges use the `-solid` fills. Verified carries the check, never a pill.

**Contrast flag:** the initials are white on a green-500→green-700 gradient (2.28:1 at the light corner) and, when claimed, on slate-400→500 (2.56:1). Source: `frontend/apps/web/src/components/archetypes/place/primitives.tsx`.
