//
//  VerifyEmailLandingViewModelTests.swift
//  PantopusTests
//
//  §1B-2 — Verify email deep-link LANDING. Covers the on-appear token
//  confirm (verifying → success / expired), the no-token guard, the
//  run-once latch, and the Resend cooldown + toast behaviour. Mirrors the
//  Android `VerifyEmailLandingViewModelTest`.
//

import XCTest
@testable import Pantopus

@MainActor
final class VerifyEmailLandingViewModelTests: XCTestCase {
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

    // MARK: - Verify on appear

    func test_verifyOnAppear_success_lands_on_success_phase() async {
        SequencedURLProtocol.routeResponses["/api/users/verify-email"] = [
            .status(200, body: "{\"message\":\"Email verified successfully.\",\"verified\":true}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailLandingViewModel(email: "alice@example.com", token: "hashed-tok")

        await vm.verifyOnAppearIfNeeded(using: auth)

        XCTAssertEqual(vm.phase, .success)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
        let body = SequencedURLProtocol.capturedRequests.last?.httpBodyData()
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        XCTAssertEqual(body?["tokenHash"] as? String, "hashed-tok")
    }

    func test_verifyOnAppear_serverRejection_lands_on_expired_phase() async {
        SequencedURLProtocol.routeResponses["/api/users/verify-email"] = [
            .status(400, body: "{\"error\":\"Invalid or expired token\"}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailLandingViewModel(email: "alice@example.com", token: "stale-tok")

        await vm.verifyOnAppearIfNeeded(using: auth)

        XCTAssertEqual(vm.phase, .expired)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func test_verifyOnAppear_withoutToken_is_expired_and_no_network() async {
        let auth = makeAuth()
        let vm = VerifyEmailLandingViewModel(email: "alice@example.com", token: nil)

        await vm.verifyOnAppearIfNeeded(using: auth)

        XCTAssertEqual(vm.phase, .expired)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 0)
    }

    func test_verifyOnAppear_runs_only_once_per_instance() async {
        SequencedURLProtocol.routeResponses["/api/users/verify-email"] = [
            .status(200, body: "{\"verified\":true}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailLandingViewModel(email: "alice@example.com", token: "hashed-tok")

        await vm.verifyOnAppearIfNeeded(using: auth)
        await vm.verifyOnAppearIfNeeded(using: auth)

        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1, "re-entry must not re-POST")
    }

    // MARK: - Resend

    func test_resend_success_sets_cooldown_and_toast() async {
        SequencedURLProtocol.routeResponses["/api/users/resend-verification"] = [
            .status(200, body: "{\"message\":\"sent\"}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailLandingViewModel(email: "alice@example.com", token: "stale-tok")
        let t0 = Date(timeIntervalSince1970: 5000)

        await vm.resend(using: auth, now: t0)

        XCTAssertEqual(vm.toast?.isError, false)
        XCTAssertEqual(vm.resendCooldownUntil?.timeIntervalSince1970, 5030)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
    }

    func test_resend_short_circuits_within_cooldown() async {
        SequencedURLProtocol.routeResponses["/api/users/resend-verification"] = [
            .status(200, body: "{}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailLandingViewModel(email: "alice@example.com", token: "stale-tok")
        let t0 = Date(timeIntervalSince1970: 5000)

        await vm.resend(using: auth, now: t0)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)

        await vm.resend(using: auth, now: t0.addingTimeInterval(10))
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1, "resend within cooldown must short-circuit")
    }

    func test_resend_blocked_when_no_email() async {
        let auth = makeAuth()
        let vm = VerifyEmailLandingViewModel(email: nil, token: "stale-tok")
        await vm.resend(using: auth)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 0)
        XCTAssertFalse(vm.canResend)
    }

    func test_resend_failure_surfaces_error_toast() async {
        SequencedURLProtocol.routeResponses["/api/users/resend-verification"] = [
            .status(429, body: "{\"error\":\"rate limited\"}")
        ]
        let auth = makeAuth()
        let vm = VerifyEmailLandingViewModel(email: "alice@example.com", token: "stale-tok")

        await vm.resend(using: auth)

        XCTAssertEqual(vm.toast?.isError, true)
        XCTAssertNil(vm.resendCooldownUntil)
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
