//
//  DeepLinkHandoffViewModelTests.swift
//  PantopusTests
//
//  Stream I7 (Invitee edge & customer) — D9 hand-off. The manage read resolves
//  to the continue-in-app surface; a failure falls back to the web path.
//

import XCTest
@testable import Pantopus

@MainActor
final class DeepLinkHandoffViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> DeepLinkHandoffViewModel {
        let client = SchedulingClient(client: APIClient(session: SequencedURLProtocol.makeSession(), retryPolicy: .none))
        return DeepLinkHandoffViewModel(token: "tok", push: { _ in }, client: client)
    }

    func testResolvedShowsBooking() async {
        // swiftlint:disable line_length
        let json = #"""
        {"booking":{"id":"b1","status":"confirmed","start_at":"2026-06-17T16:30:00Z","invitee_name":"Maya","invitee_timezone":"America/Los_Angeles"},
         "eventType":{"id":"et1","name":"Consultation","default_duration":30},
         "page":{"slug":"dr-lee","title":"Dr. Lee","owner_type":"user","timezone":"America/Los_Angeles"}}
        """#
        // swiftlint:enable line_length
        SequencedURLProtocol.sequence = [.status(200, body: json)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case let .resolved(response) = viewModel.state else {
            return XCTFail("expected resolved, got \(viewModel.state)")
        }
        XCTAssertEqual(response.eventType?.name, "Consultation")
        XCTAssertNotNil(viewModel.webURL)
    }

    func testFailureFallsBackToWeb() async {
        SequencedURLProtocol.sequence = [.status(404, body: #"{"error":"NOT_FOUND","message":"gone"}"#)]
        let viewModel = makeViewModel()
        await viewModel.load()
        guard case .failed = viewModel.state else { return XCTFail("expected failed, got \(viewModel.state)") }
    }
}
