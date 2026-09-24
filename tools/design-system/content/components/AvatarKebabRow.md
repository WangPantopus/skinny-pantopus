A people row: avatar with an optional verified badge, name with a role chip, metadata, and a "More options" menu button.

**Provide:** `name`, optional `avatarUrl` or `initials` (derived from the name otherwise), `avatarBg` (initials disc fill, defaults to `color-primary-600`), `meta`, `roleLabel` with `roleVariant`, `verified`, `onClick`, `onKebabClick`, `trailing`.

The avatar is 44px; the verified badge is a 16px `color-identity-home-solid` disc with a white check and a 2px surface ring. Pass an `avatarBg` that holds white 15px bold initials: the `-solid` tokens (5.02 to 7.56:1) do, the `color-primary-600` default (4.10:1) does not. Source: `frontend/apps/web/src/components/archetypes/primitives/AvatarKebabRow.tsx`.
