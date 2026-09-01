//
//  AuthManagerRefreshTests.swift
//  PantopusTests
//
//  Silent token refresh + offline-resilient session restore (persistent
//  sign-in). Split out of AuthManagerTests so each file stays within length
//  limits. Same harness: in-memory SecureStore + SequencedURLProtocol-backed
//  APIClient, so nothing hits the real Keychain or network.
//

import XCTest
@testable import Pantopus

@MainActor
final class AuthManagerRefreshTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    // MARK: - Helpers

    private func makeManager(store: any SecureStore = InMemorySecureStore()) -> AuthManager {
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        return AuthManager(store: store, apiClient: client)
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
        let manager = makeManager(store: store)

        await manager.signOut()

        XCTAssertNil(store.get(SecureStoreKey.cachedUser))
        XCTAssertNil(store.get(SecureStoreKey.accessToken))
        if case .signedOut = manager.state { /* pass */ } else {
            XCTFail("Expected .signedOut, got \(manager.state)")
        }
    }
}
