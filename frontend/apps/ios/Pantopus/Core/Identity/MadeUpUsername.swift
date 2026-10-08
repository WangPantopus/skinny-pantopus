//
//  MadeUpUsername.swift
//  Pantopus
//
//  Nobody picks a username at sign-up, so the server makes one up:
//  `user_` plus 12 random hex characters (20 when the short form
//  collides). It says nothing about the person, so it never stands in for
//  their name and is never shown as "@…". Same rule as
//  `backend/utils/personalUsername.js` and web `@pantopus/utils`.
//

import Foundation

public enum MadeUpUsername {
    private static let pattern = #"^user_(?:[0-9a-f]{12}|[0-9a-f]{20})$"#

    /// True for a username the server made up, never for one a person chose.
    public static func isMadeUp(_ username: String?) -> Bool {
        guard let value = username?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return false
        }
        return value.range(of: pattern, options: .regularExpression) != nil
    }

    /// The username when the person chose it; nil for an empty or made-up one.
    public static func chosen(_ username: String?) -> String? {
        var value = username?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        while value.hasPrefix("@") {
            value.removeFirst()
        }
        return value.isEmpty || isMadeUp(value) ? nil : value
    }

    /// "@username" for a username the person chose; nil otherwise (show nothing).
    public static func handle(_ username: String?) -> String? {
        chosen(username).map { "@\($0)" }
    }
}
