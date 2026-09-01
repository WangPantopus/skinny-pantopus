//
//  ClaimOwnershipWizardViewModelTests.swift
//  PantopusTests
//
//  Covers the claim wizard state machine: navigation between steps,
//  slot gating on submit, the 2-step submit-then-evidence flow, retry
//  preservation on failure, and the success transition.
//

import Foundation
import XCTest
@testable import Pantopus

@MainActor
final class ClaimOwnershipWizardViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func makeUploader() -> MultipartUploader {
        MultipartUploader(
            environment: .current,
            session: SequencedURLProtocol.makeSession()
        )
    }

    private func makeVM() -> ClaimOwnershipWizardViewModel {
        ClaimOwnershipWizardViewModel(
            homeId: "home-1",
            api: makeAPI(),
            uploader: makeUploader()
        ) { true }
    }

    private func waitFor(
        _ description: String = "predicate",
        timeout: TimeInterval = 15.0,
        _ predicate: @MainActor () -> Bool
    ) async {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if predicate() { return }
            try? await Task.sleep(nanoseconds: 25_000_000)
        }
        XCTFail("Timed out waiting for \(description)")
    }

    func testInitialStateIsStartStep() {
        let vm = makeVM()
        XCTAssertEqual(vm.currentStep, .start)
        XCTAssertFalse(vm.bothSlotsHaveFiles)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Start claim")
    }

    func testPrimaryFromStartAdvancesToUpload() {
        let vm = makeVM()
        vm.primaryTapped()
        XCTAssertEqual(vm.currentStep, .upload)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Submit claim")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
    }

    func testSubmitBlockedWhenSlotsEmpty() async {
        let vm = makeVM()
        vm.primaryTapped() // → upload
        await vm.submit()
        // Without slots filled, no requests should fire.
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 0)
        XCTAssertEqual(vm.currentStep, .upload)
    }

    func testFillingSlotsEnablesSubmit() {
        let vm = makeVM()
        vm.primaryTapped()
        vm.picked(.identity, file: ClaimPickedFile(filename: "id.jpg", mimeType: "image/jpeg", data: Data([1, 2, 3])))
        XCTAssertFalse(vm.bothSlotsHaveFiles)
        vm.picked(.ownership, file: ClaimPickedFile(filename: "deed.pdf", mimeType: "application/pdf", data: Data([9, 9])))
        XCTAssertTrue(vm.bothSlotsHaveFiles)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testRemoveSlotResetsToEmpty() {
        let vm = makeVM()
        vm.primaryTapped()
        vm.picked(.identity, file: ClaimPickedFile(filename: "id.jpg", mimeType: "image/jpeg", data: Data([1])))
        XCTAssertTrue(vm.slots[.identity]?.hasFile == true)
        vm.remove(.identity)
        XCTAssertFalse(vm.slots[.identity]?.hasFile == true)
    }

    func testSubmitFailureKeepsFilesAndShowsError() async {
        // Submit endpoint returns 500 → wizard stays on upload, slots remain.
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"server\"}")
        ]
        let vm = makeVM()
        vm.primaryTapped() // → upload
        vm.picked(.identity, file: ClaimPickedFile(filename: "id.jpg", mimeType: "image/jpeg", data: Data([1])))
        vm.picked(.ownership, file: ClaimPickedFile(filename: "deed.pdf", mimeType: "application/pdf", data: Data([2])))
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .upload)
        XCTAssertNotNil(vm.submitError)
        XCTAssertTrue(vm.slots[.identity]?.hasFile == true)
        XCTAssertTrue(vm.slots[.ownership]?.hasFile == true)
    }

    func testSubmitHappyPathAdvancesToSuccess() async {
        // Sequence: create-claim → upload file #1 → evidence #1 → upload file #2 → evidence #2
        SequencedURLProtocol.sequence = [
            .status(201, body: """
            {"message":"ok","claim":{"id":"claim-1","status":"under_review"},"next_step":"upload_evidence"}
            """),
            .status(200, body: """
            {"message":"uploaded","file":{"id":"f-1","url":"https://files/pantopus/x1"}}
            """),
            .status(201, body: """
            {"evidence":{"id":"e-1","evidence_type":"idv"},"verification_tier":null}
            """),
            .status(200, body: """
            {"message":"uploaded","file":{"id":"f-2","url":"https://files/pantopus/x2"}}
            """),
            .status(201, body: """
            {"evidence":{"id":"e-2","evidence_type":"deed"},"verification_tier":null}
            """)
        ]
        let vm = makeVM()
        vm.primaryTapped()
        vm.picked(.identity, file: ClaimPickedFile(filename: "id.jpg", mimeType: "image/jpeg", data: Data([1])))
        vm.picked(.ownership, file: ClaimPickedFile(filename: "deed.pdf", mimeType: "application/pdf", data: Data([2])))
        await vm.submit()
        await waitFor("currentStep == .success") { vm.currentStep == .success }
        XCTAssertNil(vm.submitError)
        // The success step chrome should hide the progress bar.
        XCTAssertFalse(vm.chrome.showsProgressBar)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "View status")
    }

    func testNoteCarriedAsMetadataOnFirstEvidence() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: """
            {"message":"ok","claim":{"id":"claim-2","status":"under_review"}}
            """),
            .status(200, body: """
            {"message":"uploaded","file":{"id":"f-1","url":"https://files/pantopus/n1"}}
            """),
            .status(201, body: """
            {"evidence":{"id":"e-1"},"verification_tier":null}
            """),
            .status(200, body: """
            {"message":"uploaded","file":{"id":"f-2","url":"https://files/pantopus/n2"}}
            """),
            .status(201, body: """
            {"evidence":{"id":"e-2"},"verification_tier":null}
            """)
        ]
        let vm = makeVM()
        vm.primaryTapped()
        vm.note = "Inherited from grandparents"
        vm.picked(.identity, file: ClaimPickedFile(filename: "id.jpg", mimeType: "image/jpeg", data: Data([1])))
        vm.picked(.ownership, file: ClaimPickedFile(filename: "deed.pdf", mimeType: "application/pdf", data: Data([2])))
        await vm.submit()
        await waitFor("currentStep == .success") { vm.currentStep == .success }
        // Captured requests: 0=createClaim, 1=upload, 2=evidence#1, 3=upload, 4=evidence#2.
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 5)
        let evidence1 = SequencedURLProtocol.capturedRequests[2]
        guard let body = evidence1.httpBody ?? bodyData(from: evidence1) else {
            XCTFail("Expected body on evidence request")
            return
        }
        let json = String(data: body, encoding: .utf8) ?? ""
        XCTAssertTrue(json.contains("\"note\":\"Inherited from grandparents\""))
        let evidence2 = SequencedURLProtocol.capturedRequests[4]
        if let body2 = evidence2.httpBody ?? bodyData(from: evidence2) {
            let json2 = String(data: body2, encoding: .utf8) ?? ""
            XCTAssertFalse(json2.contains("\"note\""))
        }
    }

    /// `URLSession.upload(for:from:)` sometimes drops the buffered body
    /// from `URLRequest` and exposes it on `httpBodyStream`. Drain that
    /// stream if needed so the assertion above can read the JSON.
    private func bodyData(from request: URLRequest) -> Data? {
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }

    func testDuplicateClaimNilIdSurfacesFriendlyError() async {
        SequencedURLProtocol.sequence = [
            // Opaque-handshake duplicate: claim.id is nil.
            .status(200, body: """
            {"message":"ok","claim":{"id":null,"status":"under_review"}}
            """)
        ]
        let vm = makeVM()
        vm.primaryTapped()
        vm.picked(.identity, file: ClaimPickedFile(filename: "id.jpg", mimeType: "image/jpeg", data: Data([1])))
        vm.picked(.ownership, file: ClaimPickedFile(filename: "deed.pdf", mimeType: "application/pdf", data: Data([2])))
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .upload)
        // A nil claim id on the opaque-handshake path means a duplicate already
        // exists — the same user-visible outcome as a 409. It now raises the
        // blocked prompt (which offers "Search homes", matching RN's
        // `claim-owner/evidence.tsx:194-212`) rather than a bare error string.
        XCTAssertNil(vm.submitError)
        XCTAssertEqual(
            vm.blockedByOtherClaimPrompt?.contains("verification is already in progress"),
            true
        )
    }

    func testBackOnUploadReturnsToStart() {
        let vm = makeVM()
        vm.primaryTapped()
        XCTAssertEqual(vm.currentStep, .upload)
        vm.leadingTapped()
        XCTAssertEqual(vm.currentStep, .start)
    }

    func testStartChromeDirtyAfterFilesPickedThenBack() {
        // Regression: when the user picks files on Upload then backs to
        // Start, tapping X must still trigger the discard-confirm
        // sheet — otherwise the in-memory bytes are dumped silently.
        let vm = makeVM()
        vm.primaryTapped() // → upload
        vm.picked(.identity, file: ClaimPickedFile(filename: "id.jpg", mimeType: "image/jpeg", data: Data([1])))
        XCTAssertTrue(vm.chrome.dirty, "Upload chrome should be dirty after picking a file")
        vm.leadingTapped() // back to start
        XCTAssertEqual(vm.currentStep, .start)
        XCTAssertTrue(
            vm.chrome.dirty,
            "Start chrome should stay dirty so X tap triggers discard-confirm"
        )
    }

    func testRetrySkipsClaimCreationAndCachedSlot() async {
        // First attempt: claim + slot1 round-trip succeed; slot2 upload
        // succeeds; slot2 evidence registration fails. The wizard
        // remains on Upload with .failed slot2.
        SequencedURLProtocol.sequence = [
            // 1. Create claim
            .status(201, body: """
            {"message":"ok","claim":{"id":"claim-r","status":"under_review"}}
            """),
            // 2. Upload slot 1
            .status(200, body: """
            {"message":"ok","file":{"id":"f-1","url":"https://files/pantopus/r1"}}
            """),
            // 3. Evidence slot 1
            .status(201, body: """
            {"evidence":{"id":"e-1"},"verification_tier":null}
            """),
            // 4. Upload slot 2
            .status(200, body: """
            {"message":"ok","file":{"id":"f-2","url":"https://files/pantopus/r2"}}
            """),
            // 5. Evidence slot 2 — fails
            .status(500, body: "{\"error\":\"server\"}")
        ]
        let vm = makeVM()
        vm.primaryTapped()
        vm.picked(.identity, file: ClaimPickedFile(filename: "id.jpg", mimeType: "image/jpeg", data: Data([1])))
        vm.picked(.ownership, file: ClaimPickedFile(filename: "deed.pdf", mimeType: "application/pdf", data: Data([2])))
        await vm.submit()
        XCTAssertEqual(vm.currentStep, .upload)
        XCTAssertNotNil(vm.submitError)
        let firstAttemptCount = SequencedURLProtocol.capturedRequests.count
        XCTAssertEqual(firstAttemptCount, 5)

        // Retry: only the evidence call for slot 2 should fly. No new
        // claim, no new uploads (slot 1 is .uploaded, slot 2 has a
        // cached URL).
        SequencedURLProtocol.capturedRequests = []
        SequencedURLProtocol.sequence = [
            .status(201, body: """
            {"evidence":{"id":"e-2"},"verification_tier":null}
            """)
        ]
        await vm.submit()
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
        XCTAssertEqual(vm.currentStep, .success)
    }

    func testFileTooLargeSetsInlineError() {
        let vm = makeVM()
        vm.primaryTapped()
        vm.fileTooLarge(for: .identity)
        XCTAssertEqual(vm.submitError, "That file is over 10 MB. Try a smaller photo.")
    }

    func testSuccessPrimaryDispatchesOpenClaimsList() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: """
            {"message":"ok","claim":{"id":"claim-3","status":"under_review"}}
            """),
            .status(200, body: """
            {"message":"uploaded","file":{"id":"f-1","url":"https://files/pantopus/s1"}}
            """),
            .status(201, body: """
            {"evidence":{"id":"e-1"},"verification_tier":null}
            """),
            .status(200, body: """
            {"message":"uploaded","file":{"id":"f-2","url":"https://files/pantopus/s2"}}
            """),
            .status(201, body: """
            {"evidence":{"id":"e-2"},"verification_tier":null}
            """)
        ]
        let vm = makeVM()
        vm.primaryTapped()
        vm.picked(.identity, file: ClaimPickedFile(filename: "id.jpg", mimeType: "image/jpeg", data: Data([1])))
        vm.picked(.ownership, file: ClaimPickedFile(filename: "deed.pdf", mimeType: "application/pdf", data: Data([2])))
        await vm.submit()
        await waitFor("step is success") { vm.currentStep == .success }
        vm.primaryTapped()
        XCTAssertEqual(vm.pendingEvent, .openClaimsList)
    }
}
