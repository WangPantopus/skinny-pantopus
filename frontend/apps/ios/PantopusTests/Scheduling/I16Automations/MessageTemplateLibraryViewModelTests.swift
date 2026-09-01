//
//  MessageTemplateLibraryViewModelTests.swift
//  PantopusTests
//
//  Stream I16 — H8 Message Template Library projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class MessageTemplateLibraryViewModelTests: XCTestCase {
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

    func testLoadKeepsStartersAndLoadsMine() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"templates":[{"id":"t1","name":"Mine","channel":"email","subject":"s","body":"Hello"}]}"#)
        ]
        let vm = MessageTemplateLibraryViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await vm.load()
        guard case .loaded = vm.phase else { return XCTFail("expected loaded") }
        XCTAssertEqual(vm.visibleTemplates.count, 1)
        XCTAssertEqual(vm.starters.count, StarterTemplate.all.count)
    }

    func testDuplicateStarterPostsAndReloads() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"templates":[]}"#),
            .status(200, body: #"{"template":{"id":"t1","name":"Reminder","channel":"push","body":"x"}}"#),
            .status(200, body: #"{"templates":[{"id":"t1","name":"Reminder","channel":"push","body":"x"}]}"#)
        ]
        let vm = MessageTemplateLibraryViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await vm.load()
        XCTAssertTrue(vm.visibleTemplates.isEmpty)
        await vm.duplicateStarter(StarterTemplate.all[1])
        XCTAssertEqual(vm.visibleTemplates.count, 1)
    }

    func testDeleteRemovesRow() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"templates":[{"id":"t1","name":"Mine","channel":"email","subject":"s","body":"Hello"}]}"#),
            .status(200, body: #"{"ok":true}"#),
            .status(200, body: #"{"templates":[]}"#)
        ]
        let vm = MessageTemplateLibraryViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await vm.load()
        vm.deleteTarget = vm.visibleTemplates.first
        await vm.confirmDelete()
        XCTAssertTrue(vm.visibleTemplates.isEmpty)
    }

    func testSearchFilters() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"templates":[{"id":"t1","name":"Welcome","channel":"email","subject":"s","body":"Hello"}]}"#)
        ]
        let vm = MessageTemplateLibraryViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await vm.load()
        vm.query = "welcome"
        XCTAssertEqual(vm.visibleTemplates.count, 1)
        vm.query = "zzz"
        XCTAssertTrue(vm.visibleTemplates.isEmpty)
    }
}
