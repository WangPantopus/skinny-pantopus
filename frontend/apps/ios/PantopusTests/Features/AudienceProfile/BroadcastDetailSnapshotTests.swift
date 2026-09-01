//
//  BroadcastDetailSnapshotTests.swift
//  PantopusTests
//
//  P1.3 — design-reference baseline tripwire for the Broadcast detail
//  full-screen takeover (Audience Profile sub-route). Same shape as
//  `SupportTrainsSnapshotTests.swift`: asserts the baseline PNG file
//  exists at `PantopusTests/__Snapshots__/p1-broadcast-detail/<state>-
//  ios.png` and is a non-trivial PNG. Tests `XCTSkip` when the
//  baseline is missing so the test gate exists without failing CI on
//  the first PR; the follow-up commits the renders.
//

import XCTest

final class BroadcastDetailSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // AudienceProfile
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p1-broadcast-detail")
    }

    func test_broadcast_detail_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_broadcast_detail_empty_replies_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty-replies")
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
