//
//  TodayDetailSnapshotTests.swift
//  PantopusTests
//
//  A10.3 — design-reference baseline tripwire for the two Today briefing
//  frames (Populated / Alert). Matches the hub + auth + T5/T6 pattern:
//  asserts the baseline PNG exists at
//  `PantopusTests/__Snapshots__/t6/today-<frame>-ios.png` and is a valid
//  PNG. Catches accidental deletion of the visual contract until full
//  SwiftUI snapshot tests land.
//

import XCTest

final class TodayDetailSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Hub
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("t6")
    }

    func test_today_populated_ios_baseline_is_present() throws {
        try assertBaseline("today-populated")
    }

    func test_today_alert_ios_baseline_is_present() throws {
        try assertBaseline("today-alert")
    }

    private func assertBaseline(_ screen: String) throws {
        let url = baselineURL.appendingPathComponent("\(screen)-ios.png")
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: url.path),
            "Missing baseline: \(url.path)"
        )
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
