//
//  AuthRouter.swift
//  Pantopus
//
//  Typed destinations for the signed-out experience. The login surface owns
//  a `NavigationStack(path:)` and dispatches on these cases. P4 and P5 fill
//  in each destination's body.
//

import Foundation

/// Routes within the signed-out auth flow. `Hashable` so the cases can
/// drive a SwiftUI `NavigationPath`.
public enum AuthRoute: Hashable, Sendable {
    /// Default — handled in-place by `LoginView`'s body, not via destination.
    case login
    /// Create account (P4). `inviteCode` is non-nil only when the screen was
    /// reached from a `pantopus://join/:code` deep link — it pre-fills the
    /// optional Invite code field and rides the register call as
    /// `invite_code`, mirroring RN's
    /// `/(auth)/register?invite_code=CODE`
    /// (`pantopus/frontend/apps/mobile/src/app/(auth)/register.tsx:25,129`).
    case signUp(inviteCode: String? = nil)
    /// Forgot password — request a reset email (P4).
    case forgotPassword
    /// Reset password — landed on via the email deep link with the hashed
    /// recovery `token` (P5).
    case resetPassword(token: String)
    /// Check-your-email surface (P5). `email` is rendered in the body
    /// copy + used by the resend CTA. `token` is set when the route was
    /// reached via the verification email's deep link, in which case the
    /// screen auto-verifies on appear.
    case verifyEmail(email: String? = nil, token: String? = nil)
    /// §1B-2 — Verify-email DEEP-LINK LANDING (the post-tap result screen,
    /// distinct from A18.1 "Verify Email Sent" above). Reached only via the
    /// verification email's deep link, so `token` is always present; the
    /// landing confirms it on appear and shows verifying → success / expired.
    case verifyEmailLanding(token: String, email: String? = nil)
    /// Generic auth error / banner detail screen (P4).
    case error(AuthError)
    /// A19 legal document opened from a signed-out consent sentence
    /// (login OAuth line, sign-up Terms checkbox). RN pushes
    /// `/legal/terms` / `/legal/privacy` from the same taps
    /// (`src/app/(auth)/register.tsx:327,334`).
    case legal(LegalDocument)
}
