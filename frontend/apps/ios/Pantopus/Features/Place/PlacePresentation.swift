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

// swiftlint:disable cyclomatic_complexity file_length type_body_length

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

    /// "9:12 AM" — the freshness clock, on the place's clock when its zone is
    /// known, so every time on Today and Place reads the same.
    static func fmtTime(_ iso: String?, timeZone: TimeZone? = nil) -> String? {
        guard let d = parseISO(iso) else { return nil }
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        if let timeZone { f.timeZone = timeZone }
        return f.string(from: d)
    }

    /// "May 2026" — the property as-of stamp.
    static func fmtMonthYear(_ iso: String?) -> String? {
        guard let d = parseISO(iso) else { return nil }
        let f = DateFormatter()
        f.dateFormat = "MMM yyyy"
        return f.string(from: d)
    }

    /// "Mar 2023" from a bare calendar month ("2023-03"). NEVER routed
    /// through an instant: midnight-UTC-on-the-1st formatted in a
    /// US-local zone is the previous day — every US timezone rendered
    /// the user's one entered fact as the WRONG month.
    static func fmtYearMonth(_ yearMonth: String?) -> String? {
        guard let raw = yearMonth?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else { return nil }
        let parse = DateFormatter()
        parse.locale = Locale(identifier: "en_US_POSIX")
        parse.timeZone = TimeZone(identifier: "UTC")
        parse.dateFormat = "yyyy-MM"
        guard let date = parse.date(from: raw) else { return nil }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US_POSIX")
        out.timeZone = TimeZone(identifier: "UTC")
        out.dateFormat = "MMM yyyy"
        return out.string(from: date)
    }

    /// A calendar day from "2026-11-03" (or a timestamp's date part), at
    /// noon UTC; format it in UTC. A date-only value is not an instant:
    /// the internet-date-time parsers reject it outright.
    static func parseCalendarDay(_ raw: String?) -> Date? {
        guard let raw = raw?.trimmingCharacters(in: .whitespaces), raw.count >= 10 else { return nil }
        let parse = DateFormatter()
        parse.locale = Locale(identifier: "en_US_POSIX")
        parse.timeZone = TimeZone(identifier: "UTC")
        parse.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return parse.date(from: String(raw.prefix(10)) + "T12:00")
    }

    /// The place's calendar: its own time zone when known, else the phone's.
    static func placeCalendar(_ timeZone: TimeZone?) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone ?? .current
        return calendar
    }

    /// The place's day a sunrise or sunset belongs to ("2026-09-24"): the
    /// wall-clock date as written, or an instant's date at the place.
    private static func sunDayKey(_ iso: String, calendar: Calendar) -> String? {
        guard let tee = iso.firstIndex(of: "T") else { return iso.count == 10 ? iso : nil }
        let clock = iso[iso.index(after: tee)...]
        let zoned = clock.contains("Z") || clock.contains("+") || clock.dropFirst(5).contains("-")
        if zoned, let date = parseISO(iso) { return SkyNote.dayKey(date, calendar: calendar) }
        return String(iso[..<tee])
    }

    /// "today", or "as of Sep 24" when the sun times belong to an earlier day
    /// at the place: the server's `date` when it sends one, else the wall
    /// clock's own date, counted on the place's calendar, not the phone's.
    static func fmtSunDay(_ sun: PlaceSunriseSunsetData, timeZone: TimeZone? = nil, now: Date = Date()) -> String? {
        fmtSunDay(sun.date ?? sun.sunrise, timeZone: timeZone, now: now)
    }

    static func fmtSunDay(_ iso: String, timeZone: TimeZone? = nil, now: Date = Date()) -> String? {
        let calendar = placeCalendar(timeZone)
        guard let key = sunDayKey(iso, calendar: calendar), let day = parseCalendarDay(key) else { return nil }
        if key == SkyNote.dayKey(now, calendar: calendar) { return "today" }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US_POSIX")
        out.timeZone = TimeZone(identifier: "UTC")
        out.dateFormat = "MMM d"
        return "as of \(out.string(from: day))"
    }

    /// "6:42a" — the compact sun clock. Sunrise and sunset arrive as the
    /// place's own wall-clock times with no zone ("2026-06-12T05:19"): the
    /// clock is read off the string, as the Today sun arc reads it
    /// (`SkyMoment.clockMinutes`); an instant is read on the place's clock.
    static func fmtSunClock(_ iso: String, timeZone: TimeZone? = nil) -> String {
        guard let minutes = SkyMoment.clockMinutes(iso, calendar: placeCalendar(timeZone)) else { return "" }
        let whole = Int(minutes)
        var h = whole / 60
        let m = String(format: "%02d", whole % 60)
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

    /// The viewer's Real Rent standing — a band position only. Never a
    /// rank and never a headcount of who pays more, which would be a
    /// count of identifiable households.
    static func realRentStandingChip(_ standing: PlaceRealRentStanding?) -> PlaceChipModel? {
        switch standing {
        case .belowBand: PlaceChipModel(tone: .success, text: "Below the band", icon: .trendingDown)
        case .aboveBand: PlaceChipModel(tone: .warning, text: "Above the band", icon: .trendingUp)
        case .inBand: PlaceChipModel(tone: .neutral, text: "In the band")
        case .unknown, .none: nil
        }
    }

    // ── per-section display config (icon/title/layout) ─────────

    static func config(for id: PlaceSectionID) -> PlaceSectionDisplayConfig {
        switch id {
        case .weather: .init(icon: .cloudSun, title: "Weather", inline: true)
        case .airQuality: .init(icon: .wind, title: "Air quality", inline: true)
        case .alerts: .init(icon: .bell, title: "Alerts", inline: true)
        case .sunriseSunset: .init(icon: .sunrise, title: "Sunrise & sunset", inline: true)
        case .goodDayTo: .init(icon: .listChecks, title: "Good day to\u{2026}", inline: true)
        case .addressCalendar: .init(icon: .calendarDays, title: "At this address", inline: true)
        // No value trend: the section has no value history, so a line here would be invented.
        case .yourHome: .init(icon: .home, title: "Your home")
        case .homeSystems: .init(icon: .wrench, title: "Systems", inline: true)
        case .flood: .init(icon: .waves, title: "Flood", inline: true)
        case .heatCold: .init(icon: .sun, title: "Heat & cold", inline: true)
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
        case .realRent: .init(icon: .handCoins, title: "Real rent on your block")
        case .exemptionCheck: .init(icon: .landmark, title: "Homestead exemption")
        case .civicDistricts: .init(icon: .landmark, title: "Your districts")
        case .civicElection: .init(icon: .vote, title: "Next election", inline: true)
        case .unknown: .init(icon: .mapPin, title: "Place")
        }
    }

    /// The freshness stamp for a section (only weather + your_home show one).
    static func asOf(for env: PlaceSectionEnvelope, timeZone: TimeZone? = nil) -> String? {
        switch env.id {
        case .weather: timeZone.flatMap { fmtTime(env.asOf, timeZone: $0) }
        case .yourHome, .censusContext: fmtMonthYear(env.asOf)
        default: nil
        }
    }

    // ── the reading: build value/chip/caption/dot from typed data ─

    // swiftlint:disable:next cyclomatic_complexity function_body_length
    static func reading(for env: PlaceSectionEnvelope, timeZone: TimeZone? = nil) -> PlaceSectionReading {
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
            let times = "\(fmtSunClock(d.sunriseClock, timeZone: timeZone)) · \(fmtSunClock(d.sunsetClock, timeZone: timeZone))"
            // Times kept from an earlier day say so, as the Today sun card's source line does.
            guard let day = fmtSunDay(d, timeZone: timeZone), day != "today" else { return .init(value: times) }
            return .init(value: "\(times) · \(day)")
        case .goodDayTo:
            guard let d = env.goodDayTo else { return .init() }
            // Lead with what the row says yes to; a row of no's still reads
            // usefully rather than rendering blank.
            let yes = d.tiles.filter { $0.verdict == .yes }
            if yes.isEmpty {
                return .init(value: "Nothing outdoors today", statusDot: Theme.Color.warning)
            }
            return .init(
                value: yes.prefix(2).map { $0.label.lowercased() }.joined(separator: ", "),
                statusDot: Theme.Color.home
            )
        case .addressCalendar:
            guard let d = env.addressCalendar else { return .init() }
            guard let next = d.next else {
                return .init(value: "Nothing in the next two weeks", statusDot: Theme.Color.home)
            }
            let when = next.daysUntil == 0 ? "today" : next.daysUntil == 1 ? "tomorrow" : "in \(next.daysUntil) days"
            return .init(
                value: "\(next.title) \(when)",
                statusDot: next.daysUntil <= 1 ? Theme.Color.warning : Theme.Color.home
            )
        case .homeSystems:
            guard let d = env.homeSystems else { return .init() }
            if d.summary.pastExpectedCount > 0 {
                return .init(
                    value: "\(d.summary.pastExpectedCount) past expected life",
                    statusDot: Theme.Color.error
                )
            }
            if d.summary.agingCount > 0 {
                return .init(value: "\(d.summary.agingCount) aging", statusDot: Theme.Color.warning)
            }
            let unknown = d.systems.filter { $0.status == "unknown" }.count
            if unknown > 0 { return .init(value: "\(unknown) installation years unknown") }
            return .init(value: "All within expected life", statusDot: Theme.Color.home)
        case .heatCold:
            guard let d = env.heatCold else { return .init() }
            switch d.mode {
            case "cold":
                return .init(value: "Freeze expected", statusDot: Theme.Color.error)
            case "heat":
                let label = d.heatDays.first { $0.level == d.peakLevel }?.label ?? "Elevated"
                return .init(
                    value: "\(label) heat risk",
                    statusDot: (d.peakLevel ?? 0) >= 3 ? Theme.Color.error : Theme.Color.warning
                )
            default:
                // `none` is the honest common case, not a missing reading.
                return .init(value: "Nothing expected", statusDot: Theme.Color.home)
            }
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
        case .realRent:
            guard let d = env.realRent else { return .init() }
            // The server sentence is the reading in BOTH states —
            // `building` is a true statement of the block's progress, not
            // an empty state. Amounts only ever ride the ready state.
            guard d.state == .ready else {
                return .init(
                    value: d.summary,
                    chip: PlaceChipModel(tone: .sky, text: "\(d.reports) of \(d.needed)")
                )
            }
            // No chip when ready: this reading is the SECTION's state,
            // never the viewer's own position — that chip is detail-only.
            return .init(value: d.summary)
        case .exemptionCheck:
            guard let d = env.exemptionCheck else { return .init() }
            switch d.filingStatus {
            case .onFile:
                return .init(value: "Exemption on file", chip: PlaceChipModel(tone: .success, text: "On file", icon: .badgeCheck))
            case .noneOnFile:
                return .init(
                    value: "Nothing on file — worth checking",
                    chip: PlaceChipModel(tone: .warning, text: "Not filed", icon: .alertCircle)
                )
            case .unknown:
                return .init(value: "Not reported by this county")
            case .notChecked:
                // No parcel line was read: point at the state's program instead.
                return .init(value: d.stateProgram.label)
            }
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

    /// What a section in error says, and its retry button. A failed or
    /// out-of-date alerts check reads "Alerts unavailable · Retry", never
    /// "no alerts" (Instant Screens contract section 4).
    static func errorWording(for id: PlaceSectionID) -> (title: String, retry: String) {
        id == .alerts ? ("Alerts unavailable", "Retry") : ("Couldn't load this", "Try again")
    }

    static func cardState(_ env: PlaceSectionEnvelope) -> PlaceSectionCardState {
        switch env.status {
        case .ready, .partial: .loaded
        case .stale: .stale
        case .error: .error
        case .unavailable: .unavailable
        }
    }

    // ── lock reason / CTA, by band ─────────────────────────────

    /// Someone who already set the Home up verifies by mail next, so every
    /// lock is that step, never another claim.
    static func lockCta(_ band: PlaceBand, verifiesFirst: Bool = false) -> String {
        if verifiesFirst { return "Verify address" }
        return switch band {
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

// MARK: - Who is looking (the founder's Place rules, 2026-10-08)

/// How the viewer sees the Home's value: the confirmed owner's, waiting on
/// a pending owner, absent for renters and other household members.
enum PlaceValueAccess {
    case shown, pending, hidden
}

/// Mirrors the web and Android handling of `viewer`. Older servers send
/// none, and then nothing is withheld client-side.
extension PlaceIntelligence {
    var valueAccess: PlaceValueAccess {
        guard let viewer else { return .shown }
        if viewer.role == "owner" { return viewer.ownership == "confirmed" ? .shown : .pending }
        return .hidden
    }

    /// Rate watch, deed alerts and the property-tax check are the owner's, like the exemption check.
    var ownerTools: Bool {
        viewer == nil || viewer?.role == "owner"
    }

    /// Set up but not verified (T1): every lock is the verify-by-mail step, never another claim.
    var verifiesFirst: Bool {
        tier == .t1
    }

    /// The server left this detail page's group out for the viewer (a guest's Your home or Money signals).
    func leavesOut(_ detail: PlaceDetailGroup) -> Bool {
        guard viewer != nil, detail == .yourHome || detail == .money else { return false }
        return !groups.contains { detail.groups.contains($0.group) }
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
    /// Launch cut #10 (Mailbox): no mailbox promise while it is off.
    static var verifyLockedItems: [PlaceVerifyLockedItem] {
        allVerifyLockedItems.filter { LaunchFeatures.mailbox || $0.title != "Your mailbox" }
    }

    private static let allVerifyLockedItems: [PlaceVerifyLockedItem] = [
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

        // 3) All clear — assert only what we actually know. Moderate air (AQI 51–100) is said as moderate, never as good.
        let airClause: String? = switch aqiData?.category {
        case .good: "air is good"
        case .moderate: "air quality is moderate"
        default: nil
        }
        let alertsKnownClear = alerts?.status == .ready && (alerts?.alerts?.active.isEmpty ?? true)

        let billData = bill?.status == .ready ? bill?.billBenchmark : nil
        let nudge: String? = {
            guard let b = billData, b.comparison == .higher else { return nil }
            return "\(b.summary). Worth a look."
        }()

        // Alerts that weren't checked are never an all-clear: say what's unknown, in a neutral chip.
        guard alertsKnownClear else {
            let air = airClause.map { $0.prefix(1).uppercased() + $0.dropFirst() + " on your block today. " }
            return PlaceDerivedPulse(
                variant: .allClear,
                title: air.map { $0 + "Weather alerts aren't available right now." }
                    ?? "Air quality and weather alerts aren't available for your block right now.",
                chip: PlaceChipModel(tone: .neutral, text: "Alerts unavailable"),
                heroIcon: .cloudOff,
                nudgeIcon: .lightbulb,
                nudgeText: nudge
            )
        }

        var clauses: [String] = []
        if let airClause { clauses.append(airClause) }
        clauses.append("there are no active alerts")
        let joined = clauses.joined(separator: " and ")
        let title = "All clear on your block today. " + joined.prefix(1).uppercased() + joined.dropFirst() + "."

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
