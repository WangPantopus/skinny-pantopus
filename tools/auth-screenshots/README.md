# Auth design-reference screenshot harness

Renders the Log in / Create account / Auth error visual contract inside a
device frame (408 x 800 CSS px at `deviceScaleFactor: 2` → 816 x 1600 PNG)
and writes the Android baselines that `AuthScreensSnapshotTest` guards.

```sh
node tools/auth-screenshots/render.mjs
```

| Output | Path |
|---|---|
| Android baseline | `frontend/apps/android/app/src/test/snapshots/auth/<screen>-android.png` |
| Docs copy | `docs/screenshots/auth-<screen>-android.png` |

Screens: `login`, `signup`, `error`. The other three auth baselines
(`forgot`, `setpassword`, `verify`) come from `tools/t5-screenshots/auth-p5.mjs`
and carry no brand chrome.

## Why this exists

The original harness lived at `/tmp/auth-screenshots/render.mjs` and was
never committed, so when the brand mark changed the baselines it produced
could not be regenerated. This one is in the repo.

## Browser

Chromium is resolved from the web app's `@playwright/test` and launched
through the `chrome` channel, so no Playwright browser download is needed —
a local Google Chrome install is enough.

## Brand mark

`mark()` re-implements the canonical 64-unit perforation geometry (body
`4,4 56x56 r13`, eight `r4.5` perforations, the `20,20 24x24 r4` window
knockout, the `M26 32.4 30.2 36.6 38.2 26.8` check at stroke 4.4). It must
stay in step with `frontend/apps/web/src/components/brand/PantopusMark.tsx`.
