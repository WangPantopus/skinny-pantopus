//
//  SetNewPasswordViewModelTests.swift
//  PantopusTests
//
//  §1B-1 — Covers token capture (carried as an init arg from the deep-link
//  route), submit gating (passwords match + strength + token), the
//  AuthManager.resetPassword call with the right body, the success phase
//  transition, error rollback, and the strength / match hint vocabulary.
//

import XCTest
@testable import Pantopus

@MainActor
final class SetNewPasswordViewModelTests: XCTestCase {
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

    // MARK: - Token parsing from deep-link

    func test_token_is_captured_from_init() {
        let vm = SetNewPasswordViewModel(token: "deep-link-hashed-token")
        XCTAssertEqual(vm.token, "deep-link-hashed-token")
    }

    // MARK: - Gating

    func test_canSubmit_requires_strength_and_match_and_token() {
        let vm = SetNewPasswordViewModel(token: "tok")
        XCTAssertFalse(vm.canSubmit)
        vm.password = "weak"
        vm.confirmPassword = "weak"
        XCTAssertFalse(vm.canSubmit, "weak password should fail strength check")
        vm.password = "strongpass1"
        vm.confirmPassword = "different1"
        XCTAssertFalse(vm.canSubmit, "mismatched confirm should disable submit")
        vm.confirmPassword = "strongpass1"
        XCTAssertTrue(vm.canSubmit)
    }

    func test_canSubmit_false_with_empty_token() {
        let vm = SetNewPasswordViewModel(token: "")
        vm.password = "strongpass1"
        vm.confirmPassword = "strongpass1"
        XCTAssertFalse(vm.canSubmit, "missing token blocks submission")
    }

    // MARK: - Hint vocabulary

    func test_strength_hint_switches_from_rule_to_praise_when_strong() {
        let vm = SetNewPasswordViewModel(token: "tok")
        XCTAssertEqual(vm.strengthHint, "Use 8+ characters with a number and a symbol.")
        vm.password = "strongpass1" // 11 chars, no symbol → fair, still the rule
        XCTAssertEqual(vm.strengthHint, "Use 8+ characters with a number and a symbol.")
        vm.password = "river-otter-92!" // 15 chars + number + symbol → strong
        XCTAssertEqual(vm.passwordStrength, 3)
        XCTAssertEqual(vm.passwordStrengthLabel, "Strong")
        XCTAssertEqual(vm.strengthHint, "Great — long, with a number and a symbol.")
    }

    func test_confirm_match_state_tracks_input() {
        let vm = SetNewPasswordViewModel(token: "tok")
        vm.password = "strongpass1"
        XCTAssertEqual(vm.confirmMatch, .none, "no confirm typed yet")
        vm.confirmPassword = "strongpas"
        XCTAssertEqual(vm.confirmMatch, .mismatch)
        vm.confirmPassword = "strongpass1"
        XCTAssertEqual(vm.confirmMatch, .match)
    }

    // MARK: - Submit success

    func test_submit_calls_resetPassword_with_the_token_and_password() async {
        SequencedURLProtocol.routeResponses["/api/users/reset-password"] = [
            .status(200, body: "{\"message\":\"Password reset successful.\"}")
        ]
        let auth = makeAuth()
        let vm = SetNewPasswordViewModel(token: "deep-tok")
        vm.password = "strongpass1"
        vm.confirmPassword = "strongpass1"

        await vm.submit(using: auth)

        XCTAssertEqual(vm.phase, .success)
        XCTAssertNil(vm.errorMessage)
        XCTAssertFalse(vm.isLoading)

        let body = SequencedURLProtocol.capturedRequests.last?.httpBodyData()
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        XCTAssertEqual(body?["token"] as? String, "deep-tok")
        XCTAssertEqual(body?["newPassword"] as? String, "strongpass1")
    }

    // MARK: - Error rollback

    func test_submit_invalid_token_rolls_back_to_form() async {
        SequencedURLProtocol.routeResponses["/api/users/reset-password"] = [
            .status(400, body: "{\"error\":\"Invalid or expired reset token\"}")
        ]
        let auth = makeAuth()
        let vm = SetNewPasswordViewModel(token: "stale-tok")
        vm.password = "strongpass1"
        vm.confirmPassword = "strongpass1"

        await vm.submit(using: auth)

        if case let .serverError(message) = vm.errorMessage {
            XCTAssertEqual(message, "Invalid or expired reset token")
        } else {
            XCTFail("Expected .serverError, got \(String(describing: vm.errorMessage))")
        }
        XCTAssertEqual(vm.phase, .form, "phase stays on form when submit fails")
        XCTAssertFalse(vm.isLoading)
    }

    func test_submit_blocked_when_invalid_does_not_hit_network() async {
        let auth = makeAuth()
        let vm = SetNewPasswordViewModel(token: "tok")
        // password missing — gate blocks submission
        await vm.submit(using: auth)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 0)
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
