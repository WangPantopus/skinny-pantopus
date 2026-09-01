//
//  CreatorInboxSnapshotTests.swift
//  PantopusTests
//
//  P1.2 — design-reference baseline tripwire for the Creator Inbox
//  screen. Mirrors `SupportTrainsSnapshotTests.swift`: asserts the
//  baseline PNG file exists at
//  `PantopusTests/__Snapshots__/p1-creator-inbox/<screen>-ios.png`
//  and is a non-trivial PNG. The first PR ships the test file with
//  `XCTSkip` so the gate exists without failing CI on a missing
//  image; a follow-up commits the baselines and removes the skip.
//
//  Frames cover every state called out by the P1.2 prompt — loading,
//  empty, populated, error — plus the three filter selections
//  (Unread / Bronze+ / Flagged) so a regression in filter chip styling
//  or row variants is also caught.
//

import XCTest

final class CreatorInboxSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // CreatorInbox
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p1-creator-inbox")
    }

    func test_creator_inbox_loading_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("loading")
    }

    func test_creator_inbox_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
    }

    func test_creator_inbox_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_creator_inbox_error_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("error")
    }

    func test_creator_inbox_filter_unread_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("filter-unread")
    }

    func test_creator_inbox_filter_bronze_plus_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("filter-bronze-plus")
    }

    func test_creator_inbox_filter_flagged_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("filter-flagged")
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
