//
//  BookingsSupportTests.swift
//  PantopusTests
//
//  Stream I8 — the inbox/detail presentation helpers: relative day-section
//  bucketing, the owner pillar mapping, avatar initials, and tz-aware time
//  formatting (render local, compare UTC).
//

import XCTest
@testable import Pantopus

@MainActor
final class BookingsSupportTests: XCTestCase {
    private func iso(daysFromToday days: Int, hour: Int = 12) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: BookingsTime.displayTimeZone) ?? .current
        let base = cal.startOfDay(for: Date())
        let day = cal.date(byAdding: .day, value: days, to: base) ?? base
        let stamp = cal.date(byAdding: .hour, value: hour, to: day) ?? day
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: stamp)
    }

    func testDaySectionBuckets() {
        XCTAssertEqual(BookingDaySection.section(forStartUTC: iso(daysFromToday: 0)).title, "Today")
        XCTAssertEqual(BookingDaySection.section(forStartUTC: iso(daysFromToday: 1)).title, "Tomorrow")
        XCTAssertEqual(BookingDaySection.section(forStartUTC: iso(daysFromToday: 3)).title, "Later this week")
        XCTAssertEqual(BookingDaySection.section(forStartUTC: iso(daysFromToday: 30)).title, "Later")
        XCTAssertEqual(BookingDaySection.section(forStartUTC: iso(daysFromToday: -1)).title, "Yesterday")
    }

    func testDaySectionOrderAscendingForFuture() {
        let today = BookingDaySection.section(forStartUTC: iso(daysFromToday: 0)).order
        let tomorrow = BookingDaySection.section(forStartUTC: iso(daysFromToday: 1)).order
        XCTAssertLessThan(today, tomorrow)
    }

    func testRelativeWhenLeadsWithTodayForTodayBooking() {
        XCTAssertTrue(BookingsTime.relativeWhen(startUTC: iso(daysFromToday: 0)).hasPrefix("Today"))
    }

    func testTimeRangeUsesEnDash() {
        let start = iso(daysFromToday: 1, hour: 11)
        guard let startDate = SchedulingTime.parseUTC(start) else { return XCTFail("could not parse start") }
        // 45 minutes later.
        let end = ISO8601DateFormatter().string(from: startDate.addingTimeInterval(45 * 60))
        XCTAssertTrue(BookingsTime.timeRange(startUTC: start, endUTC: end).contains("–"))
    }

    func testDurationLabel() {
        let start = "2030-06-18T21:00:00Z"
        let end = "2030-06-18T21:45:00Z"
        XCTAssertEqual(BookingsTime.durationLabel(startUTC: start, endUTC: end), "45 min")
        XCTAssertNil(BookingsTime.durationLabel(startUTC: start, endUTC: nil))
    }

    func testPillarMapping() {
        XCTAssertEqual(BookingsPillar.label(forType: "home"), "Home")
        XCTAssertEqual(BookingsPillar.label(forType: "business"), "Business")
        XCTAssertEqual(BookingsPillar.label(forType: "user"), "Personal")
        XCTAssertEqual(BookingsPillar.label(forType: nil), "Personal")
        XCTAssertNotEqual(BookingsPillar.accent(forType: "business"), BookingsPillar.accent(forType: "user"))
    }

    func testReassignSupportByOwner() {
        XCTAssertFalse(BookingsPillar.supportsReassign(.personal))
        XCTAssertTrue(BookingsPillar.supportsReassign(.home(homeId: "h")))
        XCTAssertTrue(BookingsPillar.supportsReassign(.business(id: "b")))
    }

    func testInitials() {
        XCTAssertEqual(BookingsAvatar.initials(from: "Dana Whitfield"), "DW")
        XCTAssertEqual(BookingsAvatar.initials(from: "Mara"), "M")
        XCTAssertEqual(BookingsAvatar.initials(from: ""), "·")
        XCTAssertEqual(BookingsAvatar.initials(from: nil), "·")
    }

    func testStatusFilterMapsToBackendValue() {
        XCTAssertEqual(BookingStatusFilter.upcoming.rawValue, "upcoming")
        XCTAssertEqual(BookingStatusFilter.pending.rawValue, "pending")
        XCTAssertTrue(BookingStatusFilter.past.isDescending)
        XCTAssertFalse(BookingStatusFilter.upcoming.isDescending)
    }
}
