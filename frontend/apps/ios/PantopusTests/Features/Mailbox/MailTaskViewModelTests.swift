//
//  MailTaskViewModelTests.swift
//  PantopusTests
//
//  A17.12 — exercises the Mail-task view-model: load seeds the right
//  frame, subtask taps persist + drive progress, mark-done / reopen flip
//  the frame, and the source / next-up taps resolve the right mail id.
//

import XCTest
@testable import Pantopus

@MainActor
final class MailTaskViewModelTests: XCTestCase {
    private func loaded(_ vm: MailTaskViewModel) async -> MailTaskContent {
        await vm.load()
        guard case let .loaded(content) = vm.state else {
            XCTFail("expected loaded state")
            return MailTaskSampleData.task()
        }
        return content
    }

    func test_load_activeSeed_isNotDone() async {
        let vm = MailTaskViewModel(taskId: "t_1", seed: .active)
        let content = await loaded(vm)
        XCTAssertFalse(content.isDone)
        XCTAssertEqual(content.finishedSteps, 1)
        XCTAssertEqual(content.totalSteps, 3)
    }

    func test_load_doneSeed_isDone_andFullProgress() async {
        let vm = MailTaskViewModel(taskId: "t_1", seed: .done)
        let content = await loaded(vm)
        XCTAssertTrue(content.isDone)
        XCTAssertEqual(content.finishedSteps, content.totalSteps)
        XCTAssertEqual(content.progress, 1.0, accuracy: 0.0001)
    }

    func test_toggleSubtask_persistsAndUpdatesProgress() async {
        let vm = MailTaskViewModel(taskId: "t_1", seed: .active)
        _ = await loaded(vm)
        vm.toggleSubtask(id: "photos")
        guard case let .loaded(content) = vm.state else { return XCTFail("not loaded") }
        XCTAssertEqual(content.finishedSteps, 2)
        XCTAssertTrue(content.subtasks.first { $0.id == "photos" }?.isDone ?? false)
    }

    func test_toggleSubtask_isIdempotentlyReversible() async {
        let vm = MailTaskViewModel(taskId: "t_1", seed: .active)
        _ = await loaded(vm)
        vm.toggleSubtask(id: "draft") // was done → now undone
        guard case let .loaded(content) = vm.state else { return XCTFail("not loaded") }
        XCTAssertEqual(content.finishedSteps, 0)
    }

    func test_markDone_flipsFrameAndToasts() async {
        let vm = MailTaskViewModel(taskId: "t_1", seed: .active)
        _ = await loaded(vm)
        vm.markDone()
        XCTAssertTrue(vm.isDone)
        XCTAssertEqual(vm.toast, "Marked done")
    }

    func test_reopen_returnsToOpenFrame() async {
        let vm = MailTaskViewModel(taskId: "t_1", seed: .done)
        _ = await loaded(vm)
        vm.reopen()
        XCTAssertFalse(vm.isDone)
        XCTAssertEqual(vm.toast, "Task reopened")
    }

    func test_toggleSubtask_noopWhenDone() async {
        let vm = MailTaskViewModel(taskId: "t_1", seed: .done)
        _ = await loaded(vm)
        vm.toggleSubtask(id: "photos")
        guard case let .loaded(content) = vm.state else { return XCTFail("not loaded") }
        XCTAssertEqual(content.finishedSteps, content.totalSteps)
    }

    func test_openSourceMail_resolvesSourceId() async {
        var opened: String?
        let vm = MailTaskViewModel(taskId: "t_1", seed: .active) { opened = $0 }
        _ = await loaded(vm)
        vm.openSourceMail()
        XCTAssertEqual(opened, "mail_412elm_hearing")
    }

    func test_openNextUp_resolvesNextUpId() async {
        var opened: String?
        let vm = MailTaskViewModel(taskId: "t_1", seed: .done) { opened = $0 }
        _ = await loaded(vm)
        vm.openNextUp()
        XCTAssertEqual(opened, "mail_riverside_linen")
    }

    func test_delegate_opensSheet() async {
        let vm = MailTaskViewModel(taskId: "t_1", seed: .active)
        _ = await loaded(vm)
        vm.delegate()
        XCTAssertTrue(vm.showsDelegateSheet)
    }

    func test_snooze_toasts() async {
        let vm = MailTaskViewModel(taskId: "t_1", seed: .active)
        _ = await loaded(vm)
        vm.snooze(optionId: "evening")
        XCTAssertEqual(vm.toast, "Snoozed · This evening")
    }
}
