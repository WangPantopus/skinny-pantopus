//
//  BookResourceViewModelTests.swift
//  PantopusTests
//
//  Stream I12 — F12 book-resource: grid selection, max-duration rule, submit.
//

import XCTest
@testable import Pantopus

@MainActor
final class BookResourceViewModelTests: XCTestCase {
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

    /// resources → bookings → occupants (load order).
    private static let loadSequence: [SequencedURLProtocol.Response] = [
        .status(
            200,
            // swiftlint:disable:next line_length
            body: #"{"resources":[{"id":"r1","name":"EV charger","resource_type":"charger","max_duration_min":240,"requires_approval":false,"who_can_book":"members","is_active":true}]}"#
        ),
        .status(200, body: #"{"bookings":[]}"#),
        .status(
            200,
            body: #"{"occupants":[{"id":"o1","user_id":"u1","role":"member","is_active":true,"display_name":"Dad"}],"pendingInvites":[]}"#
        )
    ]

    private func loadedViewModel() async -> BookResourceViewModel {
        let viewModel = BookResourceViewModel(homeId: "h1", resourceId: "r1", push: { _ in }, client: makeClient())
        await viewModel.load()
        return viewModel
    }

    func testLoadReachesForm() async {
        SequencedURLProtocol.sequence = Self.loadSequence
        let viewModel = await loadedViewModel()
        XCTAssertEqual(viewModel.phase, .form)
        XCTAssertEqual(viewModel.resourceName, "EV charger")
    }

    func testValidSelectionEnablesSubmit() async {
        SequencedURLProtocol.sequence = Self.loadSequence
        let viewModel = await loadedViewModel()
        viewModel.tap(hour: 9)
        XCTAssertTrue(viewModel.canSubmit)
        XCTAssertEqual(viewModel.statusLine?.tone, .ok)
    }

    func testOverMaxDisablesSubmit() async {
        SequencedURLProtocol.sequence = Self.loadSequence
        let viewModel = await loadedViewModel()
        // 9a → 2p is 5 hours, past the 4-hour max.
        for hour in [9, 10, 11, 12, 13] {
            viewModel.tap(hour: hour)
        }
        XCTAssertEqual(viewModel.selectionCount, 5)
        XCTAssertFalse(viewModel.canSubmit)
        XCTAssertEqual(viewModel.statusLine?.tone, .warning)
    }

    func testSubmitConfirmed() async {
        SequencedURLProtocol.sequence = Self.loadSequence + [
            .status(201, body: #"{"booking":{"id":"b1","resource_id":"r1","status":"confirmed"}}"#)
        ]
        let viewModel = await loadedViewModel()
        viewModel.tap(hour: 9)
        await viewModel.submit()
        XCTAssertEqual(viewModel.phase, .success(approval: false))
    }
}
