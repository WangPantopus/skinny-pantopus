//
//  HomeDashboardSnapshotTests.swift
//  PantopusTests
//
//  A10.1 / A10.2 - design-reference baseline tripwire for Home Dashboard.
//  Baselines are recorded by the snapshot job; this test keeps CI aware of
//  the three required frames while allowing the first implementation PR to
//  land before PNGs are committed.
//

import XCTest

final class HomeDashboardSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("home-dashboard")
    }

    func test_home_dashboard_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_home_dashboard_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
    }

    func test_home_dashboard_needs_attention_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("needs-attention")
    }

    private func assertBaselineOrSkip(_ slug: String) throws {
        let url = baselineURL.appendingPathComponent("\(slug)-ios.png")
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw XCTSkip("Baseline pending follow-up commit: \(url.path)")
        }
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(data.count, 8 * 1024, "Baseline too small (\(data.count) bytes)")
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
