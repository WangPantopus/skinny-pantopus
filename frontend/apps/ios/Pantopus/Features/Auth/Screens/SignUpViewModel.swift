//
//  SignUpViewModel.swift
//  Pantopus
//
//  T6.1b SignUp form view-model. Validates the 14 backend-required and
//  optional fields client-side, derives an aggregated `isValid` for the
//  bottom CTA, and submits to `AuthManager.signUp`.
//
//  On success: pushes `AuthRoute.verifyEmail`. The Q4 soft-gate decision
//  says "sign in immediately on Create Account success", but the backend
//  currently hard-gates `/login` on `email_confirmed_at` (see
//  `docs/mobile/auth-backend-contracts.md` § "Backend gap"), so the
//  pragmatic flow today routes through the verify-email screen.
//

import Foundation

/// Account type segmented-control choice. Mirrors `AccountType` on
/// `AuthManager`; kept local so the view binds against a `Hashable` enum
/// without exporting `AuthManager.AccountType`.
public enum SignUpAccountTypeChoice: String, Hashable, Sendable, CaseIterable, Identifiable {
    case personal
    case business

    public var id: String {
        rawValue
    }

    /// Display label rendered in the segmented control.
    public var label: String {
        switch self {
        case .personal: "Personal"
        case .business: "Business"
        }
    }

    /// Project to the AuthManager type used by the API call.
    public var asAccountType: AccountType {
        switch self {
        case .personal: .personal
        case .business: .business
        }
    }
}

/// Fields tracked by the signup form. Identifiers double as
/// `accessibilityIdentifier` suffixes (`signUpEmailField`, etc).
public enum SignUpField: String, Hashable, Sendable, CaseIterable {
    case email
    case password
    case confirmPassword
    case username
    case firstName
    case middleName
    case lastName
    case dateOfBirth
    case phoneNumber
    case address
    case city
    case state
    case zipcode
    case inviteCode
}

@Observable
@MainActor
public final class SignUpViewModel {
    // Form values.
    public var email: String = ""
    public var password: String = ""
    public var confirmPassword: String = ""
    public var username: String = ""
    public var firstName: String = ""
    public var middleName: String = ""
    public var lastName: String = ""
    public var dateOfBirth: Date?
    public var phoneNumber: String = ""
    public var address: String = ""
    public var city: String = ""
    public var state: String = ""
    public var zipcode: String = ""
    public var accountType: SignUpAccountTypeChoice = .personal
    public var inviteCode: String = ""
    public var agreedToTerms: Bool = false

    // Field-level error state, populated lazily after first submit attempt.
    public private(set) var fieldErrors: [SignUpField: String] = [:]
    public private(set) var hasAttemptedSubmit: Bool = false

    // Submission lifecycle.
    public private(set) var isSubmitting: Bool = false
    public private(set) var topLevelError: AuthError?
    public private(set) var didSucceed: Bool = false

    public init() {}

    // MARK: - Validation

    // swiftlint:disable cyclomatic_complexity
    /// Validates a single field and returns the error message (or nil).
    /// Public so the view can render error states per-field on touch.
    public func validate(_ field: SignUpField) -> String? {
        switch field {
        case .email:
            return AuthValidation.email(email)
        case .password:
            return AuthValidation.password(password)
        case .confirmPassword:
            if confirmPassword.isEmpty { return "Confirm your password." }
            if confirmPassword != password { return "Passwords don't match." }
            return nil
        case .username:
            return AuthValidation.username(username)
        case .firstName:
            return firstName.trimmingCharacters(in: .whitespaces).isEmpty ? "First name is required." : nil
        case .lastName:
            return lastName.trimmingCharacters(in: .whitespaces).isEmpty ? "Last name is required." : nil
        case .middleName:
            return nil // optional
        case .dateOfBirth:
            return AuthValidation.dateOfBirth(dateOfBirth)
        case .phoneNumber:
            return AuthValidation.phoneOptional(phoneNumber)
        case .address:
            let trimmed = address.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { return "Address is required." }
            if trimmed.count < 5 { return "Address must be at least 5 characters." }
            return nil
        case .city:
            let trimmed = city.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { return "City is required." }
            if trimmed.count < 2 { return "City must be at least 2 characters." }
            return nil
        case .state:
            let trimmed = state.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { return "State is required." }
            if trimmed.count < 2 { return "State must be at least 2 characters." }
            return nil
        case .zipcode:
            let trimmed = zipcode.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { return "ZIP is required." }
            if trimmed.count < 3 { return "ZIP must be at least 3 characters." }
            return nil
        case .inviteCode:
            return nil // optional
        }
    }

    // swiftlint:enable cyclomatic_complexity

    /// Aggregate validity — true when every required field passes and
    /// terms are accepted. Drives the bottom CTA's enabled state.
    public var isValid: Bool {
        guard agreedToTerms else { return false }
        for field in SignUpField.allCases where validate(field) != nil {
            return false
        }
        return true
    }

    /// Strength bucket for the password meter — 0 (empty), 1 (weak),
    /// 2 (fair), 3 (strong). Drives the design's 3-band meter.
    public var passwordStrength: Int {
        AuthValidation.passwordStrength(password)
    }

    /// User-facing strength label for the meter trailing text.
    public var passwordStrengthLabel: String {
        switch passwordStrength {
        case 1: "Weak"
        case 2: "Fair"
        case 3: "Strong"
        default: "—"
        }
    }

    // MARK: - Submit

    /// Runs validation, then submits to `AuthManager.signUp`. On success
    /// sets `didSucceed = true` so the caller pushes `AuthRoute.verifyEmail`.
    func submit(using auth: AuthManager) async {
        hasAttemptedSubmit = true
        let errors = Self.validateAll(self)
        fieldErrors = errors
        topLevelError = nil
        if !errors.isEmpty || !agreedToTerms {
            return
        }

        isSubmitting = true
        defer { isSubmitting = false }

        do {
            _ = try await auth.signUp(
                email: email.trimmingCharacters(in: .whitespaces).lowercased(),
                password: password,
                phoneNumber: phoneNumber.isEmpty ? nil : phoneNumber,
                username: username.trimmingCharacters(in: .whitespaces).lowercased(),
                firstName: firstName.trimmingCharacters(in: .whitespaces),
                middleName: middleName.isEmpty ? nil : middleName.trimmingCharacters(in: .whitespaces),
                lastName: lastName.trimmingCharacters(in: .whitespaces),
                dateOfBirth: dateOfBirth,
                address: address.trimmingCharacters(in: .whitespaces),
                city: city.trimmingCharacters(in: .whitespaces),
                state: state.trimmingCharacters(in: .whitespaces),
                zipcode: zipcode.trimmingCharacters(in: .whitespaces),
                accountType: accountType.asAccountType,
                inviteCode: inviteCode.isEmpty ? nil : inviteCode.trimmingCharacters(in: .whitespaces)
            )
            didSucceed = true
        } catch let error as AuthError {
            topLevelError = error
            Observability.shared.capture(error)
        } catch {
            topLevelError = .unknown
            Observability.shared.capture(error)
        }
    }

    /// Blocked because the OAuth callback can only ever produce a Personal
    /// account: `backend/routes/users.js` `ensureOAuthUserProfile` inserts
    /// `account_type: 'individual'` unconditionally. Mirrors Android
    /// `SignUpViewModel.oauthBusinessMessage`.
    public static let oauthBusinessMessage =
        "Business accounts must be created with email. Switch Account type to Personal to continue with Google or Apple."

    /// Blocked because the browser flow never sends the form, so the 18+
    /// gate the email path enforces would be skipped. Mirrors Android
    /// `SignUpViewModel.oauthTermsMessage`.
    public static let oauthTermsMessage =
        "Agree to the Terms and Privacy Policy before continuing with Google or Apple."

    /// The subset of `submit`'s validation the OAuth path can still honour:
    /// account type (the backend hardcodes Personal), the 18+ date-of-birth
    /// gate, and the Terms agreement. Nothing else on the form is sent by
    /// the browser flow, so nothing else is gated. Returns the banner copy
    /// when the attempt must not start. Identical on Android
    /// (`SignUpViewModel.oauthPrerequisiteMessage`).
    func oauthPrerequisiteMessage() -> String? {
        if accountType == .business { return Self.oauthBusinessMessage }
        if let dateOfBirthError = AuthValidation.dateOfBirth(dateOfBirth) {
            hasAttemptedSubmit = true
            fieldErrors[.dateOfBirth] = dateOfBirthError
            return dateOfBirthError
        }
        if !agreedToTerms { return Self.oauthTermsMessage }
        return nil
    }

    func signIn(with provider: OAuthProvider, using auth: AuthManager) async {
        topLevelError = nil
        if let blocked = oauthPrerequisiteMessage() {
            topLevelError = .serverError(blocked)
            return
        }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await auth.signIn(with: provider)
        } catch OAuthWebAuthenticationError.cancelled {
            return
        } catch let error as AuthError {
            topLevelError = error
            Observability.shared.capture(error)
        } catch {
            topLevelError = .unknown
            Observability.shared.capture(error)
        }
    }

    public func acknowledgeSuccess() {
        didSucceed = false
    }

    public func clearError(for field: SignUpField) {
        if fieldErrors[field] != nil {
            fieldErrors[field] = nil
        }
    }

    public func clearTopLevelError() {
        topLevelError = nil
    }

    /// Convenience: validate every field and return a dictionary of errors.
    /// Used by `submit` and unit tests.
    static func validateAll(_ vm: SignUpViewModel) -> [SignUpField: String] {
        var errors: [SignUpField: String] = [:]
        for field in SignUpField.allCases {
            if let error = vm.validate(field) {
                errors[field] = error
            }
        }
        return errors
    }
}
