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

import Observation
import SwiftUI
import UserNotifications

// swiftlint:disable multiline_arguments file_length

struct PlaceTodayDetailContent: View {
    let intel: PlaceIntelligence
    let vm: PlaceDetailViewModel
    var showHomeRadon = false
    @Environment(RootTabModel.self) private var rootTabs
    @Environment(\.scenePhase) private var scenePhase
    @State private var radonState: RadonTodayState?

    init(intel: PlaceIntelligence, vm: PlaceDetailViewModel, showHomeRadon: Bool = false) {
        self.intel = intel
        self.vm = vm
        self.showHomeRadon = showHomeRadon
    }

    /// Order (matches Android): what it is like now, what to do with it,
    /// what recurs at this address, then air, alerts and sun. The calendar
    /// is the reason the Today tab exists and sits above the fold.
    var body: some View {
        loadedContent
            .onChange(of: rootTabs.selected) { (_: RootTab, tab: RootTab) in resumeRadon(tab == .today) }
            .onChange(of: scenePhase) { (_: ScenePhase, phase: ScenePhase) in resumeRadon(phase == .active && rootTabs.selected == .today) }
            .onChange(of: AppLockManager.shared.isLocked) { (_: Bool, locked: Bool) in resumeRadon(!locked && rootTabs.selected == .today) }
    }

    private var loadedContent: some View {
        todaySections
            .task(id: vm.calendarHomeId) {
                guard showHomeRadon, let homeId = vm.calendarHomeId else { return }
                radonState?.suspend()
                let current = RadonTodayState(homeId: homeId)
                radonState = current
                await current.load()
            }
            .onDisappear { radonState?.suspend() }
    }

    private var todaySections: some View {
        VStack(alignment: .leading, spacing: 0) {
            weatherAndGoodDay
            addressCalendar
            homeRadon
            airAlertsSun
        }
    }

    @ViewBuilder
    private var weatherAndGoodDay: some View {
        if let weather = vm.section(.weather, in: intel) {
            PlaceDetailSectionLabel(text: "Weather")
            if let data = weather.weather, weather.status == .ready || weather.status == .stale {
                NowCard(data: data)
                PlaceSourceNote(name: weather.source ?? "Source unavailable", asOf: PlacePresentation.fmtTime(weather.asOf))
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
    }

    @ViewBuilder
    private var addressCalendar: some View {
        // The address calendar (Wedge Phase 2, D6): what recurs at THIS address.
        if let calendar = vm.section(.addressCalendar, in: intel) {
            PlaceDetailSectionLabel(text: "At this address")
            if let data = calendar.addressCalendar,
               calendar.status == .ready || calendar.status == .stale || calendar.status == .partial {
                AddressCalendarCard(homeId: vm.calendarHomeId, data: data) { await vm.refresh() }
                PlaceSourceNote(name: calendar.source ?? "Pantopus registry", asOf: "next two weeks")
            } else if calendar.status == .unavailable, let data = vm.fallbackCalendar {
                AddressCalendarCard(homeId: vm.calendarHomeId, data: data) { await vm.refresh() }
                PlaceSourceNote(name: "Pantopus registry", asOf: "next two weeks")
            } else {
                vm.fallbackCard(calendar)
                    .task(id: calendar.status) {
                        if calendar.status == .unavailable { await vm.loadFallbackCalendar() }
                    }
            }
        }
    }

    @ViewBuilder
    private var homeRadon: some View {
        if showHomeRadon, let homeId = vm.calendarHomeId, let state = radonState, state.homeId == homeId,
           let data = vm.section(.leadRadon, in: intel)?.leadRadon, let zone = data.radonZone, (1...3).contains(zone) {
            RadonTodayCard(state: state, data: data)
        }
    }

    @ViewBuilder
    private var airAlertsSun: some View {
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
            // "No active alerts" only for a list that was checked; an unavailable section is not an all-clear.
            if let data = alerts.alerts, alerts.status == .ready || alerts.status == .stale {
                AlertsCard(active: data.active)
                PlaceSourceNote(name: alerts.source ?? "Source unavailable", asOf: "live")
            } else {
                vm.fallbackCard(alerts)
            }
        }

        if let sun = vm.section(.sunriseSunset, in: intel) {
            PlaceDetailSectionLabel(text: "Sun")
            if let data = sun.sunriseSunset {
                SunCard(data: data)
                PlaceSourceNote(name: "Your location", asOf: PlacePresentation.fmtSunDay(data.sunrise))
            } else {
                vm.fallbackCard(sun)
            }
        }
    }

    private func resumeRadon(_ active: Bool) {
        radonState?.suspend()
        guard active, showHomeRadon, let homeId = vm.calendarHomeId else { return }
        let current = RadonTodayState(homeId: homeId)
        radonState = current
        Task { await current.load() }
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
    let homeId: String?
    let data: PlaceAddressCalendarData
    let onChanged: () async -> Void

    @State private var picking = false
    @State private var saving: String?
    @State private var errorText: String?
    @State private var weekday = ""
    @State private var frequency = "not_set"
    @State private var nextDate = ""
    @State private var confirmed: PlaceAddressCalendarData?
    @State private var showPickupPrimer = false
    @State private var sessionScope = HomeClaimSessionScope(api: .shared)
    @State private var lifecycleVersion = 0
    /// The schedule this editor started from. A save sends it back, so a
    /// change saved meanwhile on another device is not silently undone.
    @State private var openedVersion: String?
    private let api = APIClient.shared
    private var calendar: PlaceAddressCalendarData {
        confirmed ?? data
    }

    private var pickupDates: [String] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        guard let today = formatter.date(from: calendar.today) else { return [] }
        return (0..<(frequency == "weekly" ? 7 : 14)).map {
            formatter.string(from: today.addingTimeInterval(Double($0) * 86400))
        }
    }

    private static let weekdays: [(id: String, label: String)] = [
        ("MO", "Monday"), ("TU", "Tuesday"), ("WE", "Wednesday"), ("TH", "Thursday"),
        ("FR", "Friday"), ("SA", "Saturday"), ("SU", "Sunday")
    ]

    init(homeId: String?, data: PlaceAddressCalendarData, onChanged: @escaping () async -> Void) {
        self.homeId = homeId
        self.data = data
        self.onChanged = onChanged
        _picking = State(initialValue: homeId != nil && data.needsPickupDay)
        _weekday = State(initialValue: data.pickupSchedule?.weekday ?? "")
        _frequency = State(initialValue: data.pickupSchedule?.recyclingFrequency ?? "not_set")
        _nextDate = State(initialValue: data.pickupSchedule?.recyclingNextDate ?? "")
        _openedVersion = State(initialValue: data.pickupVersion)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("NEXT \(data.windowDays) DAYS AT THIS ADDRESS")
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.7)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer(minLength: 0)
                if homeId != nil {
                    Button(picking ? "Cancel" : "Pickup schedule") {
                        weekday = calendar.pickupSchedule?.weekday ?? ""
                        frequency = calendar.pickupSchedule?.recyclingFrequency ?? "not_set"
                        nextDate = calendar.pickupSchedule?.recyclingNextDate ?? ""
                        openedVersion = calendar.pickupVersion
                        errorText = nil
                        picking.toggle()
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryInk)
                    .accessibilityIdentifier("addressCalendarPickupToggle")
                    .disabled(saving != nil)
                }
            }

            if picking, homeId != nil {
                picker
            }

            if calendar.upcoming.isEmpty {
                Text((homeId != nil ? calendar.pickupSetupMessage : nil) ?? "Nothing on the calendar for the next two weeks.")
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            } else {
                if homeId != nil, let message = calendar.pickupSetupMessage {
                    Text(message)
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                VStack(spacing: 0) {
                    ForEach(calendar.upcoming) { event in
                        eventRow(event)
                        if event.id != calendar.upcoming.last?.id {
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
        .onChange(of: data) { _, _ in confirmed = nil }
        .sheet(isPresented: $showPickupPrimer) {
            if let homeId {
                PickupReminderPrimer(
                    homeId: homeId,
                    api: api,
                    sessionScope: sessionScope,
                    onClose: { showPickupPrimer = false },
                    onSessionChanged: {
                        showPickupPrimer = false
                        errorText = "Your session changed. Reopen Today to continue."
                    }
                )
            }
        }
        .onAppear { lifecycleVersion += 1
            saving = nil
        }
        .onDisappear { lifecycleVersion += 1
            saving = nil
        }
        .onChange(of: AppLockManager.shared.isLocked) { _, _ in lifecycleVersion += 1
            saving = nil
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.protectedDataDidBecomeAvailableNotification)) { _ in
            lifecycleVersion += 1
            saving = nil
        }
    }

    private var picker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Which day is garbage collected each week?")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appText)
            Picker("Garbage collection", selection: $weekday) {
                Text("Choose a day").tag("")
                ForEach(Self.weekdays, id: \.id) { day in Text(day.label).tag(day.id) }
            }
            .font(.system(size: 14))
            .frame(minHeight: 44)
            Text("Recycling")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Picker("Recycling", selection: Binding(get: { frequency }, set: { frequency = $0
                nextDate = ""
            })) {
                Text("Not sure yet").tag("not_set")
                Text("Every week").tag("weekly")
                Text("Every other week").tag("biweekly")
            }
            .font(.system(size: 14))
            .frame(minHeight: 44)
            if frequency != "not_set" {
                Text("Next recycling pickup")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Picker("Next recycling pickup", selection: $nextDate) {
                    Text("Choose a date").tag("")
                    ForEach(pickupDates, id: \.self) { day in Text(pickupDateLabel(day)).tag(day) }
                }
                .font(.system(size: 14))
                .frame(minHeight: 44)
            }
            Text(
                "Use your collection day, not the night you put bins out. Dates follow your home’s calendar. "
                    + "If recycling is unknown, only garbage is saved. Check your provider for holiday changes."
            )
            .font(.system(size: 11.5))
            .foregroundStyle(Theme.Color.appTextSecondary)
            Button("Save schedule") { Task { await choose() } }
                .buttonStyle(.borderedProminent)
                .tint(Theme.Color.primarySolid)
                .controlSize(.large)
                .disabled(weekday.isEmpty || (frequency != "not_set" && !pickupDates.contains(nextDate)))
                .accessibilityIdentifier("addressCalendarSave")
            if calendar.pickupSchedule != nil {
                Button("Clear household schedule") { Task { await choose(reset: true) } }
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("addressCalendarClear")
            }
        }
        .disabled(saving != nil)
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
                if let moved = event.holidayMoveLine {
                    Text(moved)
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
    private func choose(reset: Bool = false) async {
        guard let homeId, saving == nil else { return }
        let version = lifecycleVersion
        saving = "saving"
        defer {
            if lifecycleVersion == version, !AppLockManager.shared.isLocked,
               UIApplication.shared.isProtectedDataAvailable { saving = nil }
        }
        errorText = nil
        let offerPrimer = !reset && (calendar.needsPickupDay || calendar.pickupSchedule == nil)
        do {
            try requirePickupCurrent(version)
            let guardCurrent: @MainActor @Sendable () throws -> Void = { try requirePickupCurrent(version) }
            let endpoint = reset ? AddressCalendarEndpoints.clearPickupDay(
                homeId: homeId, expectedVersion: openedVersion, dispatchGuard: guardCurrent
            )
                : AddressCalendarEndpoints.setPickupDay(homeId: homeId, request: SetPickupDayRequest(
                    weekday: weekday, recyclingFrequency: frequency,
                    recyclingNextDate: frequency == "not_set" ? nil : nextDate,
                    expectedVersion: openedVersion
                ), dispatchGuard: guardCurrent)
            let response: AddressCalendarResponse = try await api.request(endpoint)
            try requirePickupCurrent(version)
            confirmed = response.calendar
            openedVersion = response.calendar.pickupVersion
            picking = false
            let key = "pickupPrimer.shown.\(homeId)"
            if offerPrimer, !response.calendar.needsPickupDay, !UserDefaults.standard.bool(forKey: key) {
                UserDefaults.standard.set(true, forKey: key)
                showPickupPrimer = true
            }
            await onChanged()
        } catch let APIError.clientError(status: 409, message: body) {
            guard (try? requirePickupCurrent(version)) != nil else { return }
            // Changed meanwhile: nothing was saved. Show the current schedule
            // in the editor so the person can review it and try again.
            if let current = Self.currentCalendar(inConflict: body) {
                confirmed = current
                weekday = current.pickupSchedule?.weekday ?? ""
                frequency = current.pickupSchedule?.recyclingFrequency ?? "not_set"
                nextDate = current.pickupSchedule?.recyclingNextDate ?? ""
                openedVersion = current.pickupVersion
            }
            errorText = "The pickup schedule changed since you opened it. Review the current schedule and try again."
        } catch let APIError.forbidden(message) {
            guard (try? requirePickupCurrent(version)) != nil else { return }
            errorText = message ?? "You don't have permission to change this household's pickup schedule."
        } catch {
            guard (try? requirePickupCurrent(version)) != nil else { return }
            errorText = "Could not save your pickup schedule. Check the next collection date and try again."
        }
    }

    @MainActor
    private func requirePickupCurrent(_ version: Int) throws {
        try sessionScope.requireCurrent()
        try Task.checkCancellation()
        guard lifecycleVersion == version, !AppLockManager.shared.isLocked,
              UIApplication.shared.isProtectedDataAvailable else { throw CancellationError() }
    }
}

extension AddressCalendarCard {
    private func pickupDateLabel(_ day: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: day) else { return day }
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate("EEE MMM d")
        return formatter.string(from: date)
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

    /// The current calendar a 409 PICKUP_SCHEDULE_CHANGED reply carries
    /// (`clientError`'s message is the raw body); nil if it has none.
    private static func currentCalendar(inConflict body: String?) -> PlaceAddressCalendarData? {
        struct Conflict: Decodable { let calendar: PlaceAddressCalendarData? }
        guard let data = body?.data(using: .utf8) else { return nil }
        return (try? JSONDecoder().decode(Conflict.self, from: data))?.calendar
    }
}

/// Screen-local primer; the save's account scope also fences preference and permission replies.
private struct PickupReminderPrimer: View {
    let homeId: String
    let api: APIClient
    let sessionScope: HomeClaimSessionScope
    let onClose: () -> Void
    let onSessionChanged: () -> Void
    @State private var primerBusy = false
    @State private var primerError: String?
    @State private var notificationsOff = false
    @State private var primerHeight: CGFloat = 280
    @State private var lifecycleVersion = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Spacer()
                Button("Close") { onClose() }
                    .disabled(primerBusy)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryInk)
            }
            Text("Get a reminder the night before?")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text("One notification the evening before each pickup. Nothing on other days.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let primerError {
                Text(primerError).font(.system(size: 13)).foregroundStyle(Theme.Color.error)
            }
            if notificationsOff {
                Text("Notifications are off for Pantopus. Turn them on in Settings.")
                    .font(.system(size: 14)).foregroundStyle(Theme.Color.appTextSecondary)
                GhostButton(title: "Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) { await UIApplication.shared.open(url) }
                }
            } else {
                GhostButton(title: "Remind me", isLoading: primerBusy, isEnabled: !primerBusy) { await enablePickupReminders() }
            }
            GhostButton(title: "Not now", isEnabled: !primerBusy) { onClose() }
        }
        .padding(20)
        .fixedSize(horizontal: false, vertical: true)
        .background(Theme.Color.appSurface)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { primerHeight = $0 }
        .accessibilityIdentifier("pickupReminderPrimer")
        .presentationDetents([.height(primerHeight)])
        .presentationDragIndicator(.hidden)
        .interactiveDismissDisabled(primerBusy)
        .onAppear { lifecycleVersion += 1
            primerBusy = false
        }
        .onDisappear { lifecycleVersion += 1
            primerBusy = false
        }
        .onChange(of: AppLockManager.shared.isLocked) { _, _ in lifecycleVersion += 1
            primerBusy = false
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.protectedDataDidBecomeAvailableNotification)) { _ in
            lifecycleVersion += 1
            primerBusy = false
        }
    }

    @MainActor
    private func enablePickupReminders() async {
        guard !primerBusy else { return }
        let version = lifecycleVersion
        primerBusy = true
        primerError = nil
        defer {
            if lifecycleVersion == version, !AppLockManager.shared.isLocked,
               UIApplication.shared.isProtectedDataAvailable { primerBusy = false }
        }
        do {
            try requirePrimerCurrent(version)
            let calendarResponse: AddressCalendarResponse = try await api.request(AddressCalendarEndpoints.calendar(homeId: homeId))
            try requirePrimerCurrent(version)
            guard !calendarResponse.calendar.needsPickupDay else {
                primerError = "Confirm your pickup schedule before turning on reminders."
                return
            }
            let timezone = TimeZone.autoupdatingCurrent.identifier
            guard TimeZone.knownTimeZoneIdentifiers.contains(timezone) else {
                primerError = "Couldn't read your time zone. Try again."
                return
            }
            let response: NotificationPreferencesResponseDTO = try await api.request(
                NotificationPreferencesEndpoints.update([
                    "evening_briefing_enabled": .bool(true), "daily_briefing_timezone": .string(timezone)
                ]) { try requirePrimerCurrent(version) }
            )
            try requirePrimerCurrent(version)
            guard response.preferences.eveningBriefingEnabled else {
                primerError = "Couldn't enable pickup reminders. Try again."
                return
            }
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            try requirePrimerCurrent(version)
            let granted: Bool = if settings.authorizationStatus == .notDetermined {
                try await center.requestAuthorization(options: [.alert, .badge, .sound])
            } else {
                [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus)
            }
            try requirePrimerCurrent(version)
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
                onClose()
            } else {
                notificationsOff = true
            }
        } catch {
            guard lifecycleVersion == version, !AppLockManager.shared.isLocked,
                  UIApplication.shared.isProtectedDataAvailable else { return }
            if sessionScope.isCurrent {
                primerError = "Couldn't enable pickup reminders. Try again."
            } else {
                onSessionChanged()
            }
        }
    }

    @MainActor
    private func requirePrimerCurrent(_ version: Int) throws {
        try sessionScope.requireCurrent()
        try Task.checkCancellation()
        guard lifecycleVersion == version, !AppLockManager.shared.isLocked,
              UIApplication.shared.isProtectedDataAvailable else { throw CancellationError() }
    }
}

/// The pilot's single suggestion uses existing Home task authority and receipts.
enum RadonToday {
    static func selected(_ tasks: [HomeTaskDTO]) -> HomeTaskDTO? {
        let sorted = tasks.filter { $0.details?["suggestion"]?.stringValue == "radon_test" }
            .sorted { (date($0.createdAt) ?? .distantPast) > (date($1.createdAt) ?? .distantPast) }
        return sorted.first { ["open", "in_progress"].contains($0.status) } ?? sorted.first { $0.status == "done" }
    }

    static func date(_ value: String?) -> Date? {
        guard let value else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: value) { return date }
        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: value) { return date }
        let day = DateFormatter()
        day.locale = Locale(identifier: "en_US_POSIX")
        day.calendar = Calendar(identifier: .gregorian)
        day.timeZone = .autoupdatingCurrent
        day.dateFormat = "yyyy-MM-dd"
        day.isLenient = false
        guard let date = day.date(from: value), day.string(from: date) == value else { return nil }
        return date
    }

    static func day(_ date: Date) -> String {
        let format = DateFormatter()
        format.locale = Locale(identifier: "en_US_POSIX")
        format.dateFormat = "yyyy-MM-dd"
        return format.string(from: date)
    }

    static func dueAt(_ date: Date, calendar: Calendar = .autoupdatingCurrent) -> String {
        let morning = calendar.date(bySettingHour: 9, minute: 0, second: 0, of: date) ?? date
        let format = ISO8601DateFormatter()
        format.timeZone = calendar.timeZone
        return format.string(from: morning)
    }

    static func label(_ value: String?) -> String? {
        guard let date = date(value) else { return nil }
        let format = DateFormatter()
        format.setLocalizedDateFormatFromTemplate("MMM d")
        return format.string(from: date)
    }

    static func payload(tested: Bool, date: Date, hasDate: Bool, result: String) throws -> CreateHomeTaskRequest {
        var details: [String: JSONValue] = ["suggestion": .string("radon_test")]
        if tested, hasDate { details["tested_on"] = .string(day(date)) }
        if tested, !result.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            guard let value = Double(result), value.isFinite, value >= 0 else { throw APIError.invalidResponse }
            details["result_pci"] = .number(value)
        }
        return CreateHomeTaskRequest(
            taskType: "reminder", title: tested ? "Radon test" : "Test for radon",
            description: tested ? nil :
                "The EPA recommends testing every home. Short-term test kits are sold at hardware stores and online. https://www.epa.gov/radon",
            dueAt: dueAt(tested && !hasDate ? Date() : date), status: tested ? "done" : nil,
            details: details, visibility: "members"
        )
    }

    static func message(_ task: HomeTaskDTO) -> String {
        if task.status != "done" {
            let prefix = (date(task.dueAt).map { $0 < Date() } ?? false) ? "Radon test was due" : "Radon test on your list for"
            return label(task.dueAt).map { "\(prefix) \($0)" } ?? "Radon test on your list"
        }
        let tested = task.details?["tested_on"]?.stringValue
        let prefix = tested != nil || task.title == "Radon test" ? "Radon tested" : "Radon test done"
        let value = prefix == "Radon tested" ? (tested ?? task.dueAt) : task.completedAt
        var text = label(value).map { "\(prefix) \($0)" } ?? prefix
        if prefix == "Radon tested", let result = task.details?["result_pci"]?.numberValue, result.isFinite, result >= 0 {
            text += " · \(result.formatted()) pCi/L"
        }
        return text
    }
}

@Observable
@MainActor
private final class RadonTodayContext {
    var active = true
    let scope = HomeClaimSessionScope(api: .shared)

    func requireCurrent() throws {
        try scope.requireCurrent()
        try Task.checkCancellation()
        guard active, !AppLockManager.shared.isLocked, UIApplication.shared.isProtectedDataAvailable else { throw CancellationError() }
    }
}

@Observable
@MainActor
private final class RadonTodayState {
    let homeId: String
    let context: RadonTodayContext
    let access: HomeTaskAccess
    var task: HomeTaskDTO?
    var canCreate = false
    var loaded = false
    var busy = false
    var error: String?
    var dismissedUntil: Date?
    var coordinator: HomeTaskCreationCoordinator?
    var sheet: String?
    var selectedDate = Date()
    var hasDate = false
    var result = ""
    var retained: CreateHomeTaskRequest?

    init(homeId: String) {
        self.homeId = homeId
        let context = RadonTodayContext()
        self.context = context
        access = HomeTaskAccess(homeId: homeId) { try context.requireCurrent() }
        dismissedUntil = UserDefaults.standard.object(forKey: "radonCard.dismissedUntil.\(homeId)") as? Date
    }

    var hidden: Bool {
        task == nil && (dismissedUntil.map { $0 > Date() } ?? false)
    }

    func suspend() {
        context.active = false
        access.invalidatePending()
        coordinator?.hide()
        busy = false
        sheet = nil
    }

    func load() async {
        let revision = access.lifecycleRevision
        do {
            try context.requireCurrent()
            let response = try await access.list()
            try context.requireCurrent()
            try access.requireCurrent(revision)
            task = RadonToday.selected(response.tasks)
            canCreate = response.collectionCapabilities?.canCreate == true
            loaded = true
            error = nil
        } catch {
            guard (try? context.requireCurrent()) != nil, access.lifecycleRevision == revision, access.isCurrent else { return }
            loaded = false
            canCreate = false
            self.error = "Couldn't check your home's radon tasks. Try again."
        }
    }

    func open(_ kind: String) throws {
        try context.requireCurrent()
        guard loaded, kind == "change" ? task?.capabilities?.canEdit == true : canCreate else { throw HomeTaskAccess.AccessError.denied }
        error = nil
        hasDate = false
        result = ""
        selectedDate = kind == "yes" ? Date() : (Calendar.autoupdatingCurrent.date(byAdding: .day, value: 14, to: Date()) ?? Date())
        retained = nil
        if kind != "change" {
            let creation = HomeTaskCreationCoordinator(
                home: homeId,
                origin: APIClient.shared.apiBaseURL,
                access: access,
                store: PendingHomeTaskCreateStore()
            )
            try creation.restore()
            if let pending = creation.pending {
                guard pending.payload.details?["suggestion"]?.stringValue == "radon_test", pending.payload.visibility == "members" else {
                    throw HomeTaskCreationCoordinator.RecoveryError.changedRequest
                }
                retained = pending.payload
                selectedDate = RadonToday.date(pending.payload.dueAt) ?? Date()
                hasDate = pending.payload.details?["tested_on"]?.stringValue != nil
                result = pending.payload.details?["result_pci"]?.numberValue.map { String($0) } ?? ""
            }
            coordinator = creation
        } else {
            selectedDate = RadonToday.date(task?.dueAt) ?? selectedDate
        }
        sheet = retained.map { $0.status == "done" ? "yes" : "no" } ?? kind
    }

    func save() async {
        guard let sheet, !busy else { return }
        let revision = access.lifecycleRevision
        busy = true
        defer { if access.lifecycleRevision == revision, context.active { busy = false } }
        do {
            try context.requireCurrent()
            if sheet != "yes",
               Calendar.autoupdatingCurrent.startOfDay(for: selectedDate) < Calendar.autoupdatingCurrent.startOfDay(for: Date()),
               retained == nil {
                throw APIError.invalidResponse
            }
            if sheet == "change", let task {
                _ = try await access.edit(taskId: task.id, patch: HomeTaskEditPatch(values: ["due_at": RadonToday.dueAt(selectedDate)]))
            } else {
                guard let coordinator else { throw APIError.invalidResponse }
                _ = try await coordinator.save(retained ?? RadonToday.payload(
                    tested: sheet == "yes",
                    date: selectedDate,
                    hasDate: hasDate,
                    result: result
                ))
            }
            try context.requireCurrent()
            try access.requireCurrent(revision)
            self.sheet = nil
            retained = nil
            await load()
            try context.requireCurrent()
            if sheet != "change" {
                await PilotEvents.shared.send(
                    .suggestionDecision,
                    meta: ["suggestion": "radon_test", "decision": sheet == "yes" ? "already_tested" : "reminder_added"],
                    scope: context.scope
                )
            }
        } catch {
            guard (try? context.requireCurrent()) != nil, access.isCurrent, access.lifecycleRevision == revision else { return }
            retained = coordinator?.pending?.payload
            self.error = retained == nil ? "Couldn't save this task. Check the date and result, then try again."
                : "Couldn't confirm your task. Your saved request is retained; try again."
        }
    }

    func dismiss() async {
        guard (try? context.requireCurrent()) != nil else { return }
        dismissedUntil = Calendar.autoupdatingCurrent.date(byAdding: .day, value: 30, to: Date())
        UserDefaults.standard.set(dismissedUntil, forKey: "radonCard.dismissedUntil.\(homeId)")
        await PilotEvents.shared.send(.suggestionDecision, meta: ["suggestion": "radon_test", "decision": "not_now"], scope: context.scope)
    }
}

private struct RadonTodayCard: View {
    @Bindable var state: RadonTodayState
    let data: PlaceLeadRadonData

    var body: some View {
        if !state.hidden {
            PlaceDetailSectionLabel(text: "Radon")
            PlaceDetailCard {
                VStack(alignment: .leading, spacing: 12) {
                    if !state.loaded {
                        Text("Checking your home's radon tasks…").font(.system(size: 14)).foregroundStyle(Theme.Color.appTextSecondary)
                    } else if let task = state.task {
                        Text(RadonToday.message(task)).font(.system(size: 16, weight: .semibold))
                        if task.status != "done", task.capabilities?.canEdit == true {
                            GhostButton(title: "Change date") { open("change") }
                        }
                    } else {
                        Text("Was radon tested during your inspection or since you moved in?")
                            .font(.system(size: 16, weight: .semibold))
                        Text(
                            "\(data.countyName ?? "Your county") is in the EPA's \(zone) radon zone. "
                                + "The EPA recommends testing every home, whatever the zone."
                        )
                        .font(.system(size: 14)).foregroundStyle(Theme.Color.appTextSecondary)
                        if state.loaded {
                            HStack {
                                GhostButton(title: "Yes", isEnabled: state.canCreate) { open("yes") }
                                GhostButton(title: "No or not sure", isEnabled: state.canCreate) { open("no") }
                            }
                            GhostButton(title: "Not now") { await state.dismiss() }
                        }
                    }
                    if let error = state.error {
                        Text(error).font(.system(size: 13)).foregroundStyle(Theme.Color.error)
                        if !state.loaded { GhostButton(title: "Try again") { await state.load() } }
                    }
                    Link("EPA radon zones", destination: URL(string: "https://www.epa.gov/radon/epa-map-radon-zones-0")!)
                        .font(.system(size: 12)).foregroundStyle(Theme.Color.primaryInk)
                }
            }
            .accessibilityIdentifier("todayRadonCard")
            .sheet(isPresented: Binding(get: { state.sheet != nil }, set: { if !$0 { state.sheet = nil } })) {
                RadonTodaySheet(state: state)
            }
        }
    }

    private var zone: String {
        data.radonZone == 1 ? "highest" : (data.radonZone == 2 ? "moderate" : "lowest")
    }

    private func open(_ kind: String) {
        do { try state.open(kind) } catch {
            guard (try? state.context.requireCurrent()) != nil else { return }
            state.error = "Couldn't open this task action. Reopen Tasks to recover any saved request."
        }
    }
}

private struct RadonTodaySheet: View {
    @Bindable var state: RadonTodayState

    var body: some View {
        FormShell(
            title: state.sheet == "yes" ? "When was it tested?" : "Add a radon test to your list",
            rightActionLabel: state.sheet == "yes" ? "Save" : "Add reminder",
            isValid: state.retained != nil || valid, isDirty: true, isSaving: state.busy,
            onClose: { state.sheet = nil }, onCommit: { Task { await state.save() } },
            content: {
                VStack(alignment: .leading, spacing: 16) {
                    if state.retained != nil {
                        Text("An earlier task request is saved. Save retries that exact request.")
                            .font(.callout)
                    }
                    if state.sheet == "yes" {
                        Toggle("Test date (optional)", isOn: $state.hasDate)
                        if state.hasDate { DatePicker("Test date", selection: $state.selectedDate, displayedComponents: .date) }
                        TextField("Result (pCi/L)", text: $state.result).keyboardType(.decimalPad)
                    } else {
                        DatePicker(
                            "Reminder date",
                            selection: $state.selectedDate,
                            in: Calendar.autoupdatingCurrent.startOfDay(for: Date())...,
                            displayedComponents: .date
                        )
                    }
                    if let error = state.error { Text(error).foregroundStyle(Theme.Color.error) }
                }
                .disabled(state.busy || state.retained != nil)
            }
        )
        .interactiveDismissDisabled(state.busy)
        .presentationDetents([.medium, .large])
    }

    private var valid: Bool {
        if state.sheet == "yes" {
            return state.result.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || Double(state.result)
                .map { $0.isFinite && $0 >= 0 } == true
        }
        return Calendar.autoupdatingCurrent.startOfDay(for: state.selectedDate) >= Calendar.autoupdatingCurrent.startOfDay(for: Date())
    }
}
