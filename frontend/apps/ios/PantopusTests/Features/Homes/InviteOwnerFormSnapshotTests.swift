//
//  InviteOwnerFormSnapshotTests.swift
//  PantopusTests
//
//  A13.2 design-reference baseline tripwire for Invite Owner.
//

import XCTest

final class InviteOwnerFormSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a13-invite-owner")
    }

    func test_invite_owner_valid_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("valid")
    }

    func test_invite_owner_conflict_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("conflict")
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
