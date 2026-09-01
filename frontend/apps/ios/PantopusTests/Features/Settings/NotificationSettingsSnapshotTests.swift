//
//  NotificationSettingsSnapshotTests.swift
//  PantopusTests
//
//  P7.5 / A14.5 — design-reference baseline tripwire for the reshaped
//  notification matrix. Asserts each committed PNG exists at
//
//    PantopusTests/__Snapshots__/a14-notifications/<slug>-ios.png
//
//  and is a non-trivial PNG. The test `XCTSkip`s while baselines are
//  pending so the gate exists from day one without breaking CI before
//  renders are recorded (mirrors `HomeSecuritySnapshotTests`).
//
//  States covered:
//    - populated  real mix: Master card + five channel-triad cards.
//    - paused     amber PauseBanner replaces Master; cards dim to 0.5.
//

import XCTest

final class NotificationSettingsSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Settings
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a14-notifications")
    }

    func test_notifications_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_notifications_paused_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("paused")
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
