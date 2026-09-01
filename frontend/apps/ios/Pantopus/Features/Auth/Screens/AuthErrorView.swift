//
//  AuthErrorView.swift
//  Pantopus
//
//  T6.1b — full-screen auth error surface. Used when a non-form auth flow
//  (verify email, refresh, deep-link reset) surfaces an `AuthError` and
//  there's no host form to render the inline banner against.
//
//  Maps each `AuthError` case to a user-facing headline + body via
//  `AuthErrorViewModel.copy(for:)`. Retryable errors expose "Try again"
//  via the caller-supplied `onRetry` hook; if no retry is available the
//  primary CTA becomes "Go back".
//

import SwiftUI

struct AuthErrorView: View {
    let error: AuthError
    /// Caller-supplied retry hook. When nil, the primary CTA degrades to
    /// "Go back" so the screen still gives the user a way out.
    let onRetry: (() -> Void)?
    let onBack: () -> Void

    @State private var viewModel = AuthErrorViewModel()

    var body: some View {
        let copy = AuthErrorViewModel.copy(for: error)
        VStack(spacing: Spacing.s5) {
            Spacer(minLength: Spacing.s0)
            Icon(.alertCircle, size: 56, color: Theme.Color.error)
                .padding(.bottom, Spacing.s2)
                .accessibilityHidden(true)

            VStack(spacing: Spacing.s2) {
                Text(copy.headline)
                    .pantopusTextStyle(.h2)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                Text(copy.body)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.s5)
            }

            Spacer(minLength: Spacing.s0)

            VStack(spacing: Spacing.s2) {
                if let onRetry, viewModel.isRetryable(error) {
                    Button("Try again", action: onRetry)
                        .buttonStyle(AuthPrimaryButtonStyle())
                        .accessibilityIdentifier("authErrorRetryButton")
                }
                Button("Go back", action: onBack)
                    .buttonStyle(AuthGhostButtonStyle())
                    .accessibilityIdentifier("authErrorBackButton")
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.bottom, Spacing.s5)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("authErrorScreen")
    }
}

/// Headline + body pair surfaced by `AuthErrorView`. Pure value so the
/// view-model is testable without driving the SwiftUI layer.
public struct AuthErrorCopy: Equatable, Sendable {
    public let headline: String
    public let body: String
}

@Observable
@MainActor
public final class AuthErrorViewModel {
    public init() {}

    /// User-facing copy for each `AuthError` case. The body intentionally
    /// avoids server message strings — translation-friendlier and prevents
    /// PII / SQL leaking through error reflection.
    public static func copy(for error: AuthError) -> AuthErrorCopy {
        switch error {
        case .invalidCredentials:
            AuthErrorCopy(
                headline: "Couldn't sign you in",
                body: "Double-check your email and password, then try again."
            )
        case .emailAlreadyExists:
            AuthErrorCopy(
                headline: "Email already in use",
                body: "Try signing in instead, or use a different email."
            )
        case .weakPassword:
            AuthErrorCopy(
                headline: "Pick a stronger password",
                body: "At least 8 characters, with a mix of letters and numbers."
            )
        case .networkError:
            AuthErrorCopy(
                headline: "Can't reach Pantopus",
                body: "Check your connection and try again."
            )
        case .rateLimited:
            AuthErrorCopy(
                headline: "Too many attempts",
                body: "Take a breath and try again in a moment."
            )
        case .serverError:
            AuthErrorCopy(
                headline: "Something went wrong",
                body: "We hit a snag on our end. Give it another try."
            )
        case .unknown:
            AuthErrorCopy(
                headline: "Something went wrong",
                body: "We're not sure what happened. Try again or go back."
            )
        }
    }

    /// Whether the user should be offered "Try again" for this error.
    /// `emailAlreadyExists` and `invalidCredentials` aren't retryable —
    /// the user needs to change input first — so we hide the CTA.
    public func isRetryable(_ error: AuthError) -> Bool {
        switch error {
        case .emailAlreadyExists, .invalidCredentials, .weakPassword:
            false
        case .networkError, .rateLimited, .serverError, .unknown:
            true
        }
    }
}

// MARK: - Button styles (auth-local)

/// Full-width 48pt primary button — primary600 fill, white label.
struct AuthPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: PantopusTextStyle.body.size, weight: .semibold))
            .tracking(PantopusTextStyle.body.tracking)
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

/// Outlined ghost button — appSurface fill, appBorderStrong stroke,
/// appText label.
struct AuthGhostButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: PantopusTextStyle.body.size, weight: .semibold))
            .tracking(PantopusTextStyle.body.tracking)
            .foregroundStyle(Theme.Color.appText)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}

#Preview("Network error") {
    AuthErrorView(
        error: .networkError,
        onRetry: {},
        onBack: {}
    )
}

#Preview("Invalid credentials") {
    AuthErrorView(
        error: .invalidCredentials,
        onRetry: {},
        onBack: {}
    )
}
