//
//  TodaySkyScrub.swift
//  Pantopus
//
//  Drag through the day: touch and hold the Now card, then slide. The
//  card's width spans the next 24 forecast hours; the sky, the sun or the
//  moon, the weather and the reading follow the hour under the finger, and
//  the card winds back to now on release. VoiceOver adjusts it an hour at a
//  time. Parity twin of Android's `TodaySkyScrub.kt`.
//

import SwiftUI

/// One forecast hour the card can show.
struct SkyScrubHour: Equatable {
    let date: Date
    let hour: PlaceWeatherHour
}

enum SkyScrub {
    /// The forecast hours after this one, at most 24.
    static func hours(_ hourly: [PlaceWeatherHour], after now: Date) -> [SkyScrubHour] {
        let picked = hourly.compactMap { hour -> SkyScrubHour? in
            guard let date = PlacePresentation.parseISO(hour.time), date > now else { return nil }
            return SkyScrubHour(date: date, hour: hour)
        }
        return Array(picked.sorted { $0.date < $1.date }.prefix(24))
    }

    /// The reading for that hour: its temperature and sky, and that day's high and low.
    static func weather(_ data: PlaceWeatherData, at picked: SkyScrubHour, calendar: Calendar = .autoupdatingCurrent) -> PlaceWeatherData {
        let day = data.daily.first { $0.date.hasPrefix(SkyNote.dayKey(picked.date, calendar: calendar)) }
        return PlaceWeatherData(
            currentTempF: picked.hour.tempF,
            conditionCode: picked.hour.conditionCode,
            conditionLabel: label(picked.hour.conditionCode),
            feelsLikeF: nil,
            highF: day?.highF ?? data.highF,
            lowF: day?.lowF ?? data.lowF,
            hourly: [],
            daily: data.daily
        )
    }

    static func label(_ code: WeatherConditionCode) -> String {
        switch code {
        case .clear: "Clear"
        case .partlyCloudy: "Partly cloudy"
        case .cloudy: "Cloudy"
        case .fog: "Fog"
        case .rain: "Rain"
        case .snow: "Snow"
        case .sleet: "Sleet"
        case .thunderstorm: "Thunderstorms"
        case .wind: "Windy"
        case .unknown: ""
        }
    }

    /// "Rain 40%" when there's a real chance of it, in place of "Feels like".
    static func precipChip(_ picked: SkyScrubHour) -> String? {
        guard picked.hour.precipChance >= 10 else { return nil }
        let kind = picked.hour.conditionCode == .snow || picked.hour.conditionCode == .sleet ? "Snow" : "Rain"
        return "\(kind) \(Int(picked.hour.precipChance.rounded()))%"
    }

    /// "3 PM", or "TOMORROW 6 AM" past midnight: takes the place of "NOW".
    static func kicker(_ picked: SkyScrubHour, now: Date, calendar: Calendar = .autoupdatingCurrent) -> String {
        let time = picked.date.formatted(.dateTime.hour())
        return (calendar.isDate(picked.date, inSameDayAs: now) ? time : "Tomorrow \(time)").uppercased()
    }

    /// "3 PM: 68°, Partly cloudy, 40% chance of rain."
    static func spoken(_ picked: SkyScrubHour, now: Date, calendar: Calendar = .autoupdatingCurrent) -> String {
        let time = picked.date.formatted(.dateTime.hour())
        var parts = ["\(calendar.isDate(picked.date, inSameDayAs: now) ? time : "Tomorrow \(time)"): \(Int(picked.hour.tempF.rounded()))°"]
        let label = label(picked.hour.conditionCode)
        if !label.isEmpty { parts.append(label) }
        if picked.hour.precipChance >= 10 {
            let kind = picked.hour.conditionCode == .snow || picked.hour.conditionCode == .sleet ? "snow" : "rain"
            parts.append("\(Int(picked.hour.precipChance.rounded()))% chance of \(kind)")
        }
        return parts.joined(separator: ", ") + "."
    }
}

/// Touch and hold the sky, then slide: the card's width spans the hours
/// ahead. Release winds back to now, an hour at a time (at once with
/// Reduce Motion).
struct SkyScrubGesture: ViewModifier {
    @Binding var scrub: Int?
    /// How many hours ahead the card can show.
    let hours: Int
    let reduceMotion: Bool

    @State private var width: CGFloat = 1
    @State private var rewind: Task<Void, Never>?
    /// Bumped only by the finger, so the rewind doesn't buzz.
    @State private var tick = 0

    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            .gesture(drag, including: hours > 0 ? .all : .subviews)
            .sensoryFeedback(.selection, trigger: tick)
            .onDisappear {
                rewind?.cancel()
                scrub = nil
            }
    }

    private var drag: some Gesture {
        LongPressGesture(minimumDuration: 0.3)
            .sequenced(before: DragGesture(minimumDistance: 0))
            .onChanged { value in
                guard case let .second(true, drag?) = value else { return }
                rewind?.cancel()
                let index = index(at: drag.location.x)
                if index != scrub {
                    scrub = index
                    tick += 1
                }
            }
            .onEnded { _ in windBack() }
    }

    private func index(at x: CGFloat) -> Int {
        let fraction = min(max((x - 18) / max(width - 36, 1), 0), 1)
        return Int((fraction * CGFloat(hours - 1)).rounded())
    }

    private func windBack() {
        guard let from = scrub else { return }
        guard !reduceMotion else {
            scrub = nil
            return
        }
        rewind = Task { @MainActor in
            var index = from
            let step = max(1, from / 8)
            while index > 0 {
                index = max(0, index - step)
                scrub = index
                try? await Task.sleep(for: .milliseconds(30))
                if Task.isCancelled { return }
            }
            scrub = nil
        }
    }
}

/// While sliding: where the chosen hour sits among the hours ahead.
struct SkyScrubTrack: View {
    let index: Int
    let count: Int

    var body: some View {
        GeometryReader { proxy in
            let span = proxy.size.width - 36
            let y = proxy.size.height - 9
            ZStack(alignment: .topLeading) {
                Capsule()
                    .fill(SkyPalette.white.color(opacity: 0.35))
                    .frame(width: span, height: 3)
                    .position(x: 18 + span / 2, y: y)
                Circle()
                    .fill(SkyPalette.white.color)
                    .frame(width: 10, height: 10)
                    .shadow(color: SkyPalette.black.color(opacity: 0.3), radius: 2)
                    .position(x: 18 + span * CGFloat(index) / CGFloat(max(count - 1, 1)), y: y)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// "Hold and slide to see later": shown the first few times the card
/// appears, and not again once someone has slid through the day.
struct SkyScrubHint: View {
    let hours: Int
    let scrubbing: Bool

    private static let key = "todaySkyScrubHints"
    private static let shows = 3
    @State private var visible = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Color.clear
            if visible, !scrubbing {
                Text("Hold and slide to see later")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(SkyPalette.white.color)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(SkyPalette.scrim.color(opacity: 0.45)))
                    .padding(.leading, 18)
                    .padding(.bottom, 9)
                    .transition(.opacity)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear {
            let seen = UserDefaults.standard.integer(forKey: Self.key)
            guard hours > 0, seen < Self.shows else { return }
            UserDefaults.standard.set(seen + 1, forKey: Self.key)
            visible = true
        }
        .onChange(of: scrubbing) { _, now in
            guard now else { return }
            UserDefaults.standard.set(Self.shows, forKey: Self.key)
            visible = false
        }
    }
}
