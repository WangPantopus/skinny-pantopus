//
//  AvailabilityScheduleListViewModelTests.swift
//  PantopusTests
//
//  Stream I3 — B4 schedule-list projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class AvailabilityScheduleListViewModelTests: XCTestCase {
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

    private static let composite = """
    {"schedules":[{"id":"s1","name":"Working hours","timezone":"America/New_York","is_default":true}],
     "rules":[{"schedule_id":"s1","weekday":1,"start_time":"09:00","end_time":"17:00"}],
     "overrides":[]}
    """

    func testLoadEmptyProducesEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"schedules":[],"rules":[],"overrides":[]}"#)]
        let viewModel = AvailabilityScheduleListViewModel(push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case .empty = viewModel.state else {
            return XCTFail("Expected .empty, got \(viewModel.state)")
        }
    }

    func testLoadPopulatedProducesLoaded() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.composite)]
        let viewModel = AvailabilityScheduleListViewModel(push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case let .loaded(sections, _) = viewModel.state else {
            return XCTFail("Expected .loaded, got \(viewModel.state)")
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.title, "Working hours")
    }

    func testLoadFailureProducesError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let viewModel = AvailabilityScheduleListViewModel(push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case .error = viewModel.state else {
            return XCTFail("Expected .error, got \(viewModel.state)")
        }
    }

    func testDeleteDefaultSurfacesConflict() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.composite),
            .status(409, body: #"{"error":"CANNOT_DELETE_DEFAULT","message":"Make another schedule your default first."}"#)
        ]
        let viewModel = AvailabilityScheduleListViewModel(push: { _ in }, client: makeClient())
        await viewModel.load()
        viewModel.deleteTarget = AvailabilityScheduleDTO(
            id: "s1",
            userId: nil,
            name: "Working hours",
            timezone: "America/New_York",
            isDefault: true,
            createdAt: nil,
            updatedAt: nil
        )
        await viewModel.confirmDelete()
        XCTAssertNotNil(viewModel.actionError)
    }
}
