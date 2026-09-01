//
//  CollectiveEventSetupViewModelTests.swift
//  PantopusTests
//
//  G2 · Stream I13. Verifies the collective master toggle ↔ assignment_mode,
//  seat-cap projection, member fold, and the save (PUT event-type + PUT
//  assignees). Route-keyed stubs.
//

import XCTest
@testable import Pantopus

@MainActor
final class CollectiveEventSetupViewModelTests: XCTestCase {
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

    private func vm(_ routes: [String: [SequencedURLProtocol.Response]]) -> CollectiveEventSetupViewModel {
        CollectiveEventSetupViewModel(owner: .business(id: "biz1"), eventTypeId: "et1", client: client(routes))
    }

    // swiftlint:disable:next line_length
    private let members = #"{"members":[{"id":"m1","user":{"id":"u1","name":"Tara Okafor"}},{"id":"m2","user":{"id":"u2","name":"Sam Whitfield"}}]}"#

    private func detail(mode: String, seatCap: Int, assignees: String) -> String {
        // swiftlint:disable:next line_length
        "{\"eventType\":{\"id\":\"et1\",\"name\":\"Consult\",\"slug\":\"consult\",\"durations\":[60],\"assignment_mode\":\"\(mode)\",\"seat_cap\":\(seatCap),\"is_active\":true},\"assignees\":\(assignees),\"questions\":[]}"
    }

    private func routes(_ detailJSON: String) -> [String: [SequencedURLProtocol.Response]] {
        [
            "/api/scheduling/event-types/et1": [.status(200, body: detailJSON)],
            "/api/businesses/biz1/members": [.status(200, body: members)],
            "/api/scheduling/event-types/et1/assignees": [.status(200, body: #"{"assignees":[]}"#)]
        ]
    }

    func testLoadOnProjectsCollective() async {
        let assignees = #"[{"id":"a1","subject_id":"u1","subject_type":"user"},{"id":"a2","subject_id":"u2","subject_type":"user"}]"#
        let model = vm(routes(detail(mode: "collective", seatCap: 2, assignees: assignees)))
        await model.load()
        XCTAssertEqual(model.phase, .ready)
        XCTAssertTrue(model.requireMultiple)
        XCTAssertEqual(model.seatsPerAppointment, 2)
        XCTAssertEqual(model.checkedCount, 2)
    }

    func testLoadOffWhenOneOnOne() async {
        let model = vm(routes(detail(mode: "one_on_one", seatCap: 1, assignees: "[]")))
        await model.load()
        XCTAssertFalse(model.requireMultiple)
    }

    func testStepperBounds() async {
        let model = vm(routes(detail(mode: "collective", seatCap: 1, assignees: "[]")))
        await model.load()
        model.decrementSeats()
        XCTAssertEqual(model.seatsPerAppointment, 1) // clamped at 1
        model.incrementSeats()
        XCTAssertEqual(model.seatsPerAppointment, 2)
    }

    func testSaveSucceeds() async {
        var r = routes(detail(mode: "collective", seatCap: 2, assignees: #"[{"id":"a1","subject_id":"u1","subject_type":"user"}]"#))
        r["/api/scheduling/event-types/et1"] = [
            .status(
                200,
                // swiftlint:disable:next line_length
                body: #"{"eventType":{"id":"et1","name":"Consult","slug":"consult","durations":[60],"assignment_mode":"collective","seat_cap":2,"is_active":true},"assignees":[],"questions":[]}"#
            ),
            .status(
                200,
                // swiftlint:disable:next line_length
                body: #"{"eventType":{"id":"et1","name":"Consult","slug":"consult","durations":[60],"assignment_mode":"collective","seat_cap":2,"is_active":true}}"#
            )
        ]
        let model = vm(r)
        await model.load()
        model.toggle("u2")
        let ok = await model.save()
        XCTAssertTrue(ok)
        XCTAssertNil(model.saveError)
    }
}
