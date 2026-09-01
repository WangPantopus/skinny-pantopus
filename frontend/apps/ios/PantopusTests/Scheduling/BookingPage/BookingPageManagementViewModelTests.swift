//
//  BookingPageManagementViewModelTests.swift
//  PantopusTests
//
//  C1 · Stream I4. Drives the management view-model against stubbed
//  responses via APIClient(retryPolicy: .none, session: SequencedURLProtocol…).
//

import XCTest
@testable import Pantopus

@MainActor
final class BookingPageManagementViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeClient() -> APIClient {
        APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    private func makeVM(_ client: APIClient) -> BookingPageManagementViewModel {
        BookingPageManagementViewModel(owner: .personal, api: client) { _ in }
    }

    private let pageJSON = #"""
    {"page":{"id":"p1","owner_type":"user","owner_id":null,"slug":"maria-k","is_live":true,
    "is_paused":false,"title":"Maria","tagline":"Coach","visibility":"listed","timezone":"America/New_York"}}
    """#

    private let eventTypesJSON = #"""
    {"eventTypes":[{"id":"et_1","name":"Intro","slug":"intro","durations":[30],"default_duration":30,
    "location_mode":"video","visibility":"public","is_active":true}]}
    """#

    func testLoadHydratesPageAndServices() async {
        SequencedURLProtocol.sequence = [.status(200, body: pageJSON), .status(200, body: eventTypesJSON)]
        let viewModel = makeVM(makeClient())
        await viewModel.load()
        XCTAssertEqual(viewModel.state, .loaded)
        XCTAssertEqual(viewModel.slugText, "maria-k")
        XCTAssertTrue(viewModel.isAcceptingBookings)
        XCTAssertEqual(viewModel.serviceRows.count, 1)
        XCTAssertEqual(viewModel.serviceRows.first?.isVisible, true)
        XCTAssertFalse(viewModel.isDirty)
    }

    func testLoadFailureSurfacesError() async {
        SequencedURLProtocol.sequence = [.status(500, body: #"{"error":"boom"}"#)]
        let viewModel = makeVM(makeClient())
        await viewModel.load()
        guard case .error = viewModel.state else { return XCTFail("expected error state") }
    }

    func testSlugCheckAvailable() async {
        let viewModel = makeVM(makeClient())
        viewModel.hydrateForPreview(page: BookingPageSampleData.livePage, eventTypes: [])
        viewModel.slugText = "free-handle"
        SequencedURLProtocol.sequence = [.status(200, body: #"{"available":true}"#)]
        await viewModel.runSlugCheck("free-handle")
        XCTAssertEqual(viewModel.slugState, .available)
        XCTAssertTrue(viewModel.isValid)
    }

    func testSlugCheckTakenSurfacesSuggestions() async {
        let viewModel = makeVM(makeClient())
        viewModel.hydrateForPreview(page: BookingPageSampleData.livePage, eventTypes: [])
        viewModel.slugText = "taken-handle"
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"available":false,"suggestions":["taken-handle-1","taken-handle-2"]}"#)
        ]
        await viewModel.runSlugCheck("taken-handle")
        XCTAssertEqual(viewModel.slugState, .taken(suggestions: ["taken-handle-1", "taken-handle-2"]))
        XCTAssertFalse(viewModel.isValid)
    }

    func testSetAcceptingBookingsOptimisticPersist() async {
        let viewModel = makeVM(makeClient())
        viewModel.hydrateForPreview(page: BookingPageSampleData.livePage, eventTypes: [])
        XCTAssertTrue(viewModel.isAcceptingBookings)
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"page":{"id":"p1","owner_type":"user","slug":"maria-k","is_live":true,"is_paused":true}}"#)
        ]
        await viewModel.setAcceptingBookings(false)
        XCTAssertFalse(viewModel.isAcceptingBookings)
        XCTAssertTrue(viewModel.isPaused)
    }

    func testSetAcceptingBookingsRollsBackOnError() async {
        let viewModel = makeVM(makeClient())
        viewModel.hydrateForPreview(page: BookingPageSampleData.livePage, eventTypes: [])
        SequencedURLProtocol.sequence = [.status(500, body: #"{"error":"nope"}"#)]
        await viewModel.setAcceptingBookings(false)
        XCTAssertTrue(viewModel.isAcceptingBookings) // rolled back
        XCTAssertNotNil(viewModel.saveError)
    }

    func testSlugFormatValidation() {
        XCTAssertNotNil(BookingPageManagementViewModel.slugFormatError("ab"))
        XCTAssertNotNil(BookingPageManagementViewModel.slugFormatError("Has Spaces"))
        XCTAssertNil(BookingPageManagementViewModel.slugFormatError("valid-handle-1"))
    }
}
