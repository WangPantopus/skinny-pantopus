//
//  ContinueAsViewModel.swift
//  Pantopus
//
//  State for the "Continue as X" card (design §3 state B, §7.3): the
//  remembered account whose tokens survived a reinstall (or went dormant)
//  must confirm presence once — Face ID / Touch ID / passcode via
//  `AuthManager.resume()` — before the session is live again. Never a
//  password, never a wipe. Mirrors Android `ContinueAsViewModel`.
//

import Foundation
import Observation

@Observable
@MainActor
final class ContinueAsViewModel {
    /// What the card is doing. Drives the primary button's spinner and
    /// disables the secondary actions while a round-trip is in flight.
    enum Phase: Equatable {
        case idle
        case resuming
        case removing
    }

    /// The account shown on the card (avatar / name / masked email).
    let hint: AccountHint

    private(set) var phase: Phase = .idle
    /// Inline error under the primary button — transient failures and OS
    /// prompt errors. Cleared on the next tap.
    private(set) var errorMessage: String?
    /// "You were signed out for security…" when the previous session ended
    /// with a security code (`AuthManager.sessionEndReason`). Read at init
    /// and after each resume attempt.
    private(set) var securityMessage: String?
    /// Set by "Use a different account": the host swaps the card for the
    /// signed-out front door while the stored tokens stay in place until
    /// the new login supersedes them (`persistLoginResponse`).
    private(set) var wantsDifferentAccount = false

    init(hint: AccountHint, sessionEndReason: SessionEndReason? = nil) {
        self.hint = hint
        securityMessage = sessionEndReason?.message
    }

    var isBusy: Bool {
        phase != .idle
    }

    /// First name for the headline — "Continue as Ying"; falls back to the
    /// masked email, then a neutral label.
    var headline: String {
        if let name = Self.firstName(of: hint.displayName) {
            return "Continue as \(name)"
        }
        if let email = hint.maskedEmail, !email.isEmpty {
            return "Continue as \(email)"
        }
        return "Continue signed in"
    }

    /// Secondary line under the headline.
    var subtitle: String? {
        guard let email = hint.maskedEmail, !email.isEmpty else { return nil }
        // Avoid repeating the email when it is already the headline.
        return Self.firstName(of: hint.displayName) == nil ? nil : email
    }

    /// Initials for the avatar fallback.
    var initials: String {
        let parts = (hint.displayName ?? "")
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map(String.init) }
        if !parts.isEmpty {
            return parts.joined().uppercased()
        }
        if let first = hint.maskedEmail?.first {
            return String(first).uppercased()
        }
        return "?"
    }

    // MARK: - Actions

    /// "Continue": OS presence check → DPoP refresh → profile. The outcome
    /// is returned for the host (state transitions happen inside
    /// `AuthManager`; the card only renders errors).
    @discardableResult
    func continueSignedIn(using auth: AuthManager) async -> ResumeOutcome {
        guard phase == .idle else { return .cancelled }
        errorMessage = nil
        phase = .resuming
        defer { phase = .idle }
        let outcome = await auth.resume()
        switch outcome {
        case .signedIn:
            break
        case .cancelled:
            // The user dismissed the OS prompt — nothing to say.
            break
        case .noOsLock:
            // No passcode / biometrics: `AuthManager` already fell back to
            // `.signedOut` (L3). Land the user on the login form directly
            // rather than the Place funnel.
            DeepLinkRouter.shared.requestLoginPresentation()
        case let .rejected(reason):
            // Tokens wiped, hint kept, now `.signedOut`. The login screen
            // shows the reason ("signed out for security" vs expiry).
            securityMessage = reason.message
            DeepLinkRouter.shared.requestLoginPresentation()
        case .transient:
            errorMessage = "Can't reach Pantopus right now. Check your connection and try again."
        case let .failed(message):
            errorMessage = message
        }
        return outcome
    }

    /// "Use a different account": keep this account's tokens + hint; the
    /// host shows the login front door. A successful login supersedes the
    /// stored session (revoked with proof in the background).
    func useDifferentAccount() {
        guard phase == .idle else { return }
        errorMessage = nil
        wantsDifferentAccount = true
        DeepLinkRouter.shared.requestLoginPresentation()
        Observability.shared.track("session_resume_switch_account")
    }

    /// "Not you? Remove": revoke the stored session with proof, wipe the
    /// tokens and the hint. Ends in `.signedOut` (the host swaps screens).
    func removeAccount(using auth: AuthManager) async {
        guard phase == .idle else { return }
        errorMessage = nil
        phase = .removing
        defer { phase = .idle }
        await auth.removeRememberedAccount(userId: hint.userId)
        DeepLinkRouter.shared.requestLoginPresentation()
    }

    func clearError() {
        errorMessage = nil
    }

    /// Dismiss the "signed out for security" banner (Android
    /// `securityBannerDismiss`). It stays dismissed for this card instance;
    /// `AuthManager.sessionEndReason` is only cleared by the next
    /// successful sign-in, so a later `rejected` outcome can still set it.
    func dismissSecurityMessage() {
        securityMessage = nil
    }

    // MARK: - Helpers

    static func firstName(of displayName: String?) -> String? {
        guard let displayName else { return nil }
        let trimmed = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = trimmed.split(separator: " ").first, !first.isEmpty else { return nil }
        return String(first)
    }
}
