The "Switch place" sheet for residents with more than one place: one row per place with its trust chip, plus "Add a place".

**Provide:** `open`, `onClose`, `homes` (`{ id, line1, city, status: 'verified' | 'claimed' }[]`), `activeId`, `onPick`, `onAddPlace`.

A bottom sheet on phones and a centered dialog on wider screens, with Escape, backdrop close and body scroll lock. The current place is highlighted in `color-primary-50` with "Current place". Verified shows a green chip, claimed an amber one: the same read as the avatar badge. Source: `frontend/apps/web/src/components/archetypes/place/PlaceSwitcher.tsx`.
