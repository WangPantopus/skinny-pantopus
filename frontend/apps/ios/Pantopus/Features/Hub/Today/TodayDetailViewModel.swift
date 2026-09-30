//
//  TodayDetailViewModel.swift
//  Pantopus
//
//  A10.3 / P1-F — Backs `TodayDetailView`, the full-screen Hub "Today"
//  briefing. The production initializer hydrates from `GET /api/hub/today`
//  (route `backend/routes/hub.js:596`) via the provider-orchestrated payload.
//
//  The briefing's data-backed sections — locality kicker, weather hero,
//  AQI chip, advisory ribbon (from `alerts`), the Signals list and Sun & sky
//  (`sunrise_utc` / `sunset_utc`; left out without them) — map directly from
//  the response, and the Share card says what Share sends. Only the "Around
//  the block" title comes from the design placeholder (`TodaySampleData`); the
//  list stays empty. Today always has data, so there is no `.empty` state — the
//  advisory variant (`.alert`) stands in, selected by `content.isAlert`.
//
//  Previews / snapshots / tests still seed deterministic content via
//  `init(content:)` / `init(state:)`, bypassing the network.
//

import Foundation
import Observation

@Observable
@MainActor
final class TodayDetailViewModel {
    enum State: Equatable {
        case loading
        case populated(TodayDetailContent)
        case alert(TodayDetailContent)
        case error(message: String)
    }

    private(set) var state: State = .loading

    /// Header title — "Morning Briefing" / "Evening Briefing" once a stored
    /// delivery (or the deep link's `kind`) resolves; "Today" otherwise.
    /// Mirrors RN `hub-today.tsx`'s `headerTitle`
    /// (`pantopus/frontend/apps/mobile/src/app/hub-today.tsx:89`).
    private(set) var headerTitle: String = "Today"

    private let api: APIClient
    private let now: @Sendable () -> Date
    /// Non-nil for the sample/preview path — `load()` resolves locally.
    private let sampleContent: TodayDetailContent?
    /// When a caller seeds an explicit state, `load()` is a no-op.
    private let seeded: Bool
    /// `DailyBriefingDelivery.id` carried by the push notification.
    private let briefingDeliveryId: String?
    /// `morning` | `evening` from the notification type / metadata. Used as
    /// the title fallback while (or if) the stored briefing can't be read.
    private let requestedKind: String?

    /// Live (production) path.
    ///
    /// `briefingDeliveryId` / `requestedKind` arrive from a
    /// `morning_briefing` / `evening_briefing` / `daily_briefing` push tap.
    /// When a delivery id is present the stored briefing replaces the live
    /// `/api/hub/today` summary + signals, so the user reads the briefing
    /// they were actually notified about.
    init(
        api: APIClient = .shared,
        briefingDeliveryId: String? = nil,
        requestedKind: String? = nil,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.api = api
        self.now = now
        self.briefingDeliveryId = briefingDeliveryId
        self.requestedKind = requestedKind
        sampleContent = nil
        seeded = false
        headerTitle = Self.title(forKind: requestedKind)
    }

    /// Sample/preview path — resolve from deterministic content.
    init(content: TodayDetailContent) {
        api = .shared
        now = { Date() }
        sampleContent = content
        seeded = false
        briefingDeliveryId = nil
        requestedKind = nil
    }

    /// Seed an explicit state — exercises the loading / error chrome in
    /// previews + tests without a network layer.
    init(state: State, content: TodayDetailContent = TodaySampleData.populated) {
        api = .shared
        now = { Date() }
        sampleContent = content
        self.state = state
        seeded = true
        briefingDeliveryId = nil
        requestedKind = nil
    }

    func load() async {
        guard !seeded else { return }
        if let sampleContent {
            state = sampleContent.isAlert ? .alert(sampleContent) : .populated(sampleContent)
            return
        }
        await fetchLive()
    }

    func refresh() async {
        await load()
    }

    // MARK: - Live fetch

    private func fetchLive() async {
        state = .loading
        // Resolve the stored briefing first when the push carried one, so a
        // briefing that outlives the live `/api/hub/today` window still opens.
        let briefing = await fetchBriefing()
        if let kind = briefing?.briefingKind ?? requestedKind {
            headerTitle = Self.title(forKind: kind)
        }
        do {
            // The success body is the payload at the top level (no `today`
            // wrapper); the failure path decodes with `error` set / no data.
            let payload: HubTodayPayload = try await api.request(HubEndpoints.today())
            guard payload.isRenderable || briefing?.summaryText?.isEmpty == false else {
                state = .error(message: "Today's briefing isn't available right now.")
                return
            }
            let content = Self.makeContent(from: payload, briefing: briefing, now: now())
            state = content.isAlert ? .alert(content) : .populated(content)
        } catch {
            // A stored briefing is enough to render on its own — RN falls back
            // the same way (`summaryText = briefing?.summary_text || today?.summary`).
            if let briefing, briefing.summaryText?.isEmpty == false {
                let content = Self.makeContent(from: nil, briefing: briefing, now: now())
                state = .populated(content)
                return
            }
            state = .error(
                message: (error as? APIError)?.errorDescription ?? "Couldn't load today's briefing."
            )
        }
    }

    /// `GET /api/hub/briefings/:id`. A missing / expired delivery degrades to
    /// the live Today payload rather than failing the screen.
    private func fetchBriefing() async -> BriefingDeliveryDTO? {
        guard let briefingDeliveryId, !briefingDeliveryId.isEmpty else { return nil }
        do {
            let response: BriefingDeliveryResponse = try await api.request(
                HubEndpoints.briefingDelivery(id: briefingDeliveryId)
            )
            return response.briefing
        } catch {
            return nil
        }
    }

    static func title(forKind kind: String?) -> String {
        switch kind?.lowercased() {
        case "evening": "Evening Briefing"
        case "morning": "Morning Briefing"
        default: "Today"
        }
    }

    // MARK: - Mapping (pure — unit-test surface)

    /// Project the orchestrated payload into render content. `base` supplies
    /// only the "Around the block" title (the list stays empty).
    ///
    /// When `briefing` is present (a push tap carrying
    /// `metadata.briefing_delivery_id`), its stored `summary_text` and
    /// `signals_snapshot` take precedence over the live Today snapshot —
    /// the same precedence RN applies in `hub-today.tsx:87`.
    static func makeContent(
        from payload: HubTodayPayload?,
        briefing: BriefingDeliveryDTO? = nil,
        now: Date = Date(),
        base: TodayDetailContent = TodaySampleData.populated
    ) -> TodayDetailContent {
        let alerts = payload?.alerts ?? []
        let hasAlert = !alerts.isEmpty
        let storedSignals = briefing?.signalsSnapshot ?? []
        let rawSignals = storedSignals.isEmpty ? (payload?.signals ?? []) : storedSignals
        let signals = rawSignals.map(signal(from:))
        let label = payload?.location?.label ?? "Today"
        let storedSummary = briefing?.summaryText?.isEmpty == false ? briefing?.summaryText : nil
        return TodayDetailContent(
            kicker: hasAlert ? "\(label) · Advisory" : label,
            dateLabel: dateLabel(now, timezone: payload?.location?.timezone),
            temperature: temperature(payload?.weather),
            condition: storedSummary ?? payload?.weather?.conditionLabel ?? payload?.summary ?? "—",
            highLowFeels: highLow(payload?.weather),
            glyph: glyph(for: payload?.weather, hasAlert: hasAlert),
            chips: [aqiChip(payload?.aqi)].compactMap { $0 },
            ribbon: hasAlert ? ribbon(from: alerts[0]) : nil,
            sunSky: sunSky(payload?.weather, timezone: payload?.location?.timezone, now: now),
            signalsTitle: signals.isEmpty ? "Signals" : "Signals · \(signals.count) today",
            signalsAccent: hasAlert ? .error : .personal,
            signals: signals,
            aroundTitle: base.aroundTitle,
            around: [],
            share: TodayShareCard(
                title: "Share today's briefing",
                subtitle: shareSubtitle,
                message: shareMessage(payload, signals: rawSignals)
            )
        )
    }

    // MARK: - Field mappers

    static func temperature(_ weather: HubTodayPayload.TodayWeather?) -> String {
        guard let temp = weather?.currentTempF else { return "—°" }
        return "\(Int(temp.rounded()))°"
    }

    static func highLow(_ weather: HubTodayPayload.TodayWeather?) -> String {
        guard let weather else { return "" }
        var parts: [String] = []
        if let high = weather.highF { parts.append("High \(Int(high.rounded()))°") }
        if let low = weather.lowF { parts.append("Low \(Int(low.rounded()))°") }
        if weather.precipitationNext6h == true { parts.append("Rain likely") }
        return parts.joined(separator: " · ")
    }

    static func aqiChip(_ aqi: HubTodayPayload.TodayAQI?) -> TodayHeroChip? {
        guard let aqi, let index = aqi.index else { return nil }
        return TodayHeroChip(
            icon: .leaf,
            label: "AQI",
            value: "\(index)",
            scale: aqi.category,
            dotTone: aqi.isNoteworthy == true ? .warning : .success
        )
    }

    static func ribbon(from alert: HubTodayPayload.TodayAlert) -> TodayAlertRibbon {
        let body = alert.severity.map { "\($0.capitalized) advisory in effect." }
            ?? "Advisory in effect."
        return TodayAlertRibbon(title: alert.title ?? "Weather advisory", body: body)
    }

    static func signal(from dto: HubTodayPayload.TodaySignalDTO) -> TodaySignal {
        TodaySignal(
            id: dto.kind ?? dto.label ?? UUID().uuidString,
            icon: signalIcon(kind: dto.kind, label: dto.label),
            tone: signalTone(dto.urgency),
            title: dto.label ?? "Update",
            body: dto.detail ?? "",
            timing: "",
            severity: signalSeverity(dto.urgency)
        )
    }

    static func glyph(for weather: HubTodayPayload.TodayWeather?, hasAlert: Bool) -> PantopusIcon {
        let needle = "\(weather?.conditionCode ?? "") \(weather?.conditionLabel ?? "")".lowercased()
        if needle.contains("snow") || needle.contains("freez") || needle.contains("sleet") || needle.contains("ice") {
            return .snowflake
        }
        if needle.contains("rain") || needle.contains("shower") || needle.contains("drizzl") {
            return .cloudRain
        }
        if needle.contains("thunder") || needle.contains("storm") { return .zap }
        if needle.contains("wind") { return .wind }
        if needle.contains("cloud") || needle.contains("fog") || needle.contains("haze") || needle.contains("overcast") {
            return .cloudSun
        }
        if needle.contains("clear") || needle.contains("sun") { return .sun }
        return hasAlert ? .alertTriangle : .cloudSun
    }

    private static func signalIcon(kind: String?, label: String?) -> PantopusIcon {
        let needle = "\(kind ?? "") \(label ?? "")".lowercased()
        if needle.contains("grid") || needle.contains("power") || needle.contains("energy") { return .zap }
        if needle.contains("rain") || needle.contains("precip") || needle.contains("storm") { return .cloudRain }
        if needle.contains("pollen") || needle.contains("allerg") { return .flower }
        if needle.contains("freez") || needle.contains("snow") || needle.contains("cold") { return .snowflake }
        if needle.contains("air") || needle.contains("aqi") || needle.contains("smoke") { return .leaf }
        if needle.contains("transit") || needle.contains("commute") || needle.contains("traffic") { return .bus }
        if needle.contains("heat") || needle.contains("uv") || needle.contains("sun") { return .sunDim }
        if needle.contains("water") || needle.contains("hydrat") { return .droplets }
        return .info
    }

    private static func signalTone(_ urgency: String?) -> TodayTone {
        switch urgency?.lowercased() {
        case "critical", "severe", "extreme": .error
        case "high", "moderate", "warning", "watch": .warning
        case "low", "info": .neutral
        default: .personal
        }
    }

    private static func signalSeverity(_ urgency: String?) -> TodaySignal.Severity? {
        switch urgency?.lowercased() {
        case "critical", "severe", "extreme":
            TodaySignal.Severity(label: "Critical", tone: .error)
        case "high", "warning":
            TodaySignal.Severity(label: "High", tone: .warning)
        case "watch":
            TodaySignal.Severity(label: "Watch", tone: .warning)
        default:
            nil
        }
    }

    // MARK: - Formatting

    static func dateLabel(_ now: Date, timezone: String?) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        if let timezone, let zone = TimeZone(identifier: timezone) {
            formatter.timeZone = zone
        }
        formatter.dateFormat = "EEE · MMM d"
        return formatter.string(from: now)
    }
}

// MARK: - Sun & sky, sharing

extension TodayDetailViewModel {
    /// The Share card's line: what Share sends.
    static let shareSubtitle = "Send today's weather and signals to a neighbor"

    /// "Sun & sky" from today's sunrise and sunset, in the place's timezone. Nil when the
    /// feed has no sun times, so the card is left out rather than showing made-up ones.
    static func sunSky(_ weather: HubTodayPayload.TodayWeather?, timezone: String?, now: Date) -> TodaySunSky? {
        guard let sunrise = parseInstant(weather?.sunriseUtc), let sunset = parseInstant(weather?.sunsetUtc) else { return nil }
        guard sunset > sunrise else { return nil }
        let zone = timezone.flatMap(TimeZone.init(identifier:)) ?? .current
        let clock = DateFormatter()
        clock.locale = Locale(identifier: "en_US_POSIX")
        clock.timeZone = zone
        clock.dateFormat = "h:mm a"
        let daylight = sunset.timeIntervalSince(sunrise)
        let minutes = Int(daylight / 60)
        return TodaySunSky(
            progress: min(1, max(0, now.timeIntervalSince(sunrise) / daylight)),
            sunrise: clock.string(from: sunrise),
            sunset: clock.string(from: sunset),
            phaseLabel: phaseLabel(now: now, sunrise: sunrise, sunset: sunset, zone: zone),
            daylight: "\(minutes / 60)h \(minutes % 60)m of daylight"
        )
    }

    /// Where the day is, by the place's clock: "Before sunrise", "Early morning" … "Evening", "After sunset".
    static func phaseLabel(now: Date, sunrise: Date, sunset: Date, zone: TimeZone) -> String {
        if now < sunrise { return "Before sunrise" }
        if now > sunset { return "After sunset" }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        switch calendar.component(.hour, from: now) {
        case ..<8: return "Early morning"
        case ..<11: return "Mid-morning"
        case ..<14: return "Midday"
        case ..<17: return "Afternoon"
        default: return "Evening"
        }
    }

    /// Signal kinds about the place, which anyone nearby could know. The rest (bill_due, task_due, calendar,
    /// mail, gig, and any kind this client doesn't know) are the viewer's own and never leave in a share.
    static let shareableSignalKinds: Set<String> = [
        "alert",
        "precipitation",
        "aqi",
        "temperature",
        "seasonal",
        "local_update",
        "address_calendar"
    ]

    /// What "Share today's briefing" sends: the weather, a public weather alert and place-level signals, with a
    /// link to Pantopus. Never the place name (a location label can be an address), the summary line or a stored
    /// briefing's text (both are composed from the viewer's own bills, tasks and mail), or a personal signal.
    static func shareMessage(_ payload: HubTodayPayload?, signals: [HubTodayPayload.TodaySignalDTO]) -> String {
        let weather = payload?.weather
        var parts: [String] = []
        let conditions = [weather?.currentTempF.map { _ in temperature(weather) }, weather?.conditionLabel].compactMap { $0 }
        parts.append(conditions.joined(separator: ", "))
        parts.append(highLow(weather))
        parts.append(payload?.alerts?.first.map { ribbon(from: $0).title } ?? "")
        parts.append(signals.filter { shareableSignalKinds.contains($0.kind ?? "") }.compactMap(\.label).joined(separator: " · "))
        let sentences = parts.map { $0.trimmingCharacters(in: CharacterSet(charactersIn: ". ")) }.filter { !$0.isEmpty }
        if sentences.isEmpty { return shareFallback }
        return "Today's briefing: \(sentences.joined(separator: ". ")).\nShared from Pantopus: \(InviteLinks.downloadURLString)"
    }

    /// The share text for the screen's state: the prepared message, or just the link while loading or failed.
    static func shareText(for state: State) -> String {
        switch state {
        case let .populated(content), let .alert(content):
            if content.share.message.isEmpty { shareFallback } else { content.share.message }
        default:
            shareFallback
        }
    }

    private static var shareFallback: String {
        "Today's Pantopus briefing — \(InviteLinks.downloadURLString)"
    }

    private static func parseInstant(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let precise = ISO8601DateFormatter()
        precise.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return precise.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }
}
