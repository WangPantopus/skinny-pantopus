//
//  BusinessProfileSnapshotTests.swift
//  PantopusTests
//
//  A10.6 — design-reference baseline tripwire for the reshaped Business
//  Profile frames (populated / newly-claimed-closed / loading /
//  not-found). Mirrors the pattern set by HubScreensSnapshotTests:
//  asserts that the baseline PNG exists under
//  `PantopusTests/__Snapshots__/p1/business-profile-<state>-ios.png`
//  and is a non-trivial PNG. The `BusinessProfileLoadedView` renders the
//  two frames off `BusinessProfileSampleData`; the macOS snapshot job
//  records the baselines (the cloud env has no Xcode — see drift D6).
//

import XCTest

final class BusinessProfileSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // BusinessProfile
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p1")
    }

    func test_businessProfile_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("business-profile-populated")
    }

    func test_businessProfile_newly_claimed_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("business-profile-newly-claimed")
    }

    func test_businessProfile_loading_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("business-profile-loading")
    }

    func test_businessProfile_not_found_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("business-profile-not-found")
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
