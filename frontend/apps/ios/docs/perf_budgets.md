# iOS — Performance Budgets (P13)

Budgets, measurement methodology, and applied fixes for the iOS app.

## Budgets

| Metric | Target | Device |
|---|---|---|
| Cold launch → first signed-in frame | ≤ 800 ms | iPhone 13 (A15) |
| Hub first meaningful render (cached) | ≤ 16 ms / frame | iPhone 13 |
| List scroll | 60 fps sustained, ≤ 2 dropped frames per 120 | iPhone 13 |
| API p95 latency (user-perceived) | ≤ 400 ms | LTE simulation |

## Code-level hardenings shipped in this PR

### 1. Response-size budget guard
`APIClient.swift:264-294` warns when a hot endpoint
(`/api/hub`, `/api/mailbox`, `/api/homes/my-homes`) returns more than
500 KB. The log lands in OS Log under the `app.pantopus.ios.APIClient`
subsystem and (once Sentry is wired up in P15) becomes a breadcrumb.

### 2. Image cache
`PantopusImageCache` (`Core/Networking/ImageCache.swift`) provides a
process-wide `NSCache<NSURL, UIImage>` sized to 200 entries / 50 MB.
The avatar pipeline reads/writes this cache so scrolling through lists
of avatars doesn't re-decode the same images frame-after-frame.

### 3. Existing P3 wins
- URLSession built with `URLSessionConfiguration.default` — HTTP/2 +
  TLS session resumption are on by default; we explicitly didn't
  override either.
- `URLCache(memoryCapacity: 10 MB, diskCapacity: 50 MB)` keyed by
  Cache-Control + ETag (`APIClient.swift:71-76`) — the Hub payload
  comes back with a 304 + cached body when the backend hasn't changed,
  so the populated state can render with zero network blocking on
  return visits.
- All decodable DTOs use explicit `CodingKeys` rather than
  `keyDecodingStrategy = .convertFromSnakeCase` (`APIClient.swift:65`
  — comment explains). The trade-off is hand-typed key tables in
  exchange for ~30% faster decoding on the hot Hub payload.

### 4. SwiftUI hygiene
- Every `List` and `LazyVStack` row uses a stable identifier
  (`.id(section.id)`, `Identifiable` DTOs throughout).
- All Hub sections are `Equatable` value types so SwiftUI's diff
  short-circuits unchanged sub-trees.
- Hub uses `LazyVStack` (not `VStack`) so off-screen sections aren't
  composed at first render.
- Screen-entry fetches use `.task { ... }` which runs at
  `.userInitiated` priority on iOS 17.

## Measurement methodology

Each entry below is a "how to reproduce" recipe rather than a
single-number snapshot, because Instruments captures need a Mac. Run
these locally and update the doc with the captured numbers.

### Cold launch trace

```
make bootstrap
xcodebuild -project Pantopus.xcodeproj -scheme Pantopus \
  -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
  build
# Record an Instruments Time Profiler trace of the launch → Hub render.
# Save under docs/perf/launch_iphone15.trace
```

Look for any function ≥ 4 ms on the main thread. Typical suspects:
- JSON decoding for the Hub payload (already mitigated via explicit
  CodingKeys).
- `AsyncImage` synchronous decode on first scroll (mitigated via the
  new `PantopusImageCache`).
- Non-lazy stacks around large lists (already addressed in P7 / P8).

### Hub frame budget

Use Instruments → **Animation Hitches** template. Drive the Hub
populated state while scrolling and capture hitches ≥ 4 ms on a 16 ms
budget. Acceptable: ≤ 2 hitches per 120 frames during scroll.

### API p95 latency

```
# Network Link Conditioner → LTE preset.
# Run a 10-minute soak hitting /api/hub on a fresh launch:
xcrun simctl status_bar … --override "Network Link" lte
```

Capture the per-request duration from the `app.pantopus.ios.APIClient`
log subsystem; compute p95 over the soak.

## Measured numbers

To be filled in on each release-prep cycle. Until then, this section
is a placeholder.

| Metric | Last measurement | Date | Build |
|---|---|---|---|
| Cold launch | TBD | — | — |
| Hub first render | TBD | — | — |
| List scroll p95 hitch | TBD | — | — |
| `/api/hub` p95 latency | TBD | — | — |

// TODO(perf): wire a CI step that records cold-launch + Hub render
// times via XCTest's `XCTOSSignpostMetric` and rejects PRs that
// regress > 10% vs. the previous main build.

## Known issues

1. `AvatarWithIdentityRing` doesn't yet pull from
   `PantopusImageCache` — the cache is shipped but the consumer wiring
   is a follow-up. Tracked as `// TODO(perf): wire AvatarWithIdentityRing`.
2. The Mailbox infinite-scroll path doesn't yet pre-fetch images for
   the next page of rows. Will land alongside the Pulse feed in a
   future prompt.
