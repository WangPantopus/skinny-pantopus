A 16px loading bar with a sliding highlight.

**Provide:** `width` (a Tailwind width class, `w-32` default) and `className`. The sweep runs 1.5s and falls back to a pulse under reduced motion.

Loading states are skeletons in the shape of the content, never a screen-level spinner. **Flag:** in the web dark theme `app-surface-sunken` equals `app-surface`, so the shimmer is invisible there. Native `Shimmer` uses fixed light grays (#EEF0F3 to #F6F7F9) with a 1.4s sweep. Source: `frontend/apps/web/src/components/ui/Shimmer.tsx`.
