//
//  TodayConditions.swift
//  Pantopus
//
//  Today's compact readings (the November 2026 redesign): air quality and
//  daylight side by side under the agenda, each opening its full card in
//  "Sources and full conditions"; "Good day for…" as a list where each
//  verdict carries its window and anything on the screen that limits it;
//  and the daily forecast for the full conditions. Parity twin of Android
//  `TodayConditions.kt`.
//

import SwiftUI

// MARK: - Air and daylight

/// The usual names of the server's pollutant tokens ("pm25" is "PM2.5").
enum TodayAir {
    static func pollutant(_ token: String?) -> String? {
        guard let token = token?.lowercased(), !token.isEmpty else { return nil }
        let names = ["pm25": "PM2.5", "pm10": "PM10", "ozone": "Ozone", "no2": "NO2", "so2": "SO2", "co": "CO"]
        return names[token] ?? token.uppercased()
    }

    /// A model estimate says so; otherwise the reading is a monitor's.
    static func origin(_ env: PlaceSectionEnvelope) -> String {
        env.coverage == .partial ? "model estimate" : "nearby monitor"
    }
}

struct TodayConditionsPair: View {
    let air: PlaceSectionEnvelope?
    let sun: PlaceSectionEnvelope?
    let calendar: Calendar
    /// The place's zone; while it is unknown no clock time is shown.
    let timeZone: TimeZone?
    let onOpenAir: () -> Void
    let onOpenSun: () -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let stacked = typeSize.isAccessibilitySize
        let layout = stacked
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 0))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 0))
        layout {
            if let air { airSide(air) }
            if air != nil, sun != nil {
                if stacked { PlaceRowDivider() } else { Rectangle().fill(Theme.Color.appBorderSubtle).frame(width: 1) }
            }
            if let sun { sunSide(sun) }
        }
        .fixedSize(horizontal: false, vertical: true)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .padding(.top, 24)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("today.conditionsPair")
    }

    private func airSide(_ env: PlaceSectionEnvelope) -> some View {
        let live = env.status == .ready || env.status == .stale
        let data = live ? env.airQuality : nil
        let time = timeZone.flatMap { PlacePresentation.fmtTime(env.asOf, timeZone: $0) }
        return side(title: "Air quality", action: onOpenAir, identifier: "today.pair.air") {
            if let data {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(data.index)")
                        .font(.system(size: 22, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appText)
                    Text(data.categoryLabel)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(PlacePresentation.aqiDot(data.category))
                }
                Text([TodayAir.pollutant(data.dominantPollutant), TodayAir.origin(env)].compactMap { $0 }.joined(separator: " · "))
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let time {
                    Text(env.status == .stale ? "as of \(time)" : time)
                        .font(.system(size: 12))
                        .foregroundStyle(env.status == .stale ? Theme.Color.warning : Theme.Color.appTextMuted)
                }
            } else {
                unavailable(env)
            }
        }
    }

    private func sunSide(_ env: PlaceSectionEnvelope) -> some View {
        side(title: "Daylight", action: onOpenSun, identifier: "today.pair.daylight") {
            if let data = env.sunriseSunset {
                Text("\(data.daylightMinutes / 60)h \(data.daylightMinutes % 60)m")
                    .font(.system(size: 22, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
                Text(Self.sunTimes(data, calendar: calendar))
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let day = PlacePresentation.fmtSunDay(data, timeZone: calendar.timeZone), day != "today" {
                    Text(day)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Color.warning)
                }
            } else {
                unavailable(env)
            }
        }
    }

    /// "Sunrise 6:50 AM · Sunset 4:57 PM", the clock the sun arc reads.
    static func sunTimes(_ data: PlaceSunriseSunsetData, calendar: Calendar) -> String {
        let rise = SkyMoment.clockMinutes(data.sunriseClock, calendar: calendar).map(SkyMoment.clockText)
        let set = SkyMoment.clockMinutes(data.sunsetClock, calendar: calendar).map(SkyMoment.clockText)
        return [rise.map { "Sunrise \($0)" }, set.map { "Sunset \($0)" }].compactMap { $0 }.joined(separator: " · ")
    }

    /// Each side's own words for a reading it doesn't have.
    @ViewBuilder
    private func unavailable(_ env: PlaceSectionEnvelope) -> some View {
        switch env.status {
        case .error:
            Text("Couldn't load")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        default:
            Text(env.access == .locked ? "Locked" : "Not available")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        if let reason = env.unavailableReason, !reason.isEmpty {
            Text(reason)
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func side(
        title: String,
        action: @escaping () -> Void,
        identifier: String,
        @ViewBuilder content: () -> some View
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
                content()
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Shows the full reading.")
        .accessibilityIdentifier(identifier)
    }
}

// MARK: - Good day for…

/// Every verdict as a row: the activity, the answer with its window and,
/// beside a yes or a caution, what on this screen limits it. A tap opens the
/// numbers behind it.
struct TodayGoodDayList: View {
    let tiles: [PlaceGoodDayTile]
    /// "Dense Fog Advisory until 10 AM", "Air quality moderate (83)".
    let limits: [String]
    @State private var openID: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        PlaceGroupSurface {
            ForEach(Array(tiles.enumerated()), id: \.element.id) { index, tile in
                if index > 0 { PlaceRowDivider() }
                row(tile)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("today.goodDay")
    }

    private func row(_ tile: PlaceGoodDayTile) -> some View {
        let isOpen = openID == tile.id
        let limited = tile.verdict == .yes || tile.verdict == .caution ? limits : []
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(reduceMotion ? nil : .snappy(duration: 0.25)) { openID = isOpen ? nil : tile.id }
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    Text(tile.glyph)
                        .font(.system(size: 20))
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(Self.tone(tile.verdict).bg))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(tile.label)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(tile.answer)
                            .font(.system(size: 13.5, weight: .semibold))
                            .foregroundStyle(Self.tone(tile.verdict).fg)
                            .fixedSize(horizontal: false, vertical: true)
                        if !limited.isEmpty {
                            HStack(alignment: .firstTextBaseline, spacing: 5) {
                                Icon(.triangleAlert, size: 11, strokeWidth: 2.25, color: Theme.Color.warning)
                                Text(limited.joined(separator: " · "))
                                    .font(.system(size: 12.5, weight: .medium))
                                    .foregroundStyle(Theme.Color.warning)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(.chevronDown, size: 16, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                        .rotationEffect(.degrees(isOpen ? 180 : 0))
                        .padding(.top, 10)
                        .accessibilityHidden(true)
                }
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityValue(isOpen ? "Expanded" : "Collapsed")
            .accessibilityHint(tile.because)
            if isOpen {
                Text(tile.because)
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.leading, 48)
                    .padding(.bottom, 12)
                    .transition(.opacity)
            }
        }
    }

    static func tone(_ verdict: GoodDayVerdict) -> (fg: Color, bg: Color) {
        switch verdict {
        case .yes: (Theme.Color.home, Theme.Color.homeBg)
        case .caution: (Theme.Color.warning, Theme.Color.warningBg)
        case .no, .unknown: (Theme.Color.appTextMuted, Theme.Color.appSurfaceSunken)
        }
    }
}

// MARK: - Daily forecast

/// The days ahead from the forecast's `daily` rows: day, sky, chance of rain
/// and the low and high.
struct TodayDailyForecast: View {
    let days: [PlaceWeatherDay]
    let today: String

    var body: some View {
        PlaceGroupSurface {
            ForEach(Array(days.enumerated()), id: \.offset) { index, day in
                if index > 0 { PlaceRowDivider() }
                HStack(spacing: 10) {
                    Text(label(day.date))
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .frame(minWidth: 56, alignment: .leading)
                    Icon(TodayHourlyStrip.icon(day.conditionCode, night: false), size: 18, strokeWidth: 2, color: Theme.Color.appTextStrong)
                    Text(day.precipChance >= 10 ? "\(Int(day.precipChance.rounded()))%" : "")
                        .font(.system(size: 12.5, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.info)
                        .frame(minWidth: 36, alignment: .leading)
                    Spacer(minLength: 0)
                    Text("\(Int(day.lowF.rounded()))° – \(Int(day.highF.rounded()))°")
                        .font(.system(size: 14.5, weight: .medium))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appText)
                }
                .padding(.vertical, 11)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(spoken(day))
            }
        }
        .accessibilityIdentifier("today.dailyForecast")
    }

    private func label(_ date: String) -> String {
        let day = String(date.prefix(10))
        if day == today { return "Today" }
        guard let parsed = PlacePresentation.parseCalendarDay(day) else { return day }
        return parsed.formatted(Date.FormatStyle(timeZone: TimeZone(identifier: "UTC") ?? .current).weekday(.abbreviated))
    }

    private func spoken(_ day: PlaceWeatherDay) -> String {
        let rain = day.precipChance >= 10 ? ", \(Int(day.precipChance.rounded()))% chance of rain" : ""
        let range = "low \(Int(day.lowF.rounded()))°, high \(Int(day.highF.rounded()))°"
        return "\(label(day.date)): \(SkyScrub.label(day.conditionCode)), \(range)\(rain)"
    }
}
