The sticky back-header on Place detail pages: back button, 20px bold title and the compact address.

**Provide:** `title`, optional `address` ("1421 SE Oak St · Portland"), `onBack` (an in-page back that always shows) or `backHref` (router back, hidden from 1024px up where the Place nav rail takes over).

It sticks below the 56px app top bar on a blurred `app-bg` at 80%. The back button is a 36px surface circle labelled "Back". In this bundle the router is inert, so pass `onBack`. Source: `frontend/apps/web/src/components/archetypes/place/detail.tsx`.
