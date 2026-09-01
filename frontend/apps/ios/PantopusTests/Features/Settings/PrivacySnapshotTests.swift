//
//  PrivacySnapshotTests.swift
//  PantopusTests
//
//  P7.6 / A14.7 — design-reference baseline tripwire for the reshaped
//  Privacy screen. Asserts each committed PNG exists at
//
//    PantopusTests/__Snapshots__/a14-privacy/<slug>-ios.png
//
//  and is a non-trivial PNG. The test `XCTSkip`s while baselines are
//  pending so the gate exists from day one without breaking CI before
//  renders are recorded (mirrors `HomeSecuritySnapshotTests`).
//
//  States covered:
//    - defaults  RadioCards + fuzz slider + activity + data.
//    - stealth   StealthBanner + everything at its most private.
//

import XCTest

final class PrivacySnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Settings
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a14-privacy")
    }

    func test_privacy_defaults_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("defaults")
    }

    func test_privacy_stealth_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("stealth")
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
