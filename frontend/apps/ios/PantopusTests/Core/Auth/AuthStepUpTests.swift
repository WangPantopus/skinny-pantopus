//
//  AuthStepUpTests.swift
//  PantopusTests
//
//  The 403 `STEP_UP_REQUIRED` interceptor (CONTRACT "Client behaviour"):
//  run step-up, retry once with `X-Step-Up`. Password path only — the
//  `device_key` path needs a Secure Enclave and Face ID and is exercised
//  on device. Also `AuthManager.stepUp(purpose:)` / `reauthenticate`.
//

import XCTest
@testable import Pantopus

@MainActor
final class AuthStepUpTests: XCTestCase {
    private var markerDirectory: URL!
    private var store: InMemorySecureStore!

    override func setUpWithError() throws {
        try super.setUpWithError()
        SequencedURLProtocol.reset()
        store = InMemorySecureStore()
        markerDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("auth-stepup-tests-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDownWithError() throws {
        SequencedURLProtocol.reset()
        try? FileManager.default.removeItem(at: markerDirectory)
        try super.tearDownWithError()
    }

    private func makeSignedInManager() throws -> AuthManager {
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        let manager = AuthManager(
            store: store,
            apiClient: client,
            installMarker: InstallMarker(directory: markerDirectory),
            presenceGate: FakePresenceGate(.verified),
            allowSecureEnclave: false
        )
        try store.set("at", for: SecureStoreKey.accessToken)
        try store.set("rt", for: SecureStoreKey.refreshToken)
        try store.set("u_123", for: SecureStoreKey.userId)
        _ = try DeviceIdentity.loadOrCreate(in: store, allowSecureEnclave: false)
        manager.setAccessToken("at")
        manager.setState(.signedIn(UserDTO(id: "u_123", email: "alice@example.com", displayName: "Alice", avatarURL: nil)))
        return manager
    }

    private func stepUpRequired(purpose: String, methods: [String]) -> SequencedURLProtocol.Response {
        let list = methods.map { "\"\($0)\"" }.joined(separator: ",")
        let body = "{\"error\":\"Step-up required\",\"code\":\"STEP_UP_REQUIRED\",\"purpose\":\"\(purpose)\",\"methods\":[\(list)]}"
        return .status(403, body: body)
    }

    // MARK: - Interceptor

    func testStepUpRequiredRunsPasswordStepUpAndRetriesOnceWithHeader() async throws {
        let manager = try makeSignedInManager()
        var promptedPurposes: [StepUpPurpose] = []
        manager.stepUpPasswordPrompt = { purpose in
            promptedPurposes.append(purpose)
            return "hunter22"
        }
        SequencedURLProtocol.routeResponses["/api/auth/sessions/revoke-others"] = [
            stepUpRequired(purpose: "revoke_sessions", methods: ["password"]),
            .status(200, body: "{\"revoked\":2}")
        ]
        SequencedURLProtocol.routeResponses["/api/auth/step-up"] = [
            .status(200, body: "{\"stepUpToken\":\"su-token\",\"expiresAt\":\"2026-08-18T10:05:00Z\",\"purpose\":\"revoke_sessions\"}")
        ]

        let response: RevokeOthersResponse = try await manager.apiClient.request(
            Endpoint(method: .post, path: "/api/auth/sessions/revoke-others")
        )

        XCTAssertEqual(response.revoked, 2)
        XCTAssertEqual(promptedPurposes, [.revokeSessions])
        let calls = SequencedURLProtocol.captured(path: "/api/auth/sessions/revoke-others")
        XCTAssertEqual(calls.count, 2, "one 403, one replay")
        XCTAssertNil(calls[0].value(forHTTPHeaderField: "X-Step-Up"))
        XCTAssertEqual(calls[1].value(forHTTPHeaderField: "X-Step-Up"), "su-token")
        XCTAssertEqual(calls[1].value(forHTTPHeaderField: "Authorization"), "Bearer at")

        let stepUp = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/auth/step-up").first)
        let body = try XCTUnwrap(stepUp.authTestJSONBody())
        XCTAssertEqual(body["method"] as? String, "password")
        XCTAssertEqual(body["password"] as? String, "hunter22")
        XCTAssertEqual(body["purpose"] as? String, "revoke_sessions")
        XCTAssertEqual(stepUp.value(forHTTPHeaderField: "Authorization"), "Bearer at")
        // CONTRACT: `/api/auth/step-up` is Bearer-only — the route runs no
        // DPoP middleware and Android sends no proof either. The `device_key`
        // proof is the challenge signature in the body, not a header.
        XCTAssertNil(stepUp.authTestDPoP(), "step-up is Bearer-only per CONTRACT")
    }

    func testStepUpRequiredWithoutAPromptSurfacesForbidden() async throws {
        let manager = try makeSignedInManager()
        manager.stepUpPasswordPrompt = nil
        SequencedURLProtocol.routeResponses["/api/auth/devices/dev-1"] = [
            stepUpRequired(purpose: "revoke_device", methods: ["password"])
        ]

        do {
            _ = try await manager.apiClient.request(Endpoint(method: .delete, path: "/api/auth/devices/dev-1"), as: AuthOkResponse.self)
            XCTFail("Expected .forbidden")
        } catch let error as APIError {
            guard case .forbidden = error else { return XCTFail("Expected .forbidden, got \(error)") }
        }
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/auth/devices/dev-1").count, 1, "no replay without a token")
        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/auth/step-up").isEmpty)
    }

    func testStepUpRequiredWhenUserCancelsSurfacesForbidden() async throws {
        let manager = try makeSignedInManager()
        manager.stepUpPasswordPrompt = { _ in nil }
        SequencedURLProtocol.routeResponses["/api/auth/sessions/revoke-all"] = [
            stepUpRequired(purpose: "revoke_sessions", methods: ["password"])
        ]

        do {
            _ = try await manager.apiClient.request(Endpoint(method: .post, path: "/api/auth/sessions/revoke-all"), as: AuthOkResponse.self)
            XCTFail("Expected .forbidden")
        } catch let error as APIError {
            guard case .forbidden = error else { return XCTFail("Expected .forbidden, got \(error)") }
        }
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/auth/sessions/revoke-all").count, 1)
    }

    func testStepUpIsAttemptedOnlyOncePerRequest() async throws {
        let manager = try makeSignedInManager()
        manager.stepUpPasswordPrompt = { _ in "hunter22" }
        SequencedURLProtocol.routeResponses["/api/auth/sessions/revoke-others"] = [
            stepUpRequired(purpose: "revoke_sessions", methods: ["password"]),
            stepUpRequired(purpose: "revoke_sessions", methods: ["password"]),
            .status(200, body: "{\"revoked\":1}")
        ]
        SequencedURLProtocol.routeResponses["/api/auth/step-up"] = [
            .status(200, body: "{\"stepUpToken\":\"su-1\",\"purpose\":\"revoke_sessions\"}"),
            .status(200, body: "{\"stepUpToken\":\"su-2\",\"purpose\":\"revoke_sessions\"}")
        ]

        do {
            _ = try await manager.apiClient.request(
                Endpoint(method: .post, path: "/api/auth/sessions/revoke-others"),
                as: RevokeOthersResponse.self
            )
            XCTFail("Expected .forbidden after the second 403")
        } catch let error as APIError {
            guard case .forbidden = error else { return XCTFail("Expected .forbidden, got \(error)") }
        }
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/auth/sessions/revoke-others").count, 2)
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/auth/step-up").count, 1)
    }

    func testPlain403IsNotIntercepted() async throws {
        let manager = try makeSignedInManager()
        var prompted = false
        manager.stepUpPasswordPrompt = { _ in
            prompted = true
            return "x"
        }
        SequencedURLProtocol.routeResponses["/api/users/profile"] = [.status(403, body: "{\"error\":\"forbidden\"}")]

        do {
            _ = try await manager.apiClient.request(UsersEndpoints.profile(), as: ProfileResponse.self)
            XCTFail("Expected .forbidden")
        } catch let error as APIError {
            guard case .forbidden = error else { return XCTFail("Expected .forbidden, got \(error)") }
        }
        XCTAssertFalse(prompted)
    }

    // MARK: - stepUp(purpose:) / reauthenticate

    func testStepUpWithPasswordMapsErrors() async throws {
        let manager = try makeSignedInManager()
        manager.stepUpPasswordPrompt = { _ in "wrong" }
        SequencedURLProtocol.routeResponses["/api/auth/step-up"] = [
            .status(401, body: "{\"error\":\"Invalid password\",\"code\":\"UNAUTHORIZED\"}"),
            .status(429, body: "{\"error\":\"Too many\"}")
        ]
        do {
            _ = try await manager.stepUp(purpose: .deleteAccount)
            XCTFail("Expected invalidPassword")
        } catch let error as StepUpError {
            XCTAssertEqual(error, .invalidPassword)
        }
        do {
            _ = try await manager.stepUp(purpose: .deleteAccount)
            XCTFail("Expected rateLimited")
        } catch let error as StepUpError {
            XCTAssertEqual(error, .rateLimited)
        }
    }

    func testWrongPasswordNeverTriggersRefreshOrSignOut() async throws {
        let manager = try makeSignedInManager()
        manager.stepUpPasswordPrompt = { _ in "wrong" }
        SequencedURLProtocol.routeResponses["/api/auth/step-up"] = [
            .status(401, body: "{\"error\":\"Invalid password\",\"code\":\"UNAUTHORIZED\"}")
        ]
        SequencedURLProtocol.routeResponses["/api/users/refresh"] = [.status(200, body: Fixtures.refreshJSON())]

        do {
            _ = try await manager.stepUp(purpose: .revokeSessions)
            XCTFail("Expected invalidPassword")
        } catch let error as StepUpError {
            XCTAssertEqual(error, .invalidPassword)
        }
        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/users/refresh").isEmpty, "a refused password is not an expired session")
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/auth/step-up").count, 1, "never replayed")
        if case .signedIn = manager.state { /* pass */ } else {
            XCTFail("Expected to stay signed in, got \(manager.state)")
        }
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt")

        // Same for `/reauthenticate`.
        SequencedURLProtocol.routeResponses["/api/users/reauthenticate"] = [
            .status(401, body: "{\"error\":\"Invalid password\"}")
        ]
        do {
            _ = try await manager.reauthenticate(password: "wrong")
            XCTFail("Expected invalidPassword")
        } catch let error as StepUpError {
            XCTAssertEqual(error, .invalidPassword)
        }
        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/users/refresh").isEmpty)
        if case .signedIn = manager.state { /* pass */ } else {
            XCTFail("Expected to stay signed in, got \(manager.state)")
        }
    }

    func testStepUpWithoutAnyMethodIsUnavailable() async throws {
        let manager = try makeSignedInManager()
        manager.stepUpPasswordPrompt = nil
        do {
            _ = try await manager.stepUp(purpose: .revokeDevice)
            XCTFail("Expected unavailable")
        } catch let error as StepUpError {
            XCTAssertEqual(error, .unavailable)
        }
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testStepUpHonoursServerMethodList() async throws {
        // Server says only `device_key` is accepted; without an enrolled key
        // the client must not fall back to a password prompt.
        let manager = try makeSignedInManager()
        var prompted = false
        manager.stepUpPasswordPrompt = { _ in
            prompted = true
            return "pw"
        }
        do {
            _ = try await manager.stepUp(purpose: .revokeDevice, methods: ["device_key"])
            XCTFail("Expected unavailable")
        } catch let error as StepUpError {
            XCTAssertEqual(error, .unavailable)
        }
        XCTAssertFalse(prompted)
        XCTAssertFalse(manager.canStepUpWithDeviceKey)
    }

    func testReauthenticateReturnsWildcardStepUpToken() async throws {
        let manager = try makeSignedInManager()
        SequencedURLProtocol.routeResponses["/api/users/reauthenticate"] = [
            .status(200, body: "{\"verified\":true,\"stepUpToken\":\"su-generic\",\"expiresAt\":1755500300,\"purpose\":\"generic\"}")
        ]
        let response = try await manager.reauthenticate(password: "hunter22")
        XCTAssertEqual(response.verified, true)
        XCTAssertEqual(response.stepUpToken, "su-generic")
        XCTAssertEqual(response.purpose, "generic")
        XCTAssertEqual(response.expiresAt?.date, Date(timeIntervalSince1970: 1_755_500_300))
        let request = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/reauthenticate").first)
        XCTAssertEqual(request.authTestJSONBody()?["password"] as? String, "hunter22")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer at")
    }

    // MARK: - Scoped sign-out

    func testSignOutOthersSendsStepUpHeaderAndKeepsLocalSession() async throws {
        let manager = try makeSignedInManager()
        SequencedURLProtocol.routeResponses["/api/users/logout"] = [.status(200, body: "{\"success\":true,\"revoked\":3}")]

        let response = try await manager.signOut(scope: .others, stepUpToken: "su-token")

        XCTAssertEqual(response?.revoked, 3)
        if case .signedIn = manager.state { /* pass */ } else {
            XCTFail("Expected to stay signed in, got \(manager.state)")
        }
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt")
        let logout = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/logout").first)
        XCTAssertEqual(logout.value(forHTTPHeaderField: "X-Step-Up"), "su-token")
        XCTAssertEqual(logout.value(forHTTPHeaderField: "Authorization"), "Bearer at")
        XCTAssertEqual(logout.authTestJSONBody()?["scope"] as? String, "others")
        XCTAssertNil(logout.authTestJSONBody()?["refreshToken"])
    }

    func testSignOutGlobalWipesLocalSession() async throws {
        let manager = try makeSignedInManager()
        SequencedURLProtocol.routeResponses["/api/users/logout"] = [.status(200, body: "{\"success\":true}")]

        _ = try await manager.signOut(scope: .global, stepUpToken: "su-token")

        if case .signedOut = manager.state { /* pass */ } else {
            XCTFail("Expected .signedOut, got \(manager.state)")
        }
        XCTAssertNil(store.get(SecureStoreKey.refreshToken))
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/users/logout").first?.authTestJSONBody()?["scope"] as? String, "global")
    }
}
