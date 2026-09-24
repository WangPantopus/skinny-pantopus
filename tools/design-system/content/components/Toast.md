A transient confirmation or error that slides in at the top right (centered on phones) and dismisses itself.

**Provide:** `toast` (`{ id, variant: 'success' | 'error' | 'info' | 'warning', message, duration }`) and `onDismiss`. In the app, call `toastStore` rather than rendering it; defaults are 3s success, 5s error, 4s info and warning; hover pauses; at most three show.

Say what happened in the past tense: "Address verified", "Link copied". Errors say what to do next.

**Contrast flags:** fills are raw Tailwind: success green-600 (white 3.30:1), error red-600 (4.83:1), info `color-primary-600` (4.10:1), warning amber-500 with `app-text` (8.26:1 in light, but 1.73:1 in dark, where `app-text` turns pale). Native `ToastView` is a pill using `color-success`/`color-error` at 95%. Source: `frontend/apps/web/src/components/ui/Toast.tsx`.
