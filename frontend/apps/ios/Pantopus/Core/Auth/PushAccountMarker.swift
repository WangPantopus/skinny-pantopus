//
//  PushAccountMarker.swift
//  Pantopus
//
//  Who is signed in on this phone, for `PantopusNotificationService`. The app
//  writes it on every sign-in and sign-out (`AuthManager.setState`). The
//  extension can't read the app's Keychain or memory, so it reads this from the
//  shared App Group before a push is shown. Compiled into BOTH targets (see
//  `project.yml`); keep it Foundation-only.
//

import Foundation

public enum PushAccountMarker {
    public enum State: Equatable {
        /// Nothing to go on: the app hasn't run since it gained the extension,
        /// or the phone hasn't been unlocked since it restarted.
        case unknown
        case signedOut
        case signedIn(userId: String)
    }

    /// Declared in both targets' entitlements (`project.yml`).
    private static let appGroupId = "group.app.pantopus.ios"
    private static let key = "pushAccountV1"
    /// Signing out writes this rather than removing the key, so it stays
    /// different from `unknown`.
    private static let signedOutValue = ""

    /// `nil` when nobody is signed in.
    public static func write(userId: String?) {
        UserDefaults(suiteName: appGroupId)?.set(userId ?? signedOutValue, forKey: key)
    }

    public static func read() -> State {
        guard let value = UserDefaults(suiteName: appGroupId)?.string(forKey: key) else { return .unknown }
        return value == signedOutValue ? .signedOut : .signedIn(userId: value)
    }
}
