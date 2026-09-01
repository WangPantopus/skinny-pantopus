//
//  PropertyDetailsSnapshotTests.swift
//  PantopusTests
//
//  A.4 / A13.5 — design-reference baseline tripwire for Property details.
//  Same shape as `AddBillWizardSnapshotTests`: asserts each baseline PNG
//  exists at `PantopusTests/__Snapshots__/property-details/<state>-ios.png`
//  and is a non-trivial PNG. Tests `XCTSkip` when the baseline is missing
//  so the gate exists without failing CI on the first PR; the follow-up
//  commits the renders (`make snapshots`).
//
//  States covered:
//    - clean    (FRAME 1 — all sources agree, no correction CTA)
//    - mismatch (FRAME 2 — amber banner, flagged Bedrooms row, sticky CTA)
//    - loading  (shimmer matching the populated geometry)
//    - error    (retry empty-state)
//

import XCTest

final class PropertyDetailsSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Homes
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("property-details")
    }

    func test_property_details_clean_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("clean")
    }

    func test_property_details_mismatch_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("mismatch")
    }

    func test_property_details_loading_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("loading")
    }

    func test_property_details_error_ios_baseline_is_present() throws {
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
