//
//  PostcardVerificationViewModelTests.swift
//  PantopusTests
//
//  Covers the A12.7 sibling status surface: the always-live code field
//  (RN parity — the delivery stage is chrome, never a gate), the
//  "I already have a code" escape hatch, verify happy path and
//  wrong-code error path, and the .verified outbound event payload.
//

import Foundation
import XCTest
@testable import Pantopus

@MainActor
final class PostcardVerificationViewModelTests: XCTestCase {
    private func makeVM(
        homeId: String = "home-1",
        stage: PostcardDeliveryStage = .inTransit,
        expectedCode: String = "4Q2K7B"
    ) -> PostcardVerificationViewModel {
        PostcardVerificationViewModel(
            homeId: homeId,
            stage: stage,
            expectedCode: expectedCode,
            submitDelayNanos: 0
        )
    }

    private func waitFor(
        _ description: String = "predicate",
        timeout: TimeInterval = 5.0,
        _ predicate: @MainActor () -> Bool
    ) async {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if predicate() { return }
            try? await Task.sleep(nanoseconds: 25_000_000)
        }
        XCTFail("Timed out waiting for \(description)")
    }

    // MARK: - Code entry is never gated on delivery

    func testInTransitStageStillAllowsCodeEntry() {
        let vm = makeVM(stage: .inTransit)
        XCTAssertTrue(vm.isCodeInputUnlocked)
        XCTAssertFalse(vm.primaryCTAEnabled, "Empty code should keep the CTA disabled")
    }

    func testInTransitFullCodeEnablesCTA() {
        let vm = makeVM(stage: .inTransit)
        vm.updateCode("4Q2K7B")
        XCTAssertTrue(vm.primaryCTAEnabled)
    }

    func testRealHomeIdDoesNotLockTheField() {
        // Regression: the old sample helper only unlocked home ids
        // containing "delivered", so every production home was locked.
        let vm = makeVM(homeId: "0f0d7f0e-1c3a-4a1e-9a2b-6f0f7d6f1a2c")
        XCTAssertTrue(vm.isCodeInputUnlocked)
        vm.updateCode("4Q2K7B")
        XCTAssertTrue(vm.primaryCTAEnabled)
    }

    func testDeliveredStageStartsInCodeEntryFrame() {
        let vm = makeVM(stage: .delivered)
        XCTAssertTrue(vm.showsCodeEntryFrame)
    }

    func testHaveCodeEscapeHatchFlipsFrame() {
        let vm = makeVM(stage: .inTransit)
        XCTAssertFalse(vm.showsCodeEntryFrame)
        vm.markHasCode()
        XCTAssertTrue(vm.showsCodeEntryFrame)
    }

    func testSetStageTransitions() {
        let vm = makeVM(stage: .inTransit)
        vm.setStage(.delivered)
        XCTAssertEqual(vm.stage, .delivered)
        XCTAssertNotNil(vm.content.deliveredOn)
        XCTAssertTrue(vm.showsCodeEntryFrame)
    }

    // MARK: - Code typing

    func testUpdateCodeUppercasesAndClamps() {
        let vm = makeVM(stage: .delivered)
        vm.updateCode("abc123extra")
        XCTAssertEqual(vm.codeInput, "ABC123")
    }

    // MARK: - Verify

    func testVerifyCorrectCodeFiresVerifiedEvent() async {
        let vm = makeVM(homeId: "home-42", stage: .delivered)
        vm.updateCode("4Q2K7B")
        vm.verifyTapped()
        await waitFor("verified event fired") {
            vm.pendingEvent == .verified(homeId: "home-42")
        }
        XCTAssertEqual(vm.submitState, .submitted)
    }

    func testVerifyWrongCodeSurfacesErrorAndClears() async {
        let vm = makeVM(stage: .delivered, expectedCode: "ABCDEF")
        vm.updateCode("4Q2K7B")
        vm.verifyTapped()
        await waitFor("submit state is .error") {
            if case .error = vm.submitState { return true }
            return false
        }
        XCTAssertEqual(vm.codeInput, "", "Wrong code should clear the input so the user can retype")
        XCTAssertNil(vm.pendingEvent)
    }

    func testVerifyFromInTransitFrameStillSubmits() async {
        let vm = makeVM(homeId: "home-7", stage: .inTransit)
        vm.updateCode("4Q2K7B")
        vm.verifyTapped()
        await waitFor("verified event fired from the in-transit frame") {
            vm.pendingEvent == .verified(homeId: "home-7")
        }
    }

    func testShortCodeDoesNotSubmit() {
        let vm = makeVM(stage: .delivered)
        vm.updateCode("4Q2")
        vm.verifyTapped()
        XCTAssertEqual(vm.submitState, .idle)
        XCTAssertNil(vm.pendingEvent)
    }

    // MARK: - Resend

    func testRequestNewCodeClearsCodeInput() {
        let vm = makeVM(stage: .delivered)
        vm.updateCode("4Q2K7B")
        vm.requestNewCode()
        XCTAssertTrue(vm.codeInput.isEmpty)
    }

    // MARK: - Failure routing (RN parity)

    /// Live seam — no `expectedCode`, so `verify()` hits the backend.
    private func makeLiveVM(homeId: String = "home-1") -> PostcardVerificationViewModel {
        PostcardVerificationViewModel(
            homeId: homeId,
            stage: .delivered,
            expectedCode: nil,
            api: APIClient(
                environment: .current,
                session: SequencedURLProtocol.makeSession(),
                retryPolicy: .none
            ),
            submitDelayNanos: 0
        )
    }

    func testExpiredCodeRoutesBackToTheRequestStep() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(410, body: #"{"error":"Verification code has expired. Request a new one."}"#)
        ]
        let vm = makeLiveVM()
        vm.updateCode("4Q2K7B")
        vm.verifyTapped()
        await waitFor("needsNewCode") { vm.needsNewCode }
        XCTAssertFalse(vm.showsCodeEntryFrame)
        XCTAssertTrue(vm.codeInput.isEmpty)
    }

    func testTooManyAttemptsRoutesBackToTheRequestStep() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(429, body: #"{"error":"Too many attempts. Request a new code."}"#)
        ]
        let vm = makeLiveVM()
        vm.updateCode("4Q2K7B")
        vm.verifyTapped()
        await waitFor("needsNewCode") { vm.needsNewCode }
        XCTAssertFalse(vm.showsCodeEntryFrame)
    }

    func testAttemptsRemainingIsSurfacedOnceItGetsTight() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(400, body: #"{"error":"Invalid verification code","attempts_remaining":2}"#)
        ]
        let vm = makeLiveVM()
        vm.updateCode("4Q2K7B")
        vm.verifyTapped()
        await waitFor("attemptsRemaining") { vm.attemptsRemaining != nil }
        XCTAssertEqual(vm.attemptsRemaining, 2)
        XCTAssertEqual(vm.attemptsRemainingLabel, "2 attempts remaining")
        // A wrong-but-live code keeps the user on the entry frame.
        XCTAssertTrue(vm.showsCodeEntryFrame)
    }

    func testRequestingAFreshCodeReturnsToTheEntryFrame() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.sequence = [
            .status(410, body: #"{"error":"Verification code has expired."}"#),
            .status(201, body: #"{"message":"Verification postcard requested.","postcard":{"id":"pc-1"}}"#)
        ]
        let vm = makeLiveVM()
        vm.updateCode("4Q2K7B")
        vm.verifyTapped()
        await waitFor("needsNewCode") { vm.needsNewCode }
        XCTAssertFalse(vm.showsCodeEntryFrame)
        vm.requestNewCode()
        await waitFor("fresh code requested") { !vm.needsNewCode }
        XCTAssertTrue(vm.showsCodeEntryFrame)
    }
}
