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

    static func syntheticSessionIdentity() -> String? {
        "synthetic-session"
    }

    func makeVM(
        homeId: String = "home-1",
        form: VerifyLandlordForm? = nil,
        startContent: VerifyLandlordStartContent? = nil,
        approvalRequester: VerifyLandlordWizardViewModel.ApprovalRequester? = nil
    ) -> VerifyLandlordWizardViewModel {
        VerifyLandlordWizardViewModel(
            homeId: homeId,
            startContent: startContent,
            form: form,
            submitDelayNanos: 0,
            sessionIdentity: VerifyLandlordWizardViewModelTests.syntheticSessionIdentity,
            approvalRequester: approvalRequester ?? { _ in .success(Self.stubLease) }
        )
    }

    /// Minimal `HomeLease` row shaped like the 201 body from
    /// `backend/routes/landlordTenant.js:587`.
    static let stubLease: TenantLeaseDTO = {
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

    // MARK: - Step machine

    func testInitialStateIsStart() {
        let vm = makeVM()
        XCTAssertFalse(vm.startContent.homeChip.label.contains("412 Elm"))
        XCTAssertNil(vm.startContent.existingLandlord)
        XCTAssertEqual(vm.form, VerifyLandlordForm())
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
        let vm = makeVM(startContent: VerifyLandlordSampleData.fastTrack)
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

    func testSubmitWithoutVerifiedLandlordFallsBackToPostcard() async {
        let vm = makeVM(
            homeId: "home-1",
            form: VerifyLandlordSampleData.populatedForm
        ) { _ in
            .failure(
                APIError.clientError(
                    status: 400,
                    message: "{\"error\":\"This property has no verified landlord. Cannot submit a lease request.\"}"
                )
            )
        }
        vm.primaryTapped()
        await vm.submit()
        await waitFor("pendingEvent == .openPostcardVerification") {
            vm.pendingEvent == .openPostcardVerification(homeId: "home-1")
        }
        XCTAssertEqual(vm.submitState, .idle)
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

    func testUnrelatedRequestFailuresKeepFormWithoutClaimingLeaseOrMailFallback() async {
        let failures: [APIError] = [
            .clientError(status: 400, message: "This home is unavailable for lease decisions"),
            .clientError(status: 400, message: "This is a multi-unit building. A unit number is required."),
            .clientError(status: 400, message: "End date must be after the start date and must not have expired"),
            .notFound,
            .clientError(status: 409, message: "The current request needs review")
        ]
        for failure in failures {
            let vm = makeVM(form: VerifyLandlordSampleData.populatedForm) { _ in .failure(failure) }
            vm.primaryTapped()
            vm.setMessageToLandlord("Keep my entered message")
            await vm.submit()
            XCTAssertEqual(vm.currentStep, .details, failure.localizedDescription)
            XCTAssertEqual(vm.submitState, .error(message: failure.localizedDescription))
            XCTAssertNil(vm.pendingEvent)
            XCTAssertNil(vm.approvalResult)
            XCTAssertEqual(vm.form.messageToLandlord, "Keep my entered message")
        }
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
        )
        vm.primaryTapped()
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .sent)
        XCTAssertEqual(vm.chrome.secondaryCTA?.label, "Review mail verification")
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

    func testMoveInDateMustExistInTheGregorianCalendar() {
        var form = VerifyLandlordSampleData.populatedForm
        for value in ["2026-02-30", "2026-02-29", "2026-04-31", "1900-02-29", "2100-02-29", "1899-12-31", "2026-+9-14"] {
            form.moveInDate = value
            XCTAssertNotNil(form.validate().moveInDate, value)
            XCTAssertNil(form.startAtISO, value)
        }
        for value in ["2024-02-29", "2000-02-29", "2026-09-14", "1900-01-01"] {
            form.moveInDate = value
            XCTAssertNil(form.validate().moveInDate, value)
            XCTAssertEqual(form.startAtISO, "\(value)T00:00:00.000Z")
        }
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

    func testPostcardFallbackOnlyOpensReviewWithoutSendingMail() async {
        URLProtocolStub.reset()
        defer { URLProtocolStub.reset() }
        let vm = VerifyLandlordWizardViewModel(
            homeId: "home-1",
            api: APIClient(environment: .current, session: TestSession.make()),
            submitDelayNanos: 0,
            sessionIdentity: VerifyLandlordWizardViewModelTests.syntheticSessionIdentity
        )
        await vm.startPostcardFallback()
        XCTAssertEqual(vm.pendingEvent, .openPostcardVerification(homeId: "home-1"))
        XCTAssertEqual(vm.submitState, .idle, "Opening review must not claim a mailing or approval was submitted")
        XCTAssertTrue(URLProtocolStub.capturedRequests.isEmpty, "Address confirmation must precede every mailing command")
    }
}

@MainActor
extension VerifyLandlordWizardViewModelTests {
    func testSubmitPostsApprovalRequestAndLandsOnSentStep() async {
        var captured: TenantRequestApprovalRequest?
        var form = VerifyLandlordSampleData.populatedForm
        XCTAssertFalse(form.composedMessage?.contains("Lease on file:") == true)
        form.lease = nil
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
        vm.attachLeaseTapped()
        XCTAssertNil(vm.form.lease, "Attach must not fabricate an uploaded document")
        XCTAssertTrue(vm.attachment.showsPicker)
        vm.attachment.received(.success([]))
        XCTAssertEqual(vm.submitState, .idle)
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .sent)
        XCTAssertEqual(vm.submitState, .submitted)
        XCTAssertEqual(vm.approvalResult?.kind, .submitted)
        XCTAssertEqual(captured?.homeId, "home-1")
        XCTAssertEqual(captured?.startAt, "2026-04-01T00:00:00.000Z")
        XCTAssertTrue(captured?.message?.contains("Hi, I'm the new tenant.") == true)
        XCTAssertFalse(captured?.message?.contains("Lease on file:") == true)
        XCTAssertTrue(
            captured?.message?.contains("Elm Street Holdings LLC") == true,
            "Landlord details must travel with the request instead of being discarded"
        )
        XCTAssertNil(vm.pendingEvent, "A landlord request should not jump to the postcard tracker")
    }

    func testNetworkSubmissionReadsContextBeforeEachAttempt() async throws {
        URLProtocolStub.reset()
        let marker = FileManager.default.temporaryDirectory.appendingPathComponent("lease-context-" + UUID().uuidString)
        defer {
            URLProtocolStub.reset()
            try? FileManager.default.removeItem(at: marker)
        }
        let api = APIClient(session: TestSession.make(), retryPolicy: .none)
        let auth = AuthManager(
            store: InMemorySecureStore(),
            apiClient: api,
            installMarker: InstallMarker(directory: marker),
            allowSecureEnclave: false
        )
        URLProtocolStub.stub(path: "/api/v1/tenant/home/home-1/status", responses: [
            .json(#"{"home_id":"home-1","request_context":{"home_id":"home-1","actor_id":"actor-1","lease_id":null,"lease_state":null}}"#),
            .json(
                #"""
                {"home_id":"home-1","request_context":{
                  "home_id":"home-1","actor_id":"actor-1","lease_id":"canceled-lease","lease_state":"canceled"}}
                """#
            )
        ])
        URLProtocolStub.stub(path: "/api/v1/tenant/request-approval", responses: [
            .json(#"{"error":"Reply unavailable"}"#, status: 503),
            .json(#"{"lease":{"id":"new-lease","home_id":"home-1","state":"pending"}}"#, status: 201)
        ])
        var form = VerifyLandlordSampleData.populatedForm
        form.messageToLandlord = "Retain this request"
        let vm = VerifyLandlordWizardViewModel(
            homeId: "home-1",
            form: form,
            api: api,
            submitDelayNanos: 0,
            sessionIdentity: VerifyLandlordWizardViewModelTests.syntheticSessionIdentity
        )
        vm.primaryTapped()
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .details)
        XCTAssertEqual(vm.form.messageToLandlord, "Retain this request")
        XCTAssertNil(vm.pendingEvent)
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .sent)
        let requests = URLProtocolStub.capturedRequests.filter { $0.url?.path.hasPrefix("/api/v1/tenant/") == true }
        XCTAssertEqual(requests.map(\.httpMethod), ["GET", "POST", "GET", "POST"])
        XCTAssertEqual(requests.first?.cachePolicy, .reloadIgnoringLocalAndRemoteCacheData)
        let posts = requests.filter { $0.httpMethod == "POST" }
        XCTAssertEqual(posts.count, 2)
        if posts.count == 2 {
            let bodies = try posts.map { request -> [String: Any] in
                let data = try XCTUnwrap(request.authTestBodyData())
                let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
                attachment.name = "Lease request with observed context"
                attachment.lifetime = .keepAlways
                add(attachment)
                return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
            }
            let first = try XCTUnwrap(bodies[0]["request_context"] as? [String: Any])
            let second = try XCTUnwrap(bodies[1]["request_context"] as? [String: Any])
            XCTAssertEqual(first["actor_id"] as? String, "actor-1")
            XCTAssertNil(first["lease_id"] as? String)
            XCTAssertEqual(second["lease_id"] as? String, "canceled-lease")
            XCTAssertEqual(second["lease_state"] as? String, "canceled")
            XCTAssertEqual(bodies[0]["message"] as? String, bodies[1]["message"] as? String)
        }
        await auth.awaitBackgroundWork()
    }

    func testNetworkStatusFailureOrMismatchKeepsFormWithoutPosting() async {
        let cases: [(Int, String)] = [
            (503, #"{"error":"Unavailable"}"#),
            (200, #"{"home_id":"home-1"}"#),
            (200, #"{"home_id":"other-home","request_context":{"home_id":"home-1","actor_id":"actor-1"}}"#),
            (200, #"{"home_id":"home-1","request_context":{"home_id":"other-home","actor_id":"actor-1"}}"#),
            (200, #"{"home_id":"home-1","request_context":{"home_id":"home-1","actor_id":"actor-1","lease_state":"pending"}}"#)
        ]
        for (code, body) in cases {
            URLProtocolStub.reset()
            let marker = FileManager.default.temporaryDirectory.appendingPathComponent("lease-context-" + UUID().uuidString)
            let api = APIClient(session: TestSession.make(), retryPolicy: .none)
            let auth = AuthManager(
                store: InMemorySecureStore(),
                apiClient: api,
                installMarker: InstallMarker(directory: marker),
                allowSecureEnclave: false
            )
            URLProtocolStub.stub(path: "/api/v1/tenant/home/home-1/status", response: .json(body, status: code))
            let vm = VerifyLandlordWizardViewModel(
                homeId: "home-1",
                form: VerifyLandlordSampleData.populatedForm,
                api: api,
                submitDelayNanos: 0,
                sessionIdentity: VerifyLandlordWizardViewModelTests.syntheticSessionIdentity
            )
            vm.primaryTapped()
            await vm.submit()
            XCTAssertEqual(vm.currentStep, .details)
            if case .error = vm.submitState {} else { XCTFail("Failed status must remain an error") }
            XCTAssertNil(vm.pendingEvent)
            XCTAssertFalse(URLProtocolStub.capturedRequests.contains { $0.url?.path == "/api/v1/tenant/request-approval" })
            await auth.awaitBackgroundWork()
            try? FileManager.default.removeItem(at: marker)
        }
        URLProtocolStub.reset()
    }
}
