//
//  MessageTemplateEditorViewModelTests.swift
//  PantopusTests
//
//  Stream I16 — H5 Message Template Editor projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class MessageTemplateEditorViewModelTests: XCTestCase {
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

    func testEmailRequiresSubject() async {
        let vm = MessageTemplateEditorViewModel(owner: .personal, templateId: nil, client: makeClient())
        await vm.load()
        vm.channel = .email
        vm.name = "Thank-you"
        vm.body = "Thanks {{attendee_name}}"
        XCTAssertTrue(vm.subjectMissing)
        XCTAssertFalse(vm.canSave)
        vm.subject = "Thanks for booking"
        XCTAssertFalse(vm.subjectMissing)
        XCTAssertTrue(vm.canSave)
    }

    func testPushTemplateNeedsNoSubject() async {
        let vm = MessageTemplateEditorViewModel(owner: .personal, templateId: nil, client: makeClient())
        await vm.load()
        vm.setChannel(.push)
        vm.name = "Reminder"
        vm.body = "Starting soon"
        XCTAssertFalse(vm.showsSubject)
        XCTAssertTrue(vm.canSave)
    }

    func testSmsOverLimitFlags() async {
        let vm = MessageTemplateEditorViewModel(owner: .personal, templateId: nil, client: makeClient())
        await vm.load()
        // SMS is gated "Coming soon" so `setChannel(.sms)` is a no-op; assign the
        // channel directly to exercise the over-limit counter logic.
        vm.channel = .sms
        vm.body = String(repeating: "a", count: 170)
        XCTAssertTrue(vm.isOverLimit)
        XCTAssertEqual(vm.counterLimit, WorkflowChannel.smsSegmentLimit)
    }

    func testSaveNewPostsTemplate() async {
        let vm = MessageTemplateEditorViewModel(owner: .personal, templateId: nil, client: makeClient())
        await vm.load()
        vm.name = "Confirm"
        vm.subject = "Booked"
        vm.body = "Hi {{attendee_name}}"
        SequencedURLProtocol.sequence = [
            .status(
                200,
                body: #"{"template":{"id":"t9","name":"Confirm","channel":"email","subject":"Booked","body":"Hi {{attendee_name}}"}}"#
            )
        ]
        let saved = await vm.save()
        XCTAssertTrue(saved)
        XCTAssertNil(vm.saveError)
    }
}
