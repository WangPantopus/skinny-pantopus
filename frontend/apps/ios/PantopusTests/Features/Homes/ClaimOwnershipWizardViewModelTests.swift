import Foundation
import XCTest
@testable import Pantopus

@MainActor
final class ClaimOwnershipWizardViewModelTests: XCTestCase {
    private let f = PrivateEvidenceFixture()
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private var requests: [URLRequest] {
        SequencedURLProtocol.capturedRequests
    }

    private func makeVM(
        identity: @escaping () -> String? = { "opening" },
        type: ClaimVerificationType = .owner
    ) -> ClaimOwnershipWizardViewModel {
        ClaimOwnershipWizardViewModel(
            homeId: f.home,
            api: f.api(),
            verificationType: type,
            evidenceClient: f.client(identity: identity),
            makeUploadId: { self.f.upload },
            isOnlineProvider: { true }
        )
    }

    private func loaded() async -> ClaimOwnershipWizardViewModel {
        f.routes()
        let vm = makeVM()
        await vm.load()
        vm.primaryTapped()
        return vm
    }

    func testInitialAndUploadStepsRemainDisabledUntilAuthenticatedScopeLoads() async {
        let vm = makeVM()
        XCTAssertEqual(vm.currentStep, .start)
        XCTAssertFalse(vm.canPick)
        vm.primaryTapped()
        vm.picked(.ownership, file: f.file)
        await vm.submit()
        XCTAssertFalse(vm.canSubmit)
        XCTAssertTrue(requests.isEmpty)
    }

    func testOneManualPropertyDocumentEnablesSubmissionWithoutIdentityAttestation() async {
        let vm = await loaded()
        vm.picked(.identity, file: f.file)
        XCTAssertFalse(vm.canSubmit)
        vm.picked(.ownership, file: f.file)
        XCTAssertTrue(vm.canSubmit)
        XCTAssertEqual(vm.activeSlots, [.ownership])
        XCTAssertFalse(vm.documentOptions.contains { ["idv", "title_match", "escrow_attestation"].contains($0.id) })
        XCTAssertTrue(vm.addressMatches.isEmpty)
    }

    func testSuccessfulPrivateUploadReturnsPendingStatusAndNeverRegistersGenericURL() async {
        let vm = await loaded()
        vm.picked(.ownership, file: f.file)
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertNil(vm.submitError)
        XCTAssertEqual(
            requests.filter { $0.httpMethod == "POST" }.compactMap { $0.url?.path },
            ["/api/homes/\(f.home)/ownership-claims", f.uploadPath]
        )
        XCTAssertTrue(vm.submissionOutcomeNote?.contains("pending evidence") == true)
        XCTAssertFalse(vm.chrome.showsProgressBar)
        vm.primaryTapped()
        XCTAssertEqual(vm.pendingEvent, .openClaimsList)
    }

    func testLostUploadRetryKeepsClaimAndUploadIdentity() async {
        let vm = await loaded()
        vm.picked(.ownership, file: f.file)
        SequencedURLProtocol.routeResponses[f.uploadPath] = [.status(503, body: "{}"), .status(200, body: f.json(["evidence": f.record()]))]
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .upload)
        XCTAssertNotNil(vm.submitError)
        XCTAssertEqual(vm.slots[.ownership]?.pickedFile, f.file)
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertEqual(requests.filter { $0.url?.path == "/api/homes/\(f.home)/ownership-claims" }.count, 1)
        let uploads = requests.filter { $0.url?.path == f.uploadPath }
        XCTAssertEqual(uploads.count, 2)
        for upload in uploads {
            XCTAssertEqual(upload.value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), f.scope)
        }
    }

    func testUnknownUploadCannotDiscardOrReplaceItsFileTypeOrRetryIdentity() async throws {
        let vm = await loaded()
        vm.picked(.ownership, file: f.file)
        SequencedURLProtocol.routeResponses[f.uploadPath] = [
            .status(503, body: "{}"), .status(200, body: f.json(["evidence": f.record()]))
        ]
        await vm.submit()
        XCTAssertTrue(vm.needsUploadRecovery)
        XCTAssertFalse(vm.canPick)
        XCTAssertTrue(vm.canSubmit)
        vm.remove(.ownership)
        vm.selectDocumentType("tax_bill")
        vm.picked(.ownership, file: .init(filename: "replacement.txt", mimeType: "text/plain", data: Data("replacement".utf8)))
        XCTAssertEqual(vm.slots[.ownership]?.pickedFile, f.file)
        XCTAssertEqual(vm.selectedDocumentType, "deed")
        vm.manageSavedDocuments()
        XCTAssertEqual(vm.pendingEvent, .openClaimsList)
        vm.acknowledgePendingEvent()
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .success)
        let uploads = requests.filter { $0.url?.path == f.uploadPath }
        XCTAssertEqual(uploads.count, 2)
        for request in uploads {
            let body = try XCTUnwrap(String(data: XCTUnwrap(request.authTestBodyData()), encoding: .utf8))
            XCTAssertTrue(body.contains(f.upload))
            XCTAssertTrue(body.contains("exact private proof"))
            XCTAssertTrue(body.contains("deed"))
            XCTAssertFalse(body.contains("replacement"))
            XCTAssertFalse(body.contains("tax_bill"))
        }
    }

    func testExistingClaimIsRediscoveredWithoutDuplicateCreation() async {
        let vm = await loaded()
        vm.picked(.ownership, file: f.file)
        SequencedURLProtocol.routeResponses["/api/homes/my-ownership-claims"] = [.status(200, body: f.claims(existing: true))]
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertEqual(requests.filter { $0.httpMethod == "POST" }.count, 1)
    }

    func testMalformedCreateReceiptCannotStartUpload() async {
        let vm = await loaded()
        vm.picked(.ownership, file: f.file)
        SequencedURLProtocol.routeResponses["/api/homes/\(f.home)/ownership-claims"] = [
            .status(
                200,
                body: "{\"message\":\"Saved\",\"claim\":{\"id\":null,\"status\":\"under_review\"}}"
            )
        ]
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .upload)
        XCTAssertNotNil(vm.submitError)
        XCTAssertFalse(requests.contains { $0.url?.path == f.uploadPath })
    }

    func testChangedAccountAndLatePickerCannotMutateOldWizard() async {
        var session: String? = "first"
        f.routes()
        let vm = makeVM { session }
        await vm.load()
        vm.primaryTapped()
        session = "second"
        vm.picked(.ownership, file: f.file)
        await vm.submit()
        XCTAssertFalse(vm.canPick)
        XCTAssertFalse(vm.anySlotHasFile)
        XCTAssertFalse(requests.contains { $0.httpMethod == "POST" })
    }

    func testRetiredUploadResponseCannotNavigateToSuccess() async {
        let vm = await loaded()
        vm.picked(.ownership, file: f.file)
        SequencedURLProtocol.routeResponses[f.uploadPath] = [.status(200, body: f.json(["evidence": f.record()]), delay: 0.2)]
        let task = Task { await vm.submit() }
        for _ in 0..<100 where !requests.contains(where: { $0.url?.path == f.uploadPath }) {
            try? await Task.sleep(for: .milliseconds(5))
        }
        vm.retire()
        await task.value
        XCTAssertNotEqual(vm.currentStep, .success)
        XCTAssertFalse(vm.anySlotHasFile)
    }

    func testChallengeRoutingIsUnavailableWithoutAutomaticProviderOrChallengeAction() async {
        let vm = await loaded()
        vm.picked(.ownership, file: f.file)
        SequencedURLProtocol.routeResponses["/api/homes/\(f.home)/ownership-claims"] = [
            .status(
                201,
                body: f.json([
                    "message": "Saved",
                    "claim": [
                        "id": f.claim,
                        "status": "under_review",
                        "routing_classification": "challenge_claim"
                    ]
                ])
            )
        ]
        await vm.submit()
        XCTAssertNotNil(vm.submitError)
        XCTAssertFalse(requests.contains { $0.url?.path == f.uploadPath || $0.url?.path.hasSuffix("/challenge") == true })
    }

    func testFileRemovalAndBackNavigationKeepAccurateDirtyState() async {
        let vm = await loaded()
        vm.picked(.ownership, file: f.file)
        vm.leadingTapped()
        XCTAssertEqual(vm.currentStep, .start)
        XCTAssertTrue(vm.chrome.dirty)
        vm.remove(.ownership)
        XCTAssertFalse(vm.chrome.dirty)
    }

    func testResidencyUsesThePrivateLeaseUploadWithoutIdentityAttestation() async {
        f.routes()
        let vm = makeVM(type: .residency)
        await vm.load()
        XCTAssertEqual(vm.currentStep, .upload)
        vm.selectDocumentType("lease")
        vm.picked(.residency, file: f.file)
        SequencedURLProtocol.routeResponses[f.uploadPath] = [
            .status(
                200,
                body: f.json(["evidence": f.record(["evidence_type": "lease"])])
            )
        ]
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertEqual(vm.activeSlots, [.residency])
        XCTAssertFalse(requests.contains { $0.url?.path == "/api/files/upload" })
    }

    func testSubmissionWaitHintAppearsOnlyDuringCurrentUpload() async {
        let vm = await loaded()
        vm.picked(.ownership, file: f.file)
        SequencedURLProtocol.routeResponses[f.uploadPath] = [.status(200, body: f.json(["evidence": f.record()]), delay: 0.2)]
        let task = Task { await vm.submit() }
        for _ in 0..<100 where !vm.isSubmitting {
            try? await Task.sleep(for: .milliseconds(5))
        }
        XCTAssertEqual(vm.chrome.footerHint, "Waiting for upload to finish")
        await task.value
        XCTAssertNil(vm.chrome.footerHint)
    }
}
