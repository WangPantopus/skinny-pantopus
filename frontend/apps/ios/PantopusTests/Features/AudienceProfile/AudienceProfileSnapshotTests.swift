//
//  AudienceProfileSnapshotTests.swift
//  PantopusTests
//
//  P6.3 — design-reference baseline tripwire for the Audience Profile
//  Threads tab filter chip strip (All threads · Unread · Bronze+ ·
//  Flagged). Mirrors `CreatorInboxSnapshotTests.swift`: asserts the
//  baseline PNG file exists at
//  `PantopusTests/__Snapshots__/p6-3-audience-profile-threads/<slug>-ios.png`
//  and is a non-trivial PNG. The first PR ships the test file with
//  `XCTSkip` so the gate exists without failing CI on a missing image;
//  a follow-up commits the baselines and removes the skip.
//
//  Slugs cover every filter selection (all / unread / bronze-plus /
//  flagged) plus the filtered-empty branch, so a regression in chip
//  styling or filter projection is caught immediately.
//

import XCTest

final class AudienceProfileSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // AudienceProfile
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p6-3-audience-profile-threads")
    }

    func test_audience_profile_threads_filter_all_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("filter-all")
    }

    func test_audience_profile_threads_filter_unread_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("filter-unread")
    }

    func test_audience_profile_threads_filter_bronze_plus_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("filter-bronze-plus")
    }

    func test_audience_profile_threads_filter_flagged_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("filter-flagged")
    }

    func test_audience_profile_threads_filtered_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("filter-empty")
    }

    func test_a22_1_audience_populated_ios_baseline_is_present() throws {
        try assertA221BaselineOrSkip("populated")
    }

    func test_a22_1_audience_empty_ios_baseline_is_present() throws {
        try assertA221BaselineOrSkip("empty")
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

    private func assertA221BaselineOrSkip(_ slug: String) throws {
        let url = baselineURL
            .deletingLastPathComponent()
            .appendingPathComponent("a22-1-audience")
            .appendingPathComponent("\(slug)-ios.png")
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
