//
//  GigSearchSnapshotTests.swift
//  PantopusTests
//
//  P4.4 — Design-reference baseline tripwire for the Gig Search surface.
//  Same shape as `DocumentSearchSnapshotTests` (P4.5): asserts the
//  baseline PNGs exist at
//
//    `PantopusTests/__Snapshots__/p4-4-gig-search/<slug>-ios.png`
//
//  and are valid PNGs, `XCTSkip`-ing when a baseline is missing so the
//  gate exists from day one and the follow-up commits the renders.
//
//  States covered (the SearchListShell phases the screen produces):
//    • search-recent   → blank recent canvas (empty query) + category chips
//    • search-typing   → typing shimmer while the server query is in flight
//    • search-results  → matches rendered as reused feed gig rows
//    • search-empty    → no-match empty state
//    • search-error    → error-flavoured empty state (server fetch failed)
//

import XCTest

final class GigSearchSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Gigs
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p4-4-gig-search")
    }

    func test_gig_search_recent_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-recent")
    }

    func test_gig_search_typing_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-typing")
    }

    func test_gig_search_results_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-results")
    }

    func test_gig_search_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-empty")
    }

    func test_gig_search_error_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-error")
    }

    private func assertBaselineOrSkip(_ slug: String) throws {
        let url = baselineURL.appendingPathComponent("\(slug)-ios.png")
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw XCTSkip("Baseline pending follow-up commit: \(url.path)")
        }
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(data.count, 8 * 1024, "Baseline too small (\(data.count) bytes): \(url.path)")
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
