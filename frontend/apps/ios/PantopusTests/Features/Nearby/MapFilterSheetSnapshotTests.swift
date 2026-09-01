//
//  MapFilterSheetSnapshotTests.swift
//  PantopusTests
//
//  P5.3 — design-reference baseline tripwire for the Nearby map filter
//  sheet. Same shape as the other tripwire tests: asserts each baseline
//  PNG exists at
//  `PantopusTests/__Snapshots__/p5-map-filter/<state>-ios.png` and is a
//  non-trivial PNG; `XCTSkip`s while a baseline is pending.
//
//  States: default (nothing selected) and active (entity-type +
//  distance + gig dimensions set).
//

import XCTest

final class MapFilterSheetSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // Nearby
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p5-map-filter")
    }

    func test_map_filter_default_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("default")
    }

    func test_map_filter_active_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("active")
    }

    private func assertBaselineOrSkip(_ slug: String) throws {
        let url = baselineURL.appendingPathComponent("\(slug)-ios.png")
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw XCTSkip("Baseline pending follow-up commit: \(url.path)")
        }
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(data.count, 8 * 1024, "Baseline too small (\(data.count) bytes)")
        XCTAssertTrue(
            data.count > 4 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47,
            "Not a PNG: \(url.path)"
        )
    }
}
