//
//  ScheduleVisitViewModelTests.swift
//  PantopusTests
//
//  Stream I12 — F13 schedule-visit: validation + contract-first create.
//

import XCTest
@testable import Pantopus

@MainActor
final class ScheduleVisitViewModelTests: XCTestCase {
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

    func testValidationRequiresTitleAndHost() {
        let viewModel = ScheduleVisitViewModel(homeId: "h1", push: { _ in }, client: makeClient())
        XCTAssertFalse(viewModel.isValid)
        viewModel.title = "Plumber visit"
        XCTAssertFalse(viewModel.isValid) // no host yet
        viewModel.toggleHost("u1")
        XCTAssertTrue(viewModel.isValid)
    }

    func testSaveWithoutHostSurfacesError() async {
        let viewModel = ScheduleVisitViewModel(homeId: "h1", push: { _ in }, client: makeClient())
        viewModel.title = "Plumber visit"
        let ok = await viewModel.save()
        XCTAssertFalse(ok)
        XCTAssertNotNil(viewModel.hostError)
    }

    func testSaveSucceedsAndNavigatesToDetail() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: #"{"visit":{"id":"v1","event_type":"vendor","title":"Plumber visit"}}"#)
        ]
        var captured: SchedulingRoute?
        let viewModel = ScheduleVisitViewModel(homeId: "h1", push: { captured = $0 }, client: makeClient())
        viewModel.title = "Plumber visit"
        viewModel.toggleHost("u1")
        let ok = await viewModel.save()
        XCTAssertTrue(ok)
        XCTAssertEqual(captured, .visitDetail(homeId: "h1", eventId: "v1"))
    }
}
