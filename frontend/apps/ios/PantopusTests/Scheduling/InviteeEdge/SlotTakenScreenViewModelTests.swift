//
//  SlotTakenScreenViewModelTests.swift
//  PantopusTests
//
//  Stream I7 (Invitee edge & customer) — D5 conflict recovery. The slots read
//  drives nearest-times / fully-booked / error.
//

import XCTest
@testable import Pantopus

@MainActor
final class SlotTakenScreenViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> SlotTakenScreenViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return SlotTakenScreenViewModel(slug: "ada", eventTypeSlug: "intro", tz: "America/New_York", push: { _ in }, client: client)
    }

    func testSlotsBecomeAlternatives() async {
        let json = #"""
        {"eventType":{"id":"et1","name":"Intro","durations":[30],"default_duration":30},
         "timezone":"America/New_York","status":"active",
         "slots":[
           {"start":"2026-06-17T21:30:00Z","end":"2026-06-17T22:00:00Z","startLocal":"2026-06-17T17:30:00"},
           {"start":"2026-06-17T22:30:00Z","end":"2026-06-17T23:00:00Z","startLocal":"2026-06-17T18:30:00"}
         ]}
        """#
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case let .alternatives(alts) = viewModel.state else {
            return XCTFail("expected alternatives, got \(viewModel.state)")
        }
        XCTAssertEqual(alts.count, 2)
    }

    func testNoSlotsBecomesFullyBooked() async {
        // swiftlint:disable:next line_length
        let json = #"{"eventType":{"id":"et1","name":"Intro","durations":[30],"default_duration":30},"timezone":"America/New_York","status":"active","slots":[]}"#
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .fullyBooked = viewModel.state else {
            return XCTFail("expected fullyBooked, got \(viewModel.state)")
        }
    }

    func testErrorSurfaces() async {
        SequencedURLProtocol.sequence = [.status(404, body: #"{"error":"NOT_FOUND"}"#)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .error = viewModel.state else { return XCTFail("expected error, got \(viewModel.state)") }
    }
}
