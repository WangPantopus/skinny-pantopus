//
//  BookingLandingViewModelTests.swift
//  PantopusTests
//
//  Stream I5 (Invitee Discovery) — C5 Booking Landing view-model. Drives the
//  public `GET /api/public/book/:slug` flow with stubbed 200 / paused / 404 /
//  5xx bodies and asserts the four fetch states plus the first-class paused
//  state. Uses `APIClient(session:retryPolicy:.none)` over `SequencedURLProtocol`.
//

import XCTest
@testable import Pantopus

@MainActor
final class BookingLandingViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel(slug: String = "ada") -> BookingLandingViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return BookingLandingViewModel(slug: slug, push: { _ in }, client: client)
    }

    func testActivePageLoadsEventTypes() async {
        let json = """
        {"page":{"slug":"ada","title":"Book Ada","owner_type":"user","timezone":"America/New_York"},
        "status":"active",
        "eventTypes":[
        {"id":"et1","name":"Intro call","slug":"intro","durations":[30],"default_duration":30,"location_mode":"video"}
        ]}
        """
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case let .loaded(view) = viewModel.state else {
            return XCTFail("expected .loaded, got \(viewModel.state)")
        }
        XCTAssertEqual(view.eventTypes.count, 1)
        XCTAssertEqual(view.eventTypes.first?.slug, "intro")
        XCTAssertEqual(view.status, .active)
    }

    func testPausedPageShowsPausedNotError() async {
        let json = #"{"page":{"slug":"ada","owner_type":"business"},"status":"paused","eventTypes":[]}"#
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .paused = viewModel.state else {
            return XCTFail("expected .paused, got \(viewModel.state)")
        }
    }

    func testActiveWithNoEventTypesShowsEmpty() async {
        let json = #"{"page":{"slug":"ada"},"status":"active","eventTypes":[]}"#
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .empty = viewModel.state else {
            return XCTFail("expected .empty, got \(viewModel.state)")
        }
    }

    func testNotFoundShowsUnavailableError() async {
        let body = #"{"error":"NOT_FOUND","status":"unavailable","message":"This booking page is not available."}"#
        SequencedURLProtocol.sequence = [.status(404, body: body)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case let .error(message) = viewModel.state else {
            return XCTFail("expected .error, got \(viewModel.state)")
        }
        XCTAssertEqual(message, "This link isn't available")
    }

    func testServerErrorShowsErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: #"{"error":"boom"}"#)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .error = viewModel.state else {
            return XCTFail("expected .error, got \(viewModel.state)")
        }
    }
}
