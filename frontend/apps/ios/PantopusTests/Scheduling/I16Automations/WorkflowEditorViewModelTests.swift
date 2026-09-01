//
//  WorkflowEditorViewModelTests.swift
//  PantopusTests
//
//  Stream I16 — H3 Workflow Editor projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class WorkflowEditorViewModelTests: XCTestCase {
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

    func testNewHasSensiblePresetAndBlocksSaveUntilMessage() async {
        let vm = WorkflowEditorViewModel(owner: .personal, workflowId: nil, client: makeClient())
        await vm.load()
        guard case .loaded = vm.phase else { return XCTFail("expected loaded") }
        XCTAssertEqual(vm.trigger, .beforeStart)
        XCTAssertEqual(vm.offsetMinutes, 60)
        XCTAssertEqual(vm.channel, .email)
        XCTAssertFalse(vm.canSave) // empty message

        let saved = await vm.save()
        XCTAssertFalse(saved)
        XCTAssertTrue(vm.didAttemptSave)
    }

    func testSaveNewPostsWorkflow() async {
        let vm = WorkflowEditorViewModel(owner: .personal, workflowId: nil, client: makeClient())
        await vm.load()
        vm.message = "Hi {{attendee_name}}, see you soon."
        XCTAssertTrue(vm.canSave)
        SequencedURLProtocol.sequence = [
            .status(
                200,
                // swiftlint:disable:next line_length
                body: #"{"workflow":{"id":"w9","name":"Email attendees","trigger":"before_start","action":"email","offset_minutes":60,"is_active":true}}"#
            )
        ]
        let saved = await vm.save()
        XCTAssertTrue(saved)
        XCTAssertNil(vm.saveError)
    }

    func testLoadExistingPopulatesFields() async {
        // swiftlint:disable:next line_length
        let body = #"{"workflows":[{"id":"w1","name":"Thanks","trigger":"after_end","action":"email","offset_minutes":120,"message_template":"Thanks!","is_active":false,"event_type_id":null}]}"#
        SequencedURLProtocol.sequence = [.status(200, body: body)]
        let vm = WorkflowEditorViewModel(owner: .personal, workflowId: "w1", client: makeClient())
        await vm.load()
        XCTAssertEqual(vm.trigger, .afterEnd)
        XCTAssertEqual(vm.offsetMinutes, 120)
        XCTAssertEqual(vm.message, "Thanks!")
        XCTAssertFalse(vm.isActive)
    }

    func testLoadMissingWorkflowErrors() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"workflows":[]}"#)]
        let vm = WorkflowEditorViewModel(owner: .personal, workflowId: "nope", client: makeClient())
        await vm.load()
        guard case .error = vm.phase else { return XCTFail("expected error") }
    }
}
