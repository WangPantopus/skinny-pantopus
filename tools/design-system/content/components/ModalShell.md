A form dialog: icon badge, title and subtitle, a scrolling body, and a sticky two-button footer.

**Provide:** `open`, `onClose`, `title`, `children`, `submitLabel`, `onSubmit`, `onCancel`, optional `icon` with `iconColor` and `iconBgColor` (pass tokens), `subtitle`, `cancelLabel`, `submitIcon`, `submitting`, `submitDisabled`, `cancelDisabled`, `maxWidth` (`max-w-lg`).

**Flags:** the default `cancelLabel` is "Go Back" (title case; pass "Go back"). The submit button is hardcoded emerald-600 with white text (3.77:1). The close button has no accessible label. Source: `frontend/apps/web/src/components/ui/ModalShell.tsx`.
