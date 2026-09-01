//
//  InviteOwnerSampleData.swift
//  Pantopus
//
//  Deterministic A13.2 samples for previews, snapshots, and local form
//  hydration. Mirrors `invite-owner-frames.jsx`.
//

import Foundation

public struct InviteOwnerHomeContext: Sendable, Hashable {
    public let title: String
    public let subtitle: String

    public init(title: String, subtitle: String) {
        self.title = title
        self.subtitle = subtitle
    }
}

public enum InviteOwnerTone: String, Sendable, Hashable {
    case personal
    case home
    case business
}

public struct InviteOwnerOwnerShare: Identifiable, Sendable, Hashable {
    public let id: String
    public let initials: String
    public let name: String
    public let sharePercent: Int
    public let tone: InviteOwnerTone

    public init(
        id: String,
        initials: String,
        name: String,
        sharePercent: Int,
        tone: InviteOwnerTone
    ) {
        self.id = id
        self.initials = initials
        self.name = name
        self.sharePercent = sharePercent
        self.tone = tone
    }

    public func withShare(_ sharePercent: Int) -> InviteOwnerOwnerShare {
        InviteOwnerOwnerShare(
            id: id,
            initials: initials,
            name: name,
            sharePercent: sharePercent,
            tone: tone
        )
    }
}

public struct InviteOwnershipSummary: Sendable, Hashable {
    public let owners: [InviteOwnerOwnerShare]
    public let availablePercent: Int
    public let grantPercent: Int
    public let totalAfterGrant: Int
    public let conflictOverage: Int

    public var hasConflict: Bool {
        conflictOverage > 0
    }
}

public struct InviteOwnerDraft: Sendable, Hashable {
    public let homeContext: InviteOwnerHomeContext
    public let owners: [InviteOwnerOwnerShare]
    public let email: String
    public let phone: String
    public let role: String
    public let grantPercent: Int
    public let autoBalancesSoleOwner: Bool

    public init(
        homeContext: InviteOwnerHomeContext,
        owners: [InviteOwnerOwnerShare],
        email: String = "",
        phone: String = "",
        role: String = "",
        grantPercent: Int,
        autoBalancesSoleOwner: Bool
    ) {
        self.homeContext = homeContext
        self.owners = owners
        self.email = email
        self.phone = phone
        self.role = role
        self.grantPercent = grantPercent
        self.autoBalancesSoleOwner = autoBalancesSoleOwner
    }
}

public struct InviteOwnerSentInvite: Sendable, Hashable {
    public let email: String
    public let phone: String?
    public let grantPercent: Int
    public let owners: [InviteOwnerOwnerShare]
}

public enum InviteOwnerSampleData {
    public static let noteMaxLength = 240

    public static func homeContext(for _: String) -> InviteOwnerHomeContext {
        InviteOwnerHomeContext(title: "412 Elm St · Apt 3B", subtitle: "Kovács household")
    }

    public static func initialDraft(homeId: String) -> InviteOwnerDraft {
        InviteOwnerDraft(
            homeContext: homeContext(for: homeId),
            owners: [
                InviteOwnerOwnerShare(
                    id: "you",
                    initials: "MK",
                    name: "You",
                    sharePercent: 75,
                    tone: .personal
                )
            ],
            grantPercent: 25,
            autoBalancesSoleOwner: true
        )
    }

    public static let valid = InviteOwnerDraft(
        homeContext: homeContext(for: "home-valid"),
        owners: [
            InviteOwnerOwnerShare(
                id: "you",
                initials: "MK",
                name: "You",
                sharePercent: 75,
                tone: .personal
            )
        ],
        email: "maya.fortune@pantopus.app",
        phone: "(415) 555-0198",
        role: "Books — invoices, bill splits, taxes. Co-signer on the lease renewal in March.",
        grantPercent: 25,
        autoBalancesSoleOwner: true
    )

    public static let conflict = InviteOwnerDraft(
        homeContext: homeContext(for: "home-conflict"),
        owners: [
            InviteOwnerOwnerShare(
                id: "maria",
                initials: "MK",
                name: "Maria",
                sharePercent: 50,
                tone: .personal
            ),
            InviteOwnerOwnerShare(
                id: "marcus",
                initials: "MK",
                name: "Marcus",
                sharePercent: 30,
                tone: .home
            )
        ],
        email: "priya.shah@pantopus.app",
        phone: "",
        role: "",
        grantPercent: 30,
        autoBalancesSoleOwner: false
    )

    public static let empty = InviteOwnerDraft(
        homeContext: homeContext(for: "home-empty"),
        owners: [],
        grantPercent: 0,
        autoBalancesSoleOwner: false
    )
}
