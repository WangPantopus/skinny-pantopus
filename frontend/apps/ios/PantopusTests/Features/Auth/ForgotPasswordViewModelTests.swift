//
//  ForgotPasswordViewModelTests.swift
//  PantopusTests
//
//  T6.1c P5 — Covers `AuthManager.forgotPassword` is called with the
//  trimmed/lowercased email, the form → sent phase transition, error
//  rollback, and the local resend cooldown short-circuit.
//

import XCTest
@testable import Pantopus

@MainActor
final class ForgotPasswordViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeAuth() -> AuthManager {
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        return AuthManager(store: InMemorySecureStore(), apiClient: client)
    }

    // MARK: - Validation

    func test_canSubmit_requires_valid_email() {
        let vm = ForgotPasswordViewModel()
        XCTAssertFalse(vm.canSubmit)
        vm.email = "not-an-email"
        XCTAssertFalse(vm.canSubmit)
        vm.email = "alice@example.com"
        XCTAssertTrue(vm.canSubmit)
    }

    // MARK: - Submit

    func test_requestReset_calls_forgotPassword_with_normalized_email_and_flips_phase() async {
        SequencedURLProtocol.routeResponses["/api/users/forgot-password"] = [
            .status(200, body: "{\"message\":\"If that email exists, a password reset link has been sent.\"}")
        ]
        let auth = makeAuth()
        let vm = ForgotPasswordViewModel()
        vm.email = "  Alice@Example.com  "

        await vm.requestReset(using: auth, now: Date(timeIntervalSince1970: 1000))

        if case let .sent(email) = vm.phase {
            XCTAssertEqual(email, "alice@example.com", "email should be trimmed + lowercased")
        } else {
            XCTFail("Expected .sent phase, got \(vm.phase)")
        }
        XCTAssertNil(vm.errorMessage)
        XCTAssertFalse(vm.isLoading)
        XCTAssertEqual(vm.resendCooldownUntil?.timeIntervalSince1970, 1030)

        let body = SequencedURLProtocol.capturedRequests.last?.httpBodyData()
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        XCTAssertEqual(body?["email"] as? String, "alice@example.com")
    }

    func test_requestReset_rolls_back_loading_state_on_error() async {
        SequencedURLProtocol.routeResponses["/api/users/forgot-password"] = [
            .status(429, body: "{\"error\":\"rate limited\"}")
        ]
        let auth = makeAuth()
        let vm = ForgotPasswordViewModel()
        vm.email = "alice@example.com"

        await vm.requestReset(using: auth)

        XCTAssertEqual(vm.errorMessage, .rateLimited)
        XCTAssertFalse(vm.isLoading, "isLoading must reset after failure")
        XCTAssertEqual(vm.phase, .form, "phase must stay on .form when the call errors")
    }

    func test_requestReset_does_not_hit_network_when_invalid() async {
        let auth = makeAuth()
        let vm = ForgotPasswordViewModel() // blank email
        await vm.requestReset(using: auth)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 0)
        XCTAssertEqual(vm.phase, .form)
    }

    // MARK: - Resend

    func test_resend_honours_local_cooldown() async {
        SequencedURLProtocol.routeResponses["/api/users/forgot-password"] = [
            .status(200, body: "{}"),
            .status(200, body: "{}")
        ]
        let auth = makeAuth()
        let vm = ForgotPasswordViewModel()
        vm.email = "alice@example.com"
        let t0 = Date(timeIntervalSince1970: 1000)

        await vm.requestReset(using: auth, now: t0)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)

        // Within cooldown — must NOT hit the network.
        await vm.resend(email: "alice@example.com", using: auth, now: t0.addingTimeInterval(5))
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1, "resend within cooldown must short-circuit")

        // After cooldown — the call goes through.
        await vm.resend(email: "alice@example.com", using: auth, now: t0.addingTimeInterval(31))
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }
}

private extension URLRequest {
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
