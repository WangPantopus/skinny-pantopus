//
//  ClaimOwnershipAddressMatchTests.swift
//  PantopusTests
//
//  A12.4 — per-file address-match heuristic (done/warn) computed on upload
//  completion, plus the "Waiting for upload to finish" dock hint while a
//  submit is in flight.
//

import Foundation
import XCTest
@testable import Pantopus

@MainActor
final class ClaimOwnershipAddressMatchTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeVM() -> ClaimOwnershipWizardViewModel {
        ClaimOwnershipWizardViewModel(
            homeId: "home-1",
            api: APIClient(
                environment: .current,
                session: SequencedURLProtocol.makeSession(),
                retryPolicy: .none
            ),
            uploader: MultipartUploader(
                environment: .current,
                session: SequencedURLProtocol.makeSession()
            )
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

    func testPickedComputesAddressMatchWhenFilenameCarriesStreetNumber() {
        // Sample-data heuristic: a filename carrying the home's street number
        // ("412") resolves to a `.matches` verdict on the slot.
        let vm = makeVM()
        vm.primaryTapped()
        vm.picked(
            .ownership,
            file: ClaimPickedFile(filename: "deed_412_elm.pdf", mimeType: "application/pdf", data: Data([1]))
        )
        guard case let .matches(detail) = vm.addressMatches[.ownership] else {
            return XCTFail("Expected .matches verdict for a filename containing the street number")
        }
        XCTAssertTrue(detail.contains("412 Elm St"))
    }

    func testPickedComputesAddressDiffersWhenStreetNumberAbsent() {
        let vm = makeVM()
        vm.primaryTapped()
        vm.picked(
            .ownership,
            file: ClaimPickedFile(filename: "mortgage_statement.pdf", mimeType: "application/pdf", data: Data([1]))
        )
        guard case .differs = vm.addressMatches[.ownership] else {
            return XCTFail("Expected .differs verdict when the street number is absent")
        }
    }

    func testRemoveClearsAddressMatch() {
        let vm = makeVM()
        vm.primaryTapped()
        vm.picked(
            .ownership,
            file: ClaimPickedFile(filename: "deed_412.pdf", mimeType: "application/pdf", data: Data([1]))
        )
        XCTAssertNotNil(vm.addressMatches[.ownership])
        vm.remove(.ownership)
        XCTAssertNil(vm.addressMatches[.ownership])
    }

    func testSubmittingShowsWaitingFooterHint() async {
        // While uploads are in flight the upload-step chrome surfaces the
        // "Waiting for upload to finish" dock hint. Full happy-path sequence
        // so submit() runs to completion after the hint is observed.
        SequencedURLProtocol.sequence = [
            .status(
                201,
                body: """
                {"message":"ok","claim":{"id":"claim-fh","status":"under_review"}}
                """,
                delay: 0.2
            ),
            .status(
                200,
                body: """
                {"message":"uploaded","file":{"id":"f-1","url":"https://files/pantopus/fh1"}}
                """
            ),
            .status(
                201,
                body: """
                {"evidence":{"id":"e-1"},"verification_tier":null}
                """
            ),
            .status(
                200,
                body: """
                {"message":"uploaded","file":{"id":"f-2","url":"https://files/pantopus/fh2"}}
                """
            ),
            .status(
                201,
                body: """
                {"evidence":{"id":"e-2"},"verification_tier":null}
                """
            )
        ]
        let vm = makeVM()
        vm.primaryTapped()
        XCTAssertNil(vm.chrome.footerHint, "No hint before submit")
        vm.picked(.identity, file: ClaimPickedFile(filename: "id.jpg", mimeType: "image/jpeg", data: Data([1])))
        vm.picked(.ownership, file: ClaimPickedFile(filename: "deed.pdf", mimeType: "application/pdf", data: Data([2])))
        let task = Task { await vm.submit() }
        await waitFor("isSubmitting surfaces the footer hint") {
            vm.chrome.footerHint == "Waiting for upload to finish"
        }
        await task.value
        XCTAssertNil(vm.chrome.footerHint, "Hint clears once submit completes")
    }
}
