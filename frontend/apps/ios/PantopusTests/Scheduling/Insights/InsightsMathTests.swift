//
//  InsightsMathTests.swift
//  PantopusTests
//
//  Stream I17 — pure aggregation + filter/format logic (no networking).
//

import XCTest
@testable import Pantopus

final class InsightsMathTests: XCTestCase {
    // MARK: Filter → days / range

    func testPresetDays() {
        XCTAssertEqual(InsightsFilter(period: .last7).days(), 7)
        XCTAssertEqual(InsightsFilter(period: .last30).days(), 30)
        XCTAssertEqual(InsightsFilter(period: .last90).days(), 90)
    }

    func testCustomDaysIsInclusiveAndClamped() {
        let start = makeDate(2026, 6, 1)
        let end = makeDate(2026, 6, 10)
        let filter = InsightsFilter(period: .custom, customStart: start, customEnd: end)
        XCTAssertEqual(filter.days(), 10) // 9 days apart, inclusive → 10

        // Out-of-order start/end is normalized.
        let flipped = InsightsFilter(period: .custom, customStart: end, customEnd: start)
        XCTAssertEqual(flipped.days(), 10)

        // > 365 is clamped.
        let huge = InsightsFilter(period: .custom, customStart: makeDate(2020, 1, 1), customEnd: makeDate(2026, 1, 1))
        XCTAssertEqual(huge.days(), 365)
    }

    func testYearToDateIsBounded() {
        let now = makeDate(2026, 6, 15)
        let days = InsightsFilter(period: .yearToDate).days(now: now)
        XCTAssertGreaterThan(days, 150)
        XCTAssertLessThanOrEqual(days, 366)
    }

    func testChipLabelAndFilterCount() {
        XCTAssertEqual(InsightsFilter(period: .last30).chipLabel(), "Last 30 days")
        var filter = InsightsFilter(period: .last30)
        filter.eventTypeIds = ["a"]
        filter.memberIds = ["b", "c"]
        XCTAssertEqual(filter.activeFilterCount, 2)
    }

    // MARK: Formatting

    func testFormatting() {
        XCTAssertEqual(InsightsFormat.percent(12.6), "13%")
        XCTAssertEqual(InsightsFormat.percent(nil), "—")
        XCTAssertEqual(InsightsFormat.percent(fraction: 0.5), "50%")
        XCTAssertEqual(InsightsFormat.signedPercent(12), "+12%")
        XCTAssertEqual(InsightsFormat.signedPercent(-4), "-4%")
        XCTAssertNil(InsightsFormat.signedPercent(nil))
        XCTAssertEqual(InsightsFormat.duration(min: 30), "30 min")
        XCTAssertEqual(InsightsFormat.duration(min: 60), "1 hr")
        XCTAssertEqual(InsightsFormat.duration(min: 90), "1 hr 30 min")
        XCTAssertEqual(InsightsFormat.money(cents: 5000, currency: "USD"), "$50")
        XCTAssertNil(InsightsFormat.money(cents: 0))
    }

    // MARK: Breakdown

    func testBreakdownFractions() {
        let segments = InsightsMath.breakdown(completed: 6, cancelled: 2, noShow: 2)
        XCTAssertEqual(segments.count, 3)
        XCTAssertEqual(segments[0].kind, .honored)
        XCTAssertEqual(segments[0].count, 6)
        XCTAssertEqual(segments[0].fraction, 0.6, accuracy: 0.001)
        XCTAssertEqual(segments[2].kind, .noShow)
        XCTAssertEqual(segments[2].fraction, 0.2, accuracy: 0.001)
    }

    // MARK: Top event types

    func testTopEventTypesJoinsNamesRanksAndProportions() {
        let buckets = [
            InsightsSummary.EventTypeCount(eventTypeId: "et1", count: 8),
            InsightsSummary.EventTypeCount(eventTypeId: "et2", count: 4),
            InsightsSummary.EventTypeCount(eventTypeId: "et3", count: 2)
        ]
        let rows = InsightsMath.topEventTypes(byEventType: buckets, names: ["et1": "Intro", "et2": "Deep dive"], limit: 5)
        XCTAssertEqual(rows.count, 3)
        XCTAssertEqual(rows[0].rank, 1)
        XCTAssertEqual(rows[0].title, "Intro")
        XCTAssertEqual(rows[0].proportion, 1, accuracy: 0.001)
        XCTAssertEqual(rows[1].proportion, 0.5, accuracy: 0.001)
        // Unknown id falls back to a placeholder, never crashes.
        XCTAssertEqual(rows[2].title, "Untitled event type")
    }

    // MARK: Host rows + balance

    func testHostRowsSortAndBalance() {
        let hosts = [
            InsightsTeamReport.HostStat(hostUserId: "u1", total: 8, confirmed: 2, completed: 6, noShow: 1, cancelled: 1),
            InsightsTeamReport.HostStat(hostUserId: "u2", total: 4, confirmed: 1, completed: 2, noShow: 2, cancelled: 0)
        ]
        let names = ["u1": "Dana Reyes", "u2": "Marcus Lee"]

        let byBookings = InsightsMath.hostRows(hosts: hosts, names: names, sort: .bookings)
        XCTAssertEqual(byBookings.first?.id, "u1")
        XCTAssertEqual(byBookings.first?.name, "Dana Reyes")
        XCTAssertEqual(byBookings.first?.initials, "DR")
        XCTAssertEqual(byBookings.first?.share ?? 0, 8.0 / 12.0, accuracy: 0.001)

        let byNoShow = InsightsMath.hostRows(hosts: hosts, names: names, sort: .noShow)
        XCTAssertEqual(byNoShow.first?.id, "u2") // 50% no-show beats 12.5%

        XCTAssertEqual(InsightsMath.balanceLabel(byBookings), "Skewed toward Dana Reyes")
        XCTAssertEqual(InsightsMath.balanceLabel([]), "Only one member takes bookings")
    }

    func testRepeatOffenders() {
        let recent = [
            InsightsNoShowReport.RecentNoShow(bookingId: "1", startAt: nil, status: "no_show", inviteeName: "Sam", eventTypeId: nil),
            InsightsNoShowReport.RecentNoShow(bookingId: "2", startAt: nil, status: "no_show", inviteeName: "Sam", eventTypeId: nil),
            InsightsNoShowReport.RecentNoShow(bookingId: "3", startAt: nil, status: "no_show", inviteeName: "Ada", eventTypeId: nil)
        ]
        let repeats = InsightsMath.repeatOffenders(recent)
        XCTAssertTrue(repeats.contains("Sam"))
        XCTAssertFalse(repeats.contains("Ada"))
    }

    // MARK: Helpers

    private func makeDate(_ year: Int, _ month: Int, _ day: Int) -> Date {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        return Calendar.current.date(from: components) ?? Date()
    }
}
