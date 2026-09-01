# Mailbox Accessibility Audit

**Audited**: 2026-02-25
**Scope**: `/app/mailbox/*` — all pages, components, and navigation

---

## Summary

All mailbox screens have been audited against WCAG 2.1 AA. Below are the issues found, the fixes applied, and remaining recommendations.

---

## Fixes Applied

### Navigation (`MailboxNav.tsx`)

| Issue | Fix |
|-------|-----|
| Nav items had no accessible name when icon-only (tablet) | Added `aria-label` with count info (e.g. "Personal, 3 unread") |
| No indication of current page in nav | Added `aria-current="page"` on active item |
| Decorative emoji icons read by screen readers | Added `aria-hidden="true"` to icon, badge, and tooltip spans |
| Tooltip not positioned correctly on tablet | Added `relative` to button className |

### Layout (`layout.tsx`)

| Issue | Fix |
|-------|-----|
| No landmark roles on main regions | Added `role="navigation"` on `<aside>`, `role="main"` on `<main>` |
| Mail Day banner not announced as alert | Added `role="alert"` on banner container |
| Travel mode button has no accessible name | Added `aria-label="Travel Mode active. Click to manage."` |
| Dismiss button has no accessible name | Added `aria-label="Dismiss mail day notification"` |
| Decorative mail emoji read by screen readers | Added `aria-hidden="true"` on `&#9993;` span |

### Drawer List (`[drawer]/layout.tsx`)

| Issue | Fix |
|-------|-----|
| Filter dropdown has no label | Added `aria-label="Filter mail items"` |
| Search toggle button has no accessible name | Added `aria-label` (toggles between "Search this drawer" / "Close search") |
| Search toggle missing expanded state | Added `aria-expanded` attribute |
| New items banner not announced to screen readers | Added `role="status"` and `aria-live="polite"` |
| Item list has no list semantics | Added `role="list"` with `aria-label` |
| Loading spinner not announced | Added `role="status"` and `aria-label="Loading more items"` |

### Toast Notifications (`MailboxToast.tsx`)

| Issue | Fix |
|-------|-----|
| Toast container not a live region | Uses `aria-live="polite"` on container |
| Individual toasts not announced | Each toast has `role="alert"` |
| Dismiss button needs label | Has `aria-label="Dismiss notification"` |

### Error Boundary (`MailboxErrorBoundary.tsx`)

| Issue | Fix |
|-------|-----|
| Error states need to be section-scoped | Each boundary wraps a single section, not the whole page |
| Retry button clearly labeled | Uses explicit "Retry" text |

### Empty States (`EmptyState.tsx`)

| Issue | Fix |
|-------|-----|
| Empty state not communicated to assistive tech | Uses `role="status"` on container |
| Section-specific messaging | 12 section configs with distinct icon, title, and description |

---

## Keyboard Navigation

| Area | Status | Notes |
|------|--------|-------|
| Nav items | Pass | All buttons, natural Tab order follows DOM |
| Drawer filter & search | Pass | `<select>` and `<input>` are natively keyboard accessible |
| Mail item list | Pass | MailItemCard renders as `<button>`, focusable and Enter-activatable |
| Detail back navigation | Pass | Back button is a `<button>` element |
| Toast dismiss | Pass | Dismiss button is focusable |
| Error retry | Pass | Retry button is focusable |
| Compose button | N/A | Not rendered in current layout (composeSlot not passed) |

---

## Color & Contrast

| Area | Status | Notes |
|------|--------|-------|
| Urgency indicators | Pass | Uses both color and text labels (e.g. "Urgent", "Due today") — not color-only |
| Unread count badges | Pass | White text on red/amber backgrounds meets 4.5:1 ratio |
| Primary text on light bg | Pass | `text-gray-900` on `bg-white` exceeds 4.5:1 |
| Dark mode equivalents | Pass | `text-gray-100` on `bg-gray-950` exceeds 4.5:1 |
| Toast type indicators | Pass | Each type uses icon character + color — not color-only |
| Active nav state | Pass | Uses left border + background change — not color-only |

---

## Remaining Recommendations

1. **Focus management on item selection**: When a mail item is selected on desktop (split view), programmatic focus should move to the detail heading. Currently the detail panel renders but focus stays on the list item.

2. **Skip-to-content link**: Consider adding a skip link at the top of the mailbox layout so keyboard users can bypass the nav sidebar.

3. **Reduced motion**: The `animate-pulse` and `animate-spin` CSS classes should respect `prefers-reduced-motion`. Tailwind's `motion-reduce:` variant could be used to disable these animations.

4. **Screen reader announcements on filter change**: When the filter dropdown changes and the list re-renders, a live region announcement could inform the user of the new result count.

5. **Map page**: The MapPin component uses colored circles. Ensure pin tooltips are keyboard-accessible (currently hover-only). Consider adding `tabIndex={0}` and `onKeyDown` handlers to map pins.
