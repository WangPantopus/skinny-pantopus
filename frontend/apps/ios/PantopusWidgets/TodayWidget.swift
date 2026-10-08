//
//  TodayWidget.swift
//  PantopusWidgets
//
//  "Today at your address": the Now card's living sky over the house (the
//  same painter as the app, drawn still) with the temperature and the one
//  thing worth knowing, picked at render time from the snapshot the app
//  writes after the Today tab loads (`TodayWidgetSnapshotContract`):
//  a pickup today or tomorrow, unhealthy air, the nearest date, any pickup,
//  the air. Timeline entries every half hour move the sky through the day
//  and turn "tomorrow" into "bins out tonight" at 5 pm. Every tap opens
//  Today (`pantopus://today?src=widget`).
//

import SwiftUI
import WidgetKit

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: TodayWidgetSnapshotContract.widgetKind, provider: TodayProvider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Today at your address")
        .description("The sky over your street, and what's next: pickup day, the air and your dates.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
        .contentMarginsDisabled()
    }
}

// MARK: - Timeline

struct TodayEntry: TimelineEntry {
    let date: Date
    /// nil: nothing fresh to show; the widget asks to open the app.
    let snapshot: TodayWidgetSnapshot?
}

struct TodayProvider: TimelineProvider {
    func placeholder(in _: Context) -> TodayEntry {
        TodayEntry(date: Date(), snapshot: Self.sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        let snapshot = context.isPreview ? Self.sample : TodayWidgetSnapshotContract.load()
        completion(TodayEntry(date: Date(), snapshot: snapshot))
    }

    /// An entry now and on every half hour for twelve hours: the sky moves with
    /// the day, and 5 pm, midnight and noon (when the pickup line changes) are
    /// all on the half hour. A snapshot that goes stale turns into the prompt.
    func getTimeline(in _: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let now = Date()
        let snapshot = TodayWidgetSnapshotContract.load()
        let calendar = Calendar.autoupdatingCurrent
        var parts = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: now)
        parts.minute = (parts.minute ?? 0) / 30 * 30
        let lastHalf = calendar.date(from: parts) ?? now
        let dates = [now] + (1...24).map { lastHalf.addingTimeInterval(Double($0) * 1800) }
        let entries = dates.map { date in
            TodayEntry(date: date, snapshot: snapshot.flatMap { TodayWidgetSnapshotContract.isFresh($0, now: date) ? $0 : nil })
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    static let sample = TodayWidgetSnapshot(
        generatedAt: Date(),
        placeLabel: "Larkspur Loop",
        weather: .init(tempF: 64, condition: "partly_cloudy", label: "Mostly Clear", highF: 71, lowF: 52),
        sun: .init(sunrise: nil, sunset: nil),
        air: .init(aqi: 42, label: "Good", source: "AirNow"),
        dates: []
    )
}

// MARK: - The line

/// The one thing worth knowing, worked out when the entry is drawn (the
/// day words are never stored): a pickup today (until noon) or tomorrow,
/// air at 101 or worse, the nearest other date, any pickup, the air.
struct TodayWidgetLine: Equatable {
    let headline: String
    let caption: String?

    private static let pickupKinds = ["garbage", "recycling", "yard_waste"]

    static func pick(_ snapshot: TodayWidgetSnapshot, at now: Date, calendar: Calendar = .autoupdatingCurrent) -> TodayWidgetLine {
        let today = SkyNote.dayKey(now, calendar: calendar)
        let tomorrow = SkyNote.dayKey(calendar.date(byAdding: .day, value: 1, to: now) ?? now, calendar: calendar)
        let hour = calendar.component(.hour, from: now)
        let upcoming = snapshot.dates.filter { $0.date >= today }.sorted { $0.date < $1.date }
        let pickups = upcoming.filter { pickupKinds.contains($0.kind) }
        let todays = pickups.filter { $0.date == today }
        if hour < 12, !todays.isEmpty {
            return TodayWidgetLine(headline: "\(names(todays)) today", caption: confirmed(todays, "Bins at the curb"))
        }
        let tomorrows = pickups.filter { $0.date == tomorrow }
        if !tomorrows.isEmpty {
            return hour >= 17
                ? TodayWidgetLine(headline: "Bins out tonight", caption: confirmed(tomorrows, "\(names(tomorrows)) tomorrow"))
                : TodayWidgetLine(headline: "\(names(tomorrows)) tomorrow", caption: confirmed(tomorrows, "Bins out tonight"))
        }
        if let air = snapshot.air, air.aqi >= 101 {
            return TodayWidgetLine(headline: "Air: \(air.label)", caption: "AQI \(air.aqi)")
        }
        if let next = upcoming.first(where: { !pickupKinds.contains($0.kind) }) {
            return TodayWidgetLine(headline: next.title, caption: dayWords(next.date, today: today, calendar: calendar))
        }
        if let next = pickups.first {
            let same = pickups.filter { $0.date == next.date }
            return TodayWidgetLine(headline: names(same), caption: dayWords(next.date, today: today, calendar: calendar))
        }
        if let air = snapshot.air {
            return TodayWidgetLine(headline: "Air is \(air.label.lowercased())", caption: "AQI \(air.aqi)")
        }
        return TodayWidgetLine(headline: "All clear on \(snapshot.placeLabel)", caption: nil)
    }

    /// "Recycling and garbage", in calendar order.
    private static func names(_ dates: [TodayWidgetSnapshot.DateItem]) -> String {
        var seen: [String] = []
        for item in dates where !seen.contains(item.kind) {
            seen.append(item.kind)
        }
        let list = ListFormatter.localizedString(byJoining: seen.map { $0 == "yard_waste" ? "yard waste" : $0 })
        return list.prefix(1).uppercased() + list.dropFirst()
    }

    /// City defaults aren't the household's own pickup day yet.
    private static func confirmed(_ dates: [TodayWidgetSnapshot.DateItem], _ caption: String) -> String {
        dates.allSatisfy { $0.scope == "home" } ? caption : "\(caption) · Unconfirmed"
    }

    /// "Tomorrow", "In 4 days · Fri, Oct 23".
    private static func dayWords(_ key: String, today: String, calendar: Calendar) -> String {
        let parser = DateFormatter()
        parser.calendar = calendar
        parser.timeZone = calendar.timeZone
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: String(key.prefix(10))), let start = parser.date(from: today) else { return key }
        let days = calendar.dateComponents([.day], from: start, to: date).day ?? 0
        let when = date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        switch days {
        case 0: return "Today"
        case 1: return "Tomorrow · \(when)"
        default: return "In \(days) days · \(when)"
        }
    }
}

// MARK: - Views

struct TodayWidgetView: View {
    let entry: TodayEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        content
            .widgetURL(URL(string: "pantopus://today?src=widget"))
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryInline:
            Text(inlineText)
                .containerBackground(.clear, for: .widget)
        case .accessoryRectangular:
            rectangular
                .containerBackground(.clear, for: .widget)
        default:
            card
                .containerBackground(for: .widget) { TodayWidgetSky(snapshot: entry.snapshot, date: entry.date) }
        }
    }

    private var line: TodayWidgetLine? {
        entry.snapshot.map { TodayWidgetLine.pick($0, at: entry.date) }
    }

    private var temperature: String? {
        entry.snapshot?.weather.map { "\(Int($0.tempF.rounded()))°" }
    }

    private var inlineText: String {
        guard let line else { return "Open Pantopus for today" }
        return [temperature, line.headline].compactMap { $0 }.joined(separator: " · ")
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            if let line {
                // Three lines in all: the headline may take two, then the caption, else the reading.
                Text(line.headline).font(.headline).widgetAccentable().lineLimit(2).minimumScaleFactor(0.85)
                if let caption = line.caption {
                    Text(caption).font(.caption).lineLimit(1)
                } else if let temperature, let weather = entry.snapshot?.weather {
                    Text("\(temperature) \(weather.label)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
            } else {
                Text("Today at your address").font(.headline).widgetAccentable()
                Text("Open Pantopus to refresh").font(.caption)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The reading over the sky, kept left of the house like the app's card.
    private var card: some View {
        let small = family == .systemSmall
        return VStack(alignment: .leading, spacing: 2) {
            if let line {
                Text(line.headline)
                    .font(.system(size: small ? 14 : 16, weight: .bold))
                    .lineLimit(small ? 3 : 2)
                    .minimumScaleFactor(0.85)
                if let caption = line.caption {
                    Text(caption)
                        .font(.system(size: small ? 11 : 12, weight: .semibold))
                        .opacity(0.88)
                        .lineLimit(small ? 2 : 1)
                }
                Spacer(minLength: 4)
                if let temperature, let weather = entry.snapshot?.weather {
                    HStack(alignment: .firstTextBaseline, spacing: 5) {
                        Text(temperature).font(.system(size: small ? 28 : 34, weight: .light))
                        if !small { Text(weather.label).font(.system(size: 13, weight: .semibold)).lineLimit(1) }
                    }
                }
                if !small, let place = entry.snapshot?.placeLabel {
                    Text(place).font(.system(size: 11, weight: .medium)).opacity(0.8).lineLimit(1)
                }
            } else {
                Text("Today at your address").font(.system(size: 15, weight: .bold))
                Text("Open Pantopus to see today's sky and dates here.")
                    .font(.system(size: 12, weight: .semibold))
                    .opacity(0.88)
                Spacer(minLength: 0)
            }
        }
        .foregroundStyle(SkyPalette.white.color)
        .shadow(color: SkyPalette.black.color(opacity: 0.35), radius: 3, y: 1)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.leading, 14)
        .padding(.top, 13)
        .padding(.bottom, 12)
        // Clear of the house, which stands at 70% of the width.
        .padding(.trailing, small ? 56 : 128)
    }
}

/// The living sky, still: the same painter as the app's Now card.
struct TodayWidgetSky: View {
    let snapshot: TodayWidgetSnapshot?
    let date: Date

    var body: some View {
        Canvas { context, size in
            let calendar = Calendar.autoupdatingCurrent
            let moment = SkyMoment.at(date, sunrise: snapshot?.sun?.sunrise, sunset: snapshot?.sun?.sunset, calendar: calendar)
            let condition = WeatherConditionCode(rawValue: snapshot?.weather?.condition ?? "") ?? .clear
            let bins = snapshot.flatMap { SkyNote.bins(now: date, moment: moment, pickups: $0.dates, calendar: calendar) }
            let painter = TodaySkyPainter(
                condition: condition,
                moment: moment,
                temperature: snapshot?.weather?.tempF ?? 60,
                note: bins,
                season: SkySeason.at(date, calendar: calendar),
                meteorShower: SkyNote.meteors(now: date, moment: moment, calendar: calendar) != nil,
                still: true
            )
            painter.paint(context, size: size, time: 0)
        }
    }
}
