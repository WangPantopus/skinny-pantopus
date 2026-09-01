# Lazy-Load Spike: expo-video and react-native-maps

> Research-only spike — no source changes shipped.
> Date: 2026-04-11

---

## 1. Current Footprint

### Module JS Source Sizes (proxy for bundle contribution)

| Module | node_modules JS size | Estimated bundle contribution |
|--------|---------------------|------------------------------|
| `expo-video` | ~35 KB (build/*.js) | ~25-30 KB minified |
| `react-native-maps` | ~66 KB (lib/*.js) | ~45-55 KB minified |
| `supercluster` | ~51 KB (*.js + *.mjs) | ~35-40 KB minified |
| **Total** | **~152 KB** | **~105-125 KB minified** |

### Measurement Limitations

`npx expo export` produces Hermes bytecode (`.hbc`), which obscures per-module sizing. The above estimates use raw JS source sizes from `node_modules` as a proxy. Actual bytecode contribution may differ by ±20% due to Hermes optimizations. A precise breakdown would require `--dev` mode with source maps and a bundle analyzer like `react-native-bundle-visualizer`.

### Baseline Context

The total mobile JS bundle is typically 2-4 MB for an app of this size. These three modules together represent ~3-6% of the total bundle — meaningful but not dominant.

---

## 2. Usage Audit

### expo-video (3 files)

| File | Import type | Initial tab reachable? | Notes |
|------|------------|----------------------|-------|
| `components/media/VideoPlayer.tsx` | Top-level eager | No — only rendered inside chat rooms, gig detail, feed posts with video | Used as poster overlay + video playback |
| `components/media/LivePhotoMedia.tsx` | Top-level eager | Yes — Feed tab can show live photos in PostMediaGrid | Used for live photo playback |
| `components/ImageViewerModal.tsx` | Top-level eager | Yes — Feed tab opens image viewer which may contain video | Used for full-screen video playback |

**Native startup behavior:** `expo-video` registers as an Expo plugin in `app.json` (line 193). The native module loads at app startup regardless of whether JS imports it — this is a fundamental constraint of React Native's native module registration. **Lazy-loading the JS side would save bundle parse time but not native initialization time.**

### react-native-maps (35 files, 12 with value imports)

**Value imports (component/class usage):**

| File | Import type | Initial tab reachable? | Notes |
|------|------------|----------------------|-------|
| `hooks/feed/useFeedMap.ts` | Top-level (`MapView`, `Region`) | Yes — Feed tab in map mode | MapView ref type + Region type |
| `components/feed/FeedMapView.tsx` | Top-level (`MapView`, `Marker`, `Region`) | Yes — Feed tab map view | Renders MapView |
| `app/explore-map.tsx` | Top-level (`MapView`) | No — push screen | Full-screen explore map |
| `app/gigs-map.tsx` | Top-level (`RNMapView`, `Region`) | No — push screen | Gigs map view |
| `app/gig/[id].tsx` | Top-level (`MapView`, `Marker`) | No — push screen | Gig detail map |
| `app/support-trains/[id].tsx` | Top-level (`MapView`, `Marker`) | No — push screen | Support train map |
| `app/mailbox/maps.tsx` | Top-level (`MapView`, `Marker`, `Region`) | No — push screen | Mailbox map |
| `components/marketplace/MarketplaceMapView.tsx` | Top-level | Yes — Marketplace tab map mode | Renders MapView |
| `components/discover-businesses/BusinessMapView.tsx` | Top-level | No — push screen | Business discovery map |
| `components/explore-map/GigMarkerLayer.tsx` | Top-level (`Marker`, `Circle`) | No — push screen | Map markers |
| `components/explore-map/BusinessMarkerLayer.tsx` | Top-level (`Marker`) | No — push screen | Map markers |
| `components/explore-map/PostMarkerLayer.tsx` | Top-level (`Marker`) | No — push screen | Map markers |
| `components/address/ConfirmAddress.tsx` | Top-level (`MapView`, `Marker`) | No — push screen | Address confirmation |

**Type-only imports (23 files):** Many files import only `type { Region }` — these have zero runtime cost and would remain unchanged.

**Native startup behavior:** `react-native-maps` registers native views (`AIRMap`, `AIRMapMarker`) at app startup via the React Native bridge. The native map SDK (Apple Maps / Google Maps) initializes eagerly. **Lazy-loading JS would save JS parse time but not native SDK initialization.**

### supercluster (3 files)

| File | Import type | Initial tab reachable? |
|------|------------|----------------------|
| `components/marketplace/clustering.ts` | Top-level | Yes — Marketplace tab |
| `components/explore-map/helpers.ts` | Top-level | No — push screen |
| `components/gigs/mapUtils.ts` | Top-level | No — gigs map |

**Native startup behavior:** Pure JS — no native module. Lazy-loading is fully effective.

---

## 3. Expo Router Lazy-Loading Reality Check

### Does Expo Router 6 support per-screen lazy JS bundles?

**No.** Expo Router uses Metro bundler, which produces a single JS bundle. There is no route-based code splitting in Expo Router 6 for native targets. All screens are bundled into one `.hbc` file. The `lazy` screen option in Expo Router controls React tree mounting (defers rendering until navigation), not JS bundle loading.

### Does React.lazy + Suspense work for screen components?

**Partially.** `React.lazy(() => import('./SomeScreen'))` works for deferring JS *parse/execution* of the module until the component is first rendered. The module is still in the bundle — it's just not parsed by Hermes until needed. This can save ~10-30ms of startup parse time per lazy module. However:

- The module must have a default export
- Error boundaries must wrap the Suspense to handle load failures
- Navigation transitions may flash a fallback if the module hasn't been parsed yet

### Known issues with native modules and lazy JS

**Critical:** Native modules like `react-native-maps` and `expo-video` register their native components at app startup regardless of JS imports. If you `React.lazy` a screen that uses `MapView`, the native `AIRMap` view is already registered and initialized. The JS-side `MapView` component is just a thin React wrapper — lazy-loading it saves only the wrapper's parse time (~5 KB), not the native SDK initialization (~500+ KB native).

### Expo team guidance

Expo's documentation does not recommend lazy-loading native module screens. Their guidance is:
1. Use `expo-router`'s `lazy: true` screen option for deferred mounting (not deferred loading)
2. For bundle size, prefer Expo's tree-shaking and `expo-modules-autolinking` rather than manual lazy imports
3. True route-based code splitting is on the roadmap but not shipped for native targets

---

## 4. Options Matrix

### expo-video (~25-30 KB JS)

| Option | Bundle savings | Effort | Risk | Verdict |
|--------|---------------|--------|------|---------|
| **A: Leave as-is** | 0 | 0 | None | Baseline |
| **B: React.lazy the 3 consumer files** | ~25 KB parse deferral (not bundle reduction) | Low (1 prompt) | Low — video is never shown on initial screen | **Viable** |
| **C: Route group lazy loading** | N/A — not supported by Expo Router 6 | N/A | N/A | Not applicable |
| **D: Separate build variant** | Full removal from main bundle | Very high | High — maintenance burden | Overkill |

### react-native-maps (~45-55 KB JS) + supercluster (~35-40 KB JS)

| Option | Bundle savings | Effort | Risk | Verdict |
|--------|---------------|--------|------|---------|
| **A: Leave as-is** | 0 | 0 | None | Baseline |
| **B: React.lazy the map screen components** | ~80 KB parse deferral | Medium (1-2 prompts) | **Medium** — Feed tab imports useFeedMap.ts which imports MapView at top level. Map mode is togglable, so the import is needed even if the user stays in list mode initially. Lazy-loading would require restructuring the feed to conditionally import the map concern. | **Risky for Feed** |
| **B': React.lazy only for push screens** | ~40 KB parse deferral (explore-map, gigs-map, gig/[id], support-trains, mailbox/maps) | Low (1 prompt) | Low — these are all secondary push screens, never shown at startup | **Viable for push screens only** |
| **C: Route group lazy loading** | N/A — not supported | N/A | N/A | Not applicable |
| **D: Separate build variant** | Full removal | Very high | High | Overkill |

---

## 5. Recommendation

### expo-video: **Leave as-is (Option A)**

**Rationale:**
- ~25-30 KB JS is small (1-2% of bundle)
- Native module loads at startup regardless
- 2 of 3 consumer files are reachable from initial tabs (LivePhotoMedia in Feed, ImageViewerModal globally)
- Parse deferral savings (~10ms) don't justify the added complexity and Suspense fallback risk
- The P4.1 emoji keyboard lazy-load was worthwhile because it was 280 KB and only used in chat rooms — expo-video doesn't meet that threshold

### react-native-maps + supercluster: **Leave as-is (Option A)**

**Rationale:**
- Native map SDK loads at startup regardless of JS lazy-loading
- Feed tab (initial screen) imports `useFeedMap.ts` which imports `MapView` at top level — restructuring this dependency chain to enable lazy-loading is invasive and risks regressions
- The ~80 KB JS parse deferral (~20-30ms) is not worth the risk of:
  - Flash of empty content when toggling to map mode on Feed
  - Restructuring the P3.1 hook split to conditionally import useFeedMap
  - Potential crashes from native view registration timing
- Push-only screens (explore-map, gigs-map, etc.) could benefit from Option B' but the savings (~40 KB) are marginal and the implementation touches 5+ files

**Bottom line:** The combined ~105-125 KB from these modules represents ~3-6% of the total bundle. The native modules load at startup regardless. The JS parse deferral savings (~30-50ms) don't justify the complexity and regression risk. The P4.1 emoji keyboard lazy-load was the right call because it was a pure-JS module with a clear usage gate (open/close). These native modules don't have the same clean boundary.

---

## 6. Follow-up Prompt Sketch

**Not recommended** — both modules are assessed as "leave as-is."

If the team revisits this decision after profiling shows startup parse time as a bottleneck (>200ms attributed to these modules), a potential P4.5b for the push-screen-only map lazy-load (Option B') would look like:

- Scope: `explore-map.tsx`, `gigs-map.tsx`, `gig/[id].tsx`, `support-trains/[id].tsx`, `mailbox/maps.tsx`
- Pattern: `React.lazy(() => import('./ExploreMapContent'))` with Suspense + ActivityIndicator fallback
- Extract each screen's content into a separate default-export component file
- Keep the route file as a thin Suspense wrapper
- Test: verify map renders after navigation, verify back-navigation doesn't crash
- Risk: low for push screens, but requires testing on both iOS and Android
- Estimated effort: 1 Claude Code prompt, ~30 minutes

This is deferred pending profiling data that justifies the effort.
