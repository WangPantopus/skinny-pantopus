//
//  SkyNote.swift
//  Pantopus
//
//  One true, timely line for the Now card ("🌕 FULL MOON TONIGHT" in place
//  of "NOW"), and the season for the tree in the scene. A note is shown only
//  when it is true for this address right now: the household's own pickup
//  day, a freezing forecast, a meteor shower's peak night, the moon's phase,
//  a solstice or equinox, the week's warmest day, golden hour.
//  The notes that need only the date and the sky live here, shared with
//  the widget extension (see `project.yml`); the ones that read the app's
//  weather data are in `TodaySkyNotes.swift`. Parity twin of Android's
//  `SkyNote.kt`.
//

import Foundation

/// A date on the address calendar, as the bins need it: the app's
/// calendar events and the widget's snapshot both carry these.
protocol SkyPickupDate {
    /// "garbage", "recycling", "yard_waste", …
    var kind: String { get }
    /// "home" for days the household set itself.
    var scope: String { get }
    /// YYYY-MM-DD, the home's local date.
    var date: String { get }
}

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
        case air
    }

    let kind: Kind
    /// Replaces "NOW" above the temperature.
    let kicker: String
    /// Said before the reading, e.g. "Full moon tonight."
    let spoken: String
    /// Bins the scene puts at the curb: "garbage", "recycling", "yard_waste".
    var bins: [String] = []

    // MARK: - Pickup day

    private static let pickupKinds = ["garbage", "recycling", "yard_waste"]

    /// The evening before a pickup (from 4 pm) and the pickup morning (until
    /// noon). Only days the household set itself: city defaults are
    /// unconfirmed, the same rule the pickup reminders follow.
    static func bins(now: Date, moment: SkyMoment, pickups: [some SkyPickupDate], calendar: Calendar) -> SkyNote? {
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

    // MARK: - Air

    /// Air at 101 or worse: "🌫️ SMOKY AIR · AQI 168" when smoke leads it.
    static func air(_ air: SkyAir?) -> SkyNote? {
        guard let air, air.aqi >= 101 else { return nil }
        return SkyNote(
            kind: .air,
            kicker: "\(air.smoky ? "🌫️ SMOKY AIR" : "😷 POOR AIR") · AQI \(air.aqi)",
            spoken: "\(air.label), air quality index \(air.aqi)."
        )
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

    // MARK: - Golden hour

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

/// The air reading the sky and its note need: the index, its label, and
/// whether fine particles (in the Northwest, wildfire smoke) lead it.
struct SkyAir: Equatable {
    let aqi: Int
    /// "Unhealthy for sensitive groups".
    let label: String
    let smoky: Bool

    /// How thick the smoke looks: none below 101, up to 0.85 from 301.
    var smoke: Double {
        guard smoky, aqi >= 101 else { return 0 }
        return min(0.85, 0.35 + Double(aqi - 101) / 400)
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
