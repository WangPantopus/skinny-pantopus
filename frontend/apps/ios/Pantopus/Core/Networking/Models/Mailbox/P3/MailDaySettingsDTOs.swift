//
//  MailDaySettingsDTOs.swift
//  Pantopus
//
//  Wire DTOs for `GET|PATCH /api/mailbox/v2/p3/mailday/settings`
//  (`backend/routes/mailboxV2Phase3.js:1121` / `:1160`). Distinct from
//  `MailDayDTOs.swift`, which carries the triage-day frame from
//  `backend/routes/mailDay.js`.
//
//  Mirrors `data/api/models/mailbox/p3/MailDaySettingsDtos.kt` on Android.
//

import Foundation

/// The caller's Mail Day preference row. Every field is defaulted so the
/// server's "no row yet" defaults object and a real row decode alike.
public struct MailDaySettingsDTO: Decodable, Sendable, Hashable {
    public let deliveryTime: String?
    public let timezone: String?
    public let enabled: Bool
    public let soundEnabled: Bool
    /// `off` / `soft` / `classic`.
    public let soundType: String?
    public let hapticsEnabled: Bool
    public let includePersonal: Bool
    public let includeHome: Bool
    public let includeBusiness: Bool
    public let includeEarnCount: Bool
    public let includeCommunity: Bool
    public let interruptTimeSensitive: Bool
    public let interruptPackagesOtd: Bool
    public let interruptCertified: Bool
    public let currentTheme: String?

    private enum CodingKeys: String, CodingKey {
        case deliveryTime = "delivery_time"
        case timezone
        case enabled
        case soundEnabled = "sound_enabled"
        case soundType = "sound_type"
        case hapticsEnabled = "haptics_enabled"
        case includePersonal = "include_personal"
        case includeHome = "include_home"
        case includeBusiness = "include_business"
        case includeEarnCount = "include_earn_count"
        case includeCommunity = "include_community"
        case interruptTimeSensitive = "interrupt_time_sensitive"
        case interruptPackagesOtd = "interrupt_packages_otd"
        case interruptCertified = "interrupt_certified"
        case currentTheme = "current_theme"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        deliveryTime = try container.decodeIfPresent(String.self, forKey: .deliveryTime)
        timezone = try container.decodeIfPresent(String.self, forKey: .timezone)
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        soundEnabled = try container.decodeIfPresent(Bool.self, forKey: .soundEnabled) ?? true
        soundType = try container.decodeIfPresent(String.self, forKey: .soundType)
        hapticsEnabled = try container.decodeIfPresent(Bool.self, forKey: .hapticsEnabled) ?? true
        includePersonal = try container.decodeIfPresent(Bool.self, forKey: .includePersonal) ?? true
        includeHome = try container.decodeIfPresent(Bool.self, forKey: .includeHome) ?? true
        includeBusiness = try container.decodeIfPresent(Bool.self, forKey: .includeBusiness) ?? true
        includeEarnCount = try container.decodeIfPresent(Bool.self, forKey: .includeEarnCount) ?? true
        includeCommunity = try container.decodeIfPresent(Bool.self, forKey: .includeCommunity) ?? true
        interruptTimeSensitive = try container
            .decodeIfPresent(Bool.self, forKey: .interruptTimeSensitive) ?? true
        interruptPackagesOtd = try container
            .decodeIfPresent(Bool.self, forKey: .interruptPackagesOtd) ?? true
        interruptCertified = try container
            .decodeIfPresent(Bool.self, forKey: .interruptCertified) ?? true
        currentTheme = try container.decodeIfPresent(String.self, forKey: .currentTheme)
    }
}

/// `GET|PATCH` response envelope. `GET` returns the settings object at the
/// top level; `PATCH` wraps it as `{ settings }` — the view-model decodes
/// each with its own type.
public struct MailDaySettingsPatchResponse: Decodable, Sendable, Hashable {
    public let settings: MailDaySettingsDTO
}

/// Partial `PATCH` body. Only the toggled key is populated; Swift's
/// synthesised encoder omits the nil fields, so the Joi validator
/// (`backend/routes/mailboxV2Phase3.js:88`) sees exactly one key.
public struct MailDaySettingsPatch: Encodable, Sendable {
    public var deliveryTime: String?
    public var enabled: Bool?
    public var soundEnabled: Bool?
    public var soundType: String?
    public var hapticsEnabled: Bool?
    public var includePersonal: Bool?
    public var includeHome: Bool?
    public var includeBusiness: Bool?
    public var includeEarnCount: Bool?
    public var includeCommunity: Bool?
    public var interruptTimeSensitive: Bool?
    public var interruptPackagesOtd: Bool?
    public var interruptCertified: Bool?

    private enum CodingKeys: String, CodingKey {
        case deliveryTime = "delivery_time"
        case enabled
        case soundEnabled = "sound_enabled"
        case soundType = "sound_type"
        case hapticsEnabled = "haptics_enabled"
        case includePersonal = "include_personal"
        case includeHome = "include_home"
        case includeBusiness = "include_business"
        case includeEarnCount = "include_earn_count"
        case includeCommunity = "include_community"
        case interruptTimeSensitive = "interrupt_time_sensitive"
        case interruptPackagesOtd = "interrupt_packages_otd"
        case interruptCertified = "interrupt_certified"
    }

    public init() {}
}
