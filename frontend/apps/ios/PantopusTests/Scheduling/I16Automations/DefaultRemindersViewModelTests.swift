//
//  DefaultRemindersViewModelTests.swift
//  PantopusTests
//
//  Stream I16 — H1 Default Reminders projection tests.
//

import XCTest
@testable import Pantopus

@MainActor
final class DefaultRemindersViewModelTests: XCTestCase {
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

    private let emptyPage = #"{"page":{"id":"p1","owner_type":"user","slug":"sam","is_live":true,"is_paused":false}}"#

    func testSmartDefaultOnFirstOpen() async {
        SequencedURLProtocol.sequence = [.status(200, body: emptyPage)]
        let vm = DefaultRemindersViewModel(owner: .personal, client: makeClient())
        await vm.load()
        guard case .loaded = vm.phase else { return XCTFail("expected loaded") }
        XCTAssertTrue(vm.firstOpen)
        XCTAssertEqual(vm.reminderMinutes, [1440, 60])
    }

    func testLoadExistingSortedDescending() async {
        // swiftlint:disable:next line_length
        let page = #"{"page":{"id":"p1","owner_type":"user","slug":"sam","is_live":true,"is_paused":false,"reminder_minutes":[15,1440,30]}}"#
        SequencedURLProtocol.sequence = [.status(200, body: page)]
        let vm = DefaultRemindersViewModel(owner: .personal, client: makeClient())
        await vm.load()
        XCTAssertFalse(vm.firstOpen)
        XCTAssertEqual(vm.reminderMinutes, [1440, 30, 15])
    }

    func testToggleAddsAndRemoves() async {
        SequencedURLProtocol.sequence = [.status(200, body: emptyPage)]
        let vm = DefaultRemindersViewModel(owner: .personal, client: makeClient())
        await vm.load()
        XCTAssertFalse(vm.isOn(0))
        vm.toggle(0)
        XCTAssertTrue(vm.isOn(0))
        vm.toggle(0)
        XCTAssertFalse(vm.isOn(0))
    }

    func testAddCustomTime() async {
        SequencedURLProtocol.sequence = [.status(200, body: emptyPage)]
        let vm = DefaultRemindersViewModel(owner: .personal, client: makeClient())
        await vm.load()
        vm.customValue = 3
        vm.customUnit = .hours
        XCTAssertEqual(vm.customResolvedMinutes, 180)
        vm.addCustom()
        XCTAssertTrue(vm.reminderMinutes.contains(180))
    }

    /// The backend rejects a 6th reminder (`reminder_minutes` Joi `.max(5)`)
    /// and any offset past 30 days (items `.max(43200)`) — the VM caps
    /// client-side so Save can never 400.
    func testCapAtFiveRemindersAndClampCustomOffset() async {
        SequencedURLProtocol.sequence = [.status(200, body: emptyPage)]
        let vm = DefaultRemindersViewModel(owner: .personal, client: makeClient())
        await vm.load() // smart default: [1440, 60]
        vm.toggle(10080)
        vm.toggle(30)
        vm.toggle(15)
        XCTAssertEqual(vm.reminderMinutes.count, 5)
        XCTAssertTrue(vm.atCap)

        vm.toggle(0) // a sixth selection must not add
        XCTAssertEqual(vm.reminderMinutes.count, 5)
        XCTAssertFalse(vm.isOn(0))

        vm.customValue = 2
        vm.customUnit = .hours
        vm.addCustom() // Add custom is capped too
        XCTAssertEqual(vm.reminderMinutes.count, 5)
        XCTAssertFalse(vm.reminderMinutes.contains(120))

        // Selected rows still toggle OFF at cap (freeing a slot).
        vm.toggle(15)
        XCTAssertEqual(vm.reminderMinutes.count, 4)
        XCTAssertFalse(vm.atCap)

        // Custom offsets clamp to the 30-day per-item ceiling.
        vm.customValue = 999
        vm.customUnit = .days
        XCTAssertEqual(vm.customResolvedMinutes, 43200)
    }

    func testSavePutsReminders() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: emptyPage),
            .status(
                200,
                // swiftlint:disable:next line_length
                body: #"{"page":{"id":"p1","owner_type":"user","slug":"sam","is_live":true,"is_paused":false,"reminder_minutes":[1440,60]}}"#
            )
        ]
        let vm = DefaultRemindersViewModel(owner: .personal, client: makeClient())
        await vm.load()
        await vm.save()
        XCTAssertNil(vm.saveError)
        XCTAssertEqual(vm.reminderMinutes, [1440, 60])
    }
}
