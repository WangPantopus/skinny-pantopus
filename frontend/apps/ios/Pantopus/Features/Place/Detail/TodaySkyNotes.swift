//
//  TodaySkyNotes.swift
//  Pantopus
//
//  One true, timely line for the Now card ("🌕 FULL MOON TONIGHT" in place
//  of "NOW"), and the season for the tree in the scene. A note is shown only
//  when it is true for this address right now: the household's own pickup
//  day, a freezing forecast, a meteor shower's peak night, the moon's phase,
//  a solstice or equinox, the week's warmest day, golden hour.
//  Parity twin of Android's `SkyNote.kt`.
//

import Foundation

struct SkyNote: Equatable {
    enum Kind: Equatable {
        case binsOut
        case pickupToday
        case frost
        case belowFreezing
        case meteors
        case fullMoon
        case newMoon
        case longestDay
        case shortestDay
        case equinox
        case warmestDay
        case goldenHour
    }

    let kind: Kind
    /// Replaces "NOW" above the temperature.
    let kicker: String
    /// Said before the reading, e.g. "Full moon tonight."
    let spoken: String
    /// Bins the scene puts at the curb: "garbage", "recycling", "yard_waste".
    var bins: [String] = []

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

    // MARK: - Pickup day

    private static let pickupKinds = ["garbage", "recycling", "yard_waste"]

    /// The evening before a pickup (from 4 pm) and the pickup morning (until
    /// noon). Only days the household set itself: city defaults are
    /// unconfirmed, the same rule the pickup reminders follow.
    static func bins(now: Date, moment: SkyMoment, pickups: [PlaceCalendarEvent], calendar: Calendar) -> SkyNote? {
        let evening = moment.minutes >= 16 * 60
        guard evening || moment.minutes < 12 * 60,
              let day = calendar.date(byAdding: .day, value: evening ? 1 : 0, to: now) else { return nil }
        let key = dayKey(day, calendar: calendar)
        let kinds = pickupKinds.filter { kind in
            pickups.contains { $0.kind == kind && $0.scope == "home" && $0.date.hasPrefix(key) }
        }
        guard !kinds.isEmpty else { return nil }
        let list = ListFormatter.localizedString(byJoining: kinds.map { $0 == "yard_waste" ? "yard waste" : $0 })
        let capitalized = list.prefix(1).uppercased() + list.dropFirst()
        return evening
            ? SkyNote(
                kind: .binsOut,
                kicker: "🗑️ BINS OUT TONIGHT",
                spoken: "Bins out tonight. \(capitalized) pickup tomorrow.",
                bins: kinds
            )
            : SkyNote(kind: .pickupToday, kicker: "🗑️ PICKUP TODAY", spoken: "\(capitalized) pickup today.", bins: kinds)
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

    // MARK: - Meteor showers

    /// The major showers' peak nights, by the date the night starts (the
    /// night of D into D + 1). Peaks shift by about a day from year to year.
    private struct Shower {
        let month: Int
        let day: Int
        let name: String
    }

    private static let showers = [
        Shower(month: 1, day: 3, name: "Quadrantid"), Shower(month: 4, day: 21, name: "Lyrid"),
        Shower(month: 5, day: 5, name: "Eta Aquariid"), Shower(month: 8, day: 12, name: "Perseid"),
        Shower(month: 10, day: 20, name: "Orionid"), Shower(month: 11, day: 16, name: "Leonid"),
        Shower(month: 12, day: 13, name: "Geminid")
    ]

    static func meteors(now: Date, moment: SkyMoment, calendar: Calendar) -> SkyNote? {
        guard moment.phase == .night,
              let night = calendar.date(byAdding: .day, value: moment.minutes >= 12 * 60 ? 0 : -1, to: now) else { return nil }
        let parts = calendar.dateComponents([.month, .day], from: night)
        guard let shower = showers.first(where: { $0.month == parts.month && $0.day == parts.day }) else { return nil }
        return SkyNote(kind: .meteors, kicker: "🌠 METEORS TONIGHT", spoken: "The \(shower.name) meteor shower peaks tonight.")
    }

    // MARK: - Moon

    /// Within half a day of full (or new): the moon looks full all night.
    private static let halfDay = 0.5 / 29.530588853

    static func moon(moment: SkyMoment, clear: Bool) -> SkyNote? {
        if abs(moment.moonPhase - 0.5) <= halfDay {
            return SkyNote(kind: .fullMoon, kicker: "🌕 FULL MOON TONIGHT", spoken: "Full moon tonight.")
        }
        if clear, moment.phase == .night, moment.moonPhase <= halfDay || moment.moonPhase >= 1 - halfDay {
            return SkyNote(kind: .newMoon, kicker: "🌑 NEW MOON TONIGHT", spoken: "New moon tonight: a dark sky for stars.")
        }
        return nil
    }

    // MARK: - Solstices and equinoxes

    /// March equinox, June solstice, September equinox, December solstice (UTC).
    private static let turningPoints: [String] = [
        "2026-03-20T14:46:00Z", "2026-06-21T08:24:00Z", "2026-09-23T00:05:00Z", "2026-12-21T20:50:00Z",
        "2027-03-20T20:25:00Z", "2027-06-21T14:11:00Z", "2027-09-23T06:01:00Z", "2027-12-22T02:42:00Z",
        "2028-03-20T02:17:00Z", "2028-06-20T20:02:00Z", "2028-09-22T11:45:00Z", "2028-12-21T08:20:00Z",
        "2029-03-20T08:02:00Z", "2029-06-21T01:48:00Z", "2029-09-22T17:38:00Z", "2029-12-21T14:14:00Z",
        "2030-03-20T13:51:00Z", "2030-06-21T07:31:00Z", "2030-09-22T23:27:00Z", "2030-12-21T20:09:00Z"
    ]

    static func solsticeOrEquinox(now: Date, calendar: Calendar) -> SkyNote? {
        let today = dayKey(now, calendar: calendar)
        let parser = ISO8601DateFormatter()
        for (index, stamp) in turningPoints.enumerated() {
            guard let instant = parser.date(from: stamp), dayKey(instant, calendar: calendar) == today else { continue }
            switch index % 4 {
            case 1: return SkyNote(kind: .longestDay, kicker: "☀️ LONGEST DAY", spoken: "The longest day of the year.")
            case 3: return SkyNote(
                    kind: .shortestDay,
                    kicker: "🌗 SHORTEST DAY",
                    spoken: "The shortest day of the year. Days get longer from tomorrow."
                )
            default: return SkyNote(kind: .equinox, kicker: "🌗 EQUINOX TODAY", spoken: "Equinox: day and night are about equal.")
            }
        }
        return nil
    }

    // MARK: - Warmest day, golden hour

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

    /// The hour before sunset, announced from an hour and a half ahead.
    static func goldenHour(moment: SkyMoment) -> SkyNote? {
        let start = moment.sunset - 60
        if moment.minutes >= start - 90, moment.minutes < start {
            let time = SkyMoment.clockText(start)
            return SkyNote(kind: .goldenHour, kicker: "🌇 GOLDEN HOUR \(time)", spoken: "Golden hour starts at \(time).")
        }
        if moment.minutes >= start, moment.minutes < moment.sunset {
            return SkyNote(kind: .goldenHour, kicker: "🌇 GOLDEN HOUR NOW", spoken: "It's golden hour.")
        }
        return nil
    }

    static func dayKey(_ date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

/// Northern-hemisphere seasons as a tree shows them: blossom, leaf, colour, bare.
enum SkySeason: Equatable {
    case spring
    case summer
    case autumn
    case winter

    static func at(_ date: Date, calendar: Calendar = .autoupdatingCurrent) -> SkySeason {
        let parts = calendar.dateComponents([.month, .day], from: date)
        switch (parts.month ?? 1) * 100 + (parts.day ?? 1) {
        case 315..<516: return .spring
        case 516..<915: return .summer
        case 915..<1201: return .autumn
        default: return .winter
        }
    }
}
