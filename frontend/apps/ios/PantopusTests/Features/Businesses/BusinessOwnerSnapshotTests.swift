//
//  BusinessOwnerSnapshotTests.swift
//  PantopusTests
//
//  A10.7 — design-reference baseline tripwire for the owner dashboard's two
//  frames (owner / edit + preview-as-neighbor) and its loading skeleton.
//  Mirrors `BusinessProfileSnapshotTests`: asserts the baseline PNG exists
//  under `PantopusTests/__Snapshots__/b3/business-owner-<frame>-ios.png`
//  and is a non-trivial PNG, or skips when it's pending an external record.
//  `OwnerEditFrame` / `OwnerPreviewFrame` render the frames off
//  `BusinessOwnerSampleData`; the macOS snapshot job records the baselines
//  (the cloud env has no Xcode — see drift D6).
//

import XCTest

final class BusinessOwnerSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Businesses
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("b3")
    }

    func test_businessOwner_owner_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("business-owner-owner")
    }

    func test_businessOwner_preview_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("business-owner-preview")
    }

    func test_businessOwner_loading_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("business-owner-loading")
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
