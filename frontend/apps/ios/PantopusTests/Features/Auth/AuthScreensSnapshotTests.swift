//
//  AuthScreensSnapshotTests.swift
//  PantopusTests
//
//  T6.1b — design-reference baseline tripwire for the three auth screens.
//  Mirrors the T5 pattern in `T5ScreensSnapshotTests.swift`: asserts the
//  baseline PNG file exists at
//  `PantopusTests/__Snapshots__/auth/<screen>-ios.png` and is a non-trivial
//  PNG. Catches accidental deletion of the visual contract until full
//  SwiftUI `assertSnapshot` lands in a T6 follow-up.
//

import XCTest

final class AuthScreensSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Auth
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("auth")
    }

    func test_login_ios_baseline_is_present() throws {
        try assertBaseline("login")
    }

    func test_signup_ios_baseline_is_present() throws {
        try assertBaseline("signup")
    }

    func test_error_ios_baseline_is_present() throws {
        try assertBaseline("error")
    }

    // T6.1c P5 — Forgot / Reset / Verify baselines.

    func test_forgot_ios_baseline_is_present() throws {
        try assertBaseline("forgot")
    }

    func test_setpassword_ios_baseline_is_present() throws {
        try assertBaseline("setpassword")
    }

    func test_verify_ios_baseline_is_present() throws {
        try assertBaseline("verify")
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
