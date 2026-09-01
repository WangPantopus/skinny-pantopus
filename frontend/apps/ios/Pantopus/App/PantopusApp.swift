//
//  PantopusApp.swift
//  Pantopus
//
//  App entry point. Boots the environment, auth, and root view.
//

import Foundation
import SwiftUI

@main
struct PantopusApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase

    // App-wide singletons — injected via environment.
    @State private var environment = AppEnvironment.current
    @State private var authManager = Self.bootAuthManager()
    @State private var apiClient = APIClient.shared
    @State private var socketClient = SocketClient.shared
    @State private var appLock = AppLockManager.shared
    @State private var capturePrivacy = CapturePrivacyManager.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(environment)
                .environment(authManager)
                .environment(apiClient)
                .environment(socketClient)
                .environment(appLock)
                .task {
                    if !ProcessInfo.processInfo.isUITestSeededAuthSession {
                        await authManager.restoreSession()
                    }
                }
                // Universal links (`https://pantopus.com/…`) and custom-scheme
                // URLs (`pantopus://…`). Both funnel into the same router the
                // notification-tap path uses; `RootTabView` observes
                // `DeepLinkRouter.shared.pending` and dispatches to the right
                // tab/stack, so cold-start links resolve once the root appears.
                .onOpenURL { url in
                    guard !AuthManager.isOAuthCallback(url) else { return }
                    DeepLinkRouter.shared.handle(url: url)
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL {
                        guard !AuthManager.isOAuthCallback(url) else { return }
                        DeepLinkRouter.shared.handle(url: url)
                    }
                }
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .active:
                        capturePrivacy.coversAppSwitcher = false
                        appLock.appDidBecomeActive()
                    case .inactive:
                        // Transient interruption — Control Centre, the
                        // notification shade, an incoming call, or the
                        // LocalAuthentication prompt itself. Raise the
                        // app-switcher cover (it has to be up before iOS takes
                        // its snapshot) but do NOT arm the lock: that is
                        // `.background` only, mirroring Android's
                        // `MainActivity.onStop()`.
                        capturePrivacy.coversAppSwitcher = true
                    case .background:
                        capturePrivacy.coversAppSwitcher = true
                        appLock.appDidEnterBackground()
                    @unknown default:
                        capturePrivacy.coversAppSwitcher = true
                    }
                }
        }
    }

    /// Pick the AuthManager for this launch. Under `UI_TESTS_SIGNED_IN=1`
    /// we boot into an in-memory signed-in session so UI tests can exercise
    /// the root tab view without a real backend.
    private static func bootAuthManager() -> AuthManager {
        if ProcessInfo.processInfo.isUITestSignedInSession {
            return AuthManager.previewSignedIn
        }
        if ProcessInfo.processInfo.isUITestSignedOutSession {
            return AuthManager.previewSignedOut
        }
        return AuthManager.shared
    }
}

private extension ProcessInfo {
    /// True when the process was launched by a UI test that wants a
    /// seeded signed-in session.
    var isUITestSignedInSession: Bool {
        environment["UI_TESTS_SIGNED_IN"] == "1"
    }

    var isUITestSignedOutSession: Bool {
        environment["UI_TESTS_SIGNED_OUT"] == "1"
    }

    var isUITestSeededAuthSession: Bool {
        isUITestSignedInSession || isUITestSignedOutSession
    }
}

/// Top-level router — shows auth or main content based on session state.
struct RootView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(AppLockManager.self) private var appLock
    @State private var capturePrivacy = CapturePrivacyManager.shared

    var body: some View {
        ZStack {
            Group {
                switch auth.state {
                case .unknown:
                    SplashView()
                case .signedOut:
                    PlaceLaunchHost()
                case .signedIn:
                    RootTabView()
                }
            }
            // While covered the subtree takes no touches and drops out of the
            // accessibility tree, so VoiceOver can't read private content the
            // lock overlay is hiding (Android mirrors this with
            // `Modifier.clearAndSetSemantics`).
            .allowsHitTesting(!isAppLocked)
            .accessibilityHidden(isAppLocked)
            if capturePrivacy.coversAppSwitcher && privacyCoverEnabled {
                AppSwitcherPrivacyOverlay()
                    .accessibilityIdentifier("appSwitcherPrivacyOverlay")
                    .zIndex(20)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: auth.state)
        .transition(.opacity)
        // The seal is hosted in its own window rather than in the ZStack above:
        // a `.sheet` / `.fullScreenCover` is presented by UIKit outside this
        // view tree and would otherwise stay visible and interactive while
        // locked. Android mirrors this with a Dialog-window overlay.
        // Captured by value: the seal outlives a body pass, and reading an
        // `@Environment` value after the view is torn down is undefined.
        .appLockSeal(isLocked: isAppLocked, manager: appLock) { [appLock = appLock, auth = auth] in
            appLock.clearTransientState()
            await auth.signOut()
        }
        // One-time post-login offer to turn app lock on (RN
        // `AppLockSetupPromptLayer`, `src/app/_layout.tsx:132`).
        .appLockSetupPrompt(
            manager: appLock,
            isSignedIn: isSignedInState,
            lastInteractiveSignInAt: auth.lastInteractiveSignInAt
        )
        .onAppear { syncAppLock() }
        .onChange(of: auth.state) { previous, new in
            syncAppLock()
            // Workstream 1.4 — one-shot replay of a deferred content deep
            // link into DeepLinkRouter so RootTabView / tab roots navigate.
            if becameSignedIn(from: previous, to: new) {
                DeepLinkRouter.shared.acknowledgeLoginPresentation()
                Task { @MainActor in
                    replayDeferredDeepLinkIfNeeded()
                }
            }
        }
    }

    /// True while the session is signed in — gates the app-lock setup offer,
    /// which must never appear over the auth screens.
    private var isSignedInState: Bool {
        if case .signedIn = auth.state { return true }
        return false
    }

    /// Signed-in *and* locked — the only state that raises `AppLockOverlay`.
    private var isAppLocked: Bool {
        guard case .signedIn = auth.state else { return false }
        return appLock.isLocked
    }

    /// The app-switcher cover is a privacy feature, so it is scoped to the
    /// users who asked for one: signed in with app lock turned on. Covering
    /// the auth screens, or a signed-in user who never opted in, hides
    /// nothing private and blinks a full-screen panel on every Control
    /// Centre pull. Android holds `FLAG_SECURE` under exactly this
    /// condition — see `SecureWindowController.setPrivacyHold`.
    private var privacyCoverEnabled: Bool {
        guard case .signedIn = auth.state else { return false }
        return appLock.preferenceEnabled
    }

    private func syncAppLock() {
        switch auth.state {
        case let .signedIn(user):
            appLock.configure(userID: user.id)
        case .unknown:
            break
        case .signedOut:
            appLock.configure(userID: nil)
        }
    }

    private func becameSignedIn(from previous: AuthManager.State, to new: AuthManager.State) -> Bool {
        guard case .signedIn = new else { return false }
        if case .signedIn = previous { return false }
        return true
    }

    private func replayDeferredDeepLinkIfNeeded() {
        guard let path = PendingDeepLinkStore.take() else { return }
        DeepLinkRouter.shared.handle(path: path)
    }
}

/// Launch-time splash while we hydrate the session from the keychain.
private struct SplashView: View {
    var body: some View {
        ZStack {
            Theme.Color.appBg.ignoresSafeArea()
            VStack(spacing: Spacing.s4) {
                Icon(.home, size: 64, color: Theme.Color.primary600)
                ProgressView()
            }
        }
        .accessibilityLabel("Loading Pantopus")
    }
}

#Preview("Signed in") {
    RootView()
        .environment(AppEnvironment.current)
        .environment(AuthManager.previewSignedIn)
        .environment(APIClient.shared)
        .environment(SocketClient.shared)
        // RootView reads `@Environment(AppLockManager.self)`; without this the
        // preview traps at runtime.
        .environment(AppLockManager.shared)
}
