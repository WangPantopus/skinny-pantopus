//
//  SetNewPasswordViewModel.swift
//  Pantopus
//
//  §1B-1 — "Set a new password" (set-password-frames.jsx). The screen
//  reached from the password-reset email deep link
//  (`pantopus://auth/reset-password?token=…`). `token` is the hashed
//  Supabase recovery token, parsed from the deep link by `DeepLinkRouter`
//  and handed in as an init arg.
//
//  Submit is gated on the two passwords matching AND the new password
//  passing the same client-side strength rules as signup (≥ 8 chars, ≥ 1
//  letter, ≥ 1 number — `AuthValidation.password`). The 3-bar meter and
//  the helper line communicate *how* strong; the green field check
//  communicates *acceptable*. On success the view flips to the bespoke
//  "Password updated" confirmation whose CTA routes back to sign in.
//
//  Reuses the existing `/api/users/reset-password` endpoint via
//  `AuthManager.resetPassword(token:newPassword:)` — no new networking.
//

import SwiftUI

@Observable
@MainActor
final class SetNewPasswordViewModel {
    enum Phase: Equatable {
        case form
        case success
    }

    /// Confirm-field match state, surfaced as the inline match hint.
    enum ConfirmMatch: Equatable {
        case none
        case match
        case mismatch
    }

    let token: String
    var password: String = ""
    var confirmPassword: String = ""
    private(set) var phase: Phase = .form
    private(set) var isLoading: Bool = false
    private(set) var errorMessage: AuthError?

    init(token: String) {
        self.token = token
    }

    /// True when the new password passes the shared client-side strength
    /// rules (≥ 8 chars, ≥ 1 letter, ≥ 1 number — same as signup).
    var passwordsMeetStrength: Bool {
        AuthValidation.password(password) == nil
    }

    var passwordsMatch: Bool {
        !confirmPassword.isEmpty && password == confirmPassword
    }

    var canSubmit: Bool {
        !isLoading && passwordsMeetStrength && passwordsMatch && !token.isEmpty
    }

    /// 0 none · 1 weak · 2 fair · 3 strong.
    var passwordStrength: Int {
        AuthValidation.passwordStrength(password)
    }

    var passwordStrengthLabel: String {
        switch passwordStrength {
        case 1: "Weak"
        case 2: "Fair"
        case 3: "Strong"
        default: ""
        }
    }

    /// Helper line under the new-password field. Praise once the meter
    /// reaches "Strong"; otherwise the guiding rule. Two-state per the
    /// design (`Use 8+ …` → `Great — …`).
    var strengthHint: String {
        passwordStrength >= 3
            ? "Great — long, with a number and a symbol."
            : "Use 8+ characters with a number and a symbol."
    }

    /// Green check once the new password is acceptable; otherwise neutral
    /// (the meter carries the "still weak" signal).
    var newPasswordFieldState: PantopusFieldState {
        passwordsMeetStrength ? .valid : .default
    }

    var confirmMatch: ConfirmMatch {
        if confirmPassword.isEmpty { return .none }
        return passwordsMatch ? .match : .mismatch
    }

    var confirmFieldState: PantopusFieldState {
        switch confirmMatch {
        case .none: .default
        case .match: .valid
        case .mismatch: .error("")
        }
    }

    func submit(using auth: AuthManager) async {
        guard canSubmit else { return }
        clearError()
        isLoading = true
        defer { isLoading = false }
        do {
            try await auth.resetPassword(token: token, newPassword: password)
            phase = .success
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
