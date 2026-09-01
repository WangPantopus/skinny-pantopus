//
//  TransferOwnershipViewModelTests.swift
//  PantopusTests
//
//  A13.4 — Behavioural unit tests for the Transfer Ownership form
//  view-model. Drives the state machine end-to-end via the injectable
//  biometric + transfer-executor seams: buyer-email validation, the
//  typed confirmation gate, the confirm sheet, and the commit /
//  failure branches — no view layer, no network.
//

import LocalAuthentication
import XCTest
@testable import Pantopus

@MainActor
final class TransferOwnershipViewModelTests: XCTestCase {
    func test_initial_state_is_not_ready_to_commit() {
        let viewModel = makeViewModel()
        XCTAssertFalse(viewModel.isReadyToCommit)
        XCTAssertEqual(viewModel.sheetPhase, .hidden)
        XCTAssertFalse(viewModel.confirmationMatches)
        XCTAssertFalse(viewModel.isDirty)
    }

    func test_confirmation_alone_does_not_arm_cta() {
        let viewModel = makeViewModel()
        viewModel.updateConfirmation("TRANSFER")
        XCTAssertTrue(viewModel.confirmationMatches)
        XCTAssertFalse(viewModel.isReadyToCommit, "A recipient email is still required")
    }

    func test_email_plus_confirmation_arms_cta() {
        let viewModel = makeViewModel()
        viewModel.updateRecipientEmail("buyer@example.com")
        viewModel.updateConfirmation("TRANSFER")
        XCTAssertTrue(viewModel.isReadyToCommit)
    }

    func test_malformed_email_is_rejected() {
        let viewModel = makeViewModel()
        viewModel.updateConfirmation("TRANSFER")
        for bad in ["buyer", "buyer@", "@example.com", "buyer @example.com", "buyer@example"] {
            viewModel.updateRecipientEmail(bad)
            XCTAssertFalse(viewModel.recipientIsValid, "\(bad) should not validate")
            XCTAssertFalse(viewModel.isReadyToCommit)
        }
    }

    func test_typing_wrong_phrase_does_not_arm_cta() {
        let viewModel = makeViewModel()
        viewModel.updateRecipientEmail("buyer@example.com")
        viewModel.updateConfirmation("transfer")
        XCTAssertFalse(viewModel.confirmationMatches)
        XCTAssertFalse(viewModel.isReadyToCommit)
    }

    func test_cta_label_uses_recipient_local_part() {
        let viewModel = makeViewModel()
        XCTAssertEqual(viewModel.ctaLabel, "Initiate transfer")
        viewModel.updateRecipientEmail("maya.fortune@example.com")
        XCTAssertEqual(viewModel.ctaLabel, "Transfer ownership to maya.fortune")
    }

    func test_confirm_sheet_parties_describe_a_full_transfer() {
        let viewModel = makeViewModel()
        viewModel.updateRecipientEmail("buyer@example.com")
        let parties = viewModel.confirmSheetParties
        XCTAssertEqual(parties.count, 2)
        XCTAssertEqual(parties[0].fromPercent, 100)
        XCTAssertEqual(parties[0].toPercent, 0)
        XCTAssertEqual(parties[1].fromPercent, 0)
        XCTAssertEqual(parties[1].toPercent, 100)
        XCTAssertEqual(parties[1].name, "buyer@example.com")
    }

    func test_present_confirm_sheet_only_when_ready() {
        let viewModel = makeViewModel()
        viewModel.presentConfirmSheet()
        XCTAssertEqual(viewModel.sheetPhase, .hidden)
        viewModel.updateRecipientEmail("buyer@example.com")
        viewModel.updateConfirmation("TRANSFER")
        viewModel.presentConfirmSheet()
        XCTAssertEqual(viewModel.sheetPhase, .visible)
    }

    func test_dismiss_confirm_sheet_resets_state() {
        let viewModel = makeArmedViewModel()
        viewModel.presentConfirmSheet()
        viewModel.dismissConfirmSheet()
        XCTAssertEqual(viewModel.sheetPhase, .hidden)
    }

    func test_authentication_failure_keeps_sheet_open_with_error() async {
        let viewModel = makeArmedViewModel(
            biometricResult: .failure(LAError(.authenticationFailed))
        )
        viewModel.presentConfirmSheet()
        await viewModel.authenticateAndCommit()
        XCTAssertEqual(viewModel.sheetPhase, .visible)
        XCTAssertNotNil(viewModel.biometricErrorMessage)
        XCTAssertFalse(viewModel.shouldDismiss)
    }

    func test_successful_authentication_commits_the_typed_email() async {
        let recorder = EmailRecorder()
        let viewModel = makeArmedViewModel(
            biometricResult: .success(())
        ) { email in
            recorder.value = email
            return "Transfer initiated."
        }
        viewModel.presentConfirmSheet()
        await viewModel.authenticateAndCommit()
        XCTAssertEqual(recorder.value, "buyer@example.com")
        XCTAssertEqual(viewModel.sheetPhase, .dismissing)
        XCTAssertTrue(viewModel.shouldDismiss)
        XCTAssertEqual(viewModel.toast?.kind, .success)
        XCTAssertEqual(viewModel.toast?.text, "Transfer initiated.")
    }

    func test_transfer_failure_surfaces_inline_error() async {
        let viewModel = makeArmedViewModel(
            biometricResult: .success(())
        ) { _ in throw StubError() }
        viewModel.presentConfirmSheet()
        await viewModel.authenticateAndCommit()
        XCTAssertEqual(viewModel.sheetPhase, .visible)
        XCTAssertNotNil(viewModel.biometricErrorMessage)
        XCTAssertFalse(viewModel.shouldDismiss)
    }

    func test_authenticate_no_op_when_sheet_hidden() async {
        let viewModel = makeArmedViewModel(biometricResult: .success(()))
        await viewModel.authenticateAndCommit()
        XCTAssertEqual(viewModel.sheetPhase, .hidden)
        XCTAssertFalse(viewModel.shouldDismiss)
    }

    func test_dirty_flag_picks_up_recipient_typing() {
        let viewModel = makeViewModel()
        XCTAssertFalse(viewModel.isDirty)
        viewModel.updateRecipientEmail("b")
        XCTAssertTrue(viewModel.isDirty)
    }

    // MARK: - Helpers

    private struct StubError: Error {}

    /// Reference box so the escaping executor closure can record its
    /// argument without capturing a `var`.
    private final class EmailRecorder: @unchecked Sendable {
        var value: String?
    }

    private func makeViewModel(
        biometricResult: Result<Void, Error>? = nil,
        executor: (@MainActor (String) async throws -> String)? = nil
    ) -> TransferOwnershipViewModel {
        TransferOwnershipViewModel(
            homeId: "preview",
            biometricEvaluator: { _ in biometricResult ?? .success(()) },
            transferExecutor: executor ?? { _ in "Transfer initiated." }
        )
    }

    /// A view-model that has already loaded and been filled in, so the
    /// commit path is reachable.
    private func makeArmedViewModel(
        biometricResult: Result<Void, Error>? = nil,
        executor: (@MainActor (String) async throws -> String)? = nil
    ) -> TransferOwnershipViewModel {
        let viewModel = makeViewModel(biometricResult: biometricResult, executor: executor)
        viewModel.updateRecipientEmail("buyer@example.com")
        viewModel.updateConfirmation("TRANSFER")
        return viewModel
    }
}
