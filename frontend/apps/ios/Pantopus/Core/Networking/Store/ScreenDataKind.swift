//
//  ScreenDataKind.swift
//  Pantopus
//
//  The kinds of data the screen store keeps, with their freshness windows
//  and privacy tiers (docs/product/instant-screens-contract-2026-10-09.md
//  sections 4 and 5), and the change topics of section 8. Every platform
//  uses the same values; the coordinator tunes the table, never one app.
//

import Foundation

/// What a store entry holds. The kind picks how long a copy counts as fresh,
/// how old it may be and still show without the "Couldn't refresh" line, and
/// its privacy tier.
enum ScreenDataKind: String, CaseIterable {
    /// Place sections that don't depend on the viewer, civic districts, Ballot.
    case publicPlace
    /// Today: weather, air, pickups, reminders, the radon card.
    case today
    /// Weather and air alerts inside Today. A failed or out-of-date alert
    /// check is never shown as "no alerts".
    case todayAlerts
    /// A home's facts for the viewer's role.
    case place
    /// My Homes, a Home's dashboard, members, tasks.
    case homes
    /// The first page of the Nearby feed, map cells, the density meter.
    case nearby
    /// A post and its comments.
    case post
    /// The conversation list (names, last-message previews, unread counts).
    case messagesList
    /// The notification list and badges.
    case notifications
    /// Your own profile and settings.
    case you
    /// Profiles you open.
    case otherPeople
    /// A Support Train and its slots.
    case supportTrain
    /// Access codes and Wi-Fi, emergency and medical details, documents,
    /// bills, wallet and payouts, identity and verification, residency
    /// letters, payment methods: always re-checked, never saved.
    case sensitive
    /// Mailbox lists (dormant while the `mailbox` launch key is off).
    case mailbox

    /// Inside this window, coming back sends no request.
    var freshFor: TimeInterval {
        switch self {
        case .publicPlace: 24 * 3600
        case .today: 10 * 60
        case .todayAlerts: 5 * 60
        case .place: 10 * 60
        case .homes: 2 * 60
        case .nearby: 2 * 60
        case .post: 60
        case .messagesList: 30
        case .notifications: 30
        case .you: 10 * 60
        case .otherPeople: 5 * 60
        case .supportTrain: 60
        case .sensitive: 0
        case .mailbox: 60
        }
    }

    /// How old a copy may be and still be shown without the "Couldn't
    /// refresh" line. Sensitive data is never shown from a copy.
    var maxShownAge: TimeInterval {
        switch self {
        case .publicPlace, .you: 7 * 24 * 3600
        case .today: 2 * 3600
        case .todayAlerts: 30 * 60
        case .sensitive: 0
        case .place, .homes, .nearby, .post, .messagesList, .notifications, .otherPeople, .supportTrain, .mailbox:
            24 * 3600
        }
    }

    var tier: ScreenDataTier {
        switch self {
        case .place, .homes, .messagesList, .mailbox: .household
        case .sensitive: .sensitive
        case .publicPlace, .today, .todayAlerts, .nearby, .post, .notifications, .you, .otherPeople, .supportTrain:
            .everyday
        }
    }

    /// Whether a copy may later be saved on the phone (the saved copy, contract
    /// section 7). Household copies only for owners and household roles.
    var savedOnPhone: Bool {
        switch self {
        case .publicPlace, .today, .todayAlerts, .place, .homes, .nearby, .messagesList, .you: true
        case .post, .notifications, .otherPeople, .supportTrain, .sensitive, .mailbox: false
        }
    }
}

/// Privacy tiers (contract section 5).
enum ScreenDataTier: String {
    /// Public place facts, weather, Today, Nearby, your profile and settings.
    case everyday
    /// My Homes, a Home's dashboard, members, tasks, the Messages list. Shown
    /// before the re-check only to owners and household roles.
    case household
    /// Kept only while the screen is open; never saved; always re-checked.
    case sensitive
}

/// Change topics (contract section 8). The server emits the same names in
/// `sync:changed`; a matching entry is marked out of date.
enum ScreenTopic {
    static let homes = "homes"
    static let today = "today"
    static let chats = "chats"
    static let notifications = "notifications"
    static let profileMe = "profile:me"
    static let mail = "mail"

    static func home(_ homeId: String) -> String {
        "home:\(homeId.lowercased())"
    }

    static func place(_ homeId: String) -> String {
        "place:\(homeId.lowercased())"
    }

    static func chat(_ roomId: String) -> String {
        "chat:\(roomId.lowercased())"
    }

    static func post(_ postId: String) -> String {
        "post:\(postId.lowercased())"
    }

    static func supportTrain(_ trainId: String) -> String {
        "supporttrain:\(trainId.lowercased())"
    }
}
