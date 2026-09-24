# Pantopus design system build

Rebuilds every file of the published [Pantopus design system](https://claude.ai/artifact/MCub8DTnkdhoFnMbtF8QF5) from this repository:

- **Tokens:** read from the web, iOS and Android sources.
- **Components:** the web app's real components, as a live bundle with previews.
- **Brand assets:** the logo files and navigation icons.
- **Brand book:** the written guidelines.

```sh
node tools/design-system/build.mjs
```

That builds into `tools/design-system/out/` in about a second. Other flags:

- `--check`: also renders every preview in every theme and type-checks the declarations (about two minutes).
- `--strict`: also fails on drift warnings.
- `--out DIR`: builds somewhere else.

Nothing is installed. TypeScript, Tailwind, lucide-react and Playwright all come from `frontend/apps/web`. `--check` drives the locally installed Google Chrome, as `tools/auth-screenshots` does.

## What the build reads

| Part | Source |
| --- | --- |
| Light and Dark colors | `frontend/apps/web/src/app/globals.css`: `:root` and the `prefers-color-scheme: dark` block |
| Dark · iOS colors | `Theme.Color` in `frontend/apps/ios/Pantopus/Core/Design/Colors.swift`, resolved through its asset-catalog colorsets |
| Native-only colors and cross-checks | `PantopusColors` in `frontend/apps/android/.../ui/theme/Color.kt` |
| Spacing, radius, shadows, text ramp | `frontend/packages/theme/src/*.ts` |
| Native cross-checks for those | `Spacing`, `Radii`, `PantopusShadow` / `PantopusElevations` and `PantopusTextStyle` (text tracking also comes from here) |
| Components | what `src/entry.tsx` re-exports from `frontend/apps/web/src/components` |
| Logos | `PantopusMark.tsx` geometry (behind a drift guard), plus `public/favicon.svg` and `public/icon-512.png` |
| Icons | `NavIcons` in `frontend/apps/web/src/lib/icons.ts`, drawn from lucide-react's icon data |

## What you edit

| File | What it holds |
| --- | --- |
| `content/tokens.mjs` | Token order, names and usage notes; how each token maps across platforms; curated type styles with source snippets; platform tokens left out on purpose |
| `content/README.md` | The brand book. `{{source}}` and `{{date}}` are filled in at build time. |
| `content/components/<Name>.md` | One guideline per component. The first sentence is its summary. |
| `content/previews.mjs` | The component catalogue: order, group, card height and preview script |
| `content/cover.html` | The cover. Redraw it when the palette, name or radius scale changes. |
| `content/logos.md` | The note for the Logos group. `{{hex:<token>}}` becomes that token's Light value. |
| `src/entry.tsx` | What the bundle exports, including the hand-written `Button` |
| `config.mjs` | Artifact link, system name, runtime libraries, asset groups, and the logo and icon lists |
| `lib/` | The build steps |

Usage notes in `content/tokens.mjs` can embed `{{fg|ground}}`. The build replaces it with the measured contrast in every theme, so the figures stay true when colors change.

## Drift report

**The build fails (exit 1) when:**
- a mapped token disappears from a platform;
- a component's guideline file is missing;
- the mark's geometry changed;
- with `--check`: a preview errors, renders blank or outgrows its card, or `index.d.ts` stops type-checking.

**It warns (and fails under `--strict`) when:**
- two platforms disagree on a value;
- a platform adds a color that `content/tokens.mjs` neither maps nor ignores;
- a curated type style's source snippet no longer appears in its file;
- a `{{fg|ground}}` pair drops under 4.5:1 and its note doesn't acknowledge it ("flagged", "decorative", "never text").

The existing 25 pairs under 4.5:1 are each acknowledged in their notes; the summary line counts them.

## Publishing with Claude Code

The build writes `out/publish-plan.json`. Publishing needs Claude's Artifact tool, so ask Claude Code something like:

> Publish tools/design-system/out to the Pantopus design system, following tools/design-system/README.md.

The steps:

1. **Upload new assets.** Each `uploads[]` entry with `"blob": null` is new or changed; upload it with `publish` and `asset: true`.
   - Record the returned id and stored size under `index.assetGroups.<group>.files.<name>` as `{ name, blob, size, type }`.
   - Record the same id and size under `assets.lock.json` → `uploads["assets/<group>/<name>"]`, together with the entry's `sha256`.
2. **Merge the index.** Read the live `project/design-system.json`.
   - Keep its other keys: `title`, `sections`, `docs`, `blobs` and the `createdOnFiles` marker.
   - Replace `namespace`, `libraries`, `groups`, `assetGroups` and `lastChange` with the plan's `index`.
3. **Publish once.** Make one `publish` call with:
   - `url` = the plan's `artifact`;
   - `root` = the plan's `root`;
   - `file_path` = the merged index, saved as `project/design-system.json` under `root`;
   - `files` = the plan's `files`, which are already in the Artifact tool's shape.
4. **Commit the lock.** If `assets.lock.json` changed, commit it.

A publish keeps every file it isn't sent. When a component or asset goes away, remove its `project/…` paths in the same call by mapping them to `null`.

## Adding a component

1. Export it from `src/entry.tsx`. The bundler only resolves `react`, `lucide-react`, `next/navigation` (inert), `@/…` paths and `@pantopus/*` packages, and refuses anything else.
2. Add its catalogue entry to `content/previews.mjs`.
3. Write `content/components/<Name>.md`.
4. Run `node tools/design-system/build.mjs --check`, then publish.

## Output

| Path | What |
| --- | --- |
| `out/project/` | The system's files: tokens, brand book, components and assets |
| `out/publish-plan.json` | Files to send, assets to upload, and the index fields to merge |
| `out/renders/` | With `--check`: one PNG per preview and theme, contact sheets (`_sheet.<theme>.NN.png`) and `_report.json` |
| `out/.build/` | Intermediate files: `tokens.css` for the render check, the Tailwind content list, the tsconfig |

`out/` is ignored by git. The build refuses to write into a non-empty directory it didn't create.

## Why this exists

The system was first built on Sept 16, 2026 by one-off scripts that were never committed. This folder keeps it rebuildable when tokens or components change, and makes cross-platform drift visible.
