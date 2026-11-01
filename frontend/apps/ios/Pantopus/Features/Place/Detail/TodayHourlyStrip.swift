//
//  TodayHourlyStrip.swift
//  Pantopus
//
//  The hours ahead under the sky (the November 2026 redesign): "Now", then
//  each forecast hour on the home's clock with its sky, its temperature and,
//  when there is a real chance of it, rain or snow. It scrolls sideways to
//  the end of the forecast and leaves the page's vertical scroll alone. An
//  active advisory's hours are marked above the strip with its name.
//  VoiceOver hears one summary. Parity twin of Android `TodayHourlyStrip.kt`.
//

import SwiftUI

struct TodayHourlyStrip: View {
    let weather: PlaceWeatherData
    let sun: PlaceSunriseSunsetData?
    /// Active alerts, ranked; the first two that touch the strip are marked.
    let alerts: [PlaceWeatherAlert]
    let calendar: Calendar
    @ScaledMetric(relativeTo: .body) private var cellWidth: CGFloat = 54

    /// One column of the strip: now, or a forecast hour.
    struct Cell: Identifiable {
        let id: String
        let label: String
        let icon: PantopusIcon
        let tempF: Double
        /// "Rain 40%"-style chance, only from 10%.
        let precip: String?
        let precipChance: Double
        let start: Date
        let end: Date
        let isNow: Bool
    }

    /// An advisory drawn over the hours it covers.
    struct Band: Identifiable {
        let id: String
        let label: String
        let first: Int
        let last: Int
        let severity: WeatherAlertSeverity
    }

    var body: some View {
        TimelineView(.everyClockMinute) { minute in
            let cells = Self.cells(weather, sun: sun, now: minute.date, calendar: calendar)
            if cells.count > 1 {
                strip(cells, bands: Self.bands(alerts, cells: cells, now: minute.date))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(Self.summary(cells, alerts: alerts, now: minute.date, calendar: calendar))
                    .accessibilityIdentifier("todayHourlyStrip")
            }
        }
    }

    private func strip(_ cells: [Cell], bands: [Band]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(bands) { band in bandView(band) }
                // The rain line only when some hour has a real chance of it.
                let showsPrecip = cells.contains { $0.precip != nil }
                HStack(spacing: 0) {
                    ForEach(cells) { cell in cellView(cell, showsPrecip: showsPrecip) }
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 10)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func cellView(_ cell: Cell, showsPrecip: Bool) -> some View {
        VStack(spacing: 5) {
            Text(cell.label)
                .font(.system(size: 12, weight: cell.isNow ? .bold : .medium))
                .foregroundStyle(cell.isNow ? Theme.Color.appText : Theme.Color.appTextSecondary)
            Icon(cell.icon, size: 18, strokeWidth: 2, color: Theme.Color.appTextStrong)
                .frame(height: 20)
            Text("\(Int(cell.tempF.rounded()))°")
                .font(.system(size: 15, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
            if showsPrecip {
                // Keeps every column the same height whether or not it has a chance of rain.
                Text(cell.precip ?? " ")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.info)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .frame(width: cellWidth)
    }

    private func bandView(_ band: Band) -> some View {
        let tone = TodayAlerts.tone(band.severity)
        return Text(band.label)
            .font(.system(size: 11, weight: .semibold))
            .lineLimit(1)
            .truncationMode(.tail)
            .foregroundStyle(tone.fg)
            .padding(.horizontal, 8)
            .frame(width: cellWidth * CGFloat(band.last - band.first + 1) - 4, height: 20, alignment: .leading)
            .background(Capsule().fill(tone.bg))
            .padding(.leading, cellWidth * CGFloat(band.first) + 2)
    }
}

// MARK: - Data

extension TodayHourlyStrip {
    /// Now (the hour that holds this minute, with the current reading), then
    /// every forecast hour after it, to the end of the forecast.
    static func cells(_ weather: PlaceWeatherData, sun: PlaceSunriseSunsetData?, now: Date, calendar: Calendar) -> [Cell] {
        let parsed = weather.hourly.compactMap { hour -> SkyScrubHour? in
            PlacePresentation.parseISO(hour.time).map { SkyScrubHour(date: $0, hour: hour) }
        }
        let sorted = parsed.sorted { $0.date < $1.date }
        let current = sorted.last { $0.date <= now && now < $0.date.addingTimeInterval(3600) }
        let ahead = sorted.filter { $0.date > now }
        let nowChance = current?.hour.precipChance ?? 0
        var cells: [Cell] = [
            Cell(
                id: "now",
                label: "Now",
                icon: icon(weather.conditionCode, night: isNight(now, sun: sun, calendar: calendar)),
                tempF: weather.currentTempF,
                precip: nowChance >= 10 ? "\(Int(nowChance.rounded()))%" : nil,
                precipChance: nowChance,
                start: now,
                end: ahead.first?.date ?? now.addingTimeInterval(3600),
                isNow: true
            )
        ]
        for picked in ahead {
            let hour = picked.hour
            cells.append(Cell(
                id: picked.date.ISO8601Format(),
                label: label(picked.date, calendar: calendar),
                icon: icon(hour.conditionCode, night: isNight(picked.date, sun: sun, calendar: calendar)),
                tempF: hour.tempF,
                precip: hour.precipChance >= 10 ? "\(Int(hour.precipChance.rounded()))%" : nil,
                precipChance: hour.precipChance,
                start: picked.date,
                end: picked.date.addingTimeInterval(3600),
                isNow: false
            ))
        }
        return cells
    }

    /// The first two ranked alerts that fall inside the strip, as column spans.
    static func bands(_ alerts: [PlaceWeatherAlert], cells: [Cell], now: Date) -> [Band] {
        let all = TodayAlerts.ranked(alerts).compactMap { alert -> Band? in
            let covered = cells.indices.filter {
                TodayAlerts.overlaps(alert, from: cells[$0].start, to: cells[$0].end, now: now)
            }
            guard let first = covered.first, let last = covered.last else { return nil }
            return Band(
                id: alert.id,
                label: alert.event.isEmpty ? "Weather alert" : alert.event,
                first: first,
                last: last,
                severity: alert.severity
            )
        }
        return Array(all.prefix(2))
    }

    /// "2 AM"; the first hour of a new day says the day ("Mon").
    static func label(_ date: Date, calendar: Calendar) -> String {
        if calendar.component(.hour, from: date) == 0 { return TodayClock.weekday(date, calendar: calendar) }
        let format = DateFormatter()
        format.locale = .autoupdatingCurrent
        format.calendar = calendar
        format.timeZone = calendar.timeZone
        format.setLocalizedDateFormatFromTemplate("j")
        return format.string(from: date)
    }

    static func isNight(_ date: Date, sun: PlaceSunriseSunsetData?, calendar: Calendar) -> Bool {
        SkyMoment.at(date, sunrise: sun?.sunrise, sunset: sun?.sunset, calendar: calendar).phase == .night
    }

    static func icon(_ code: WeatherConditionCode, night: Bool) -> PantopusIcon {
        switch code {
        case .clear: night ? .moon : .sun
        case .partlyCloudy: night ? .cloudMoon : .cloudSun
        case .cloudy, .unknown: .cloud
        case .fog: .cloudFog
        case .rain: .cloudRain
        case .sleet: .cloudHail
        case .snow: .cloudSnow
        case .thunderstorm: .cloudLightning
        case .wind: .wind
        }
    }

    /// One sentence for VoiceOver: now, the next day's low and high, the
    /// likeliest rain, and the advisories over the strip.
    static func summary(_ cells: [Cell], alerts: [PlaceWeatherAlert], now: Date, calendar: Calendar) -> String {
        guard let current = cells.first else { return "" }
        var parts = ["Hourly forecast. Now \(Int(current.tempF.rounded())) degrees."]
        let day = cells.dropFirst().prefix(24)
        let at = { (cell: Cell) in TodayClock.dayTime(cell.start, now: now, calendar: calendar) }
        if let low = day.min(by: { $0.tempF < $1.tempF }), let high = day.max(by: { $0.tempF < $1.tempF }) {
            parts.append(
                "Next \(day.count) hours: low \(Int(low.tempF.rounded()))° at \(at(low)), "
                    + "high \(Int(high.tempF.rounded()))° at \(at(high))."
            )
        }
        if let wet = day.max(by: { $0.precipChance < $1.precipChance }), wet.precipChance >= 10 {
            parts.append("Highest chance of rain \(Int(wet.precipChance.rounded()))% at \(at(wet)).")
        }
        for alert in TodayAlerts.ranked(alerts) where TodayAlerts.overlaps(
            alert, from: current.start, to: cells.last?.end ?? now, now: now
        ) {
            parts.append("\(alert.event), \(TodayAlerts.window(alert, now: now, calendar: calendar).lowercased()).")
        }
        return parts.joined(separator: " ")
    }
}
