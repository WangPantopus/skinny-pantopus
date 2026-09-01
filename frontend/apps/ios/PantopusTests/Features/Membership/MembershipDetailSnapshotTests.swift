//
//  MembershipDetailSnapshotTests.swift
//  PantopusTests
//
//  A10.8 — design-reference baseline tripwire for the fan-side Membership
//  detail screen. Same shape as `BroadcastDetailSnapshotTests.swift`:
//  asserts the baseline PNG exists at
//  `PantopusTests/__Snapshots__/a10-8-membership/<state>-ios.png` and is a
//  non-trivial PNG. Tests `XCTSkip` when the baseline is missing so the
//  gate exists without failing CI on the first PR; the follow-up commits
//  the renders for populated / sla-missed / loading / error.
//

import XCTest

final class MembershipDetailSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Membership
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a10-8-membership")
    }

    func test_membership_detail_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("populated")
    }

    func test_membership_detail_sla_missed_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("sla-missed")
    }

    func test_membership_detail_loading_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("loading")
    }

    func test_membership_detail_error_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("error")
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
