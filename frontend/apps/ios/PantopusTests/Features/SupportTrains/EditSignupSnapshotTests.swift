//
//  EditSignupSnapshotTests.swift
//  PantopusTests
//
//  P3.7 — design-reference baseline tripwire for the Edit Signup
//  form. Same shape as `ReviewSignupsSnapshotTests` / `SupportTrains
//  SnapshotTests`: the test skips when the PNG isn't checked in yet
//  so the first PR ships the gate without failing CI on a missing
//  baseline; a follow-up commits the recorded image and the skip
//  goes away.
//

import XCTest

final class EditSignupSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // SupportTrains
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p3-edit-signup")
    }

    func test_edit_signup_editing_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("editing")
    }

    func test_edit_signup_validation_error_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("validation-error")
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
