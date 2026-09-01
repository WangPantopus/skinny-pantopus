//
//  TerminalStateViewModelTests.swift
//  PantopusTests
//
//  Stream I7 (Invitee edge & customer) — D7 terminal states. Verifies that each
//  link/page response maps to the right first-class state (paused / not-found /
//  fully-booked from a slug, expired from a one-off token).
//

import XCTest
@testable import Pantopus

@MainActor
final class TerminalStateViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel(slug: String? = "ada", oneOffToken: String? = nil) -> TerminalStateViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return TerminalStateViewModel(slug: slug, oneOffToken: oneOffToken, push: { _ in }, client: client)
    }

    func testPausedPageResolvesPaused() async {
        SequencedURLProtocol.sequence = [
            .status(
                200,
                body: #"{"page":{"slug":"ada","title":"Maria Kessler","owner_type":"user"},"status":"paused","eventTypes":[]}"#
            )
        ]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case let .resolved(kind, hostName) = viewModel.state else {
            return XCTFail("expected resolved, got \(viewModel.state)")
        }
        XCTAssertEqual(kind, .paused)
        XCTAssertEqual(hostName, "Maria")
    }

    func testNotFoundPageResolvesNotFound() async {
        SequencedURLProtocol.sequence = [.status(404, body: #"{"error":"NOT_FOUND","status":"unavailable"}"#)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case let .resolved(kind, _) = viewModel.state else {
            return XCTFail("expected resolved, got \(viewModel.state)")
        }
        XCTAssertEqual(kind, .notFound)
    }

    func testActiveButEmptyResolvesFullyBooked() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"page":{"slug":"ada"},"status":"active","eventTypes":[]}"#)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case let .resolved(kind, _) = viewModel.state else {
            return XCTFail("expected resolved, got \(viewModel.state)")
        }
        XCTAssertEqual(kind, .fullyBooked)
    }

    func testExpiredOneOffResolvesExpired() async {
        SequencedURLProtocol.sequence = [.status(404, body: #"{"error":"NOT_FOUND","status":"expired"}"#)]
        let viewModel = makeViewModel(slug: nil, oneOffToken: "tok")
        await viewModel.load()
        guard case let .resolved(kind, _) = viewModel.state else {
            return XCTFail("expected resolved, got \(viewModel.state)")
        }
        XCTAssertEqual(kind, .expired)
    }
}
