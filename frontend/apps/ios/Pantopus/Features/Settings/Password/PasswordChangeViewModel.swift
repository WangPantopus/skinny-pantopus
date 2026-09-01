//
//  PasswordChangeViewModel.swift
//  Pantopus
//
//  A13.14 — Settings → Change password (reshape).
//
//  Three-field form: current password (only when the account already
//  has a password — discovered via `GET /api/users/auth-methods`),
//  new password, confirm new password. Submit calls
//  `POST /api/users/password` (users.js:1771).
//
//  Beyond the original three-field form, the reshape adds:
//  - a live `PasswordStrength` for the new password (drives `StrengthMeter`),
//  - breach detection against a small sample list of common passwords
//    (HIBP is out of scope — see `commonPasswords`),
//  - a form-level error banner (`FormBannerContent`) shown after the server
//    rejects a submit,
//  - a quiet identity `ContextBand` (email + last-changed — sample data).
//
//  Validation:
//  - current required when `hasPassword == true`
//  - new ≥ `minPasswordLength` chars (matches `PASSWORD_MIN_LENGTH` = 12 in
//    users.js)
//  - new not on the breach list
//  - new ≠ current (server also enforces; we catch early for clarity)
//  - confirm == new
//

import Foundation
import Observation

@Observable
@MainActor
public final class PasswordChangeViewModel {
    public enum FormState: Sendable, Equatable {
        case loading
        case ready
    }

    public enum FieldKey: String, CaseIterable, Sendable {
        case current, new, confirm
    }

    /// Error-tone banner pinned to the top of the form body after the server
    /// rejects a submit. Cleared at the start of the next submit attempt.
    public struct FormBannerContent: Sendable, Equatable {
        public let title: String
        public let message: String

        public init(title: String, message: String) {
            self.title = title
            self.message = message
        }
    }

    public private(set) var formState: FormState = .loading
    public private(set) var hasPassword: Bool = true
    public private(set) var isSaving: Bool = false
    public var fields: [FieldKey: FormFieldState] = [
        .current: FormFieldState(id: "current", originalValue: ""),
        .new: FormFieldState(id: "new", originalValue: ""),
        .confirm: FormFieldState(id: "confirm", originalValue: "")
    ]
    public private(set) var formError: FormBannerContent?
    public private(set) var toast: String?
    public var shouldDismiss: Bool = false

    /// Identity reminder rendered in the `ContextBand`. Sample data — the
    /// auth-methods endpoint carries neither the email nor a last-changed
    /// timestamp, so these are seeded defaults until the backend exposes them.
    public let accountEmail: String
    public let lastChangedLabel: String

    private let api: APIClient

    init(
        api: APIClient = .shared,
        accountEmail: String = "maria@pantopus.app",
        lastChangedLabel: String = "84 days ago"
    ) {
        self.api = api
        self.accountEmail = accountEmail
        self.lastChangedLabel = lastChangedLabel
    }

    /// Minimum length enforced by the server (`PASSWORD_MIN_LENGTH` in
    /// `backend/routes/users.js`). Also the `12+ characters` strength rule.
    public static let minPasswordLength = 12

    /// Sample list of breached/common passwords. A real integration would
    /// check Have I Been Pwned's k-anonymity range API; that is out of scope,
    /// so we ship a hardcoded list good enough to demo the breach state.
    static let commonPasswords: Set<String> = [
        "password", "password1", "password123", "12345678", "123456789",
        "qwerty123", "qwertyuiop", "letmein123", "iloveyou1", "admin123",
        "welcome123", "abc12345"
    ]

    public var requiresCurrent: Bool {
        hasPassword
    }

    private func value(_ key: FieldKey) -> String {
        fields[key]?.value ?? ""
    }

    /// True when the new password matches an entry on the breach list. Drives
    /// both the per-field error and the `StrengthMeter` breach overlay.
    public var isNewPasswordBreached: Bool {
        let candidate = value(.new)
        guard !candidate.isEmpty else { return false }
        return Self.commonPasswords.contains(candidate.lowercased())
    }

    /// Live strength for the new password, feeding `StrengthMeter`.
    public var strength: PasswordStrength {
        PasswordStrength.evaluate(value(.new), breached: isNewPasswordBreached)
    }

    /// Current field reads "valid" (green check) once it carries a value and
    /// has no error. We can't verify the password client-side, so a filled,
    /// un-rejected field is treated as provisionally valid.
    public var isCurrentValid: Bool {
        requiresCurrent && !value(.current).isEmpty && fields[.current]?.error == nil
    }

    public var isNewValid: Bool {
        let newValue = value(.new)
        return !newValue.isEmpty
            && newValue.count >= Self.minPasswordLength
            && !isNewPasswordBreached
            && fields[.new]?.error == nil
    }

    public var isConfirmValid: Bool {
        let confirmValue = value(.confirm)
        return !confirmValue.isEmpty && confirmValue == value(.new) && fields[.confirm]?.error == nil
    }

    public var isDirty: Bool {
        !value(.new).isEmpty || !value(.confirm).isEmpty || (requiresCurrent && !value(.current).isEmpty)
    }

    public var isValid: Bool {
        let newValue = value(.new)
        guard newValue.count >= Self.minPasswordLength else { return false }
        guard !isNewPasswordBreached else { return false }
        guard value(.confirm) == newValue else { return false }
        guard !requiresCurrent || !value(.current).isEmpty else { return false }
        if requiresCurrent, value(.current) == newValue { return false }
        return true
    }

    public func load() async {
        formState = .loading
        do {
            let methods: AuthMethodsResponse = try await api.request(AuthMethodsEndpoints.methods)
            hasPassword = methods.hasPassword ?? true
            formState = .ready
        } catch {
            // Default to requiring the current password — safer than the
            // alternative if the discovery call fails.
            hasPassword = true
            formState = .ready
        }
    }

    public func update(_ key: FieldKey, to value: String) {
        var snapshot = fields[key] ?? FormFieldState(id: key.rawValue, originalValue: "")
        snapshot.value = value
        snapshot.touched = true
        snapshot.error = inlineError(for: key, value: value)
        fields[key] = snapshot
        // Re-run the confirm cross-field check when the new password changes.
        if key == .new, let confirm = fields[.confirm], confirm.touched {
            var c = confirm
            c.error = inlineError(for: .confirm, value: c.value)
            fields[.confirm] = c
        }
    }

    public func save() async {
        guard isValid, !isSaving else { return }
        formError = nil
        let currentValue = value(.current)
        let newValue = value(.new)
        isSaving = true
        defer { isSaving = false }
        let body = PasswordUpdateBody(
            currentPassword: requiresCurrent ? currentValue : nil,
            newPassword: newValue
        )
        do {
            _ = try await api.request(AuthMethodsEndpoints.updatePassword(body))
            toast = "Password updated"
            shouldDismiss = true
        } catch APIError.unauthorized {
            applyServerRejection(currentError: "That doesn't match the password on file.")
        } catch let APIError.clientError(status, message) {
            mapServerError(status: status, message: message)
        } catch APIError.notFound {
            mark(key: .new, error: "We couldn't find your account. Try signing back in.")
            formError = Self.standardBanner
        } catch {
            mark(key: .new, error: "Couldn't update your password. Try again.")
            formError = Self.standardBanner
        }
    }

    /// Stub for the "Email me a reset link instead" shortcut on the current
    /// field. A real implementation would POST to the password-reset route;
    /// for now we acknowledge the request so the affordance is wired.
    public func requestResetLink() {
        toast = "We'll email you a reset link."
    }

    public func acknowledgeDismiss() {
        shouldDismiss = false
    }

    public func dismissToast() {
        toast = nil
    }

    // MARK: - Private

    private static let standardBanner = FormBannerContent(
        title: "Couldn't update password",
        // Sample copy mirroring the design frame. The "two fields" / "three
        // attempts" counts are static until the backend returns a real
        // rate-limit signal.
        message: "Fix the two highlighted fields and try again. Three more attempts before a 15-minute cooldown."
    )

    private func inlineError(for key: FieldKey, value: String) -> String? {
        switch key {
        case .current:
            if requiresCurrent, value.isEmpty {
                return "Required"
            }
            return nil
        case .new:
            if value.isEmpty { return nil }
            if Self.commonPasswords.contains(value.lowercased()) {
                return "Too common — appeared in 2.3M public records."
            }
            if value.count < Self.minPasswordLength {
                return "At least \(Self.minPasswordLength) characters"
            }
            let currentValue = self.value(.current)
            if requiresCurrent, !currentValue.isEmpty, value == currentValue {
                return "Choose something different from your current password"
            }
            return nil
        case .confirm:
            if value.isEmpty { return nil }
            if value != self.value(.new) { return "Doesn't match the new password above." }
            return nil
        }
    }

    private func mark(key: FieldKey, error: String) {
        var snapshot = fields[key] ?? FormFieldState(id: key.rawValue, originalValue: "")
        snapshot.error = error
        fields[key] = snapshot
    }

    private func applyServerRejection(currentError: String) {
        mark(key: .current, error: currentError)
        formError = Self.standardBanner
    }

    private func mapServerError(status: Int, message: String?) {
        switch status {
        case 401:
            applyServerRejection(currentError: message ?? "That doesn't match the password on file.")
        case 429:
            formError = FormBannerContent(
                title: "Too many attempts",
                message: "Wait a moment before trying again."
            )
        default:
            mark(key: .new, error: message ?? "Couldn't update your password")
            formError = Self.standardBanner
        }
    }
}
