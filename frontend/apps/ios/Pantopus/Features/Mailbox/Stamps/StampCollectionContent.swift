//
//  StampCollectionContent.swift
//  Pantopus
//
//  A17.11 — render models for the two *backend-backed* halves of the
//  Stamps screen:
//
//    · the stamp **collection** (`GET /api/mailbox/v2/p3/stamps`,
//      `backend/routes/mailboxV2Phase3.js:1204`) — earned rows plus the
//      catalogue entries the caller hasn't unlocked yet, and
//    · the seasonal **themes** view (`GET /api/mailbox/v2/p3/themes`,
//      `:1249` + `POST /themes/apply`, `:1285`).
//
//  Mirrors RN `src/app/mailbox/stamps.tsx`, whose header toggles between
//  "Stamp Gallery" and "Seasonal Themes".
//
//  PALETTE NOTE: the backend hands each theme an `accent_color` hex. We
//  deliberately map the *season* onto a design token instead of parsing
//  the raw hex — `Features/**` is tokens-only and CI greps for `#RRGGBB`.
//
//  Mirrors `ui/screens/mailbox/stamps/StampCollectionContent.kt`.
//

import SwiftUI

// MARK: - View mode

/// Which half of the Stamps screen is on screen. RN toggles the same two
/// views from a single header button (`stamps.tsx:107-112`).
public enum StampsViewMode: String, Sendable, Hashable, CaseIterable, Identifiable {
    case stamps
    case themes

    public var id: String {
        rawValue
    }

    /// Screen title for this mode — RN `stamps.tsx:100-102`.
    public var title: String {
        switch self {
        case .stamps: "Stamp Gallery"
        case .themes: "Seasonal Themes"
        }
    }

    /// Label on the toggle button, which names the *other* mode.
    public var toggleLabel: String {
        switch self {
        case .stamps: "Themes"
        case .themes: "Stamps"
        }
    }

    public var toggled: StampsViewMode {
        self == .stamps ? .themes : .stamps
    }
}

// MARK: - Collection

/// Wire rarity of a stamp (`backend/routes/mailboxV2Phase3.js:1214`).
public enum StampRarity: String, Sendable, Hashable, CaseIterable {
    case common
    case uncommon
    case rare
    case legendary

    public static func fromRaw(_ raw: String?) -> StampRarity {
        StampRarity(rawValue: raw?.lowercased() ?? "") ?? .common
    }

    public var label: String {
        switch self {
        case .common: "Common"
        case .uncommon: "Uncommon"
        case .rare: "Rare"
        case .legendary: "Legendary"
        }
    }

    public var accent: Color {
        switch self {
        case .common: Theme.Color.slate
        case .uncommon: Theme.Color.success
        case .rare: Theme.Color.info
        case .legendary: Theme.Color.magic
        }
    }

    public var accentBg: Color {
        switch self {
        case .common: Theme.Color.slateBg
        case .uncommon: Theme.Color.successBg
        case .rare: Theme.Color.infoBg
        case .legendary: Theme.Color.magicBg
        }
    }
}

/// One card in the collection grid / locked list.
public struct CollectedStamp: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let detail: String?
    public let rarity: StampRarity
    /// "Earned May 4, 2026" — nil for locked entries.
    public let earnedLabel: String?
    public let isLocked: Bool

    public init(
        id: String,
        name: String,
        detail: String?,
        rarity: StampRarity,
        earnedLabel: String?,
        isLocked: Bool
    ) {
        self.id = id
        self.name = name
        self.detail = detail
        self.rarity = rarity
        self.earnedLabel = earnedLabel
        self.isLocked = isLocked
    }
}

/// The projected `GET /p3/stamps` payload.
public struct StampCollectionContent: Sendable, Hashable {
    public let earned: [CollectedStamp]
    public let locked: [CollectedStamp]
    public let totalEarned: Int
    public let totalAvailable: Int

    public init(
        earned: [CollectedStamp],
        locked: [CollectedStamp],
        totalEarned: Int,
        totalAvailable: Int
    ) {
        self.earned = earned
        self.locked = locked
        self.totalEarned = totalEarned
        self.totalAvailable = totalAvailable
    }

    /// "3 of 13 collected" — RN `stamps.tsx:104`.
    public var progressLabel: String {
        "\(totalEarned) of \(totalAvailable) collected"
    }
}

/// Four-state contract for the collection section.
public enum StampCollectionState: Sendable, Hashable {
    case loading
    case loaded(StampCollectionContent)
    case empty
    case error(message: String)
}

// MARK: - Seasonal themes

/// Wire season of a `SeasonalTheme` row.
public enum MailboxThemeSeason: String, Sendable, Hashable, CaseIterable {
    case spring
    case summer
    case autumn
    case winter
    case custom

    public static func fromRaw(_ raw: String?) -> MailboxThemeSeason {
        MailboxThemeSeason(rawValue: raw?.lowercased() ?? "") ?? .custom
    }

    public var label: String {
        switch self {
        case .spring: "Spring"
        case .summer: "Summer"
        case .autumn: "Autumn"
        case .winter: "Winter"
        case .custom: "Custom"
        }
    }

    /// Token swatch standing in for the row's `accent_color` hex.
    public var accent: Color {
        switch self {
        case .spring: Theme.Color.success
        case .summer: Theme.Color.warmAmber
        case .autumn: Theme.Color.rose
        case .winter: Theme.Color.info
        case .custom: Theme.Color.slate
        }
    }

    public var accentBg: Color {
        switch self {
        case .spring: Theme.Color.successBg
        case .summer: Theme.Color.warmAmberBg
        case .autumn: Theme.Color.roseBg
        case .winter: Theme.Color.infoBg
        case .custom: Theme.Color.slateBg
        }
    }
}

/// One row in the "Available themes" list.
public struct MailboxTheme: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let season: MailboxThemeSeason
    public let isUnlocked: Bool
    /// The row carries an `active_from` window, so it auto-applies in
    /// season — RN renders " · Auto-applies" (`stamps.tsx:186`).
    public let autoApplies: Bool

    public init(
        id: String,
        name: String,
        season: MailboxThemeSeason,
        isUnlocked: Bool,
        autoApplies: Bool
    ) {
        self.id = id
        self.name = name
        self.season = season
        self.isUnlocked = isUnlocked
        self.autoApplies = autoApplies
    }

    /// "Winter · Auto-applies".
    public var subtitle: String {
        autoApplies ? "\(season.label) · Auto-applies" : season.label
    }
}

/// The projected `GET /p3/themes` payload.
public struct StampThemesContent: Sendable, Hashable {
    public let themes: [MailboxTheme]
    public let activeThemeId: String?

    public init(themes: [MailboxTheme], activeThemeId: String?) {
        self.themes = themes
        self.activeThemeId = activeThemeId
    }

    public var activeTheme: MailboxTheme? {
        guard let activeThemeId else { return nil }
        return themes.first { $0.id == activeThemeId }
    }
}

/// Four-state contract for the themes view.
public enum StampThemesState: Sendable, Hashable {
    case loading
    case loaded(StampThemesContent)
    case empty
    case error(message: String)
}
