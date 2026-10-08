//
//  SkyMoment.swift
//  Pantopus
//
//  Where the day is at this address (dawn, day, dusk or night, how far
//  the sun has travelled, the moon's phase) and the weather families the
//  sky distinguishes. Shared with the widget extension, which draws the
//  same sky (see `project.yml`), so it uses nothing from the app module.
//  Parity twin of Android's `SkyMoment.kt`.
//

import SwiftUI

// MARK: - Moment (time of day, sun and moon)

/// Where the day is at this address: phase, how far the sun has
/// travelled, and the moon's phase.
struct SkyMoment: Equatable {
    let phase: SkyPalette.Phase
    /// 0 at sunrise, 1 at sunset, clamped.
    let dayFraction: Double
    /// 11 pm to 5 am: only one window stays lit.
    let lateNight: Bool
    /// 0 new moon, 0.5 full, back toward 1 at the next new moon.
    let moonPhase: Double
    /// Minutes past local midnight now, at sunrise and at sunset.
    let minutes: Double
    let sunrise: Double
    let sunset: Double

    /// Sunrise and sunset arrive as local wall-clock times ("2026-10-07T07:15")
    /// and can be a day old just after midnight; only their clock times are
    /// used, which drift by a couple of minutes a day.
    static func at(_ now: Date, sunrise: String?, sunset: String?, calendar: Calendar = .autoupdatingCurrent) -> SkyMoment {
        let parts = calendar.dateComponents([.hour, .minute, .second], from: now)
        let minutes = Double(parts.hour ?? 12) * 60 + Double(parts.minute ?? 0) + Double(parts.second ?? 0) / 60
        var rise = clockMinutes(sunrise, calendar: calendar) ?? 390
        var set = clockMinutes(sunset, calendar: calendar) ?? 1110
        if set <= rise {
            rise = 390
            set = 1110
        }
        let phase: SkyPalette.Phase = if minutes >= rise - 30, minutes < rise + 40 {
            .dawn
        } else if minutes >= rise + 40, minutes < set - 40 {
            .day
        } else if minutes >= set - 40, minutes < set + 30 {
            .dusk
        } else {
            .night
        }
        return SkyMoment(
            phase: phase,
            dayFraction: min(max((minutes - rise) / (set - rise), 0), 1),
            lateNight: minutes >= 23 * 60 || minutes < 5 * 60,
            moonPhase: moonPhase(at: now),
            minutes: minutes,
            sunrise: rise,
            sunset: set
        )
    }

    /// Minutes past midnight of a sunrise/sunset string. A bare wall-clock
    /// time is taken as written; a zoned instant is read in the local zone.
    static func clockMinutes(_ raw: String?, calendar: Calendar = .autoupdatingCurrent) -> Double? {
        guard let raw, let tee = raw.firstIndex(of: "T") else { return nil }
        let clock = raw[raw.index(after: tee)...]
        let zoned = clock.contains("Z") || clock.contains("+") || clock.dropFirst(5).contains("-")
        if zoned, let date = instant(raw) {
            let parts = calendar.dateComponents([.hour, .minute], from: date)
            return Double(parts.hour ?? 0) * 60 + Double(parts.minute ?? 0)
        }
        let fields = clock.prefix(5).split(separator: ":")
        guard fields.count == 2, let hour = Double(fields[0]), let minute = Double(fields[1]),
              (0..<24).contains(hour), (0..<60).contains(minute) else { return nil }
        return hour * 60 + minute
    }

    /// An ISO 8601 instant, with or without fractional seconds.
    static func instant(_ raw: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
    }

    /// "5:38 PM" for minutes past local midnight, in the person's own clock style.
    static func clockText(_ minutes: Double, calendar: Calendar = .autoupdatingCurrent) -> String {
        let midnight = calendar.startOfDay(for: Date())
        return midnight.addingTimeInterval(minutes * 60).formatted(date: .omitted, time: .shortened)
    }

    /// The moon's age as a fraction of the 29.53-day synodic month, from the
    /// new moon of 6 January 2000 (Julian day 2451550.1).
    static func moonPhase(at date: Date) -> Double {
        let julianDay = date.timeIntervalSince1970 / 86400 + 2_440_587.5
        let cycles = (julianDay - 2_451_550.1) / 29.530588853
        let fraction = cycles - cycles.rounded(.down)
        return fraction < 0 ? fraction + 1 : fraction
    }
}

extension SkyPalette.Weather {
    init(_ code: WeatherConditionCode) {
        switch code {
        case .clear, .wind: self = .clear
        case .partlyCloudy: self = .partly
        case .cloudy, .unknown: self = .overcast
        case .fog: self = .fog
        case .rain, .sleet: self = .wet
        case .snow: self = .snow
        case .thunderstorm: self = .storm
        }
    }
}
