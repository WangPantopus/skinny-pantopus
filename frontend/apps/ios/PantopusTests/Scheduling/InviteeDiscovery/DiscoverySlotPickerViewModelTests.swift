//
//  DiscoverySlotPickerViewModelTests.swift
//  PantopusTests
//
//  Stream I5 — C6 Date + Time Slot Picker view-model. Verifies the public
//  `…/:eventTypeSlug/slots` fetch always passes `tz` + `from`/`to`, maps slots
//  to the SlotPicker load states, and treats `status:'paused'` and 404 as
//  first-class (non-error / error) states.
//

import XCTest
@testable import Pantopus

@MainActor
final class DiscoverySlotPickerViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel(tz: String = "America/New_York", oneOffToken: String? = nil) -> DiscoverySlotPickerViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return DiscoverySlotPickerViewModel(
            slug: "ada",
            eventTypeSlug: "intro",
            tz: tz,
            oneOffToken: oneOffToken,
            push: { _ in },
            client: client
        )
    }

    private func slotsBody(slots: String, status: String = "active") -> String {
        """
        {"eventType":{"id":"et1","name":"Intro call","slug":"intro","default_duration":30,"location_mode":"video"},
        "timezone":"America/New_York","status":"\(status)","slots":[\(slots)]}
        """
    }

    /// load() first fetches GET /book/:slug for the host name + pillar; tests
    /// prepend this so the slots request that follows isn't starved.
    private func pageBody() -> String {
        #"{"page":{"slug":"ada","title":"Maria Kessler","owner_type":"user"},"status":"active","eventTypes":[]}"#
    }

    private func slotsRequest() -> URLRequest? {
        SequencedURLProtocol.capturedRequests.first { ($0.url?.path ?? "").contains("/slots") }
    }

    func testLoadsSlotsAndAlwaysPassesTzAndRange() async {
        let slot = #"{"start":"2030-07-01T16:00:00Z","end":"2030-07-01T16:30:00Z","startLocal":"2030-07-01T12:00:00"}"#
        SequencedURLProtocol.sequence = [.status(200, body: pageBody()), .status(200, body: slotsBody(slots: slot))]
        let viewModel = makeViewModel()
        await viewModel.load()

        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.eventType?.slug, "intro")
        XCTAssertFalse(viewModel.availableDays.isEmpty)
        XCTAssertEqual(viewModel.hostName, "Maria Kessler")

        let query = slotsRequest()?.url?.query ?? ""
        XCTAssertTrue(query.contains("tz="), "tz must always be passed on slot reads — query: \(query)")
        XCTAssertTrue(query.contains("from="), "from must be passed — query: \(query)")
        XCTAssertTrue(query.contains("to="), "to must be passed — query: \(query)")
        let url = slotsRequest()?.url?.absoluteString ?? ""
        XCTAssertTrue(url.contains("America"), "tz value must reach the wire — url: \(url)")
    }

    func testPausedSlotsMapToPausedPhase() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: pageBody()),
            .status(200, body: slotsBody(slots: "", status: "paused"))
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .paused)
    }

    func testEmptySlotsAreNoAvailabilityNotError() async {
        // page fetch + empty current month → load() scans forward then restores;
        // stub the page plus enough empties for the whole scan.
        SequencedURLProtocol.sequence =
            [.status(200, body: pageBody())]
                + Array(repeating: .status(200, body: slotsBody(slots: "")), count: 12)
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertTrue(viewModel.availableDays.isEmpty)
        XCTAssertEqual(viewModel.slotPickerState, .noAvailability)
    }

    func testAutoAdvancesToFirstMonthWithSlots() async {
        let slot = #"{"start":"2030-07-01T16:00:00Z","end":"2030-07-01T16:30:00Z","startLocal":"2030-07-01T12:00:00"}"#
        SequencedURLProtocol.sequence = [
            .status(200, body: pageBody()),
            .status(200, body: slotsBody(slots: "")), // current month: empty
            .status(200, body: slotsBody(slots: slot)) // next month: has availability
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertFalse(viewModel.availableDays.isEmpty, "load() should advance to the first month with open times")
    }

    func testNotFoundMapsToError() async {
        SequencedURLProtocol.sequence = [
            .status(404, body: #"{"error":"NOT_FOUND"}"#), // page fetch (ignored)
            .status(404, body: #"{"error":"NOT_FOUND"}"#) // slots
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .error = viewModel.phase else {
            return XCTFail("expected .error, got \(viewModel.phase)")
        }
    }

    func testOneOffTokenUsesTokenEndpoint() async {
        let slot = #"{"start":"2030-07-01T16:00:00Z","end":"2030-07-01T16:30:00Z","startLocal":"2030-07-01T12:00:00"}"#
        let body = #"{"eventType":{"id":"et1","name":"Intro","slug":"intro"},"single_use":true,"slots":[\#(slot)]}"#
        SequencedURLProtocol.sequence = [.status(200, body: pageBody()), .status(200, body: body)]
        let viewModel = makeViewModel(oneOffToken: "tok123")
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        let oneOffHit = SequencedURLProtocol.capturedRequests.contains { ($0.url?.path ?? "").contains("/book/o/tok123") }
        XCTAssertTrue(oneOffHit, "one-off must hit the token endpoint")
    }
}
