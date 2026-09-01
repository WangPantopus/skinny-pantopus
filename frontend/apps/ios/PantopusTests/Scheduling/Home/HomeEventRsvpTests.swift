//
//  HomeEventRsvpTests.swift
//  PantopusTests
//
//  Stream I10 — Home event detail RSVP: optimistic flip + persist, and
//  revert-on-failure.
//

import XCTest
@testable import Pantopus

@MainActor
final class HomeEventRsvpTests: XCTestCase {
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

    private static let detailBody = """
    {"event":
      {"id":"e1","home_id":"home-1","event_type":"meal",
       "title":"Family dinner","start_at":"2025-10-12T18:00:00Z",
       "assigned_to":["u1","u9"],"request_rsvp":true},
     "attendees":[{"user_id":"u1","rsvp_status":"going"}]}
    """

    private static let occupantsBody = """
    {"occupants":[
      {"id":"o1","user_id":"u1","is_active":true,"display_name":"Maria"},
      {"id":"o9","user_id":"u9","is_active":true,"display_name":"You"}
    ],"pendingInvites":[]}
    """

    private func loadedVM() async -> EventDetailViewModel {
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1": [.status(200, body: Self.detailBody)],
            "/api/homes/home-1/occupants": [.status(200, body: Self.occupantsBody)]
        ]
        let vm = EventDetailViewModel(homeId: "home-1", eventId: "e1", api: makeAPI(), currentUserId: "u9")
        await vm.load()
        return vm
    }

    func testInitialMyRsvpIsNilForUnrepliedMember() async {
        let vm = await loadedVM()
        XCTAssertNil(vm.myRsvp)
        // The existing attendee row still reflects their reply.
        XCTAssertEqual(vm.rsvp(for: "u1"), .going)
    }

    func testSetRsvpOptimisticallyFlipsAndPersists() async {
        let vm = await loadedVM()
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1/rsvp":
                [.status(200, body: "{\"attendee\":{\"user_id\":\"u9\",\"rsvp_status\":\"going\"}}")]
        ]
        await vm.setRsvp(.going)
        XCTAssertEqual(vm.myRsvp, .going)
        XCTAssertFalse(vm.rsvpSaving)
    }

    func testSetRsvpRevertsOnFailure() async {
        let vm = await loadedVM()
        SequencedURLProtocol.routeResponses = [
            "/api/homes/home-1/events/e1/rsvp": [.status(500, body: "{\"error\":\"nope\"}")]
        ]
        await vm.setRsvp(.cant)
        // Reverted — the member is back to no reply.
        XCTAssertNil(vm.myRsvp)
    }
}
