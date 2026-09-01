//
//  MailboxStampsDTOs.swift
//  Pantopus
//
//  Wire DTOs for the stamp-collection + seasonal-theme routes in
//  `backend/routes/mailboxV2Phase3.js`. Mirrors
//  `data/api/models/mailbox/p3/MailboxStampsDtos.kt` on Android.
//

import Foundation

/// One earned `Stamp` row (`backend/routes/mailboxV2Phase3.js:1208`).
public struct EarnedStampDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let stampType: String?
    public let name: String?
    public let description: String?
    /// `common` / `uncommon` / `rare` / `legendary`.
    public let rarity: String?
    public let earnedAt: String?
    public let earnedBy: String?
    public let visualUrl: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case stampType = "stamp_type"
        case name
        case description
        case rarity
        case earnedAt = "earned_at"
        case earnedBy = "earned_by"
        case visualUrl = "visual_url"
    }
}

/// One catalogue entry the caller hasn't earned yet
/// (`backend/routes/mailboxV2Phase3.js:1231`).
public struct LockedStampDTO: Decodable, Sendable, Hashable, Identifiable {
    public let stampType: String
    public let name: String?
    public let description: String?
    public let rarity: String?
    public let progress: Int?
    public let target: Int?

    public var id: String {
        stampType
    }

    private enum CodingKeys: String, CodingKey {
        case stampType = "stamp_type"
        case name
        case description
        case rarity
        case progress
        case target
    }
}

/// `GET /api/mailbox/v2/p3/stamps`.
public struct MailboxStampsResponse: Decodable, Sendable, Hashable {
    public let earned: [EarnedStampDTO]
    public let locked: [LockedStampDTO]
    public let totalEarned: Int
    public let totalAvailable: Int

    private enum CodingKeys: String, CodingKey {
        case earned
        case locked
        case totalEarned = "total_earned"
        case totalAvailable = "total_available"
    }
}

/// One `SeasonalTheme` row, enriched server-side with `unlocked`
/// (`backend/routes/mailboxV2Phase3.js:1266`).
public struct SeasonalThemeDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String?
    /// `spring` / `summer` / `autumn` / `winter` / `custom`.
    public let season: String?
    public let accentColor: String?
    public let autoApply: Bool?
    public let activeFrom: String?
    public let activeUntil: String?
    /// `default` / `stamp_milestone` / `earned` / `seasonal_auto` / `premium`.
    public let unlockCondition: String?
    public let unlocked: Bool?

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case season
        case accentColor = "accent_color"
        case autoApply = "auto_apply"
        case activeFrom = "active_from"
        case activeUntil = "active_until"
        case unlockCondition = "unlock_condition"
        case unlocked
    }
}

/// `GET /api/mailbox/v2/p3/themes` — `{ themes, active }`.
public struct SeasonalThemesResponse: Decodable, Sendable, Hashable {
    public let themes: [SeasonalThemeDTO]
    public let active: String?
}

/// `POST /api/mailbox/v2/p3/themes/apply` — `{ message }`.
public struct ApplyMailboxThemeResponse: Decodable, Sendable, Hashable {
    public let message: String?
}
