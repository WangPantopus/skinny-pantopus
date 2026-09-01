//
//  WorkflowsListViewModelTests.swift
//  PantopusTests
//
//  Stream I16 — H2 Workflows List projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class WorkflowsListViewModelTests: XCTestCase {
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

    // swiftlint:disable:next line_length
    private let page = #"{"page":{"id":"p1","owner_type":"user","slug":"sam","is_live":true,"is_paused":false,"reminder_minutes":[1440,60]}}"#

    func testLoadEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: #"{"workflows":[]}"#), .status(200, body: page)]
        let vm = WorkflowsListViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await vm.load()
        guard case .loaded = vm.phase else { return XCTFail("expected loaded, got \(vm.phase)") }
        XCTAssertTrue(vm.visibleWorkflows.isEmpty)
        XCTAssertEqual(vm.remindersSummary, "1 day + 1 hour before · Push")
    }

    func testLoadPopulatedSplitsScope() async {
        // swiftlint:disable line_length
        let body = #"""
        {"workflows":[
          {"id":"w1","name":"Email attendees","trigger":"booking_created","action":"email","offset_minutes":0,"is_active":true,"event_type_id":null},
          {"id":"w2","name":"Reminder","trigger":"before_start","action":"push","offset_minutes":60,"is_active":false,"event_type_id":"et1"}
        ]}
        """#
        // swiftlint:enable line_length
        SequencedURLProtocol.sequence = [.status(200, body: body), .status(200, body: page)]
        let vm = WorkflowsListViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await vm.load()
        XCTAssertEqual(vm.globalCount, 1)
        XCTAssertEqual(vm.scopedCount, 1)
        XCTAssertEqual(vm.visibleWorkflows.count, 1) // global scope by default
        XCTAssertEqual(vm.visibleWorkflows.first?.id, "w1")
    }

    func testForbiddenLoadGates() async {
        SequencedURLProtocol.sequence = [.status(403, body: #"{"error":"FORBIDDEN","message":"no"}"#)]
        let vm = WorkflowsListViewModel(owner: .home(homeId: "h1"), push: { _ in }, client: makeClient())
        await vm.load()
        guard case .error = vm.phase else { return XCTFail("expected error, got \(vm.phase)") }
        XCTAssertTrue(vm.isGated)
    }

    func testToggleActiveFlipsRow() async {
        // swiftlint:disable:next line_length
        let listBody = #"{"workflows":[{"id":"w1","name":"Email","trigger":"booking_created","action":"email","offset_minutes":0,"is_active":true,"event_type_id":null}]}"#
        // swiftlint:disable:next line_length
        let updated = #"{"workflow":{"id":"w1","name":"Email","trigger":"booking_created","action":"email","offset_minutes":0,"is_active":false,"event_type_id":null}}"#
        SequencedURLProtocol.sequence = [.status(200, body: listBody), .status(200, body: page), .status(200, body: updated)]
        let vm = WorkflowsListViewModel(owner: .personal, push: { _ in }, client: makeClient())
        await vm.load()
        guard let workflow = vm.visibleWorkflows.first else { return XCTFail("missing row") }
        XCTAssertTrue(vm.isActive(workflow))
        await vm.toggleActive(workflow)
        XCTAssertFalse(vm.isActive(vm.visibleWorkflows[0]))
    }
}
