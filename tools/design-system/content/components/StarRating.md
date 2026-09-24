A row of star buttons for showing or collecting a 1–5 rating.

**Provide:** `rating` (number), `onChange` (omit with `readonly` for display), optional `maxStars` (5), `size` (24), `valueLabel` (text after the stars).

**Rules:** always pass `valueLabel` when displaying ("4.0 · 38 reviews") so the value is readable as text. Each star button is labelled "N stars".

**Contrast flag:** stars are Tailwind amber-400 (1.67:1 on white) and empty stars gray-300; the number in `valueLabel` is what makes the rating legible. Native uses the `color-star` token (#F59E0B) for stars and histogram bars. A rating is not a warning, so never use `color-warning`. Source: `frontend/apps/web/src/components/ui/StarRating.tsx`.
