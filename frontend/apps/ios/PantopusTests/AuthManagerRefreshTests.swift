//
//  AuthManagerRefreshTests.swift
//  PantopusTests
//
//  Silent token refresh + offline-resilient session restore (persistent
//  sign-in). Split out of AuthManagerTests so each file stays within length
//  limits. Same harness: in-memory SecureStore + SequencedURLProtocol-backed
//  APIClient, so nothing hits the real Keychain or network.
//

// swiftlint:disable type_body_length

import XCTest
@testable import Pantopus

@MainActor
final class AuthManagerRefreshTests: XCTestCase {
    private var markerDirectory: URL!
    /// Frozen clock for the expiry rules (`expiresAt - now < 120 s`).
    private let now = Date(timeIntervalSince1970: 1_755_500_000)

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
        markerDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("auth-refresh-tests-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        try? FileManager.default.removeItem(at: markerDirectory)
        super.tearDown()
    }

    // MARK: - Helpers

    private func makeManager(store: any SecureStore = InMemorySecureStore()) -> AuthManager {
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        let instant = now
        let clock: @Sendable () -> Date = { instant }
        return AuthManager(
            store: store,
            apiClient: client,
            installMarker: InstallMarker(directory: markerDirectory),
            presenceGate: FakePresenceGate(.verified),
            allowSecureEnclave: false,
            now: clock
        )
    }

    /// Seed a live session: tokens, session id and an access-token expiry
    /// `secondsLeft` seconds from the frozen clock.
    private func seedSession(_ store: InMemorySecureStore, secondsLeft: TimeInterval) throws {
        try store.set("old-at", for: SecureStoreKey.accessToken)
        try store.set("rt-current", for: SecureStoreKey.refreshToken)
        try store.set("u_1", for: SecureStoreKey.userId)
        try store.set("sess-1", for: SecureStoreKey.sessionId)
        try store.set(String(Int(now.addingTimeInterval(secondsLeft).timeIntervalSince1970)), for: SecureStoreKey.expiresAt)
        try store.set(cachedUserJSON(), for: SecureStoreKey.cachedUser)
    }

    private func stub(_ path: String, status: Int, body: String) {
        SequencedURLProtocol.routeResponses[path] = [.status(status, body: body)]
    }

    private func cachedUserJSON() throws -> String {
        let cached = UserDTO(
            id: "u_1",
            email: "alice@example.com",
            username: "alice",
            displayName: "Alice",
            avatarURL: nil,
            isAdmin: false
        )
        let data = try JSONEncoder().encode(cached)
        return try XCTUnwrap(String(bytes: data, encoding: .utf8))
    }

    // MARK: - Refresh outcomes

    func testRefreshIfPossibleSuccessRotatesTokens() async throws {
        let store = InMemorySecureStore()
        try store.set("old-at", for: SecureStoreKey.accessToken)
        try store.set("rt-current", for: SecureStoreKey.refreshToken)
        stub(
            "/api/users/refresh",
            status: 200,
            body: "{\"ok\":true,\"accessToken\":\"new-at\",\"refreshToken\":\"new-rt\",\"expiresIn\":3600,\"expiresAt\":1800000000}"
        )
        let manager = makeManager(store: store)

        let outcome = await manager.refreshIfPossible()

        XCTAssertEqual(outcome, .rotated)
        XCTAssertEqual(manager.accessToken, "new-at")
        XCTAssertEqual(store.get(SecureStoreKey.accessToken), "new-at")
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "new-rt")
    }

    func testRefreshIfPossibleRejectedDoesNotSignOut() async {
        let store = InMemorySecureStore()
        try? store.set("stale-rt", for: SecureStoreKey.refreshToken)
        stub("/api/users/refresh", status: 401, body: "{\"error\":\"Session expired\"}")
        let manager = makeManager(store: store)

        let outcome = await manager.refreshIfPossible()

        XCTAssertEqual(outcome, .authRejected)
        // refreshIfPossible must NOT sign out / wipe — the caller decides.
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "stale-rt")
    }

    func testRefreshIfPossibleTransientFailureKeepsTokens() async {
        let store = InMemorySecureStore()
        try? store.set("old-at", for: SecureStoreKey.accessToken)
        try? store.set("rt-current", for: SecureStoreKey.refreshToken)
        // A 5xx from the refresh endpoint is transient — not an auth rejection.
        stub("/api/users/refresh", status: 500, body: "{\"error\":\"boom\"}")
        let manager = makeManager(store: store)

        let outcome = await manager.refreshIfPossible()

        XCTAssertEqual(outcome, .transient)
        // Tokens must survive a transient refresh failure.
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt-current")
        XCTAssertEqual(store.get(SecureStoreKey.accessToken), "old-at")
    }

    func testRefreshIfPossible429IsTransient() async {
        let store = InMemorySecureStore()
        try? store.set("old-at", for: SecureStoreKey.accessToken)
        try? store.set("rt-current", for: SecureStoreKey.refreshToken)
        // Rate-limited refresh must NOT sign the user out.
        stub("/api/users/refresh", status: 429, body: "{\"error\":\"Too many requests\"}")
        let manager = makeManager(store: store)

        let outcome = await manager.refreshIfPossible()

        XCTAssertEqual(outcome, .transient)
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt-current")
    }

    func testRefreshIfPossibleIsSingleFlight() async throws {
        let store = InMemorySecureStore()
        try store.set("old-at", for: SecureStoreKey.accessToken)
        try store.set("rt-current", for: SecureStoreKey.refreshToken)
        // Only ONE refresh response is queued, with a small delay so the two
        // concurrent calls genuinely overlap. If they were not coalesced, the
        // second would drain the empty queue (599) — and we assert exactly one
        // network call regardless.
        SequencedURLProtocol.routeResponses["/api/users/refresh"] = [
            .status(
                200,
                body: "{\"ok\":true,\"accessToken\":\"new-at\",\"refreshToken\":\"new-rt\",\"expiresIn\":3600,\"expiresAt\":1800000000}",
                delay: 0.05
            )
        ]
        let manager = makeManager(store: store)

        async let first = manager.refreshIfPossible()
        async let second = manager.refreshIfPossible()
        let r1 = await first
        let r2 = await second

        XCTAssertEqual([r1, r2], [.rotated, .rotated])
        let refreshCalls = SequencedURLProtocol.capturedRequests.filter {
            $0.url?.path == "/api/users/refresh"
        }
        XCTAssertEqual(refreshCalls.count, 1, "Concurrent refreshes must coalesce into one request")
    }

    // MARK: - DPoP + device binding on /refresh

    /// CONTRACT `/api/users/refresh`: body `{refreshToken, deviceId?, sessionId?}`
    /// + `DPoP` with `rth` = base64url(sha256(refreshToken)), signed by the
    /// stored device key; `X-Device-Id` on the request.
    func testRefreshCarriesDeviceIdSessionIdAndDPoPWithRth() async throws {
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 3000)
        let identity = try DeviceIdentity.loadOrCreate(in: store, allowSecureEnclave: false)
        stub("/api/users/refresh", status: 200, body: Fixtures.refreshJSON(sessionId: "sess-2"))
        let manager = makeManager(store: store)

        let outcome = await manager.refreshIfPossible()

        XCTAssertEqual(outcome, .rotated)
        let refresh = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/refresh").first)
        XCTAssertEqual(refresh.value(forHTTPHeaderField: "X-Device-Id"), identity.deviceId)
        XCTAssertNil(refresh.value(forHTTPHeaderField: "Authorization"), "refresh is not a bearer call")
        let body = try XCTUnwrap(refresh.authTestJSONBody())
        XCTAssertEqual(body["refreshToken"] as? String, "rt-current")
        XCTAssertEqual(body["deviceId"] as? String, identity.deviceId)
        XCTAssertEqual(body["sessionId"] as? String, "sess-1")
        let proof = try XCTUnwrap(refresh.authTestDPoP(), "DPoP header present")
        XCTAssertEqual(proof.typ, "dpop+jwt")
        XCTAssertEqual(proof.alg, "ES256")
        XCTAssertEqual(proof.payload.htm, "POST")
        XCTAssertTrue(proof.payload.htu.hasSuffix("/api/users/refresh"))
        XCTAssertEqual(proof.payload.rth, DPoPProofBuilder.refreshTokenHash("rt-current"))
        XCTAssertEqual(proof.payload.iat, Int(now.timeIntervalSince1970))
        XCTAssertEqual(proof.thumbprint, identity.key.thumbprint)
        XCTAssertTrue(proof.signatureValid)
        // Rotated pair + new session id + expiry are persisted and published.
        XCTAssertEqual(manager.sessionId, "sess-2")
        XCTAssertEqual(store.get(SecureStoreKey.sessionId), "sess-2")
        XCTAssertEqual(manager.expiresAt, Date(timeIntervalSince1970: 1_800_000_000))
        XCTAssertEqual(store.get(SecureStoreKey.expiresAt), "1800000000")
    }

    func testRefreshWithoutDeviceIdentityMintsOneAndStillSendsProof() async throws {
        // A legacy install (tokens, no device key) gets an identity on its
        // first refresh so the server can adopt the session (DPOP_CUTOVER
        // permitting) — the request is well-formed either way.
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 3000)
        stub("/api/users/refresh", status: 200, body: Fixtures.refreshJSON())
        let manager = makeManager(store: store)

        XCTAssertNil(store.get(SecureStoreKey.deviceId))
        let outcome = await manager.refreshIfPossible()

        XCTAssertEqual(outcome, .rotated)
        let deviceId = try XCTUnwrap(store.get(SecureStoreKey.deviceId))
        XCTAssertNotNil(store.getData(SecureStoreKey.deviceKey))
        let refresh = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/refresh").first)
        XCTAssertEqual(refresh.authTestJSONBody()?["deviceId"] as? String, deviceId)
        XCTAssertNotNil(refresh.authTestDPoP())
    }

    // MARK: - 401 codes → SessionEndReason

    func testRefresh401CodeIsPublishedAsSessionEndReasonOnHandleUnauthorized() async throws {
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 3000)
        stub("/api/users/refresh", status: 401, body: "{\"error\":\"Device revoked\",\"code\":\"DEVICE_REVOKED\"}")
        let manager = makeManager(store: store)

        let outcome = await manager.refreshIfPossible()
        XCTAssertEqual(outcome, .authRejected)
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt-current", "refreshIfPossible never wipes")
        await manager.handleUnauthorized()

        XCTAssertEqual(manager.sessionEndReason, .deviceRevoked)
        XCTAssertEqual(manager.sessionEndReason?.isSecurity, true)
        XCTAssertNil(store.get(SecureStoreKey.refreshToken))
        XCTAssertNil(store.get(SecureStoreKey.accessToken))
        XCTAssertNil(store.get(SecureStoreKey.cachedUser))
        if case .signedOut = manager.state { /* pass */ } else {
            XCTFail("Expected .signedOut, got \(manager.state)")
        }
    }

    func testRefresh401WithoutCodeIsPlainExpiry() async throws {
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 3000)
        stub("/api/users/refresh", status: 401, body: "{\"error\":\"Session expired\"}")
        let manager = makeManager(store: store)

        _ = await manager.refreshIfPossible()
        await manager.handleUnauthorized()

        XCTAssertEqual(manager.sessionEndReason, .expired)
        XCTAssertEqual(manager.sessionEndReason?.isSecurity, false)
        XCTAssertEqual(manager.sessionEndReason?.message, "Your session has expired. Please sign in again.")
    }

    // MARK: - Proactive refresh (expiresAt − now < 120 s)

    func testAuthenticatedRequestRefreshesProactivelyWhenTokenIsAboutToExpire() async throws {
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 60)
        stub("/api/users/refresh", status: 200, body: Fixtures.refreshJSON())
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())
        let manager = makeManager(store: store)
        manager.loadSessionMetadata()
        manager.setAccessToken("old-at")

        let response: ProfileResponse = try await manager.apiClient.request(UsersEndpoints.profile())

        XCTAssertEqual(response.user.id, "u_123")
        let paths = SequencedURLProtocol.capturedRequests.compactMap { $0.url?.path }
        XCTAssertEqual(paths, ["/api/users/refresh", "/api/users/profile"], "refresh happens *before* the call, no 401 round-trip")
        let profile = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/profile").first)
        XCTAssertEqual(profile.value(forHTTPHeaderField: "Authorization"), "Bearer new-at")
        XCTAssertFalse(manager.isAccessTokenExpiringSoon, "new expiry is far away")
    }

    func testAuthenticatedRequestDoesNotRefreshWhenTokenIsFresh() async throws {
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 3000)
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())
        let manager = makeManager(store: store)
        manager.loadSessionMetadata()
        manager.setAccessToken("old-at")

        _ = try await manager.apiClient.request(UsersEndpoints.profile(), as: ProfileResponse.self)

        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/users/refresh").isEmpty)
        let profile = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/profile").first)
        XCTAssertEqual(profile.value(forHTTPHeaderField: "Authorization"), "Bearer old-at")
    }

    func testUnauthenticatedRequestNeverTriggersProactiveRefresh() async throws {
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 10)
        stub("/api/users/forgot-password", status: 200, body: "{\"message\":\"ok\"}")
        let manager = makeManager(store: store)
        manager.loadSessionMetadata()
        manager.setAccessToken("old-at")

        try await manager.forgotPassword(email: "alice@example.com")

        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/users/refresh").isEmpty)
    }

    func testProactiveRefreshRejectionEndsSessionBeforeSending() async throws {
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 30)
        stub("/api/users/refresh", status: 401, body: "{\"error\":\"reuse\",\"code\":\"TOKEN_REUSE\"}")
        let manager = makeManager(store: store)
        manager.loadSessionMetadata()
        manager.setAccessToken("old-at")

        do {
            _ = try await manager.apiClient.request(UsersEndpoints.profile(), as: ProfileResponse.self)
            XCTFail("Expected unauthorized")
        } catch let error as APIError {
            guard case .unauthorized = error else { return XCTFail("Expected .unauthorized, got \(error)") }
        }
        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/users/profile").isEmpty, "the doomed request is never sent")
        XCTAssertEqual(manager.sessionEndReason, .tokenReuse)
        if case .signedOut = manager.state { /* pass */ } else {
            XCTFail("Expected .signedOut, got \(manager.state)")
        }
    }

    func testProactiveRefreshTransientFailureStillSendsTheRequest() async throws {
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 30)
        stub("/api/users/refresh", status: 503, body: "{\"error\":\"down\"}")
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())
        let manager = makeManager(store: store)
        manager.loadSessionMetadata()
        manager.setAccessToken("old-at")

        let response: ProfileResponse = try await manager.apiClient.request(UsersEndpoints.profile())

        XCTAssertEqual(response.user.id, "u_123")
        let profile = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/profile").first)
        XCTAssertEqual(profile.value(forHTTPHeaderField: "Authorization"), "Bearer old-at", "still-valid token is used")
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt-current")
    }

    func testRefreshIfExpiringSoonForegroundHook() async throws {
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 90)
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())
        stub("/api/users/refresh", status: 200, body: Fixtures.refreshJSON())
        let manager = makeManager(store: store)
        // Same-install restore refreshes first (90 s < 120 s), then hydrates.
        InstallMarker(directory: markerDirectory).ensure(store: store)
        await manager.restoreSession()
        await manager.awaitBackgroundWork()
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/users/refresh").count, 1)

        // Far from expiry now → the foreground hook is a no-op.
        await manager.refreshIfExpiringSoon()
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/users/refresh").count, 1)

        // Simulate the token ageing to < 120 s and a scene activation.
        manager.setSessionMetadata(id: manager.sessionId, context: manager.sessionContext, expiresAt: now.addingTimeInterval(100))
        stub("/api/users/refresh", status: 200, body: Fixtures.refreshJSON(accessToken: "at-3", refreshToken: "rt-3"))
        await manager.refreshIfExpiringSoon()
        XCTAssertEqual(SequencedURLProtocol.captured(path: "/api/users/refresh").count, 2)
        XCTAssertEqual(manager.accessToken, "at-3")
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt-3")
    }

    func testRefreshIfExpiringSoonIsNoOpWhenSignedOut() async throws {
        let store = InMemorySecureStore()
        try seedSession(store, secondsLeft: 10)
        let manager = makeManager(store: store)
        await manager.refreshIfExpiringSoon()
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    // MARK: - Offline-resilient restore

    func testRestoreKeepsSessionOfflineWithCachedUser() async throws {
        let store = InMemorySecureStore()
        try store.set("at", for: SecureStoreKey.accessToken)
        try store.set(cachedUserJSON(), for: SecureStoreKey.cachedUser)
        // Profile check fails with a transient 500 — must NOT wipe the session.
        stub("/api/users/profile", status: 500, body: "{\"error\":\"boom\"}")
        let manager = makeManager(store: store)

        await manager.restoreSession()

        if case let .signedIn(user) = manager.state {
            XCTAssertEqual(user.id, "u_1")
        } else {
            XCTFail("Expected .signedIn from cache while offline, got \(manager.state)")
        }
        XCTAssertEqual(store.get(SecureStoreKey.accessToken), "at", "Tokens must be preserved offline")
    }

    func testRestoreOfflineWithoutCacheKeepsTokens() async throws {
        let store = InMemorySecureStore()
        try store.set("at", for: SecureStoreKey.accessToken)
        stub("/api/users/profile", status: 500, body: "{\"error\":\"boom\"}")
        let manager = makeManager(store: store)

        await manager.restoreSession()

        if case .signedOut = manager.state { /* pass */ } else {
            XCTFail("Expected .signedOut without cached user, got \(manager.state)")
        }
        // Tokens preserved so a later online launch can restore.
        XCTAssertEqual(store.get(SecureStoreKey.accessToken), "at")
    }

    func testRestoreKeepsSessionOn403() async throws {
        let store = InMemorySecureStore()
        try store.set("at", for: SecureStoreKey.accessToken)
        try store.set(cachedUserJSON(), for: SecureStoreKey.cachedUser)
        // 403 = valid token, forbidden action — must NOT wipe the session.
        stub("/api/users/profile", status: 403, body: "{\"error\":\"forbidden\"}")
        let manager = makeManager(store: store)

        await manager.restoreSession()

        if case let .signedIn(user) = manager.state {
            XCTAssertEqual(user.id, "u_1")
        } else {
            XCTFail("Expected .signedIn on 403, got \(manager.state)")
        }
        XCTAssertEqual(store.get(SecureStoreKey.accessToken), "at")
    }

    func testSignOutClearsCachedUser() async throws {
        let store = InMemorySecureStore()
        try store.set("at", for: SecureStoreKey.accessToken)
        try store.set("{\"id\":\"u_1\",\"email\":\"a@b.com\"}", for: SecureStoreKey.cachedUser)
        stub("/api/users/logout", status: 200, body: "{\"success\":true}")
        let manager = makeManager(store: store)

        await manager.signOut()

        XCTAssertNil(store.get(SecureStoreKey.cachedUser))
        XCTAssertNil(store.get(SecureStoreKey.accessToken))
        if case .signedOut = manager.state { /* pass */ } else {
            XCTFail("Expected .signedOut, got \(manager.state)")
        }
    }
}
