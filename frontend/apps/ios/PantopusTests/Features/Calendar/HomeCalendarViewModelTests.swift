//
//  HomeCalendarViewModelTests.swift
//  PantopusTests
//
//  T6.4c (P18) — Home calendar VM tests. Covers the four-state shell
//  transitions (load → loaded / empty / error), date-bucket
//  sectionization (TODAY / TOMORROW / day-name / NEXT WEEK / LATER),
//  the selectedDate filter the shell exposes via the month strip, the
//  month-strip dot count + today-pill derivation, and the per-row
//  category mapping (palette + chip + leading).
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class HomeCalendarViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    /// Sunday 2025-10-12 12:00 UTC — sits inside the design's example
    /// week (Sun Oct 12 → Sat Oct 18). Used everywhere so bucketing is
    /// stable across machines.
    private static let fixedNow: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: "2025-10-12T12:00:00Z") ?? Date(timeIntervalSince1970: 1_760_270_400)
    }()

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func makeVM(api: APIClient? = nil) -> HomeCalendarViewModel {
        let frozen = Self.fixedNow
        let now: @Sendable () -> Date = { frozen }
        // Pin UTC (production now defaults to the device-local calendar) so
        // the fixed-instant fixtures bucket deterministically on any machine.
        return HomeCalendarViewModel(
            homeId: "home-1",
            api: api ?? makeAPI(),
            now: now,
            calendar: HomeCalendarViewModel.utcCalendar,
            timeZone: TimeZone(identifier: "UTC") ?? .current
        )
    }

    /// Build one DTO for the given iso instant + type.
    private func event(
        id: String = "e",
        type: String = "general",
        title: String = "Untitled",
        start: String,
        end: String? = nil,
        location: String? = nil,
        rrule: String? = nil,
        attendees: [String]? = nil
    ) -> CalendarEventDTO {
        CalendarEventDTO(
            id: id,
            homeId: "home-1",
            eventType: type,
            title: title,
            startAt: start,
            endAt: end,
            locationNotes: location,
            recurrenceRule: rrule,
            assignedTo: attendees
        )
    }

    // MARK: - Four states

    func testLoadEmptyResponseRendersEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"events\":[]}")]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No events scheduled")
        XCTAssertEqual(content.ctaTitle, "Add event")
    }

    func testLoadErrorResponseRendersErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }

    func testLoadedResponseBuildsTodaySection() async {
        // 9 AM Sunday → Today bucket.
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"events":[
              {"id":"e1","home_id":"home-1","event_type":"trash",
               "title":"Trash & recycling out",
               "start_at":"2025-10-12T09:00:00Z",
               "end_at":"2025-10-12T09:15:00Z",
               "recurrence_rule":"FREQ=WEEKLY"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections[0].header, "Today")
        XCTAssertEqual(sections[0].rows.count, 1)
        XCTAssertEqual(sections[0].rows[0].title, "Trash & recycling out")
        // Leading tile carries the trash category palette.
        guard case let .typeIcon(icon, _, _) = sections[0].rows[0].leading else {
            XCTFail("Expected typeIcon leading")
            return
        }
        XCTAssertEqual(icon, .trash2)
    }

    // MARK: - Section bucketing (pure projection)

    func testMakeSectionsBucketsAcrossTodayTomorrowAndLater() {
        let cal = HomeCalendarViewModel.utcCalendar
        let parsed: [HomeCalendarViewModel.ParsedEvent] = [
            // Today 9am
            parsedEvent(id: "today1", type: "trash", start: "2025-10-12T09:00:00Z"),
            // Tomorrow 10am
            parsedEvent(id: "tom1", type: "maintenance", start: "2025-10-13T10:00:00Z"),
            // Tuesday — this-week
            parsedEvent(id: "tue1", type: "birthday", start: "2025-10-14T00:00:00Z"),
            // Friday — also this-week
            parsedEvent(id: "fri1", type: "school", start: "2025-10-17T16:00:00Z"),
            // Next Sunday — next-week
            parsedEvent(id: "nw1", type: "social", start: "2025-10-20T18:00:00Z"),
            // 21 days out — later
            parsedEvent(id: "lt1", type: "delivery", start: "2025-11-02T12:00:00Z")
        ]
        let sections = HomeCalendarViewModel.makeSections(
            events: parsed,
            now: Self.fixedNow,
            calendar: cal,
            selectedIsoDate: nil
        ) { _ in }
        let headers = sections.map(\.header)
        XCTAssertTrue(headers.contains("Today"))
        XCTAssertTrue(headers.contains("Tomorrow"))
        // Tuesday and Friday in this-week become per-day sections.
        XCTAssertTrue(headers.contains("Tue Oct 14"))
        XCTAssertTrue(headers.contains("Fri Oct 17"))
        XCTAssertTrue(headers.contains("Next week"))
        XCTAssertTrue(headers.contains("Later"))
    }

    func testMakeSectionsWithSelectedIsoEmitsOneDaySection() {
        let cal = HomeCalendarViewModel.utcCalendar
        let parsed: [HomeCalendarViewModel.ParsedEvent] = [
            parsedEvent(id: "tue1", type: "birthday", start: "2025-10-14T00:00:00Z"),
            parsedEvent(id: "tue2", type: "delivery", start: "2025-10-14T20:00:00Z"),
            parsedEvent(id: "fri1", type: "school", start: "2025-10-17T16:00:00Z")
        ]
        let filtered = parsed.filter { $0.isoDate == "2025-10-14" }
        let sections = HomeCalendarViewModel.makeSections(
            events: filtered,
            now: Self.fixedNow,
            calendar: cal,
            selectedIsoDate: "2025-10-14"
        ) { _ in }
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections[0].id, "day-2025-10-14")
        XCTAssertEqual(sections[0].header, "Tue Oct 14")
        XCTAssertEqual(sections[0].rows.count, 2)
    }

    // MARK: - selectedDate filter integration

    func testSelectingDayFiltersAgendaToThatDay() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"events":[
              {"id":"e1","home_id":"home-1","event_type":"trash",
               "title":"Trash","start_at":"2025-10-12T09:00:00Z"},
              {"id":"e2","home_id":"home-1","event_type":"birthday",
               "title":"Mom's birthday","start_at":"2025-10-14T00:00:00Z"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        // Sanity — both events are bucketed across two sections.
        guard case let .loaded(initialSections, _) = vm.state else {
            XCTFail("Expected initial loaded")
            return
        }
        XCTAssertEqual(initialSections.flatMap(\.rows).count, 2)

        // Tap Oct 14 → only one row in a single "Tue Oct 14" section.
        vm.selectDay(isoDate: "2025-10-14")
        guard case let .loaded(filteredSections, _) = vm.state else {
            XCTFail("Expected loaded after filter")
            return
        }
        XCTAssertEqual(filteredSections.count, 1)
        XCTAssertEqual(filteredSections[0].header, "Tue Oct 14")
        XCTAssertEqual(filteredSections[0].rows.count, 1)
        XCTAssertEqual(filteredSections[0].rows[0].id, "e2")
        XCTAssertEqual(vm.monthStrip?.selectedIsoDate, "2025-10-14")

        // Tap the same day again — clears the filter.
        vm.selectDay(isoDate: "2025-10-14")
        guard case let .loaded(unfilteredSections, _) = vm.state else {
            XCTFail("Expected loaded after un-filter")
            return
        }
        XCTAssertEqual(unfilteredSections.flatMap(\.rows).count, 2)
        XCTAssertNil(vm.monthStrip?.selectedIsoDate)
    }

    func testSelectingDayWithNoEventsRendersEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"events":[
              {"id":"e1","home_id":"home-1","event_type":"trash",
               "title":"Trash","start_at":"2025-10-12T09:00:00Z"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectDay(isoDate: "2025-10-16") // Thursday — no events
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "Nothing on this day")
    }

    func testJumpToTodayClearsSelectionAndRehighlightsToday() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"events":[
              {"id":"e1","home_id":"home-1","event_type":"trash",
               "title":"Trash","start_at":"2025-10-12T09:00:00Z"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectDay(isoDate: "2025-10-14")
        XCTAssertEqual(vm.monthStrip?.selectedIsoDate, "2025-10-14")
        vm.jumpToToday()
        XCTAssertNil(vm.monthStrip?.selectedIsoDate)
        XCTAssertEqual(vm.monthStrip?.todayIsoDate, "2025-10-12")
    }

    // MARK: - Month strip derivation

    func testMonthStripDotsCountPerDay() async {
        // 3 dots Sunday, 1 dot Monday, 2 dots Tuesday, 0 elsewhere.
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"events":[
              {"id":"e1","home_id":"home-1","event_type":"trash","title":"a",
               "start_at":"2025-10-12T09:00:00Z"},
              {"id":"e2","home_id":"home-1","event_type":"family","title":"b",
               "start_at":"2025-10-12T16:00:00Z"},
              {"id":"e3","home_id":"home-1","event_type":"social","title":"c",
               "start_at":"2025-10-12T18:30:00Z"},
              {"id":"e4","home_id":"home-1","event_type":"maintenance","title":"d",
               "start_at":"2025-10-13T10:00:00Z"},
              {"id":"e5","home_id":"home-1","event_type":"birthday","title":"e",
               "start_at":"2025-10-14T00:00:00Z"},
              {"id":"e6","home_id":"home-1","event_type":"delivery","title":"f",
               "start_at":"2025-10-14T20:00:00Z"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard let strip = vm.monthStrip else {
            XCTFail("Expected month strip state")
            return
        }
        XCTAssertEqual(strip.monthLabel, "October 2025")
        XCTAssertEqual(strip.days.count, 7)
        XCTAssertEqual(strip.days[0].id, "2025-10-12")
        // Design uses single-letter weekday initials (EEEEE) in the month strip.
        XCTAssertEqual(strip.days[0].dayOfWeek, "S")
        XCTAssertEqual(strip.days[0].eventCount, 3)
        XCTAssertEqual(strip.days[1].eventCount, 1)
        XCTAssertEqual(strip.days[2].eventCount, 2)
        XCTAssertEqual(strip.days[3].eventCount, 0)
        // Today flag points at Sunday Oct 12 — no selection yet.
        XCTAssertEqual(strip.todayIsoDate, "2025-10-12")
        XCTAssertNil(strip.selectedIsoDate)
    }

    func testShiftWeekRollsAnchorBySevenDays() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"events\":[]}")]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.monthStrip?.days.first?.id, "2025-10-12")
        vm.shiftWeek(.next)
        XCTAssertEqual(vm.monthStrip?.days.first?.id, "2025-10-19")
        vm.shiftWeek(.previous)
        vm.shiftWeek(.previous)
        XCTAssertEqual(vm.monthStrip?.days.first?.id, "2025-10-05")
    }

    // MARK: - Row mapping

    func testRowProjectionUsesCategoryPaletteAndChip() throws {
        let cal = HomeCalendarViewModel.utcCalendar
        let dto = event(
            id: "soccer",
            type: "family",
            title: "Soccer game · Ava",
            start: "2025-10-12T16:00:00Z",
            end: "2025-10-12T17:30:00Z",
            location: "Riverside Field 3",
            attendees: ["m1", "m2", "m3"]
        )
        let parsed = try HomeCalendarViewModel.ParsedEvent(
            dto: dto,
            start: XCTUnwrap(HomeCalendarViewModel.parseIsoInstant("2025-10-12T16:00:00Z")),
            isoDate: "2025-10-12"
        )
        let row = HomeCalendarViewModel.row(for: parsed, calendar: cal) { _ in }
        XCTAssertEqual(row.title, "Soccer game · Ava")
        guard case let .typeIcon(icon, _, _) = row.leading else {
            XCTFail("Expected typeIcon leading")
            return
        }
        XCTAssertEqual(icon, .usersRound)
        XCTAssertEqual(row.timeMeta, "4:00 PM")
        // Two chips: category + attendees.
        XCTAssertEqual(row.chips?.count, 2)
        XCTAssertEqual(row.chips?.first?.text, "Family")
        XCTAssertEqual(row.chips?.last?.text, "3 attendees")
    }

    // MARK: - Derived due-date rows

    /// A derived row's visual identity comes from `HomeCalendarDerivedKind`'s
    /// own label / icon / background / foreground — the documented
    /// cross-platform palette (tasks = warning, bills = error, deliveries =
    /// business). Routing it through `CalendarEventCategory` instead paints an
    /// unpaid bill in the "paid / ok" green.
    func testDerivedRowUsesTheDerivedKindPaletteNotTheEventCategory() throws {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        let item = HomeCalendarDerivedItem(
            id: "bill-b1",
            kind: .bill,
            title: "PG&E bill due",
            detail: nil,
            dateISO: "2025-10-12"
        )
        let start = try XCTUnwrap(
            HomeCalendarViewModel.parseIsoInstant("2025-10-12", zone: cal.timeZone)
        )
        let row = HomeCalendarViewModel.derivedRow(item, start: start, calendar: cal)

        XCTAssertEqual(row.title, "PG&E bill due")
        // Null detail falls back to the type label on its own line — never
        // appended to the (single-line) title.
        XCTAssertEqual(row.subtitle, HomeCalendarDerivedKind.bill.label)
        guard case let .typeIcon(icon, background, foreground) = row.leading else {
            XCTFail("Expected typeIcon leading, got \(row.leading)")
            return
        }
        XCTAssertEqual(icon, HomeCalendarDerivedKind.bill.icon)
        XCTAssertEqual(background, HomeCalendarDerivedKind.bill.background)
        XCTAssertEqual(foreground, HomeCalendarDerivedKind.bill.foreground)
        XCTAssertNotEqual(foreground, CalendarEventCategory.bill.foreground)
        XCTAssertEqual(row.chips?.first?.text, HomeCalendarDerivedKind.bill.label)
        // Bare `yyyy-MM-dd` values have no clock time — the row must not read
        // "12:00 AM" once the date is anchored to local midnight.
        XCTAssertEqual(row.timeMeta, "All day")
    }

    /// Derived rows that DO carry a real timestamp keep their clock time.
    func testDerivedRowKeepsTheClockTimeForTimestampedDueDates() throws {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        let item = HomeCalendarDerivedItem(
            id: "task-t1",
            kind: .task,
            title: "Change filters",
            detail: "In progress",
            dateISO: "2025-10-13T17:00:00Z"
        )
        let start = try XCTUnwrap(HomeCalendarViewModel.parseIsoInstant(item.dateISO))
        let row = HomeCalendarViewModel.derivedRow(item, start: start, calendar: cal)
        XCTAssertEqual(row.timeMeta, "10:00 AM")
        XCTAssertEqual(row.subtitle, "In progress")
    }

    func testCategoryInferenceFallsBackToGenericForUnknownType() {
        XCTAssertEqual(CalendarEventCategory.from(eventType: "qq_unknown"), .generic)
        XCTAssertEqual(CalendarEventCategory.from(eventType: nil), .generic)
        // Heuristic substrings.
        XCTAssertEqual(CalendarEventCategory.from(eventType: "vet_visit"), .pet)
        XCTAssertEqual(CalendarEventCategory.from(eventType: "trash_day"), .trash)
        XCTAssertEqual(CalendarEventCategory.from(eventType: "birthday_party"), .birthday)
        // Exact-match table.
        XCTAssertEqual(CalendarEventCategory.from(eventType: "delivery"), .delivery)
        XCTAssertEqual(CalendarEventCategory.from(eventType: "general"), .generic)
    }

    // MARK: - Banner summary

    func testSummarizeCountsEventsInTheActiveWeek() {
        let cal = HomeCalendarViewModel.utcCalendar
        let events: [HomeCalendarViewModel.ParsedEvent] = [
            parsedEvent(id: "today1", type: "trash", start: "2025-10-12T09:00:00Z"),
            parsedEvent(id: "tom1", type: "maintenance", start: "2025-10-13T10:00:00Z"),
            parsedEvent(id: "tue1", type: "birthday", start: "2025-10-14T00:00:00Z"),
            // Just outside this-week (next Sunday) — should NOT count.
            parsedEvent(id: "nextweek", type: "social", start: "2025-10-19T19:00:00Z")
        ]
        let summary = HomeCalendarViewModel.summarize(
            events: events,
            now: Self.fixedNow,
            calendar: cal
        )
        XCTAssertEqual(summary.count, 3)
        XCTAssertNotNil(summary.nextLabel)
    }

    // MARK: - Helpers

    private func parsedEvent(
        id: String,
        type: String,
        start: String,
        title: String = "x"
    ) -> HomeCalendarViewModel.ParsedEvent {
        let dto = event(id: id, type: type, title: title, start: start)
        let date = HomeCalendarViewModel.parseIsoInstant(start) ?? Date()
        let cal = HomeCalendarViewModel.utcCalendar
        return HomeCalendarViewModel.ParsedEvent(
            dto: dto,
            start: date,
            isoDate: HomeCalendarViewModel.isoDay(date, calendar: cal)
        )
    }
}
