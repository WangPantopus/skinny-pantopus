//
//  AddGuestFormSnapshotTests.swift
//  PantopusTests
//
//  A13.1 — design-reference baseline tripwire for the Add Guest form.
//  Mirrors the existing form tripwire tests: asserts each committed PNG
//  exists at
//
//    PantopusTests/__Snapshots__/a13-add-guest/<slug>-ios.png
//
//  and is a non-trivial PNG. Tests `XCTSkip` while baselines are pending
//  so the gate exists from day one without breaking CI before renders are
//  recorded.
//
//  States covered:
//    - filled   Sasha, Weekend, Front door + Garage, CTA enabled
//    - initial  pristine, first field empty, CTA disabled
//

import XCTest

final class AddGuestFormSnapshotTests: XCTestCase {
    private var baselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Homes
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a13-add-guest")
    }

    func test_add_guest_filled_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("filled")
    }

    func test_add_guest_initial_ios_baseline_is_present() throws {
        try assertBaselineOrSkip("initial")
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
