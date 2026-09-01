//
//  MailboxMapSnapshotTests.swift
//  PantopusTests
//
//  A11.4 — design-reference baseline tripwire for the two Mailbox map
//  frames (Populated rail / Pin detail). Matches the T6 pattern: asserts
//  the baseline PNG exists at
//  `PantopusTests/__Snapshots__/t6/mailbox-map-<frame>-ios.png` and is a
//  valid, non-trivial PNG. Catches accidental deletion of the visual
//  contract until full SwiftUI snapshot tests land.
//

import XCTest

final class MailboxMapSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Mailbox
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("t6")
    }

    func test_mailbox_map_populated_ios_baseline_is_present() throws {
        try assertBaseline("mailbox-map-populated")
    }

    func test_mailbox_map_detail_ios_baseline_is_present() throws {
        try assertBaseline("mailbox-map-detail")
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
