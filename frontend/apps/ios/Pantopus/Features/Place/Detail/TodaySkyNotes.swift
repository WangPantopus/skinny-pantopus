//
//  TodaySkyNotes.swift
//  Pantopus
//
//  Picking the Now card's note: the shared notes in `SkyNote.swift`, plus
//  the ones that read the app's weather data (freezing, the warmest day).
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
        calendar: Calendar = .autoupdatingCurrent
    ) -> SkyNote? {
        let sky = SkyPalette.Weather(weather.conditionCode)
        let clear = sky == .clear || sky == .partly
        return bins(now: now, moment: moment, pickups: pickups, calendar: calendar)
            ?? frost(weather: weather, moment: moment)
            ?? (clear ? meteors(now: now, moment: moment, calendar: calendar) : nil)
            ?? moon(moment: moment, clear: clear)
            ?? solsticeOrEquinox(now: now, calendar: calendar)
            ?? warmest(now: now, weather: weather, moment: moment, calendar: calendar)
            ?? (clear ? goldenHour(moment: moment) : nil)
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
