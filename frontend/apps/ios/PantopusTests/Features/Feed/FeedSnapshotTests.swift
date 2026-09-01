//
//  FeedSnapshotTests.swift
//  PantopusTests
//
//  P8.1 / A03.1 + A03.2 — design-reference baseline tripwire for the Pulse
//  and Beacon Updates feeds. Asserts each committed PNG exists at
//
//    PantopusTests/__Snapshots__/a03-feed/<slug>-ios.png
//
//  and is a non-trivial PNG. The test `XCTSkip`s while baselines are
//  pending so the gate exists from day one without breaking CI before
//  renders are recorded.
//
//  States covered:
//    - pulse-populated   five mixed-intent cards (Ask · Rec · Event ·
//                        Lost · Announce), Event RSVP strip.
//    - pulse-empty       radio glyph, "No posts yet", scope footer chip.
//    - beacons-populated five verified beacon broadcasts.
//    - beacons-empty     rss glyph, "Discover beacons", follow-count chip.
//

import XCTest

final class FeedSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Feed
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a03-feed")
    }

    func test_pulse_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("pulse-populated")
    }

    func test_pulse_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("pulse-empty")
    }

    func test_beacons_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("beacons-populated")
    }

    func test_beacons_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("beacons-empty")
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
