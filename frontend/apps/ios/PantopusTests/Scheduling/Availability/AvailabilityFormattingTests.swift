//
//  AvailabilityFormattingTests.swift
//  PantopusTests
//
//  Stream I3 — pure-logic tests for the Availability formatting helpers.
//

import XCTest
@testable import Pantopus

final class AvailabilityFormattingTests: XCTestCase {
    // MARK: TimeOfDay

    func testTimeOfDayParsesHHMM() {
        let time = TimeOfDay("09:30")
        XCTAssertEqual(time?.hour, 9)
        XCTAssertEqual(time?.minute, 30)
        XCTAssertEqual(time?.hhmm, "09:30")
    }

    func testTimeOfDayParsesHHMMSS() {
        let time = TimeOfDay("17:00:45")
        XCTAssertEqual(time?.hour, 17)
        XCTAssertEqual(time?.minute, 0)
        XCTAssertEqual(time?.hhmm, "17:00")
    }

    func testTimeOfDayRejectsGarbage() {
        XCTAssertNil(TimeOfDay("not-a-time"))
        XCTAssertNil(TimeOfDay("99:99"))
        XCTAssertNil(TimeOfDay("9"))
    }

    func testTimeOfDayRoundTripsThroughDate() {
        let original = TimeOfDay(hour: 13, minute: 45)
        let restored = TimeOfDay(from: original.referenceDate())
        XCTAssertEqual(restored, original)
    }

    func testTimeRangeValidity() {
        XCTAssertTrue(TimeRange(start: .nineAM, end: .fivePM).isValid)
        XCTAssertFalse(TimeRange(start: .fivePM, end: .nineAM).isValid)
        XCTAssertFalse(TimeRange(start: .nineAM, end: .nineAM).isValid)
    }

    // MARK: Weekday

    func testWeekdayDisplayOrderIsMondayFirst() {
        XCTAssertEqual(Weekday.displayOrder, [1, 2, 3, 4, 5, 6, 0])
        XCTAssertEqual(Weekday.longName(1), "Monday")
        XCTAssertEqual(Weekday.shortName(0), "Sun")
        XCTAssertEqual(Weekday.shortName(6), "Sat")
    }

    // MARK: AvailabilitySummary

    func testSummaryCollapsesMonToFri() {
        let rules = [1, 2, 3, 4, 5].map { weekday in
            rule(weekday: weekday, start: "09:00", end: "17:00")
        }
        let summary = AvailabilitySummary.summarize(rules: rules)
        XCTAssertTrue(summary.hasPrefix("Mon–Fri, "), "got: \(summary)")
    }

    func testSummaryEmptyWhenNoRules() {
        XCTAssertEqual(AvailabilitySummary.summarize(rules: []), "No hours set")
    }

    func testSummaryVariesWhenDifferentWindows() {
        let rules = [
            rule(weekday: 1, start: "09:00", end: "17:00"),
            rule(weekday: 2, start: "10:00", end: "14:00")
        ]
        let summary = AvailabilitySummary.summarize(rules: rules)
        XCTAssertTrue(summary.contains("varies"), "got: \(summary)")
    }

    // MARK: OverrideFormatting

    func testOverrideDisplayDate() {
        // 2026-07-04 — assert the month/day portion regardless of weekday locale.
        XCTAssertTrue(OverrideFormatting.displayDate("2026-07-04").contains("Jul 4"))
    }

    func testOverrideSummaryUnavailable() {
        let dto = override(date: "2026-07-04", isUnavailable: true, start: nil, end: nil)
        XCTAssertEqual(OverrideFormatting.summary(for: dto), "Unavailable")
    }

    func testOverrideSummaryWindow() {
        let dto = override(date: "2026-08-01", isUnavailable: false, start: "10:00", end: "14:00")
        XCTAssertTrue(OverrideFormatting.summary(for: dto).contains("–"))
    }

    // MARK: USHolidays

    func testUSHolidaysHasElevenDays() {
        let holidays = USHolidays.forYear(2026)
        XCTAssertEqual(holidays.count, 11)
        let dates = Set(holidays.map(\.date))
        XCTAssertTrue(dates.contains("2026-07-04")) // Independence Day
        XCTAssertTrue(dates.contains("2026-12-25")) // Christmas
        XCTAssertTrue(dates.contains("2026-01-01")) // New Year's
    }

    func testUSHolidaysComputesFloatingDates() {
        // 2026: Thanksgiving is the 4th Thursday of November = Nov 26.
        let holidays = USHolidays.forYear(2026)
        XCTAssertTrue(holidays.contains { $0.date == "2026-11-26" }, "Thanksgiving should be 2026-11-26")
        // Memorial Day is the last Monday of May 2026 = May 25.
        XCTAssertTrue(holidays.contains { $0.date == "2026-05-25" }, "Memorial Day should be 2026-05-25")
    }

    // MARK: Fixtures

    private func rule(weekday: Int, start: String, end: String) -> AvailabilityRuleDTO {
        AvailabilityRuleDTO(id: nil, scheduleId: "s1", weekday: weekday, startTime: start, endTime: end)
    }

    private func override(date: String, isUnavailable: Bool, start: String?, end: String?) -> AvailabilityOverrideDTO {
        AvailabilityOverrideDTO(id: nil, scheduleId: "s1", date: date, isUnavailable: isUnavailable, startTime: start, endTime: end)
    }
}
