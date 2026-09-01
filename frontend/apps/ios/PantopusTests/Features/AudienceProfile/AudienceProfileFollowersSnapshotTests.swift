//
//  AudienceProfileFollowersSnapshotTests.swift
//  PantopusTests
//
//  P6.4 — design-reference baseline tripwire for the Audience Profile's
//  Followers tab with search + sort chips. Mirrors the pattern set by
//  CreatorInboxSnapshotTests / BroadcastDetailSnapshotTests: asserts
//  the baseline PNG exists under
//  `PantopusTests/__Snapshots__/p6-audience-followers/<state>-ios.png`
//  and is a non-trivial PNG. The first PR ships the test file with
//  `XCTSkip` so the gate exists without failing CI on a missing image;
//  a follow-up commits the baselines and removes the skip.
//
//  States covered match the four sort options (default + each chip
//  selected), the search-filter populated case, and the empty
//  search-no-match case.
//

import XCTest

final class AudienceProfileFollowersSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // AudienceProfile
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p6-audience-followers")
    }

    func test_followers_sort_newest_active_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("sort-newest-active")
    }

    func test_followers_sort_highest_tier_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("sort-highest-tier")
    }

    func test_followers_sort_recently_joined_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("sort-recently-joined")
    }

    func test_followers_sort_most_engaged_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("sort-most-engaged")
    }

    func test_followers_search_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-populated")
    }

    func test_followers_search_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("search-empty")
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
