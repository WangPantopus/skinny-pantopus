//
//  ForgotPasswordView.swift
//  Pantopus
//
//  T6.1c P5 — Forgot password (auth-frames.jsx frame 3). Single email
//  field + primary "Send reset link" CTA. On success transitions to the
//  shared Status/Wait "Check your email" surface (StatusWaitingView with
//  `.resetLinkSent(email:)` content). Resend is rate-limited client-side
//  (30s cooldown) on top of the backend's `forgotPasswordLimiter`. Ghost
//  CTA on the status screen pops back to login.
//

import SwiftUI

struct ForgotPasswordView: View {
    @Environment(AuthManager.self) private var auth
    @State private var viewModel = ForgotPasswordViewModel()
    let onBack: () -> Void

    init(onBack: @escaping () -> Void = {}) {
        self.onBack = onBack
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForgotPasswordTopBar(onBack: onBack)
            switch viewModel.phase {
            case .form:
                formBody
            case let .sent(email):
                StatusWaitingView(
                    content: .resetLinkSent(email: email),
                    onPrimary: { _ in resend(email: email) },
                    onSecondary: { _ in onBack() }
                )
                .accessibilityIdentifier("forgotPasswordSentStatus")
            }
        }
        .background(Theme.Color.appSurface)
        .navigationBarHidden(true)
        .accessibilityIdentifier("forgotPasswordScreen")
    }

    private var formBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s5) {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text("Reset your password")
                        .pantopusTextStyle(.h2)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text("Enter your email and we'll send you a link to reset it.")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.top, Spacing.s5)

                if let error = viewModel.errorMessage {
                    ErrorBanner(error: error, onDismiss: viewModel.clearError)
                        .accessibilityIdentifier("forgotPasswordErrorBanner")
                }

                PantopusTextField(
                    "Email",
                    text: $viewModel.email,
                    placeholder: "you@email.com",
                    state: viewModel.emailFieldState,
                    keyboardType: .emailAddress,
                    contentType: .emailAddress,
                    identifier: "forgotPasswordEmailField"
                )
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .onChange(of: viewModel.email) { _, _ in viewModel.clearError() }

                Button(action: submit) {
                    Group {
                        if viewModel.isLoading {
                            ProgressView().tint(Theme.Color.appTextInverse)
                        } else {
                            Text("Send reset link")
                                .pantopusTextStyle(.body)
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.Color.appTextInverse)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 48)
                }
                .background(viewModel.canSubmit ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .disabled(!viewModel.canSubmit)
                .accessibilityIdentifier("forgotPasswordSubmitButton")
                .accessibilityLabel(viewModel.isLoading ? "Sending reset link" : "Send reset link")

                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.bottom, Spacing.s5)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func submit() {
        Task { await viewModel.requestReset(using: auth) }
    }

    private func resend(email: String) {
        Task { await viewModel.resend(email: email, using: auth) }
    }
}

private struct ForgotPasswordTopBar: View {
    let onBack: () -> Void

    var body: some View {
        ZStack {
            Text("Forgot password")
                .pantopusTextStyle(.body)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            HStack {
                Button(action: onBack) {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Back")
                .accessibilityIdentifier("forgotPasswordBackButton")
                Spacer()
                Color.clear.frame(width: 44, height: 44)
            }
            .padding(.horizontal, Spacing.s2)
        }
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

@Observable
@MainActor
final class ForgotPasswordViewModel {
    enum Phase: Equatable {
        case form
        case sent(email: String)
    }

    var email: String = ""
    private(set) var phase: Phase = .form
    private(set) var isLoading: Bool = false
    private(set) var errorMessage: AuthError?
    /// Earliest wall-clock time the user may resend at. Drives the
    /// client-side cooldown banner; in tests it lets us assert that a
    /// rate-limited request was rejected before reaching the network.
    private(set) var resendCooldownUntil: Date?

    /// Cooldown after a successful send. Matches the web's 30s value.
    static let resendCooldown: TimeInterval = 30

    var canSubmit: Bool {
        !isLoading && AuthValidation.email(email) == nil
    }

    var emailFieldState: PantopusFieldState {
        guard !email.isEmpty else { return .default }
        if let message = AuthValidation.email(email) {
            return .error(message)
        }
        return .default
    }

    /// Submits the initial `/forgot-password` request. On success transitions
    /// to `.sent(email)` and starts the resend cooldown.
    func requestReset(using auth: AuthManager, now: Date = Date()) async {
        let target = email.trimmingCharacters(in: .whitespaces).lowercased()
        if AuthValidation.email(target) != nil { return }
        clearError()
        isLoading = true
        defer { isLoading = false }
        do {
            try await auth.forgotPassword(email: target)
            phase = .sent(email: target)
            resendCooldownUntil = now.addingTimeInterval(Self.resendCooldown)
        } catch let error as AuthError {
            errorMessage = error
            Observability.shared.capture(error)
        } catch {
            errorMessage = .unknown
            Observability.shared.capture(error)
        }
    }

    /// Re-sends the reset email from the status screen. Honours the local
    /// cooldown so a frustrated tap doesn't pile on the backend rate
    /// limiter. Returns silently if the cooldown hasn't elapsed.
    func resend(email: String, using auth: AuthManager, now: Date = Date()) async {
        if let until = resendCooldownUntil, until > now { return }
        isLoading = true
        defer { isLoading = false }
        do {
            try await auth.forgotPassword(email: email)
            resendCooldownUntil = now.addingTimeInterval(Self.resendCooldown)
        } catch let error as AuthError {
            errorMessage = error
            Observability.shared.capture(error)
        } catch {
            errorMessage = .unknown
            Observability.shared.capture(error)
        }
    }

    func clearError() {
        if errorMessage != nil { errorMessage = nil }
    }
}

#Preview {
    NavigationStack {
        ForgotPasswordView {}
            .environment(AuthManager.previewSignedOut)
    }
}
