//
//  AuthManager.swift
//  Pantopus
//
//  Holds auth state, persists tokens to the Keychain, and coordinates
//  login / logout / session restore.
//

// swiftlint:disable file_length

import Foundation
import Logging

/// Account type chosen at registration. Maps to the backend's
/// `account_type` column. Persisted as `"individual"` (personal) or
/// `"business"` per `registerSchema` at `backend/routes/users.js:723`.
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

@Observable
@MainActor
final class AuthManager {
    enum State: Equatable {
        case unknown
        case signedOut
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

    private(set) var state: State = .unknown
    private(set) var accessToken: String?

    /// When the user last signed in *interactively* (email/password or OAuth)
    /// — never stamped by a silent keychain restore. The post-login app-lock
    /// offer keys off this so it is made once per real sign-in and never on a
    /// cold launch into an existing session. Mirrors RN
    /// `AuthContext.lastInteractiveSignInAt` (`AuthContext.tsx:28`).
    private(set) var lastInteractiveSignInAt: Date?

    let store: any SecureStore
    let apiClient: APIClient
    private let logger = Logger(label: "app.pantopus.ios.AuthManager")
    /// Retained for the lifetime of an in-flight ASWebAuthenticationSession.
    private(set) var oauthCoordinator: OAuthWebAuthenticationCoordinator?

    /// In-flight refresh, shared by all concurrent callers (single-flight).
    /// The backend rotates refresh tokens and treats a replayed refresh
    /// token as theft (`TOKEN_REUSE`), so two simultaneous refreshes would
    /// force a logout — we must coalesce them into one round-trip.
    private var refreshTask: Task<RefreshOutcome, Never>?

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
        apiClient: APIClient = .shared
    ) {
        self.store = store
        self.apiClient = apiClient
    }

    func retainOAuthCoordinator(_ coordinator: OAuthWebAuthenticationCoordinator?) {
        oauthCoordinator = coordinator
    }

    // MARK: - Session restore

    func restoreSession() async {
        guard let token = store.get(SecureStoreKey.accessToken), !token.isEmpty else {
            state = .signedOut
            return
        }
        accessToken = token
        let cached = loadCachedUser()
        // Best-effort hydration of the current user. A 401 here is recovered
        // transparently by APIClient's silent refresh; if even the refresh
        // fails it surfaces as `.unauthorized` and we sign out for real.
        do {
            let response: ProfileResponse = try await apiClient.request(UsersEndpoints.profile())
            let user = UserDTO(from: response.user)
            persistCachedUser(user)
            finishSignedIn(user, token: accessToken ?? token)
            logger.info("Session restored", metadata: ["userId": .string(user.id)])
        } catch let error as APIError {
            switch error {
            case .unauthorized:
                // The token is genuinely stale and refresh could not renew it.
                logger.info("Session restore unauthorized — signing out")
                await signOut()
            default:
                // Transient failure (offline, timeout, 5xx). Do NOT wipe the
                // session — keep the user signed in against their cached
                // identity and let each screen retry. Matches YouTube/Gmail,
                // which never sign you out over a flaky connection.
                if let cached {
                    logger.info("Session restore deferred (offline) — using cached identity")
                    finishSignedIn(cached, token: token)
                } else {
                    logger.info("Session restore deferred (offline) — no cached identity, tokens preserved")
                    state = .signedOut
                }
            }
        } catch {
            // Non-APIError (e.g. decoding) — treat as transient, never wipe.
            if let cached {
                finishSignedIn(cached, token: token)
            } else {
                state = .signedOut
            }
        }
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
    private func finishSignedIn(_ user: UserDTO, token: String) {
        state = .signedIn(user)
        Observability.shared.identify(userId: user.id, email: user.email)
        Analytics.identify(userId: user.id)
        SocketClient.shared.connect(token: token)
    }

    /// Persist a JSON snapshot of the session user so a future cold launch
    /// can render the signed-in shell before (or without) a network round-trip.
    private func persistCachedUser(_ user: UserDTO) {
        guard let data = try? JSONEncoder().encode(user),
              let json = String(data: data, encoding: .utf8) else { return }
        try? store.set(json, for: SecureStoreKey.cachedUser)
    }

    /// Load the cached session user, if any.
    private func loadCachedUser() -> UserDTO? {
        guard let json = store.get(SecureStoreKey.cachedUser),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(UserDTO.self, from: data)
    }

    // MARK: - Sign in

    func signIn(email: String, password: String) async throws {
        do {
            let response: LoginResponse = try await apiClient.request(
                AuthEndpoints.login(email: email, password: password)
            )
            try persistLoginResponse(response)
        } catch let apiError as APIError {
            throw Self.mapSignInError(apiError)
        }
    }

    func persistLoginResponse(_ response: LoginResponse) throws {
        guard let access = response.accessToken, !access.isEmpty else {
            throw AuthError.unknown
        }
        try store.set(access, for: SecureStoreKey.accessToken)
        accessToken = access
        if let refresh = response.refreshToken, !refresh.isEmpty {
            try store.set(refresh, for: SecureStoreKey.refreshToken)
        }
        try store.set(response.user.id, for: SecureStoreKey.userId)

        let user = UserDTO(from: response.user)
        persistCachedUser(user)
        // Both interactive entry points (email/password + OAuth callback)
        // funnel through here; `restoreSession()` deliberately does not.
        lastInteractiveSignInAt = Date()
        finishSignedIn(user, token: access)
        Observability.shared.track("auth.signed_in")
        logger.info("Signed in", metadata: ["userId": .string(response.user.id)])
    }

    // MARK: - Sign up

    // swiftlint:disable function_parameter_count
    /// `POST /api/users/register` (route `backend/routes/users.js:1177`).
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

    /// `POST /api/users/forgot-password` (route `backend/routes/users.js:3197`).
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

    /// `POST /api/users/reset-password` (route `backend/routes/users.js:3247`).
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

    /// `POST /api/users/verify-email` (route `backend/routes/users.js:3115`).
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

    /// `POST /api/users/resend-verification` (route `backend/routes/users.js:3049`).
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

    /// `POST /api/users/refresh` (route `backend/routes/users.js:1910`). On
    /// success, persists the rotated access + refresh tokens and reconnects
    /// the socket. Classifies failures: a 401/4xx from the refresh endpoint is
    /// `.authRejected` (refresh token expired/replayed); anything else
    /// (offline, timeout, 5xx) is `.transient` and must not sign the user out.
    private func performRefresh() async -> RefreshOutcome {
        guard let stored = store.get(SecureStoreKey.refreshToken), !stored.isEmpty else {
            return .authRejected
        }
        do {
            let response: RefreshResponse = try await apiClient.request(
                AuthEndpoints.refresh(refreshToken: stored)
            )
            guard let access = response.accessToken, !access.isEmpty else { return .authRejected }
            try store.set(access, for: SecureStoreKey.accessToken)
            accessToken = access
            if let refresh = response.refreshToken, !refresh.isEmpty {
                try store.set(refresh, for: SecureStoreKey.refreshToken)
            }
            SocketClient.shared.connect(token: access)
            logger.info("Access token refreshed")
            return .rotated
        } catch let error as APIError {
            switch error {
            case .unauthorized:
                // Refresh token expired / replayed (TOKEN_REUSE) — sign out.
                logger.warning("Refresh rejected by server")
                return .authRejected
            case let .clientError(status, _):
                // 400 = malformed/missing refresh token → unrecoverable. 429
                // (rate-limited) and any other 4xx → transient, keep session.
                return status == 400 ? .authRejected : .transient
            default:
                // .forbidden, .server (5xx), .transport, decoding, etc.
                logger.warning("Refresh failed transiently", metadata: ["error": .string("\(error)")])
                return .transient
            }
        } catch {
            // Genuinely unexpected (e.g. decoding) — log + report, but keep the
            // session (transient) rather than punishing the user for our bug.
            logger.warning("Refresh failed unexpectedly", metadata: ["error": .string("\(error)")])
            Observability.shared.capture(error)
            return .transient
        }
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

    func signOut() async {
        // Whether a real session existed before this call. Several concurrent
        // 401s can each reach here after one coalesced refresh fails; only the
        // first should fire the disconnect/analytics side effects. (signOut has
        // no suspension points, so the @MainActor serializes these reads/writes
        // — the second caller sees `hadSession == false`.)
        let hadSession = accessToken != nil || store.get(SecureStoreKey.accessToken) != nil
        try? store.delete(SecureStoreKey.accessToken)
        try? store.delete(SecureStoreKey.refreshToken)
        try? store.delete(SecureStoreKey.userId)
        try? store.delete(SecureStoreKey.cachedUser)
        accessToken = nil
        lastInteractiveSignInAt = nil
        state = .signedOut
        // Workstream 1.4 — never resume a prior user's deferred destination.
        PendingDeepLinkStore.clear()
        DeepLinkRouter.shared.clearPending()
        // One account's client-side mutes / hides must never filter the
        // next account's feed (RN drops the provider state on sign-out).
        FeedModerationStore.shared.clear()
        guard hadSession else { return }
        SocketClient.shared.disconnect()
        Observability.shared.identify(userId: nil)
        Analytics.identify(userId: nil)
        Observability.shared.track("auth.signed_out")
    }

    // MARK: - 401 handling

    /// Terminal 401 handler: invoked by the networking layer only after a
    /// silent refresh has already failed. Clears the session.
    func handleUnauthorized() async {
        logger.warning("Handling 401 after failed refresh — signing out")
        await signOut()
    }
}
