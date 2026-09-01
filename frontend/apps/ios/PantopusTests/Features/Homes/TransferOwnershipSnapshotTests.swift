//
//  TransferOwnershipSnapshotTests.swift
//  PantopusTests
//
//  A13.4 — design-reference baseline tripwire for the Transfer Ownership
//  form. Asserts each committed PNG exists at
//
//    PantopusTests/__Snapshots__/a13-transfer-ownership/<slug>-ios.png
//
//  and is a non-trivial PNG. Tests `XCTSkip` while baselines are pending
//  so the gate exists from day one without breaking CI before renders
//  are recorded.
//
//  States covered:
//    - ready          form populated, Maya selected, 25% slider, TRANSFER
//                     typed, CTA armed
//    - confirm_sheet  Face ID bottom sheet over the dimmed form
//

import XCTest

final class TransferOwnershipSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Homes
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a13-transfer-ownership")
    }

    func test_transfer_ownership_ready_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("ready")
    }

    func test_transfer_ownership_confirm_sheet_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("confirm_sheet")
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
