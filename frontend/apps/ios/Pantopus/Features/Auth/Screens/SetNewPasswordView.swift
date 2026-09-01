//
//  SetNewPasswordView.swift
//  Pantopus
//
//  §1B-1 — "Set a new password" (set-password-frames.jsx). Auth-archetype
//  form variant reached from the password-reset email deep link. Same
//  vertical rhythm as the other doorway screens (LoginView): brand lockup →
//  kicker → headline → subcopy → two secure fields (new + confirm, leading
//  lock, eye toggle) → 3-bar strength meter → primary "Update password" →
//  "Back to sign in" link → trust footer.
//
//  Four states from the design: default · validation (strength + mismatch) ·
//  valid · success ("Password updated" → "Continue to sign in"). The
//  success frame also reports that other devices were signed out.
//

import SwiftUI

struct SetNewPasswordView: View {
    @Environment(AuthManager.self) private var auth
    @State private var viewModel: SetNewPasswordViewModel
    @State private var showNewPassword: Bool = false
    @State private var showConfirmPassword: Bool = false

    /// Pops back to the login surface ("Back to sign in").
    let onBack: () -> Void
    /// Fired by the success CTA ("Continue to sign in").
    let onContinue: () -> Void

    init(
        token: String,
        onBack: @escaping () -> Void = {},
        onContinue: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: SetNewPasswordViewModel(token: token))
        self.onBack = onBack
        self.onContinue = onContinue
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.s0) {
                switch viewModel.phase {
                case .form:
                    formBody
                case .success:
                    successBody
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s10)
        }
        .background(Theme.Color.appSurface)
        .navigationBarHidden(true)
        .accessibilityIdentifier("setPasswordScreen")
    }

    // MARK: - Form

    private var formBody: some View {
        VStack(spacing: Spacing.s0) {
            SetPasswordBrandLockup()
                .padding(.bottom, Spacing.s10)

            VStack(spacing: Spacing.s2) {
                Text("ALMOST DONE")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.primary600)
                    .tracking(1.2)
                Text("Set a new password")
                    .pantopusTextStyle(.h2)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("Create a new password for your account — you'll use it to sign in next time.")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 300)
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.bottom, Spacing.s5)

            if let error = viewModel.errorMessage {
                ErrorBanner(error: error, onDismiss: viewModel.clearError)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.bottom, Spacing.s3)
                    .accessibilityIdentifier("setPassword.errorBanner")
            }

            VStack(spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    SecurePasswordField(
                        label: "New password",
                        text: $viewModel.password,
                        placeholder: "Enter a new password",
                        state: viewModel.newPasswordFieldState,
                        isRevealed: $showNewPassword,
                        identifier: "setPassword.newField",
                        onChange: viewModel.clearError
                    )
                    PasswordStrengthRow(
                        score: viewModel.passwordStrength,
                        label: viewModel.passwordStrengthLabel,
                        hint: viewModel.strengthHint
                    )
                }

                VStack(alignment: .leading, spacing: Spacing.s2) {
                    SecurePasswordField(
                        label: "Confirm password",
                        text: $viewModel.confirmPassword,
                        placeholder: "Re-enter your password",
                        state: viewModel.confirmFieldState,
                        isRevealed: $showConfirmPassword,
                        identifier: "setPassword.confirmField",
                        onChange: viewModel.clearError
                    )
                    matchHint
                }

                submitButton

                Button(action: onBack) {
                    Text("← Back to sign in")
                        .pantopusTextStyle(.small)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.primary600)
                }
                .padding(.top, Spacing.s1)
                .accessibilityIdentifier("setPassword.backLink")
            }
            .padding(.horizontal, Spacing.s5)

            Spacer(minLength: Spacing.s10)

            AuthTrustFooter()
                .padding(.top, Spacing.s10)
        }
    }

    @ViewBuilder private var matchHint: some View {
        if viewModel.confirmMatch != .none {
            let isMatch = viewModel.confirmMatch == .match
            HStack(spacing: Spacing.s1) {
                Icon(
                    isMatch ? .check : .alertCircle,
                    size: 14,
                    color: isMatch ? Theme.Color.success : Theme.Color.error
                )
                Text(isMatch ? "Passwords match" : "Passwords don't match")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(isMatch ? Theme.Color.success : Theme.Color.error)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("setPassword.matchHint")
        }
    }

    private var submitButton: some View {
        Button(action: submit) {
            Group {
                if viewModel.isLoading {
                    ProgressView().tint(Theme.Color.appTextInverse)
                } else {
                    HStack(spacing: Spacing.s1) {
                        Text("Update password")
                            .pantopusTextStyle(.body)
                            .fontWeight(.semibold)
                        Icon(.check, size: 16, color: Theme.Color.appTextInverse)
                    }
                    .foregroundStyle(Theme.Color.appTextInverse)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 48)
        }
        .background(viewModel.canSubmit ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .disabled(!viewModel.canSubmit)
        .accessibilityIdentifier("setPassword.submit")
        .accessibilityLabel(viewModel.isLoading ? "Updating password" : "Update password")
    }

    // MARK: - Success

    private var successBody: some View {
        VStack(spacing: Spacing.s4) {
            HaloCircle(tone: .success)
                .padding(.bottom, Spacing.s2)

            Text("Password updated")
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)

            Text("Your password has been changed. Sign in with your new password to continue.")
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)

            HStack(spacing: Spacing.s2) {
                Icon(.shieldCheck, size: 14, color: Theme.Color.primary600)
                Text("Signed out of other devices for security")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
            )

            Button(action: onContinue) {
                HStack(spacing: Spacing.s1) {
                    Text("Continue to sign in")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                    Icon(.arrowRight, size: 16, color: Theme.Color.appTextInverse)
                }
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity, minHeight: 48)
            }
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .padding(.top, Spacing.s4)
            .accessibilityIdentifier("setPassword.continueBtn")
            .accessibilityLabel("Continue to sign in")
        }
        .padding(.horizontal, Spacing.s5)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("setPassword.successView")
    }

    private func submit() {
        Task { await viewModel.submit(using: auth) }
    }
}

// MARK: - Subcomponents

/// Centered brand lockup — 48pt mark + wordmark. Mirrors the doorway
/// screens' lockup (`LoginView.BrandLockup`) minus the tagline, per the
/// set-password design's tighter header.
private struct SetPasswordBrandLockup: View {
    var body: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.home, size: 48, color: Theme.Color.primary600)
                .accessibilityHidden(true)
            Text("Pantopus")
                .pantopusTextStyle(.h1)
                .foregroundStyle(Theme.Color.appText)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Pantopus")
    }
}

/// Secure auth field with a leading lock, show/hide eye toggle, and a
/// trailing green check when `state == .valid`. The inline helper / match
/// message is rendered by the parent (next to the strength meter), so this
/// field carries border + trailing-icon visuals only.
private struct SecurePasswordField: View {
    let label: String
    @Binding var text: String
    let placeholder: String
    let state: PantopusFieldState
    @Binding var isRevealed: Bool
    let identifier: String
    let onChange: () -> Void

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: 2) {
                Text(label)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text("*")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityHidden(true)
            }

            HStack(spacing: Spacing.s2) {
                Icon(.lock, size: 16, color: lockColor)

                Group {
                    if isRevealed {
                        TextField(placeholder, text: $text)
                            .textContentType(.newPassword)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                    } else {
                        SecureField(placeholder, text: $text)
                            .textContentType(.newPassword)
                    }
                }
                .focused($isFocused)
                .accessibilityLabel(label)
                .accessibilityIdentifier(identifier)
                .onChange(of: text) { _, _ in onChange() }

                if case .valid = state {
                    Icon(.check, size: 18, color: Theme.Color.success)
                }

                Button {
                    isRevealed.toggle()
                } label: {
                    Icon(isRevealed ? .eyeOff : .eye, size: 18, color: Theme.Color.appTextSecondary)
                        .frame(width: 28, height: 28)
                }
                .accessibilityLabel(isRevealed ? "Hide password" : "Show password")
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(borderColor, lineWidth: strokeWidth)
            )
        }
    }

    private var borderColor: SwiftUI.Color {
        switch state {
        case .error: Theme.Color.error
        case .valid: Theme.Color.success
        case .default: isFocused ? Theme.Color.primary600 : Theme.Color.appBorder
        }
    }

    private var lockColor: SwiftUI.Color {
        switch state {
        case .error: Theme.Color.error
        case .valid: Theme.Color.success
        case .default: isFocused ? Theme.Color.primary600 : Theme.Color.appTextSecondary
        }
    }

    private var strokeWidth: CGFloat {
        switch state {
        case .error: 1.5
        case .valid: 1
        case .default: isFocused ? 1.5 : 1
        }
    }
}

/// Three-band strength meter + helper line + Weak/Fair/Strong label. The
/// helper carries the `setPassword.strengthHint` identifier.
private struct PasswordStrengthRow: View {
    let score: Int
    let label: String
    let hint: String

    private var color: SwiftUI.Color {
        switch score {
        case 1: Theme.Color.error
        case 2: Theme.Color.warning
        case 3: Theme.Color.success
        default: Theme.Color.appBorder
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { index in
                    Capsule()
                        .fill(index < score ? color : Theme.Color.appSurfaceSunken)
                        .frame(height: 4)
                }
            }
            HStack(alignment: .firstTextBaseline) {
                Text(hint)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("setPassword.strengthHint")
                Spacer(minLength: Spacing.s2)
                if !label.isEmpty {
                    Text(label)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(color)
                }
            }
        }
    }
}

#Preview("Form") {
    NavigationStack {
        SetNewPasswordView(token: "preview-token")
            .environment(AuthManager.previewSignedOut)
    }
}
