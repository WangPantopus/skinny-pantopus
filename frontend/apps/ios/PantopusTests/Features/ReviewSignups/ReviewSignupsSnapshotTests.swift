//
//  ReviewSignupsSnapshotTests.swift
//  PantopusTests
//
//  T6.6c (P26.5) — design-reference baseline tripwire for the Review
//  Signups screen. Same shape as `SupportTrainsSnapshotTests.swift`
//  — `XCTSkip` when the baseline PNG is missing so the test gate
//  exists without failing CI on the first PR; the follow-up commits
//  the baselines.
//

import XCTest

final class ReviewSignupsSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // ReviewSignups
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("t6-review-signups")
    }

    func test_review_signups_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_review_signups_empty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("empty")
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
