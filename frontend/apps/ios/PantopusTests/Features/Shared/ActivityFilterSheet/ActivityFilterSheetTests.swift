//
//  ActivityFilterSheetTests.swift
//  PantopusTests
//
//  P5.4 — Contract tests for the generic activity filter. Asserts the
//  ActivityFilter ↔ [FilterSection] mapping round-trips, the apply()
//  projection narrows + sorts correctly (status / date / sort), and the
//  sheet materialises cleanly for every selection state.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class ActivityFilterSheetTests: XCTestCase {
    // MARK: - Fixtures

    private struct Item: Equatable {
        let id: String
        let status: String?
        let date: Date?
        let value: Double?
    }

    private let now = Date(timeIntervalSince1970: 1_700_000_000) // fixed clock

    private func item(_ id: String, status: String? = nil, ageDays: Double? = nil, value: Double? = nil) -> Item {
        let date = ageDays.map { now.addingTimeInterval(-$0 * 86400) }
        return Item(id: id, status: status, date: date, value: value)
    }

    private let statusOptions = [
        FilterOption(id: "pending", label: "Pending"),
        FilterOption(id: "accepted", label: "Accepted"),
        FilterOption(id: "declined", label: "Declined")
    ]

    // MARK: - Section building

    func testSectionsBuildStatusSortDate() {
        let filter = ActivityFilter(statusIds: ["pending"], sort: .newest, dateRange: .week)
        let sections = ActivityFilterSheet.sections(
            statusTitle: "Status",
            statusOptions: statusOptions,
            sortOptions: ActivitySortOrder.all,
            filter: filter
        )
        XCTAssertEqual(sections.map(\.id), [
            ActivityFilterSection.status,
            ActivityFilterSection.sort,
            ActivityFilterSection.dateRange
        ])
        if case let .chipGroup(_, ids) = sections[0].control {
            XCTAssertEqual(ids, ["pending"])
        } else { XCTFail("status should be a chipGroup") }
        if case let .radio(_, selected) = sections[1].control {
            XCTAssertEqual(selected, ActivitySortOrder.newest.rawValue)
        } else { XCTFail("sort should be a radio") }
        if case let .singleChip(_, selected) = sections[2].control {
            XCTAssertEqual(selected, ActivityDateRange.week.rawValue)
        } else { XCTFail("date range should be a singleChip") }
    }

    func testSectionsOmitStatusWhenNoOptions() {
        let sections = ActivityFilterSheet.sections(
            statusTitle: "Status",
            statusOptions: [],
            sortOptions: ActivitySortOrder.timeOnly,
            filter: ActivityFilter()
        )
        XCTAssertEqual(sections.map(\.id), [ActivityFilterSection.sort, ActivityFilterSection.dateRange])
    }

    // MARK: - Round-trip mapping

    func testFilterRoundTripsThroughSections() {
        let filter = ActivityFilter(statusIds: ["pending", "accepted"], sort: .valueHighToLow, dateRange: .month)
        let sections = ActivityFilterSheet.sections(
            statusTitle: "Status",
            statusOptions: statusOptions,
            sortOptions: ActivitySortOrder.all,
            filter: filter
        )
        XCTAssertEqual(ActivityFilterSheet.filter(from: sections), filter)
    }

    func testClearedSectionsParseToInactiveFilter() {
        let built = ActivityFilterSheet.sections(
            statusTitle: "Status",
            statusOptions: statusOptions,
            sortOptions: ActivitySortOrder.all,
            filter: ActivityFilter(statusIds: ["pending"], sort: .oldest, dateRange: .today)
        )
        let sections = built.cleared()
        let parsed = ActivityFilterSheet.filter(from: sections)
        XCTAssertFalse(parsed.isActive)
        XCTAssertEqual(parsed, ActivityFilter())
    }

    // MARK: - Single-chip control (shared model extension)

    func testSingleChipClearedDropsSelection() {
        let control: FilterControl = .singleChip(options: statusOptions, selectedId: "pending")
        if case let .singleChip(_, selected) = control.cleared() {
            XCTAssertNil(selected)
        } else { XCTFail("Expected singleChip after clearing") }
    }

    // MARK: - Apply: inactive

    func testApplyInactiveReturnsItemsUnchanged() {
        let items = [item("a", ageDays: 1), item("b", ageDays: 5), item("c", ageDays: 10)]
        let result = ActivityFilter().apply(
            to: items,
            now: now,
            statusId: { $0.status },
            date: { $0.date },
            value: { $0.value }
        )
        XCTAssertEqual(result, items)
    }

    // MARK: - Apply: status

    func testApplyStatusKeepsMatchingChips() {
        let items = [
            item("a", status: "pending"),
            item("b", status: "accepted"),
            item("c", status: "declined")
        ]
        let result = ActivityFilter(statusIds: ["pending", "declined"]).apply(
            to: items,
            now: now,
            statusId: { $0.status },
            date: { $0.date },
            value: { $0.value }
        )
        XCTAssertEqual(result.map(\.id), ["a", "c"])
    }

    func testApplyStatusDropsItemsWithNoChipId() {
        let items = [item("a", status: "pending"), item("b", status: nil)]
        let result = ActivityFilter(statusIds: ["pending"]).apply(
            to: items,
            now: now,
            statusId: { $0.status },
            date: { $0.date },
            value: { $0.value }
        )
        XCTAssertEqual(result.map(\.id), ["a"])
    }

    // MARK: - Apply: date range

    func testApplyDateRangeToday() {
        let items = [item("today", ageDays: 0), item("yesterday", ageDays: 1)]
        let result = ActivityFilter(dateRange: .today).apply(
            to: items,
            now: now,
            statusId: { $0.status },
            date: { $0.date },
            value: { $0.value }
        )
        XCTAssertEqual(result.map(\.id), ["today"])
    }

    func testApplyDateRangeWeekAndMonth() {
        let items = [item("d2", ageDays: 2), item("d10", ageDays: 10), item("d40", ageDays: 40)]
        let week = ActivityFilter(dateRange: .week).apply(
            to: items,
            now: now,
            statusId: { $0.status },
            date: { $0.date },
            value: { $0.value }
        )
        XCTAssertEqual(week.map(\.id), ["d2"])
        let month = ActivityFilter(dateRange: .month).apply(
            to: items,
            now: now,
            statusId: { $0.status },
            date: { $0.date },
            value: { $0.value }
        )
        XCTAssertEqual(month.map(\.id), ["d2", "d10"])
    }

    // MARK: - Apply: sort

    func testApplySortNewestThenOldest() {
        let items = [item("old", ageDays: 10), item("mid", ageDays: 5), item("new", ageDays: 1)]
        let newest = ActivityFilter(sort: .newest).apply(
            to: items,
            now: now,
            statusId: { $0.status },
            date: { $0.date },
            value: { $0.value }
        )
        XCTAssertEqual(newest.map(\.id), ["new", "mid", "old"])
        let oldest = ActivityFilter(sort: .oldest).apply(
            to: items,
            now: now,
            statusId: { $0.status },
            date: { $0.date },
            value: { $0.value }
        )
        XCTAssertEqual(oldest.map(\.id), ["old", "mid", "new"])
    }

    func testApplySortByValue() {
        let items = [item("lo", value: 10), item("hi", value: 99), item("mid", value: 50)]
        let highLow = ActivityFilter(sort: .valueHighToLow).apply(
            to: items,
            now: now,
            statusId: { $0.status },
            date: { $0.date },
            value: { $0.value }
        )
        XCTAssertEqual(highLow.map(\.id), ["hi", "mid", "lo"])
        let lowHigh = ActivityFilter(sort: .valueLowToHigh).apply(
            to: items,
            now: now,
            statusId: { $0.status },
            date: { $0.date },
            value: { $0.value }
        )
        XCTAssertEqual(lowHigh.map(\.id), ["lo", "mid", "hi"])
    }

    // MARK: - isActive

    func testIsActive() {
        XCTAssertFalse(ActivityFilter().isActive)
        XCTAssertTrue(ActivityFilter(statusIds: ["pending"]).isActive)
        XCTAssertTrue(ActivityFilter(sort: .newest).isActive)
        XCTAssertTrue(ActivityFilter(dateRange: .today).isActive)
    }

    // MARK: - View construction (exercises every section's control branch)

    func testSheetConstructsForDefaultAndPopulatedSelections() {
        for filter in [ActivityFilter(), ActivityFilter(statusIds: ["pending"], sort: .newest, dateRange: .week)] {
            let sheet = ActivityFilterSheet(
                statusOptions: statusOptions,
                filter: filter,
                onApply: { _ in },
                onClose: {}
            )
            _ = UIHostingController(rootView: sheet)
        }
    }

    func testSheetConstructsWithStatusSectionOmitted() {
        let sheet = ActivityFilterSheet(
            statusOptions: [],
            sortOptions: ActivitySortOrder.timeOnly,
            filter: ActivityFilter(),
            onApply: { _ in },
            onClose: {}
        )
        _ = UIHostingController(rootView: sheet)
    }
}
