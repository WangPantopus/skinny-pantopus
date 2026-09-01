//
//  LoginView.swift
//  Pantopus
//
//  T6.1b Log-in screen redesigned against `auth-frames.jsx` frame 1
//  (default) and frame 6 (inline error banner on submit failure). Per Q3
//  the v1 surface is email-only, plus browser-based OAuth.
//

// swiftlint:disable file_length

import SwiftUI

struct LoginView: View {
    @Environment(AuthManager.self) private var auth
    @State private var viewModel = LoginViewModel()
    @State private var path: [AuthRoute] = []
    @State private var showPassword: Bool = false
    @State private var deepLink = DeepLinkRouter.shared

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: Spacing.s0) {
                    Spacer(minLength: Spacing.s10)
                    BrandLockup()
                        .padding(.bottom, Spacing.s10)

                    VStack(spacing: Spacing.s2) {
                        Text("WELCOME BACK")
                            .pantopusTextStyle(.overline)
                            .foregroundStyle(Theme.Color.primary600)
                            .tracking(1.2)
                        Text("Log in to Pantopus")
                            .pantopusTextStyle(.h2)
                            .foregroundStyle(Theme.Color.appText)
                            .accessibilityAddTraits(.isHeader)
                        Text("Pick up where you left off on your block.")
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, Spacing.s5)
                    .padding(.bottom, Spacing.s5)

                    if let error = viewModel.errorMessage {
                        ErrorBanner(error: error, onDismiss: viewModel.clearError)
                            .padding(.horizontal, Spacing.s5)
                            .padding(.bottom, Spacing.s3)
                            .accessibilityIdentifier("loginErrorBanner")
                    }

                    if let info = viewModel.infoMessage {
                        HStack(alignment: .top, spacing: Spacing.s2) {
                            Icon(.mail, size: 16, color: Theme.Color.primary600)
                            Text(info)
                                .pantopusTextStyle(.small)
                                .foregroundStyle(Theme.Color.appText)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: Spacing.s0)
                        }
                        .padding(Spacing.s3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.Color.primary100)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .padding(.horizontal, Spacing.s5)
                        .padding(.bottom, Spacing.s3)
                        .accessibilityIdentifier("loginInfoBanner")
                    }

                    OAuthButtonGroup(
                        isLoading: viewModel.isLoading,
                        onGoogle: { signIn(with: .google) },
                        onApple: { signIn(with: .apple) },
                        googleIdentifier: "loginGoogleButton",
                        appleIdentifier: "loginAppleButton"
                    )
                    .padding(.horizontal, Spacing.s5)
                    .padding(.bottom, Spacing.s3)

                    AuthOAuthTermsLine(identifier: "loginLegalTermsLine") { document in
                        path.append(.legal(document))
                    }
                    .padding(.horizontal, Spacing.s5)
                    .padding(.bottom, Spacing.s5)

                    VStack(spacing: Spacing.s3) {
                        PantopusTextField(
                            "Email",
                            text: $viewModel.email,
                            placeholder: "you@email.com",
                            state: viewModel.emailFieldState,
                            keyboardType: .emailAddress,
                            contentType: .emailAddress,
                            identifier: "loginEmailField"
                        )
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onChange(of: viewModel.email) { _, _ in viewModel.clearError() }

                        PasswordField(
                            value: $viewModel.password,
                            isVisible: $showPassword,
                            state: viewModel.passwordFieldState,
                            identifier: "loginPasswordField",
                            onChange: { viewModel.clearError() },
                            trailingLink: ("Forgot password?", { path.append(.forgotPassword) })
                        )
                    }
                    .padding(.horizontal, Spacing.s5)

                    Button(action: signIn) {
                        Group {
                            if viewModel.isLoading {
                                ProgressView()
                                    .tint(Theme.Color.appTextInverse)
                            } else {
                                HStack(spacing: Spacing.s1) {
                                    Text("Log in")
                                        .pantopusTextStyle(.body)
                                        .fontWeight(.semibold)
                                    Icon(.arrowRight, size: 16, color: Theme.Color.appTextInverse)
                                }
                            }
                        }
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .background(
                        viewModel.canSubmit ? Theme.Color.primary600 : Theme.Color.appBorderStrong
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    .padding(.horizontal, Spacing.s5)
                    .padding(.top, Spacing.s5)
                    .disabled(!viewModel.canSubmit)
                    .accessibilityIdentifier("loginSubmitButton")
                    .accessibilityLabel(viewModel.isLoading ? "Signing in" : "Log in")

                    // Unverified sign-in is a dead end without this: the
                    // backend 403s with "Please verify your email before
                    // signing in." (`backend/routes/users.js:1528`) and RN
                    // reveals the same link on that error
                    // (`(auth)/login.tsx:190`).
                    if viewModel.canResendVerification {
                        Button {
                            resendVerification()
                        } label: {
                            Text(
                                viewModel.isResendingVerification
                                    ? "Sending verification…"
                                    : "Resend verification email"
                            )
                            .pantopusTextStyle(.small)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.primary600)
                            .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        .disabled(viewModel.isResendingVerification || viewModel.isLoading)
                        .padding(.horizontal, Spacing.s5)
                        .padding(.top, Spacing.s2)
                        .accessibilityIdentifier("loginResendVerificationButton")
                        .accessibilityLabel("Resend verification email")
                    }

                    HStack(spacing: Spacing.s1) {
                        Text("New to Pantopus?")
                            .pantopusTextStyle(.small)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Button {
                            path.append(.signUp(inviteCode: nil))
                        } label: {
                            Text("Create account")
                                .pantopusTextStyle(.small)
                                .fontWeight(.semibold)
                                .foregroundStyle(Theme.Color.primary600)
                        }
                        .accessibilityIdentifier("loginCreateAccountLink")
                    }
                    .padding(.top, Spacing.s4)

                    Spacer(minLength: Spacing.s10)

                    AuthTrustFooter()
                        .padding(.bottom, Spacing.s4)
                }
                .frame(maxWidth: .infinity)
            }
            .background(Theme.Color.appSurface)
            .navigationBarHidden(true)
            .navigationDestination(for: AuthRoute.self) { route in
                switch route {
                case .login:
                    EmptyView()
                case let .legal(document):
                    LegalContentView(document: document) {
                        if !path.isEmpty { path.removeLast() }
                    }
                    .navigationBarBackButtonHidden(true)
                case let .signUp(inviteCode):
                    SignUpView(
                        inviteCode: inviteCode,
                        onClose: { if !path.isEmpty { path.removeLast() } },
                        onOpenLegal: { document in path.append(.legal(document)) },
                        onSuccess: { email in
                            // Backend hard-gates login on email_confirmed_at
                            // today (see docs/mobile/auth-backend-contracts.md
                            // §"Backend gap discovered"). Route through the
                            // verify-email surface until soft-gate lands;
                            // we hand it the email so the body copy + resend
                            // CTA render correctly.
                            path = [.verifyEmail(email: email, token: nil)]
                        }
                    )
                case .forgotPassword:
                    ForgotPasswordView {
                        if !path.isEmpty { path.removeLast() }
                    }
                case let .resetPassword(token):
                    SetNewPasswordView(
                        token: token,
                        onBack: { if !path.isEmpty { path.removeLast() } },
                        onContinue: { path = [] }
                    )
                case let .verifyEmail(email, token):
                    VerifyEmailView(
                        email: email,
                        token: token,
                        softGate: true,
                        onDone: { path = [] },
                        onChangeEmail: { _ in
                            // Route back to signup so the user can re-enter
                            // an email. The backend's email-change flow is
                            // documented in `docs/mobile/auth-backend-contracts.md`
                            // §2; today we restart signup with the new value.
                            path = [.signUp(inviteCode: nil)]
                        }
                    )
                case let .verifyEmailLanding(token, email):
                    VerifyEmailLandingView(
                        email: email,
                        token: token,
                        // No session after verification (backend revokes it),
                        // so Continue drops back to login to sign in.
                        onContinue: { path = [] },
                        onUseDifferentEmail: { path = [.signUp(inviteCode: nil)] }
                    )
                case let .error(authError):
                    AuthErrorView(
                        error: authError,
                        onRetry: nil
                    ) { if !path.isEmpty { path.removeLast() } }
                }
            }
            .onAppear { consumeAuthDeepLinkIfNeeded() }
            .onChange(of: deepLink.pending) { _, _ in consumeAuthDeepLinkIfNeeded() }
        }
    }

    /// Pulls the `auth/reset-password` / `auth/verify-email` / `join/:code`
    /// destinations off `DeepLinkRouter` and pushes the matching `AuthRoute`
    /// onto the stack. Anything else stays pending for the signed-in router
    /// to consume after sign-in. Idempotent on re-entry.
    private func consumeAuthDeepLinkIfNeeded() {
        guard let pending = deepLink.pending else { return }
        switch pending {
        case let .resetPassword(token):
            _ = deepLink.consume()
            path = [.resetPassword(token: token)]
        case let .verifyEmail(token, email):
            // The email's deep link always carries a token → land on the
            // §1B-2 post-tap landing, not the pre-tap "we sent you a link"
            // surface (which sign-up reaches with token == nil).
            _ = deepLink.consume()
            path = [.verifyEmailLanding(token: token, email: email)]
        case let .joinInvite(code):
            // A referral link opened by a signed-out visitor. RN replaces the
            // login redirect with `/(auth)/register?invite_code=CODE`
            // (`src/app/_layout.tsx:76`), so land straight on Create account
            // with the code carried into the form.
            _ = deepLink.consume()
            path = [.signUp(inviteCode: code)]
        default:
            break
        }
    }

    private func signIn() {
        Task { await viewModel.signIn(using: auth) }
    }

    private func signIn(with provider: OAuthProvider) {
        Task { await viewModel.signIn(with: provider, using: auth) }
    }

    private func resendVerification() {
        Task { await viewModel.resendVerification(using: auth) }
    }
}

// MARK: - Login subcomponents

/// Centered brand lockup — 48pt mark + wordmark + tagline. Mirrors
/// `auth-frames.jsx:75-91`.
private struct BrandLockup: View {
    var body: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.home, size: 48, color: Theme.Color.primary600)
                .accessibilityHidden(true)
            Text("Pantopus")
                .pantopusTextStyle(.h1)
                .foregroundStyle(Theme.Color.appText)
            Text("Your neighborhood, verified.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Pantopus — Your neighborhood, verified.")
    }
}

/// Password input with show/hide eye toggle. Optional trailing link (used
/// for "Forgot password?" inline link in the design).
struct PasswordField: View {
    @Binding var value: String
    @Binding var isVisible: Bool
    let state: PantopusFieldState
    let identifier: String
    let onChange: () -> Void
    /// Optional inline link rendered next to the label — typically
    /// `"Forgot password?"`.
    let trailingLink: (label: String, action: () -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack {
                Text("Password")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                if let trailingLink {
                    Button(action: trailingLink.action) {
                        Text(trailingLink.label)
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.primary600)
                    }
                    .accessibilityIdentifier("loginForgotPasswordLink")
                }
            }

            HStack(spacing: Spacing.s2) {
                Group {
                    if isVisible {
                        TextField("••••••••", text: $value)
                            .textContentType(.password)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                    } else {
                        SecureField("••••••••", text: $value)
                            .textContentType(.password)
                    }
                }
                .accessibilityLabel("Password")
                .accessibilityIdentifier(identifier)
                .onChange(of: value) { _, _ in onChange() }

                Button {
                    isVisible.toggle()
                } label: {
                    Icon(.eye, size: 16, color: Theme.Color.appTextSecondary)
                        .frame(width: 28, height: 28)
                }
                .accessibilityLabel(isVisible ? "Hide password" : "Show password")
                .accessibilityIdentifier("loginPasswordVisibilityToggle")

                if case .error = state {
                    Icon(.alertCircle, size: 18, color: Theme.Color.error)
                } else if case .valid = state {
                    Icon(.check, size: 18, color: Theme.Color.success)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )

            if case let .error(message) = state {
                Text(message)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
            }
        }
    }

    private var borderColor: SwiftUI.Color {
        switch state {
        case .error: Theme.Color.error
        case .valid: Theme.Color.success
        case .default: Theme.Color.appBorder
        }
    }
}

/// Trust footer used at the bottom of every auth surface — mirrors
/// `auth-frames.jsx:247-260`.
struct AuthTrustFooter: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.shieldCheck, size: 12, color: Theme.Color.appTextSecondary)
            Text("Verified by address")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .accessibilityLabel("Verified by address")
    }
}

struct OAuthButtonGroup: View {
    let isLoading: Bool
    let onGoogle: () -> Void
    let onApple: () -> Void
    let googleIdentifier: String
    let appleIdentifier: String

    var body: some View {
        VStack(spacing: Spacing.s2) {
            oauthButton(
                title: "Continue with Google",
                identifier: googleIdentifier,
                action: onGoogle
            )
            oauthButton(
                title: "Continue with Apple",
                identifier: appleIdentifier,
                action: onApple
            )
        }
    }

    private func oauthButton(title: String, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .pantopusTextStyle(.body)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity, minHeight: 48)
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorderStrong, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .disabled(isLoading)
        .accessibilityIdentifier(identifier)
    }
}

@Observable
@MainActor
final class LoginViewModel {
    var email: String = ""
    var password: String = ""
    var isLoading: Bool = false
    /// Typed error surface so the redesigned banner can render an icon +
    /// headline + body rather than a single string. Older callers can read
    /// `errorMessage?.errorDescription` for the legacy stringy form.
    private(set) var errorMessage: AuthError?
    /// Neutral confirmation shown after a successful resend — the backend's
    /// anti-enumeration message (`backend/routes/users.js:3060`).
    private(set) var infoMessage: String?
    /// True while `POST /api/users/resend-verification` is in flight.
    private(set) var isResendingVerification: Bool = false

    var canSubmit: Bool {
        !isLoading && AuthValidation.email(email) == nil && password.count >= 6
    }

    /// The backend blocks an unverified sign-in with 403 "Please verify your
    /// email before signing in." (`backend/routes/users.js:1528`), which maps
    /// to `.serverError(_)`. RN reveals its resend link on the same signal —
    /// any login error whose copy mentions "verify"
    /// (`pantopus/frontend/apps/mobile/src/app/(auth)/login.tsx:58`).
    var canResendVerification: Bool {
        guard let description = errorMessage?.errorDescription else { return false }
        return description.range(of: "verify", options: .caseInsensitive) != nil
    }

    /// `POST /api/users/resend-verification` (route
    /// `backend/routes/users.js:3049`) — mirrors RN
    /// `login.tsx:60`. Requires an email in the field; the response is
    /// always the same generic message whether or not the account exists.
    func resendVerification(using auth: AuthManager) async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = .serverError("Enter your email first to resend verification.")
            return
        }
        guard !isResendingVerification else { return }
        isResendingVerification = true
        infoMessage = nil
        defer { isResendingVerification = false }
        do {
            try await auth.resendVerification(email: trimmed.lowercased())
            infoMessage = "If that email exists, a verification email has been sent."
        } catch let error as AuthError {
            errorMessage = error
            Observability.shared.capture(error)
        } catch {
            errorMessage = .serverError("Could not resend verification email.")
            Observability.shared.capture(error)
        }
    }

    var emailFieldState: PantopusFieldState {
        guard !email.isEmpty, errorMessage != nil else { return .default }
        // Don't mark the email field red on a generic login error; only
        // when the local-only validator fails.
        if let message = AuthValidation.email(email) {
            return .error(message)
        }
        return .default
    }

    var passwordFieldState: PantopusFieldState {
        guard errorMessage != nil else { return .default }
        return .error("")
    }

    func signIn(using auth: AuthManager) async {
        clearError()
        isLoading = true
        defer { isLoading = false }
        do {
            try await auth.signIn(email: email.lowercased(), password: password)
        } catch let error as AuthError {
            errorMessage = error
            Observability.shared.capture(error)
        } catch {
            errorMessage = .unknown
            Observability.shared.capture(error)
        }
    }

    func signIn(with provider: OAuthProvider, using auth: AuthManager) async {
        clearError()
        isLoading = true
        defer { isLoading = false }
        do {
            try await auth.signIn(with: provider)
        } catch OAuthWebAuthenticationError.cancelled {
            return
        } catch let error as AuthError {
            errorMessage = error
            Observability.shared.capture(error)
        } catch {
            errorMessage = .unknown
            Observability.shared.capture(error)
        }
    }

    func clearError() {
        if errorMessage != nil {
            errorMessage = nil
        }
        if infoMessage != nil {
            infoMessage = nil
        }
    }
}

#Preview {
    LoginView()
        .environment(AuthManager.shared)
}
