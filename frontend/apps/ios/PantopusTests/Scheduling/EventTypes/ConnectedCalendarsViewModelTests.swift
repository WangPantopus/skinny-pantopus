//
//  ConnectedCalendarsViewModelTests.swift
//  PantopusTests
//
//  Stream I2 — B8 connected-calendars load + 501 "coming soon" tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class ConnectedCalendarsViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeClient() -> SchedulingClient {
        SchedulingClient(client: APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        ))
    }

    func testLoadEmptyIsComingSoon() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"calendars":[]}"#)]
        let viewModel = ConnectedCalendarsViewModel(owner: .personal, client: makeClient())
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertTrue(viewModel.isComingSoon)
    }

    func testConnectSurfacesComingSoon() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"calendars":[]}"#),
            .status(501, body: #"{"error":"NOT_AVAILABLE","message":"Calendar sync is not available yet."}"#)
        ]
        let viewModel = ConnectedCalendarsViewModel(owner: .personal, client: makeClient())
        await viewModel.load()
        await viewModel.connect(CalendarProvider.all[0])
        XCTAssertNotNil(viewModel.notice)
        XCTAssertTrue(viewModel.notice?.lowercased().contains("coming soon") ?? false)
    }

    func testLoadFailureProducesError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let viewModel = ConnectedCalendarsViewModel(owner: .personal, client: makeClient())
        await viewModel.load()
        guard case .error = viewModel.phase else {
            return XCTFail("Expected .error, got \(viewModel.phase)")
        }
    }
}
