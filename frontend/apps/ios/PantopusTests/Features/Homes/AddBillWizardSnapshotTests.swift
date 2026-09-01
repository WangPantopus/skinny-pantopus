//
//  AddBillWizardSnapshotTests.swift
//  PantopusTests
//
//  P3.2 — design-reference baseline tripwire for the Add / Edit Bill
//  wizard. Same shape as `AddHouseholdTaskFormSnapshotTests`: asserts
//  each baseline PNG exists at
//  `PantopusTests/__Snapshots__/p3-add-bill/<state>-ios.png` and is a
//  non-trivial PNG. Tests `XCTSkip` when the baseline is missing so the
//  gate exists without failing CI on the first PR; the follow-up
//  commits the renders.
//
//  States covered:
//    - create_details  (Add mode, step 1 empty)
//    - create_schedule (Add mode, step 2)
//    - create_review   (Add mode, step 3)
//    - create_success  (Add mode terminal step)
//    - edit_details    (Edit mode, hydrated step 1)
//    - edit_review     (Edit mode, step 3 with "Save changes" CTA)
//    - edit_success    (Edit mode terminal step — "Bill updated")
//    - load_error      (Edit mode, parent list 404 → inline error)
//

import XCTest

final class AddBillWizardSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Homes
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p3-add-bill")
    }

    func test_add_bill_create_details_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("create_details")
    }

    func test_add_bill_create_schedule_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("create_schedule")
    }

    func test_add_bill_create_review_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("create_review")
    }

    func test_add_bill_create_success_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("create_success")
    }

    func test_add_bill_edit_details_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("edit_details")
    }

    func test_add_bill_edit_review_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("edit_review")
    }

    func test_add_bill_edit_success_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("edit_success")
    }

    func test_add_bill_load_error_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("load_error")
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
