//
//  MailDaySettingsContent.swift
//  Pantopus
//
//  A13.16 — render models for the Mail Day **settings** sub-view, reached
//  from the gear on the day header. Backed by
//  `GET|PATCH /api/mailbox/v2/p3/mailday/settings`
//  (`backend/routes/mailboxV2Phase3.js:1121` / `:1160`).
//
//  Ports RN's settings frame (`src/app/mailbox/mailday.tsx:76-189`):
//  delivery time + "Mail Day enabled", the five include-in-digest
//  switches, the three always-interrupt switches, and the sound-type
//  picker with a haptics switch. Every flip PATCHes exactly one key.
//
//  Mirrors `ui/screens/mailbox/mail_day/MailDaySettingsContent.kt`.
//

import Foundation

/// The three `sound_type` values the validator accepts
/// (`backend/routes/mailboxV2Phase3.js:93`).
public enum MailDaySoundType: String, Sendable, Hashable, CaseIterable, Identifiable {
    case off
    case soft
    case classic

    public var id: String {
        rawValue
    }

    public static func fromRaw(_ raw: String?) -> MailDaySoundType {
        MailDaySoundType(rawValue: raw?.lowercased() ?? "") ?? .soft
    }

    public var label: String {
        switch self {
        case .off: "Off"
        case .soft: "Soft"
        case .classic: "Classic"
        }
    }
}

/// Every boolean switch on the settings frame, in RN's render order.
/// `patch` builds the one-key PATCH body for a flip.
public enum MailDaySettingKey: String, Sendable, Hashable, CaseIterable, Identifiable {
    case enabled
    case includePersonal
    case includeHome
    case includeBusiness
    case includeEarnCount
    case includeCommunity
    case interruptTimeSensitive
    case interruptPackagesOtd
    case interruptCertified
    case hapticsEnabled

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .enabled: "Mail Day enabled"
        case .includePersonal: "Personal drawer"
        case .includeHome: "Home drawer"
        case .includeBusiness: "Business drawer"
        case .includeEarnCount: "Earn offers count"
        case .includeCommunity: "Neighborhood notices"
        case .interruptTimeSensitive: "Time-sensitive mail"
        case .interruptPackagesOtd: "Packages out for delivery"
        case .interruptCertified: "Certified mail"
        case .hapticsEnabled: "Haptics"
        }
    }

    /// The five "INCLUDE IN MAIL DAY" switches.
    public static let includeGroup: [MailDaySettingKey] = [
        .includePersonal, .includeHome, .includeBusiness, .includeEarnCount, .includeCommunity
    ]

    /// The three "ALWAYS INTERRUPT (INSTANT)" switches.
    public static let interruptGroup: [MailDaySettingKey] = [
        .interruptTimeSensitive, .interruptPackagesOtd, .interruptCertified
    ]

    /// One-key PATCH body for this switch.
    public func patch(_ value: Bool) -> MailDaySettingsPatch {
        var body = MailDaySettingsPatch()
        switch self {
        case .enabled: body.enabled = value
        case .includePersonal: body.includePersonal = value
        case .includeHome: body.includeHome = value
        case .includeBusiness: body.includeBusiness = value
        case .includeEarnCount: body.includeEarnCount = value
        case .includeCommunity: body.includeCommunity = value
        case .interruptTimeSensitive: body.interruptTimeSensitive = value
        case .interruptPackagesOtd: body.interruptPackagesOtd = value
        case .interruptCertified: body.interruptCertified = value
        case .hapticsEnabled: body.hapticsEnabled = value
        }
        return body
    }
}

/// Mutable projection of `MailDaySettingsDTO` so the switches can flip
/// optimistically and roll back when the PATCH fails.
public struct MailDaySettingsForm: Sendable, Hashable {
    public var deliveryTime: String
    public var timezone: String
    public var soundType: MailDaySoundType
    private var flags: [String: Bool]

    public init(dto: MailDaySettingsDTO) {
        deliveryTime = dto.deliveryTime ?? "08:00"
        timezone = dto.timezone ?? "America/New_York"
        soundType = MailDaySoundType.fromRaw(dto.soundType)
        flags = [
            MailDaySettingKey.enabled.rawValue: dto.enabled,
            MailDaySettingKey.includePersonal.rawValue: dto.includePersonal,
            MailDaySettingKey.includeHome.rawValue: dto.includeHome,
            MailDaySettingKey.includeBusiness.rawValue: dto.includeBusiness,
            MailDaySettingKey.includeEarnCount.rawValue: dto.includeEarnCount,
            MailDaySettingKey.includeCommunity.rawValue: dto.includeCommunity,
            MailDaySettingKey.interruptTimeSensitive.rawValue: dto.interruptTimeSensitive,
            MailDaySettingKey.interruptPackagesOtd.rawValue: dto.interruptPackagesOtd,
            MailDaySettingKey.interruptCertified.rawValue: dto.interruptCertified,
            MailDaySettingKey.hapticsEnabled.rawValue: dto.hapticsEnabled
        ]
    }

    public func value(for key: MailDaySettingKey) -> Bool {
        flags[key.rawValue] ?? false
    }

    public mutating func set(_ key: MailDaySettingKey, to value: Bool) {
        flags[key.rawValue] = value
    }
}

/// Four-state contract for the settings sub-view (an empty settings row
/// is impossible — the backend returns defaults — so `.empty` folds into
/// `.loaded`).
public enum MailDaySettingsState: Sendable, Hashable {
    case loading
    case loaded(MailDaySettingsForm)
    case error(message: String)
}
