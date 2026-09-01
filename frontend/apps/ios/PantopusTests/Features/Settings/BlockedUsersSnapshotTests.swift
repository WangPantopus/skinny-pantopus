//
//  BlockedUsersSnapshotTests.swift
//  PantopusTests
//
//  P8.4 / A14.4 — design-reference baseline tripwire for the Blocked
//  users screen. Asserts each committed PNG exists at
//
//    PantopusTests/__Snapshots__/a14-blocked-users/<slug>-ios.png
//
//  and is a non-trivial PNG. The test `XCTSkip`s while baselines are
//  pending so the gate exists from day one without breaking CI before
//  renders are recorded. Mirrors `HomeSettingsSnapshotTests` (A14.1) and
//  the Android `BlockedUsersSnapshotTest` Paparazzi states.
//
//  States covered:
//    - populated  five blocked people · 36pt avatar · "Blocked <date> ·
//                 <scope>" source-context line · neutral Unblock pill ·
//                 privacy-contract helper below the card.
//    - empty      neutral grey hero disc · user-minus glyph · "No one
//                 blocked" + reassurance about silence.
//

import XCTest

final class BlockedUsersSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Settings
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a14-blocked-users")
    }

    func test_blocked_users_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_blocked_users_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
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
