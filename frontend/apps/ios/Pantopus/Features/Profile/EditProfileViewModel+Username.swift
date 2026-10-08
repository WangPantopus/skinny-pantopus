//
//  EditProfileViewModel+Username.swift
//  Pantopus
//
//  The username leg of Edit Profile and two small display helpers, kept
//  out of `EditProfileViewModel.swift` to stay inside the 500-line budget.
//

import Foundation

extension EditProfileViewModel {
    /// A save the server refused because of the username (taken since the
    /// check, reserved, or malformed) shows on the username field.
    func markUsernameError(_ error: Error) {
        guard case let .clientError(status, message)? = error as? APIError,
              let message, status == 409 || message.localizedCaseInsensitiveContains("username")
              || message.hasPrefix("Use 3 to 30"),
              var snapshot = fields[.username], snapshot.isDirty else { return }
        snapshot.error = message
        snapshot.touched = true
        fields[.username] = snapshot
    }

    /// Bridge between the string-valued form machinery and the two boolean
    /// contact-visibility keys.
    static func boolString(_ value: Bool?) -> String {
        (value ?? false) ? "true" : "false"
    }

    /// First glyph of the best available display name — matches the RN
    /// `displayInitial` fallback on the avatar circle. Callers pass only a
    /// username the person chose (`MadeUpUsername.chosen`).
    static func initial(firstName: String, name: String, username: String) -> String {
        for candidate in [firstName, name, username] {
            let trimmed = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
            if let first = trimmed.first { return String(first).uppercased() }
        }
        return "?"
    }
}
