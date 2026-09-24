A sheet that rises from the bottom on phones and centers as a dialog from 640px, with a title row, scrolling body and optional footer.

**Provide:** `open`, `onClose`, `children`, optional `title`, `subhead`, `footer`, `className`.

Escape and the backdrop close it, and body scroll locks while open. It is `radius-2xl` (top corners only on phones) with a 40% black backdrop and a 2px blur; the body scrolls at 70% of the viewport height. Put the confirming action in `footer`, right-aligned. The close button has no accessible label in the source; add one when you adapt it. Source: `frontend/apps/web/src/components/ui/BottomSheet.tsx`.
