//
//  HomeCalendarBookingUnionTests.swift
//  PantopusTests
//
//  Stream I10 — Home calendar booking-union + member filter behaviour on the
//  (extended) HomeCalendarViewModel, plus the derived task / bill / package
//  due-date feed folded into the same agenda (read-only rows, own palette,
//  visible under every member filter, date-only values anchored locally).
//

import XCTest
@testable import Pantopus

@MainActor
final class HomeCalendarBookingUnionTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

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

    private func makeVM() -> HomeCalendarViewModel {
        let frozen = Self.fixedNow
        // NB: pass `now:` as a *labelled* argument. The unlabelled trailing
        // closure form `… makeAPI()) { frozen }` binds (via deprecated
        // backward matching) to `onAddEvent`, NOT `now`, leaving the clock at
        // the real `Date()` — which buckets the 2025-10-12 fixtures into the
        // past so the agenda comes back empty.
        let now: @Sendable () -> Date = { frozen }
        // Pin UTC (production now defaults to the device-local calendar) so
        // the 2025-10-12 fixtures bucket deterministically on any machine.
        return HomeCalendarViewModel(
            homeId: "home-1",
            api: makeAPI(),
            now: now,
            calendar: HomeCalendarViewModel.utcCalendar,
            timeZone: TimeZone(identifier: "UTC") ?? .current
        )
    }

    private static let bookingBody = """
    {"events":[
      {"id":"bk-1","home_id":"home-1","event_type":"appointment",
       "title":"Plumber visit","start_at":"2025-10-12T17:00:00Z",
       "source":"booking","booking_status":"pending","booking_id":"bk-1"}
    ]}
    """

    private static let twoMembersBody = """
    {"events":[
      {"id":"e1","home_id":"home-1","event_type":"chore",
       "title":"Trash","start_at":"2025-10-12T09:00:00Z","assigned_to":["u1"]},
      {"id":"e2","home_id":"home-1","event_type":"meal",
       "title":"Dinner","start_at":"2025-10-12T18:00:00Z","assigned_to":["u2"]}
    ]}
    """

    private static let occupantsBody = """
    {"occupants":[
      {"id":"o1","user_id":"u1","is_active":true,"display_name":"Maria Patel"},
      {"id":"o2","user_id":"u2","is_active":true,"display_name":"David Patel"}
    ],"pendingInvites":[]}
    """

    func testBookingRowDeepLinksToBookingDetail() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: Self.bookingBody)]
        let vm = makeVM()
        await vm.load()
        let booking = vm.agendaSections.flatMap(\.items).first { $0.isBooking }
        let item = try XCTUnwrap(booking)
        XCTAssertEqual(item.bookingStatus, "pending")
        vm.openAgendaItem(item)
        guard case let .bookingDetail(owner, bookingId) = vm.presentedRoute?.route else {
            XCTFail("Expected a bookingDetail route, got \(String(describing: vm.presentedRoute?.route))")
            return
        }
        XCTAssertEqual(bookingId, "bk-1")
        guard case let .home(homeId) = owner else {
            XCTFail("Expected a home owner context")
            return
        }
        XCTAssertEqual(homeId, "home-1")
    }

    func testMemberFilterRestrictsAgendaAndClearResets() async {
        // Sequential fetch: events first, occupants second.
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoMembersBody),
            .status(200, body: Self.occupantsBody)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.agendaSections.flatMap(\.items).count, 2)

        vm.selectFilter(.member(id: "u1", name: "Maria Patel"))
        let ids = vm.agendaSections.flatMap(\.items).map(\.id)
        XCTAssertEqual(ids, ["e1"])

        vm.clearMemberFilter()
        XCTAssertEqual(vm.memberFilter, .all)
        XCTAssertEqual(vm.agendaSections.flatMap(\.items).count, 2)
        XCTAssertNil(vm.agendaEmpty)
    }

    func testFilterWithNoMatchesYieldsFilteredEmpty() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.twoMembersBody),
            .status(200, body: Self.occupantsBody)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectFilter(.member(id: "u2", name: "David Patel"))
        // u2 only has the evening dinner — still one row.
        XCTAssertEqual(vm.agendaSections.flatMap(\.items).map(\.id), ["e2"])

        // A member id with no events → filtered-empty.
        vm.selectFilter(.member(id: "ghost", name: "Nobody"))
        XCTAssertTrue(vm.agendaSections.isEmpty)
        XCTAssertEqual(vm.agendaEmpty, .filteredMember(name: "Nobody"))
    }

    // MARK: - Derived task / bill / package due dates

    /// 11:00 AM Sunday 2025-10-12 in America/Los_Angeles (18:00Z). Sitting west
    /// of UTC is the whole point: a bare "2025-10-12" due date anchored at UTC
    /// midnight is 5 PM on Oct 11 locally, so it both renders a day early and
    /// falls behind `todayStart`.
    private static let laNow: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: "2025-10-12T18:00:00Z") ?? Date(timeIntervalSince1970: 1_760_292_000)
    }()

    private static let losAngeles = TimeZone(identifier: "America/Los_Angeles") ?? .current

    private static var losAngelesCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = losAngeles
        cal.firstWeekday = 1 // Sunday — matches the design's week strip.
        return cal
    }

    /// One home event today, plus the three derived feeds. The bill's
    /// `due_date` is a bare Postgres `date` (no zone on the wire); the task's
    /// `due_at` is a real timestamp; the task status is empty so the row has to
    /// fall back to its kind label.
    private static let eventsWithAssigneeBody = """
    {"events":[
      {"id":"e1","home_id":"home-1","event_type":"chore",
       "title":"Trash","start_at":"2025-10-12T21:00:00Z","assigned_to":["u1"]}
    ]}
    """

    private static let billsBody = """
    {"bills":[
      {"id":"b1","home_id":"home-1","bill_type":"electric",
       "provider_name":"PG&E","amount":"142.80","currency":"USD",
       "due_date":"2025-10-12","status":"pending"}
    ]}
    """

    private static let tasksBody = """
    {"tasks":[
      {"id":"t1","home_id":"home-1","task_type":"chore","title":"Change filters",
       "due_at":"2025-10-13T17:00:00Z","status":""}
    ]}
    """

    private static let emptyPackagesBody = #"{"packages":[]}"#

    private func makeDerivedAPI() -> APIClient {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events": [.status(200, body: Self.eventsWithAssigneeBody)],
            "/api/homes/home-1/occupants": [.status(200, body: Self.occupantsBody)],
            "/api/homes/home-1/tasks": [.status(200, body: Self.tasksBody)],
            "/api/homes/home-1/bills": [.status(200, body: Self.billsBody)],
            "/api/homes/home-1/packages": [.status(200, body: Self.emptyPackagesBody)]
        ]
        return makeAPI()
    }

    /// Display zone = America/Los_Angeles, clock = today 11 AM local.
    private func makeLosAngelesVM() -> HomeCalendarViewModel {
        let frozen = Self.laNow
        let now: @Sendable () -> Date = { frozen }
        return HomeCalendarViewModel(
            homeId: "home-1",
            api: makeDerivedAPI(),
            now: now,
            calendar: Self.losAngelesCalendar,
            timeZone: Self.losAngeles
        )
    }

    /// Clause 8 — a bill due TODAY, west of UTC. Before the fix the bare
    /// "2025-10-12" parsed to 2025-10-12T00:00Z, which is Oct 11 5 PM in LA:
    /// the row bucketed onto the wrong day AND was dropped by the
    /// `date >= todayStart` window. It must land under Today and, having no
    /// clock time on the wire at all, read "All day" — not "12:00 AM".
    func testDateOnlyDueDateLandsOnTodayInTheDisplayZoneAndReadsAllDay() async throws {
        let vm = makeLosAngelesVM()
        await vm.load()

        let today = try XCTUnwrap(vm.agendaSections.first { $0.id == "2025-10-12" })
        XCTAssertTrue(
            today.header.hasPrefix("Today"),
            "Expected a Today header, got \(today.header)"
        )
        let bill = try XCTUnwrap(today.items.first { $0.id == "bill-b1" })
        XCTAssertEqual(bill.time, "All day")
        XCTAssertEqual(bill.ampm, "")

        // The month-strip dot has to agree with the section it links to.
        let dot = vm.monthStrip?.days.first { $0.id == "2025-10-12" }
        XCTAssertEqual(dot?.eventCount, 2, "One event + one bill due today")

        // …and the same anchoring reaches the `ListOfRowsState` projection.
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        let todayRows = try XCTUnwrap(sections.first { $0.header == "Today" }).rows
        let billRow = try XCTUnwrap(todayRows.first { $0.id == "bill-b1" })
        XCTAssertEqual(billRow.timeMeta, "All day")
    }

    /// Clause 6 + 7 — the row's identity comes from `HomeCalendarDerivedKind`,
    /// and the status / amount rides its own line instead of being appended to
    /// the single-line title.
    func testDerivedRowsCarryTheirOwnKindAndDetailLine() async throws {
        let vm = makeLosAngelesVM()
        await vm.load()
        let items = vm.agendaSections.flatMap(\.items)

        let bill = try XCTUnwrap(items.first { $0.id == "bill-b1" })
        XCTAssertEqual(bill.derived, .bill)
        XCTAssertEqual(bill.title, "PG&E bill due", "The amount must not ride the title")
        // Currency formatting is locale-dependent — pin that the amount is on
        // the detail line, not which symbol or separator it is rendered with.
        XCTAssertEqual(bill.subtitle?.contains("142"), true)
        XCTAssertNotEqual(bill.subtitle, HomeCalendarDerivedKind.bill.label)

        // A task with an empty status falls back to its kind label.
        let task = try XCTUnwrap(items.first { $0.id == "task-t1" })
        XCTAssertEqual(task.derived, .task)
        XCTAssertEqual(task.title, "Change filters")
        XCTAssertEqual(task.subtitle, HomeCalendarDerivedKind.task.label)
        // A real timestamp still renders a clock time.
        XCTAssertEqual(task.time, "10:00")
        XCTAssertEqual(task.ampm, "AM")
    }

    /// Clause 5 — derived rows are read-only. The row card renders them with no
    /// tap affordance at all, and the tap handler is inert.
    func testDerivedRowsAreReadOnlyAndNeverNavigate() async throws {
        let vm = makeLosAngelesVM()
        await vm.load()
        let bill = try XCTUnwrap(vm.agendaSections.flatMap(\.items).first { $0.id == "bill-b1" })
        XCTAssertNotNil(bill.derived)
        XCTAssertNil(bill.eventId)
        XCTAssertFalse(bill.isBooking)
        vm.openAgendaItem(bill)
        XCTAssertNil(vm.presentedRoute)
    }

    /// Clause 4 — derived rows carry no household owner, so every member-filter
    /// chip must keep showing them. Hiding them behind "All" is the
    /// empty-looking month the feed exists to prevent, and it contradicts the
    /// month strip, which counts its dots with no filter applied.
    func testDerivedRowsSurviveEveryMemberFilter() async {
        let vm = makeLosAngelesVM()
        await vm.load()
        XCTAssertEqual(
            Set(vm.agendaSections.flatMap(\.items).map(\.id)),
            ["e1", "bill-b1", "task-t1"]
        )

        // u1 owns the only event — derived rows ride along.
        vm.selectFilter(.member(id: "u1", name: "Maria Patel"))
        XCTAssertEqual(
            Set(vm.agendaSections.flatMap(\.items).map(\.id)),
            ["e1", "bill-b1", "task-t1"]
        )

        // u2 owns nothing — the derived rows are still all there, and the
        // agenda is therefore NOT empty.
        vm.selectFilter(.member(id: "u2", name: "David Patel"))
        XCTAssertEqual(
            Set(vm.agendaSections.flatMap(\.items).map(\.id)),
            ["bill-b1", "task-t1"]
        )
        XCTAssertNil(vm.agendaEmpty)

        // "Mine" is the same contract.
        vm.selectFilter(.mine)
        XCTAssertTrue(vm.agendaSections.flatMap(\.items).contains { $0.id == "bill-b1" })

        vm.clearMemberFilter()
        XCTAssertEqual(vm.agendaSections.flatMap(\.items).count, 3)
    }
}
