//
//  AuthManager.swift
//  Pantopus
//
//  Holds auth state, persists tokens to the Keychain, and coordinates
//  login / logout / session restore. The persistent-login pieces (device
//  identity + DPoP, reinstall gate, "Continue as", logout scopes, step-up)
//  live in `AuthManager+Session.swift` and `AuthManager+Devices.swift`;
//  design: docs/persistent-login/persistent-login-design-2026-08-18.md §8,
//  wire contract: docs/persistent-login/CONTRACT.md.
//

// swiftlint:disable file_length

import CryptoKit
import Foundation
import Logging

/// Account type chosen at registration. Maps to the backend's
/// `account_type` column. Persisted as `"individual"` (personal) or
/// `"business"` per `registerSchema` at `backend/routes/users.js:803`.
public enum AccountType: String, Sendable, Hashable, CaseIterable {
    case personal
    case business

    /// Value sent to the backend. Personal maps to `"individual"` because
    /// the DB column predates the design's "personal" wording.
    public var backendValue: String {
        switch self {
        case .personal: "individual"
        case .business: "business"
        }
    }
}

public enum OAuthProvider: String, Sendable, Hashable, CaseIterable {
    case google
    case apple
}

/// Typed error surface for the auth flows. Mapping rules:
///
/// - `invalidCredentials` — login 401 (wrong email/password).
/// - `emailAlreadyExists` — register 400 whose error message references
///   "Email already registered" or "already registered".
/// - `weakPassword` — register 400 whose error message references the
///   password length policy (`PASSWORD_MIN_LENGTH`, default 8).
/// - `networkError` — transport-level failure: offline, timeout, DNS.
/// - `rateLimited` — 429 from any auth endpoint (loginLimiter,
///   registerLimiter, forgotPasswordLimiter, etc).
/// - `serverError(String)` — 5xx or otherwise unrecoverable server reply;
///   carries the backend's `error` field for diagnostics.
/// - `unknown` — any other failure (decoding, invalid response, 4xx that
///   doesn't fit the above).
public enum AuthError: Error, LocalizedError, Hashable, Sendable {
    case invalidCredentials
    case emailAlreadyExists
    case weakPassword
    case networkError
    case rateLimited
    case serverError(String)
    case unknown

    public var errorDescription: String? {
        switch self {
        case .invalidCredentials: "Invalid email or password."
        case .emailAlreadyExists: "An account with this email already exists."
        case .weakPassword: "Choose a stronger password."
        case .networkError: "Can't reach Pantopus. Check your connection."
        case .rateLimited: "Too many attempts. Try again in a moment."
        case let .serverError(message): message
        case .unknown: "Something went wrong. Please try again."
        }
    }
}

/// Result of a successful `signUp` call. Carries the created user plus a
/// flag the UI uses to decide whether to show the verify-email banner
/// (per the Q4 soft-gate decision).
public struct SignUpResult: Sendable, Hashable {
    public let user: AuthenticatedUser
    public let requiresEmailVerification: Bool
}

/// `AuthSession.context` — a `restored` session (minted from a resume grant,
/// Android) cannot use the device-key step-up path or move money until a
/// real credential is presented once. iOS sessions are `interactive`; the
/// value is still tracked because the server may downgrade it.
public enum SessionContext: String, Sendable, Hashable {
    case interactive
    case restored
}

@Observable
@MainActor
final class AuthManager {
    enum State: Equatable {
        case unknown
        case signedOut
        /// Tokens survived a reinstall (or the account went dormant): the
        /// user must confirm presence (Face ID / passcode) before the
        /// session is resumed. Carries the display hint for the card.
        case resumable(AccountHint)
        case signedIn(UserDTO)
    }

    static let shared = AuthManager()

    /// Convenience for SwiftUI previews.
    static let previewSignedIn: AuthManager = {
        let manager = AuthManager(store: InMemoryStore())
        manager.state = .signedIn(
            UserDTO(id: "preview", email: "preview@pantopus.app", displayName: "Preview", avatarURL: nil)
        )
        manager.accessToken = "preview-token"
        return manager
    }()

    static let previewSignedOut: AuthManager = {
        let manager = AuthManager(store: InMemoryStore())
        manager.state = .signedOut
        return manager
    }()

    /// Proactive refresh threshold (CONTRACT "Client behaviour").
    static let proactiveRefreshWindow: TimeInterval = 120
    /// A session idle longer than this is re-gated behind presence on the
    /// next cold start (design §3, "dormant > 30 d").
    static let dormancyWindow: TimeInterval = 30 * 24 * 60 * 60

    private(set) var state: State = .unknown
    private(set) var accessToken: String?

    /// When the user last signed in *interactively* (email/password or OAuth)
    /// — never stamped by a silent keychain restore. The post-login app-lock
    /// offer keys off this so it is made once per real sign-in and never on a
    /// cold launch into an existing session. Mirrors RN
    /// `AuthContext.lastInteractiveSignInAt` (`AuthContext.tsx:28`).
    private(set) var lastInteractiveSignInAt: Date?

    /// Why the last session ended (401 code from `/refresh`, or a plain
    /// expiry). The auth screens read it to show "You were signed out for
    /// security" instead of a generic message; cleared on the next
    /// successful sign-in / resume. `nil` after a user-initiated sign-out.
    private(set) var sessionEndReason: SessionEndReason?

    /// Server session id (`AuthSession.id`) of the live session.
    private(set) var sessionId: String?
    /// `interactive` | `restored` for the live session.
    private(set) var sessionContext: SessionContext?
    /// Absolute access-token expiry from the last login / refresh.
    private(set) var expiresAt: Date?

    /// UI hook for the password step-up method: asked for the account
    /// password when a `device_key` step-up is unavailable or refused. Set
    /// by the root UI (stage 2); nil ⇒ password step-up is unavailable and
    /// the interceptor lets the 403 through.
    var stepUpPasswordPrompt: (@MainActor (StepUpPurpose) async -> String?)?

    let store: any SecureStore
    let apiClient: APIClient
    let installMarker: InstallMarker
    let presenceGate: any PresenceGate
    /// Whether `DeviceKey.create` may use the Secure Enclave. Tests pass
    /// `false` so keys are plain software P-256 keys.
    let allowSecureEnclave: Bool
    /// Injectable clock for the expiry / dormancy rules.
    let now: @Sendable () -> Date
    let logger = Logger(label: "app.pantopus.ios.AuthManager")
    /// Retained for the lifetime of an in-flight ASWebAuthenticationSession.
    private(set) var oauthCoordinator: OAuthWebAuthenticationCoordinator?

    /// In-flight refresh, shared by all concurrent callers (single-flight).
    /// The backend rotates refresh tokens and treats a replayed refresh
    /// token as theft (`TOKEN_REUSE`), so two simultaneous refreshes would
    /// force a logout — we must coalesce them into one round-trip.
    private var refreshTask: Task<RefreshOutcome, Never>?

    /// The `code` of the last 401 from `/refresh`, consumed by
    /// `handleUnauthorized()` to end the session with the right reason.
    var lastRefreshRejection: SessionEndReason?

    /// Cached device identity (`deviceId` + DPoP key). Loaded lazily from
    /// the Keychain; created only by the credential-issuing / restore paths.
    @ObservationIgnored
    var deviceIdentity: DeviceIdentity?
    /// Install id chosen for the descriptor of an in-flight login; committed
    /// to file + Keychain only once that login succeeds.
    var pendingInstallId: String?
    /// Last APNs token seen; sent with `/api/auth/devices/register`.
    var pendingPushToken: String?
    /// Fire-and-forget follow-ups (device registration, local logout) —
    /// awaited by tests via `awaitBackgroundWork()`.
    var registerDeviceTask: Task<Void, Never>?
    var logoutTask: Task<Void, Never>?

    /// Outcome of a token refresh. Only `.authRejected` should sign the user
    /// out — a `.transient` failure (offline/timeout/5xx) must keep the
    /// session so a flaky network can't log the user out.
    enum RefreshOutcome: Equatable {
        case rotated
        case authRejected
        case transient
    }

    init(
        store: any SecureStore = KeychainStore(),
        apiClient: APIClient = .shared,
        installMarker: InstallMarker = .default,
        presenceGate: any PresenceGate = LocalAuthenticationPresenceGate(),
        allowSecureEnclave: Bool = SecureEnclave.isAvailable,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.store = store
        self.apiClient = apiClient
        self.installMarker = installMarker
        self.presenceGate = presenceGate
        self.allowSecureEnclave = allowSecureEnclave
        self.now = now
        // Wire the client back to this manager for tokens / DPoP / refresh /
        // step-up. The shared client always resolves to `AuthManager.shared`
        // (its fallback), so only a dedicated client — a test's or a
        // preview's — is pointed at the manager that owns it; a preview
        // manager built on the shared client can never hijack the app.
        if apiClient !== APIClient.shared {
            apiClient.authProvider = self
        }
    }

    func retainOAuthCoordinator(_ coordinator: OAuthWebAuthenticationCoordinator?) {
        oauthCoordinator = coordinator
    }

    // MARK: - State mutation (used by the extensions)

    func setState(_ newState: State) {
        state = newState
    }

    func setAccessToken(_ token: String?) {
        accessToken = token
    }

    func setSessionEndReason(_ reason: SessionEndReason?) {
        sessionEndReason = reason
    }

    func setSessionMetadata(id: String?, context: SessionContext?, expiresAt: Date?) {
        sessionId = id
        sessionContext = context
        self.expiresAt = expiresAt
    }

    func stampInteractiveSignIn(_ date: Date?) {
        lastInteractiveSignInAt = date
    }

    /// Re-fetch `GET /api/users/profile` and re-publish the session user so
    /// a mutation made elsewhere (avatar upload, profile PATCH) shows up
    /// app-wide immediately. Mirrors RN's `AuthContext.refreshUser()`.
    ///
    /// Deliberately does not run the `finishSignedIn` side effects — the
    /// socket is already connected and analytics already identified. A
    /// failure is swallowed: the caller has surfaced its own error and a
    /// stale avatar beats dropping the session.
    @discardableResult
    func refreshCurrentUser() async -> UserDTO? {
        guard case .signedIn = state else { return nil }
        do {
            let response: ProfileResponse = try await apiClient.request(UsersEndpoints.profile())
            let user = UserDTO(from: response.user)
            persistCachedUser(user)
            state = .signedIn(user)
            return user
        } catch {
            logger.debug("Session user refresh failed: \(error)")
            return nil
        }
    }

    /// Apply the side effects of a confirmed signed-in session: publish
    /// state, identify analytics, and (re)connect the realtime socket.
    func finishSignedIn(_ user: UserDTO, token: String) {
        state = .signedIn(user)
        Observability.shared.identify(userId: user.id, email: user.email)
        Analytics.identify(userId: user.id)
        SocketClient.shared.connect(token: token)
    }

    /// Persist a JSON snapshot of the session user so a future cold launch
    /// can render the signed-in shell before (or without) a network round-trip.
    func persistCachedUser(_ user: UserDTO) {
        guard let data = try? JSONEncoder().encode(user),
              let json = String(data: data, encoding: .utf8) else { return }
        try? store.set(json, for: SecureStoreKey.cachedUser)
    }

    /// Load the cached session user, if any.
    func loadCachedUser() -> UserDTO? {
        guard let json = store.get(SecureStoreKey.cachedUser),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(UserDTO.self, from: data)
    }

    // MARK: - Sign in

    func signIn(email: String, password: String) async throws {
        do {
            let response: LoginResponse = try await apiClient.request(
                AuthEndpoints.login(email: email, password: password, device: makeDeviceDescriptor())
            )
            try persistLoginResponse(response, method: .password)
        } catch let apiError as APIError {
            throw Self.mapSignInError(apiError)
        }
    }

    /// Persist a credential-issuing response (login / OAuth) and enter the
    /// signed-in state. `method` is remembered on the display hint so the
    /// L3 card can offer the right affordance next time.
    func persistLoginResponse(_ response: LoginResponse, method: AccountHintMethod = .password) throws {
        guard let access = response.accessToken, !access.isEmpty else {
            throw AuthError.unknown
        }
        // A session left over from before this login (e.g. "Use a different
        // account" on the Continue-as card) is superseded: revoke it
        // server-side with proof once the new one is safely persisted.
        let supersededRefresh = store.get(SecureStoreKey.refreshToken)
        let supersededAccess = store.get(SecureStoreKey.accessToken)

        try store.set(access, for: SecureStoreKey.accessToken)
        accessToken = access
        if let refresh = response.refreshToken, !refresh.isEmpty {
            try store.set(refresh, for: SecureStoreKey.refreshToken)
        }
        try store.set(response.user.id, for: SecureStoreKey.userId)
        persistSessionMetadata(
            expiresAt: response.expiresAt,
            expiresIn: response.expiresIn,
            sessionId: response.sessionId ?? response.session?.id,
            context: response.session?.context
        )

        let user = UserDTO(from: response.user)
        persistCachedUser(user)
        AccountHintStore.remember(AccountHint(user: user, lastMethod: method, lastSeenAt: now()), in: store)
        installMarker.commit(installId: pendingInstallId ?? installMarker.installIdForDescriptor(store: store), store: store)
        pendingInstallId = nil
        sessionEndReason = nil
        // Both interactive entry points (email/password + OAuth callback)
        // funnel through here; `restoreSession()` deliberately does not.
        lastInteractiveSignInAt = now()
        finishSignedIn(user, token: access)
        Observability.shared.track("auth.signed_in")
        logger.info("Signed in", metadata: ["userId": .string(response.user.id)])

        if let supersededRefresh, !supersededRefresh.isEmpty, supersededRefresh != response.refreshToken {
            scheduleLocalLogout(accessToken: supersededAccess, refreshToken: supersededRefresh)
        }
        scheduleDeviceRegistration(enrolStepUpKey: true)
    }

    // MARK: - Sign up

    // swiftlint:disable function_parameter_count
    /// `POST /api/users/register` (route `backend/routes/users.js:1288`).
    ///
    /// On 201, returns a `SignUpResult` with the freshly-created user. The
    /// backend always sets `requiresEmailVerification: true` for new
    /// accounts; the verify-email soft-gate banner is driven from that
    /// field per the Q4 decision. Does **not** sign the user in — the
    /// caller pushes to either the verify-email screen or hands off to
    /// `signIn` once the user verifies.
    func signUp(
        email: String,
        password: String,
        phoneNumber: String?,
        username: String,
        firstName: String,
        middleName: String?,
        lastName: String,
        dateOfBirth: Date?,
        address: String?,
        city: String?,
        state: String?,
        zipcode: String?,
        accountType: AccountType,
        inviteCode: String?
    ) async throws -> SignUpResult {
        let body = RegisterRequest(
            email: email,
            password: password,
            phoneNumber: phoneNumber,
            username: username,
            firstName: firstName,
            middleName: middleName,
            lastName: lastName,
            dateOfBirth: dateOfBirth.map(Self.iso8601Date),
            address: address,
            city: city,
            state: state,
            zipcode: zipcode,
            accountType: accountType.backendValue,
            inviteCode: inviteCode
        )

        do {
            let response: RegisterResponse = try await apiClient.request(
                AuthEndpoints.register(body)
            )
            Observability.shared.track("auth.signed_up")
            logger.info("Registered", metadata: ["userId": .string(response.user.id)])
            return SignUpResult(
                user: response.user,
                requiresEmailVerification: response.requiresEmailVerification ?? true
            )
        } catch let apiError as APIError {
            throw Self.mapRegisterError(apiError)
        }
    }

    // swiftlint:enable function_parameter_count

    // MARK: - Forgot / reset password

    /// `POST /api/users/forgot-password` (route `backend/routes/users.js:3470`).
    /// Backend always replies 200 with a generic message to prevent email
    /// enumeration — there's no distinction between "sent" and "no such
    /// account" at this layer.
    func forgotPassword(email: String) async throws {
        do {
            _ = try await apiClient.request(
                AuthEndpoints.forgotPassword(email: email),
                as: AuthMessageResponse.self
            )
            Observability.shared.track("auth.forgot_password_requested")
        } catch let apiError as APIError {
            throw Self.mapGenericAuthError(apiError)
        }
    }

    /// `POST /api/users/reset-password` (route `backend/routes/users.js:3520`).
    /// `token` is the hashed recovery token carried by the email link.
    func resetPassword(token: String, newPassword: String) async throws {
        do {
            _ = try await apiClient.request(
                AuthEndpoints.resetPassword(token: token, newPassword: newPassword),
                as: AuthMessageResponse.self
            )
            Observability.shared.track("auth.password_reset")
        } catch let apiError as APIError {
            throw Self.mapResetPasswordError(apiError)
        }
    }

    // MARK: - Verify email

    /// `POST /api/users/verify-email` (route `backend/routes/users.js:3388`).
    /// Sends the hashed Supabase OTP carried by the verification link.
    /// Backend revokes the just-issued session, so verifying does NOT
    /// sign the user in; the caller routes to login after success.
    func verifyEmail(token: String) async throws {
        do {
            _ = try await apiClient.request(
                AuthEndpoints.verifyEmail(tokenHash: token),
                as: VerifyEmailResponse.self
            )
            Observability.shared.track("auth.email_verified")
        } catch let apiError as APIError {
            throw Self.mapVerifyEmailError(apiError)
        }
    }

    /// `POST /api/users/resend-verification` (route `backend/routes/users.js:3322`).
    /// Like forgot-password, always returns 200 with a generic message.
    func resendVerification(email: String) async throws {
        do {
            _ = try await apiClient.request(
                AuthEndpoints.resendVerification(email: email),
                as: AuthMessageResponse.self
            )
            Observability.shared.track("auth.verification_resent")
        } catch let apiError as APIError {
            throw Self.mapGenericAuthError(apiError)
        }
    }

    // MARK: - Refresh session

    /// Single-flight access-token refresh. Concurrent callers (e.g. several
    /// requests that 401 at once) share one in-flight network round-trip —
    /// essential because the backend rotates refresh tokens and rejects a
    /// replayed one as theft (`TOKEN_REUSE`). Returns a classified outcome so
    /// the caller can tell a genuine auth rejection (sign out) from a
    /// transient failure (keep the session). Does **not** sign out itself.
    @discardableResult
    func refreshIfPossible() async -> RefreshOutcome {
        if let task = refreshTask {
            return await task.value
        }
        let task = Task { await performRefresh() }
        refreshTask = task
        defer { refreshTask = nil }
        return await task.value
    }

    /// Imperative refresh used by call sites that want to force a token
    /// rotation and treat failure as a hard sign-out (e.g. tests, explicit
    /// "reconnect" affordances). Routes through the single-flight path.
    func refreshSession() async throws {
        if await refreshIfPossible() == .rotated {
            return
        }
        logger.warning("Refresh failed, signing out")
        await signOut()
        throw AuthError.invalidCredentials
    }

    // MARK: - Sign out

    /// User-initiated sign-out of this device (`scope: local`): the local
    /// session is wiped immediately and the server is told with proof
    /// (Bearer + refresh token + DPoP `rth`) in the background. The display
    /// hint is kept so the login card can offer "Continue as X".
    func signOut() async {
        _ = try? await signOut(scope: .local)
    }

    // MARK: - 401 handling

    /// Terminal 401 handler: invoked by the networking layer only after a
    /// silent refresh has already failed. Clears the session, keeping the
    /// display hint, and publishes the reason the refresh reported.
    func handleUnauthorized() async {
        let reason = lastRefreshRejection ?? .expired
        lastRefreshRejection = nil
        logger.warning("Handling 401 after failed refresh — ending session", metadata: ["code": .string(reason.rawValue)])
        endSession(reason: reason)
    }
}
