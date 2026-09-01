//
//  ContinueAsViewModelTests.swift
//  PantopusTests
//
//  The "Continue as X" card's view-model over a real `AuthManager` in the
//  reinstall (`.resumable`) state — same harness as AuthManagerResumeTests
//  (InMemorySecureStore, temp-dir InstallMarker, scripted PresenceGate,
//  software device keys, SequencedURLProtocol).
//

import XCTest
@testable import Pantopus

@MainActor
final class ContinueAsViewModelTests: XCTestCase {
    private var directory: URL!
    private var store: InMemorySecureStore!
    private let now = Date(timeIntervalSince1970: 1_755_500_000)

    override func setUpWithError() throws {
        try super.setUpWithError()
        SequencedURLProtocol.reset()
        DeepLinkRouter.shared.clearPending()
        store = InMemorySecureStore()
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("continue-as-tests-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDownWithError() throws {
        SequencedURLProtocol.reset()
        DeepLinkRouter.shared.clearPending()
        try? FileManager.default.removeItem(at: directory)
        try super.tearDownWithError()
    }

    // MARK: - Helpers

    private func makeManager(presence: PresenceOutcome = .verified) -> (AuthManager, FakePresenceGate) {
        let client = APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
        let gate = FakePresenceGate(presence)
        let instant = now
        let tick: @Sendable () -> Date = { instant }
        let manager = AuthManager(
            store: store,
            apiClient: client,
            installMarker: InstallMarker(directory: directory),
            presenceGate: gate,
            allowSecureEnclave: false,
            now: tick
        )
        return (manager, gate)
    }

    /// A reinstalled device: tokens + hint + device identity, no install
    /// marker → `restoreSession()` lands on `.resumable`.
    private func seedReinstall() throws -> AccountHint {
        try store.set("at", for: SecureStoreKey.accessToken)
        try store.set("rt", for: SecureStoreKey.refreshToken)
        try store.set("u_123", for: SecureStoreKey.userId)
        try store.set("sess-1", for: SecureStoreKey.sessionId)
        let cached = UserDTO(id: "u_123", email: "alice@example.com", displayName: "Alice Doe", avatarURL: nil)
        try store.set(String(data: JSONEncoder().encode(cached), encoding: .utf8) ?? "", for: SecureStoreKey.cachedUser)
        let hint = AccountHint(user: cached, lastMethod: .password, lastSeenAt: now.addingTimeInterval(-3600))
        AccountHintStore.remember(hint, in: store)
        _ = try DeviceIdentity.loadOrCreate(in: store, allowSecureEnclave: false)
        return hint
    }

    /// A manager parked in `.resumable` plus its gate and a bound card
    /// view-model — a struct rather than a tuple (SwiftLint `large_tuple`).
    private struct Harness {
        let manager: AuthManager
        let gate: FakePresenceGate
        let viewModel: ContinueAsViewModel
    }

    private func makeResumable(presence: PresenceOutcome = .verified) async throws -> Harness {
        let hint = try seedReinstall()
        let (manager, gate) = makeManager(presence: presence)
        await manager.restoreSession()
        guard case .resumable = manager.state else {
            throw XCTSkip("Expected .resumable, got \(manager.state)")
        }
        let viewModel = ContinueAsViewModel(hint: hint, sessionEndReason: manager.sessionEndReason)
        return Harness(manager: manager, gate: gate, viewModel: viewModel)
    }

    private func stub(_ path: String, status: Int, body: String) {
        SequencedURLProtocol.routeResponses[path] = [.status(status, body: body)]
    }

    // MARK: - Presentation

    func testHeadlineUsesFirstNameAndSubtitleIsMaskedEmail() {
        let hint = AccountHint(
            userId: "u_1",
            displayName: "Ying Wang",
            avatarUrl: nil,
            maskedEmail: "y•••@gmail.com",
            lastMethod: .apple,
            lastSeenAt: now
        )
        let vm = ContinueAsViewModel(hint: hint)
        XCTAssertEqual(vm.headline, "Continue as Ying")
        XCTAssertEqual(vm.subtitle, "y•••@gmail.com")
        XCTAssertEqual(vm.initials, "YW")
        XCTAssertNil(vm.securityMessage)
        XCTAssertEqual(vm.phase, .idle)
    }

    func testHeadlineFallsBackToMaskedEmailThenNeutral() {
        let emailOnly = ContinueAsViewModel(
            hint: AccountHint(userId: "u_1", displayName: nil, avatarUrl: nil, maskedEmail: "a•••@x.io", lastMethod: nil, lastSeenAt: now)
        )
        XCTAssertEqual(emailOnly.headline, "Continue as a•••@x.io")
        XCTAssertNil(emailOnly.subtitle, "no duplicate email line")
        XCTAssertEqual(emailOnly.initials, "A")

        let bare = ContinueAsViewModel(
            hint: AccountHint(userId: "u_1", displayName: nil, avatarUrl: nil, maskedEmail: nil, lastMethod: nil, lastSeenAt: now)
        )
        XCTAssertEqual(bare.headline, "Continue signed in")
        XCTAssertEqual(bare.initials, "?")
    }

    func testSecurityMessageComesFromSessionEndReason() {
        let hint = AccountHint(userId: "u_1", displayName: "A", avatarUrl: nil, maskedEmail: nil, lastMethod: nil, lastSeenAt: now)
        XCTAssertEqual(
            ContinueAsViewModel(hint: hint, sessionEndReason: .tokenReuse).securityMessage,
            "You were signed out for security. Sign in again."
        )
        XCTAssertEqual(
            ContinueAsViewModel(hint: hint, sessionEndReason: .expired).securityMessage,
            "Your session has expired. Please sign in again."
        )
    }

    /// Parity with Android `ContinueAsTags.SECURITY_BANNER_DISMISS`: the
    /// banner is dismissable and stays dismissed for this card instance.
    func testSecurityMessageIsDismissable() {
        let hint = AccountHint(userId: "u_1", displayName: "A", avatarUrl: nil, maskedEmail: nil, lastMethod: nil, lastSeenAt: now)
        let viewModel = ContinueAsViewModel(hint: hint, sessionEndReason: .deviceRevoked)
        XCTAssertNotNil(viewModel.securityMessage)

        viewModel.dismissSecurityMessage()

        XCTAssertNil(viewModel.securityMessage)
    }

    // MARK: - Continue

    func testContinueVerifiedResumesTheSession() async throws {
        let harness = try await makeResumable()
        let (manager, gate, vm) = (harness.manager, harness.gate, harness.viewModel)
        stub("/api/users/refresh", status: 200, body: Fixtures.refreshJSON())
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())

        let outcome = await vm.continueSignedIn(using: manager)
        await manager.awaitBackgroundWork()

        XCTAssertEqual(outcome, .signedIn)
        XCTAssertEqual(gate.calls, 1)
        XCTAssertEqual(gate.lastReason, "Continue signed in to Pantopus")
        if case let .signedIn(user) = manager.state {
            XCTAssertEqual(user.id, "u_123")
        } else {
            XCTFail("Expected .signedIn, got \(manager.state)")
        }
        XCTAssertEqual(vm.phase, .idle)
        XCTAssertNil(vm.errorMessage)
        XCTAssertFalse(DeepLinkRouter.shared.prefersLoginPresentation)
        let refresh = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/refresh").first)
        XCTAssertNotNil(refresh.authTestDPoP(), "resume refresh carries a DPoP proof")
    }

    func testContinueCancelledLeavesCardUpWithoutError() async throws {
        let harness = try await makeResumable(presence: .cancelled)
        let (manager, vm) = (harness.manager, harness.viewModel)

        let outcome = await vm.continueSignedIn(using: manager)

        XCTAssertEqual(outcome, .cancelled)
        XCTAssertNil(vm.errorMessage)
        guard case .resumable = manager.state else { return XCTFail("Still resumable after a cancel") }
        XCTAssertTrue(SequencedURLProtocol.captured(path: "/api/users/refresh").isEmpty, "no refresh without presence")
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt", "never a wipe")
    }

    func testContinueRejectedBySecurityCodeRoutesToLoginWithSecurityMessage() async throws {
        let harness = try await makeResumable()
        let (manager, vm) = (harness.manager, harness.viewModel)
        stub("/api/users/refresh", status: 401, body: "{\"error\":\"Device revoked\",\"code\":\"DEVICE_REVOKED\"}")

        let outcome = await vm.continueSignedIn(using: manager)

        XCTAssertEqual(outcome, .rejected(.deviceRevoked))
        XCTAssertEqual(vm.securityMessage, "You were signed out for security. Sign in again.")
        XCTAssertNil(vm.errorMessage)
        guard case .signedOut = manager.state else { return XCTFail("Expected .signedOut, got \(manager.state)") }
        XCTAssertNil(store.get(SecureStoreKey.refreshToken), "tokens wiped")
        XCTAssertEqual(manager.rememberedAccounts.first?.userId, "u_123", "hint kept")
        XCTAssertTrue(DeepLinkRouter.shared.prefersLoginPresentation, "land on the login form, not the Place funnel")
    }

    func testContinueTransientFailureShowsInlineErrorAndKeepsTokens() async throws {
        let harness = try await makeResumable()
        let (manager, vm) = (harness.manager, harness.viewModel)
        stub("/api/users/refresh", status: 503, body: "{\"error\":\"down\"}")

        let outcome = await vm.continueSignedIn(using: manager)

        XCTAssertEqual(outcome, .transient)
        XCTAssertEqual(vm.errorMessage, "Can't reach Pantopus right now. Check your connection and try again.")
        guard case .resumable = manager.state else { return XCTFail("Still resumable") }
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt")

        vm.clearError()
        XCTAssertNil(vm.errorMessage)
    }

    func testContinueWithoutOsLockFallsToLogin() async throws {
        // The OS lock disappeared between launch and the tap.
        let harness = try await makeResumable()
        let (manager, gate, vm) = (harness.manager, harness.gate, harness.viewModel)
        gate.outcome = .unavailable

        let outcome = await vm.continueSignedIn(using: manager)

        XCTAssertEqual(outcome, .noOsLock)
        guard case .signedOut = manager.state else { return XCTFail("Expected .signedOut") }
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt", "tokens kept for a later launch")
        XCTAssertTrue(DeepLinkRouter.shared.prefersLoginPresentation)
    }

    // MARK: - Secondary actions

    func testUseDifferentAccountKeepsTokensAndRequestsLogin() async throws {
        let harness = try await makeResumable()
        let (manager, vm) = (harness.manager, harness.viewModel)

        vm.useDifferentAccount()

        XCTAssertTrue(vm.wantsDifferentAccount)
        XCTAssertTrue(DeepLinkRouter.shared.prefersLoginPresentation)
        guard case .resumable = manager.state else { return XCTFail("State untouched until the new login") }
        XCTAssertEqual(store.get(SecureStoreKey.refreshToken), "rt")
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testRemoveAccountRevokesWithProofAndForgetsTheHint() async throws {
        let harness = try await makeResumable()
        let (manager, vm) = (harness.manager, harness.viewModel)
        stub("/api/users/logout", status: 200, body: "{\"success\":true}")

        await vm.removeAccount(using: manager)
        await manager.awaitBackgroundWork()

        guard case .signedOut = manager.state else { return XCTFail("Expected .signedOut, got \(manager.state)") }
        XCTAssertTrue(manager.rememberedAccounts.isEmpty, "hint wiped")
        XCTAssertNil(store.get(SecureStoreKey.refreshToken))
        XCTAssertNil(store.get(SecureStoreKey.accessToken))
        let logout = try XCTUnwrap(SequencedURLProtocol.captured(path: "/api/users/logout").first)
        let body = logout.authTestJSONBody()
        XCTAssertEqual(body?["scope"] as? String, "local")
        XCTAssertEqual(body?["refreshToken"] as? String, "rt")
        XCTAssertNotNil(logout.authTestDPoP()?.payload.rth, "proof carries rth")
        XCTAssertTrue(DeepLinkRouter.shared.prefersLoginPresentation)
        XCTAssertEqual(vm.phase, .idle)
    }

    func testActionsAreIgnoredWhileBusy() async throws {
        let harness = try await makeResumable()
        let (manager, vm) = (harness.manager, harness.viewModel)
        // A slow refresh keeps the card in `.resuming`.
        SequencedURLProtocol.routeResponses["/api/users/refresh"] = [
            .status(200, body: Fixtures.refreshJSON(), delay: 0.3)
        ]
        stub("/api/users/profile", status: 200, body: Fixtures.profileJSON())

        let first = Task { await vm.continueSignedIn(using: manager) }
        try await Task.sleep(for: .milliseconds(50))
        XCTAssertEqual(vm.phase, .resuming)
        XCTAssertTrue(vm.isBusy)
        vm.useDifferentAccount()
        XCTAssertFalse(vm.wantsDifferentAccount, "secondary actions are inert while resuming")
        let second = await vm.continueSignedIn(using: manager)
        XCTAssertEqual(second, .cancelled, "re-entrant tap is a no-op")
        _ = await first.value
        await manager.awaitBackgroundWork()
        XCTAssertEqual(vm.phase, .idle)
    }
}
