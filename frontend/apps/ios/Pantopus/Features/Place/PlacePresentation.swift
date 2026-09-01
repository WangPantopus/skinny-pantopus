//
//  PlacePresentation.swift
//  Pantopus
//
//  Place dashboard — contract → presentation. A faithful port of the
//  web `frontend/apps/web/src/components/place/presentation.tsx`:
//  maps PlaceIntelligence section envelopes onto the Phase-2 archetype
//  cards, and derives the "Today's Pulse" hero from the Today sections.
//  Pure + data-driven — a section renders per its own access/status, so
//  the dashboard degrades section-by-section. Keep in lockstep with the
//  web file + the Android `PlacePresentation.kt`.
//

import SwiftUI

// swiftlint:disable cyclomatic_complexity

// MARK: - Section display config (icon / title / layout, per id)

struct PlaceSectionDisplayConfig {
    let icon: PantopusIcon
    let title: String
    var inline: Bool = false
    var sparkline: Bool = false
}

/// One section's derived reading (value / chip / caption / status dot).
struct PlaceSectionReading {
    var value: String?
    var chip: PlaceChipModel?
    var caption: String?
    var statusDot: Color?
}

enum PlacePresentation {
    // ── formatting helpers (port of presentation.tsx) ──────────

    static func money(_ n: Double?) -> String? {
        guard let n, n.isFinite else { return nil }
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        let s = f.string(from: NSNumber(value: Int(n.rounded()))) ?? "\(Int(n.rounded()))"
        return "$\(s)"
    }

    static func grouped(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }

    /// Parse an ISO-8601 timestamp the backend emits.
    private static let isoParsers: [ISO8601DateFormatter] = {
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return [withFractional, plain]
    }()

    static func parseISO(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        for p in isoParsers {
            if let d = p.date(from: iso) { return d }
        }
        return nil
    }

    /// "9:12 AM" — the freshness clock.
    static func fmtTime(_ iso: String?) -> String? {
        guard let d = parseISO(iso) else { return nil }
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f.string(from: d)
    }

    /// "May 2026" — the property as-of stamp.
    static func fmtMonthYear(_ iso: String?) -> String? {
        guard let d = parseISO(iso) else { return nil }
        let f = DateFormatter()
        f.dateFormat = "MMM yyyy"
        return f.string(from: d)
    }

    /// Parses a LOCAL wall-clock datetime with no zone or seconds
    /// ("2026-06-12T05:19") — the shape sunrise/sunset arrive in.
    private static let localDateTimeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd'T'HH:mm"
        f.timeZone = .current
        return f
    }()

    /// "6:42a" — the compact sun clock. Sunrise/sunset are local
    /// wall-clock times with no zone (unlike the `as_of` instants), so
    /// parse them directly; fall back to the ISO instant parser.
    static func fmtSunClock(_ iso: String) -> String {
        let date = localDateTimeFormatter.date(from: String(iso.prefix(16))) ?? parseISO(iso)
        guard let date else { return "" }
        let cal = Calendar.current
        var h = cal.component(.hour, from: date)
        let m = String(format: "%02d", cal.component(.minute, from: date))
        let suffix = h >= 12 ? "p" : "a"
        h = h % 12
        if h == 0 { h = 12 }
        return "\(h):\(m)\(suffix)"
    }

    // ── tone maps ──────────────────────────────────────────────

    static func aqiDot(_ category: AirQualityCategory) -> Color {
        switch category {
        case .good: Theme.Color.home
        case .moderate, .unhealthySensitive: Theme.Color.warning
        case .unhealthy, .veryUnhealthy, .hazardous: Theme.Color.error
        case .unknown: Theme.Color.appTextMuted
        }
    }

    static func floodChip(_ level: FloodRiskLevel, zoneLabel: String) -> PlaceChipModel {
        switch level {
        case .minimal: PlaceChipModel(tone: .success, text: "Minimal risk")
        case .moderate: PlaceChipModel(tone: .warning, text: "Moderate risk")
        case .high: PlaceChipModel(tone: .error, text: "High risk")
        case .unknown: PlaceChipModel(tone: .neutral, text: zoneLabel)
        }
    }

    // ── per-section display config (icon/title/layout) ─────────

    static func config(for id: PlaceSectionID) -> PlaceSectionDisplayConfig {
        switch id {
        case .weather: .init(icon: .cloudSun, title: "Weather", inline: true)
        case .airQuality: .init(icon: .wind, title: "Air quality", inline: true)
        case .alerts: .init(icon: .bell, title: "Alerts", inline: true)
        case .sunriseSunset: .init(icon: .sunrise, title: "Sunrise & sunset", inline: true)
        case .yourHome: .init(icon: .home, title: "Your home", sparkline: true)
        case .flood: .init(icon: .waves, title: "Flood", inline: true)
        case .seismic: .init(icon: .activity, title: "Earthquake", inline: true)
        case .wildfire: .init(icon: .flame, title: "Wildfire", inline: true)
        case .leadRadon: .init(icon: .testTube, title: "Lead & radon")
        case .drinkingWater: .init(icon: .droplets, title: "Water")
        case .environmentalHazards: .init(icon: .factory, title: "Environment")
        case .blockDensity: .init(icon: .users, title: "Verified homes nearby")
        case .censusContext: .init(icon: .home, title: "Homes here")
        case .billBenchmark: .init(icon: .zap, title: "Bill benchmark")
        case .incentives: .init(icon: .badgePercent, title: "Incentives")
        case .rentBand: .init(icon: .building2, title: "Rent band")
        case .civicDistricts: .init(icon: .landmark, title: "Your districts")
        case .civicElection: .init(icon: .vote, title: "Next election", inline: true)
        case .unknown: .init(icon: .mapPin, title: "Place")
        }
    }

    /// The freshness stamp for a section (only weather + your_home show one).
    static func asOf(for env: PlaceSectionEnvelope) -> String? {
        switch env.id {
        case .weather: fmtTime(env.asOf)
        case .yourHome, .censusContext: fmtMonthYear(env.asOf)
        default: nil
        }
    }

    // ── the reading: build value/chip/caption/dot from typed data ─

    // swiftlint:disable:next cyclomatic_complexity function_body_length
    static func reading(for env: PlaceSectionEnvelope) -> PlaceSectionReading {
        switch env.id {
        case .weather:
            guard let d = env.weather else { return .init() }
            let label = d.conditionLabel.isEmpty ? "" : ", \(d.conditionLabel.lowercased())"
            return .init(value: "\(Int(d.currentTempF.rounded()))°\(label)")
        case .airQuality:
            guard let d = env.airQuality else { return .init() }
            return .init(value: "\(d.categoryLabel) (\(d.index))", statusDot: aqiDot(d.category))
        case .alerts:
            guard let d = env.alerts else { return .init() }
            let n = d.active.count
            return n == 0
                ? .init(value: "None", statusDot: Theme.Color.home)
                : .init(value: "\(n) active", statusDot: Theme.Color.error)
        case .sunriseSunset:
            guard let d = env.sunriseSunset else { return .init() }
            return .init(value: "\(fmtSunClock(d.sunrise)) · \(fmtSunClock(d.sunset))")
        case .yourHome:
            guard let d = env.yourHome else { return .init() }
            var parts: [String] = []
            if let y = d.yearBuilt { parts.append("Built \(y)") }
            if let s = d.sqft { parts.append("\(grouped(s)) sqft") }
            if let v = money(d.estimatedValue) { parts.append("est. value \(v)") }
            return .init(value: parts.isEmpty ? "Property details on file" : parts.joined(separator: " · "))
        case .flood:
            guard let d = env.flood else { return .init() }
            return .init(chip: floodChip(d.riskLevel, zoneLabel: d.zoneLabel))
        case .seismic:
            guard let d = env.seismic else { return .init() }
            let cat = d.designCategory.rawValue
            let high = d.designCategory == .d || d.designCategory == .e
            return .init(chip: PlaceChipModel(tone: high ? .warning : .success, text: "Design category \(cat)"))
        case .wildfire:
            guard let d = env.wildfire else { return .init() }
            let high = (d.hazardClass ?? 0) >= 4
            let tone: PlaceChipModel.Tone = high ? .warning : (d.burnable ? .success : .neutral)
            return .init(chip: PlaceChipModel(tone: tone, text: d.hazardLabel))
        case .leadRadon:
            guard let d = env.leadRadon else { return .init() }
            return .init(value: d.summary, caption: d.disclaimer)
        case .drinkingWater:
            guard let d = env.drinkingWater else { return .init() }
            return .init(value: d.summary)
        case .environmentalHazards:
            guard let d = env.environmentalHazards else { return .init() }
            return .init(value: d.summary, caption: d.disclaimer)
        case .blockDensity:
            return .init() // handled specially as DensityCard
        case .censusContext:
            guard let d = env.censusContext else { return .init() }
            let value = !d.summary.isEmpty
                ? d.summary
                : (d.medianYearBuilt.map { "Median built \($0)" } ?? "Area facts")
            return .init(value: value, caption: "Census, area-level — not your home")
        case .billBenchmark:
            guard let d = env.billBenchmark else { return .init() }
            let pct = Int(abs(d.comparisonPct).rounded())
            var chip: PlaceChipModel?
            if d.comparison == .higher {
                chip = PlaceChipModel(tone: .warning, text: "\(pct)% above", icon: .trendingUp)
            } else if d.comparison == .lower {
                chip = PlaceChipModel(tone: .success, text: "\(pct)% below", icon: .trendingDown)
            }
            return .init(value: d.summary, chip: chip)
        case .incentives:
            guard let d = env.incentives else { return .init() }
            return .init(value: d.summary)
        case .rentBand:
            guard let d = env.rentBand else { return .init() }
            let lo = money(d.bandLow) ?? ""
            let hi = money(d.bandHigh) ?? ""
            return .init(value: "\(d.bedrooms)BR market band \(lo)–\(hi)")
        case .civicDistricts:
            guard let d = env.civicDistricts else { return .init() }
            let n = d.districts.count
            return .init(value: n > 0 ? "\(n) voting districts on record" : "Your federal, state, and city districts")
        case .civicElection:
            guard let d = env.civicElection else { return .init() }
            return .init(chip: PlaceChipModel(tone: .sky, text: "In \(d.daysUntil) days"))
        case .unknown:
            return .init()
        }
    }

    // ── envelope status → card state ───────────────────────────

    static func cardState(_ env: PlaceSectionEnvelope) -> PlaceSectionCardState {
        switch env.status {
        case .ready, .partial: .loaded
        case .stale: .stale
        case .error: .error
        case .unavailable: .unavailable
        }
    }

    // ── lock reason / CTA, by band ─────────────────────────────

    static func lockCta(_ band: PlaceBand) -> String {
        switch band {
        case .d: "Verify address"
        case .b, .c: "Claim home"
        case .a: "Create account"
        }
    }

    static func lockReason(_ env: PlaceSectionEnvelope) -> String {
        if let r = env.unavailableReason, !r.isEmpty { return r }
        return env.band == .d ? "Verify your address to see this." : "Claim your place to see this."
    }
}

// MARK: - The Band-D "Locked until you verify" group (T3 → T4)

struct PlaceVerifyLockedItem: Identifiable {
    let icon: PantopusIcon
    let title: String
    let reason: String
    var id: String {
        title
    }
}

extension PlacePresentation {
    /// Trust/identity tools shown locked on the claimed (T3) dashboard,
    /// routing to address verification. Port of VERIFY_LOCKED_SECTIONS.
    static let verifyLockedItems: [PlaceVerifyLockedItem] = [
        .init(
            icon: .messageCircle,
            title: "Neighbor messaging",
            reason: "Verify your address to message neighbors."
        ),
        .init(
            icon: .badgeCheck,
            title: "Verified badge",
            reason: "Verify your address to get your verified badge."
        ),
        .init(
            icon: .mailbox,
            title: "Your mailbox",
            reason: "Verify your address for your mailbox — packages, civic notices, and permits."
        )
    ]
}

// MARK: - Today's Pulse derivation (the hero)

struct PlaceDerivedPulse {
    let variant: PlaceHeroCard.Variant
    let title: String
    let chip: PlaceChipModel
    let heroIcon: PantopusIcon
    let nudgeIcon: PantopusIcon
    let nudgeText: String?
}

extension PlacePresentation {
    private static func findSection(_ intel: PlaceIntelligence, _ id: PlaceSectionID) -> PlaceSectionEnvelope? {
        for g in intel.groups {
            for s in g.sections where s.id == id {
                return s
            }
        }
        return nil
    }

    private static let badAqi: Set<AirQualityCategory> = [
        .unhealthySensitive, .unhealthy, .veryUnhealthy, .hazardous
    ]

    /// Port of `derivePulse` — alert > unhealthy air > all-clear.
    static func derivePulse(_ intel: PlaceIntelligence) -> PlaceDerivedPulse {
        let aqi = findSection(intel, .airQuality)
        let alerts = findSection(intel, .alerts)
        let bill = findSection(intel, .billBenchmark)

        // 1) An active weather alert outranks everything.
        let active = (alerts?.status == .ready ? alerts?.alerts?.active : nil) ?? []
        if let a = active.first {
            return PlaceDerivedPulse(
                variant: .alert,
                title: a.headline.isEmpty ? a.event : a.headline,
                chip: PlaceChipModel(tone: .warning, text: a.event.isEmpty ? "Active alert" : a.event, icon: .triangleAlert),
                heroIcon: .triangleAlert,
                nudgeIcon: .clock,
                nudgeText: a.description.isEmpty ? nil : a.description
            )
        }

        // 2) Then unhealthy air.
        let aqiData = aqi?.status == .ready ? aqi?.airQuality : nil
        if let aqiData, badAqi.contains(aqiData.category) {
            return PlaceDerivedPulse(
                variant: .alert,
                title: "Air quality is \(aqiData.categoryLabel.lowercased()) right now (\(aqiData.index)).",
                chip: PlaceChipModel(tone: .warning, text: "Air quality", icon: .wind),
                heroIcon: .wind,
                nudgeIcon: .clock,
                nudgeText: aqiData.healthMessage.isEmpty ? nil : aqiData.healthMessage
            )
        }

        // 3) All clear — assert only what we actually know.
        let airGood = aqiData != nil && (aqiData?.category == .good || aqiData?.category == .moderate)
        let alertsKnownClear = alerts?.status == .ready && (alerts?.alerts?.active.isEmpty ?? true)
        var clauses: [String] = []
        if airGood { clauses.append("air is good") }
        if alertsKnownClear { clauses.append("there are no active alerts") }
        var tail = ""
        if !clauses.isEmpty {
            let joined = clauses.joined(separator: " and ")
            tail = " " + joined.prefix(1).uppercased() + joined.dropFirst() + "."
        }
        let title = "All clear on your block today.\(tail)"

        let billData = bill?.status == .ready ? bill?.billBenchmark : nil
        let nudge: String? = {
            guard let b = billData, b.comparison == .higher else { return nil }
            return "\(b.summary). Worth a look."
        }()

        return PlaceDerivedPulse(
            variant: .allClear,
            title: title,
            chip: PlaceChipModel(tone: .success, text: "All clear", icon: .check),
            heroIcon: .shieldCheck,
            nudgeIcon: .lightbulb,
            nudgeText: nudge
        )
    }
}
