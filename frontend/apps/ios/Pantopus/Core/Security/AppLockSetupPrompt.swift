//
//  AppLockSetupPrompt.swift
//  Pantopus
//
//  The one-time post-login offer to turn on biometric app lock.
//
//  RN raises this from `AppLockSetupPromptLayer` (`src/app/_layout.tsx:132`)
//  once per account: after an *interactive* sign-in (never a silent session
//  restore), while the device can actually authenticate and the lock is off,
//  it asks once and remembers the answer in
//  `AppLockSetupPromptState` — 'pending' → 'enabled' | 'declined'. Native had
//  the lock itself but no offer, so unless a user went hunting in
//  Settings → Privacy & Security they never learned it existed.
//
//  Android mirrors this with `AppLockSetupPromptDialog` in `AppLockUi.kt`.
//

import SwiftUI

/// Presents the offer over the signed-in shell. Attach once, at the root.
public struct AppLockSetupPromptModifier: ViewModifier {
    let manager: AppLockManager
    /// Signed-in gate — the offer never appears over the auth screens.
    let isSignedIn: Bool
    /// `AuthManager.lastInteractiveSignInAt`. Each distinct stamp is offered
    /// at most once, so re-rendering the root can't re-raise the alert.
    let lastInteractiveSignInAt: Date?

    @State private var isPresented = false
    @State private var promptedSignInAt: Date?
    @State private var failureMessage: String?

    public func body(content: Content) -> some View {
        content
            .onChange(of: promptKey, initial: true) { _, _ in evaluate() }
            .alert(
                "Enable \(unlockLabel)?",
                isPresented: $isPresented
            ) {
                Button("Not Now", role: .cancel) {
                    manager.dismissSetupPrompt()
                }
                .accessibilityIdentifier("appLockSetupPromptDismiss")
                Button("Enable") {
                    Task { @MainActor in await enable() }
                }
                .accessibilityIdentifier("appLockSetupPromptEnable")
            } message: {
                Text(
                    "Use \(unlockLabel) to protect sensitive actions "
                        + "like payments and account changes."
                )
            }
            .alert(
                "Could not enable \(unlockLabel)",
                isPresented: Binding(
                    get: { failureMessage != nil },
                    set: { if !$0 { failureMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) { failureMessage = nil }
            } message: {
                Text(failureMessage ?? "")
            }
    }

    /// Recomputed whenever any gate input changes, so the evaluation re-runs
    /// on sign-in, on capability refresh, and after the answer is recorded.
    private var promptKey: String {
        let stamp = lastInteractiveSignInAt.map { String($0.timeIntervalSince1970) } ?? "-"
        return [
            isSignedIn ? "in" : "out",
            stamp,
            manager.setupPromptState?.rawValue ?? "-",
            manager.capability.rawValue,
            manager.preferenceEnabled ? "on" : "off"
        ].joined(separator: "|")
    }

    /// "Face ID" / "Touch ID" when the device has one, otherwise the generic
    /// label — RN's `unlockLabel` (`_layout.tsx:167`).
    private var unlockLabel: String {
        let label = manager.biometricLabel
        return label == "Face ID" || label == "Touch ID" ? label : "Biometric unlock"
    }

    private func evaluate() {
        guard isSignedIn,
              let signInAt = lastInteractiveSignInAt,
              manager.setupPromptState == .pending,
              !manager.preferenceEnabled,
              manager.capability == .available,
              promptedSignInAt != signInAt
        else { return }
        promptedSignInAt = signInAt
        isPresented = true
    }

    @MainActor
    private func enable() async {
        let succeeded = await manager.setEnabled(true, source: .postLoginPrompt)
        guard !succeeded else { return }
        // A plain cancel is silent (RN swallows `reason === 'cancelled'`);
        // anything else explains where to find the setting later.
        guard manager.lastError != AppLockManager.cancelledMessage else { return }
        failureMessage = "You can turn it on later from Privacy & Security."
    }
}

public extension View {
    /// Raises the one-time post-login app-lock offer. No-op once the user has
    /// answered it (per account).
    func appLockSetupPrompt(
        manager: AppLockManager,
        isSignedIn: Bool,
        lastInteractiveSignInAt: Date?
    ) -> some View {
        modifier(
            AppLockSetupPromptModifier(
                manager: manager,
                isSignedIn: isSignedIn,
                lastInteractiveSignInAt: lastInteractiveSignInAt
            )
        )
    }
}
