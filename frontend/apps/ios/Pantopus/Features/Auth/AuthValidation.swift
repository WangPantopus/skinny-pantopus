//
//  AuthValidation.swift
//  Pantopus
//
//  Pure-function validators shared by `LoginViewModel`, `SignUpViewModel`,
//  `ForgotPasswordViewModel`, etc. Each returns a user-facing error string
//  or nil. Kept here (rather than on `FormValidator`) so the auth surfaces
//  stay decoupled from the Form archetype's validator type.
//

import Foundation

enum AuthValidation {
    /// RFC-5322-ish email shape. Matches `FormValidator.email()` so the
    /// auth surfaces and the form fields agree on what "valid" means.
    static func email(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return "Email is required." }
        let pattern = #"^[A-Z0-9a-z._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#
        return trimmed.range(of: pattern, options: .regularExpression) != nil
            ? nil
            : "Enter a valid email address."
    }

    /// ≥8 chars, ≥1 letter, ≥1 number. Mirrors the spec spelled out in
    /// the P4 prompt.
    static func password(_ value: String) -> String? {
        if value.isEmpty { return "Password is required." }
        if value.count < 8 { return "Password must be at least 8 characters." }
        let hasLetter = value.range(of: "[A-Za-z]", options: .regularExpression) != nil
        let hasDigit = value.range(of: "[0-9]", options: .regularExpression) != nil
        if !hasLetter { return "Password must include at least one letter." }
        if !hasDigit { return "Password must include at least one number." }
        return nil
    }

    /// Lowercase letters / digits / underscore, length 3–20.
    static func username(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return "Username is required." }
        if trimmed.count < 3 { return "Username must be at least 3 characters." }
        if trimmed.count > 20 { return "Username must be 20 characters or fewer." }
        let pattern = #"^[a-z0-9_]+$"#
        return trimmed.range(of: pattern, options: .regularExpression) != nil
            ? nil
            : "Use lowercase letters, numbers, or underscores only."
    }

    /// Required; must be ≥ 18 years ago.
    static func dateOfBirth(_ date: Date?, now: Date = Date()) -> String? {
        guard let date else { return "Date of birth is required." }
        let calendar = Calendar(identifier: .gregorian)
        guard let age = calendar.dateComponents([.year], from: date, to: now).year else {
            return "Date of birth is invalid."
        }
        if age < 18 { return "You must be at least 18 years old." }
        return nil
    }

    /// Empty allowed; E.164 if present.
    static func phoneOptional(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return nil }
        let pattern = #"^\+[1-9]\d{1,14}$"#
        return trimmed.range(of: pattern, options: .regularExpression) != nil
            ? nil
            : "Phone must be in E.164 format, e.g. +15555550123."
    }

    /// 0..3 strength bucket: 0 empty / 1 weak / 2 fair / 3 strong.
    static func passwordStrength(_ value: String) -> Int {
        if value.isEmpty { return 0 }
        let hasLetter = value.range(of: "[A-Za-z]", options: .regularExpression) != nil
        let hasDigit = value.range(of: "[0-9]", options: .regularExpression) != nil
        let hasSymbol = value.range(of: "[^A-Za-z0-9]", options: .regularExpression) != nil
        if value.count < 8 || !hasLetter || !hasDigit { return 1 }
        if value.count >= 12, hasSymbol { return 3 }
        return 2
    }
}
