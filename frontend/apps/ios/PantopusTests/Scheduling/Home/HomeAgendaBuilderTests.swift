//
//  HomeAgendaBuilderTests.swift
//  PantopusTests
//
//  Stream I10 — pure projection tests for the shared agenda builder:
//  booking-union tagging (source:'booking' → isBooking + status + bookingId),
//  the member filter, and the relative day headers.
//

import XCTest
@testable import Pantopus

@MainActor
final class HomeAgendaBuilderTests: XCTestCase {
    /// Sunday 2025-10-12 12:00 UTC.
    private static let now: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: "2025-10-12T12:00:00Z") ?? Date(timeIntervalSince1970: 1_760_270_400)
    }()

    private static let cal = HomeCalendarViewModel.utcCalendar
    // swiftlint:disable:next force_unwrapping
    private static let tz = TimeZone(identifier: "UTC")!

    private func event(
        id: String,
        type: String = "chore",
        title: String = "Event",
        start: String,
        assigned: [String]? = nil,
        source: String? = nil,
        bookingStatus: String? = nil,
        bookingId: String? = nil
    ) -> CalendarEventDTO {
        CalendarEventDTO(
            id: id,
            homeId: "home-1",
            eventType: type,
            title: title,
            startAt: start,
            assignedTo: assigned,
            source: source,
            bookingStatus: bookingStatus,
            bookingId: bookingId
        )
    }

    private let members: [String: HomeMember] = [
        "u1": HomeMember(id: "u1", name: "Maria Patel"),
        "u2": HomeMember(id: "u2", name: "David Patel")
    ]

    func testBookingRowProjectsAsBookingWithStatusAndId() {
        let events = [
            event(
                id: "b1",
                title: "Driveway cleaning",
                start: "2025-10-12T17:00:00Z",
                source: "booking",
                bookingStatus: "confirmed",
                bookingId: "bk-9"
            )
        ]
        let sections = HomeAgendaBuilder.sections(
            events: events,
            members: members,
            now: Self.now,
            calendar: Self.cal,
            timeZone: Self.tz,
            selectedIsoDate: nil
        )
        let item = sections.flatMap(\.items).first
        XCTAssertEqual(item?.id, "b1")
        XCTAssertTrue(item?.isBooking == true)
        XCTAssertEqual(item?.bookingStatus, "confirmed")
        XCTAssertEqual(item?.bookingId, "bk-9")
        // Booking rows are render-only — they never expose a home-event id.
        XCTAssertNil(item?.eventId)
    }

    func testNormalRowProjectsWithEventIdAndAssignees() {
        let events = [
            event(id: "e1", start: "2025-10-12T18:00:00Z", assigned: ["u1", "u2"])
        ]
        let item = HomeAgendaBuilder.sections(
            events: events,
            members: members,
            now: Self.now,
            calendar: Self.cal,
            timeZone: Self.tz,
            selectedIsoDate: nil
        )
        .flatMap(\.items)
        .first
        XCTAssertEqual(item?.eventId, "e1")
        XCTAssertFalse(item?.isBooking == true)
        XCTAssertEqual(item?.members.count, 2)
    }

    func testMemberFilterRestrictsToAssignee() {
        let events = [
            event(id: "e1", start: "2025-10-12T09:00:00Z", assigned: ["u1"]),
            event(id: "e2", start: "2025-10-12T10:00:00Z", assigned: ["u2"])
        ]
        let sections = HomeAgendaBuilder.sections(
            events: events,
            members: members,
            now: Self.now,
            calendar: Self.cal,
            timeZone: Self.tz,
            selectedIsoDate: nil,
            onlyUserId: "u1"
        )
        let ids = sections.flatMap(\.items).map(\.id)
        XCTAssertEqual(ids, ["e1"])
    }

    func testRelativeDayHeaders() {
        let events = [
            event(id: "t", start: "2025-10-12T09:00:00Z"),
            event(id: "tm", start: "2025-10-13T09:00:00Z"),
            event(id: "later", start: "2025-10-15T09:00:00Z")
        ]
        let headers = HomeAgendaBuilder.sections(
            events: events,
            members: members,
            now: Self.now,
            calendar: Self.cal,
            timeZone: Self.tz,
            selectedIsoDate: nil
        )
        .map(\.header)
        XCTAssertEqual(headers.count, 3)
        XCTAssertTrue(headers[0].hasPrefix("Today"))
        XCTAssertTrue(headers[1].hasPrefix("Tomorrow"))
        XCTAssertEqual(headers[2], "Wed Oct 15")
    }

    // MARK: - Date-only wire values (Postgres `date` columns)

    /// `home_bills.due_date` is a bare Postgres `date`, so the wire value is
    /// "YYYY-MM-DD" with no zone. Anchoring it at UTC midnight and then
    /// bucketing with a device-local calendar renders it a day early west of
    /// UTC — the caller must be able to anchor it in the display zone.
    func testBareDateAnchorsToMidnightInTheGivenDisplayZone() throws {
        let la = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        let anchored = try XCTUnwrap(
            HomeAgendaBuilder.parseInstant("2025-10-12", zone: la)
        )
        var laCal = Calendar(identifier: .gregorian)
        laCal.timeZone = la
        XCTAssertEqual(HomeAgendaBuilder.isoDay(anchored, calendar: laCal), "2025-10-12")
        // …and it really is LA midnight: 7 hours after the UTC-anchored value
        // the un-parameterised call still produces.
        let utcAnchored = try XCTUnwrap(HomeAgendaBuilder.parseInstant("2025-10-12"))
        XCTAssertEqual(anchored.timeIntervalSince(utcAnchored), 7 * 3600, accuracy: 1)
        XCTAssertEqual(HomeAgendaBuilder.isoDay(utcAnchored, calendar: laCal), "2025-10-11")
    }

    func testTimestampedValuesIgnoreTheDateOnlyZone() throws {
        let la = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        let zoned = HomeAgendaBuilder.parseInstant("2025-10-12T17:00:00Z", zone: la)
        XCTAssertEqual(zoned, HomeAgendaBuilder.parseInstant("2025-10-12T17:00:00Z"))
    }

    func testIsDateOnlyOnlyMatchesBareCalendarDates() {
        XCTAssertTrue(HomeAgendaBuilder.isDateOnly("2025-10-12"))
        XCTAssertFalse(HomeAgendaBuilder.isDateOnly("2025-10-12T17:00:00Z"))
        XCTAssertFalse(HomeAgendaBuilder.isDateOnly("2025-10-12T00:00:00.000Z"))
        XCTAssertFalse(HomeAgendaBuilder.isDateOnly("not-a-date"))
        XCTAssertFalse(HomeAgendaBuilder.isDateOnly(""))
    }

    /// Guard-rail for the other half of the contract: the all-day heuristic
    /// for *timestamped* events stays pinned to UTC (the wire stores all-day
    /// events at 00:00Z), no matter which zone the agenda displays in.
    func testEventAllDayHeuristicStaysUtcPinnedUnderALocalDisplayZone() throws {
        let la = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        var laCal = Calendar(identifier: .gregorian)
        laCal.timeZone = la
        laCal.firstWeekday = 1
        let item = HomeAgendaBuilder.sections(
            events: [event(id: "allday", start: "2025-10-14T00:00:00Z")],
            members: members,
            now: Self.now,
            calendar: laCal,
            timeZone: la,
            selectedIsoDate: nil
        )
        .flatMap(\.items)
        .first
        XCTAssertEqual(item?.time, "All day")
        XCTAssertEqual(item?.ampm, "")
    }

    func testPastEventsAreDroppedFromTheDefaultAgenda() {
        let events = [
            event(id: "yesterday", start: "2025-10-11T09:00:00Z"),
            event(id: "today", start: "2025-10-12T20:00:00Z")
        ]
        let ids = HomeAgendaBuilder.sections(
            events: events,
            members: members,
            now: Self.now,
            calendar: Self.cal,
            timeZone: Self.tz,
            selectedIsoDate: nil
        )
        .flatMap(\.items)
        .map(\.id)
        XCTAssertEqual(ids, ["today"])
    }
}
