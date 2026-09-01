//
//  RecentActivitySnapshotTests.swift
//  PantopusTests
//
//  P1.5 — design-reference baseline tripwire for the four Recent
//  Activity log frames (Loading / Empty / Populated / Error).
//  Mirrors `SupportTrainsSnapshotTests`: asserts the baseline PNG
//  exists at
//  `PantopusTests/__Snapshots__/recent-activity/<state>-ios.png`
//  and is a valid PNG. The first PR ships the file with `XCTSkip` so
//  the gate exists without failing CI on a missing image; a follow-up
//  commits the baselines (recorded on first run of the render harness)
//  and the skip is dropped.
//

import XCTest

final class RecentActivitySnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // RecentActivity
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("recent-activity")
    }

    func test_recent_activity_loading_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("loading")
    }

    func test_recent_activity_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
    }

    func test_recent_activity_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_recent_activity_error_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("error")
    }

    private func assertBaselineOrSkip(_ screen: String) throws {
        let url = baselineURL.appendingPathComponent("\(screen)-ios.png")
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
