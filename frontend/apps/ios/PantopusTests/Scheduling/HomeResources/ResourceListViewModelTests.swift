//
//  ResourceListViewModelTests.swift
//  PantopusTests
//
//  Stream I12 — F9 resource-list projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class ResourceListViewModelTests: XCTestCase {
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

    func testLoadEmptyProducesEmptyState() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"resources":[]}"#),
            .status(200, body: #"{"bookings":[]}"#)
        ]
        let viewModel = ResourceListViewModel(homeId: "h1", push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case .empty = viewModel.state else {
            return XCTFail("Expected .empty, got \(viewModel.state)")
        }
    }

    func testLoadPopulatedProducesLoaded() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"resources":[{"id":"r1","name":"EV charger","resource_type":"charger","is_active":true}]}"#),
            .status(200, body: #"{"bookings":[]}"#)
        ]
        let viewModel = ResourceListViewModel(homeId: "h1", push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case let .loaded(sections, _) = viewModel.state else {
            return XCTFail("Expected .loaded, got \(viewModel.state)")
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.title, "EV charger")
    }

    func testLoadFailureProducesError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let viewModel = ResourceListViewModel(homeId: "h1", push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case .error = viewModel.state else {
            return XCTFail("Expected .error, got \(viewModel.state)")
        }
    }
}
