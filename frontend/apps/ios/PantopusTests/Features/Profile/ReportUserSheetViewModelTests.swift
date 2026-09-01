//
//  ReportUserSheetViewModelTests.swift
//  PantopusTests
//
//  P6.2 — covers the Report-User sheet view-model: required-details
//  gating for "other", reason → backend-key mapping, submit happy path,
//  and the friendly failure surface.
//

import XCTest
@testable import Pantopus

@MainActor
final class ReportUserSheetViewModelTests: XCTestCase {
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

    /// URLProtocol-stubbed sessions strip `httpBody` and expose it via
    /// `httpBodyStream` — mirror `EditProfileViewModelTests` so payload
    /// assertions hold up.
    private func requestBody(_ request: URLRequest) -> Data {
        if let body = request.httpBody { return body }
        if let stream = request.httpBodyStream { return Data(reading: stream) }
        return Data()
    }

    // MARK: - canSubmit gating

    func test_canSubmit_isFalse_withoutReason() {
        let vm = ReportUserSheetViewModel(userId: "u1", client: makeAPI())
        XCTAssertFalse(vm.canSubmit)
    }

    func test_canSubmit_isTrue_forReasonOtherThanOther_withoutDetails() {
        let vm = ReportUserSheetViewModel(userId: "u1", client: makeAPI())
        vm.selectedReason = .spam
        XCTAssertTrue(vm.canSubmit)
        XCTAssertFalse(vm.detailsRequired)
    }

    func test_canSubmit_isFalse_forOtherReason_withEmptyDetails() {
        let vm = ReportUserSheetViewModel(userId: "u1", client: makeAPI())
        vm.selectedReason = .other
        XCTAssertTrue(vm.detailsRequired)
        XCTAssertFalse(vm.canSubmit)
        vm.details = "   \n  "
        XCTAssertFalse(vm.canSubmit)
    }

    func test_canSubmit_isTrue_forOtherReason_withDetails() {
        let vm = ReportUserSheetViewModel(userId: "u1", client: makeAPI())
        vm.selectedReason = .other
        vm.details = "Selling counterfeit goods."
        XCTAssertTrue(vm.canSubmit)
    }

    // MARK: - Submit happy path

    func test_submit_postsValidBody_andMarksSucceeded() async throws {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"message\":\"User reported successfully.\",\"already_reported\":false}")
        ]
        let vm = ReportUserSheetViewModel(userId: "u9", client: makeAPI())
        vm.selectedReason = .spam
        vm.details = ""

        await vm.submit()

        XCTAssertEqual(vm.state, .succeeded)
        let captured = SequencedURLProtocol.capturedRequests
        XCTAssertEqual(captured.count, 1)
        let request = try XCTUnwrap(captured.first)
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/users/u9/report")
        let body = requestBody(request)
        let decoded = try JSONSerialization.jsonObject(with: body) as? [String: Any]
        XCTAssertEqual(decoded?["reason"] as? String, "spam")
        XCTAssertNil(decoded?["details"] as? String)
    }

    func test_submit_collapsesUnmappedReasons_andPrefixesDetails() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: "{}")]
        let vm = ReportUserSheetViewModel(userId: "u9", client: makeAPI())
        vm.selectedReason = .impersonation
        vm.details = "Pretends to be my landlord."

        await vm.submit()

        XCTAssertEqual(vm.state, .succeeded)
        let request = try XCTUnwrap(SequencedURLProtocol.capturedRequests.first)
        let decoded = try JSONSerialization.jsonObject(with: requestBody(request)) as? [String: Any]
        XCTAssertEqual(decoded?["reason"] as? String, "other")
        XCTAssertEqual(
            decoded?["details"] as? String,
            "[Impersonation] Pretends to be my landlord."
        )
    }

    func test_submit_mapsHateSpeech_toHarassment_withDetailsPrefix() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: "{}")]
        let vm = ReportUserSheetViewModel(userId: "u9", client: makeAPI())
        vm.selectedReason = .hateSpeech
        vm.details = "" // hate speech is gated only by reason, not details

        await vm.submit()

        XCTAssertEqual(vm.state, .succeeded)
        let request = try XCTUnwrap(SequencedURLProtocol.capturedRequests.first)
        let decoded = try JSONSerialization.jsonObject(with: requestBody(request)) as? [String: Any]
        XCTAssertEqual(decoded?["reason"] as? String, "harassment")
        XCTAssertEqual(decoded?["details"] as? String, "[Hate speech]")
    }

    // MARK: - Failure path

    func test_submit_setsFailedState_onClientError() async {
        SequencedURLProtocol.sequence = [
            .status(400, body: "{\"error\":\"You cannot report yourself\"}")
        ]
        let vm = ReportUserSheetViewModel(userId: "u9", client: makeAPI())
        vm.selectedReason = .harassment

        await vm.submit()

        guard case let .failed(message) = vm.state else {
            return XCTFail("Expected .failed, got \(vm.state)")
        }
        XCTAssertFalse(message.isEmpty)
    }

    func test_submit_setsFailedState_onNotFound() async {
        SequencedURLProtocol.sequence = [
            .status(404, body: "{\"error\":\"User not found\"}")
        ]
        let vm = ReportUserSheetViewModel(userId: "missing", client: makeAPI())
        vm.selectedReason = .spam

        await vm.submit()

        guard case let .failed(message) = vm.state else {
            return XCTFail("Expected .failed, got \(vm.state)")
        }
        XCTAssertTrue(message.contains("user"))
    }

    func test_submit_doesNotFire_whenAlreadySubmitting() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{}")]
        let vm = ReportUserSheetViewModel(userId: "u9", client: makeAPI())
        vm.selectedReason = .spam

        await vm.submit()
        await vm.submit() // second call after success — should no-op

        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func test_submit_doesNotFire_whenCannotSubmit() async {
        let vm = ReportUserSheetViewModel(userId: "u9", client: makeAPI())
        vm.selectedReason = .other
        vm.details = ""

        await vm.submit()

        XCTAssertEqual(vm.state, .idle)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 0)
    }
}

// MARK: - Helpers

private extension Data {
    /// Read an `InputStream` to EOF — needed because `URLProtocol`
    /// surfaces JSON request bodies via `httpBodyStream`, not `httpBody`.
    init(reading stream: InputStream) {
        var data = Data()
        stream.open()
        defer { stream.close() }
        let bufferSize = 4096
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        self = data
    }
}
