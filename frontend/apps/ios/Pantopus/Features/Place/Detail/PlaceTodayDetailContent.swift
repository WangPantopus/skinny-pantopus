//
//  PlaceTodayDetailContent.swift
//  Pantopus
//
//  C3 — Today / Environment detail. NowCard (current conditions),
//  AQI card with the scale, active-alerts list, sunrise/sunset, and the
//  "coming soon" daily layers, plus the "Good day to…" verdict row.
//
//  The hourly/daily forecast arrays used to arrive empty (the backend
//  hardcoded them), which is why the strips were omitted here. They are
//  populated now; adding those strips is outstanding parity work.
//

import SwiftUI

// swiftlint:disable multiline_arguments file_length

struct PlaceTodayDetailContent: View {
    let intel: PlaceIntelligence
    let vm: PlaceDetailViewModel

    /// Order (matches Android): what it is like now, what to do with it,
    /// what recurs at this address, then air, alerts and sun. The calendar
    /// is the reason the Today tab exists and sits above the fold.
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

            // Verdicts, not readings. Silent when there is nothing to
            // answer — an empty verdict row is worse than no row.
            if let goodDay = vm.section(.goodDayTo, in: intel),
               let data = goodDay.goodDayTo,
               !data.tiles.isEmpty,
               goodDay.status == .ready || goodDay.status == .stale {
                PlaceDetailSectionLabel(text: "Good day to…")
                GoodDayRow(tiles: data.tiles)
                PlaceSourceNote(
                    name: "Derived from today's conditions",
                    asOf: PlacePresentation.fmtTime(goodDay.asOf)
                )
            }

            // The address calendar (Wedge Phase 2, D6): what recurs at THIS address.
            if let calendar = vm.section(.addressCalendar, in: intel) {
                PlaceDetailSectionLabel(text: "At this address")
                if let data = calendar.addressCalendar,
                   calendar.status == .ready || calendar.status == .stale || calendar.status == .partial {
                    AddressCalendarCard(homeId: vm.homeId, data: data) { await vm.load() }
                    PlaceSourceNote(name: calendar.source ?? "Pantopus registry", asOf: "next two weeks")
                } else {
                    vm.fallbackCard(calendar)
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

/// "Good day to…" — a row of verdicts. Tapping one reveals the numbers
/// behind it: an opinionated tile that won't show its inputs is worse than
/// no tile, because one visibly wrong verdict discredits every other card.
private struct GoodDayRow: View {
    let tiles: [PlaceGoodDayTile]
    @State private var openID: String?

    private var shown: [PlaceGoodDayTile] {
        Array(tiles.prefix(5))
    }

    private var open: PlaceGoodDayTile? {
        shown.first { $0.id == openID }
    }

    private func tint(_ verdict: GoodDayVerdict) -> Color {
        switch verdict {
        case .yes: Theme.Color.home
        case .caution: Theme.Color.warning
        default: Theme.Color.appTextMuted
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(shown, id: \.id) { tile in
                        Button {
                            openID = openID == tile.id ? nil : tile.id
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(tile.glyph).font(.system(size: 19))
                                Text(tile.label)
                                    .font(.system(size: 12.5, weight: .semibold))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                Text(tile.answer)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(tint(tile.verdict))
                            }
                            .frame(width: 108, alignment: .leading)
                            .padding(12)
                            .background(Theme.Color.appSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(tile.label): \(tile.answer)")
                        .accessibilityHint(tile.because)
                    }
                }
            }

            if let open {
                PlaceDetailCard {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(open.label)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Text(open.because)
                            .font(.system(size: 13.5))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                }
            }
        }
    }
}

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

// MARK: - Address calendar card (Wedge Phase 2, D6)

/// The next two weeks at this address, plus the one control that makes it
/// the household's own: the pickup-day picker. Hand-seeded city defaults
/// say "unconfirmed" until the household sets its day.
struct AddressCalendarCard: View {
    let homeId: String
    let data: PlaceAddressCalendarData
    let onChanged: () async -> Void

    @State private var picking = false
    @State private var saving: String?
    @State private var errorText: String?
    private let api = APIClient.shared

    private static let weekdays: [(id: String, label: String)] = [
        ("MO", "Mon"), ("TU", "Tue"), ("WE", "Wed"), ("TH", "Thu"), ("FR", "Fri"), ("SA", "Sat"), ("SU", "Sun")
    ]

    init(homeId: String, data: PlaceAddressCalendarData, onChanged: @escaping () async -> Void) {
        self.homeId = homeId
        self.data = data
        self.onChanged = onChanged
        _picking = State(initialValue: data.needsPickupDay)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("NEXT \(data.windowDays) DAYS AT THIS ADDRESS")
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.7)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer(minLength: 0)
                Button(picking ? "Done" : "Pickup day") { picking.toggle() }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                    .accessibilityIdentifier("addressCalendarPickupToggle")
            }

            if picking {
                picker
            }

            if data.upcoming.isEmpty {
                Text("Nothing on the calendar for the next two weeks.")
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(data.upcoming) { event in
                        eventRow(event)
                        if event.id != data.upcoming.last?.id {
                            Divider().overlay(Theme.Color.appBorder)
                        }
                    }
                }
            }

            if let errorText {
                Text(errorText)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.error)
            }
        }
        .padding(16)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityIdentifier("addressCalendarCard")
    }

    private var picker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(data.needsPickupDay
                ? "Which day do your bins go out? This replaces the city default for your home."
                : "Change your pickup day.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appText)
            HStack(spacing: 6) {
                ForEach(Self.weekdays, id: \.id) { day in
                    Button(saving == day.id ? "…" : day.label) { Task { await choose(day.id) } }
                        .font(.system(size: 13, weight: .semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Theme.Color.appSurface)
                        .foregroundStyle(Theme.Color.appText)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
                        .disabled(saving != nil)
                }
            }
            Text("Recycling is assumed every other week on the same day. You can change this any time.")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(12)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func eventRow(_ event: PlaceCalendarEvent) -> some View {
        let soon = event.daysUntil <= event.leadDays
        return HStack(alignment: .top, spacing: 12) {
            Icon(iconFor(event.kind), size: 18, strokeWidth: 2, color: soon ? Theme.Color.home : Theme.Color.appTextSecondary)
                .frame(width: 32, height: 32)
                .background(soon ? Theme.Color.homeBg : Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline) {
                    Text(event.title)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Text(whenLabel(event))
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(soon ? Theme.Color.home : Theme.Color.appTextSecondary)
                }
                if let detail = event.detail, !detail.isEmpty {
                    Text(detail)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Text(
                    (event.source ?? "Pantopus registry")
                        + (event.confidence == "unverified" ? " · unconfirmed, please double-check" : "")
                )
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(.vertical, 10)
    }

    private func iconFor(_ kind: String) -> PantopusIcon {
        switch kind {
        case "garbage", "recycling", "yard_waste", "bulk_pickup", "street_sweeping": .trash
        case "property_tax", "utility_bill": .receipt
        case "council", "school": .landmark
        case "permit_hearing", "election_deadline": .gavel
        default: .calendarDays
        }
    }

    private func whenLabel(_ event: PlaceCalendarEvent) -> String {
        switch event.daysUntil {
        case 0: return "Today"
        case 1: return "Tomorrow"
        default:
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd"
            guard let d = f.date(from: event.date) else { return event.date }
            let out = DateFormatter()
            out.dateFormat = "EEE, MMM d"
            return out.string(from: d)
        }
    }

    @MainActor
    private func choose(_ weekday: String) async {
        saving = weekday
        errorText = nil
        do {
            _ = try await api.request(
                AddressCalendarEndpoints.setPickupDay(homeId: homeId, request: SetPickupDayRequest(weekday: weekday))
            ) as AddressCalendarResponse
            picking = false
            await onChanged()
        } catch {
            errorText = "Could not save your pickup day. Try again."
        }
        saving = nil
    }
}
