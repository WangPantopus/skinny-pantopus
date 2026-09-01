//
//  MemberWorkingHoursViewModelTests.swift
//  PantopusTests
//
//  G4 · Stream I13. Verifies the self-service week-hours editor: loads the
//  default schedule's rules from GET /availability, edits ranges, copy-to-
//  weekdays, saves rules, and the read-only teammate mode. Route-keyed stubs.
//

import XCTest
@testable import Pantopus

@MainActor
final class MemberWorkingHoursViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func client(_ routes: [String: [SequencedURLProtocol.Response]]) -> SchedulingClient {
        SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(routeResponses: routes), retryPolicy: .none))
    }

    // swiftlint:disable:next line_length
    private let availability = #"{"schedules":[{"id":"sched1","name":"Working hours","timezone":"America/Los_Angeles","is_default":true}],"rules":[{"schedule_id":"sched1","weekday":1,"start_time":"09:00","end_time":"17:00"}],"overrides":[]}"#

    private func editVM(_ routes: [String: [SequencedURLProtocol.Response]]) -> MemberWorkingHoursViewModel {
        MemberWorkingHoursViewModel(mode: .editSelf, client: client(routes))
    }

    func testReadOnlyModeReadyImmediately() async {
        let model = MemberWorkingHoursViewModel(mode: .readOnly(memberName: "Marisol"), client: client([:]))
        await model.load()
        XCTAssertEqual(model.phase, .ready)
        XCTAssertTrue(model.isReadOnly)
        XCTAssertEqual(model.title, "Marisol's booking hours")
        XCTAssertEqual(model.readOnlyMemberName, "Marisol")
    }

    func testEditSelfLoadsDefaultSchedule() async {
        let model = editVM(["/api/scheduling/availability": [.status(200, body: availability)]])
        await model.load()
        XCTAssertEqual(model.phase, .ready)
        XCTAssertEqual(model.scheduleId, "sched1")
        XCTAssertEqual(model.timezoneId, "America/Los_Angeles")
        XCTAssertEqual(model.title, "My booking hours")
        let monday = model.days.first { $0.weekday == 1 }
        XCTAssertEqual(monday?.ranges.count, 1)
        XCTAssertEqual(monday?.ranges.first?.start.hhmm, "09:00")
        XCTAssertTrue(model.formValid)
    }

    func testCopyMondayToWeekdays() async {
        let model = editVM(["/api/scheduling/availability": [.status(200, body: availability)]])
        await model.load()
        model.copyMondayToWeekdays()
        for weekday in [2, 3, 4, 5] {
            let day = model.days.first { $0.weekday == weekday }
            XCTAssertEqual(day?.ranges.count, 1, "weekday \(weekday) should inherit Monday")
            XCTAssertEqual(day?.ranges.first?.start.hhmm, "09:00")
        }
        // Weekend untouched.
        XCTAssertEqual(model.days.first { $0.weekday == 0 }?.ranges.isEmpty, true)
    }

    func testAddAndRemoveRange() async {
        let model = editVM(["/api/scheduling/availability": [.status(200, body: availability)]])
        await model.load()
        XCTAssertEqual(model.days.first { $0.weekday == 0 }?.ranges.isEmpty, true)
        model.addRange(weekday: 0)
        let added = model.days.first { $0.weekday == 0 }
        XCTAssertEqual(added?.ranges.count, 1)
        if let id = added?.ranges.first?.id {
            model.removeRange(weekday: 0, id: id)
        }
        XCTAssertEqual(model.days.first { $0.weekday == 0 }?.ranges.isEmpty, true)
    }

    func testSaveSucceeds() async {
        let model = editVM([
            "/api/scheduling/availability": [.status(200, body: availability)],
            "/api/scheduling/availability/sched1/rules": [
                .status(
                    200,
                    body: #"{"rules":[{"schedule_id":"sched1","weekday":1,"start_time":"09:00","end_time":"17:00"}]}"#
                )
            ]
        ])
        await model.load()
        let ok = await model.save()
        XCTAssertTrue(ok)
        XCTAssertNil(model.saveError)
    }

    /// A failed rules PUT must surface inline instead of silently leaving the
    /// sheet open with a stopped spinner.
    func testSaveFailureSurfacesError() async {
        let model = editVM([
            "/api/scheduling/availability": [.status(200, body: availability)],
            "/api/scheduling/availability/sched1/rules": [.status(500, body: #"{"error":"boom"}"#)]
        ])
        await model.load()
        let ok = await model.save()
        XCTAssertFalse(ok)
        XCTAssertNotNil(model.saveError)
    }

    /// Rules land, timezone PUT fails → partial-success copy (the hours ARE
    /// saved server-side; implying total failure invited stale re-edits).
    func testTimezoneFailureAfterRulesReportsPartialSuccess() async {
        let model = editVM([
            "/api/scheduling/availability": [.status(200, body: availability)],
            "/api/scheduling/availability/sched1/rules": [
                .status(200, body: #"{"rules":[]}"#)
            ],
            "/api/scheduling/availability/sched1": [.status(500, body: #"{"error":"boom"}"#)]
        ])
        await model.load()
        model.changeTimezone("America/New_York")
        let ok = await model.save()
        XCTAssertFalse(ok)
        XCTAssertEqual(model.saveError?.contains("hours were saved"), true)
    }

    func testEditSelfErrorWhenNoSchedule() async {
        let model = editVM(["/api/scheduling/availability": [.status(500, body: #"{"error":"boom"}"#)]])
        await model.load()
        guard case .error = model.phase else { return XCTFail("expected error phase") }
    }
}
