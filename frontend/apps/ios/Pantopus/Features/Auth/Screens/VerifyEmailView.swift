//
//  VerifyEmailView.swift
//  Pantopus
//
//  A18.1 "Verify Email Sent" — the post-signup surface. Renders the
//  designed `StatusWaitingContent.checkYourEmail` frame (halo + headline +
//  status pill + Open Mail / Resend / Use a different email stack +
//  footnote) rather than the older bespoke mail-disc layout it replaced.
//
//  The verification email's deep link lands on `VerifyEmailLandingView`
//  (§1B-2), so in production this screen is always reached with
//  `token == nil`. The token path is kept because the route still accepts
//  one: when present the view-model fires `AuthManager.verifyEmail` on
//  appear and the banner reports progress.
//
//  Per Q4 (soft-gate decision) `softGate` shows the design's back control
//  so the user can leave without verifying; hard-gate hosts pass `false`.
//

import Combine
import SwiftUI
import UIKit

struct VerifyEmailView: View {
    @Environment(AuthManager.self) private var auth
    @State private var viewModel: VerifyEmailViewModel
    @State private var showChangeEmailSheet: Bool = false
    /// Heartbeat for the wall-clock resend countdown.
    @State private var now = Date()
    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    let onDone: () -> Void
    let onChangeEmail: ((String) -> Void)?

    /// - Parameters:
    ///   - email: Address the verification link was sent to. Surfaced in
    ///     the body copy; passed to the resend endpoint.
    ///   - token: Hashed Supabase OTP from the verification link.
    ///     When non-nil, the screen auto-verifies on appear.
    ///   - softGate: When true (Q4 = soft-gate, the active decision) shows
    ///     the A18.1 back control so the user can leave without verifying.
    ///     Hard-gate hosts pass `false` to hide it.
    ///   - onDone: Tapped when the user either completes verification or
    ///     backs out of the surface. Host pops the auth stack.
    ///   - onChangeEmail: Optional handoff for "Use a different email" —
    ///     host should route back to the create-account flow.
    init(
        email: String? = nil,
        token: String? = nil,
        softGate: Bool = true,
        onDone: @escaping () -> Void = {},
        onChangeEmail: ((String) -> Void)? = nil
    ) {
        _viewModel = State(
            initialValue: VerifyEmailViewModel(
                email: email,
                token: token,
                softGate: softGate
            )
        )
        self.onDone = onDone
        self.onChangeEmail = onChangeEmail
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            if let banner = bannerCopy { bannerLine(banner) }
            StatusWaitingView(
                content: statusContent,
                onStackAction: handleStackAction
            )
        }
        .background(Theme.Color.appSurface)
        .navigationBarHidden(true)
        .accessibilityIdentifier("verifyEmailScreen")
        .task {
            await viewModel.verifyOnAppearIfNeeded(using: auth)
        }
        .onReceive(ticker) { tick in
            // The resend cooldown is wall-clock based, so the disabled
            // button's "Resend in m:ss" label needs a heartbeat to redraw.
            if viewModel.cooldownRemaining(now: tick) != nil || viewModel.cooldownRemaining(now: now) != nil {
                now = tick
            }
        }
        .onChange(of: viewModel.didComplete) { _, complete in
            if complete { onDone() }
        }
        .sheet(isPresented: $showChangeEmailSheet) {
            ChangeEmailSheet(
                current: viewModel.email ?? "",
                onCancel: { showChangeEmailSheet = false },
                onSubmit: { newEmail in
                    showChangeEmailSheet = false
                    onChangeEmail?(newEmail)
                }
            )
        }
    }

    /// A18.1's back-chevron + title bar. The chevron is the soft-gate exit
    /// ("verify later"); hard-gate hosts pass `softGate: false` and it hides.
    private var topBar: some View {
        ZStack {
            Text("Check your email")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            HStack {
                if viewModel.softGate {
                    Button(action: onDone) {
                        Icon(.chevronLeft, size: 20, strokeWidth: 2.2, color: Theme.Color.appText)
                            .frame(width: 36, height: 36)
                    }
                    .accessibilityLabel("Back")
                    .accessibilityIdentifier("verifyEmailBackButton")
                }
                Spacer()
                Color.clear.frame(width: 36, height: 36)
            }
            .padding(.horizontal, 10)
        }
        .frame(height: 52)
        .background(Theme.Color.appSurface)
    }

    /// The A18.1 frame. `resent` flips the pill to the green "New link sent"
    /// confirmation and swaps Resend for the disabled countdown variant.
    private var statusContent: StatusWaitingContent {
        let remaining = viewModel.cooldownRemaining(now: now)
        return .checkYourEmail(
            email: viewModel.email,
            resent: remaining != nil,
            resendCountdown: Self.countdownLabel(remaining ?? 0)
        )
    }

    /// "0:42" — minutes:seconds, matching the design frame.
    static func countdownLabel(_ remaining: TimeInterval) -> String {
        let total = max(0, Int(remaining.rounded(.up)))
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    private func handleStackAction(_ button: StatusActionButton) {
        switch button.actionKey {
        case "open_mail":
            openMailApp()
        case "resend_email":
            resend()
        case "change_email":
            showChangeEmailSheet = true
        default:
            break
        }
    }

    private struct BannerCopy {
        let text: String
        let color: SwiftUI.Color
        let background: SwiftUI.Color
    }

    private func bannerLine(_ banner: BannerCopy) -> some View {
        Text(banner.text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(banner.color)
            .multilineTextAlignment(.center)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .frame(maxWidth: .infinity)
            .background(banner.background)
            .accessibilityIdentifier("verifyEmailBanner")
    }

    /// Only states the A18.1 frame can't express itself: the deep-link
    /// verify progress and any error. "Resent" is covered by the pill.
    private var bannerCopy: BannerCopy? {
        if viewModel.isVerifying {
            return BannerCopy(
                text: "Verifying your email…",
                color: Theme.Color.primary700,
                background: Theme.Color.primary50
            )
        }
        if viewModel.didVerify {
            return BannerCopy(
                text: "Email verified. You can now sign in.",
                color: Theme.Color.success,
                background: Theme.Color.successBg
            )
        }
        if let error = viewModel.errorMessage {
            return BannerCopy(
                text: error.errorDescription ?? "Something went wrong.",
                color: Theme.Color.error,
                background: Theme.Color.errorBg
            )
        }
        return nil
    }

    private func resend() {
        Task { await viewModel.resend(using: auth) }
    }

    /// Open the user's preferred mail app via the `mailto:` URL scheme.
    /// `UIApplication.shared.open` falls back silently when no mail app
    /// is installed (`canOpenURL` returns false on simulator without an
    /// account, but the open call is harmless).
    private func openMailApp() {
        guard let url = URL(string: "mailto:") else { return }
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
        Observability.shared.track("auth.verify.open_mail_tapped")
    }
}

private struct ChangeEmailSheet: View {
    let current: String
    let onCancel: () -> Void
    let onSubmit: (String) -> Void
    @State private var draft: String = ""

    var body: some View {
        VStack(spacing: Spacing.s4) {
            HStack {
                Button("Cancel", action: onCancel)
                    .accessibilityIdentifier("verifyEmailChangeCancel")
                Spacer()
                Text("Change email")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                Spacer()
                Button("Submit") { onSubmit(draft) }
                    .disabled(AuthValidation.email(draft) != nil)
                    .accessibilityIdentifier("verifyEmailChangeSubmit")
            }
            Text("We'll restart signup so you can verify a different address.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            PantopusTextField(
                "New email",
                text: $draft,
                placeholder: "you@email.com",
                state: draft.isEmpty ? .default : (AuthValidation.email(draft).map(PantopusFieldState.error) ?? .default),
                keyboardType: .emailAddress,
                contentType: .emailAddress,
                identifier: "verifyEmailChangeField"
            )
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            Spacer()
        }
        .padding(Spacing.s4)
        .onAppear { draft = current }
        .presentationDetents([.medium])
    }
}

@Observable
@MainActor
final class VerifyEmailViewModel {
    let email: String?
    let token: String?
    let softGate: Bool

    private(set) var isVerifying: Bool = false
    private(set) var didVerify: Bool = false
    private(set) var didResend: Bool = false
    private(set) var isResending: Bool = false
    private(set) var didComplete: Bool = false
    private(set) var errorMessage: AuthError?
    /// Earliest wall-clock time the user may resend at. Drives the
    /// client-side cooldown label and short-circuits redundant requests.
    private(set) var resendCooldownUntil: Date?
    private var hasAutoVerified: Bool = false

    /// Cooldown between successful resends. Matches the web's value.
    static let resendCooldown: TimeInterval = 30

    init(email: String?, token: String?, softGate: Bool) {
        self.email = email
        self.token = token
        self.softGate = softGate
    }

    /// True when the resend CTA is tappable (no in-flight call AND no
    /// active cooldown AND we have an email to resend to).
    var canResend: Bool {
        !isResending && cooldownRemaining(now: Date()) == nil && (email?.isEmpty == false)
    }

    /// Returns the number of seconds remaining in the cooldown, or nil
    /// if the cooldown is inactive. View renders this as
    /// "Resend in Ns".
    func cooldownRemaining(now: Date) -> TimeInterval? {
        guard let until = resendCooldownUntil else { return nil }
        let delta = until.timeIntervalSince(now)
        return delta > 0 ? delta : nil
    }

    /// Fired from `.task` once per appearance. If a token was supplied
    /// (verification-email deep-link path), POST it to the backend.
    func verifyOnAppearIfNeeded(using auth: AuthManager) async {
        guard let token, !hasAutoVerified else { return }
        hasAutoVerified = true
        isVerifying = true
        defer { isVerifying = false }
        do {
            try await auth.verifyEmail(token: token)
            didVerify = true
            // Bounce back to login after a beat so the user reads the
            // success banner.
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            didComplete = true
        } catch let error as AuthError {
            errorMessage = error
            Observability.shared.capture(error)
        } catch {
            errorMessage = .unknown
            Observability.shared.capture(error)
        }
    }

    /// Re-sends the verification email. Honours the local cooldown so
    /// repeated taps don't pile on the backend rate limiter.
    func resend(using auth: AuthManager, now: Date = Date()) async {
        guard !isResending,
              cooldownRemaining(now: now) == nil,
              let email,
              !email.isEmpty
        else { return }
        clearError()
        isResending = true
        didResend = false
        defer { isResending = false }
        do {
            try await auth.resendVerification(email: email)
            didResend = true
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

#Preview("Post-signup soft-gate") {
    NavigationStack {
        VerifyEmailView(email: "alice@example.com")
            .environment(AuthManager.previewSignedOut)
    }
}

#Preview("Deep-link landing") {
    NavigationStack {
        VerifyEmailView(email: "alice@example.com", token: "hashed-token-preview")
            .environment(AuthManager.previewSignedOut)
    }
}
