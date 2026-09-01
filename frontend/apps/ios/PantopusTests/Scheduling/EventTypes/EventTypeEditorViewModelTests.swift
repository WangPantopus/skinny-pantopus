//
//  EventTypeEditorViewModelTests.swift
//  PantopusTests
//
//  Stream I2 — B2 editor create/edit + slug-conflict mapping tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class EventTypeEditorViewModelTests: XCTestCase {
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

    private static let detail = """
    {"eventType":{"id":"e1","name":"Intro call","slug":"intro","durations":[30,60],
     "default_duration":30,"location_mode":"phone","location_detail":"555","is_active":true,
     "visibility":"secret","max_horizon_days":45},"questions":[],"assignees":[]}
    """

    private static let saved = #"{"eventType":{"id":"e9","name":"Intro call","slug":"intro-call","durations":[30],"default_duration":30}}"#

    private func makeVM(eventTypeId: String?) -> EventTypeEditorViewModel {
        EventTypeEditorViewModel(owner: .personal, eventTypeId: eventTypeId, push: { _ in }, client: makeClient())
    }

    func testCreateModeStartsReadyWithDefaults() async {
        let viewModel = makeVM(eventTypeId: nil)
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.durations, [30])
        XCTAssertFalse(viewModel.formValid, "Empty name must block save")
    }

    func testAutoSlugFollowsName() {
        let viewModel = makeVM(eventTypeId: nil)
        viewModel.updateName("Coffee Chat")
        XCTAssertEqual(viewModel.slug, "coffee-chat")
        XCTAssertTrue(viewModel.formValid)
    }

    func testCreateSaveSucceeds() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.saved)]
        let viewModel = makeVM(eventTypeId: nil)
        viewModel.updateName("Intro call")
        let ok = await viewModel.save()
        XCTAssertTrue(ok)
    }

    func testSlugTakenMapsToFieldError() async {
        SequencedURLProtocol.sequence = [
            .status(409, body: #"{"error":"SLUG_TAKEN","message":"Taken"}"#)
        ]
        let viewModel = makeVM(eventTypeId: nil)
        viewModel.updateName("Intro call")
        let ok = await viewModel.save()
        XCTAssertFalse(ok)
        XCTAssertNotNil(viewModel.slugError)
    }

    func testEditLoadPopulatesFields() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.detail)]
        let viewModel = makeVM(eventTypeId: "e1")
        await viewModel.load()
        XCTAssertEqual(viewModel.phase, .ready)
        XCTAssertEqual(viewModel.name, "Intro call")
        XCTAssertEqual(viewModel.durationMode, .multiple)
        XCTAssertEqual(viewModel.location, .phone)
        XCTAssertTrue(viewModel.visibilitySecret)
        XCTAssertEqual(viewModel.maxHorizonDays, 45)
        XCTAssertFalse(viewModel.isDirty)
    }
}
