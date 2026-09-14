import Foundation
import XCTest
@testable import Pantopus

@MainActor
extension VerifyLandlordWizardViewModelTests {
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
            homeId: "home-1", form: VerifyLandlordSampleData.populatedForm, api: api, submitDelayNanos: 0
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
