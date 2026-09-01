//
//  FormValidation.swift
//  Pantopus
//
//  Reusable validators for the Form archetype. Each rule returns a
//  localized error string or nil when the value is acceptable.
//

import Foundation

/// A single validation rule applied to a string field.
public struct FormValidator: Sendable {
    public let validate: @Sendable (String) -> String?

    public init(_ validate: @escaping @Sendable (String) -> String?) {
        self.validate = validate
    }
}

public extension FormValidator {
    /// Trims whitespace; returns an error when the result is empty.
    static func required(_ label: String) -> FormValidator {
        FormValidator { value in
            value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "\(label) is required." : nil
        }
    }

    /// Ensures length does not exceed `max` characters.
    static func maxLength(_ max: Int) -> FormValidator {
        FormValidator { value in
            value.count > max ? "Must be \(max) characters or fewer." : nil
        }
    }

    /// E.164 phone-number format (`^\+[1-9]\d{1,14}$`). Empty is allowed.
    /// Mirrors `updateProfileSchema.phoneNumber` at `backend/routes/users.js:330`.
    static func e164Phone() -> FormValidator {
        FormValidator { value in
            let trimmed = value.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { return nil }
            let pattern = #"^\+[1-9]\d{1,14}$"#
            let matches = trimmed.range(of: pattern, options: .regularExpression) != nil
            return matches ? nil : "Phone must be in E.164 format, e.g. +15555550123."
        }
    }

    /// RFC-5322-ish email check. Mirrors the `Joi.string().email()` rule
    /// used by `inviteOwnerSchema.email`
    /// (`backend/routes/homeOwnership.js:67`). The Joi check is stricter
    /// server-side; this is the same shape Apple's `NSDataDetector` uses
    /// and is good enough to gate the submit button.
    static func email() -> FormValidator {
        FormValidator { value in
            let trimmed = value.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { return "Email is required." }
            let pattern = #"^[A-Z0-9a-z._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"#
            let matches = trimmed.range(of: pattern, options: .regularExpression) != nil
            return matches ? nil : "Enter a valid email address."
        }
    }

    /// Reject the supplied email (case-insensitive). Used by the Invite
    /// Owner form to stop a user from inviting themselves.
    static func emailNotMatching(_ otherEmail: String) -> FormValidator {
        let normalised = otherEmail.lowercased()
        return FormValidator { value in
            let trimmed = value.trimmingCharacters(in: .whitespaces).lowercased()
            return trimmed == normalised && !trimmed.isEmpty
                ? "You can't invite yourself."
                : nil
        }
    }

    /// Min/max length, but only when the value is non-empty. Mirrors the
    /// optional address-component fields in `updateProfileSchema`
    /// (`backend/routes/users.js:332-335`) where empty means "leave alone".
    static func optionalLength(_ label: String, min: Int, max: Int) -> FormValidator {
        FormValidator { value in
            let trimmed = value.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { return nil }
            if trimmed.count < min { return "\(label) must be at least \(min) characters." }
            if trimmed.count > max { return "\(label) must be \(max) characters or fewer." }
            return nil
        }
    }

    /// `http(s)` URL or empty. Mirrors `urlOrEmpty` at
    /// `backend/routes/users.js:320-322`.
    static func urlOrEmpty() -> FormValidator {
        FormValidator { value in
            let trimmed = value.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { return nil }
            let invalid = "Enter a valid URL (https://example.com)."
            guard let url = URL(string: trimmed),
                  let scheme = url.scheme?.lowercased(),
                  scheme == "http" || scheme == "https"
            else { return invalid }
            let host = url.host ?? ""
            return host.isEmpty ? invalid : nil
        }
    }

    /// ISO-8601 date (`yyyy-MM-dd`) or empty. Mirrors
    /// `updateProfileSchema.dateOfBirth` at `backend/routes/users.js:340`.
    static func isoDateOrEmpty() -> FormValidator {
        FormValidator { value in
            let trimmed = value.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { return nil }
            let formatter = DateFormatter()
            formatter.calendar = Calendar(identifier: .iso8601)
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)
            formatter.dateFormat = "yyyy-MM-dd"
            return formatter.date(from: trimmed) == nil
                ? "Use the format YYYY-MM-DD."
                : nil
        }
    }

    /// 24-hour clock time in `HH:mm` or empty. Used by the Edit
    /// Signup form to bound the drop-off picker.
    static func timeHHmm() -> FormValidator {
        FormValidator { value in
            let trimmed = value.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty else { return nil }
            let pattern = #"^([01]\d|2[0-3]):[0-5]\d$"#
            let matches = trimmed.range(of: pattern, options: .regularExpression) != nil
            return matches ? nil : "Use the format HH:mm (24-hour)."
        }
    }

    /// Applies each rule in order; stops at the first failure.
    static func all(_ rules: [FormValidator]) -> FormValidator {
        FormValidator { value in
            for rule in rules {
                if let message = rule.validate(value) { return message }
            }
            return nil
        }
    }
}
