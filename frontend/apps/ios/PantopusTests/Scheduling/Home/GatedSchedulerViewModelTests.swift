//
//  GatedSchedulerViewModelTests.swift
//  PantopusTests
//
//  Stream I10 — F15 permission-gated scheduler: 403 no-access, own-assignment
//  projection, Accept → RSVP, and the local access-request flag.
//

import XCTest
@testable import Pantopus

@MainActor
final class GatedSchedulerViewModelTests: XCTestCase {
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

    private func ephemeralDefaults() -> UserDefaults {
        // swiftlint:disable:next force_unwrapping
        UserDefaults(suiteName: "test-\(UUID().uuidString)")!
    }

    private func makeVM(defaults: UserDefaults? = nil) -> GatedSchedulerViewModel {
        let frozen = Self.fixedNow
        return GatedSchedulerViewModel(
            homeId: "home-1",
            api: makeAPI(),
            currentUserId: "u-me",
            now: { frozen },
            defaults: defaults ?? ephemeralDefaults()
        )
    }

    private static let eventsBody = """
    {"events":[
      {"id":"e1","home_id":"home-1","event_type":"visit",
       "title":"Let the plumber in","start_at":"2025-10-12T17:00:00Z",
       "assigned_to":["u-me"]},
      {"id":"e2","home_id":"home-1","event_type":"meal",
       "title":"Dinner","start_at":"2025-10-12T18:00:00Z","assigned_to":["u-other"]}
    ]}
    """

    private static let occupantsBody = """
    {"occupants":[
      {"id":"o1","user_id":"u-me","is_active":true,"display_name":"You"},
      {"id":"o2","user_id":"u-other","is_active":true,"display_name":"Dad"}
    ],"pendingInvites":[]}
    """

    func testForbiddenYieldsNoAccess() async {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events": [.status(403, body: "{\"error\":\"No access to this home\"}")]
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.phase, .noAccess)
    }

    func testLoadedBuildsOwnAssignments() async {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events": [.status(200, body: Self.eventsBody)],
            "/api/homes/home-1/occupants": [.status(200, body: Self.occupantsBody)]
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.phase, .loaded)
        XCTAssertEqual(vm.assignments.count, 1)
        XCTAssertEqual(vm.assignments.first?.id, "e1")
        // The rest of the schedule is read-only.
        XCTAssertEqual(vm.agendaSections.first?.header, "Rest of the schedule")
        XCTAssertEqual(vm.agendaSections.flatMap(\.items).map(\.id), ["e2"])
    }

    func testAcceptPostsRsvpAndClearsAssignment() async throws {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events": [.status(200, body: Self.eventsBody)],
            "/api/homes/home-1/occupants": [.status(200, body: Self.occupantsBody)]
        ]
        let vm = makeVM()
        await vm.load()
        let item = try XCTUnwrap(vm.assignments.first)
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1/rsvp":
                [.status(200, body: "{\"attendee\":{\"user_id\":\"u-me\",\"rsvp_status\":\"going\"}}")]
        ]
        await vm.accept(item)
        XCTAssertTrue(vm.assignments.isEmpty)
    }

    func testRequestAccessSetsAndPersistsFlag() {
        let defaults = ephemeralDefaults()
        let vm = makeVM(defaults: defaults)
        XCTAssertFalse(vm.requested)
        vm.requestAccess()
        XCTAssertTrue(vm.requested)
        // A fresh VM for the same home reads the persisted request.
        let vm2 = makeVM(defaults: defaults)
        XCTAssertTrue(vm2.requested)
    }
}
