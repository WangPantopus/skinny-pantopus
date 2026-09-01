//
//  DisambiguateMailFormViewModelTests.swift
//  PantopusTests
//
//  A13.15 reshape — OCR-confidence tone gating, candidate match scoring,
//  quick-action chip handling, fallback selection, and the resolve happy /
//  error paths for the Disambiguate form.
//

import XCTest
@testable import Pantopus

@MainActor
final class DisambiguateMailFormViewModelTests: XCTestCase {
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

    private func makeVM(confidence: Double) -> DisambiguateMailFormViewModel {
        DisambiguateMailFormViewModel(
            mailId: "mail-1",
            ocrRecipient: "Maria K. · 412 Elm St",
            confidence: confidence,
            envelopeImageURL: nil,
            api: makeAPI()
        ) { true }
    }

    // MARK: - Tone gating

    func testCleanConfidenceYieldsCleanToneAndPreselect() {
        let vm = makeVM(confidence: 0.97)
        XCTAssertEqual(vm.ocrTone, .clean)
        XCTAssertFalse(vm.isUnclear)
        // The single strong candidate is auto-picked.
        XCTAssertEqual(vm.selection, .candidate("maria"))
        XCTAssertTrue(vm.canConfirm)
        XCTAssertNil(vm.confirmHint)
        XCTAssertEqual(vm.candidatesOverline, "Who is this for?")
    }

    func testUnclearConfidenceBlocksConfirmAndShowsHint() {
        let vm = makeVM(confidence: 0.31)
        XCTAssertEqual(vm.ocrTone, .unclear)
        XCTAssertTrue(vm.isUnclear)
        XCTAssertNil(vm.selection)
        XCTAssertFalse(vm.canConfirm)
        XCTAssertNotNil(vm.confirmHint)
        XCTAssertEqual(vm.candidatesOverline, "Best guesses · none confident")
    }

    // MARK: - Match scoring

    func testMatchTierThresholds() {
        XCTAssertEqual(MailMatchTier.from(score: 0.97), .strong)
        XCTAssertEqual(MailMatchTier.from(score: 0.70), .strong)
        XCTAssertEqual(MailMatchTier.from(score: 0.41), .partial)
        XCTAssertEqual(MailMatchTier.from(score: 0.35), .partial)
        XCTAssertEqual(MailMatchTier.from(score: 0.22), .weak)
    }

    func testCandidatePercentAndTier() {
        let vm = makeVM(confidence: 0.97)
        let maria = vm.candidates.first { $0.id == "maria" }
        XCTAssertEqual(maria?.matchPercent, 97)
        XCTAssertEqual(maria?.tier, .strong)
        let mika = vm.candidates.first { $0.id == "mika" }
        XCTAssertEqual(mika?.tier, .weak)
    }

    // MARK: - Selection / quick actions

    func testSelectCandidateInCleanFrame() {
        let vm = makeVM(confidence: 0.97)
        vm.selectCandidate("marcus")
        XCTAssertTrue(vm.isSelected("marcus"))
        XCTAssertTrue(vm.canConfirm)
    }

    func testSelectCandidateIgnoredInUnclearFrame() {
        let vm = makeVM(confidence: 0.31)
        vm.selectCandidate("maria")
        XCTAssertNil(vm.selection)
        XCTAssertFalse(vm.canConfirm)
    }

    func testThisIsMeSelectsMe() {
        let vm = makeVM(confidence: 0.97)
        vm.selectThisIsMe()
        XCTAssertEqual(vm.selection, .me)
        XCTAssertTrue(vm.canConfirm)
    }

    func testRouteToOtherClearsSelection() {
        let vm = makeVM(confidence: 0.97)
        XCTAssertNotNil(vm.selection) // starts auto-picked
        vm.routeToOther()
        XCTAssertNil(vm.selection)
        XCTAssertFalse(vm.canConfirm)
    }

    func testFallbackRecordsChoiceAndToast() {
        let vm = makeVM(confidence: 0.31)
        vm.selectFallback(.markAsJunk)
        XCTAssertEqual(vm.lastFallback, .markAsJunk)
        XCTAssertEqual(vm.toast?.kind, .success)
        XCTAssertTrue(vm.isDirty)
    }

    // MARK: - Submit

    func testSubmitCandidateSendsDrawer() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"message\":\"Routing resolved\",\"drawer\":\"home\"}")
        ]
        let vm = makeVM(confidence: 0.97)
        vm.selectCandidate("maria")
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        XCTAssertEqual(vm.toast?.kind, .success)
        let body = SequencedURLProtocol.capturedRequests.last?.httpBodyData() ?? Data()
        let json = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
        XCTAssertEqual(json?["drawer"] as? String, "home")
        XCTAssertEqual(json?["mailId"] as? String, "mail-1")
        XCTAssertNil(json?["addAlias"])
        XCTAssertNil(json?["aliasString"])
    }

    func testSubmitThisIsMeSendsPersonalDrawer() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"message\":\"Routing resolved\",\"drawer\":\"personal\"}")
        ]
        let vm = makeVM(confidence: 0.97)
        vm.selectThisIsMe()
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        let body = SequencedURLProtocol.capturedRequests.last?.httpBodyData() ?? Data()
        let json = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
        XCTAssertEqual(json?["drawer"] as? String, "personal")
    }

    func testSubmitUnclearFrameBlocked() async {
        let vm = makeVM(confidence: 0.31)
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertEqual(vm.toast?.kind, .error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testSubmitFailureSurfacesErrorToast() async {
        SequencedURLProtocol.sequence = [
            .status(404, body: "{\"error\":\"Mail not found\"}")
        ]
        let vm = makeVM(confidence: 0.97)
        vm.selectCandidate("maria")
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertEqual(vm.toast?.kind, .error)
    }
}

private extension URLRequest {
    /// Pull the body bytes regardless of whether `httpBody` or
    /// `httpBodyStream` was set by URLSession.
    func httpBodyData() -> Data? {
        if let direct = httpBody { return direct }
        guard let stream = httpBodyStream else { return nil }
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
}
