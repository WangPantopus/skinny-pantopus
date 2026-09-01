//
//  AuthManager+Session.swift
//  Pantopus
//
//  Cold-start restore (L1 → L2 → L3), the "Continue as" resume, token
//  refresh with DPoP, proactive refresh, and session teardown. Design:
//  docs/persistent-login/persistent-login-design-2026-08-18.md §3, §7.2,
//  §7.3, §7.5; contract: docs/persistent-login/CONTRACT.md.
//

// swiftlint:disable file_length

import Foundation
import Logging

// MARK: - Presence gate

/// Result of the OS presence check that guards "Continue as X".
public enum PresenceOutcome: Sendable, Equatable {
    case verified
    case cancelled
    /// `LAContext.canEvaluatePolicy(.deviceOwnerAuthentication)` is false —
    /// no passcode and no biometrics. No OS lock ⇒ no one-tap resume (L3).
    case unavailable
    case failed(String)
}

/// Abstraction over `LAContext.evaluatePolicy(.deviceOwnerAuthentication)`
/// so `AuthManager.restoreSession()` / `resume()` are unit-testable.
protocol PresenceGate: Sendable {
    /// `LAContext.canEvaluatePolicy(.deviceOwnerAuthentication)` — false when
    /// the device has neither passcode nor biometrics. No OS lock ⇒ no
    /// one-tap resume: the cold start goes straight to L3 (design §2.2).
    var isAvailable: Bool { get }

    @MainActor
    func verify(reason: String) async -> PresenceOutcome
}

/// Production gate — delegates to `AppLockManager` so the prompt bookkeeping
/// (`isPrompting`, background-while-prompting) stays in one place.
struct LocalAuthenticationPresenceGate: PresenceGate {
    var isAvailable: Bool {
        DeviceDescriptor.hasOsLock
    }

    @MainActor
    func verify(reason: String) async -> PresenceOutcome {
        await AppLockManager.shared.verifyPresence(reason: reason)
    }
}

/// What `resume()` did — for the Continue-as card.
enum ResumeOutcome: Equatable {
    /// Presence confirmed and the session is live again.
    case signedIn
    /// The user dismissed the OS prompt; still `.resumable`.
    case cancelled
    /// The device has no passcode / biometrics: fell back to the login
    /// screen (L3) with the hint kept.
    case noOsLock
    /// The server refused the refresh (`SessionEndReason` explains why);
    /// tokens wiped, hint kept, now `.signedOut`.
    case rejected(SessionEndReason)
    /// Offline / server blip; still `.resumable`, try again.
    case transient
    /// The OS check itself failed with a message.
    case failed(String)
}

extension AuthManager {
    // MARK: - Session restore (cold start)

    /// Cold-start decision tree (design §3):
    ///
    /// - no tokens ⇒ `.signedOut` (L3: the login screen reads the hint);
    /// - refresh token + install marker missing/mismatched (reinstall), or
    ///   dormant > 30 d ⇒ `.resumable(hint)` (L2: one gesture, never silent,
    ///   never a wipe);
    /// - otherwise L1: proactive DPoP refresh when the access token is
    ///   missing or within 120 s of expiry, then `GET /api/users/profile`.
    ///   A 401 whose refresh also failed ends the session with the server's
    ///   reason; a transient failure keeps the cached identity (offline-first).
    func restoreSession() async {
        let access = nonEmpty(store.get(SecureStoreKey.accessToken))
        let refresh = nonEmpty(store.get(SecureStoreKey.refreshToken))
        guard access != nil || refresh != nil else {
            setState(.signedOut)
            return
        }
        loadSessionMetadata()

        if refresh != nil {
            switch installMarker.verdict(store: store) {
            case .reinstall:
                becomeResumable(trigger: "reinstall")
                return
            case .sameInstall, .fresh:
                break
            }
            if isDormant() {
                becomeResumable(trigger: "dormant")
                return
            }
        }

        setAccessToken(access)
        if access == nil || isAccessTokenExpiringSoon {
            // Only a refresh token, or an access token about to lapse:
            // renew first so the profile fetch never pays the 401 tax.
            switch await refreshIfPossible() {
            case .rotated:
                break
            case .authRejected:
                await handleUnauthorized()
                return
            case .transient:
                if access == nil {
                    // Nothing to hydrate with; keep the tokens for the next
                    // launch and show the cached shell if there is one.
                    if let cached = loadCachedUser() {
                        setState(.signedIn(cached))
                    } else {
                        setState(.signedOut)
                    }
                    return
                }
            }
        }
        await hydrateProfile(reinstall: false)
    }

    /// `GET /api/users/profile` → `.signedIn`, with the offline-first
    /// fallbacks. Shared by the L1 and L2 paths.
    private func hydrateProfile(reinstall: Bool) async {
        let token = accessToken ?? ""
        let cached = loadCachedUser()
        // Best-effort hydration of the current user. A 401 here is recovered
        // transparently by APIClient's silent refresh; if even the refresh
        // fails it surfaces as `.unauthorized` and we end the session.
        do {
            let response: ProfileResponse = try await apiClient.request(UsersEndpoints.profile())
            let user = UserDTO(from: response.user)
            persistCachedUser(user)
            finishSignedIn(user, token: accessToken ?? token)
            afterSuccessfulRestore(user: user, reinstall: reinstall)
            logger.info("Session restored", metadata: ["userId": .string(user.id)])
        } catch let error as APIError {
            switch error {
            case .unauthorized:
                // The token is genuinely stale and refresh could not renew it.
                // `handleUnauthorized()` already ran inside APIClient; if the
                // state somehow still says signed in, end it here.
                if case .signedIn = state {
                    await handleUnauthorized()
                }
                logger.info("Session restore unauthorized — session ended")
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
                    setState(.signedOut)
                }
            }
        } catch {
            // Non-APIError (e.g. decoding) — treat as transient, never wipe.
            if let cached {
                finishSignedIn(cached, token: token)
            } else {
                setState(.signedOut)
            }
        }
    }

    /// Bookkeeping after the server confirmed the session: marker, hint
    /// freshness, device registration on app update, telemetry.
    private func afterSuccessfulRestore(user: UserDTO, reinstall: Bool) {
        setSessionEndReason(nil)
        installMarker.commit(installId: pendingInstallId ?? installMarker.installIdForDescriptor(store: store), store: store)
        pendingInstallId = nil
        touchHint(for: user, method: nil)
        Observability.shared.track(
            "session_restore_ok",
            properties: ["path": reinstall ? "L2" : "L1", "reinstall": reinstall ? "1" : "0"]
        )
        scheduleDeviceRegistration(enrolStepUpKey: false, onlyIfAppUpdated: !reinstall)
    }

    /// Enter `.resumable` with the best hint we have for the stored user —
    /// or, on a device with no passcode / biometrics, fall straight to L3
    /// (`.signedOut`, hint kept, tokens left in place for a later launch
    /// once an OS lock exists): no OS lock ⇒ no one-tap resume.
    private func becomeResumable(trigger: String) {
        setAccessToken(nil)
        guard presenceGate.isAvailable else {
            setState(.signedOut)
            Observability.shared.track("session_resume_unavailable", properties: ["trigger": trigger])
            logger.info("Session resume unavailable — no OS lock, falling back to login", metadata: ["trigger": .string(trigger)])
            return
        }
        setState(.resumable(resumableHint()))
        Observability.shared.track("session_resume_prompt", properties: ["trigger": trigger])
        logger.info("Session resumable — presence required", metadata: ["trigger": .string(trigger)])
    }

    /// The hint for the account whose tokens are stored: the remembered
    /// entry, else one synthesised from the cached user (upgrade from a
    /// version without hints), else a bare user id.
    func resumableHint() -> AccountHint {
        let userId = store.get(SecureStoreKey.userId)
        if let userId, let hint = AccountHintStore.load(from: store).first(where: { $0.userId == userId }) {
            return hint
        }
        if let cached = loadCachedUser() {
            return AccountHint(user: cached, lastMethod: nil, lastSeenAt: now())
        }
        return AccountHint(userId: userId ?? "", displayName: nil, avatarUrl: nil, maskedEmail: nil, lastMethod: nil, lastSeenAt: now())
    }

    /// Dormant = the remembered `lastSeenAt` for the stored user is older
    /// than 30 d. Users without a hint (pre-feature upgrade) are not
    /// dormant — they get one L1 restore, which writes the hint.
    func isDormant() -> Bool {
        guard let userId = store.get(SecureStoreKey.userId),
              let hint = AccountHintStore.load(from: store).first(where: { $0.userId == userId }) else {
            return false
        }
        return now().timeIntervalSince(hint.lastSeenAt) > Self.dormancyWindow
    }

    // MARK: - Resume (L2)

    /// "Continue" on the Continue-as card: OS presence check, then a DPoP
    /// refresh (`{refreshToken, deviceId, sessionId}` + `rth`), then the
    /// same profile hydration as L1. Never wipes tokens on cancel / offline;
    /// wipes them (keeping the hint) only when the server rejects the
    /// refresh, publishing the reason.
    @discardableResult
    func resume(reason: String = "Continue signed in to Pantopus") async -> ResumeOutcome {
        guard case .resumable = state else { return .failed("Nothing to resume.") }
        switch await presenceGate.verify(reason: reason) {
        case .cancelled:
            Observability.shared.track("session_resume_cancel")
            return .cancelled
        case let .failed(message):
            return .failed(message)
        case .unavailable:
            // No OS lock ⇒ no one-tap resume. Fall to L3: the login screen
            // is prefilled from the hint; tokens stay for a later launch
            // once a passcode exists.
            logger.info("Resume unavailable — no device passcode/biometrics, falling back to login")
            setState(.signedOut)
            return .noOsLock
        case .verified:
            break
        }
        _ = ensureDeviceIdentity()
        switch await refreshIfPossible() {
        case .rotated:
            await hydrateProfile(reinstall: true)
            if case .signedIn = state {
                Observability.shared.track("session_resume_ok")
                return .signedIn
            }
            // The profile fetch 401'd and its own refresh was refused:
            // `handleUnauthorized()` already ended the session with the
            // server's reason. Otherwise the fetch failed transiently and
            // hydrateProfile fell back to the cached identity or
            // `.signedOut` (tokens preserved).
            if let reason = sessionEndReason {
                return .rejected(reason)
            }
            return .transient
        case .authRejected:
            let reason = lastRefreshRejection ?? .expired
            lastRefreshRejection = nil
            endSession(reason: reason)
            return .rejected(reason)
        case .transient:
            return .transient
        }
    }

    // MARK: - Refresh

    /// `POST /api/users/refresh` (route `backend/routes/users.js:2102`) with
    /// `deviceId` / `sessionId` and a DPoP proof carrying `rth`. Uses the
    /// raw send path so the 401 body's `code` is available. On success,
    /// persists the rotated pair + expiry + session id and reconnects the
    /// socket. Classifies failures: 401 / 400 ⇒ `.authRejected` (with the
    /// reason stashed for `handleUnauthorized`); anything else (offline,
    /// timeout, 429, 5xx) ⇒ `.transient` and must not sign the user out.
    func performRefresh() async -> RefreshOutcome {
        guard let stored = nonEmpty(store.get(SecureStoreKey.refreshToken)) else {
            return .authRejected
        }
        let identity = ensureDeviceIdentity()
        let endpoint = AuthEndpoints.refresh(
            refreshToken: stored,
            deviceId: identity?.deviceId,
            sessionId: sessionId ?? nonEmpty(store.get(SecureStoreKey.sessionId)),
            headers: dpopHeaders(for: "/api/users/refresh", method: "POST", refreshToken: stored, identity: identity)
        )
        let raw: APIClient.RawResponse
        do {
            raw = try await apiClient.sendRaw(endpoint)
        } catch {
            logger.warning("Refresh failed transiently", metadata: ["error": .string("\(error)")])
            return .transient
        }
        switch raw.status {
        case 200..<300:
            return applyRefreshResponse(raw.data)
        case 401:
            let reason = SessionEndReason(code: AuthErrorBody.decode(raw.data)?.code)
            lastRefreshRejection = reason
            logger.warning("Refresh rejected by server", metadata: ["code": .string(reason.rawValue)])
            return .authRejected
        case 400:
            // Malformed / missing refresh token → unrecoverable.
            lastRefreshRejection = .expired
            return .authRejected
        case 400..<500:
            // 403, 429 (rate-limited) and any other 4xx → transient, keep session.
            return .transient
        default:
            logger.warning("Refresh failed transiently", metadata: ["status": .string("\(raw.status)")])
            return .transient
        }
    }

    private func applyRefreshResponse(_ data: Data) -> RefreshOutcome {
        let response: RefreshResponse
        do {
            response = try JSONDecoder().decode(RefreshResponse.self, from: data)
        } catch {
            // Genuinely unexpected — log + report, but keep the session
            // (transient) rather than punishing the user for our bug.
            logger.warning("Refresh response undecodable", metadata: ["error": .string("\(error)")])
            Observability.shared.capture(error)
            return .transient
        }
        guard let access = nonEmpty(response.accessToken) else { return .authRejected }
        do {
            try store.set(access, for: SecureStoreKey.accessToken)
            if let refresh = nonEmpty(response.refreshToken) {
                try store.set(refresh, for: SecureStoreKey.refreshToken)
            }
        } catch {
            logger.error("Persisting refreshed tokens failed", metadata: ["error": .string("\(error)")])
            return .transient
        }
        setAccessToken(access)
        persistSessionMetadata(
            expiresAt: response.expiresAt,
            expiresIn: response.expiresIn,
            sessionId: response.sessionId ?? response.session?.id,
            context: response.session?.context
        )
        if let userId = store.get(SecureStoreKey.userId),
           let hint = AccountHintStore.load(from: store).first(where: { $0.userId == userId }) {
            AccountHintStore.remember(hint.touched(at: now()), in: store)
        }
        SocketClient.shared.connect(token: access)
        logger.info("Access token refreshed")
        return .rotated
    }

    /// `expiresAt - now < 120 s` (and there is something to refresh with).
    /// Read by `APIClient` / `MultipartUploader` before every authenticated
    /// request; never true for the refresh endpoint's own round-trip
    /// because that goes through `sendRaw`.
    var isAccessTokenExpiringSoon: Bool {
        guard accessToken != nil, let expiresAt,
              nonEmpty(store.get(SecureStoreKey.refreshToken)) != nil else { return false }
        return expiresAt.timeIntervalSince(now()) < Self.proactiveRefreshWindow
    }

    /// Foreground hook (`scenePhase == .active`): renew a token that is
    /// about to lapse so the first request after a long background is not
    /// a 401 + replay. Ends the session only on a server rejection.
    func refreshIfExpiringSoon() async {
        guard case .signedIn = state, isAccessTokenExpiringSoon else { return }
        if await refreshIfPossible() == .authRejected {
            await handleUnauthorized()
        }
    }

    /// The socket (or a silent push) said this session / device was revoked.
    /// Neither is the authority (design §7.7): confirm with a DPoP refresh
    /// and end the session only when the server rejects it — publishing the
    /// server's reason (`SESSION_REVOKED` / `DEVICE_REVOKED`). A transient
    /// failure or a successful rotation keeps the session.
    func confirmSessionAfterRevocationSignal() async {
        guard case .signedIn = state else { return }
        if await refreshIfPossible() == .authRejected {
            await handleUnauthorized()
        }
    }

    // MARK: - Session metadata

    /// Persist expiry / session id / context from a login or refresh
    /// response and publish them.
    func persistSessionMetadata(expiresAt: Int?, expiresIn: Int?, sessionId: String?, context: String?) {
        let expiry: Date? = if let expiresAt {
            Date(timeIntervalSince1970: TimeInterval(expiresAt))
        } else if let expiresIn {
            now().addingTimeInterval(TimeInterval(expiresIn))
        } else {
            nil
        }
        if let expiry {
            try? store.set(String(Int(expiry.timeIntervalSince1970)), for: SecureStoreKey.expiresAt)
        }
        if let sessionId, !sessionId.isEmpty {
            try? store.set(sessionId, for: SecureStoreKey.sessionId)
        }
        let resolvedContext = context.flatMap(SessionContext.init(rawValue:))
        if let resolvedContext {
            try? store.set(resolvedContext.rawValue, for: SecureStoreKey.sessionContext)
        }
        setSessionMetadata(
            id: (sessionId?.isEmpty == false ? sessionId : nil) ?? self.sessionId ?? nonEmpty(store.get(SecureStoreKey.sessionId)),
            context: resolvedContext ?? sessionContext ?? storedSessionContext(),
            expiresAt: expiry ?? self.expiresAt
        )
    }

    /// Hydrate the published metadata from the Keychain (cold start).
    func loadSessionMetadata() {
        let expiry = store.get(SecureStoreKey.expiresAt)
            .flatMap(Double.init)
            .map { Date(timeIntervalSince1970: $0) }
        setSessionMetadata(
            id: nonEmpty(store.get(SecureStoreKey.sessionId)),
            context: storedSessionContext(),
            expiresAt: expiry
        )
    }

    private func storedSessionContext() -> SessionContext? {
        store.get(SecureStoreKey.sessionContext).flatMap(SessionContext.init(rawValue:))
    }

    /// Refresh the remembered hint's `lastSeenAt` (and method when known).
    func touchHint(for user: UserDTO, method: AccountHintMethod?) {
        let existing = AccountHintStore.load(from: store).first { $0.userId == user.id }
        let hint = existing?.touched(at: now(), method: method)
            ?? AccountHint(user: user, lastMethod: method, lastSeenAt: now())
        AccountHintStore.remember(hint, in: store)
    }

    // MARK: - Teardown

    /// End the session because the server said so (401 code) or the token
    /// expired: wipe tokens + session metadata, keep the display hint,
    /// publish the reason. No network call — the server already knows.
    func endSession(reason: SessionEndReason) {
        let hadSession = clearLocalSession()
        setSessionEndReason(reason)
        Observability.shared.track("session_invalidated", properties: ["code": reason.rawValue])
        if hadSession {
            Observability.shared.track("auth.signed_out", properties: ["reason": reason.rawValue])
        }
    }

    /// Wipe everything that authenticates or identifies the *session*
    /// (tokens, expiry, session id/context, cached user) and reset the
    /// in-memory state. Keeps the device identity (it is per device, not
    /// per session) and the remembered-account hints. Returns whether a
    /// session existed — several concurrent 401s can each reach here after
    /// one coalesced refresh fails; only the first fires the side effects
    /// (no suspension points, so the @MainActor serializes the reads).
    @discardableResult
    func clearLocalSession() -> Bool {
        let hadSession = accessToken != nil || store.get(SecureStoreKey.accessToken) != nil
        for key in [
            SecureStoreKey.accessToken, SecureStoreKey.refreshToken, SecureStoreKey.userId,
            SecureStoreKey.cachedUser, SecureStoreKey.expiresAt, SecureStoreKey.sessionId,
            SecureStoreKey.sessionContext
        ] {
            try? store.delete(key)
        }
        setAccessToken(nil)
        setSessionMetadata(id: nil, context: nil, expiresAt: nil)
        stampInteractiveSignIn(nil)
        setSessionEndReason(nil)
        pendingInstallId = nil
        setState(.signedOut)
        // Workstream 1.4 — never resume a prior user's deferred destination.
        PendingDeepLinkStore.clear()
        DeepLinkRouter.shared.clearPending()
        // One account's client-side mutes / hides must never filter the
        // next account's feed (RN drops the provider state on sign-out).
        FeedModerationStore.shared.clear()
        // Cached reads belong to the account that made them.
        apiClient.purgeCache()
        guard hadSession else { return false }
        SocketClient.shared.disconnect()
        Observability.shared.identify(userId: nil)
        Analytics.identify(userId: nil)
        return true
    }

    // MARK: - Helpers

    func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }
}
