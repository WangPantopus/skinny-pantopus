//
//  AuthManagerResumeTests.swift
//  PantopusTests
//
//  Cold-start decision tree (L1 → L2 → L3), the "Continue as" resume, and
//  the sign-out / remove paths of persistent login (design §3, §7.2, §7.3,
//  §7.6; CONTRACT "Client behaviour"). Same harness as the other
//  AuthManager tests: `InMemorySecureStore` + `SequencedURLProtocol`, a
//  temp-dir `InstallMarker`, a scripted `PresenceGate`, software device
//  keys, an injectable clock.
//

// swiftlint:disable type_body_length

import XCTest
@testable import Pantopus

@MainActor
final class AuthManagerResumeTests: XCTestCase {
    private var directory: URL!
    private var store: InMemorySecureStore!
    private let now = Date(timeIntervalSince1970: 1_755_500_000)

    override func setUpWithError() throws {
        try super.setUpWithError()
        SequencedURLProtocol.reset()
        store = InMemorySecureStore()
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("resume-tests-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDownWithError() throws {
        SequencedURLProtocol.reset()
        try? FileManager.default.removeItem(at: directory)
        try super.tearDownWithError()
    }

    // MARK: - Helpers

    private var marker: InstallMarker {
        InstallMarker(directory: directory)
    }

    private func makeManager(presence: PresenceOutcome = .verified, now clock: Date? = nil) -> (AuthManager, FakePresenceGate) {
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        let gate = FakePresenceGate(presence)
        let instant = clock ?? now
        let tick: @Sendable () -> Date = { instant }
        let manager = AuthManager(
            store: store,
            apiClient: client,
            installMarker: marker,
            presenceGate: gate,
            allowSecureEnclave: false,
            now: tick
        )
        return (manager, gate)
    }

    private func stub(_ path: String, status: Int, body: String) {
        SequencedURLProtocol.routeResponses[path] = [.status(status, body: body)]
    }

    /// A previously signed-in account: tokens, session metadata, cached
    /// user, hint and a device identity. `sameInstall` also writes the
    /// install marker (file + Keychain mirror).
    @discardableResult
    private func seedSession(
        sameInstall: Bool,
        accessToken: String? = "at",
        hintSeenAt: Date? = nil,
        expiresAt: Date? = nil
    ) throws -> DeviceIdentity {
        if let accessToken {
            try store.set(accessToken, for: SecureStoreKey.accessToken)
        }
        try store.set("rt", for: SecureStoreKey.refreshToken)
        try store.set("u_123", for: SecureStoreKey.userId)
        try store.set("sess-1", for: SecureStoreKey.sessionId)
        try store.set("interactive", for: SecureStoreKey.sessionContext)
        let expiry = expiresAt ?? now.addingTimeInterval(3000)
        try store.set(String(Int(expiry.timeIntervalSince1970)), for: SecureStoreKey.expiresAt)
        let cached = UserDTO(id: "u_123", email: "alice@example.com", displayName: "Alice", avatarURL: nil)
        try store.set(String(data: JSONEncoder().encode(cached), encoding: .utf8) ?? "", for: SecureStoreKey.cachedUser)
        AccountHintStore.remember(
            AccountHint(user: cached, lastMethod: .password, lastSeenAt: hintSeenAt ?? now.addingTimeInterval(-3600)),
            in: store
        )
        let identity = try DeviceIdentity.loadOrCreate(in: store, allowSecureEnclave: false)
        if sameInstall {
            marker.ensure(store: store)
        }
        return identity
    }

    private func assertSignedIn(_ manager: AuthManager, file: StaticString = #filePath, line: UInt = #line) {
        if case let .signedIn(user) = manager.state {
            XCTAssertEqual(user.id, "u_123", file: file, line: line)
        } else {
            XCTFail("Expected .signedIn, got \(manager.state)", file: file, line: line)
        }
    }

    private func assertResumable(_ manager: AuthManager, file: StaticString = #filePath, line: UInt = #line) {
        if case let .resumable(hint) = manager.state {
            XCTAssertEqual(hint.userId, "u_123", file: file, line: line)
            XCTAssertEqual(hint.displayName, "Alice", file: file, line: line)
            XCTAssertEqual(hint.maskedEmail, "a•••@example.com", file: file, line: line)
        } else {
            XCTFail("Expected .resumable, got \(manager.state)", file: file, line: line)
        }
    }

    // MARK: - Cold start

    func testReinstallEntersResumableAndKeepsTokens() async throws {
        try seedSession(sameInstall: false)
        let (manager, gate) = makeManager()

        await manager.restoreSession()

        assertResumable(manager)
        XCTAssertNil(manager.accessToken, "no bearer is published before presence")
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt", "never a wipe")
        XCTAssertEqual(store.get(SecureStoreKey.accessToken), "at")
        XCTAssertEqual(gate.calls, 0, "restore never prompts by itself")
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty, "nothing is sent before the gesture")
    }

    func testSameInstallRestoresSilently() async throws {
        try seedSession(sameInstall: true)
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())
        let (manager, gate) = makeManager()

        await manager.restoreSession()
        await manager.awaitBackgroundWork()

        assertSignedIn(manager)
        XCTAssertEqual(gate.calls, 0)
        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/users/refresh").isEmpty, "token is far from expiry")
        let profile = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/profile").first)
        XCTAssertEqual(profile.value(forHTTPHeaderField: "Authorization"), "Bearer at")
        XCTAssertEqual(profile.value(forHTTPHeaderField: "X-Device-Id"), store.get(SecureStoreKey.deviceId))
        XCTAssertEqual(manager.sessionId, "sess-1")
        XCTAssertEqual(manager.sessionContext, .interactive)
    }

    func testSameInstallWithOnlyRefreshTokenRefreshesFirst() async throws {
        try seedSession(sameInstall: true, accessToken: nil)
        stub("/api/users/refresh", status: 200, body: Fixtures.refreshJSON())
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())
        let (manager, _) = makeManager()

        await manager.restoreSession()
        await manager.awaitBackgroundWork()

        assertSignedIn(manager)
        let paths = SequencedURLProtocol.capturedRequests.compactMap { $0.url?.path }.filter { $0 != "/api/auth/devices/register" }
        XCTAssertEqual(paths, ["/api/users/refresh", "/api/users/profile"])
        XCTAssertEqual(manager.accessToken, "new-at")
    }

    func testAccessTokenNearExpiryIsRefreshedBeforeProfile() async throws {
        try seedSession(sameInstall: true, expiresAt: now.addingTimeInterval(60))
        stub("/api/users/refresh", status: 200, body: Fixtures.refreshJSON())
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())
        let (manager, _) = makeManager()

        await manager.restoreSession()
        await manager.awaitBackgroundWork()

        assertSignedIn(manager)
        let profile = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/profile").first)
        XCTAssertEqual(profile.value(forHTTPHeaderField: "Authorization"), "Bearer new-at")
        XCTAssertEqual(manager.expiresAt, Date(timeIntervalSince1970: 1_800_000_000))
    }

    func testDormantSessionIsResumableEvenOnTheSameInstall() async throws {
        try seedSession(sameInstall: true, hintSeenAt: now.addingTimeInterval(-31 * 24 * 3600))
        let (manager, _) = makeManager()

        await manager.restoreSession()

        assertResumable(manager)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testNoTokensIsSignedOutWithHintKept() async {
        AccountHintStore.remember(
            AccountHint(userId: "u_9", displayName: "Old", avatarUrl: nil, maskedEmail: nil, lastMethod: .apple, lastSeenAt: now),
            in: store
        )
        let (manager, _) = makeManager()

        await manager.restoreSession()

        if case .signedOut = manager.state {} else {
            XCTFail("Expected .signedOut, got \(manager.state)")
        }
        XCTAssertEqual(manager.rememberedAccounts.map(\.userId), ["u_9"], "L3 hint survives for the login screen")
    }

    // MARK: - Resume (L2)

    func testResumeVerifiedRefreshesWithDPoPAndSignsIn() async throws {
        let identity = try seedSession(sameInstall: false)
        stub("/api/users/refresh", status: 200, body: Fixtures.refreshJSON())
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())
        let (manager, gate) = makeManager()
        await manager.restoreSession()
        assertResumable(manager)

        let outcome = await manager.resume()
        await manager.awaitBackgroundWork()

        XCTAssertEqual(outcome, .signedIn)
        assertSignedIn(manager)
        XCTAssertEqual(gate.calls, 1)

        // `POST /refresh {refreshToken, deviceId, sessionId}` + DPoP(rth).
        let refresh = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/refresh").first)
        let body = try XCTUnwrap(refresh.authTestJSONBody())
        XCTAssertEqual(body["refreshToken"] as? String, "rt")
        XCTAssertEqual(body["deviceId"] as? String, identity.deviceId)
        XCTAssertEqual(body["sessionId"] as? String, "sess-1")
        XCTAssertEqual(refresh.value(forHTTPHeaderField: "X-Device-Id"), identity.deviceId)
        let proof = try XCTUnwrap(refresh.authTestDPoP(), "refresh must carry a DPoP proof")
        XCTAssertEqual(proof.typ, "dpop+jwt")
        XCTAssertEqual(proof.alg, "ES256")
        XCTAssertEqual(proof.thumbprint, identity.key.thumbprint, "proof is signed by the stored device key")
        XCTAssertTrue(proof.signatureValid)
        XCTAssertEqual(proof.payload.htm, "POST")
        XCTAssertTrue(proof.payload.htu.hasSuffix("/api/users/refresh"))
        XCTAssertFalse(proof.payload.htu.contains("?"))
        XCTAssertEqual(proof.payload.rth, DPoPProofBuilder.refreshTokenHash("rt"))
        XCTAssertEqual(proof.payload.iat, Int(now.timeIntervalSince1970))

        // Rotated pair persisted, marker re-written for this install.
        XCTAssertEqual(store.get(SecureStoreKey.accessToken), "new-at")
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "new-rt")
        XCTAssertEqual(marker.verdict(store: store), .sameInstall)
        XCTAssertNotNil(marker.readFileInstallId())
        XCTAssertNil(manager.sessionEndReason)
        XCTAssertNil(manager.lastInteractiveSignInAt, "a resume is not an interactive sign-in")

        // Registration follows with the same device id.
        let register = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/auth/devices/register").first)
        let device = try XCTUnwrap(register.authTestJSONBody()?["device"] as? [String: Any])
        XCTAssertEqual(device["deviceId"] as? String, identity.deviceId)
        XCTAssertEqual(device["installId"] as? String, marker.readFileInstallId())
        XCTAssertEqual(device["platform"] as? String, "ios")
        XCTAssertEqual(device["keyBacking"] as? String, "software")
        XCTAssertTrue(device.keys.contains("attestation"))
        XCTAssertNotNil(register.authTestDPoP(), "register carries a DPoP proof")
        XCTAssertEqual(register.value(forHTTPHeaderField: "Authorization"), "Bearer new-at")
    }

    func testResumeRejectedWithSecurityCodeWipesTokensKeepsHint() async throws {
        try seedSession(sameInstall: false)
        stub("/api/users/refresh", status: 401, body: "{\"error\":\"Session invalidated\",\"code\":\"TOKEN_REUSE\"}")
        let (manager, _) = makeManager()
        await manager.restoreSession()

        let outcome = await manager.resume()

        XCTAssertEqual(outcome, .rejected(.tokenReuse))
        if case .signedOut = manager.state {} else {
            XCTFail("Expected .signedOut, got \(manager.state)")
        }
        XCTAssertEqual(manager.sessionEndReason, .tokenReuse)
        XCTAssertTrue(manager.sessionEndReason?.isSecurity ?? false)
        XCTAssertEqual(manager.sessionEndReason?.message, "You were signed out for security. Sign in again.")
        XCTAssertNil(store.get(SecureStoreKey.accessToken))
        XCTAssertNil(store.get(SecureStoreKey.refreshToken))
        XCTAssertNil(store.get(SecureStoreKey.sessionId))
        XCTAssertNil(store.get(SecureStoreKey.cachedUser))
        XCTAssertEqual(manager.rememberedAccounts.map(\.userId), ["u_123"], "display hint survives a security sign-out")
        XCTAssertNotNil(store.getData(SecureStoreKey.deviceKey), "the device identity is per device, not per session")
    }

    func testResumeRejectedCodesMapToReasons() async throws {
        for (code, reason) in [
            ("DEVICE_MISMATCH", SessionEndReason.deviceMismatch),
            ("DEVICE_REVOKED", .deviceRevoked),
            ("SESSION_REVOKED", .sessionRevoked),
            ("SESSION_EXPIRED_INACTIVE", .sessionExpiredInactive),
            ("DPOP_REQUIRED", .dpopRequired),
            ("SOMETHING_NEW", .expired)
        ] {
            SequencedURLProtocol.reset()
            store = InMemorySecureStore()
            try seedSession(sameInstall: false)
            stub("/api/users/refresh", status: 401, body: "{\"error\":\"nope\",\"code\":\"\(code)\"}")
            let (manager, _) = makeManager()
            await manager.restoreSession()

            let outcome = await manager.resume()

            XCTAssertEqual(outcome, .rejected(reason), code)
            XCTAssertEqual(manager.sessionEndReason, reason, code)
        }
    }

    func testReinstallWithoutOsLockGoesStraightToLoginKeepingEverything() async throws {
        // No passcode / biometrics ⇒ no one-tap resume: the cold start
        // skips the Continue-as card and lands on L3 (design §2.2).
        try seedSession(sameInstall: false)
        let (manager, gate) = makeManager(presence: .unavailable)

        await manager.restoreSession()

        if case .signedOut = manager.state {} else {
            XCTFail("Expected .signedOut (L3), got \(manager.state)")
        }
        XCTAssertEqual(gate.calls, 0)
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt", "tokens stay for a later launch with a passcode")
        XCTAssertEqual(manager.rememberedAccounts.map(\.userId), ["u_123"])
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testResumeWhenOsLockDisappearsFallsBackToLoginKeepingEverything() async throws {
        // Passcode removed between launch and the tap: the prompt reports
        // `.unavailable` and the card degrades to L3 without wiping.
        try seedSession(sameInstall: false)
        let (manager, gate) = makeManager(presence: .verified)
        await manager.restoreSession()
        assertResumable(manager)
        gate.outcome = .unavailable

        let outcome = await manager.resume()

        XCTAssertEqual(outcome, .noOsLock)
        if case .signedOut = manager.state {} else {
            XCTFail("Expected .signedOut (L3), got \(manager.state)")
        }
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt", "tokens stay for a later launch with a passcode")
        XCTAssertEqual(manager.rememberedAccounts.map(\.userId), ["u_123"])
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testResumeProfileRejectionAfterGoodRefreshReportsTheReason() async throws {
        try seedSession(sameInstall: false)
        SequencedURLProtocol.routeResponses["/api/users/refresh"] = [
            .status(200, body: Fixtures.refreshJSON()),
            .status(401, body: "{\"error\":\"revoked\",\"code\":\"SESSION_REVOKED\"}")
        ]
        stub("/api/users/profile", status: 401, body: "{\"error\":\"Unauthorized\",\"code\":\"SESSION_REVOKED\"}")
        let (manager, _) = makeManager()
        await manager.restoreSession()

        let outcome = await manager.resume()

        XCTAssertEqual(outcome, .rejected(.sessionRevoked))
        XCTAssertEqual(manager.sessionEndReason, .sessionRevoked)
        XCTAssertNil(store.get(SecureStoreKey.refreshToken))
        XCTAssertEqual(manager.rememberedAccounts.map(\.userId), ["u_123"])
    }

    func testResumeCancelledStaysResumable() async throws {
        try seedSession(sameInstall: false)
        let (manager, _) = makeManager(presence: .cancelled)
        await manager.restoreSession()

        let outcome = await manager.resume()

        XCTAssertEqual(outcome, .cancelled)
        assertResumable(manager)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testResumeTransientFailureStaysResumable() async throws {
        try seedSession(sameInstall: false)
        stub("/api/users/refresh", status: 503, body: "{\"error\":\"down\"}")
        let (manager, _) = makeManager()
        await manager.restoreSession()

        let outcome = await manager.resume()

        XCTAssertEqual(outcome, .transient)
        assertResumable(manager)
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt")
    }

    func testResumeWhenNotResumableIsRefused() async {
        let (manager, gate) = makeManager()
        let outcome = await manager.resume()
        XCTAssertEqual(outcome, .failed("Nothing to resume."))
        XCTAssertEqual(gate.calls, 0)
    }

    // MARK: - Sign out / remove

    func testLocalSignOutCallsLogoutWithProofAndKeepsHint() async throws {
        let identity = try seedSession(sameInstall: true)
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())
        stub("/api/users/logout", status: 200, body: "{\"success\":true}")
        let (manager, _) = makeManager()
        await manager.restoreSession()
        await manager.awaitBackgroundWork()
        assertSignedIn(manager)

        await manager.signOut()

        if case .signedOut = manager.state {} else {
            XCTFail("Expected .signedOut, got \(manager.state)")
        }
        XCTAssertNil(manager.accessToken)
        XCTAssertNil(store.get(SecureStoreKey.accessToken))
        XCTAssertNil(store.get(SecureStoreKey.refreshToken))
        XCTAssertNil(store.get(SecureStoreKey.expiresAt))
        XCTAssertNil(store.get(SecureStoreKey.sessionId))
        XCTAssertNil(manager.sessionEndReason, "user-initiated sign-out has no security reason")
        XCTAssertEqual(manager.rememberedAccounts.map(\.userId), ["u_123"], "hint kept for Continue as X")
        XCTAssertNotNil(store.getData(SecureStoreKey.deviceKey))

        let logout = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/logout").first)
        let body = try XCTUnwrap(logout.authTestJSONBody())
        XCTAssertEqual(body["scope"] as? String, "local")
        XCTAssertEqual(body["refreshToken"] as? String, "rt")
        XCTAssertEqual(body["deviceId"] as? String, identity.deviceId)
        XCTAssertEqual(logout.value(forHTTPHeaderField: "Authorization"), "Bearer at")
        let proof = try XCTUnwrap(logout.authTestDPoP(), "logout carries a DPoP proof with rth")
        XCTAssertEqual(proof.payload.rth, DPoPProofBuilder.refreshTokenHash("rt"))
        XCTAssertTrue(proof.payload.htu.hasSuffix("/api/users/logout"))
        XCTAssertEqual(proof.thumbprint, identity.key.thumbprint)
    }

    func testRemoveRememberedAccountRevokesAndWipesHint() async throws {
        try seedSession(sameInstall: false)
        stub("/api/users/logout", status: 200, body: "{\"success\":true}")
        let (manager, _) = makeManager()
        await manager.restoreSession()
        assertResumable(manager)

        await manager.removeRememberedAccount()

        if case .signedOut = manager.state {} else {
            XCTFail("Expected .signedOut, got \(manager.state)")
        }
        XCTAssertTrue(manager.rememberedAccounts.isEmpty)
        XCTAssertNil(store.get(SecureStoreKey.accountHints))
        XCTAssertNil(store.get(SecureStoreKey.refreshToken))
        XCTAssertNil(store.get(SecureStoreKey.cachedUser))
        let logout = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/logout").first)
        XCTAssertEqual(logout.authTestJSONBody()?["refreshToken"] as? String, "rt", "stored tokens are revoked with proof")
        XCTAssertNotNil(logout.authTestDPoP())
    }

    func testRemoveRememberedAccountForAnotherUserKeepsTheCurrentSession() async throws {
        try seedSession(sameInstall: true)
        AccountHintStore.remember(
            AccountHint(userId: "u_other", displayName: "Bob", avatarUrl: nil, maskedEmail: nil, lastMethod: .password, lastSeenAt: now),
            in: store
        )
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())
        let (manager, _) = makeManager()
        await manager.restoreSession()
        await manager.awaitBackgroundWork()

        await manager.removeRememberedAccount(userId: "u_other")

        assertSignedIn(manager)
        XCTAssertEqual(manager.rememberedAccounts.map(\.userId), ["u_123"])
        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/users/logout").isEmpty)
    }

    func testFreshLoginSupersedesResumableSessionAndRevokesOldOne() async throws {
        try seedSession(sameInstall: false)
        stub("/api/users/login", status: 200, body: Fixtures.loginJSON(accessToken: "at-2", refreshToken: "rt-2"))
        stub("/api/users/logout", status: 200, body: "{\"success\":true}")
        let (manager, _) = makeManager()
        await manager.restoreSession()
        assertResumable(manager)

        try await manager.signIn(email: "alice@example.com", password: "pw")
        await manager.awaitBackgroundWork()

        assertSignedIn(manager)
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt-2")
        XCTAssertNotNil(manager.lastInteractiveSignInAt)
        XCTAssertEqual(marker.verdict(store: store), .sameInstall, "marker committed after the interactive login")
        let login = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/login").first)
        XCTAssertNotNil(login.authTestJSONBody()?["device"], "login carries the device descriptor")
        XCTAssertNotNil(login.authTestDPoP(), "login carries a DPoP proof")
        let logout = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/logout").first)
        XCTAssertEqual(logout.authTestJSONBody()?["refreshToken"] as? String, "rt", "the superseded session is revoked with proof")
    }
}
