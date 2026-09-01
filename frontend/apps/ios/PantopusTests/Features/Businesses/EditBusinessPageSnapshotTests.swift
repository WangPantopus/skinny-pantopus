//
//  EditBusinessPageSnapshotTests.swift
//  PantopusTests
//
//  P4.2 — A13.10 Edit Business Page. Design-reference baseline tripwire,
//  same shape as `AddBillWizardSnapshotTests`: asserts each baseline PNG
//  exists at
//  `PantopusTests/__Snapshots__/p4-edit-business-page/<state>-ios.png`
//  and is a non-trivial PNG. Tests `XCTSkip` when the baseline is
//  missing so the gate exists without failing CI on the first PR; the
//  follow-up commits the renders.
//
//  States covered:
//    - published_dirty  (Roost Café, 3 unsaved tweaks, dirty bar)
//    - setup            (Patch & Paw, 3 of 7 sections, completion strip,
//                        "Publish · 4 to go" bar)
//

import XCTest

final class EditBusinessPageSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Businesses
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p4-edit-business-page")
    }

    func test_edit_business_page_published_dirty_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("published_dirty")
    }

    func test_edit_business_page_setup_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("setup")
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
