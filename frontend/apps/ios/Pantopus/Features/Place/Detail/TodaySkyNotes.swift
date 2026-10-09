//
//  TodaySkyNotes.swift
//  Pantopus
//
//  Picking the Now card's note: the shared notes in `SkyNote.swift`, plus
//  the ones that read the app's weather data (freezing, strong wind, the
//  warmest day).
//  Parity twin of Android's `SkyNote.kt`.
//

import Foundation

extension PlaceCalendarEvent: SkyPickupDate {}

extension SkyNote {
    /// The most useful note for this moment, or nil when nothing is worth saying.
    static func pick(
        now: Date,
        moment: SkyMoment,
        weather: PlaceWeatherData,
        pickups: [PlaceCalendarEvent],
        air: SkyAir? = nil,
        calendar: Calendar = .autoupdatingCurrent
    ) -> SkyNote? {
        let sky = SkyPalette.Weather(weather.conditionCode)
        let clear = sky == .clear || sky == .partly
        // In order, the first that has something to say. Unhealthy air (151+)
        // comes first; air for sensitive groups after the bins.
        let pickers: [() -> SkyNote?] = [
            { air.flatMap { $0.aqi >= 151 ? Self.air($0) : nil } },
            { bins(now: now, moment: moment, pickups: pickups, calendar: calendar) },
            { Self.air(air) },
            { frost(weather: weather, moment: moment) },
            { strongWind(weather: weather) },
            { clear ? meteors(now: now, moment: moment, calendar: calendar) : nil },
            { moon(moment: moment, clear: clear) },
            { solsticeOrEquinox(now: now, calendar: calendar) },
            { warmest(now: now, weather: weather, moment: moment, calendar: calendar) },
            { clear ? goldenHour(moment: moment) : nil }
        ]
        for picker in pickers {
            if let note = picker() { return note }
        }
        return nil
    }

    // MARK: - Frost

    static func frost(weather: PlaceWeatherData, moment: SkyMoment) -> SkyNote? {
        if weather.currentTempF <= 32 {
            return SkyNote(kind: .belowFreezing, kicker: "❄️ BELOW FREEZING", spoken: "Below freezing now.")
        }
        // From mid-afternoon on: the next 14 hours dip to freezing.
        guard moment.minutes >= 15 * 60, let low = weather.hourly.prefix(14).map(\.tempF).min(), low <= 32 else { return nil }
        return SkyNote(kind: .frost, kicker: "❄️ FROST TONIGHT", spoken: "Frost likely tonight, down to \(Int(low.rounded()))°.")
    }

    // MARK: - Strong wind

    /// Sustained wind of 30 mph or more (about where wind advisories start),
    /// now or in the next six hours: rare, and a reason to secure loose things.
    static func strongWind(weather: PlaceWeatherData) -> SkyNote? {
        if let now = weather.windMph, now >= 30 {
            let mph = Int(now.rounded())
            return SkyNote(kind: .wind, kicker: "💨 STRONG WIND NOW", spoken: "Strong wind now, \(mph) miles per hour.")
        }
        let ahead: [Double] = weather.hourly.prefix(6).compactMap(\.windMph)
        guard let peak = ahead.max(), peak >= 30 else { return nil }
        return SkyNote(
            kind: .wind,
            kicker: "💨 STRONG WIND AHEAD",
            spoken: "Strong wind ahead, up to \(Int(peak.rounded())) miles per hour in the next six hours."
        )
    }

    // MARK: - Warmest day

    static func warmest(now: Date, weather: PlaceWeatherData, moment: SkyMoment, calendar: Calendar) -> SkyNote? {
        guard moment.phase != .night, weather.daily.count >= 4, let today = weather.daily.first,
              today.date.hasPrefix(dayKey(now, calendar: calendar)), today.highF >= 70,
              let next = weather.daily.dropFirst().map(\.highF).max(), today.highF >= next + 2 else { return nil }
        return SkyNote(
            kind: .warmestDay,
            kicker: "🌡️ WARMEST THIS WEEK",
            spoken: "The warmest day this week, up to \(Int(today.highF.rounded()))°."
        )
    }
}
