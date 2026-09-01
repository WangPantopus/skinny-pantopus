//
//  StepUpPasswordPrompt.swift
//  Pantopus
//
//  The password half of step-up (CONTRACT `/api/auth/step-up {method:
//  "password"}`): a small sheet that asks for the account password when
//  the biometry-bound device key can't be used (not enrolled, `restored`
//  session, the server refused the method, or the purpose is password-only
//  such as account deletion). Installed into
//  `AuthManager.stepUpPasswordPrompt` by `RootView`; the APIClient 403
//  `STEP_UP_REQUIRED` interceptor and the explicit flows (Devices, delete
//  account) all funnel through it.
//
//  Hosted in its own `UIWindow` (same pattern as `AppLockWindowPresenter`)
//  so it can appear over any presented sheet — the account-deletion sheet
//  in particular — where a `.sheet` on `RootView` would be refused by
//  UIKit ("already presenting"). Sits one level *below* the app-lock seal.
//

import SwiftUI
import UIKit

/// Presents `StepUpPasswordSheet` and resolves the awaiting caller.
@MainActor
final class StepUpPasswordPrompter {
    static let shared = StepUpPasswordPrompter()

    /// Above the app's own presentations, below the app-lock seal
    /// (`UIWindow.Level.alert + 1`).
    private static let windowLevel = UIWindow.Level.alert

    private var window: UIWindow?
    private var continuation: CheckedContinuation<String?, Never>?

    init() {}

    /// Ask for the password. Returns `nil` when the user cancels, when a
    /// prompt is already up, or when there is no scene to host the sheet.
    func ask(purpose: StepUpPurpose) async -> String? {
        guard continuation == nil, let scene = Self.hostScene() else { return nil }
        return await withCheckedContinuation { (continuation: CheckedContinuation<String?, Never>) in
            self.continuation = continuation
            let host = UIHostingController(
                rootView: StepUpPasswordSheet(
                    purpose: purpose,
                    onCancel: { [weak self] in self?.finish(with: nil) },
                    onSubmit: { [weak self] password in self?.finish(with: password) }
                )
            )
            host.view.backgroundColor = .clear
            host.view.accessibilityViewIsModal = true
            let promptWindow = UIWindow(windowScene: scene)
            promptWindow.windowLevel = Self.windowLevel
            promptWindow.rootViewController = host
            promptWindow.isHidden = false
            promptWindow.makeKey()
            window = promptWindow
        }
    }

    private func finish(with password: String?) {
        let pending = continuation
        continuation = nil
        window?.isHidden = true
        window?.rootViewController = nil
        window = nil
        pending?.resume(returning: password)
    }

    private static func hostScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    }
}

/// The password sheet. Copy per purpose mirrors Android
/// `StepUpPasswordDialog`; identifiers `auth.stepUp.*`.
struct StepUpPasswordSheet: View {
    let purpose: StepUpPurpose
    let onCancel: @MainActor () -> Void
    let onSubmit: @MainActor (String) -> Void

    @State private var password = ""
    @State private var isVisible = false
    @FocusState private var isFocused: Bool

    var body: some View {
        ZStack {
            Theme.Color.appText.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture { onCancel() }
                .accessibilityHidden(true)
            VStack(spacing: Spacing.s0) {
                Spacer(minLength: Spacing.s0)
                card
                    .padding(.horizontal, Spacing.s5)
                Spacer(minLength: Spacing.s0)
            }
        }
        .accessibilityIdentifier("auth.stepUp.passwordSheet")
        .onAppear { isFocused = true }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HStack(spacing: Spacing.s2) {
                Icon(.lock, size: 20, color: Theme.Color.primary600)
                Text("Confirm it's you")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
            }
            Text(Self.message(for: purpose))
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)

            PasswordField(
                value: $password,
                isVisible: $isVisible,
                state: .default,
                identifier: "auth.stepUp.passwordField",
                onChange: {},
                trailingLink: nil
            )
            .focused($isFocused)
            .submitLabel(.go)
            .onSubmit(submit)

            HStack(spacing: Spacing.s3) {
                GhostButton(title: "Cancel") {
                    onCancel()
                }
                .accessibilityIdentifier("auth.stepUp.cancel")
                PrimaryButton(title: "Confirm", isEnabled: canSubmit) {
                    submit()
                }
                .accessibilityIdentifier("auth.stepUp.confirm")
            }
        }
        .padding(Spacing.s5)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .pantopusShadow(.lg)
    }

    private var canSubmit: Bool {
        !password.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func submit() {
        guard canSubmit else { return }
        onSubmit(password)
    }

    static func message(for purpose: StepUpPurpose) -> String {
        switch purpose {
        case .deleteAccount:
            "Enter your password to delete your account. This can't be undone."
        case .revokeDevice:
            "Enter your password to remove this device. It will be signed out immediately."
        case .revokeSessions:
            "Enter your password to sign out your other devices."
        case .changeSecurityPrefs:
            "Enter your password to change your security settings."
        case .generic:
            "Enter your password to continue."
        }
    }
}

#Preview("Delete account") {
    StepUpPasswordSheet(purpose: .deleteAccount, onCancel: {}, onSubmit: { _ in })
}
