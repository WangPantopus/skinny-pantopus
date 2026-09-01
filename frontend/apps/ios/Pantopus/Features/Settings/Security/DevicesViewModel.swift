//
//  DevicesViewModel.swift
//  Pantopus
//
//  Settings → Security & devices (design §7.6, §7.7, §8; CONTRACT "New
//  router /api/auth"). Lists the trusted-device registry (`GET
//  /api/auth/devices`: devices with the current one pinned, web sessions,
//  recent security events) plus the account's security preferences, and
//  drives the step-up-gated mutations:
//
//   - Remove a device      → step-up `revoke_device`        → `DELETE /api/auth/devices/:id`
//   - Sign out other devices → step-up `revoke_sessions`    → `POST /api/auth/sessions/revoke-others`
//   - Lockdown             → step-up `revoke_sessions`      → `POST /api/auth/sessions/revoke-all` + local sign-out
//   - Toggle a preference  → step-up `change_security_prefs` → `PATCH /api/auth/security-prefs`
//
//  Step-up itself is `AuthManager.stepUp(purpose:)` (biometry-bound device
//  key when enrolled and the session is interactive, else the password
//  sheet). The token is sent up front as `X-Step-Up`; if the server still
//  answers 403 `STEP_UP_REQUIRED` the APIClient interceptor runs one more
//  round and replays. Mirrors Android `DevicesViewModel`.
//

// swiftlint:disable file_length type_body_length

import Foundation
import Observation

@Observable
@MainActor
public final class DevicesViewModel {
    /// Everything the screen renders once the registry loaded.
    public struct Content: Sendable, Equatable {
        /// Current device first, then by last seen (server order).
        public var devices: [AuthDeviceDTO]
        /// Non-device (web) sessions, current first.
        public var sessions: [AuthSessionDTO]
        /// Most recent security events, newest first.
        public var events: [AuthSecurityEventDTO]
        /// `nil` when `GET /api/auth/security-prefs` failed — the toggles
        /// render disabled with a "couldn't load" helper.
        public var prefs: SecurityPrefs?

        public var currentDevice: AuthDeviceDTO? {
            devices.first { $0.isCurrent == true }
        }

        public var otherDevices: [AuthDeviceDTO] {
            devices.filter { $0.isCurrent != true }
        }

        /// Anything to sign out besides this device.
        public var hasOtherSessions: Bool {
            !otherDevices.isEmpty || sessions.contains { $0.isCurrent != true }
        }
    }

    public enum State: Sendable, Equatable {
        case loading
        /// No registered devices and no web sessions (a legacy, unbound
        /// session). Actions + preferences still render from `Content`.
        case empty(Content)
        case loaded(Content)
        case error(message: String)
    }

    public private(set) var state: State = .loading
    public var toast: ToastMessage?

    /// Device row id with a revocation in flight (row shows a spinner).
    public private(set) var revokingDeviceId: String?
    public private(set) var isSigningOutOthers = false
    public private(set) var isLockingDown = false
    public private(set) var isSavingPrefs = false

    /// Confirmation dialogs driven from the view.
    public var deviceToRemove: AuthDeviceDTO?
    public var isSignOutOthersConfirmPresented = false
    public var isLockdownConfirmPresented = false

    private let api: APIClient
    private let auth: AuthManager
    /// Obtains an `X-Step-Up` token for a purpose. Defaults to
    /// `AuthManager.stepUp(purpose:)`; tests substitute a closure.
    @ObservationIgnored
    var stepUpProvider: @MainActor (StepUpPurpose) async throws -> String
    /// Injectable clock (step-up token reuse window).
    @ObservationIgnored
    var now: @Sendable () -> Date = { Date() }

    /// `change_security_prefs` tokens are not one-shot (CONTRACT), so one
    /// prompt covers a burst of toggles for the token's lifetime.
    private var prefsStepUp: (token: String, mintedAt: Date)?
    /// Reuse a prefs token for at most this long (server lifetime is 5 min).
    static let prefsStepUpReuseWindow: TimeInterval = 4 * 60

    init(api: APIClient = .shared, auth: AuthManager = .shared) {
        self.api = api
        self.auth = auth
        stepUpProvider = { [auth] purpose in
            try await auth.stepUp(purpose: purpose)
        }
    }

    // MARK: - Load

    public func load() async {
        if case .error = state {
            state = .loading
        }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    /// `GET /api/auth/devices` + `GET /api/auth/security-prefs` (the latter
    /// best-effort — a failure only disables the toggles).
    private func fetch() async {
        async let pendingPrefs = fetchPrefs()
        do {
            let registry: AuthDevicesResponse = try await api.request(AuthEndpoints.devices)
            let prefs = await pendingPrefs
            publish(
                Content(
                    devices: Self.pinCurrent(registry.devices),
                    sessions: Self.pinCurrent(registry.sessions),
                    events: registry.events,
                    prefs: prefs
                )
            )
        } catch {
            _ = await pendingPrefs
            // Keep stale content visible on a refresh failure; only a first
            // load (nothing to show) lands on the error state.
            if case .loading = state {
                state = .error(message: Self.message(for: error, fallback: "We couldn't load your devices."))
            } else {
                toast = ToastMessage(text: Self.message(for: error, fallback: "Couldn't refresh devices."), kind: .error)
            }
        }
    }

    private func fetchPrefs() async -> SecurityPrefs? {
        try? await api.request(AuthEndpoints.securityPrefs)
    }

    /// The current device / session first, everything else in server
    /// order (already newest-first).
    static func pinCurrent(_ devices: [AuthDeviceDTO]) -> [AuthDeviceDTO] {
        devices.filter { $0.isCurrent == true } + devices.filter { $0.isCurrent != true }
    }

    static func pinCurrent(_ sessions: [AuthSessionDTO]) -> [AuthSessionDTO] {
        sessions.filter { $0.isCurrent == true } + sessions.filter { $0.isCurrent != true }
    }

    private var content: Content? {
        switch state {
        case let .loaded(content), let .empty(content): content
        case .loading, .error: nil
        }
    }

    private func publish(_ content: Content) {
        state = content.devices.isEmpty && content.sessions.isEmpty ? .empty(content) : .loaded(content)
    }

    // MARK: - Remove a device

    /// Swipe / Remove on a device row — asks for confirmation first.
    public func requestRemove(_ device: AuthDeviceDTO) {
        guard device.isCurrent != true, revokingDeviceId == nil else { return }
        deviceToRemove = device
    }

    /// Confirmed: step-up (`revoke_device`) → `DELETE /api/auth/devices/:id`
    /// → reload. The current device is never removable from here (use
    /// Log out), which the view enforces too.
    public func removeDevice(_ device: AuthDeviceDTO) async {
        deviceToRemove = nil
        guard device.isCurrent != true, revokingDeviceId == nil else { return }
        revokingDeviceId = device.id
        defer { revokingDeviceId = nil }
        guard let token = await obtainStepUp(.revokeDevice) else { return }
        do {
            _ = try await api.request(AuthEndpoints.revokeDevice(id: device.id, stepUpToken: token), as: AuthOkResponse.self)
            Observability.shared.track("auth.device.revoked")
            toast = ToastMessage(text: "\(Self.displayName(for: device)) was signed out.", kind: .success)
            if var content {
                content.devices.removeAll { $0.id == device.id }
                content.events.insert(Self.localEvent(type: "device_revoked", deviceId: device.deviceId, at: now()), at: 0)
                publish(content)
            }
            await fetch()
        } catch {
            toast = ToastMessage(text: Self.message(for: error, fallback: "Couldn't remove that device."), kind: .error)
        }
    }

    // MARK: - Sign out others / Lockdown

    /// "Sign out of all other devices": step-up (`revoke_sessions`) →
    /// `POST /api/auth/sessions/revoke-others`.
    public func signOutOtherDevices() async {
        isSignOutOthersConfirmPresented = false
        guard !isSigningOutOthers else { return }
        isSigningOutOthers = true
        defer { isSigningOutOthers = false }
        guard let token = await obtainStepUp(.revokeSessions) else { return }
        do {
            let response: RevokeOthersResponse = try await api.request(AuthEndpoints.revokeOtherSessions(stepUpToken: token))
            let count = response.revoked ?? 0
            Observability.shared.track("auth.sessions.revoked_others", properties: ["count": String(count)])
            toast = ToastMessage(
                text: count == 0
                    ? "No other devices were signed in."
                    : "Signed out of \(count) other \(count == 1 ? "session" : "sessions").",
                kind: .success
            )
            await fetch()
        } catch {
            toast = ToastMessage(text: Self.message(for: error, fallback: "Couldn't sign out other devices."), kind: .error)
        }
    }

    /// "Lockdown": step-up (`revoke_sessions`) → `POST
    /// /api/auth/sessions/revoke-all` → this device signs itself out too.
    public func lockdown() async {
        isLockdownConfirmPresented = false
        guard !isLockingDown else { return }
        isLockingDown = true
        defer { isLockingDown = false }
        guard let token = await obtainStepUp(.revokeSessions) else { return }
        do {
            _ = try await api.request(AuthEndpoints.revokeAllSessions(stepUpToken: token), as: AuthOkResponse.self)
            Observability.shared.track("auth.sessions.lockdown")
            await auth.signOut()
        } catch {
            toast = ToastMessage(text: Self.message(for: error, fallback: "Couldn't sign out everywhere."), kind: .error)
        }
    }

    // MARK: - Security preferences

    public func setAllowRestoreGrants(_ isOn: Bool) async {
        await patchPrefs(SecurityPrefs(allowRestoreGrants: isOn, newDeviceEmail: nil))
    }

    public func setNewDeviceEmail(_ isOn: Bool) async {
        await patchPrefs(SecurityPrefs(allowRestoreGrants: nil, newDeviceEmail: isOn))
    }

    /// Optimistic toggle; step-up (`change_security_prefs`, reused within
    /// its lifetime) → `PATCH /api/auth/security-prefs` with only the
    /// changed key (the Joi schema rejects unknown keys and needs ≥ 1);
    /// rolled back with a toast on failure / cancel.
    private func patchPrefs(_ patch: SecurityPrefs) async {
        guard var content, let previous = content.prefs, !isSavingPrefs else { return }
        isSavingPrefs = true
        defer { isSavingPrefs = false }
        content.prefs = Self.merge(previous, patch)
        publish(content)
        guard let token = await obtainStepUp(.changeSecurityPrefs) else {
            rollbackPrefs(previous)
            return
        }
        do {
            let saved: SecurityPrefs = try await api.request(AuthEndpoints.updateSecurityPrefs(patch, stepUpToken: token))
            if var latest = self.content {
                latest.prefs = Self.merge(Self.merge(previous, patch), saved)
                latest.events.insert(Self.localEvent(type: "security_prefs_changed", deviceId: nil, at: now()), at: 0)
                publish(latest)
            }
            toast = ToastMessage(text: "Security settings updated.", kind: .success)
        } catch {
            prefsStepUp = nil
            rollbackPrefs(previous)
            toast = ToastMessage(text: Self.message(for: error, fallback: "Couldn't save that setting."), kind: .error)
        }
    }

    private func rollbackPrefs(_ previous: SecurityPrefs) {
        guard var content else { return }
        content.prefs = previous
        publish(content)
    }

    /// Server echoes the full prefs object; `nil` fields fall back to what
    /// we already had.
    static func merge(_ base: SecurityPrefs, _ patch: SecurityPrefs) -> SecurityPrefs {
        SecurityPrefs(
            allowRestoreGrants: patch.allowRestoreGrants ?? base.allowRestoreGrants,
            newDeviceEmail: patch.newDeviceEmail ?? base.newDeviceEmail
        )
    }

    // MARK: - Step-up

    /// Obtain the `X-Step-Up` token, surfacing failures as a toast (a user
    /// cancel is silent). `change_security_prefs` tokens are reused within
    /// their lifetime.
    private func obtainStepUp(_ purpose: StepUpPurpose) async -> String? {
        if purpose == .changeSecurityPrefs, let cached = prefsStepUp,
           now().timeIntervalSince(cached.mintedAt) < Self.prefsStepUpReuseWindow {
            return cached.token
        }
        do {
            let token = try await stepUpProvider(purpose)
            if purpose == .changeSecurityPrefs {
                prefsStepUp = (token, now())
            }
            return token
        } catch let error as StepUpError {
            if let text = Self.message(forStepUp: error) {
                toast = ToastMessage(text: text, kind: .error)
            }
            return nil
        } catch {
            toast = ToastMessage(text: Self.message(for: error, fallback: "Couldn't verify it's you."), kind: .error)
            return nil
        }
    }

    /// Copy for a failed step-up; `nil` for a user cancel.
    static func message(forStepUp error: StepUpError) -> String? {
        switch error {
        case .cancelled: nil
        case .invalidPassword: "Incorrect password. Try again."
        case .rateLimited: "Too many attempts. Try again in a few minutes."
        case .unavailable: "We couldn't verify it's you on this device. Sign in again with your password and retry."
        case .network: "Can't reach Pantopus. Check your connection and try again."
        case let .server(message): message
        }
    }

    /// Server-supplied copy when there is one, else `fallback`.
    static func message(for error: any Error, fallback: String) -> String {
        if let stepUp = error as? StepUpError {
            return message(forStepUp: stepUp) ?? fallback
        }
        guard let apiError = error as? APIError else { return fallback }
        switch apiError {
        case .forbidden:
            return "Verification required. Confirm it's you and try again."
        case let .clientError(_, message):
            return APIError.friendlyClientMessage(message) ?? fallback
        case .transport:
            return "Can't reach Pantopus. Check your connection and try again."
        default:
            return apiError.errorDescription ?? fallback
        }
    }

    // MARK: - Presentation helpers (shared with the view + tests)

    /// "Ying's iPhone" → name, else model, else platform.
    static func displayName(for device: AuthDeviceDTO) -> String {
        if let name = device.name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
            return name
        }
        if let model = device.model, !model.isEmpty {
            return model
        }
        return platformLabel(device.platform)
    }

    /// "iPhone16,2 · iOS 18.5 · Pantopus 1.4.0 (312)" — whatever is known.
    static func detailLine(for device: AuthDeviceDTO) -> String {
        var parts: [String] = []
        if let model = device.model, !model.isEmpty, model != device.name {
            parts.append(model)
        }
        if let os = device.osVersion, !os.isEmpty {
            parts.append("\(osName(device.platform)) \(os)")
        }
        if let app = device.appVersion, !app.isEmpty {
            parts.append("Pantopus \(app)")
        }
        return parts.joined(separator: " · ")
    }

    static func platformLabel(_ platform: String?) -> String {
        switch platform?.lowercased() {
        case "ios": "iPhone"
        case "android": "Android"
        case "web": "Web"
        default: platform?.capitalized ?? "Device"
        }
    }

    static func osName(_ platform: String?) -> String {
        switch platform?.lowercased() {
        case "ios": "iOS"
        case "android": "Android"
        default: ""
        }
    }

    /// "Active now" for the current row, else a relative last-seen.
    static func lastSeenLabel(for device: AuthDeviceDTO, now: Date = Date()) -> String {
        if device.isCurrent == true { return "This device · active now" }
        guard let seen = device.lastSeenAt?.date else { return "Last active: unknown" }
        return "Last active \(relative(seen, now: now))"
    }

    static func lastSeenLabel(for session: AuthSessionDTO, now: Date = Date()) -> String {
        if session.isCurrent == true { return "This session · active now" }
        guard let seen = (session.lastSeenAt ?? session.issuedAt)?.date else { return "Last active: unknown" }
        return "Last active \(relative(seen, now: now))"
    }

    /// Browser families we can name from a user agent, most specific first
    /// (Edge and Opera both claim `Chrome/`, Chrome claims `Safari/`).
    private static let browserSignatures: [(needles: [String], name: String)] = [
        (["Edg/"], "Edge"),
        (["OPR/"], "Opera"),
        (["Firefox/"], "Firefox"),
        (["Chrome/", "CriOS/"], "Chrome"),
        (["Safari/"], "Safari")
    ]

    private static let osSignatures: [(needles: [String], name: String)] = [
        (["iPhone", "iPad"], "iOS"),
        (["Android"], "Android"),
        (["Mac OS X", "Macintosh"], "macOS"),
        (["Windows"], "Windows"),
        (["Linux"], "Linux")
    ]

    private static func match(_ userAgent: String, in signatures: [(needles: [String], name: String)]) -> String? {
        signatures.first { $0.needles.contains { userAgent.contains($0) } }?.name
    }

    /// "Chrome on macOS" from a user agent, best-effort.
    static func sessionTitle(for session: AuthSessionDTO) -> String {
        let userAgent = session.userAgent ?? ""
        let browser = match(userAgent, in: browserSignatures)
        let os = match(userAgent, in: osSignatures)
        switch (browser, os) {
        case let (browser?, os?): return "\(browser) on \(os)"
        case let (browser?, nil): return browser
        case let (nil, os?): return "Web on \(os)"
        default: return platformLabel(session.platform ?? "web")
        }
    }

    static func relative(_ date: Date, now: Date) -> String {
        let seconds = now.timeIntervalSince(date)
        if seconds < 60 { return "just now" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: now)
    }

    /// Trust badge copy + tone.
    public enum TrustTone: Sendable, Equatable {
        case trusted, unverified, suspect, unknown
    }

    static func trustTone(_ level: String?) -> TrustTone {
        switch level?.lowercased() {
        case "trusted": .trusted
        case "unverified": .unverified
        case "suspect": .suspect
        default: .unknown
        }
    }

    static func trustLabel(_ level: String?) -> String {
        switch trustTone(level) {
        case .trusted: "Trusted"
        case .unverified: "Unverified"
        case .suspect: "Suspicious"
        case .unknown: "Unknown"
        }
    }

    /// `AuthSecurityEvent.type` → human label. The keys are the COMPLETE
    /// vocabulary the backend writes (`authSessionService.recordSecurityEvent`
    /// call sites in `authDeviceService.js`, `authNotifyService.js`,
    /// `routes/authDevices.js`, `routes/users.js`); keep in sync with Android
    /// `DevicesViewModel.EVENT_LABELS` and web `securityActivity.ts`. Unknown
    /// types fall back to a title-cased version of the raw type so a new
    /// server event still reads sensibly.
    static let eventTitles: [String: String] = [
        "login": "Signed in",
        "logout": "Signed out",
        "resume": "Session restored",
        "refresh_reuse": "Token reuse blocked",
        "device_mismatch": "Device mismatch blocked",
        "device_revoked": "Device removed",
        "session_revoked": "Session revoked",
        "inactivity_expired": "Session expired after inactivity",
        "step_up": "Identity confirmed",
        "step_up_key_enrolled": "Biometric key enrolled",
        "security_prefs_changed": "Security settings changed",
        "revoke_others": "Signed out other devices",
        "lockdown": "Signed out everywhere",
        "password_changed": "Password changed",
        "password_reset": "Password reset",
        "account_deleted": "Account deleted",
        "new_device_email_sent": "New sign-in email sent",
        "device_removed_email_sent": "Device-removed email sent",
        "password_changed_email_sent": "Password-changed email sent",
        "security_signout_email_sent": "Security sign-out email sent",
        "lockdown_email_sent": "Signed-out-everywhere email sent"
    ]

    /// Human label for a security-event `type`.
    static func eventTitle(_ type: String) -> String {
        eventTitles[type] ?? type.replacingOccurrences(of: "_", with: " ").capitalized
    }

    /// Events that warrant the warning tint on the timeline.
    static func isSecurityEvent(_ type: String) -> Bool {
        ["refresh_reuse", "device_mismatch", "device_revoked", "session_revoked", "lockdown", "password_reset"]
            .contains(type)
    }

    /// Secondary line: device name / platform from `meta` when present.
    static func eventDetail(_ event: AuthSecurityEventDTO, devices: [AuthDeviceDTO]) -> String? {
        if let name = event.meta?["name"], !name.isEmpty { return name }
        if let deviceId = event.deviceId,
           let device = devices.first(where: { $0.id == deviceId || $0.deviceId == deviceId }) {
            return displayName(for: device)
        }
        if let platform = event.meta?["platform"], !platform.isEmpty { return platformLabel(platform) }
        return nil
    }

    /// A synthetic timeline entry for an action just taken on this screen
    /// (replaced by the server's row on the next fetch).
    static func localEvent(type: String, deviceId: String?, at date: Date) -> AuthSecurityEventDTO {
        AuthSecurityEventDTO(
            id: "local-\(UUID().uuidString)",
            type: type,
            createdAt: LenientTimestamp(date: date),
            deviceId: deviceId,
            meta: nil
        )
    }
}
