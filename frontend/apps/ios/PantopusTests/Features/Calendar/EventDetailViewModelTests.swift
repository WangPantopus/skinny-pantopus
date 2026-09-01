//
//  EventDetailViewModelTests.swift
//  PantopusTests
//
//  P2.7 — Read-only Event detail VM tests. Covers four-state shell
//  transitions (loading → loaded / error / not-found), the attendee
//  name lookup, and the DELETE happy path.
//

import XCTest
@testable import Pantopus

@MainActor
final class EventDetailViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func makeVM(onDeleted: @escaping @Sendable () -> Void = {}) -> EventDetailViewModel {
        EventDetailViewModel(
            homeId: "home-1",
            eventId: "e1",
            api: makeAPI(),
            onDeleted: onDeleted
        )
    }

    /// Stream I10: the VM now fetches the single-event detail endpoint, which
    /// returns the event + per-attendee RSVP rows.
    private static let detailBody = """
    {"event":
      {"id":"e1","home_id":"home-1","event_type":"social",
       "title":"Soccer game · Ava",
       "description":"Bring water",
       "start_at":"2025-10-12T16:00:00Z",
       "end_at":"2025-10-12T17:30:00Z",
       "location_notes":"Riverside Field 3",
       "recurrence_rule":"FREQ=WEEKLY",
       "assigned_to":["u1","u3"],
       "alerts_enabled":true,
       "request_rsvp":true},
     "attendees":[
       {"user_id":"u1","rsvp_status":"going"},
       {"user_id":"u3","rsvp_status":"maybe"}
     ]}
    """

    private static let occupantsBody = """
    {"occupants":[
      {"id":"o1","user_id":"u1","is_active":true,"display_name":"Maria Patel"},
      {"id":"o2","user_id":"u2","is_active":true,"display_name":"John Patel"},
      {"id":"o3","user_id":"u3","is_active":true,"display_name":"Ava Patel"}
    ],"pendingInvites":[]}
    """

    func testInitialStateIsLoading() {
        let vm = makeVM()
        guard case .loading = vm.state else {
            XCTFail("Expected .loading, got \(vm.state)")
            return
        }
    }

    func testLoadSuccessHydratesEventAndAttendeeNames() async {
        // The VM kicks off the events GET and occupants GET in parallel.
        // SequencedURLProtocol is FIFO — order matters for assertion but
        // not for behaviour as long as both succeed.
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1": [.status(200, body: Self.detailBody)],
            "/api/homes/home-1/occupants": [.status(200, body: Self.occupantsBody)]
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(event) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(event.id, "e1")
        XCTAssertEqual(event.title, "Soccer game · Ava")
        XCTAssertEqual(vm.attendeeNames["u1"], "Maria Patel")
        XCTAssertEqual(vm.attendeeNames["u3"], "Ava Patel")
    }

    func testLoadErrorOnEventsList() async {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1": [.status(500, body: "{\"error\":\"boom\"}")],
            "/api/homes/home-1/occupants": [.status(200, body: Self.occupantsBody)]
        ]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    func testLoadEventNotFoundSurfacesFriendlyError() async {
        // Stream I10: the single-event endpoint 404s when the event is gone.
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1": [.status(404, body: "{\"error\":\"not found\"}")],
            "/api/homes/home-1/occupants": [.status(200, body: Self.occupantsBody)]
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .error(message) = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
        XCTAssertFalse(message.isEmpty)
    }

    func testDeleteSuccessTriggersOnDeleted() async {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1": [.status(200, body: Self.detailBody)],
            "/api/homes/home-1/occupants": [.status(200, body: Self.occupantsBody)]
        ]
        let didDelete = expectation(description: "delete callback fired")
        let vm = makeVM { didDelete.fulfill() }
        await vm.load()
        // Add the DELETE response after load drained the GET stubs.
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1": [.status(200, body: "")]
        ]
        let ok = await vm.delete()
        XCTAssertTrue(ok)
        await fulfillment(of: [didDelete], timeout: 1)
    }

    func testDeleteFailureRecordsErrorAndPreservesState() async {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1": [.status(200, body: Self.detailBody)],
            "/api/homes/home-1/occupants": [.status(200, body: Self.occupantsBody)]
        ]
        let vm = makeVM()
        await vm.load()
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1": [.status(500, body: "{\"error\":\"nope\"}")]
        ]
        let ok = await vm.delete()
        XCTAssertFalse(ok)
        XCTAssertNotNil(vm.deleteError)
        guard case .loaded = vm.state else {
            XCTFail("State should still be .loaded after a failed delete")
            return
        }
    }

    func testReplaceLoadedEventSwapsInPlace() async {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1": [.status(200, body: Self.detailBody)],
            "/api/homes/home-1/occupants": [.status(200, body: Self.occupantsBody)]
        ]
        let vm = makeVM()
        await vm.load()
        let updated = CalendarEventDTO(
            id: "e1",
            homeId: "home-1",
            eventType: "social",
            title: "Renamed",
            startAt: "2025-10-12T16:00:00Z"
        )
        vm.replaceLoadedEvent(updated)
        guard case let .loaded(event) = vm.state else {
            XCTFail("Expected .loaded after replace")
            return
        }
        XCTAssertEqual(event.title, "Renamed")
    }
}
