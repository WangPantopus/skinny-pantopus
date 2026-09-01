//
//  VerifyEmailViewModelTests.swift
//  PantopusTests
//
//  T6.1c P5 — Covers the resend rate-limit short-circuit (and that it
//  doesn't pile on the backend rate limiter) and the auto-verify path
//  used when the screen is reached via the email deep link.
//

import XCTest
@testable import Pantopus

@MainActor
final class VerifyEmailViewModelTests: XCTestCase {
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

    // MARK: - Resend (rate-limit handling)

    func test_resend_blocked_when_no_email() async {
        let auth = makeAuth()
        let vm = VerifyEmailViewModel(email: nil, token: nil, softGate: true)
        await vm.resend(using: auth)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 0)
    }

    func test_resend_success_sets_cooldown_and_didResend() async {
        SequencedURLProtocol.routeResponses["/api/users/resend-verification"] = [
            .status(200, body: "{\"message\":\"If that email exists, a verification email has been sent.\"}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailViewModel(email: "alice@example.com", token: nil, softGate: true)
        let t0 = Date(timeIntervalSince1970: 5000)

        await vm.resend(using: auth, now: t0)

        XCTAssertTrue(vm.didResend)
        XCTAssertNil(vm.errorMessage)
        XCTAssertEqual(vm.resendCooldownUntil?.timeIntervalSince1970, 5030)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func test_resend_short_circuits_within_cooldown() async {
        SequencedURLProtocol.routeResponses["/api/users/resend-verification"] = [
            .status(200, body: "{}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailViewModel(email: "alice@example.com", token: nil, softGate: true)
        let t0 = Date(timeIntervalSince1970: 5000)

        await vm.resend(using: auth, now: t0)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)

        // Second tap inside the 30s window must not hit the network.
        await vm.resend(using: auth, now: t0.addingTimeInterval(10))
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1, "resend within cooldown must short-circuit")
    }

    func test_cooldownRemaining_reports_seconds_remaining_then_nil() async {
        SequencedURLProtocol.routeResponses["/api/users/resend-verification"] = [
            .status(200, body: "{}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailViewModel(email: "alice@example.com", token: nil, softGate: true)
        let t0 = Date(timeIntervalSince1970: 0)
        await vm.resend(using: auth, now: t0)

        let remaining = vm.cooldownRemaining(now: t0.addingTimeInterval(5))
        XCTAssertNotNil(remaining)
        XCTAssertEqual(remaining ?? 0, 25, accuracy: 0.5)
        XCTAssertNil(vm.cooldownRemaining(now: t0.addingTimeInterval(40)))
    }

    // MARK: - A18.1 countdown label

    func test_countdownLabel_renders_minutes_and_zero_padded_seconds() {
        // Design frame reads "Resend in 0:42"; the label must round up so a
        // 29.4s remainder never renders as "0:29" while the button is still
        // disabled.
        XCTAssertEqual(VerifyEmailView.countdownLabel(42), "0:42")
        XCTAssertEqual(VerifyEmailView.countdownLabel(29.4), "0:30")
        XCTAssertEqual(VerifyEmailView.countdownLabel(5), "0:05")
        XCTAssertEqual(VerifyEmailView.countdownLabel(65), "1:05")
        XCTAssertEqual(VerifyEmailView.countdownLabel(0), "0:00")
    }

    // MARK: - Resend error path

    func test_resend_surface_rate_limited_error() async {
        SequencedURLProtocol.routeResponses["/api/users/resend-verification"] = [
            .status(429, body: "{\"error\":\"rate limited\"}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailViewModel(email: "alice@example.com", token: nil, softGate: true)
        await vm.resend(using: auth)
        XCTAssertEqual(vm.errorMessage, .rateLimited)
        XCTAssertFalse(vm.isResending)
    }

    // MARK: - Auto-verify path (deep-link)

    func test_verifyOnAppearIfNeeded_with_token_hits_endpoint() async {
        SequencedURLProtocol.routeResponses["/api/users/verify-email"] = [
            .status(200, body: "{\"message\":\"Email verified successfully.\",\"verified\":true}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailViewModel(email: "alice@example.com", token: "hashed-tok", softGate: true)

        await vm.verifyOnAppearIfNeeded(using: auth)

        XCTAssertTrue(vm.didVerify)
        XCTAssertNil(vm.errorMessage)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
        let body = SequencedURLProtocol.capturedRequests.last?.httpBodyData()
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        XCTAssertEqual(body?["tokenHash"] as? String, "hashed-tok")
    }

    func test_verifyOnAppearIfNeeded_is_no_op_without_token() async {
        let auth = makeAuth()
        let vm = VerifyEmailViewModel(email: "alice@example.com", token: nil, softGate: true)
        await vm.verifyOnAppearIfNeeded(using: auth)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 0)
        XCTAssertFalse(vm.didVerify)
    }

    func test_verifyOnAppearIfNeeded_runs_only_once_per_instance() async {
        SequencedURLProtocol.routeResponses["/api/users/verify-email"] = [
            .status(200, body: "{\"message\":\"ok\",\"verified\":true}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailViewModel(email: "alice@example.com", token: "hashed-tok", softGate: true)
        await vm.verifyOnAppearIfNeeded(using: auth)
        await vm.verifyOnAppearIfNeeded(using: auth)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1, "re-entry must not re-POST")
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
