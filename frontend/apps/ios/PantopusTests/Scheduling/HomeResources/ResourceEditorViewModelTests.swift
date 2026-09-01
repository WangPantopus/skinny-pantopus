//
//  ResourceEditorViewModelTests.swift
//  PantopusTests
//
//  Stream I12 — F10 resource editor: defaults, validation, create, edit load.
//

import XCTest
@testable import Pantopus

@MainActor
final class ResourceEditorViewModelTests: XCTestCase {
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

    func testCreateSeedsDefaultsFromType() async {
        let viewModel = ResourceEditorViewModel(homeId: "h1", resourceId: nil, push: { _ in }, client: makeClient())
        await viewModel.load()
        viewModel.selectKind(.charger)
        XCTAssertEqual(viewModel.maxDurationHours, 4)
        XCTAssertFalse(viewModel.requiresApproval)
        XCTAssertTrue(viewModel.ruleHelper.contains("4 hr max"))
    }

    func testValidationRequiresName() async {
        let viewModel = ResourceEditorViewModel(homeId: "h1", resourceId: nil, push: { _ in }, client: makeClient())
        await viewModel.load()
        XCTAssertFalse(viewModel.isValid)
        XCTAssertNotNil(viewModel.nameError)
        viewModel.name = "Power tools"
        XCTAssertTrue(viewModel.isValid)
        XCTAssertNil(viewModel.nameError)
    }

    func testCreateSaveSucceeds() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: #"{"resource":{"id":"r1","name":"Power tools","resource_type":"tool"}}"#)
        ]
        let viewModel = ResourceEditorViewModel(homeId: "h1", resourceId: nil, push: { _ in }, client: makeClient())
        await viewModel.load()
        viewModel.name = "Power tools"
        viewModel.selectKind(.tool)
        let ok = await viewModel.save()
        XCTAssertTrue(ok)
        XCTAssertNil(viewModel.saveError)
    }

    func testEditLoadPopulatesFields() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"""
            {"resources":[{"id":"r1","name":"EV charger","resource_type":"charger",
             "max_duration_min":240,"buffer_min":15,"requires_approval":false,"who_can_book":"members","is_active":true}]}
            """#)
        ]
        let viewModel = ResourceEditorViewModel(homeId: "h1", resourceId: "r1", push: { _ in }, client: makeClient())
        await viewModel.load()
        guard case .ready = viewModel.loadState else {
            return XCTFail("Expected .ready, got \(viewModel.loadState)")
        }
        XCTAssertEqual(viewModel.name, "EV charger")
        XCTAssertEqual(viewModel.kind, .charger)
        XCTAssertEqual(viewModel.maxDurationHours, 4)
        XCTAssertEqual(viewModel.bufferMin, 15)
    }
}
