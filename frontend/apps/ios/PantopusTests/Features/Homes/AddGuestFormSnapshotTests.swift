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
@testable import Pantopus

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

    @MainActor
    func test_add_guest_filled_ios_baseline_is_present() throws {
        let viewModel = AddGuestFormViewModel(homeId: "validation-only")
        viewModel.updateName("Guest")
        viewModel.updateContact("guest@example.com")
        let calendar = Calendar.current
        let start = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 10, day: 3, hour: 12)))
        let nextDay = try XCTUnwrap(calendar.date(byAdding: .day, value: 1, to: start))
        viewModel.setCustomRange(start, nextDay)

        XCTAssertTrue(viewModel.canSubmit)
        let window = viewModel.guestPassWindow()
        XCTAssertNotNil(window.startAt)
        XCTAssertNotNil(window.endAt)
        XCTAssertNil(window.durationHours)

        // Custom uses inclusive calendar days, so an earlier time on the same day is valid.
        let earlierToday = try XCTUnwrap(calendar.date(byAdding: .hour, value: -1, to: start))
        viewModel.setCustomRange(start, earlierToday)
        XCTAssertTrue(viewModel.canSubmit)
        let previousDay = try XCTUnwrap(calendar.date(byAdding: .day, value: -1, to: start))
        viewModel.setCustomRange(start, previousDay)
        XCTAssertFalse(viewModel.canSubmit)
        try assertBaselineOrSkip("filled")
    }

    @MainActor
    func test_add_guest_initial_ios_baseline_is_present() throws {
        let viewModel = AddGuestFormViewModel(homeId: "validation-only")
        viewModel.updateName("Guest")
        viewModel.updateContact("guest@example.com")
        viewModel.duration = AddGuestSampleData.durationCustomId

        XCTAssertEqual(viewModel.durationHint, "Pick a custom date range")
        XCTAssertFalse(viewModel.canSubmit, "Dismissing Custom without committing dates must keep Send pass disabled")

        let start = Date(timeIntervalSince1970: 2_000_000_000)
        viewModel.setCustomRange(start, start.addingTimeInterval(86400))
        viewModel.clearCustomRange()
        viewModel.duration = AddGuestSampleData.durationCustomId
        XCTAssertFalse(viewModel.canSubmit, "Cleared dates must not make a reselected Custom pass valid")

        viewModel.duration = "2h"
        XCTAssertTrue(viewModel.canSubmit)
        XCTAssertEqual(viewModel.guestPassWindow().durationHours, 2)
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
