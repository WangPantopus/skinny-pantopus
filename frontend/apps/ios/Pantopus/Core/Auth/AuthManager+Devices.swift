//
//  AuthManager+Devices.swift
//  Pantopus
//
//  Device identity (deviceId + DPoP key), device registration, logout
//  scopes with proof, remembered-account removal, and step-up (password /
//  biometry-bound device key). Design §7.1, §7.6, §7.9; CONTRACT
//  "/api/users/logout", "New router /api/auth".
//

import Foundation
import LocalAuthentication
import Logging

/// Errors from the step-up flow (`AuthManager.stepUp(purpose:)`).
public enum StepUpError: Error, Equatable, Sendable {
    /// Neither method is possible right now (no enrolled key, no password
    /// prompt wired, or the server offers no method the client has).
    case unavailable
    /// The user dismissed the presence / password prompt.
    case cancelled
    /// The password was refused.
    case invalidPassword
    /// Too many attempts (`stepUpLimiter`).
    case rateLimited
    case network
    case server(String)
}

extension AuthManager {
    // MARK: - Device identity

    /// The stored device id, if an identity exists. Cheap; never creates.
    var deviceId: String? {
        currentDeviceIdentity()?.deviceId
    }

    /// The stored identity, loaded once and cached. Never creates one —
    /// keys are minted only by the credential-issuing / restore paths.
    func currentDeviceIdentity() -> DeviceIdentity? {
        if let deviceIdentity { return deviceIdentity }
        deviceIdentity = DeviceIdentity.load(from: store)
        return deviceIdentity
    }

    /// The identity, minting a new `deviceId` + key when none is usable.
    /// Nil only if key generation itself fails (logged, non-fatal: the
    /// client then behaves like a legacy one and the server keeps working
    /// while `AUTH_DEVICE_BINDING != required`).
    @discardableResult
    func ensureDeviceIdentity() -> DeviceIdentity? {
        if let existing = currentDeviceIdentity() { return existing }
        do {
            let identity = try DeviceIdentity.regenerate(in: store, allowSecureEnclave: allowSecureEnclave)
            deviceIdentity = identity
            // A new key means any step-up key enrolment on the server was
            // for a different device row.
            try? store.delete(SecureStoreKey.stepUpKeyEnrolledUserId)
            logger.info("Device identity created", metadata: ["backing": .string(identity.key.backing.rawValue)])
            return identity
        } catch {
            logger.error("Device key creation failed", metadata: ["error": .string("\(error)")])
            Observability.shared.capture(error)
            return nil
        }
    }

    /// Descriptor for the credential-issuing routes. Ensures an identity
    /// exists and remembers the install id it advertised so
    /// `persistLoginResponse` can commit exactly that id on success.
    func makeDeviceDescriptor() -> DeviceDescriptor? {
        guard let identity = ensureDeviceIdentity() else { return nil }
        let installId = pendingInstallId ?? installMarker.installIdForDescriptor(store: store)
        pendingInstallId = installId
        return DeviceDescriptor.current(deviceId: identity.deviceId, installId: installId, keyBacking: identity.key.backing)
    }

    /// DPoP proof for `APIClient` (endpoints flagged `requiresDPoP`). Nil
    /// when no identity exists — the request then goes out unbound.
    func dpopProof(method: String, url: URL) -> String? {
        guard let identity = currentDeviceIdentity() else { return nil }
        do {
            return try DPoPProofBuilder.build(signer: identity.key, method: method, url: url, now: now())
        } catch {
            logger.error("DPoP proof failed", metadata: ["error": .string("\(error)")])
            return nil
        }
    }

    /// `[DPoP: <proof>]` with `rth` for the refresh / logout bodies, or an
    /// empty dictionary when there is no key to sign with.
    func dpopHeaders(for path: String, method: String, refreshToken: String?, identity: DeviceIdentity?) -> [String: String] {
        guard let identity else { return [:] }
        do {
            let proof = try DPoPProofBuilder.build(
                signer: identity.key,
                method: method,
                url: apiClient.url(forPath: path),
                refreshToken: refreshToken,
                now: now()
            )
            return [APIClient.dpopHeader: proof]
        } catch {
            logger.error("DPoP proof failed", metadata: ["path": .string(path), "error": .string("\(error)")])
            return [:]
        }
    }

    // MARK: - Device registration

    /// Kick `POST /api/auth/devices/register` in the background (after
    /// login / resume / app update / push-token change). Optionally enrols
    /// the biometry-bound step-up key afterwards (interactive login only).
    func scheduleDeviceRegistration(enrolStepUpKey: Bool, onlyIfAppUpdated: Bool = false) {
        if onlyIfAppUpdated, store.get(SecureStoreKey.registeredAppVersion) == DeviceDescriptor.appVersion {
            return
        }
        registerDeviceTask?.cancel()
        registerDeviceTask = Task { [weak self] in
            guard let self else { return }
            await registerDevice()
            if enrolStepUpKey, !Task.isCancelled {
                await enrolStepUpKeyIfNeeded()
            }
        }
    }

    /// `POST /api/auth/devices/register` — metadata + push-token linkage.
    /// Never creates a binding (server invariant); a 409
    /// `DEVICE_NOT_BOUND` for a legacy session is expected and logged.
    func registerDevice() async {
        guard case .signedIn = state, let identity = currentDeviceIdentity() else { return }
        let descriptor = DeviceDescriptor.current(
            deviceId: identity.deviceId,
            installId: installMarker.installIdForDescriptor(store: store),
            keyBacking: identity.key.backing
        )
        do {
            let response: RegisterDeviceResponse = try await apiClient.request(
                AuthEndpoints.registerDevice(RegisterDeviceRequest(device: descriptor, pushToken: pendingPushToken))
            )
            try? store.set(DeviceDescriptor.appVersion, for: SecureStoreKey.registeredAppVersion)
            logger.info(
                "Device registered",
                metadata: ["trust": .string(response.device?.trustLevel ?? "unknown")]
            )
        } catch {
            logger.warning("Device registration failed", metadata: ["error": .string("\(error)")])
        }
    }

    /// APNs token arrived / rotated: remember it and re-register so the
    /// backend links `PushToken.device_id`.
    func pushTokenDidChange(_ token: String) async {
        guard pendingPushToken != token else { return }
        pendingPushToken = token
        guard case .signedIn = state else { return }
        await registerDevice()
    }

    /// Await the fire-and-forget follow-ups (tests, and callers that need
    /// the registration to have landed).
    func awaitBackgroundWork() async {
        await registerDeviceTask?.value
        await logoutTask?.value
    }

    // MARK: - Step-up key enrolment

    /// After an interactive login on Secure Enclave hardware with an OS
    /// lock: create the biometry-bound key (silent — creation never prompts)
    /// and enrol its public half via `POST /api/auth/step-up-key`. Skipped
    /// for `restored` sessions and when already enrolled for this user.
    func enrolStepUpKeyIfNeeded() async {
        guard allowSecureEnclave, StepUpKey.isSupported, DeviceDescriptor.hasOsLock,
              case let .signedIn(user) = state,
              sessionContext != .restored,
              store.get(SecureStoreKey.stepUpKeyEnrolledUserId) != user.id else { return }
        let info: StepUpKey.PublicInfo
        do {
            info = try StepUpKey.exists(in: store) ? StepUpKey.publicInfo(in: store) : StepUpKey.create(in: store)
        } catch StepUpKeyError.invalidated {
            guard let recreated = try? StepUpKey.create(in: store) else { return }
            info = recreated
        } catch {
            logger.info("Step-up key unavailable", metadata: ["error": .string("\(error)")])
            return
        }
        do {
            _ = try await apiClient.request(
                AuthEndpoints.enrolStepUpKey(StepUpKeyRequest(publicKeyJwk: info.jwk, keyBacking: info.keyBacking)),
                as: AuthOkResponse.self
            )
            try? store.set(user.id, for: SecureStoreKey.stepUpKeyEnrolledUserId)
            logger.info("Step-up key enrolled", metadata: ["policy": .string(info.policy.rawValue)])
        } catch {
            logger.warning("Step-up key enrolment failed", metadata: ["error": .string("\(error)")])
        }
    }

    /// Whether the `device_key` step-up method can be used right now:
    /// enrolled for this user (interactively — the only way iOS enrols)
    /// and the session is interactive.
    var canStepUpWithDeviceKey: Bool {
        guard case let .signedIn(user) = state, sessionContext != .restored else { return false }
        return StepUpKey.exists(in: store) && store.get(SecureStoreKey.stepUpKeyEnrolledUserId) == user.id
    }

    // MARK: - Step-up

    /// Interceptor hook (`APIClient` on 403 `STEP_UP_REQUIRED`): returns a
    /// token or nil when step-up is impossible / cancelled.
    func obtainStepUpToken(purpose: String?, methods: [String]) async -> String? {
        let resolved = purpose.flatMap(StepUpPurpose.init(rawValue:)) ?? .generic
        do {
            return try await stepUp(purpose: resolved, methods: methods)
        } catch {
            logger.info("Step-up not completed", metadata: ["error": .string("\(error)")])
            return nil
        }
    }

    /// Obtain an `X-Step-Up` token for `purpose`: `device_key` (Face ID /
    /// Touch ID / passcode over a server challenge) when enrolled and the
    /// server allows it, else the password prompt. `methods` narrows what
    /// the server accepts (empty ⇒ anything). The wildcard `generic`
    /// purpose is password-only by contract (only `/reauthenticate` mints
    /// it), so the biometric path is skipped for it.
    func stepUp(purpose: StepUpPurpose, methods: [String] = []) async throws -> String {
        let serverAllowsDeviceKey = methods.isEmpty || methods.contains(StepUpMethod.deviceKey.rawValue)
        let serverAllowsPassword = methods.isEmpty || methods.contains(StepUpMethod.password.rawValue)
        if serverAllowsDeviceKey, purpose != .generic, canStepUpWithDeviceKey {
            do {
                return try await stepUpWithDeviceKey(purpose: purpose)
            } catch StepUpKeyError.cancelled {
                throw StepUpError.cancelled
            } catch StepUpKeyError.invalidated, StepUpKeyError.notEnrolled {
                // Biometric re-enrolment (or a lost blob): drop the key and
                // fall through to the password method.
                StepUpKey.delete(from: store)
                logger.info("Step-up key invalidated — falling back to password")
            } catch StepUpError.unavailable {
                // The server refused the method for this session (e.g. it
                // was downgraded to `restored`, or the enrolment is gone
                // server-side): password is the remaining option.
                logger.info("Device-key step-up refused by server — falling back to password")
            } catch let error as StepUpError {
                throw error
            } catch {
                logger.warning("Device-key step-up failed", metadata: ["error": .string("\(error)")])
            }
        }
        guard serverAllowsPassword, let prompt = stepUpPasswordPrompt else { throw StepUpError.unavailable }
        guard let password = await prompt(purpose) else { throw StepUpError.cancelled }
        return try await stepUpWithPassword(password, purpose: purpose)
    }

    /// `POST /api/auth/challenge {step_up}` → sign the raw challenge bytes
    /// with the step-up key → `POST /api/auth/step-up {device_key}`.
    func stepUpWithDeviceKey(purpose: StepUpPurpose) async throws -> String {
        let challenge: AuthChallengeResponse
        do {
            challenge = try await apiClient.request(AuthEndpoints.challenge(purpose: .stepUp))
        } catch let error as APIError {
            throw Self.mapStepUpError(error)
        }
        guard let bytes = Base64URL.decode(challenge.challenge) else {
            throw StepUpError.server("Malformed challenge")
        }
        let signature = try await StepUpKey.sign(bytes, reason: Self.stepUpReason(for: purpose), in: store)
        do {
            let response: StepUpResponse = try await apiClient.request(
                AuthEndpoints.stepUp(
                    .deviceKey(challengeId: challenge.challengeId, signature: Base64URL.encode(signature), purpose: purpose)
                )
            )
            Observability.shared.track("auth.stepup.ok", properties: ["method": "device_key"])
            return response.stepUpToken
        } catch let error as APIError {
            Observability.shared.track("auth.stepup.fail", properties: ["method": "device_key"])
            throw Self.mapStepUpError(error)
        }
    }

    /// `POST /api/auth/step-up {password}`.
    func stepUpWithPassword(_ password: String, purpose: StepUpPurpose) async throws -> String {
        do {
            let response: StepUpResponse = try await apiClient.request(
                AuthEndpoints.stepUp(.password(password, purpose: purpose))
            )
            Observability.shared.track("auth.stepup.ok", properties: ["method": "password"])
            return response.stepUpToken
        } catch let error as APIError {
            Observability.shared.track("auth.stepup.fail", properties: ["method": "password"])
            throw Self.mapStepUpError(error)
        }
    }

    /// `POST /api/users/reauthenticate` (route `backend/routes/users.js:1772`)
    /// — password re-check that also mints a wildcard step-up token.
    func reauthenticate(password: String) async throws -> ReauthenticateResponse {
        do {
            return try await apiClient.request(AuthEndpoints.reauthenticate(password: password))
        } catch let error as APIError {
            throw Self.mapStepUpError(error)
        }
    }

    static func stepUpReason(for purpose: StepUpPurpose) -> String {
        switch purpose {
        case .deleteAccount: "Confirm it's you to delete your account"
        case .revokeDevice: "Confirm it's you to remove a device"
        case .revokeSessions: "Confirm it's you to sign out other devices"
        case .changeSecurityPrefs: "Confirm it's you to change security settings"
        case .generic: "Confirm it's you"
        }
    }

    static func mapStepUpError(_ error: APIError) -> StepUpError {
        switch error {
        case .unauthorized: .invalidPassword
        case .forbidden: .unavailable
        case let .clientError(status, message):
            status == 429 ? .rateLimited : .server(APIError.friendlyClientMessage(message) ?? "Verification failed.")
        case .transport: .network
        case let .server(status, _): .server("Server error \(status).")
        default: .server(error.localizedDescription)
        }
    }

    // MARK: - Sign out (scoped)

    /// Sign out with a scope (`POST /api/users/logout`, route
    /// `backend/routes/users.js:4708`):
    ///
    /// - `.local`: wipe this device's session now (hint kept), then tell the
    ///   server with proof — Bearer + `refreshToken` + DPoP `rth` — so it can
    ///   revoke the session row, clear the binding and drop this device's
    ///   push tokens. Best-effort and never throws.
    /// - `.others` / `.global`: Bearer + `X-Step-Up` (`revoke_sessions`).
    ///   Throws on failure. `.global` also wipes the local session.
    @discardableResult
    func signOut(scope: LogoutScope, stepUpToken: String? = nil) async throws -> LogoutResponse? {
        switch scope {
        case .local:
            let access = accessToken ?? store.get(SecureStoreKey.accessToken)
            let refresh = nonEmpty(store.get(SecureStoreKey.refreshToken))
            let hadSession = clearLocalSession()
            if hadSession {
                Observability.shared.track("auth.signed_out", properties: ["scope": "local"])
            }
            guard access != nil || refresh != nil else { return nil }
            scheduleLocalLogout(accessToken: access, refreshToken: refresh)
            await logoutTask?.value
            return nil
        case .others, .global:
            var headers: [String: String] = [:]
            if let stepUpToken {
                headers[APIClient.stepUpHeader] = stepUpToken
            }
            if let access = accessToken {
                headers["Authorization"] = "Bearer \(access)"
            }
            let response: LogoutResponse = try await apiClient.request(
                AuthEndpoints.logout(LogoutRequest(scope: scope, deviceId: deviceId, refreshToken: nil), headers: headers)
            )
            Observability.shared.track("auth.signed_out", properties: ["scope": scope.rawValue])
            if scope == .global {
                clearLocalSession()
            }
            return response
        }
    }

    /// Fire the local logout for a (possibly already superseded) session in
    /// the background, with whatever proof exists.
    func scheduleLocalLogout(accessToken: String?, refreshToken: String?) {
        let identity = currentDeviceIdentity()
        var headers = dpopHeaders(for: "/api/users/logout", method: "POST", refreshToken: refreshToken, identity: identity)
        if let accessToken, !accessToken.isEmpty {
            headers["Authorization"] = "Bearer \(accessToken)"
        }
        let endpoint = AuthEndpoints.logout(
            LogoutRequest(scope: .local, deviceId: identity?.deviceId, refreshToken: refreshToken),
            headers: headers
        )
        let previous = logoutTask
        logoutTask = Task { [weak self] in
            await previous?.value
            guard let self else { return }
            do {
                let raw = try await apiClient.sendRaw(endpoint)
                logger.info("Logout acknowledged", metadata: ["status": .string("\(raw.status)")])
            } catch {
                logger.warning("Logout call failed", metadata: ["error": .string("\(error)")])
            }
        }
    }

    // MARK: - Remembered accounts

    /// The display hints, most recent first (for the login / Continue-as UI).
    var rememberedAccounts: [AccountHint] {
        AccountHintStore.load(from: store)
    }

    /// "Not you? Remove": forget the account on this device. If its tokens
    /// are still stored (the `.resumable` case) they are revoked with proof
    /// and wiped; the hint is deleted; a step-up key enrolled for that user
    /// is forgotten. Ends in `.signedOut`.
    func removeRememberedAccount(userId: String? = nil) async {
        let target = userId ?? {
            if case let .resumable(hint) = state { return hint.userId }
            return AccountHintStore.mostRecent(in: store)?.userId
        }()
        let storedUserId = store.get(SecureStoreKey.userId)
        if let target, storedUserId == target || storedUserId == nil {
            _ = try? await signOut(scope: .local)
        }
        if let target {
            AccountHintStore.remove(userId: target, from: store)
            if store.get(SecureStoreKey.stepUpKeyEnrolledUserId) == target {
                try? store.delete(SecureStoreKey.stepUpKeyEnrolledUserId)
            }
        } else {
            AccountHintStore.clear(store)
        }
        Observability.shared.track("session_hint_removed")
        if case .signedIn = state { return }
        setState(.signedOut)
    }
}
