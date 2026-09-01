//
//  T5ScreensSnapshotTests.swift
//  PantopusTests
//
//  T5 — screen-level snapshot lockfile.
//
//  Verifies the 12 design-reference baseline PNGs (one per new T5
//  screen) stay checked in at their canonical location:
//
//    `frontend/apps/ios/PantopusTests/__Snapshots__/t5/<screen>-ios.png`
//
//  Each baseline is generated from the design package via the static HTML
//  harness at `tools/t5-screenshots/` (kept in `/tmp` — regenerable).
//  They are the **visual contract** that the on-device SwiftUI render
//  targets.
//
//  Drift at the screen level — a missing tab, a wrong FAB variant, a
//  dropped banner — gets caught by this test failing because someone
//  accidentally removed the PNG. **Until** real SwiftUI snapshot tests
//  land (a T6 candidate that requires adding `swift-snapshot-testing` to
//  `project.yml` and constructing fixture `ListOfRowsState` for each of
//  the 12 screens), this tripwire is the minimum lockfile guard against
//  PNG loss.
//
//  To regenerate the baselines:
//    cd /tmp/t5-tool && node render.mjs    # writes all 36 platform PNGs
//
//  To upgrade to real swift-snapshot-testing in T6: add
//    packages:
//      SnapshotTesting:
//        url: https://github.com/pointfreeco/swift-snapshot-testing
//        from: "1.17.0"
//  …to `project.yml`, then write `T5<Feature>ViewSnapshotTests.swift` per
//  screen with `assertSnapshot(of: hostingView, as: .image)`. CI verifies
//  on every PR.
//

import XCTest

final class T5ScreensSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        // PantopusTests/__Snapshots__/t5/  (relative to the test bundle's
        // source root — the file URL of the current test file).
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // ListOfRows
            .deletingLastPathComponent() // Shared
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("t5")
    }

    func test_notifications_ios_baseline_is_present() throws {
        try assertBaseline("notifications")
    }

    func test_bills_ios_baseline_is_present() throws {
        try assertBaseline("bills")
    }

    func test_pets_ios_baseline_is_present() throws {
        try assertBaseline("pets")
    }

    func test_connections_ios_baseline_is_present() throws {
        try assertBaseline("connections")
    }

    func test_offers_ios_baseline_is_present() throws {
        try assertBaseline("offers")
    }

    func test_myBids_ios_baseline_is_present() throws {
        try assertBaseline("my-bids")
    }

    func test_myTasks_ios_baseline_is_present() throws {
        try assertBaseline("my-tasks")
    }

    func test_myPulse_ios_baseline_is_present() throws {
        try assertBaseline("my-pulse")
    }

    func test_listingOffers_ios_baseline_is_present() throws {
        try assertBaseline("listing-offers")
    }

    func test_discoverHub_ios_baseline_is_present() throws {
        try assertBaseline("discover-hub")
    }

    func test_discoverBusinesses_ios_baseline_is_present() throws {
        try assertBaseline("discover-businesses")
    }

    func test_reviewClaims_ios_baseline_is_present() throws {
        try assertBaseline("review-claims")
    }

    private func assertBaseline(_ screen: String) throws {
        let url = baselineURL.appendingPathComponent("\(screen)-ios.png")
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: url.path),
            "Missing baseline: \(url.path)"
        )
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(data.count, 8 * 1024, "Baseline too small (\(data.count) bytes): \(url.path)")
        // PNG magic: 89 50 4E 47 0D 0A 1A 0A
        XCTAssertTrue(
            data.count > 4 &&
                data[0] == 0x89 &&
                data[1] == 0x50 &&
                data[2] == 0x4E &&
                data[3] == 0x47,
            "Not a PNG: \(url.path)"
        )
    }
}
