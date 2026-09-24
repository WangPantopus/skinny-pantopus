The inline error state with a retry.

**Provide:** `message` (what failed and what to do) and optional `onRetry`.

The headline "Something went wrong" and button "Try Again" are fixed in the component.

**Flags:** "Try Again" is title case; native and the rest of the system say "Try again". The tile and button use raw Tailwind reds, so in dark themes the tile stays pale and the button text measures 3.12:1. Native `ErrorState` wraps `EmptyState` with an alert glyph. Source: `frontend/apps/web/src/components/ui/ErrorState.tsx`.
