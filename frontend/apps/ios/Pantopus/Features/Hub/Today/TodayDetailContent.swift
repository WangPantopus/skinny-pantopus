//
//  TodayDetailContent.swift
//  Pantopus
//
//  A10.3 — Render payload for the Hub "Today" briefing. Pure value types so
//  the view-model can be fed deterministic stub data (`TodaySampleData`) and
//  every state snapshots reproducibly. Colour is expressed as a semantic
//  `TodayTone`; the view layer maps tones → `Theme.Color` so the model stays
//  free of SwiftUI types.
//

import Foundation

/// Semantic colour role used by signals, chips, and dots. The view maps each
/// case onto the design-system palette (foreground + tinted background).
public enum TodayTone: Equatable, Sendable {
    case neutral
    case personal
    case home
    case business
    case success
    case warning
    case error
}

/// A weather/air metric chip in the hero row (AQI · UV · Wind).
public struct TodayHeroChip: Identifiable, Equatable, Sendable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let value: String
    public let scale: String?
    public let dotTone: TodayTone?

    public init(
        icon: PantopusIcon,
        label: String,
        value: String,
        scale: String? = nil,
        dotTone: TodayTone? = nil
    ) {
        id = label
        self.icon = icon
        self.label = label
        self.value = value
        self.scale = scale
        self.dotTone = dotTone
    }
}

/// Advisory ribbon shown under the hero headline in the alert state.
public struct TodayAlertRibbon: Equatable, Sendable {
    public let title: String
    public let body: String

    public init(title: String, body: String) {
        self.title = title
        self.body = body
    }
}

/// "Sun & sky" arc data — `progress` is the sun's position along the daylight
/// arc in `0...1` (0 = sunrise, 1 = sunset).
public struct TodaySunSky: Equatable, Sendable {
    public let progress: Double
    public let sunrise: String
    public let sunset: String
    public let phaseLabel: String
    public let daylight: String

    public init(progress: Double, sunrise: String, sunset: String, phaseLabel: String, daylight: String) {
        self.progress = progress
        self.sunrise = sunrise
        self.sunset = sunset
        self.phaseLabel = phaseLabel
        self.daylight = daylight
    }
}

/// A weather-driven signal row inside the Signals section.
public struct TodaySignal: Identifiable, Equatable, Sendable {
    /// Optional severity pill + matching left-bar stripe.
    public struct Severity: Equatable, Sendable {
        public let label: String
        public let tone: TodayTone

        public init(label: String, tone: TodayTone) {
            self.label = label
            self.tone = tone
        }
    }

    public let id: String
    public let icon: PantopusIcon
    public let tone: TodayTone
    public let title: String
    public let body: String
    public let timing: String
    public let severity: Severity?

    public init(
        id: String,
        icon: PantopusIcon,
        tone: TodayTone,
        title: String,
        body: String,
        timing: String,
        severity: Severity? = nil
    ) {
        self.id = id
        self.icon = icon
        self.tone = tone
        self.title = title
        self.body = body
        self.timing = timing
        self.severity = severity
    }
}

/// A single "Around the block" datapoint (coloured dot + text).
public struct TodayAroundItem: Identifiable, Equatable, Sendable {
    public let id: String
    public let tone: TodayTone
    public let text: String

    public init(id: String, tone: TodayTone, text: String) {
        self.id = id
        self.tone = tone
        self.text = text
    }
}

/// The trailing share card (quiet primary CTA for a read-mostly briefing).
public struct TodayShareCard: Equatable, Sendable {
    public let title: String
    public let subtitle: String

    public init(title: String, subtitle: String) {
        self.title = title
        self.subtitle = subtitle
    }
}

/// Full render payload for the Today detail screen.
public struct TodayDetailContent: Equatable, Sendable {
    /// Locality kicker, e.g. "Elm Park" or "Elm Park · Advisory".
    public let kicker: String
    /// Top-bar date sub-line, e.g. "Tue · May 20".
    public let dateLabel: String
    /// Big temperature headline, e.g. "67°".
    public let temperature: String
    /// Condition phrase, e.g. "Mostly sunny" / "Hard freeze".
    public let condition: String
    /// High / low / feels-like sub line.
    public let highLowFeels: String
    /// Hero weather glyph (maps to the condition).
    public let glyph: PantopusIcon
    /// AQI · UV · Wind chips.
    public let chips: [TodayHeroChip]
    /// Present only in the alert state — drives the red ribbon + state.
    public let ribbon: TodayAlertRibbon?
    public let sunSky: TodaySunSky
    /// Signals section title, e.g. "Signals · 4 today".
    public let signalsTitle: String
    /// Accent dot tone on the Signals header (primary normally, error on alert).
    public let signalsAccent: TodayTone
    public let signals: [TodaySignal]
    public let aroundTitle: String
    public let around: [TodayAroundItem]
    public let share: TodayShareCard

    /// Whether this briefing is an advisory — selects the `.alert` state and
    /// the alert-triangle kicker glyph.
    public var isAlert: Bool {
        ribbon != nil
    }

    public init(
        kicker: String,
        dateLabel: String,
        temperature: String,
        condition: String,
        highLowFeels: String,
        glyph: PantopusIcon,
        chips: [TodayHeroChip],
        ribbon: TodayAlertRibbon? = nil,
        sunSky: TodaySunSky,
        signalsTitle: String,
        signalsAccent: TodayTone,
        signals: [TodaySignal],
        aroundTitle: String,
        around: [TodayAroundItem],
        share: TodayShareCard
    ) {
        self.kicker = kicker
        self.dateLabel = dateLabel
        self.temperature = temperature
        self.condition = condition
        self.highLowFeels = highLowFeels
        self.glyph = glyph
        self.chips = chips
        self.ribbon = ribbon
        self.sunSky = sunSky
        self.signalsTitle = signalsTitle
        self.signalsAccent = signalsAccent
        self.signals = signals
        self.aroundTitle = aroundTitle
        self.around = around
        self.share = share
    }
}
