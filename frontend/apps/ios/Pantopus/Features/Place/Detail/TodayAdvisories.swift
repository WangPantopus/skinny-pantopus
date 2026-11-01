//
//  TodayAdvisories.swift
//  Pantopus
//
//  Today's active advisories at the top (the November 2026 redesign): one
//  short, warm block per alert, most severe and soonest first, two shown and
//  the rest one tap away. Each opens in place to the official text,
//  unedited, with its times and source. Nothing shows here when there is no
//  alert, and an alerts check that couldn't run never reads as clear (Full
//  conditions says so). Every clock is the home's. Parity twin of Android
//  `TodayAdvisories.kt`.
//

import SwiftUI

// MARK: - The home's clock

/// Times on Today and Place, read on the home's clock ("10 AM", "Mon 10 AM").
enum TodayClock {
    /// "10 AM", "10:30 AM" (or the person's 24-hour style).
    static func time(_ date: Date, calendar: Calendar) -> String {
        let minute = calendar.component(.minute, from: date)
        var style = Date.FormatStyle(date: .omitted, time: .omitted, timeZone: calendar.timeZone)
            .hour(.defaultDigits(amPM: .abbreviated))
        if minute != 0 { style = style.minute(.twoDigits) }
        return date.formatted(style)
    }

    /// "Mon".
    static func weekday(_ date: Date, calendar: Calendar) -> String {
        date.formatted(Date.FormatStyle(timeZone: calendar.timeZone).weekday(.abbreviated))
    }

    /// "10 AM" today, "tomorrow 10 AM", else "Mon 10 AM".
    static func dayTime(_ date: Date, now: Date, calendar: Calendar) -> String {
        if calendar.isDate(date, inSameDayAs: now) { return time(date, calendar: calendar) }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) {
            return "tomorrow \(time(date, calendar: calendar))"
        }
        return "\(weekday(date, calendar: calendar)) \(time(date, calendar: calendar))"
    }

    /// The home's calendar: its time zone when known, else the phone's.
    static func calendar(for intel: PlaceIntelligence) -> Calendar {
        var calendar = Calendar.autoupdatingCurrent
        if let name = intel.timeZone, let zone = TimeZone(identifier: name) { calendar.timeZone = zone }
        return calendar
    }
}

// MARK: - Ranking and windows

enum TodayAlerts {
    /// Most severe first, then the one ending soonest; the server's order breaks ties.
    static func ranked(_ alerts: [PlaceWeatherAlert]) -> [PlaceWeatherAlert] {
        let sorted = alerts.enumerated().sorted { lhs, rhs in
            let left = rank(lhs.element.severity)
            let right = rank(rhs.element.severity)
            if left != right { return left > right }
            let leftEnd = PlacePresentation.parseISO(lhs.element.ends) ?? .distantFuture
            let rightEnd = PlacePresentation.parseISO(rhs.element.ends) ?? .distantFuture
            if leftEnd != rightEnd { return leftEnd < rightEnd }
            return lhs.offset < rhs.offset
        }
        return sorted.map(\.element)
    }

    static func rank(_ severity: WeatherAlertSeverity) -> Int {
        switch severity {
        case .warning: 3
        case .watch: 2
        case .advisory: 1
        case .unknown: 0
        }
    }

    /// When the alert starts and ends; a missing start means it is in effect.
    static func interval(_ alert: PlaceWeatherAlert, now: Date) -> (start: Date, end: Date?) {
        let start = PlacePresentation.parseISO(alert.onset) ?? now
        return (start, PlacePresentation.parseISO(alert.ends))
    }

    /// "Until 10 AM", "Through Mon 10 AM", "From 4 AM until 10 AM", "Until further notice".
    static func window(_ alert: PlaceWeatherAlert, now: Date, calendar: Calendar) -> String {
        let onset = PlacePresentation.parseISO(alert.onset)
        let ends = PlacePresentation.parseISO(alert.ends)
        if let onset, onset > now {
            let from = "From \(TodayClock.dayTime(onset, now: now, calendar: calendar))"
            return ends.map { "\(from) until \(TodayClock.dayTime($0, now: now, calendar: calendar))" } ?? from
        }
        guard let ends else { return "Until further notice" }
        if calendar.isDate(ends, inSameDayAs: now) { return "Until \(TodayClock.time(ends, calendar: calendar))" }
        return "Through \(TodayClock.dayTime(ends, now: now, calendar: calendar))"
    }

    /// Whether the alert is in effect at any time in [start, end).
    static func overlaps(_ alert: PlaceWeatherAlert, from start: Date, to end: Date, now: Date) -> Bool {
        let window = interval(alert, now: now)
        return window.start < end && (window.end ?? .distantFuture) > start
    }

    /// Who issued it: the server's `sender_name` ("NWS Portland OR"), else the
    /// office the official headline names ("… by NWS Portland OR"), else the
    /// alerts provider when it is known.
    static func issuer(_ alert: PlaceWeatherAlert, source: String?) -> String? {
        if let sender = alert.senderName?.trimmingCharacters(in: .whitespacesAndNewlines), !sender.isEmpty { return sender }
        if let range = alert.headline.range(of: " by NWS ", options: .backwards) {
            let office = alert.headline[alert.headline.index(range.lowerBound, offsetBy: 4)...]
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !office.isEmpty { return office }
        }
        guard let source, !source.isEmpty, source != "Source unavailable" else { return nil }
        return source
    }

    /// The alert's colors: a warning in red, everything else warm.
    static func tone(_ severity: WeatherAlertSeverity) -> (bg: Color, fg: Color) {
        switch severity {
        case .warning: (Theme.Color.errorBg, Theme.Color.error)
        case .watch, .advisory, .unknown: (Theme.Color.warningBg, Theme.Color.warning)
        }
    }
}

// MARK: - The summary at the top

struct TodayAdvisorySummary: View {
    /// Active alerts, already ranked.
    let alerts: [PlaceWeatherAlert]
    /// The alerts section's provider ("National Weather Service").
    let source: String?
    let calendar: Calendar
    @State private var open: Set<String> = []
    @State private var showsAll = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var shown: [PlaceWeatherAlert] {
        showsAll ? alerts : Array(alerts.prefix(2))
    }

    var body: some View {
        TimelineView(.everyClockMinute) { minute in
            VStack(alignment: .leading, spacing: 8) {
                ForEach(shown) { alert in block(alert, now: minute.date) }
                if alerts.count > 2 {
                    PlaceInlineAction(
                        title: showsAll ? "Show fewer" : "\(alerts.count - 2) more",
                        identifier: "today.advisories.more"
                    ) {
                        withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) { showsAll.toggle() }
                    }
                    .padding(.leading, 2)
                }
            }
        }
        .padding(.top, 4)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("today.advisories")
    }

    private func block(_ alert: PlaceWeatherAlert, now: Date) -> some View {
        let tone = TodayAlerts.tone(alert.severity)
        let isOpen = open.contains(alert.id)
        let window = TodayAlerts.window(alert, now: now, calendar: calendar)
        let line = [window, TodayAlerts.issuer(alert, source: source)].compactMap { $0 }.joined(separator: " · ")
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) {
                    if isOpen { open.remove(alert.id) } else { open.insert(alert.id) }
                }
            } label: {
                HStack(alignment: .top, spacing: 10) {
                    Icon(.triangleAlert, size: 18, strokeWidth: 2, color: tone.fg)
                        .padding(.top, 1)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(alert.event.isEmpty ? "Weather alert" : alert.event)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(line)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(tone.fg)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(isOpen ? .minus : .plus, size: 16, strokeWidth: 2.25, color: tone.fg)
                        .accessibilityHidden(true)
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            .accessibilityHint(isOpen ? "Folds the official text." : "Shows the official text, times and source.")
            .accessibilityIdentifier("today.advisory")
            if isOpen { details(alert, now: now) }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(tone.bg)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    /// The official text as issued, the area, its times and where it came from.
    private func details(_ alert: PlaceWeatherAlert, now: Date) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let area = alert.area?.trimmingCharacters(in: .whitespacesAndNewlines), !area.isEmpty {
                labeled("Area", area)
            }
            ForEach(Self.times(alert, now: now, calendar: calendar), id: \.self) { line in
                Text(line)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            if !alert.headline.isEmpty, alert.headline != alert.event {
                Text(alert.headline)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ForEach(Self.officialText(alert), id: \.self) { paragraph in
                Text(paragraph)
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
            if let raw = alert.detailsUrl, let url = URL(string: raw), url.scheme?.hasPrefix("http") == true {
                Link("Open the official alert", destination: url)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryInk)
                    .frame(minHeight: 44)
            }
            PlaceSourceNote(name: source ?? "Source unavailable", asOf: "live")
                .padding(.top, -6)
        }
        .padding(.top, 8)
        .padding(.leading, 28)
        .padding(.bottom, 4)
    }

    private func labeled(_ label: String, _ value: String) -> some View {
        (Text("\(label): ").fontWeight(.semibold) + Text(value))
            .font(.system(size: 12.5))
            .foregroundStyle(Theme.Color.appTextStrong)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// The provider's full text when the server sends it, else the shortened one; unedited.
    static func officialText(_ alert: PlaceWeatherAlert) -> [String] {
        let full = [alert.originalDescription, alert.originalInstruction]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if !full.isEmpty { return full }
        return alert.description.isEmpty ? [] : [alert.description]
    }

    /// "Issued Sat 10:39 PM", then "Starts …" / "Ends …", from the alert's own times.
    static func times(_ alert: PlaceWeatherAlert, now: Date, calendar: Calendar) -> [String] {
        var lines: [String] = []
        if let sent = PlacePresentation.parseISO(alert.sent) {
            lines.append("Issued \(TodayClock.dayTime(sent, now: now, calendar: calendar))")
        }
        var window: [String] = []
        if let onset = [alert.onset, alert.effective].lazy.compactMap({ PlacePresentation.parseISO($0) }).first {
            window.append("\(onset > now ? "Starts" : "Started") \(TodayClock.dayTime(onset, now: now, calendar: calendar))")
        }
        if let ends = PlacePresentation.parseISO(alert.ends) {
            window.append("Ends \(TodayClock.dayTime(ends, now: now, calendar: calendar))")
        } else if let expires = PlacePresentation.parseISO(alert.expires) {
            window.append("This notice expires \(TodayClock.dayTime(expires, now: now, calendar: calendar))")
        }
        if !window.isEmpty { lines.append(window.joined(separator: " · ")) }
        return lines
    }
}
