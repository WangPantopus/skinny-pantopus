//
//  VerifyLandlordWizardViewModelTests.swift
//  PantopusTests
//
//  Covers the verify-landlord wizard state machine: step transitions,
//  form validation (email format · lease unit mismatch · PM-required-
//  when-toggled-on · move-in date format), the error-summary count, and
//  the three submit outcomes:
//    201 -> .sent, 409 -> .sent (existing lease), 400 -> postcard fallback.
//

import Foundation
import XCTest
@testable import Pantopus

@MainActor
final class VerifyLandlordWizardViewModelTests: XCTestCase {
    // MARK: - Helpers

    private func makeVM(
        homeId: String = "home-1",
        form: VerifyLandlordForm? = nil,
        startContent: VerifyLandlordStartContent? = nil,
        postcardRequester: VerifyLandlordWizardViewModel.PostcardRequester? = nil,
        approvalRequester: VerifyLandlordWizardViewModel.ApprovalRequester? = nil
    ) -> VerifyLandlordWizardViewModel {
        VerifyLandlordWizardViewModel(
            homeId: homeId,
            startContent: startContent,
            form: form,
            submitDelayNanos: 0,
            postcardRequester: postcardRequester,
            approvalRequester: approvalRequester ?? { _ in .success(Self.stubLease) }
        )
    }

    /// Minimal `HomeLease` row shaped like the 201 body from
    /// `backend/routes/landlordTenant.js:587`.
    private static let stubLease: TenantLeaseDTO = {
        let json = """
        {
          "id": "lease-1",
          "home_id": "home-1",
          "state": "pending",
          "source": "tenant_request",
          "start_at": "2026-04-01T00:00:00.000Z",
          "end_at": null,
          "created_at": "2026-03-04T18:12:00.000Z",
          "metadata": { "message": "Hi, I'm the new tenant." }
        }
        """
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(TenantLeaseDTO.self, from: Data(json.utf8))
    }()

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

    // MARK: - Step machine

    func testInitialStateIsStart() {
        let vm = makeVM()
        XCTAssertEqual(vm.currentStep, .start)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Start verification")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
        XCTAssertEqual(vm.chrome.leading, .close)
    }

    func testPrimaryFromStartAdvancesToDetails() {
        let vm = makeVM()
        vm.primaryTapped()
        XCTAssertEqual(vm.currentStep, .details)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Submit")
        XCTAssertEqual(vm.chrome.leading, .back)
    }

    func testBackOnDetailsReturnsToStart() {
        let vm = makeVM()
        vm.primaryTapped() // start -> details
        vm.leadingTapped() // details -> start (back)
        XCTAssertEqual(vm.currentStep, .start)
        XCTAssertNil(vm.errors, "Returning to Start should clear any pending validation chips")
    }

    func testLeadingOnStartDismisses() {
        let vm = makeVM()
        vm.leadingTapped()
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }

    // MARK: - Variants

    func testFastTrackVariantSurfacesExistingLandlord() {
        let vm = makeVM(homeId: "home-fast-track")
        XCTAssertTrue(vm.startContent.isFastTrack)
        XCTAssertNotNil(vm.startContent.existingLandlord)
    }

    func testCanonicalVariantHasNoExistingLandlord() {
        let vm = makeVM()
        XCTAssertFalse(vm.startContent.isFastTrack)
        XCTAssertNil(vm.startContent.existingLandlord)
    }

    func testSetVariantSwapsContent() {
        let vm = makeVM()
        vm.setVariant(.fastTrack)
        XCTAssertEqual(vm.startContent.variant, .fastTrack)
        vm.setVariant(.canonical)
        XCTAssertEqual(vm.startContent.variant, .canonical)
    }

    // MARK: - Validation

    func testValidationCatchesMissingTLD() {
        var form = VerifyLandlordSampleData.populatedForm
        form.email = "mira@elmstholdings"
        let errors = form.validate()
        XCTAssertEqual(errors.email, "Missing top-level domain")
    }

    func testValidationCatchesLeaseUnitMismatch() {
        let form = VerifyLandlordSampleData.errorForm
        let errors = form.validate()
        XCTAssertNotNil(errors.lease, "Sample errored form should flag a unit mismatch")
        XCTAssertEqual(errors.email, "Missing top-level domain")
        XCTAssertEqual(errors.count, 2)
    }

    func testValidationCountSummary() {
        let errors = VerifyLandlordValidationErrors(
            email: "Missing top-level domain",
            lease: "Unit mismatch"
        )
        XCTAssertEqual(errors.count, 2)
        XCTAssertEqual(errors.compactSummary, "Email format · Lease unit mismatch")
    }

    func testPMRequiredWhenToggleOn() {
        var form = VerifyLandlordSampleData.populatedForm
        form.pmEnabled = true
        form.pmName = ""
        form.pmEmail = ""
        let errors = form.validate()
        XCTAssertEqual(errors.pmName, "Required")
        XCTAssertEqual(errors.pmEmail, "Required")
    }

    func testPMNotRequiredWhenToggleOff() {
        var form = VerifyLandlordSampleData.populatedForm
        form.pmEnabled = false
        form.pmName = ""
        form.pmEmail = ""
        let errors = form.validate()
        XCTAssertNil(errors.pmName)
        XCTAssertNil(errors.pmEmail)
    }

    // MARK: - Submit state machine

    func testSubmitBlockedWhenErrorsExist() async {
        let vm = makeVM(form: VerifyLandlordSampleData.errorForm)
        vm.primaryTapped() // -> details
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .details, "Submit should not advance with errors")
        if case let .error(message) = vm.submitState {
            XCTAssertTrue(message.contains("Fix"))
        } else {
            XCTFail("Expected .error submit state when validation fails, got \(vm.submitState)")
        }
        XCTAssertEqual(vm.errors?.count, 2)
        XCTAssertNil(vm.pendingEvent)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "CTA should disable while errors remain")
    }

    func testSubmitPostsApprovalRequestAndLandsOnSentStep() async {
        var captured: TenantRequestApprovalRequest?
        var form = VerifyLandlordSampleData.populatedForm
        form.moveInDate = "2026-04-01"
        form.messageToLandlord = "Hi, I'm the new tenant."
        let vm = makeVM(
            homeId: "home-1",
            form: form
        ) { request in
            captured = request
            return .success(Self.stubLease)
        }
        vm.primaryTapped() // start -> details
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .sent)
        XCTAssertEqual(vm.submitState, .submitted)
        XCTAssertEqual(vm.approvalResult?.kind, .submitted)
        XCTAssertEqual(captured?.homeId, "home-1")
        XCTAssertEqual(captured?.startAt, "2026-04-01T00:00:00.000Z")
        XCTAssertTrue(captured?.message?.contains("Hi, I'm the new tenant.") == true)
        XCTAssertTrue(
            captured?.message?.contains("Elm Street Holdings LLC") == true,
            "Landlord details must travel with the request instead of being discarded"
        )
        XCTAssertNil(vm.pendingEvent, "A landlord request should not jump to the postcard tracker")
    }

    func testSubmitWithoutVerifiedLandlordFallsBackToPostcard() async {
        let vm = makeVM(
            homeId: "home-1",
            form: VerifyLandlordSampleData.populatedForm,
            postcardRequester: { .success(()) },
            approvalRequester: { _ in
                .failure(
                    APIError.clientError(
                        status: 400,
                        message: "{\"error\":\"This property has no verified landlord. Cannot submit a lease request.\"}"
                    )
                )
            }
        )
        vm.primaryTapped()
        await vm.submit()
        await waitFor("pendingEvent == .openPostcardVerification") {
            vm.pendingEvent == .openPostcardVerification(homeId: "home-1")
        }
        XCTAssertEqual(vm.submitState, .submitted)
    }

    func testSubmitSurfacesExistingPendingRequest() async {
        let vm = makeVM(
            form: VerifyLandlordSampleData.populatedForm
        ) { _ in
            .failure(
                APIError.clientError(
                    status: 409,
                    message: "{\"error\":\"You already have a pending request for this home\"}"
                )
            )
        }
        vm.primaryTapped()
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .sent)
        XCTAssertEqual(vm.approvalResult?.kind, .alreadyPending)
        XCTAssertEqual(vm.approvalResult?.serverMessage, "You already have a pending request for this home")
    }

    func testSubmitSurfacesExistingActiveLease() async {
        let vm = makeVM(
            form: VerifyLandlordSampleData.populatedForm
        ) { _ in
            .failure(
                APIError.clientError(
                    status: 409,
                    message: "{\"error\":\"You already have an active lease at this home\"}"
                )
            )
        }
        vm.primaryTapped()
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .sent)
        XCTAssertEqual(vm.approvalResult?.kind, .alreadyActive)
    }

    func testSentStepSecondaryStartsPostcardFallback() async {
        let vm = makeVM(
            homeId: "home-9",
            form: VerifyLandlordSampleData.populatedForm
        ) { .success(()) }
        vm.primaryTapped()
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .sent)
        XCTAssertEqual(vm.chrome.secondaryCTA?.label, "Mail me a code")
        await vm.startPostcardFallback()
        XCTAssertEqual(vm.pendingEvent, .openPostcardVerification(homeId: "home-9"))
    }

    func testMoveInDateMustBeISOShaped() {
        var form = VerifyLandlordSampleData.populatedForm
        form.moveInDate = "04/01/2026"
        XCTAssertEqual(form.validate().moveInDate, "Use YYYY-MM-DD")
        form.moveInDate = "2026-04-01"
        XCTAssertNil(form.validate().moveInDate)
        form.moveInDate = ""
        XCTAssertNil(form.validate().moveInDate, "Blank move-in date is allowed")
    }

    func testCTADisabledWhenErrorsPresent() async {
        let vm = makeVM(form: VerifyLandlordSampleData.errorForm)
        vm.primaryTapped()
        XCTAssertTrue(vm.chrome.primaryCTAEnabled, "CTA should start enabled before validation runs")
        await vm.submit()
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "CTA should disable after validation flags errors")
    }

    // MARK: - Field mutations

    func testSetPMEnabledClearsPMFieldsWhenToggledOff() {
        let vm = makeVM(form: VerifyLandlordSampleData.populatedForm)
        XCTAssertEqual(vm.form.pmName, "Daniel Ortega")
        vm.setPMEnabled(false)
        XCTAssertTrue(vm.form.pmName.isEmpty)
        XCTAssertTrue(vm.form.pmEmail.isEmpty)
        XCTAssertTrue(vm.form.pmPhone.isEmpty)
    }

    func testFieldUpdatesReRunValidationWhenAlreadyShown() async {
        let vm = makeVM(form: VerifyLandlordSampleData.errorForm)
        vm.primaryTapped()
        await vm.submit()
        let originalCount = vm.errors?.count ?? 0
        XCTAssertEqual(originalCount, 2)
        vm.setEmail("mira@elmstholdings.com")
        XCTAssertEqual(vm.errors?.count, 1, "Fixing the email should drop the error count by 1")
    }

    func testFieldUpdatesDoNotShowErrorsUntilSubmitAttempt() {
        let vm = makeVM(form: VerifyLandlordSampleData.errorForm)
        vm.primaryTapped()
        XCTAssertNil(vm.errors)
        vm.setEmail("typing@")
        XCTAssertNil(vm.errors, "Errors must not materialise until the user attempts submit")
    }
}
