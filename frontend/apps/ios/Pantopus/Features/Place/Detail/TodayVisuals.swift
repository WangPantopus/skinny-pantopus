//
//  TodayVisuals.swift
//  Pantopus
//
//  Smaller pictures for the Today tab: the air-quality gauge, the
//  "Good day to…" verdict tile, the two-week strip of the address
//  calendar and the calm all-clear badge for alerts. Each one shows the
//  numbers the card already had; motion is short and skipped with Reduce
//  Motion. Parity twin of Android's `TodayVisuals.kt`.
//

import SwiftUI

// MARK: - Air-quality gauge

/// A half-dial in the six EPA bands; the current band is lit, the marker
/// swings to the reading when the card appears, the index sits in the middle.
struct TodayAqiGauge: View {
    let index: Int
    let category: AirQualityCategory

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var shown = 0.0

    /// EPA breakpoints; each band gets an equal sixth of the dial.
    private static let breaks: [Double] = [0, 50, 100, 150, 200, 300, 500]

    static func band(_ category: AirQualityCategory, index: Int) -> Int {
        switch category {
        case .good: 0
        case .moderate: 1
        case .unhealthySensitive: 2
        case .unhealthy: 3
        case .veryUnhealthy: 4
        case .hazardous: 5
        case .unknown: min(max(Int(fraction(index) * 6), 0), 5)
        }
    }

    static func fraction(_ index: Int) -> Double {
        let value = min(max(Double(index), 0), 500)
        for band in 0..<6 where value <= breaks[band + 1] {
            return (Double(band) + (value - breaks[band]) / (breaks[band + 1] - breaks[band])) / 6
        }
        return 1
    }

    var body: some View {
        let band = Self.band(category, index: index)
        ZStack {
            ForEach(0..<6, id: \.self) { segment in
                GaugeSegment(segment: segment)
                    // Unlit bands fade back; on the dark card they need more opacity to keep their hue.
                    .stroke(
                        SkyPalette.airQualityBands[segment].color(opacity: segment == band ? 1 : colorScheme == .dark ? 0.5 : 0.3),
                        lineWidth: 10
                    )
            }
            Circle()
                .fill(Theme.Color.appSurface)
                .frame(width: 16, height: 16)
                .overlay(Circle().strokeBorder(SkyPalette.airQualityBands[band].color, lineWidth: 3.5))
                .modifier(GaugePosition(fraction: shown))
            VStack(spacing: -2) {
                Text("\(index)")
                    .font(.system(size: 30, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
                Text("AQI")
                    .font(.system(size: 10.5, weight: .bold))
                    .kerning(0.8)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .frame(maxHeight: .infinity, alignment: .bottom)
        }
        .frame(width: 128, height: 80)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Air quality index \(index)")
        .onAppear { swing(delay: 0.15) }
        .onChange(of: index) { _, _ in swing(delay: 0) }
    }

    private func swing(delay: Double) {
        let target = Self.fraction(index)
        if reduceMotion {
            shown = target
        } else {
            withAnimation(.spring(duration: 1.1, bounce: 0.25).delay(delay)) { shown = target }
        }
    }
}

/// The dial: a half circle whose centre sits on the bottom edge.
private enum GaugeGeometry {
    static func point(_ fraction: Double, in rect: CGRect) -> CGPoint {
        let center = CGPoint(x: rect.midX, y: rect.maxY - 2)
        let radius = min(rect.width / 2, rect.height) - 7
        let theta = Double.pi * (1 + min(max(fraction, 0), 1))
        return CGPoint(x: center.x + radius * cos(theta), y: center.y + radius * sin(theta))
    }
}

private struct GaugeSegment: Shape {
    let segment: Int

    func path(in rect: CGRect) -> Path {
        // A 2 % gap either side keeps the six bands apart.
        let start = (Double(segment) + 0.06) / 6
        let end = (Double(segment) + 0.94) / 6
        var path = Path()
        for step in 0...12 {
            let point = GaugeGeometry.point(start + (end - start) * Double(step) / 12, in: rect)
            if step == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        return path
    }
}

private struct GaugePosition: ViewModifier, Animatable {
    var fraction: Double

    var animatableData: Double {
        get { fraction }
        set { fraction = newValue }
    }

    func body(content: Content) -> some View {
        GeometryReader { proxy in
            content.position(GaugeGeometry.point(fraction, in: CGRect(origin: .zero, size: proxy.size)))
        }
    }
}

// MARK: - "Good day to…" tile

/// One verdict: the activity in a tinted bubble, a verdict mark, the
/// question and the answer in the verdict's colour. Selected shows a ring.
struct TodayGoodDayTile: View {
    let tile: PlaceGoodDayTile
    let open: Bool

    private struct Tone {
        let fg: Color
        let bg: Color
        let mark: PantopusIcon
    }

    private var tone: Tone {
        switch tile.verdict {
        case .yes: Tone(fg: Theme.Color.home, bg: Theme.Color.homeBg, mark: .check)
        case .caution: Tone(fg: Theme.Color.warning, bg: Theme.Color.warningBg, mark: .info)
        case .no: Tone(fg: Theme.Color.appTextMuted, bg: Theme.Color.appSurfaceSunken, mark: .x)
        case .unknown: Tone(fg: Theme.Color.appTextMuted, bg: Theme.Color.appSurfaceSunken, mark: .minus)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .top, spacing: 0) {
                Text(tile.glyph)
                    .font(.system(size: 21))
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(tone.bg))
                Spacer(minLength: 4)
                Icon(tone.mark, size: 11, strokeWidth: 3.2, color: Theme.Color.appSurface)
                    .frame(width: 19, height: 19)
                    .background(Circle().fill(tone.fg))
            }
            Text(tile.label)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text(tile.answer)
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(tone.fg)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(open ? tone.fg : Theme.Color.appBorder, lineWidth: open ? 1.5 : 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

// MARK: - Two-week strip of the address calendar

/// The next two weeks as fourteen day cells with a coloured dot for each
/// kind of date: the rhythm of pickups at a glance. The rows below carry
/// the same dates in words, so the strip is hidden from VoiceOver.
struct TodayCalendarStrip: View {
    let today: String
    let windowDays: Int
    let events: [PlaceCalendarEvent]

    private struct Day: Identifiable {
        let id: String
        let weekday: String
        let number: String
        let weekend: Bool
        let isToday: Bool
        let kinds: [String]
    }

    private static let kindOrder = ["garbage", "recycling", "yard_waste", "bulk_pickup", "street_sweeping"]

    private var days: [Day] {
        let parse = DateFormatter()
        parse.locale = Locale(identifier: "en_US_POSIX")
        parse.timeZone = TimeZone(secondsFromGMT: 0)
        parse.dateFormat = "yyyy-MM-dd"
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        guard let start = parse.date(from: today) else { return [] }
        let initials = ["S", "M", "T", "W", "T", "F", "S"]
        return (0..<min(max(windowDays, 7), 14)).compactMap { offset in
            guard let date = calendar.date(byAdding: .day, value: offset, to: start) else { return nil }
            let key = parse.string(from: date)
            let weekday = calendar.component(.weekday, from: date)
            let kinds = Self.kinds(on: key, in: events)
            return Day(
                id: key,
                weekday: initials[(weekday - 1) % 7],
                number: "\(calendar.component(.day, from: date))",
                weekend: weekday == 1 || weekday == 7,
                isToday: offset == 0,
                kinds: kinds
            )
        }
    }

    private static func kinds(on day: String, in events: [PlaceCalendarEvent]) -> [String] {
        var seen: [String] = []
        for event in events where event.date.hasPrefix(day) {
            let kind = kindOrder.contains(event.kind) ? event.kind : "other"
            if !seen.contains(kind) { seen.append(kind) }
        }
        return seen.sorted { (kindOrder.firstIndex(of: $0) ?? 99) < (kindOrder.firstIndex(of: $1) ?? 99) }
    }

    static func color(_ kind: String) -> Color {
        switch kind {
        case "garbage": Theme.Color.appTextSecondary
        case "recycling": Theme.Color.primaryInk
        case "yard_waste": Theme.Color.home
        case "bulk_pickup", "street_sweeping": Theme.Color.warning
        default: Theme.Color.business
        }
    }

    private static func label(_ kind: String) -> String {
        switch kind {
        case "garbage": "Garbage"
        case "recycling": "Recycling"
        case "yard_waste": "Yard waste"
        case "bulk_pickup": "Bulk pickup"
        case "street_sweeping": "Street sweeping"
        default: "Other dates"
        }
    }

    var body: some View {
        let days = days
        let present = days.flatMap(\.kinds).reduce(into: [String]()) { if !$0.contains($1) { $0.append($1) } }
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 3) {
                ForEach(days) { day in cell(day) }
            }
            if !present.isEmpty {
                HStack(spacing: 12) {
                    ForEach(present, id: \.self) { kind in
                        HStack(spacing: 5) {
                            Circle().fill(Self.color(kind)).frame(width: 7, height: 7)
                            Text(Self.label(kind))
                                .font(.system(size: 11.5, weight: .medium))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                }
            }
        }
        .accessibilityHidden(true)
        .accessibilityIdentifier("addressCalendarStrip")
    }

    private func cell(_ day: Day) -> some View {
        VStack(spacing: 4) {
            Text(day.weekday)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(day.isToday ? Theme.Color.primaryInk : Theme.Color.appTextMuted)
            Text(day.number)
                .font(.system(size: 12.5, weight: day.isToday ? .bold : .semibold))
                .monospacedDigit()
                .foregroundStyle(day.isToday ? Theme.Color.appSurface : Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .frame(height: 26)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(day.isToday ? Theme.Color.primaryInk : Theme.Color.appSurfaceSunken.opacity(day.weekend ? 0.55 : 1))
                )
            HStack(spacing: 2) {
                ForEach(day.kinds.prefix(3), id: \.self) { kind in
                    Circle().fill(Self.color(kind)).frame(width: 5, height: 5)
                }
            }
            .frame(height: 5)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Alerts all-clear

/// The green check with three slow, quiet pings when it appears: someone is
/// keeping watch. It then rests, so nothing keeps redrawing.
struct TodayAllClearBadge: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var ping = false

    var body: some View {
        ZStack {
            Circle()
                .stroke(Theme.Color.home.opacity(ping ? 0 : 0.45), lineWidth: 2)
                .scaleEffect(ping ? 1.55 : 1)
            Circle().fill(Theme.Color.homeBg)
            Icon(.check, size: 21, strokeWidth: 2.5, color: Theme.Color.home)
        }
        .frame(width: 44, height: 44)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeOut(duration: 2.4).repeatCount(3, autoreverses: false)) { ping = true }
        }
        .onDisappear { ping = false }
    }
}
