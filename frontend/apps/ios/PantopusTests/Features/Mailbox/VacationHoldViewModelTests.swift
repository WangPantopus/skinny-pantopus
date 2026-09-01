//
//  VacationHoldViewModelTests.swift
//  PantopusTests
//
//  A14.8 — projection coverage for the Vacation Hold view-model. Asserts
//  scope-toggle behaviour, civic-row lock, span recompute when dates
//  change, and the scheduling → active mode flip on Save.
//

import Foundation
import XCTest
@testable import Pantopus

@MainActor
final class VacationHoldViewModelTests: XCTestCase {
    // MARK: - Scheduling seed matches the design fixtures

    func test_schedulingSeed_matchesSampleDraft() {
        let vm = VacationHoldViewModel(seed: .scheduling)
        guard case let .scheduling(draft) = vm.mode else {
            return XCTFail("Expected scheduling, got \(vm.mode)")
        }
        XCTAssertEqual(draft.spanDays, 13, "Sample fixture should match the JSX 13-day span")
        XCTAssertTrue(draft.isValid)
        XCTAssertEqual(draft.scopes.count, 4)
        XCTAssertTrue(draft.scopes.contains { $0.kind == .civic && $0.isLocked })
        XCTAssertEqual(vm.trailingActionLabel, "Save")
        XCTAssertTrue(vm.trailingActionEnabled)
    }

    func test_activeSeed_matchesSampleHold() {
        let vm = VacationHoldViewModel(seed: .active)
        guard case let .active(hold) = vm.mode else {
            return XCTFail("Expected active, got \(vm.mode)")
        }
        XCTAssertEqual(hold.daysLeft, 5)
        XCTAssertEqual(hold.untilLabel, "Jun 9")
        XCTAssertEqual(hold.stats.count, 3)
        XCTAssertEqual(hold.heldItems.count, 4)
        XCTAssertEqual(vm.trailingActionLabel, "Edit")
        XCTAssertTrue(vm.trailingActionEnabled)
    }

    // MARK: - Toggling scopes

    func test_toggleScope_flipsMail() {
        let vm = VacationHoldViewModel(seed: .scheduling)
        vm.toggleScope(.mail, isOn: false)
        guard case let .scheduling(draft) = vm.mode else {
            return XCTFail("Expected scheduling")
        }
        XCTAssertEqual(draft.scopes.first { $0.kind == .mail }?.isOn, false)
    }

    func test_civicLockedScope_isImmutable() {
        let vm = VacationHoldViewModel(seed: .scheduling)
        vm.toggleScope(.civic, isOn: true)
        guard case let .scheduling(draft) = vm.mode else {
            return XCTFail("Expected scheduling")
        }
        // Civic stays locked + off — toggling does nothing.
        let civic = draft.scopes.first { $0.kind == .civic }
        XCTAssertTrue(civic?.isLocked ?? false)
        XCTAssertEqual(civic?.isOn, false)
    }

    func test_saveDisabledWhenAllScopesOff() {
        let vm = VacationHoldViewModel(seed: .scheduling)
        vm.toggleScope(.mail, isOn: false)
        vm.toggleScope(.packages, isOn: false)
        vm.toggleScope(.marketplacePickups, isOn: false)
        XCTAssertFalse(vm.trailingActionEnabled, "All scopes off → form invalid → Save disabled")
    }

    // MARK: - Date span recompute

    func test_setFromDate_recomputesSpan() {
        let vm = VacationHoldViewModel(seed: .scheduling)
        let calendar = Calendar(identifier: .gregorian)
        var comps = DateComponents()
        comps.year = 2026
        comps.month = 6
        comps.day = 5 // 5 days before 6/9 = 5-day span
        let newFrom = calendar.date(from: comps) ?? Date()
        vm.setFromDate(newFrom)
        guard case let .scheduling(draft) = vm.mode else {
            return XCTFail("Expected scheduling")
        }
        XCTAssertEqual(draft.spanDays, 5)
    }

    func test_setToDateBeforeFrom_clampsToFrom() {
        let vm = VacationHoldViewModel(seed: .scheduling)
        guard case let .scheduling(initial) = vm.mode else {
            return XCTFail("Expected scheduling")
        }
        let calendar = Calendar(identifier: .gregorian)
        let earlier = calendar.date(byAdding: .day, value: -5, to: initial.fromDate) ?? Date()
        vm.setToDate(earlier)
        guard case let .scheduling(draft) = vm.mode else {
            return XCTFail("Expected scheduling")
        }
        XCTAssertEqual(draft.toDate, initial.fromDate, "Setting toDate before fromDate clamps it forward")
    }

    // MARK: - Save flips to active

    func test_save_flipsSchedulingToActive() async {
        let vm = VacationHoldViewModel(seed: .scheduling)
        await vm.tapTrailingAction()
        guard case .active = vm.mode else {
            return XCTFail("Expected active after save, got \(vm.mode)")
        }
        XCTAssertEqual(vm.trailingActionLabel, "Edit")
    }

    func test_edit_flipsActiveToScheduling() async {
        let vm = VacationHoldViewModel(seed: .active)
        await vm.tapTrailingAction()
        guard case .scheduling = vm.mode else {
            return XCTFail("Expected scheduling after tapping Edit")
        }
        XCTAssertEqual(vm.trailingActionLabel, "Save")
    }

    func test_endHoldEarly_flipsActiveToScheduling() async {
        let vm = VacationHoldViewModel(seed: .active)
        await vm.endHoldEarly()
        guard case .scheduling = vm.mode else {
            return XCTFail("Expected scheduling after ending the hold early")
        }
        XCTAssertEqual(vm.trailingActionLabel, "Save")
    }

    // MARK: - Forwarding toggle

    func test_toggleForwardingOff_clearsAddressRow() {
        let vm = VacationHoldViewModel(seed: .scheduling)
        vm.toggleForwarding(false)
        guard case let .scheduling(draft) = vm.mode else {
            return XCTFail("Expected scheduling")
        }
        XCTAssertFalse(draft.forwardingEnabled)
    }
}
