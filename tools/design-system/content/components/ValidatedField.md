The form field: a 44px input or textarea with label, required marker, helper text, and valid and error states.

**Provide:** `label` (required), `required`, `helper`, `error` (a message string: switches to a 1.5px `color-error` border and replaces the helper), `valid` (1px `color-success` border plus a check icon), `trailing` (your own trailing node), `multiline` with `rows` (textarea, min height 88px), and all native input attributes (`value`/`onChange` or `defaultValue`, `type`, `placeholder`). Forwards its ref.

**Anatomy:** label 13px/600 `app-text-strong`; input `radius-md`, 12px side padding, 14px text on `app-surface`; placeholder `app-text-muted`; focus ring `color-primary-500` at 30% plus a `color-primary-500` border; messages 12px, 6px below.

**Copy:** labels are nouns in sentence case ("Street address"). Errors say what to do: "Enter an email like name@example.com."

Native: `PantopusTextField` (min height 44, `Radii.md`, 1pt border, 2pt when focused). Source: `frontend/apps/web/src/components/archetypes/primitives/ValidatedField.tsx`.
