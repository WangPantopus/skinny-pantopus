//
//  NotificationPreferencesDTOs.swift
//  Pantopus
//
//  T2 — hub notification / briefing preferences. Shape mirrors the
//  `UserNotificationPreferences` row the backend returns from
//  `GET /api/hub/preferences` (`backend/routes/hub.js:648-691`) and
//  echoes back from `PUT /api/hub/preferences`
//  (`backend/routes/hub.js:716-750`).
//
//  Every field is optional on the wire: the handler returns the raw DB
//  row when one exists (columns can be null) and a hand-built default
//  object when it doesn't. The defaults applied here are byte-for-byte
//  the handler's own defaults (`hub.js:666-684`) so a partially-populated
//  row renders the same as a missing one.
//
//  Fields are `var` because the view-model mutates them optimistically
//  before the debounced PUT lands.
//

import Foundation

/// Envelope for both `GET` and `PUT /api/hub/preferences`.
public struct NotificationPreferencesResponseDTO: Decodable, Sendable, Hashable {
    public let preferences: NotificationPreferencesDTO

    public init(preferences: NotificationPreferencesDTO) {
        self.preferences = preferences
    }
}

/// Where the briefing pulls weather / nearby context from.
/// Validated server-side against this exact set (`hub.js:710`).
public enum BriefingLocationMode: String, Sendable, Hashable, CaseIterable {
    case primaryHome = "primary_home"
    case viewingLocation = "viewing_location"
    case deviceLocation = "device_location"
    case custom
}

public struct NotificationPreferencesDTO: Decodable, Sendable, Hashable {
    /// Morning briefing (`daily_*` on the wire — the backend never
    /// renamed the column when the evening briefing was added).
    public var dailyBriefingEnabled: Bool
    /// `HH:mm`, 24-hour. Server validates `/^\d{2}:\d{2}$/` (`hub.js:699`).
    public var dailyBriefingTimeLocal: String
    /// IANA zone the briefing times are interpreted in.
    public var dailyBriefingTimezone: String?
    public var eveningBriefingEnabled: Bool
    /// `HH:mm`, 24-hour.
    public var eveningBriefingTimeLocal: String
    public var weatherAlertsEnabled: Bool
    public var aqiAlertsEnabled: Bool
    public var mailSummaryEnabled: Bool
    public var gigUpdatesEnabled: Bool
    public var homeRemindersEnabled: Bool
    /// `HH:mm` or nil. Nil on *either* end means quiet hours are off.
    public var quietHoursStartLocal: String?
    public var quietHoursEndLocal: String?
    /// Raw wire value — kept as a string so an unknown server-side mode
    /// round-trips instead of being coerced to a default.
    public var locationMode: String

    /// Typed projection of `locationMode`; nil when the server sent a
    /// value this build doesn't know.
    public var briefingLocationMode: BriefingLocationMode? {
        BriefingLocationMode(rawValue: locationMode)
    }

    /// Quiet hours are on when the server holds a start time.
    /// Mirrors RN (`notification-preferences.tsx:205`).
    public var quietHoursEnabled: Bool {
        quietHoursStartLocal != nil
    }

    public init(
        dailyBriefingEnabled: Bool = false,
        dailyBriefingTimeLocal: String = "07:30",
        dailyBriefingTimezone: String? = "America/Los_Angeles",
        eveningBriefingEnabled: Bool = true,
        eveningBriefingTimeLocal: String = "18:00",
        weatherAlertsEnabled: Bool = true,
        aqiAlertsEnabled: Bool = true,
        mailSummaryEnabled: Bool = true,
        gigUpdatesEnabled: Bool = true,
        homeRemindersEnabled: Bool = true,
        quietHoursStartLocal: String? = nil,
        quietHoursEndLocal: String? = nil,
        locationMode: String = BriefingLocationMode.primaryHome.rawValue
    ) {
        self.dailyBriefingEnabled = dailyBriefingEnabled
        self.dailyBriefingTimeLocal = dailyBriefingTimeLocal
        self.dailyBriefingTimezone = dailyBriefingTimezone
        self.eveningBriefingEnabled = eveningBriefingEnabled
        self.eveningBriefingTimeLocal = eveningBriefingTimeLocal
        self.weatherAlertsEnabled = weatherAlertsEnabled
        self.aqiAlertsEnabled = aqiAlertsEnabled
        self.mailSummaryEnabled = mailSummaryEnabled
        self.gigUpdatesEnabled = gigUpdatesEnabled
        self.homeRemindersEnabled = homeRemindersEnabled
        self.quietHoursStartLocal = quietHoursStartLocal
        self.quietHoursEndLocal = quietHoursEndLocal
        self.locationMode = locationMode
    }

    private enum CodingKeys: String, CodingKey {
        case dailyBriefingEnabled = "daily_briefing_enabled"
        case dailyBriefingTimeLocal = "daily_briefing_time_local"
        case dailyBriefingTimezone = "daily_briefing_timezone"
        case eveningBriefingEnabled = "evening_briefing_enabled"
        case eveningBriefingTimeLocal = "evening_briefing_time_local"
        case weatherAlertsEnabled = "weather_alerts_enabled"
        case aqiAlertsEnabled = "aqi_alerts_enabled"
        case mailSummaryEnabled = "mail_summary_enabled"
        case gigUpdatesEnabled = "gig_updates_enabled"
        case homeRemindersEnabled = "home_reminders_enabled"
        case quietHoursStartLocal = "quiet_hours_start_local"
        case quietHoursEndLocal = "quiet_hours_end_local"
        case locationMode = "location_mode"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        try self.init(
            dailyBriefingEnabled: container.decodeIfPresent(Bool.self, forKey: .dailyBriefingEnabled) ?? false,
            dailyBriefingTimeLocal: container.decodeIfPresent(String.self, forKey: .dailyBriefingTimeLocal)
                ?? "07:30",
            dailyBriefingTimezone: container.decodeIfPresent(String.self, forKey: .dailyBriefingTimezone),
            eveningBriefingEnabled: container.decodeIfPresent(Bool.self, forKey: .eveningBriefingEnabled) ?? true,
            eveningBriefingTimeLocal: container.decodeIfPresent(String.self, forKey: .eveningBriefingTimeLocal)
                ?? "18:00",
            weatherAlertsEnabled: container.decodeIfPresent(Bool.self, forKey: .weatherAlertsEnabled) ?? true,
            aqiAlertsEnabled: container.decodeIfPresent(Bool.self, forKey: .aqiAlertsEnabled) ?? true,
            mailSummaryEnabled: container.decodeIfPresent(Bool.self, forKey: .mailSummaryEnabled) ?? true,
            gigUpdatesEnabled: container.decodeIfPresent(Bool.self, forKey: .gigUpdatesEnabled) ?? true,
            homeRemindersEnabled: container.decodeIfPresent(Bool.self, forKey: .homeRemindersEnabled) ?? true,
            quietHoursStartLocal: container.decodeIfPresent(String.self, forKey: .quietHoursStartLocal),
            quietHoursEndLocal: container.decodeIfPresent(String.self, forKey: .quietHoursEndLocal),
            locationMode: container.decodeIfPresent(String.self, forKey: .locationMode)
                ?? BriefingLocationMode.primaryHome.rawValue
        )
    }
}
