//
//  ContentDetailSnapshotTests.swift
//  PantopusTests
//
//  P8.2 — design-reference baseline tripwire for the A09 transactional
//  detail frames (gig V2 / gig V1 / listing / invoice, every designed
//  state). Same shape as `BroadcastDetailSnapshotTests`: asserts the
//  baseline PNG exists at
//  `PantopusTests/__Snapshots__/p8-a09-transactional/<state>-ios.png`
//  and is a non-trivial PNG. Tests `XCTSkip` when the baseline is
//  missing so the gate exists without failing CI on the first PR; the
//  follow-up commits the renders.
//

import XCTest

final class ContentDetailSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // ContentDetail
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("p8-a09-transactional")
    }

    func test_task_v2_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("task-v2-populated")
    }

    func test_task_v2_no_bids_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("task-v2-no-bids")
    }

    func test_gig_v1_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("gig-v1-populated")
    }

    func test_gig_v1_awarded_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("gig-v1-awarded")
    }

    func test_listing_populated_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("listing-populated")
    }

    func test_listing_sold_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("listing-sold")
    }

    func test_invoice_due_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("invoice-due")
    }

    func test_invoice_paid_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("invoice-paid")
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
