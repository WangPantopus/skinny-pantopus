// swiftlint:disable file_length

import LocalAuthentication
import Observation
import SwiftUI
import UIKit

public enum AppLockCapability: String, Sendable {
    case available
    case notAvailable = "not_available"
    case notEnrolled = "not_enrolled"
    case passcodeNotSet = "passcode_not_set"
    case invalidContext = "invalid_context"

    public var statusText: String {
        switch self {
        case .available: "Available"
        case .notAvailable: "Not available on this device"
        case .notEnrolled: "No biometrics enrolled"
        case .passcodeNotSet: "Device passcode not set"
        case .invalidContext: "Authentication unavailable"
        }
    }
}

/// Per-user answer to the one-time "turn on app lock?" offer made after an
/// interactive sign-in. Persisted so the offer is made exactly once per
/// account, never on every launch. Mirrors RN's
/// `AppLockSetupPromptState` (`src/lib/biometrics.ts:10`) and the Android
/// `AppLockManager.SetupPromptState`.
public enum AppLockSetupPromptState: String, Sendable {
    /// Never answered — the prompt is still owed.
    case pending
    /// The user said "Not Now" (or the attempt failed) — never ask again.
    case declined
    /// App lock is on; nothing left to offer.
    case enabled
}

/// Which surface asked to enable app lock. Only the post-login offer
/// records a `declined` answer when the user backs out — turning the
/// preference on from Settings and cancelling the biometric sheet must not
/// burn the one-time prompt. Mirrors RN's `enableAppLock(source)`
/// (`src/contexts/AppLockContext.tsx:118`).
public enum AppLockEnableSource: Sendable {
    case settings
    case postLoginPrompt
}

/// Outcome of a one-shot re-auth gate in front of an irreversible action
/// (account deletion today). Mirrors the RN `useSensitiveActionGuard`
/// contract and the Android `AppLockManager.SensitiveActionOutcome`.
public enum SensitiveActionOutcome: Sendable, Equatable {
    /// Identity confirmed — or the device carries no credential to check
    /// against, which RN also treats as a pass-through.
    case verified
    /// The user dismissed the system sheet. Callers stay put silently.
    case cancelled
    /// Verification could not be completed. Callers surface `message`.
    case failed(message: String)
}

@Observable
@MainActor
public final class AppLockManager {
    public static let shared = AppLockManager()

    public private(set) var isLocked = false
    public private(set) var isPrompting = false
    public private(set) var capability: AppLockCapability = .notAvailable
    public private(set) var biometricLabel = "Biometric"
    public private(set) var preferenceEnabled = false
    public private(set) var lastError: String?

    /// Per-user answer to the one-time post-login "turn on app lock?" offer.
    /// `nil` while signed out. Hydrated by `configure(userID:)` from the same
    /// per-user `UserDefaults` namespace as the preference itself. Mirrors
    /// RN's `AppLockContext.setupPromptState`.
    public private(set) var setupPromptState: AppLockSetupPromptState?

    /// Immediate-on-resume today; persisted as a number so 1/15 minute choices
    /// can be added without migrating the per-user preference format.
    public var lockAfterMs: Int {
        guard let userID else { return 0 }
        return defaults.object(forKey: key("lockAfterMs", userID)) as? Int ?? 0
    }

    private let defaults: UserDefaults
    /// Home of the `enabled` preference (`SecureStoreKey.appLockEnabled(uid)`).
    /// The Keychain survives an app delete + reinstall, `UserDefaults` does
    /// not — and the design requires a locked account to come back locked
    /// (design §8 "AppLockManager pref → Keychain"). The other, cosmetic
    /// fields (`setupPrompt`, `lockAfterMs`, `backgroundAt`, `unlockedAt`)
    /// stay in `UserDefaults`.
    private let secureStore: any SecureStore
    private var userID: String?
    private var attemptedCurrentLock = false

    /// RN's `SENSITIVE_AUTH_GRACE_MS` (`contexts/AppLockContext.tsx:32`) —
    /// a screen guard that ran a successful check within this window lets
    /// the next money surface straight through.
    public static let sensitiveAuthGrace: TimeInterval = 5 * 60

    /// In-memory (never persisted, exactly like RN's `useRef`) timestamp of
    /// the last *successful* sensitive-action check. Feeds
    /// `isWithinSensitiveGracePeriod(_:)`.
    private var lastSensitiveAuthAt: Date?

    /// Set by `appDidEnterBackground()`, consumed by `appDidBecomeActive()`.
    /// Mirrors Android's `onStop` → `onStart` pairing so a foreground pass
    /// without a matching background (Control Centre, the notification shade,
    /// an incoming call, the LocalAuthentication prompt) can never re-lock.
    private var didEnterBackground = false

    /// A background signal that arrived while an auth prompt was up. The
    /// prompt's own outcome decides what it meant, so the decision is deferred
    /// to the tail of `authenticate(reason:)`. Identical on Android.
    private var backgroundedWhilePrompting = false

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        secureStore = KeychainStore()
        refreshCapability()
    }

    /// Test / preview initialiser with an injectable secure store.
    init(defaults: UserDefaults, secureStore: any SecureStore) {
        self.defaults = defaults
        self.secureStore = secureStore
        refreshCapability()
    }

    public func configure(userID: String?) {
        guard self.userID != userID else { return }
        self.userID = userID
        attemptedCurrentLock = false
        lastError = nil
        guard let userID else {
            preferenceEnabled = false
            isLocked = false
            setupPromptState = nil
            return
        }
        preferenceEnabled = readEnabledPreference(userID: userID)
        setupPromptState = AppLockSetupPromptState(
            rawValue: defaults.string(forKey: key("setupPrompt", userID)) ?? ""
        ) ?? .pending
        refreshCapability()
        autoDisableForUnavailableCapability()
        // RN's "sync setup prompt state with preferences" effect
        // (`AppLockContext.tsx:395`): a user who already turned the lock on
        // is never offered it again.
        if preferenceEnabled, setupPromptState == .pending {
            persistSetupPromptState(.enabled)
        }
        if preferenceEnabled {
            isLocked = true
        }
    }

    /// Record the user's answer to the one-time post-login offer.
    /// No-op while signed out (there is no per-user namespace to write to).
    private func persistSetupPromptState(_ next: AppLockSetupPromptState) {
        guard let userID else { return }
        defaults.set(next.rawValue, forKey: key("setupPrompt", userID))
        setupPromptState = next
    }

    /// "Not Now" on the post-login offer — burn the prompt for this user.
    /// Mirrors RN `AppLockContext.dismissSetupPrompt`.
    public func dismissSetupPrompt() {
        persistSetupPromptState(.declined)
    }

    /// The app left the foreground.
    ///
    /// - Parameter isConfigurationChange: true when the host recreated itself
    ///   without the app ever leaving the foreground. UIKit never reports
    ///   `.background` for a rotation so callers here always leave this false;
    ///   the parameter keeps the contract identical to Android, where
    ///   `Activity.onStop()` *does* fire for one and the manager has to
    ///   discard it.
    public func appDidEnterBackground(isConfigurationChange: Bool = false) {
        guard userID != nil else { return }
        if isConfigurationChange { return }
        // The OS auth sheet can bounce the host. Whether that was a real
        // background is only knowable once the prompt resolves.
        if isPrompting {
            backgroundedWhilePrompting = true
            return
        }
        armBackground()
    }

    private func armBackground() {
        guard let userID else { return }
        didEnterBackground = true
        defaults.set(Date().timeIntervalSince1970, forKey: key("backgroundAt", userID))
        if preferenceEnabled {
            isLocked = true
            attemptedCurrentLock = false
        }
    }

    public func appDidBecomeActive() {
        guard didEnterBackground else { return }
        didEnterBackground = false
        guard userID != nil, preferenceEnabled else { return }
        let elapsedMs: Int = if let userID,
                                let backgroundAt = defaults.object(forKey: key("backgroundAt", userID)) as? TimeInterval {
            Int(max(0, Date().timeIntervalSince1970 - backgroundAt) * 1000)
        } else {
            0
        }
        if elapsedMs >= lockAfterMs {
            isLocked = true
        }
    }

    /// - Parameter source: `.postLoginPrompt` records a `declined` answer on
    ///   every non-success path so the one-time offer is never repeated —
    ///   RN's `enableAppLock('post_login_prompt')`
    ///   (`AppLockContext.tsx:118-198`). `.settings` (the default) leaves the
    ///   prompt state untouched on failure.
    public func setEnabled(_ enabled: Bool, source: AppLockEnableSource = .settings) async -> Bool {
        guard let userID else { return false }
        if !enabled {
            writeEnabledPreference(false, userID: userID)
            preferenceEnabled = false
            isLocked = false
            lastError = nil
            return true
        }

        refreshCapability()
        guard capability == .available else {
            autoDisableForUnavailableCapability()
            if source == .postLoginPrompt { persistSetupPromptState(.declined) }
            return false
        }
        let succeeded = await authenticate(reason: "Turn on app lock for Pantopus")
        guard succeeded else {
            if source == .postLoginPrompt { persistSetupPromptState(.declined) }
            return false
        }
        writeEnabledPreference(true, userID: userID)
        defaults.set(0, forKey: key("lockAfterMs", userID))
        preferenceEnabled = true
        isLocked = false
        recordUnlock()
        // Turning the lock on — from anywhere — resolves the one-time offer.
        persistSetupPromptState(.enabled)
        return true
    }

    public func unlockIfNeeded(automatic: Bool = false) async {
        guard isLocked, preferenceEnabled, userID != nil, !isPrompting else { return }
        if automatic && attemptedCurrentLock { return }
        attemptedCurrentLock = true
        if await authenticate(reason: "Unlock Pantopus") {
            isLocked = false
            lastError = nil
            recordUnlock()
        }
    }

    /// One-shot device-credential check in front of an irreversible action.
    ///
    /// Independent of the app-lock *preference*: deleting an account is
    /// gated whether or not the user opted into lock-on-resume, exactly
    /// like RN's `useSensitiveActionGuard` (which reads the capability,
    /// not the preference). When the device has no biometric and no
    /// passcode there is nothing to check against, so the action is let
    /// through rather than being made unreachable — RN's first branch.
    public func verifySensitiveAction(reason: String) async -> SensitiveActionOutcome {
        refreshCapability()
        switch capability {
        case .notAvailable, .notEnrolled, .passcodeNotSet:
            return .verified
        case .invalidContext:
            return .failed(message: capability.statusText)
        case .available:
            break
        }
        lastError = nil
        if await authenticate(reason: reason) {
            lastSensitiveAuthAt = Date()
            return .verified
        }
        let message = lastError ?? "We couldn't verify your identity. Please try again."
        return message == Self.cancelledMessage ? .cancelled : .failed(message: message)
    }

    /// `true` when a successful sensitive-action check happened inside the
    /// grace window. Mirrors RN `AppLockContext.isWithinGracePeriod`.
    public func isWithinSensitiveGracePeriod(
        _ grace: TimeInterval = AppLockManager.sensitiveAuthGrace
    ) -> Bool {
        guard let lastSensitiveAuthAt else { return false }
        return Date().timeIntervalSince(lastSensitiveAuthAt) < grace
    }

    /// The single string `message(for:)` produces for every user- /
    /// system-initiated cancel, matched by `verifySensitiveAction`.
    static let cancelledMessage = "Authentication was cancelled."

    public func clearTransientState() {
        isLocked = false
        isPrompting = false
        attemptedCurrentLock = false
        didEnterBackground = false
        backgroundedWhilePrompting = false
        lastError = nil
        userID = nil
        preferenceEnabled = false
        lastSensitiveAuthAt = nil
        setupPromptState = nil
    }

    public func refreshCapability() {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: biometricLabel = "Face ID"
        case .touchID: biometricLabel = "Touch ID"
        default: biometricLabel = "Biometric"
        }
        if available {
            capability = .available
            return
        }
        capability = Self.capability(for: error)
    }

    private func authenticate(reason: String) async -> Bool {
        isPrompting = true
        backgroundedWhilePrompting = false
        let succeeded = await evaluate(reason: reason)
        isPrompting = false
        // A background arrived mid-prompt. If the prompt then *succeeded*, the
        // cover was the OS auth sheet itself and the unlock stands. Any other
        // outcome means the OS cancelled the prompt because the user really
        // left, so the deferred background is applied now and the lock stays
        // armed. Identical on Android.
        if backgroundedWhilePrompting {
            backgroundedWhilePrompting = false
            if !succeeded { armBackground() }
        }
        return succeeded
    }

    private func evaluate(reason: String) async -> Bool {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            capability = Self.capability(for: error)
            autoDisableForUnavailableCapability()
            lastError = capability.statusText
            return false
        }
        do {
            let success = try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)
            if !success { lastError = "Authentication failed. Try again." }
            return success
        } catch let error as LAError {
            if [.biometryNotAvailable, .biometryNotEnrolled, .passcodeNotSet, .invalidContext].contains(error.code) {
                capability = Self.capability(for: error as NSError)
                autoDisableForUnavailableCapability()
            }
            lastError = Self.message(for: error)
            return false
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    private func autoDisableForUnavailableCapability() {
        guard capability != .available, let userID else { return }
        writeEnabledPreference(false, userID: userID)
        preferenceEnabled = false
        isLocked = false
    }

    private func recordUnlock() {
        guard let userID else { return }
        defaults.set(Date().timeIntervalSince1970, forKey: key("unlockedAt", userID))
    }

    private func key(_ field: String, _ userID: String) -> String {
        "appLock.\(userID).\(field)"
    }

    // MARK: - `enabled` preference (Keychain-backed)

    /// Read the per-user `enabled` flag from the Keychain. One-time
    /// migration: a value that only exists in `UserDefaults` (written by a
    /// build that pre-dates persistent login) is copied into the Keychain
    /// and then removed from `UserDefaults`, so the Keychain is the single
    /// source of truth from then on.
    private func readEnabledPreference(userID: String) -> Bool {
        let keychainKey = SecureStoreKey.appLockEnabled(userID)
        if let stored = secureStore.get(keychainKey) {
            return stored == "1"
        }
        let legacyKey = key("enabled", userID)
        guard defaults.object(forKey: legacyKey) != nil else { return false }
        let legacy = defaults.bool(forKey: legacyKey)
        try? secureStore.set(legacy ? "1" : "0", for: keychainKey)
        defaults.removeObject(forKey: legacyKey)
        return legacy
    }

    private func writeEnabledPreference(_ enabled: Bool, userID: String) {
        try? secureStore.set(enabled ? "1" : "0", for: SecureStoreKey.appLockEnabled(userID))
        // Never leave a stale legacy copy behind.
        defaults.removeObject(forKey: key("enabled", userID))
    }

    /// Whether app lock is turned on for `userID` — readable *before*
    /// `configure(userID:)` runs (e.g. to decide the reinstall gate copy).
    public func isEnabled(forUserID userID: String) -> Bool {
        readEnabledPreference(userID: userID)
    }

    /// Forget the per-user preference (account deletion / "Not you? Remove").
    public func clearPreference(forUserID userID: String) {
        try? secureStore.delete(SecureStoreKey.appLockEnabled(userID))
        defaults.removeObject(forKey: key("enabled", userID))
    }

    // MARK: - Presence (persistent login L2 gate)

    /// One-shot `LAContext.evaluatePolicy(.deviceOwnerAuthentication)` in
    /// front of "Continue as X" (design §3 / CONTRACT "L2 gate"). Unlike
    /// `verifySensitiveAction`, a device with no passcode and no biometrics
    /// does **not** pass through — it reports `.unavailable` so the caller
    /// falls back to the login screen (no OS lock ⇒ L3). Independent of the
    /// app-lock preference and of the signed-in user.
    public func verifyPresence(reason: String) async -> PresenceOutcome {
        refreshCapability()
        switch capability {
        case .notAvailable, .notEnrolled, .passcodeNotSet:
            return .unavailable
        case .invalidContext:
            return .failed(capability.statusText)
        case .available:
            break
        }
        lastError = nil
        if await authenticate(reason: reason) {
            lastSensitiveAuthAt = Date()
            return .verified
        }
        let message = lastError ?? "We couldn't verify your identity. Please try again."
        if message == Self.cancelledMessage { return .cancelled }
        // The prompt itself discovered the OS lock is gone (passcode removed
        // while the app was suspended) — same fallback as up front.
        if capability != .available { return .unavailable }
        return .failed(message)
    }

    private static func capability(for error: NSError?) -> AppLockCapability {
        guard let code = (error as? LAError)?.code else { return .notAvailable }
        switch code {
        case .biometryNotEnrolled: return .notEnrolled
        case .passcodeNotSet: return .passcodeNotSet
        case .invalidContext: return .invalidContext
        default: return .notAvailable
        }
    }

    private static func message(for error: LAError) -> String {
        switch error.code {
        case .userCancel, .systemCancel, .appCancel: cancelledMessage
        case .authenticationFailed: "Authentication failed. Try again."
        case .biometryLockout: "Biometrics are locked. Use your device passcode."
        case .passcodeNotSet: "Set a device passcode to use app lock."
        case .biometryNotEnrolled: "Enroll biometrics in Device Settings."
        case .biometryNotAvailable: "Biometric authentication is not available."
        default: error.localizedDescription
        }
    }
}

@Observable
@MainActor
public final class CapturePrivacyManager {
    public static let shared = CapturePrivacyManager()
    public private(set) var isCaptured = UIScreen.main.isCaptured
    public var coversAppSwitcher = false
    private var observer: NSObjectProtocol?

    private init() {
        observer = NotificationCenter.default.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.isCaptured = UIScreen.main.isCaptured }
        }
    }
}

public struct SecureScreenPrivacyModifier: ViewModifier {
    @State private var privacy = CapturePrivacyManager.shared
    let active: Bool

    public func body(content: Content) -> some View {
        content.overlay {
            if active && privacy.isCaptured {
                SecurityPrivacyOverlay()
                    .accessibilityIdentifier("secureScreenPrivacyOverlay")
            }
        }
    }
}

public extension View {
    func sensitiveScreen(active: Bool = true) -> some View {
        modifier(SecureScreenPrivacyModifier(active: active))
    }
}

/// Cover for an actively mirrored / recorded screen. The copy names that
/// cause, so it is *not* reused for the app-switcher snapshot — see
/// `AppSwitcherPrivacyOverlay`.
public struct SecurityPrivacyOverlay: View {
    public init() {}

    public var body: some View {
        PrivacyCover(
            headline: "Content hidden for privacy",
            message: "Return when screen recording or AirPlay mirroring has stopped."
        )
    }
}

/// Cover raised before iOS snapshots the app for the app switcher.
///
/// Android has no drawn equivalent: there the recents thumbnail is
/// suppressed by `FLAG_SECURE`, which the host window holds under exactly
/// the same condition (signed in with app lock on) — see
/// `SecureWindowController.setPrivacyHold`.
public struct AppSwitcherPrivacyOverlay: View {
    public init() {}

    public var body: some View {
        PrivacyCover(
            headline: "Content hidden for privacy",
            message: "Pantopus hides your account while the app isn't in the foreground."
        )
    }
}

/// Shared chrome for the two privacy covers above. Not `private` so the
/// `public` covers' opaque bodies never depend on a less-visible type.
struct PrivacyCover: View {
    let headline: String
    let message: String

    var body: some View {
        ZStack {
            Theme.Color.appBg.ignoresSafeArea()
            VStack(spacing: Spacing.s4) {
                Icon(.shield, size: 48, color: Theme.Color.primary600)
                Text(headline)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(message)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(Spacing.s6)
        }
    }
}

public struct AppLockOverlay: View {
    let manager: AppLockManager
    let onSignOut: @MainActor () async -> Void

    public var body: some View {
        ZStack {
            Theme.Color.appBg.ignoresSafeArea()
            VStack(spacing: Spacing.s4) {
                Icon(.lock, size: 52, color: Theme.Color.primary600)
                Text("Pantopus is locked")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(manager.lastError ?? "Authenticate to reveal your account.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .multilineTextAlignment(.center)
                Button("Retry") {
                    Task { await manager.unlockIfNeeded() }
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.Color.primary600)
                .accessibilityIdentifier("appLockRetry")
                Button("Sign out", role: .destructive) {
                    Task { await onSignOut() }
                }
                .accessibilityIdentifier("appLockSignOut")
            }
            .padding(Spacing.s6)
        }
        // Swallow every touch that misses Retry / Sign out so the signed-in UI
        // underneath can never be operated while locked (Android mirrors this
        // with a full-bleed pointer-consuming layer under the column).
        .contentShape(Rectangle())
        .accessibilityIdentifier("appLockOverlay")
        .task { await manager.unlockIfNeeded(automatic: true) }
    }
}

/// Hosts `AppLockOverlay` in its own `UIWindow`.
///
/// A `.sheet` / `.fullScreenCover` is presented by UIKit *outside* `RootView`'s
/// view tree, so an overlay placed in that `ZStack` leaves private content in a
/// presented modal visible and interactive while the app is locked. A window
/// one level above `.alert` outranks every presentation in the app's own
/// window. Android mirrors this by hosting the overlay in a `Dialog` window
/// rather than as a sibling in the Activity's content view.
@MainActor
public final class AppLockWindowPresenter {
    public static let shared = AppLockWindowPresenter()

    /// One step above `.alert`: above every presented sheet and system alert.
    private static let lockWindowLevel = UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 1)

    private var window: UIWindow?

    private init() {}

    public func present(manager: AppLockManager, onSignOut: @escaping @MainActor () async -> Void) {
        guard window == nil, let scene = Self.hostScene() else { return }
        let host = UIHostingController(
            rootView: AppLockOverlay(manager: manager, onSignOut: onSignOut)
        )
        host.view.backgroundColor = .clear
        // VoiceOver must not reach anything below the seal — including a
        // presented sheet, which `RootView`'s `.accessibilityHidden` cannot
        // reach (Android mirrors this with `Modifier.clearAndSetSemantics`
        // plus the modal dialog window).
        host.view.accessibilityViewIsModal = true
        let lockWindow = UIWindow(windowScene: scene)
        lockWindow.windowLevel = Self.lockWindowLevel
        lockWindow.rootViewController = host
        lockWindow.isHidden = false
        window = lockWindow
    }

    public func dismiss() {
        window?.isHidden = true
        window?.rootViewController = nil
        window = nil
    }

    private static func hostScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    }
}

public struct AppLockSealModifier: ViewModifier {
    let isLocked: Bool
    let manager: AppLockManager
    let onSignOut: @MainActor () async -> Void

    public func body(content: Content) -> some View {
        content.onChange(of: isLocked, initial: true) { _, locked in
            if locked {
                AppLockWindowPresenter.shared.present(manager: manager, onSignOut: onSignOut)
            } else {
                AppLockWindowPresenter.shared.dismiss()
            }
        }
    }
}

public extension View {
    /// Raises the app-lock seal in its own window while `isLocked`.
    func appLockSeal(
        isLocked: Bool,
        manager: AppLockManager,
        onSignOut: @escaping @MainActor () async -> Void
    ) -> some View {
        modifier(AppLockSealModifier(isLocked: isLocked, manager: manager, onSignOut: onSignOut))
    }
}
