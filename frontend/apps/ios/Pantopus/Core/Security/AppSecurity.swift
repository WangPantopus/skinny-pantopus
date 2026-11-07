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

/// The app came back from the background, and how long it was gone. Sensitive
/// screens read it: they ask again after a long enough absence. Mirrors Android's
/// `AppLockManager.ForegroundReturn`.
public struct AppForegroundReturn: Equatable, Sendable {
    let count: UInt
    public let awayFor: TimeInterval
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
    /// The last time the app came back from the background.
    public private(set) var foregroundReturn: AppForegroundReturn?

    /// Immediate-on-resume today; persisted as a number so 1/15 minute choices
    /// can be added without migrating the per-user preference format.
    public var lockAfterMs: Int {
        guard let userID else { return 0 }
        return defaults.object(forKey: key("lockAfterMs", userID)) as? Int ?? 0
    }

    private let defaults: UserDefaults
    /// Home of the lock's on/off preference (`SecureStoreKey.appLockOnLeave(uid)`).
    /// The Keychain survives an app delete + reinstall, `UserDefaults` does
    /// not — and the design requires a locked account to come back locked
    /// (design §8 "AppLockManager pref → Keychain"). The other, cosmetic
    /// fields (`lockAfterMs`, `backgroundAt`, `unlockedAt`) stay in
    /// `UserDefaults`.
    private let secureStore: any SecureStore
    private let makeContext: () -> LAContext
    private var userID: String?
    private var identityGeneration: UInt = 0
    private var attemptedCurrentLock = false

    /// RN's `SENSITIVE_AUTH_GRACE_MS` (`contexts/AppLockContext.tsx:32`) —
    /// a screen guard that ran a successful check within this window lets
    /// the next sensitive screen straight through.
    public static let sensitiveAuthGrace: TimeInterval = 5 * 60

    /// In-memory (never persisted, exactly like RN's `useRef`) timestamp of
    /// the last *successful* sensitive-action check, moved up when someone
    /// leaves a sensitive screen. Feeds `isWithinSensitiveGracePeriod(_:)`.
    private var lastSensitiveAuthAt: Date?
    /// The sensitive-screen check under way: guards that ask while it is up
    /// share it, so two of them never raise two prompts.
    private var sensitiveScreenCheck: Task<SensitiveActionOutcome, Never>?

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
        makeContext = { LAContext() }
        refreshCapability()
    }

    /// Test / preview initialiser with an injectable secure store.
    init(defaults: UserDefaults, secureStore: any SecureStore, makeContext: @escaping () -> LAContext = { LAContext() }) {
        self.defaults = defaults
        self.secureStore = secureStore
        self.makeContext = makeContext
        refreshCapability()
    }

    public func configure(userID: String?) {
        guard self.userID != userID else { return }
        identityGeneration &+= 1
        lastSensitiveAuthAt = nil
        sensitiveScreenCheck = nil
        isPrompting = false
        backgroundedWhilePrompting = false
        self.userID = userID
        attemptedCurrentLock = false
        lastError = nil
        guard let userID else {
            preferenceEnabled = false
            isLocked = false
            return
        }
        forgetRetiredLockSettings(userID: userID)
        preferenceEnabled = readEnabledPreference(userID: userID)
        refreshCapability()
        autoDisableForUnavailableCapability()
        if preferenceEnabled {
            isLocked = true
        }
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
            lastError = nil
        }
    }

    public func appDidBecomeActive() {
        guard didEnterBackground else { return }
        didEnterBackground = false
        guard let userID else { return }
        let elapsed: TimeInterval = if let backgroundAt = defaults.object(forKey: key("backgroundAt", userID)) as? TimeInterval {
            max(0, Date().timeIntervalSince1970 - backgroundAt)
        } else {
            0
        }
        foregroundReturn = AppForegroundReturn(count: (foregroundReturn?.count ?? 0) &+ 1, awayFor: elapsed)
        guard preferenceEnabled else { return }
        if Int(elapsed * 1000) >= lockAfterMs {
            isLocked = true
        }
    }

    /// Turns the whole-app lock (the "Lock Pantopus when I leave the app"
    /// switch) on or off. Sensitive screens ask either way.
    public func setEnabled(_ enabled: Bool) async -> Bool {
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
            return false
        }
        let generation = identityGeneration
        let succeeded = await authenticate(reason: "Turn on app lock for Pantopus")
        guard generation == identityGeneration, succeeded else { return false }
        writeEnabledPreference(true, userID: userID)
        defaults.set(0, forKey: key("lockAfterMs", userID))
        preferenceEnabled = true
        isLocked = false
        recordUnlock()
        return true
    }

    /// - Parameter automatic: the try that needs no tap. The lock goes up as
    ///   the app leaves, when iOS refuses to ask ("User interaction required"),
    ///   so it waits for the app to come back (`appDidBecomeActive()`, then the
    ///   scene's `.active`) and doesn't use up the one try on its way out.
    public func unlockIfNeeded(automatic: Bool = false) async {
        guard isLocked, preferenceEnabled, userID != nil, !isPrompting else { return }
        if automatic, didEnterBackground || attemptedCurrentLock { return }
        attemptedCurrentLock = true
        if await authenticate(reason: "Unlock Pantopus") {
            isLocked = false
            lastError = nil
            lastSensitiveAuthAt = Date()
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
        case .passcodeNotSet:
            return .verified
        case .notAvailable, .notEnrolled, .invalidContext:
            return .failed(message: capability.statusText)
        case .available:
            break
        }
        lastError = nil
        let generation = identityGeneration
        let verified = await authenticate(reason: reason)
        guard generation == identityGeneration else {
            return .failed(message: "Your account changed. Please verify again.")
        }
        if verified {
            lastSensitiveAuthAt = Date()
            return .verified
        }
        let message = lastError ?? "We couldn't verify your identity. Please try again."
        return message == Self.cancelledMessage ? .cancelled : .failed(message: message)
    }

    /// The single string `message(for:)` produces for every user- /
    /// system-initiated cancel, matched by `verifySensitiveAction`.
    static let cancelledMessage = "Authentication was cancelled."
    private static let couldNotCheckMessage = "Couldn't check it's you just now. Try again."

    public func clearTransientState() {
        identityGeneration &+= 1
        isLocked = false
        isPrompting = false
        attemptedCurrentLock = false
        didEnterBackground = false
        backgroundedWhilePrompting = false
        lastError = nil
        userID = nil
        preferenceEnabled = false
        lastSensitiveAuthAt = nil
        sensitiveScreenCheck = nil
    }

    public func refreshCapability() {
        let context = makeContext()
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
        let generation = identityGeneration
        isPrompting = true
        backgroundedWhilePrompting = false
        let succeeded = await evaluate(reason: reason)
        guard generation == identityGeneration else { return false }
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
        let generation = identityGeneration
        let context = makeContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            capability = Self.capability(for: error)
            autoDisableForUnavailableCapability()
            lastError = capability.statusText
            return false
        }
        do {
            let success = try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)
            guard generation == identityGeneration else { return false }
            if !success { lastError = "Authentication failed. Try again." }
            return success
        } catch let error as LAError {
            guard generation == identityGeneration else { return false }
            if [.biometryNotAvailable, .biometryNotEnrolled, .passcodeNotSet, .invalidContext].contains(error.code) {
                capability = Self.capability(for: error as NSError)
                autoDisableForUnavailableCapability()
            }
            lastError = Self.message(for: error)
            return false
        } catch {
            guard generation == identityGeneration else { return false }
            lastError = Self.couldNotCheckMessage
            return false
        }
    }

    private func autoDisableForUnavailableCapability() {
        guard capability == .passcodeNotSet, let userID else { return }
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

    // MARK: - On/off preference (Keychain-backed)

    private func readEnabledPreference(userID: String) -> Bool {
        secureStore.get(SecureStoreKey.appLockOnLeave(userID)) == "1"
    }

    private func writeEnabledPreference(_ enabled: Bool, userID: String) {
        try? secureStore.set(enabled ? "1" : "0", for: SecureStoreKey.appLockOnLeave(userID))
    }

    /// The old switch and its one-time offer said "sensitive actions" and locked
    /// the whole app (founder, 2026-11-06). Sensitive screens now always ask, so
    /// nobody keeps the whole-app lock from that promise: its settings are
    /// dropped, and only the renamed switch turns it on.
    private func forgetRetiredLockSettings(userID: String) {
        try? secureStore.delete(SecureStoreKey.retiredAppLockEnabled(userID))
        defaults.removeObject(forKey: key("enabled", userID))
        defaults.removeObject(forKey: key("setupPrompt", userID))
    }

    /// Whether app lock is turned on for `userID` — readable *before*
    /// `configure(userID:)` runs (e.g. to decide the reinstall gate copy).
    public func isEnabled(forUserID userID: String) -> Bool {
        readEnabledPreference(userID: userID)
    }

    /// Forget the per-user preference (account deletion / "Not you? Remove").
    public func clearPreference(forUserID userID: String) {
        try? secureStore.delete(SecureStoreKey.appLockOnLeave(userID))
        forgetRetiredLockSettings(userID: userID)
    }

    private static func capability(for error: NSError?) -> AppLockCapability {
        guard let code = (error as? LAError)?.code else { return .invalidContext }
        switch code {
        case .biometryNotEnrolled: return .notEnrolled
        case .passcodeNotSet: return .passcodeNotSet
        case .invalidContext: return .invalidContext
        default: return .invalidContext
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
        // Never iOS's own wording ("User interaction required.").
        default: couldNotCheckMessage
        }
    }
}

@Observable
@MainActor
public final class CapturePrivacyManager {
    public static let shared = CapturePrivacyManager()
    public private(set) var isCaptured = false
    /// The app is leaving, or isn't in front: what's private has to be covered
    /// before iOS takes the app switcher's picture.
    public var coversAppSwitcher = false {
        didSet { syncAppSwitcherCover() }
    }

    /// Every screen is private: signed in with the whole-app lock on.
    public var coversWholeApp = false {
        didSet { syncAppSwitcherCover() }
    }

    /// Screens showing that say they are private (`hiddenInAppSwitcher()`).
    private var privateScreensShowing = 0
    private var observer: NSObjectProtocol?

    private init() {
        isCaptured = Self.screenIsCaptured
        observer = NotificationCenter.default.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.isCaptured = Self.screenIsCaptured }
        }
    }

    func privateScreenAppeared() {
        privateScreensShowing += 1
        syncAppSwitcherCover()
    }

    func privateScreenDisappeared() {
        privateScreensShowing = max(0, privateScreensShowing - 1)
        syncAppSwitcherCover()
    }

    private func syncAppSwitcherCover() {
        if coversAppSwitcher, coversWholeApp || privateScreensShowing > 0 {
            AppSwitcherCoverPresenter.shared.present()
        } else {
            AppSwitcherCoverPresenter.shared.dismiss()
        }
    }

    /// Whether a screen the app's windows are on is being recorded or mirrored. Read from the window scenes, not
    /// `UIScreen.main`, which Apple is retiring and which is ambiguous on a phone with two screens (iPhone Duo).
    private static var screenIsCaptured: Bool {
        UIApplication.shared.connectedScenes.contains { ($0 as? UIWindowScene)?.screen.isCaptured == true }
    }
}

public struct SecureScreenPrivacyModifier: ViewModifier {
    @State private var privacy = CapturePrivacyManager.shared
    let active: Bool

    public func body(content: Content) -> some View {
        content
            .overlay {
                if active && privacy.isCaptured {
                    SecurityPrivacyOverlay()
                        .accessibilityIdentifier("secureScreenPrivacyOverlay")
                }
            }
            .hiddenInAppSwitcher(active: active)
    }
}

/// Counts this screen among the private ones while it shows.
private struct AppSwitcherHiddenModifier: ViewModifier {
    @State private var isCounted = false
    let active: Bool

    func body(content: Content) -> some View {
        content
            .onAppear {
                guard active, !isCounted else { return }
                isCounted = true
                CapturePrivacyManager.shared.privateScreenAppeared()
            }
            .onDisappear {
                guard isCounted else { return }
                isCounted = false
                CapturePrivacyManager.shared.privateScreenDisappeared()
            }
    }
}

public extension View {
    /// Money and codes: hidden in the app switcher and while the screen is recorded or mirrored.
    func sensitiveScreen(active: Bool = true) -> some View {
        modifier(SecureScreenPrivacyModifier(active: active))
    }

    /// Hidden in the app switcher only: a letter or a card can still be recorded or screenshotted to share.
    func hiddenInAppSwitcher(active: Bool = true) -> some View {
        modifier(AppSwitcherHiddenModifier(active: active))
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
/// suppressed by the host window, under the same conditions (signed in with
/// app lock on, or a private screen showing) — see `SecureWindowController`.
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
                Icon(.shield, size: 48, color: Theme.Color.primaryInk)
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
                Icon(.lock, size: 52, color: Theme.Color.primaryInk)
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
                .tint(Theme.Color.primarySolid)
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

    /// A sheet or a full-screen cover is up, over whatever view asks.
    static var isSomethingPresented: Bool {
        hostScene()?.windows.contains { $0.rootViewController?.presentedViewController != nil } ?? false
    }

    fileprivate static func hostScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    }
}

/// Hosts `AppSwitcherPrivacyOverlay` in its own window for the same reason as
/// the lock's seal: a window outranks a sheet a private screen has open.
@MainActor
final class AppSwitcherCoverPresenter {
    static let shared = AppSwitcherCoverPresenter()

    private static let coverWindowLevel = UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 2)

    private var window: UIWindow?

    private init() {}

    func present() {
        guard window == nil, let scene = AppLockWindowPresenter.hostScene() else { return }
        let host = UIHostingController(
            rootView: AppSwitcherPrivacyOverlay().accessibilityIdentifier("appSwitcherPrivacyOverlay")
        )
        host.view.backgroundColor = .clear
        let coverWindow = UIWindow(windowScene: scene)
        coverWindow.windowLevel = Self.coverWindowLevel
        coverWindow.rootViewController = host
        coverWindow.isHidden = false
        window = coverWindow
    }

    func dismiss() {
        window?.isHidden = true
        window?.rootViewController = nil
        window = nil
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

@MainActor
public extension AppLockManager {
    // MARK: - Presence (persistent login L2 gate)

    /// One-shot `LAContext.evaluatePolicy(.deviceOwnerAuthentication)` in
    /// front of "Continue as X" (design §3 / CONTRACT "L2 gate"). Unlike
    /// `verifySensitiveAction`, a device with no passcode and no biometrics
    /// does **not** pass through — it reports `.unavailable` so the caller
    /// falls back to the login screen (no OS lock ⇒ L3). Independent of the
    /// app-lock preference and of the signed-in user.
    func verifyPresence(reason: String) async -> PresenceOutcome {
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
        let generation = identityGeneration
        let succeeded = await authenticate(reason: reason)
        guard generation == identityGeneration else {
            return .failed("Your account changed. Please verify again.")
        }
        if succeeded {
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

    /// Grace applies only while device authentication is available. An OS
    /// failure is never evidence that the device has no credential.
    func verifySensitiveScreen(
        reason: String,
        gracePeriod: TimeInterval = AppLockManager.sensitiveAuthGrace
    ) async -> SensitiveActionOutcome {
        refreshCapability()
        if capability == .available, isWithinSensitiveGracePeriod(gracePeriod) {
            return .verified
        }
        if let check = sensitiveScreenCheck { return await check.value }
        let generation = identityGeneration
        let check = Task { await verifySensitiveAction(reason: reason) }
        sensitiveScreenCheck = check
        let outcome = await check.value
        if generation == identityGeneration { sensitiveScreenCheck = nil }
        return outcome
    }

    /// Someone was on a sensitive screen until now: the grace runs from here,
    /// not from their last check, so a long read doesn't ask again on the way
    /// back from a quick look at another tab.
    func noteSensitiveScreenLeft() {
        guard lastSensitiveAuthAt != nil else { return }
        lastSensitiveAuthAt = Date()
    }

    /// `true` when a successful sensitive-action check happened inside the
    /// grace window. Mirrors RN `AppLockContext.isWithinGracePeriod`.
    func isWithinSensitiveGracePeriod(
        _ grace: TimeInterval = AppLockManager.sensitiveAuthGrace
    ) -> Bool {
        guard let lastSensitiveAuthAt else { return false }
        return Date().timeIntervalSince(lastSensitiveAuthAt) < grace
    }
}
