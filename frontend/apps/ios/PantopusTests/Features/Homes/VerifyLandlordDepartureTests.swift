import Foundation
import XCTest
@testable import Pantopus

@MainActor
extension VerifyLandlordWizardViewModelTests {
    func waitFor(
        _ description: String = "predicate",
        timeout: TimeInterval = 5.0,
        _ predicate: @escaping @MainActor () -> Bool
    ) async {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if predicate() { return }
            try? await Task.sleep(nanoseconds: 25_000_000)
        }
        XCTFail("Timed out waiting for \(description)")
    }

    func testDepartureDuringStatusCannotSubmitAfterBackAndDiscard() async {
        SequencedURLProtocol.reset()
        let marker = FileManager.default.temporaryDirectory.appendingPathComponent("lease-departure-" + UUID().uuidString)
        defer {
            SequencedURLProtocol.reset()
            try? FileManager.default.removeItem(at: marker)
        }
        let status = """
        {"home_id":"home-1","request_context":{
          "home_id":"home-1","actor_id":"actor-1","lease_id":null,"lease_state":null}}
        """
        let saved = #"{"lease":{"id":"new-lease","home_id":"home-1","state":"pending"}}"#
        let session = SequencedURLProtocol.makeSession(routeResponses: [
            "/api/v1/tenant/home/home-1/status": [.status(200, body: status, delay: 1.5)],
            "/api/v1/tenant/request-approval": [.status(201, body: saved)]
        ])
        let api = APIClient(session: session, retryPolicy: .none)
        let auth = AuthManager(
            store: InMemorySecureStore(),
            apiClient: api,
            installMarker: InstallMarker(directory: marker),
            allowSecureEnclave: false
        )
        let vm = VerifyLandlordWizardViewModel(
            homeId: "home-1",
            form: VerifyLandlordSampleData.populatedForm,
            api: api,
            submitDelayNanos: 0,
            sessionIdentity: VerifyLandlordWizardViewModelTests.syntheticSessionIdentity
        )
        vm.primaryTapped()
        let original = Task { await vm.submit() }
        await waitFor("status request entered the delayed transport") {
            SequencedURLProtocol.capturedRequests.contains { $0.url?.path.hasSuffix("/status") == true }
        }
        vm.leadingTapped()
        vm.discardConfirmed()
        await original.value
        XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.url?.path.hasSuffix("/request-approval") == true })
        XCTAssertEqual(vm.currentStep, .start)
        XCTAssertEqual(vm.submitState, .idle)
        XCTAssertEqual(vm.pendingEvent, .dismiss)
        XCTAssertNil(vm.approvalResult)
        await auth.awaitBackgroundWork()
    }
}

@MainActor
extension VerifyLandlordWizardViewModelTests {
    func testRetiredReplyCannotReplaceNewDraftOrOpenFallback() async {
        let retired: [Result<TenantLeaseDTO, any Error>] = [
            .success(Self.stubLease),
            .failure(APIError.clientError(
                status: 400,
                message: "This property has no verified landlord. Cannot submit a lease request."
            )),
            .failure(APIError.clientError(status: 503, message: "Old failure"))
        ]
        for reply in retired {
            var held: CheckedContinuation<Result<TenantLeaseDTO, any Error>, Never>?
            var calls = 0
            let vm = makeVM(form: VerifyLandlordSampleData.populatedForm) { _ in
                calls += 1
                if calls == 1 { return await withCheckedContinuation { held = $0 } }
                return .failure(APIError.clientError(status: 503, message: "Current request failed"))
            }
            vm.primaryTapped()
            let original = Task { await vm.submit() }
            await waitFor("original request is held") { held != nil }
            vm.leadingTapped()
            vm.primaryTapped()
            vm.setMessageToLandlord("New draft stays here")
            await vm.submit()
            let current = vm.submitState
            held?.resume(returning: reply)
            await original.value
            XCTAssertEqual(vm.currentStep, .details)
            XCTAssertEqual(vm.submitState, current)
            XCTAssertEqual(vm.form.messageToLandlord, "New draft stays here")
            XCTAssertNil(vm.approvalResult)
            XCTAssertNil(vm.pendingEvent)
        }
    }

    func testQueuedPrimaryActionCannotStartAfterDiscard() async {
        let unexpected = expectation(description: "Discarded task must not start a request")
        unexpected.isInverted = true
        let vm = makeVM(form: VerifyLandlordSampleData.populatedForm) { _ in
            unexpected.fulfill()
            return .success(Self.stubLease)
        }
        vm.primaryTapped()
        vm.primaryTapped()
        vm.leadingTapped()
        vm.discardConfirmed()
        await fulfillment(of: [unexpected], timeout: 0.25)
        XCTAssertEqual(vm.currentStep, .start)
        XCTAssertEqual(vm.submitState, .idle)
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }
}

@MainActor
extension VerifyLandlordWizardViewModelTests {
    private func savedStatus(_ state: String = "pending") -> String {
        """
        {"home_id":"home-1","request_context":{"home_id":"home-1","actor_id":"actor-1",
        "lease_id":"saved-lease","lease_state":"\(state)"},"lease":{"state":"\(state)",
        "lease":{"id":"saved-lease","home_id":"home-1","state":"\(state)",
        "created_at":"2026-09-13T01:00:00Z","start_at":"2026-09-14T00:00:00Z",
        "metadata":{"message":"Previously saved request"}}}}
        """
    }

    private func withRecoveryVM(
        responses: [SequencedURLProtocol.Response],
        identity: @escaping () -> String? = { "synthetic-session" },
        approvalRequester: VerifyLandlordWizardViewModel.ApprovalRequester? = nil,
        check: (VerifyLandlordWizardViewModel) async -> Void
    ) async {
        SequencedURLProtocol.reset()
        let marker = FileManager.default.temporaryDirectory.appendingPathComponent("lease-recovery-" + UUID().uuidString)
        defer { SequencedURLProtocol.reset()
            try? FileManager.default.removeItem(at: marker)
        }
        let api = APIClient(session: SequencedURLProtocol.makeSession(routeResponses: [
            "/api/v1/tenant/home/home-1/status": responses
        ]), retryPolicy: .none)
        let auth = AuthManager(
            store: InMemorySecureStore(),
            apiClient: api,
            installMarker: InstallMarker(directory: marker),
            allowSecureEnclave: false
        )
        let vm = VerifyLandlordWizardViewModel(
            homeId: "home-1",
            api: api,
            submitDelayNanos: 0,
            sessionIdentity: identity,
            approvalRequester: approvalRequester
        )
        await check(vm)
        await auth.awaitBackgroundWork()
    }

    func testReopenRecoversPendingAndActiveWithoutPosting() async {
        for state in ["pending", "active"] {
            await withRecoveryVM(responses: [.status(200, body: savedStatus(state))]) { vm in
                await vm.restoreSavedRequest()
                XCTAssertEqual(vm.currentStep, .sent)
                XCTAssertEqual(vm.approvalResult?.kind, state == "pending" ? .alreadyPending : .alreadyActive)
                XCTAssertEqual(vm.approvalResult?.message, "Previously saved request")
                XCTAssertEqual(vm.approvalResult?.requestedStartAt, "2026-09-14T00:00:00Z")
                XCTAssertFalse(vm.isSubmitting)
                XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.httpMethod == "POST" })
            }
        }
    }

    func testFailedOrMalformedRecoveryRequiresReadRetryBeforeDetails() async {
        let mismatch = savedStatus().replacingOccurrences(of: "\"id\":\"saved-lease\"", with: "\"id\":\"wrong-lease\"")
        for response in [SequencedURLProtocol.Response.status(503, body: "{}"), .status(200, body: mismatch)] {
            await withRecoveryVM(responses: [response, .status(200, body: savedStatus())]) { vm in
                vm.setOwnerName("Draft stays here")
                await vm.restoreSavedRequest()
                XCTAssertEqual(vm.currentStep, .start)
                XCTAssertEqual(vm.chrome.primaryCTALabel, "Retry status")
                XCTAssertNil(vm.approvalResult)
                XCTAssertEqual(vm.form.ownerName, "Draft stays here")
                vm.primaryTapped()
                await waitFor("saved request recovered after retry") { vm.currentStep == .sent }
                XCTAssertEqual(vm.approvalResult?.message, "Previously saved request")
                XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.httpMethod == "POST" })
            }
        }
    }

    func testNoSavedRequestLeavesExistingStartAndDetailsAvailable() async {
        let body = """
        {"home_id":"home-1","request_context":{"home_id":"home-1","actor_id":"actor-1"},
        "lease":{"state":"none","lease":null}}
        """
        await withRecoveryVM(responses: [.status(200, body: body)]) { vm in
            await vm.restoreSavedRequest()
            XCTAssertEqual(vm.currentStep, .start)
            XCTAssertNil(vm.approvalResult)
            vm.primaryTapped()
            XCTAssertEqual(vm.currentStep, .details)
            XCTAssertTrue(SequencedURLProtocol.capturedRequests.allSatisfy { $0.httpMethod == "GET" })
        }
    }

    func testRetiredRecoveryCannotRestoreConfirmation() async {
        await withRecoveryVM(responses: [.status(200, body: savedStatus(), delay: 0.3)]) { vm in
            let read = Task { await vm.restoreSavedRequest() }
            await waitFor("recovery GET started") { !SequencedURLProtocol.capturedRequests.isEmpty }
            XCTAssertFalse(vm.chrome.primaryCTAEnabled)
            vm.leadingTapped()
            await read.value
            XCTAssertEqual(vm.pendingEvent, .dismiss)
            XCTAssertNil(vm.approvalResult)
            XCTAssertEqual(vm.currentStep, .start)
        }
    }

    func testChangedSessionCannotRestoreOrSendOldRequest() async {
        var identity = "first-account"
        let currentIdentity = { identity }
        await withRecoveryVM(responses: [.status(200, body: savedStatus(), delay: 0.3)], identity: currentIdentity) { vm in
            vm.setOwnerName("Old private draft")
            let read = Task { await vm.restoreSavedRequest() }
            await waitFor("recovery GET started") { !SequencedURLProtocol.capturedRequests.isEmpty }
            identity = "second-account"
            await read.value
            XCTAssertNil(vm.approvalResult)
            XCTAssertEqual(vm.form.ownerName, "")
            XCTAssertEqual(vm.pendingEvent, .dismiss)
            vm.primaryTapped()
            XCTAssertEqual(vm.currentStep, .start)
            XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.httpMethod == "POST" })
        }
        identity = "first-account"
        await withRecoveryVM(responses: [.status(200, body: savedStatus(), delay: 0.3)], identity: currentIdentity) { vm in
            vm.form = VerifyLandlordSampleData.populatedForm
            vm.primaryTapped()
            let submit = Task { await vm.submit() }
            await waitFor("preflight GET started") { !SequencedURLProtocol.capturedRequests.isEmpty }
            identity = "second-account"
            await submit.value
            XCTAssertNil(vm.approvalResult)
            XCTAssertEqual(vm.form.ownerName, "")
            XCTAssertEqual(vm.pendingEvent, .dismiss)
            XCTAssertFalse(SequencedURLProtocol.capturedRequests.contains { $0.httpMethod == "POST" })
        }
    }
}

@MainActor
extension VerifyLandlordWizardViewModelTests {
    func testChangedSessionDropsAlreadySentRequestReply() async {
        var identity = "first-account"
        let currentIdentity = { identity }
        var held: CheckedContinuation<Result<TenantLeaseDTO, any Error>, Never>?
        let vm = VerifyLandlordWizardViewModel(
            homeId: "home-1",
            form: VerifyLandlordSampleData.populatedForm,
            submitDelayNanos: 0,
            sessionIdentity: currentIdentity
        ) { _ in await withCheckedContinuation { held = $0 } }
        vm.primaryTapped()
        let submit = Task { await vm.submit() }
        await waitFor("submission reply held") { held != nil }
        identity = "second-account"
        held?.resume(returning: .success(Self.stubLease))
        await submit.value
        XCTAssertEqual(vm.pendingEvent, .dismiss)
        XCTAssertNil(vm.approvalResult)
        XCTAssertEqual(vm.form, VerifyLandlordForm())
        XCTAssertEqual(vm.currentStep, .start)
    }
}

@MainActor
extension VerifyLandlordWizardViewModelTests {
    func testForegroundRefreshUpdatesAnExistingPendingConfirmation() async {
        await withRecoveryVM(responses: [.status(200, body: savedStatus()), .status(200, body: savedStatus("active"))]) { vm in
            await vm.restoreSavedRequest()
            XCTAssertEqual(vm.approvalResult?.kind, .alreadyPending)
            vm.retirePendingWork()
            vm.resume()
            await waitFor("foreground observes active lease") { vm.approvalResult?.kind == .alreadyActive }
            XCTAssertTrue(SequencedURLProtocol.capturedRequests.allSatisfy { $0.httpMethod == "GET" })
        }
    }

    func testForegroundNoRequestPreservesDetailsAndEnteredDraft() async {
        let none = #"{"home_id":"home-1","request_context":{"home_id":"home-1","actor_id":"actor-1"},"lease":{"state":"none"}}"#
        await withRecoveryVM(responses: [.status(200, body: none, delay: 0.1)]) { vm in
            vm.primaryTapped()
            vm.setMessageToLandlord("Keep my entered draft")
            vm.retirePendingWork()
            vm.resume()
            await waitFor("foreground status read begins") { vm.isSubmitting }
            XCTAssertFalse(vm.chrome.primaryCTAEnabled)
            await waitFor("foreground status read finishes") { !vm.isSubmitting }
            XCTAssertEqual(vm.currentStep, .details)
            XCTAssertEqual(vm.form.messageToLandlord, "Keep my entered draft")
            XCTAssertEqual(vm.chrome.primaryCTALabel, "Submit")
        }
    }

    func testForegroundFailureInDetailsOffersReadRetryWithoutPosting() async {
        await withRecoveryVM(responses: [.status(503, body: "{}"), .status(200, body: savedStatus())]) { vm in
            vm.primaryTapped()
            vm.setMessageToLandlord("Keep this draft until the saved request is known")
            await vm.restoreSavedRequest()
            XCTAssertEqual(vm.currentStep, .details)
            XCTAssertEqual(vm.chrome.primaryCTALabel, "Retry status")
            XCTAssertTrue(vm.chrome.primaryCTAEnabled)
            vm.primaryTapped()
            await waitFor("retry recovers the saved request") { vm.currentStep == .sent }
            XCTAssertTrue(SequencedURLProtocol.capturedRequests.allSatisfy { $0.httpMethod == "GET" })
        }
    }

    func testForegroundFailureOnConfirmationOffersRetryBeforeDone() async {
        await withRecoveryVM(responses: [
            .status(200, body: savedStatus()), .status(503, body: "{}"), .status(200, body: savedStatus("active"))
        ]) { vm in
            await vm.restoreSavedRequest()
            await vm.restoreSavedRequest()
            XCTAssertEqual(vm.chrome.primaryCTALabel, "Retry status")
            XCTAssertEqual(vm.approvalResult?.kind, .alreadyPending)
            vm.primaryTapped()
            await waitFor("confirmation retry observes active lease") { vm.approvalResult?.kind == .alreadyActive }
            XCTAssertEqual(vm.chrome.primaryCTALabel, "Done")
            XCTAssertNil(vm.pendingEvent)
        }
    }

    func testOldReadDeliveredAfterForegroundCannotReplaceNewerStatus() async {
        await withRecoveryVM(responses: [
            .status(200, body: savedStatus(), delay: 0.3), .status(200, body: savedStatus("active"))
        ]) { vm in
            let original = Task { await vm.restoreSavedRequest() }
            await waitFor("old status read starts") { !SequencedURLProtocol.capturedRequests.isEmpty }
            vm.retirePendingWork()
            vm.resume()
            await waitFor("new foreground status is active") { vm.approvalResult?.kind == .alreadyActive }
            await original.value
            XCTAssertEqual(vm.approvalResult?.kind, .alreadyActive)
        }
    }

    func testForegroundRecoversCommittedRequestBeforeItsRetiredReplyArrives() async {
        var held: CheckedContinuation<Result<TenantLeaseDTO, any Error>, Never>?
        await withRecoveryVM(
            responses: [.status(200, body: savedStatus("active"))],
            approvalRequester: { _ in await withCheckedContinuation { held = $0 } },
            check: { vm in
                vm.form = VerifyLandlordSampleData.populatedForm
                vm.primaryTapped()
                let original = Task { await vm.submit() }
                await waitFor("committed reply is held") { held != nil }
                vm.retirePendingWork()
                vm.resume()
                await waitFor("saved request recovered on foreground") { vm.approvalResult?.kind == .alreadyActive }
                held?.resume(returning: .success(Self.stubLease))
                await original.value
                XCTAssertEqual(vm.approvalResult?.kind, .alreadyActive)
                XCTAssertEqual(vm.currentStep, .sent)
            }
        )
    }
}
