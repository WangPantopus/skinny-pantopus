//
//  ProfileChange.swift
//  Pantopus
//

import Foundation

extension Notification.Name {
    /// Posted after the signed-in person's name or username is saved (the
    /// one-time name sheet, the share-profile username sheet, Edit Profile),
    /// so screens that show them (the Hub greeting, Me) load them again.
    static let pantopusProfileDidChange = Notification.Name("pantopus.profileDidChange")
}
