# T5 design-reference screenshot harness

Hand-rolled HTML + SVG harness that mirrors the 12 T5 designed list
screens from the design package verbatim. Renders each screen at three
mobile viewports (iOS 390 × 844, Android 411 × 891, web 400 × 900) via
Playwright + Chromium, and stitches the three into a side-by-side
parity composite per screen.

```
tools/t5-screenshots/
├── README.md          ← this file
├── package.json       ← (empty marker; uses global playwright install)
├── lib.mjs            ← shared design tokens, status bar, top bar, chip strip, FAB
├── rows.mjs           ← RowModel render primitives (leading / trailing / chip / footer)
├── screens.mjs        ← 12 screen body renderers (one function per T5 screen)
└── render.mjs         ← orchestrator — outputs 36 per-platform PNGs + 12 parity composites
```

## Run

```sh
node tools/t5-screenshots/render.mjs
```

Outputs are written directly to their final repo locations:

| Output | Path |
|---|---|
| iOS baseline | `frontend/apps/ios/PantopusTests/__Snapshots__/t5/<screen>-ios.png` |
| Android baseline | `frontend/apps/android/app/src/test/snapshots/t5/<screen>-android.png` |
| Web baseline | `frontend/apps/web/tests/visual-regression/__snapshots__/t5/<screen>-web.png` |
| Parity composite | `docs/screenshots/parity-<screen>.png` |

Total: **48 PNGs** per run (12 screens × 3 platform baselines + 12 parity composites).

## Adding a 13th screen

1. Add a new render function in `screens.mjs`:

```js
export function newScreen() {
  const body = [
    rowCard({ leading: ..., title: '...', subtitle: '...', trailing: ... }),
    // ...
  ].join('');
  return [
    topBar({ title: 'New screen' }),
    tabStrip({ tabs: ['Tab A', 'Tab B'], active: 0 }),
    scrollFrame(body, /* hasFab */ true),
    fab({ kind: 'secondaryCreate' }),
  ].join('');
}
```

2. Register it in `ALL_SCREENS` at the bottom of `screens.mjs`:

```js
export const ALL_SCREENS = {
  // ...
  newScreen: {
    title: 'New screen',
    body: newScreen,
    caption: 'What the screen does + any intentional platform-specific divergences.',
  },
};
```

3. Re-run `node tools/t5-screenshots/render.mjs`. The four PNGs land in
   the four output locations above.

4. Wire the new baseline to the snapshot tests:
   - Add `test_newScreen_ios_baseline_is_present` to
     `frontend/apps/ios/PantopusTests/Features/Shared/ListOfRows/T5ScreensSnapshotTests.swift`.
   - Add `new_screen_android_baseline_is_present` to
     `frontend/apps/android/app/src/test/java/app/pantopus/android/ui/screens/shared/list_of_rows/T5ScreensSnapshotTest.kt`.
   - Add `'new-screen'` to the `SCREENS` array in
     `frontend/apps/web/tests/visual-regression/t5-screens.spec.ts`.

5. Add the parity composite to `docs/screenshots/README.md` under the
   `## T5 cross-platform parity composites` table.

## Dependencies

The harness uses only what's globally available in the Pantopus dev
container:

- Node ≥ 20
- Playwright + Chromium (installed at `/opt/node22/lib/node_modules/playwright`)

There is no `node_modules` directory inside `tools/t5-screenshots/`. The
import in `render.mjs` resolves Playwright from the global install:

```js
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
```

If running on a host where Playwright lives elsewhere, edit the import
in `render.mjs` to point at the local install (or `npm install
playwright` inside this directory first).

## Why HTML mockups instead of platform renders?

The remote-execution sandbox that runs Claude Code has no Xcode and no
Android SDK; it can't rasterize SwiftUI or Compose. The accepted pattern
in this repo (see `docs/screenshots/README.md`) is:

- **Design-reference shots** — hand-rolled HTML that mirrors the design
  package verbatim. These are the **visual contract** that all three
  platforms target. Authored once in this harness, regenerable any
  time, no network needed.
- **Platform-rendered shots** — captured by CI on macOS / Android-SDK
  runners and committed alongside the design-reference shots. They are
  what the test framework actually byte-compares on every PR (Paparazzi
  for Android, Playwright visual-regression for web,
  swift-snapshot-testing for iOS once it lands in T6).

This harness ships the design-reference column.
