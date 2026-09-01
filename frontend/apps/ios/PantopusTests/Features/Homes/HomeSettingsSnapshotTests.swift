//
//  HomeSettingsSnapshotTests.swift
//  PantopusTests
//
//  P5.1 / A14.1 — design-reference baseline tripwire for the per-home
//  Settings index. Asserts each committed PNG exists at
//
//    PantopusTests/__Snapshots__/a14-home-settings/<slug>-ios.png
//
//  and is a non-trivial PNG. The test `XCTSkip`s while baselines are
//  pending so the gate exists from day one without breaking CI before
//  renders are recorded.
//
//  States covered:
//    - populated  established home, address verified, all rows
//                 carry meaningful subs, Leave home destructive.
//    - pending    newly claimed, amber Verifying chip on the address,
//                 "Not set" subs, Cancel claim destructive.
//

import XCTest

final class HomeSettingsSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Homes
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a14-home-settings")
    }

    func test_home_settings_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_home_settings_pending_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("pending")
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
