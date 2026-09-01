//
//  VerifyEmailLandingViewModel.swift
//  Pantopus
//
//  §1B-2 — Verify email DEEP-LINK LANDING (verify-email-frames.jsx). The
//  screen the app opens when the user taps the link in their verification
//  email — distinct from A18.1 "Verify Email Sent" (the pre-tap "we sent
//  you a link" surface, `Features/Auth/Screens/VerifyEmailView.swift`).
//
//  A18 status archetype, collapsed (no timeline — the token check is
//  instant). On appear it POSTs the link's hashed token to the existing
//  verify-email endpoint and walks three phases:
//
//    verifying → success   (token accepted)
//    verifying → expired   (token rejected / missing / network error)
//
//  The expired phase offers a Resend (re-uses the resend-verification
//  endpoint, honouring the same 30s cooldown as A18.1) plus a "use a
//  different email" handoff back to sign-up.
//

import Foundation

@Observable
@MainActor
final class VerifyEmailLandingViewModel {
    /// The three post-tap outcomes the design frames. `verifying` is the
    /// transient loading moment; `success` / `expired` are terminal.
    enum Phase: Equatable {
        case verifying
        case success
        case expired
    }

    /// Transient confirmation surfaced after a Resend tap. `isError`
    /// drives the toast tint (success vs. failure copy).
    struct ResendToast: Equatable {
        let message: String
        let isError: Bool
    }

    let email: String?
    let token: String?

    private(set) var phase: Phase = .verifying
    private(set) var isResending: Bool = false
    private(set) var toast: ResendToast?
    /// Earliest wall-clock time the user may resend at. Drives the local
    /// cooldown and short-circuits redundant requests, matching A18.1.
    private(set) var resendCooldownUntil: Date?
    private var hasVerified: Bool = false

    /// Cooldown between successful resends. Matches A18.1 / the web's value.
    static let resendCooldown: TimeInterval = 30

    init(email: String? = nil, token: String? = nil) {
        self.email = email?.isEmpty == false ? email : nil
        self.token = token?.isEmpty == false ? token : nil
    }

    /// Recipient surfaced in the body copy + targeted by the resend CTA.
    var recipient: String {
        email ?? "your email"
    }

    /// True when the Resend CTA is tappable (no in-flight call AND no
    /// active cooldown AND we have an email to resend to).
    var canResend: Bool {
        !isResending && cooldownRemaining(now: Date()) == nil && email != nil
    }

    /// Seconds remaining in the cooldown, or nil if inactive.
    func cooldownRemaining(now: Date) -> TimeInterval? {
        guard let until = resendCooldownUntil else { return nil }
        let delta = until.timeIntervalSince(now)
        return delta > 0 ? delta : nil
    }

    /// Fired once from `.task`. POSTs the link's token to the backend and
    /// resolves the terminal phase. A missing token (defensive — the deep
    /// link always carries one) lands straight on `expired`.
    func verifyOnAppearIfNeeded(using auth: AuthManager) async {
        guard !hasVerified else { return }
        hasVerified = true
        guard let token else {
            phase = .expired
            return
        }
        phase = .verifying
        do {
            try await auth.verifyEmail(token: token)
            phase = .success
            Observability.shared.track("auth.verify.landing_success")
        } catch let error as AuthError {
            phase = .expired
            Observability.shared.capture(error)
        } catch {
            phase = .expired
            Observability.shared.capture(error)
        }
    }

    /// Re-sends the verification email, honouring the local cooldown so a
    /// frustrated double-tap doesn't pile on the backend rate limiter.
    /// Surfaces a confirmation toast on success and the error copy on
    /// failure.
    func resend(using auth: AuthManager, now: Date = Date()) async {
        guard !isResending,
              cooldownRemaining(now: now) == nil,
              let email
        else { return }
        toast = nil
        isResending = true
        defer { isResending = false }
        do {
            try await auth.resendVerification(email: email)
            resendCooldownUntil = now.addingTimeInterval(Self.resendCooldown)
            toast = ResendToast(message: "Verification email sent.", isError: false)
            Observability.shared.track("auth.verify.landing_resent")
        } catch let error as AuthError {
            toast = ResendToast(message: error.errorDescription ?? "Couldn't resend. Try again.", isError: true)
            Observability.shared.capture(error)
        } catch {
            toast = ResendToast(message: AuthError.unknown.errorDescription ?? "Couldn't resend.", isError: true)
            Observability.shared.capture(error)
        }
    }

    func clearToast() {
        if toast != nil { toast = nil }
    }

    // MARK: - Preview / test seam

    /// Builds a view-model parked in a specific phase without firing the
    /// network — used by `#Preview`s and snapshot/UI hosts. `hasVerified`
    /// is pre-set so the screen's `.task` is a no-op.
    static func preview(_ phase: Phase, email: String? = "jordan@hey.com") -> VerifyEmailLandingViewModel {
        let model = VerifyEmailLandingViewModel(email: email, token: "preview-token")
        model.phase = phase
        model.hasVerified = true
        return model
    }
}
