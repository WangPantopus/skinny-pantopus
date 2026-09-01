//
//  IdentityCenterContent.swift
//  Pantopus
//
//  Render-only models for the T3.2 Profiles & Privacy screen. UI
//  labels follow docs/identity-firewall-ui-ux-redesign-2026-05-06.md
//  ("Public profile" not "Persona", "Profile links" not "Bridges").
//

import SwiftUI

/// Which of the four identity slots a card belongs to.
public enum IdentityKind: String, Sendable, Hashable, CaseIterable {
    case local
    case personal
    case publicProfile
    case professional
}

/// Identity card content rendered in the identity-present header
/// and the switcher sheet.
public struct IdentityCardContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let kind: IdentityKind
    public let overline: String
    public let name: String
    public let handle: String?
    public let stats: String?
    public let summary: String?
    public let chip: IdentityChip?
    public let status: IdentityStatus
    public let isOwner: Bool

    public init(
        id: String,
        kind: IdentityKind,
        overline: String,
        name: String,
        handle: String? = nil,
        stats: String? = nil,
        summary: String? = nil,
        chip: IdentityChip? = nil,
        status: IdentityStatus = .active,
        isOwner: Bool = true
    ) {
        self.id = id
        self.kind = kind
        self.overline = overline
        self.name = name
        self.handle = handle
        self.stats = stats
        self.summary = summary
        self.chip = chip
        self.status = status
        self.isOwner = isOwner
    }

    public var accent: Color {
        kind.accent
    }

    public var accentBg: Color {
        kind.accentBg
    }

    public var accentBgSoft: Color {
        kind.accentBgSoft
    }

    public var icon: PantopusIcon {
        kind.icon
    }
}

public struct IdentityChip: Sendable, Hashable {
    public let label: String
    public let tone: ContentDetailPill.Tone

    public init(label: String, tone: ContentDetailPill.Tone) {
        self.label = label
        self.tone = tone
    }
}

public enum IdentityStatus: Sendable, Hashable {
    case active
    case setupNeeded(cta: String)
}

public extension IdentityKind {
    /// User-facing label per the firewall doc's terminology table.
    var label: String {
        switch self {
        case .local: "Local Profile"
        case .personal: "Personal"
        case .publicProfile: "Public profile"
        case .professional: "Professional"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .local: .mapPin
        case .personal: .user
        case .publicProfile: .star
        case .professional: .briefcase
        }
    }

    var accent: Color {
        switch self {
        case .local: Theme.Color.success
        case .personal: Theme.Color.primary600
        case .publicProfile: Color(red: 219 / 255, green: 39 / 255, blue: 119 / 255)
        case .professional: Theme.Color.business
        }
    }

    var accentBg: Color {
        switch self {
        case .local: Theme.Color.successBg
        case .personal: Theme.Color.primary50
        case .publicProfile: Color(red: 252 / 255, green: 231 / 255, blue: 243 / 255)
        case .professional: Theme.Color.businessBg
        }
    }

    var accentBgSoft: Color {
        accentBg.opacity(0.5)
    }
}

/// Top-level render state.
public enum IdentityCenterState: Sendable {
    case loading
    case loaded(IdentityCenterLoaded)
    case error(message: String)
}

public struct IdentityCenterLoaded: Sendable, Hashable {
    public let identities: [IdentityCardContent]
    public let bridges: [IdentityBridgeRow]
    public let privacyRows: [IdentityRowContent]
    public let disclosureRows: [IdentityRowContent]
    /// Identities still showing "Set up" / "Create" chips (first-run hint).
    public let setupRemainingCount: Int

    public init(
        identities: [IdentityCardContent],
        bridges: [IdentityBridgeRow],
        privacyRows: [IdentityRowContent],
        disclosureRows: [IdentityRowContent],
        setupRemainingCount: Int = 0
    ) {
        self.identities = identities
        self.bridges = bridges
        self.privacyRows = privacyRows
        self.disclosureRows = disclosureRows
        self.setupRemainingCount = setupRemainingCount
    }
}

/// One "Profile links" toggle (formerly Bridges).
public struct IdentityBridgeRow: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let subtext: String?
    public let isOn: Bool

    public init(id: String, label: String, subtext: String? = nil, isOn: Bool) {
        self.id = id
        self.label = label
        self.subtext = subtext
        self.isOn = isOn
    }
}

/// Generic privacy / disclosure row.
public struct IdentityRowContent: Sendable, Hashable, Identifiable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let subtext: String?
    public let trailing: String?

    public init(id: String, icon: PantopusIcon, label: String, subtext: String? = nil, trailing: String? = nil) {
        self.id = id
        self.icon = icon
        self.label = label
        self.subtext = subtext
        self.trailing = trailing
    }
}
