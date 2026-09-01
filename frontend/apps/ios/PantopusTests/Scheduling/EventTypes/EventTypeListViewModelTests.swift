//
//  EventTypeListViewModelTests.swift
//  PantopusTests
//
//  Stream I2 — B1 event-type list projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class EventTypeListViewModelTests: XCTestCase {
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

    private static let page = #"{"page":{"id":"p1","owner_type":"user","slug":"maria","is_live":true,"is_paused":false}}"#

    private static let types = """
    {"eventTypes":[
      {"id":"e1","name":"Intro call","slug":"intro","durations":[30],"default_duration":30,
       "location_mode":"video","is_active":true},
      {"id":"e2","name":"Deep dive","slug":"deep","durations":[60],"default_duration":60,
       "location_mode":"phone","is_active":false}
    ]}
    """

    func testLoadEmptyProducesEmptyState() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"eventTypes":[]}"#),
            .status(200, body: Self.page)
        ]
        let viewModel = EventTypeListViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case .empty = viewModel.state else {
            return XCTFail("Expected .empty, got \(viewModel.state)")
        }
    }

    func testLoadSplitsActiveAndHidden() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.types), .status(200, body: Self.page)]
        let viewModel = EventTypeListViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case let .loaded(sections, _) = viewModel.state else {
            return XCTFail("Expected .loaded, got \(viewModel.state)")
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.title, "Intro call")

        viewModel.selectedTab = EventTypeTab.hidden.rawValue
        guard case let .loaded(hidden, _) = viewModel.state else {
            return XCTFail("Expected .loaded for hidden tab")
        }
        XCTAssertEqual(hidden.first?.rows.first?.title, "Deep dive")
    }

    func testLoadFailureProducesError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let viewModel = EventTypeListViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case .error = viewModel.state else {
            return XCTFail("Expected .error, got \(viewModel.state)")
        }
    }

    func testDeleteWithBookingsSurfacesConflict() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.types),
            .status(200, body: Self.page),
            .status(409, body: #"{"error":"HAS_UPCOMING_BOOKINGS","message":"Has bookings"}"#)
        ]
        let viewModel = EventTypeListViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await viewModel.load()
        viewModel.deleteTarget = EventTypeDTO.fixture(id: "e1", name: "Intro call")
        await viewModel.confirmDelete()
        XCTAssertNotNil(viewModel.actionError)
        XCTAssertTrue(viewModel.actionError?.contains("Hide it") ?? false)
    }
}

extension EventTypeDTO {
    /// Minimal fixture for tests that need a row reference (delete/menu).
    static func fixture(id: String, name: String) -> EventTypeDTO {
        let json = """
        {"id":"\(id)","name":"\(name)","slug":"\(name.lowercased())","durations":[30]}
        """
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(EventTypeDTO.self, from: Data(json.utf8))
    }
}
