The bottom-pinned action shelf for forms and wizards: helper text, an optional back action, and one primary action.

**Provide:** `primaryLabel`, `onPrimaryClick`, optional `primaryDisabled`, `primaryLoading`, `primaryTone` (`primary`, `success`, `warning`, `danger`), `secondaryLabel` with `onSecondaryClick` and `secondaryDisabled`, `helperText`.

It is `position: sticky` at the bottom (it lifts by `--fab-lift` when a FAB is present), `app-surface` at 95% with a backdrop blur and a top hairline. Buttons are 44px. Put reassurance in `helperText`: "Your exact address is never shown to neighbors." Source: `frontend/apps/web/src/components/archetypes/primitives/StickyFooter.tsx`.
