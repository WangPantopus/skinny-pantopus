//
//  PlaceTodayDetailContent.swift
//  Pantopus
//
//  C3 — Today / Environment detail. NowCard (current conditions),
//  AQI card with the scale, active-alerts list, sunrise/sunset, and the
//  "coming soon" daily layers. Hourly/forecast arrays arrive empty from
//  the backend, so those strips are omitted (parity with the web).
//

import SwiftUI

// swiftlint:disable multiline_arguments

struct PlaceTodayDetailContent: View {
    let intel: PlaceIntelligence
    let vm: PlaceDetailViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let weather = vm.section(.weather, in: intel) {
                PlaceDetailSectionLabel(text: "Weather")
                if let data = weather.weather, weather.status == .ready || weather.status == .stale {
                    NowCard(data: data)
                    PlaceSourceNote(name: "National Weather Service", asOf: PlacePresentation.fmtTime(weather.asOf))
                } else {
                    vm.fallbackCard(weather)
                }
            }

            if let aqi = vm.section(.airQuality, in: intel) {
                PlaceDetailSectionLabel(text: "Air quality")
                if let data = aqi.airQuality, aqi.status == .ready || aqi.status == .stale {
                    AqiCard(data: data)
                    PlaceSourceNote(name: "AirNow · EPA", asOf: PlacePresentation.fmtTime(aqi.asOf))
                } else {
                    vm.fallbackCard(aqi)
                }
            }

            if let alerts = vm.section(.alerts, in: intel) {
                PlaceDetailSectionLabel(text: "Alerts")
                AlertsCard(active: alerts.alerts?.active ?? [])
                PlaceSourceNote(name: "National Weather Service", asOf: "live")
            }

            if let sun = vm.section(.sunriseSunset, in: intel) {
                PlaceDetailSectionLabel(text: "Sun")
                if let data = sun.sunriseSunset {
                    SunCard(data: data)
                    PlaceSourceNote(name: "Your location", asOf: "today")
                } else {
                    vm.fallbackCard(sun)
                }
            }

            PlaceDetailSectionLabel(text: "Coming soon")
            VStack(spacing: 8) {
                PlaceComingSoonRow(icon: .flower2, title: "Pollen & allergens", subtitle: "Daily pollen count for your area")
                PlaceComingSoonRow(icon: .trash, title: "Trash & recycling", subtitle: "Your pickup schedule")
                PlaceComingSoonRow(icon: .zapOff, title: "Power outages", subtitle: "Live status for your block")
            }
        }
    }
}

// MARK: - Now card

private struct NowCard: View {
    let data: PlaceWeatherData

    var body: some View {
        PlaceDetailCard {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Now")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    HStack(alignment: .top, spacing: 2) {
                        Text("\(Int(data.currentTempF.rounded()))")
                            .font(.system(size: 56, weight: .light))
                            .kerning(-1.6)
                            .foregroundStyle(Theme.Color.appText)
                        Text("°")
                            .font(.system(size: 24, weight: .light))
                            .foregroundStyle(Theme.Color.appText)
                            .padding(.top, 6)
                    }
                    if !data.conditionLabel.isEmpty {
                        Text(data.conditionLabel)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 15, style: .continuous).fill(Theme.Color.warningBg)
                        RoundedRectangle(cornerRadius: 15, style: .continuous).strokeBorder(Theme.Color.warningLight, lineWidth: 1)
                        Icon(weatherGlyph(data.conditionCode), size: 30, strokeWidth: 2, color: weatherTint(data.conditionCode))
                    }
                    .frame(width: 54, height: 54)
                    VStack(alignment: .trailing, spacing: 1) {
                        if let hi = data.highF, let lo = data.lowF {
                            Text("H \(Int(hi.rounded()))° · L \(Int(lo.rounded()))°")
                        }
                        if let feels = data.feelsLikeF {
                            Text("Feels like \(Int(feels.rounded()))°")
                        }
                    }
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
    }
}

// MARK: - AQI card

private struct AqiCard: View {
    let data: PlaceAirQualityData

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .center, spacing: 14) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.homeBg)
                        Icon(.wind, size: 23, strokeWidth: 2, color: Theme.Color.home)
                    }
                    .frame(width: 50, height: 50)
                    VStack(alignment: .leading, spacing: 0) {
                        Text("\(data.index)")
                            .font(.system(size: 34, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(data.categoryLabel)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(categoryColor)
                    }
                    Spacer(minLength: 0)
                }
                // The continuous AQI scale (token-clean green→amber→red).
                GeometryReader { proxy in
                    let frac = min(max(Double(data.index) / 300.0, 0), 1)
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(LinearGradient(
                                colors: [Theme.Color.home, Theme.Color.warning, Theme.Color.error],
                                startPoint: .leading, endPoint: .trailing
                            ))
                            .frame(height: 8)
                        Circle()
                            .fill(Theme.Color.appSurface)
                            .frame(width: 14, height: 14)
                            .overlay(Circle().strokeBorder(categoryColor, lineWidth: 3))
                            .offset(x: proxy.size.width * frac - 7)
                    }
                    .frame(height: 14)
                }
                .frame(height: 14)
                Text(data.healthMessage)
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private var categoryColor: Color {
        switch data.category {
        case .good: Theme.Color.home
        case .moderate, .unhealthySensitive: Theme.Color.warning
        case .unhealthy, .veryUnhealthy, .hazardous: Theme.Color.error
        case .unknown: Theme.Color.appTextSecondary
        }
    }
}

// MARK: - Alerts card

private struct AlertsCard: View {
    let active: [PlaceWeatherAlert]

    var body: some View {
        if active.isEmpty {
            PlaceDetailCard {
                HStack(spacing: 11) {
                    ZStack {
                        Circle().fill(Theme.Color.homeBg)
                        Icon(.check, size: 21, strokeWidth: 2.5, color: Theme.Color.home)
                    }
                    .frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("No active alerts")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Text("Nothing to watch for on your block right now.")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    Spacer(minLength: 0)
                }
            }
        } else {
            VStack(spacing: 8) {
                ForEach(active) { alert in AlertRow(alert: alert) }
            }
        }
    }
}

private struct AlertRow: View {
    let alert: PlaceWeatherAlert

    var body: some View {
        PlaceDetailCard(padding: 15) {
            HStack(alignment: .top, spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 11, style: .continuous).fill(tone.bg)
                    Icon(.triangleAlert, size: 18, strokeWidth: 2, color: tone.fg)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 3) {
                    Text(alert.event)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    if !alert.headline.isEmpty {
                        Text(alert.headline)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(tone.fg)
                    }
                    if !alert.description.isEmpty {
                        Text(alert.description)
                            .font(.system(size: 13))
                            .lineSpacing(2)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var tone: (bg: Color, fg: Color) {
        switch alert.severity {
        case .warning: (Theme.Color.errorBg, Theme.Color.error)
        case .watch, .advisory, .unknown: (Theme.Color.warningBg, Theme.Color.warning)
        }
    }
}

// MARK: - Sun card

private struct SunCard: View {
    let data: PlaceSunriseSunsetData

    var body: some View {
        PlaceDetailCard {
            HStack {
                sunStat(icon: .sunrise, label: "Sunrise", time: PlacePresentation.fmtSunClock(data.sunrise))
                Spacer()
                VStack(spacing: 2) {
                    Text("Daylight")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Text(daylight)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
                Spacer()
                sunStat(icon: .sunset, label: "Sunset", time: PlacePresentation.fmtSunClock(data.sunset))
            }
        }
    }

    private func sunStat(icon: PantopusIcon, label: String, time: String) -> some View {
        VStack(spacing: 4) {
            Icon(icon, size: 22, strokeWidth: 2, color: Theme.Color.warning)
            Text(time.uppercased())
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    private var daylight: String {
        let h = data.daylightMinutes / 60
        let m = data.daylightMinutes % 60
        return "\(h)h \(m)m"
    }
}

// MARK: - Weather glyph mapping

private func weatherGlyph(_ code: WeatherConditionCode) -> PantopusIcon {
    switch code {
    case .clear: .sun
    case .partlyCloudy: .cloudSun
    case .cloudy, .fog: .cloud
    case .rain, .sleet: .cloudRain
    case .snow: .cloudRain
    case .thunderstorm: .cloudRain
    case .wind: .wind
    case .unknown: .cloud
    }
}

private func weatherTint(_ code: WeatherConditionCode) -> Color {
    switch code {
    case .clear: Theme.Color.warning
    case .rain, .sleet, .snow: Theme.Color.primary600
    case .thunderstorm: Theme.Color.warning
    default: Theme.Color.appTextSecondary
    }
}
