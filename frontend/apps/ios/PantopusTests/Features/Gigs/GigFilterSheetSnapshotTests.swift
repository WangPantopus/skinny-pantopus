//
//  GigFilterSheetSnapshotTests.swift
//  PantopusTests
//
//  P5.3 — design-reference baseline tripwire for the Gig filter sheet,
//  matching the existing tripwire shape (e.g.
//  `AddHouseholdTaskFormSnapshotTests`). Asserts each baseline PNG
//  exists at `PantopusTests/__Snapshots__/p5-gig-filter/<state>-ios.png`
//  and is a non-trivial PNG; `XCTSkip`s while a baseline is pending so
//  the gate exists without failing CI before the renders are committed.
//
//  States: default (nothing selected) and active (every dimension set).
//

import XCTest

final class GigFilterSheetSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // Gigs
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p5-gig-filter")
    }

    func test_gig_filter_default_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("default")
    }

    func test_gig_filter_active_ios_baseline_is_present() throws {
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
