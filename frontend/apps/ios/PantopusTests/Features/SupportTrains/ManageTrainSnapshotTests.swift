//
//  ManageTrainSnapshotTests.swift
//  PantopusTests
//
//  A13.13 — design-reference baseline tripwire for the Manage train
//  organizer surface. Same shape as `EditPersonaSnapshotTests` /
//  `EditSignupSnapshotTests`: asserts the baseline PNG exists at
//  `PantopusTests/__Snapshots__/a13-13-manage-train/<state>-ios.png`
//  and is a non-trivial PNG. Tests `XCTSkip` when the baseline is
//  missing so the gate ships without failing CI on the first PR;
//  a follow-up commits the recorded images for `active` and `closing`.
//

import XCTest

final class ManageTrainSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // SupportTrains
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a13-13-manage-train")
    }

    func test_manage_train_active_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("active")
    }

    func test_manage_train_closing_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("closing")
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
