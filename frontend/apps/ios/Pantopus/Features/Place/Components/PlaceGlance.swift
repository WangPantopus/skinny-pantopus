//
//  PlaceGlance.swift
//  Pantopus
//
//  "Your home at a glance" (the November 2026 redesign): the server's
//  section groups folded into seven, each with a one-line summary made from
//  real values. Opened, a group shows its sections as lighter rows (each
//  still opening its page, locked rows keeping their reason and step) and
//  "Open <page>". Risk and environment reads as an evidence list: result,
//  area covered, kind of evidence, source and date. Parity twin of Android
//  `PlaceGlance`.
//

import SwiftUI

// MARK: - The seven groups

enum PlaceGlanceGroup: String, CaseIterable, Identifiable {
    case today, home, risk, block, costs, civic, identity

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .today: "Today at this address"
        case .home: "Home and systems"
        case .risk: "Risk and environment"
        case .block: "Your block"
        case .costs: "Home costs"
        case .civic: "Civic"
        case .identity: "Identity and access"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .today: .cloudSun
        case .home: .house
        case .risk: .shield
        case .block: .users
        case .costs: .receipt
        case .civic: .landmark
        case .identity: .idCard
        }
    }

    /// The server groups whose sections live here.
    var serverGroups: [PlaceGroup] {
        switch self {
        case .today: [.today]
        case .home: [.yourHome]
        case .risk: [.riskReadiness, .healthEnvironment]
        case .block: [.yourBlock]
        case .costs: [.moneySignals]
        case .civic: [.civic]
        case .identity: [.identity]
        }
    }

    /// The page "Open …" goes to.
    var page: PlaceDetailGroup {
        switch self {
        case .today: .today
        case .home: .yourHome
        case .risk: .risk
        case .block: .block
        case .costs: .money
        case .civic: .civic
        case .identity: .identity
        }
    }

    /// Where a section of a group this build doesn't know goes: with the others it can open.
    static func of(_ group: PlaceGroup) -> PlaceGlanceGroup {
        allCases.first { $0.serverGroups.contains(group) } ?? .identity
    }
}

// MARK: - Summaries from real values

enum PlaceGlanceSummary {
    static func today(_ sections: [PlaceSectionEnvelope], timeZone: TimeZone?) -> String? {
        var parts: [String] = []
        for env in sections where env.status == .ready || env.status == .stale {
            switch env.id {
            case .weather:
                if let value = PlacePresentation.reading(for: env, timeZone: timeZone).value { parts.append(value) }
            case .airQuality:
                if let air = env.airQuality { parts.append("air \(air.index) \(air.categoryLabel.lowercased())") }
            case .alerts:
                if let active = env.alerts?.active {
                    parts
                        .append(active
                            .isEmpty ? "no active weather alerts" :
                            (active.count == 1 ? "1 weather alert" : "\(active.count) weather alerts"))
                }
            default: break
            }
        }
        if let alerts = sections.first(where: { $0.id == .alerts }), alerts.status == .error || alerts.status == .unavailable {
            parts.append("weather alerts unavailable")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    static func home(_ sections: [PlaceSectionEnvelope]) -> String? {
        var parts: [String] = []
        if let home = sections.first(where: { $0.id == .yourHome })?.yourHome {
            if let year = home.yearBuilt { parts.append("Built \(year)") }
            if let sqft = home.sqft { parts.append("\(PlacePresentation.grouped(sqft)) sq ft") }
        }
        if let systems = sections.first(where: { $0.id == .homeSystems })?.homeSystems {
            let past = systems.summary.pastExpectedCount
            let unknown = systems.systems.filter { $0.installedYear == nil }.count
            if past > 0 {
                parts.append("\(past) beyond typical range")
            } else if unknown > 0 {
                parts.append(unknown == 1 ? "1 install year unknown" : "\(unknown) install years unknown")
            } else {
                parts.append("\(systems.systems.count) systems")
            }
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The first two results and how many more topics: "Flood: minimal risk ·
    /// Earthquake: design category D · 5 more topics".
    static func risk(_ sections: [PlaceSectionEnvelope]) -> String? {
        let parts = sections.compactMap { env -> String? in
            guard env.access != .locked, env.status == .ready || env.status == .stale else { return nil }
            let title = PlacePresentation.config(for: env.id).title
            let reading = PlacePresentation.reading(for: env)
            guard let short = reading.chip?.text ?? reading.value.map(firstClause) else { return nil }
            return "\(title): \(short.prefix(1).lowercased())\(short.dropFirst())"
        }
        guard !parts.isEmpty else { return nil }
        let more = sections.count - min(parts.count, 2)
        let tail = more > 0 ? ["\(more) more topic\(more == 1 ? "" : "s")"] : []
        return (Array(parts.prefix(2)) + tail).joined(separator: " · ")
    }

    /// Each section's value, or "<title> unavailable": "No activity shown yet · homes here unavailable".
    static func block(_ sections: [PlaceSectionEnvelope]) -> String? {
        let parts = sections.map { env -> String in
            let title = PlacePresentation.config(for: env.id).title.lowercased()
            guard env.access != .locked, env.status == .ready || env.status == .stale || env.status == .partial else {
                return env.access == .locked ? "\(title) locked" : "\(title) unavailable"
            }
            if let density = env.blockDensity { return density.label }
            return PlacePresentation.reading(for: env).value.map(firstClause) ?? title
        }
        return parts.isEmpty ? nil : parts.prefix(2).joined(separator: " · ")
    }

    /// "6 voting districts · election Nov 3".
    static func civic(_ sections: [PlaceSectionEnvelope]) -> String? {
        var parts: [String] = []
        if let districts = sections.first(where: { $0.id == .civicDistricts })?.civicDistricts, !districts.districts.isEmpty {
            parts.append("\(districts.districts.count) voting districts")
        }
        if let election = sections.first(where: { $0.id == .civicElection && $0.status == .ready })?.civicElection,
           election.daysUntil >= 0, let day = PlacePresentation.parseCalendarDay(election.date) {
            let utc = TimeZone(identifier: "UTC") ?? .current
            parts.append("election \(day.formatted(Date.FormatStyle(timeZone: utc).month(.abbreviated).day()))")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The first value of each section, as the dashboard read it.
    static func plain(_ sections: [PlaceSectionEnvelope]) -> String? {
        let parts = sections.compactMap { env -> String? in
            guard env.access != .locked, env.status == .ready || env.status == .stale || env.status == .partial else { return nil }
            if let density = env.blockDensity { return density.label }
            let reading = PlacePresentation.reading(for: env)
            return reading.value.map(firstClause) ?? reading.chip?.text
        }
        return parts.isEmpty ? nil : parts.prefix(2).joined(separator: " · ")
    }

    /// A long server sentence cut at its first full stop or dash.
    static func firstClause(_ text: String) -> String {
        let stops = [". ", " — ", "; "]
        let cut = stops.compactMap { text.range(of: $0)?.lowerBound }.min()
        return cut.map { String(text[..<$0]) } ?? text
    }
}

// MARK: - A group row

struct PlaceGlanceRow<Content: View>: View {
    let group: PlaceGlanceGroup
    let summary: String?
    @Binding var isOpen: Bool
    @ViewBuilder var content: Content

    var body: some View {
        PlaceFoldRow(title: group.title, summary: summary, isOpen: $isOpen, identifier: "place.glance.\(group.rawValue)") {
            Icon(group.icon, size: 19, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                .frame(width: 24)
                .accessibilityHidden(true)
        } content: {
            VStack(alignment: .leading, spacing: 0) { content }
                .padding(.leading, 35)
        }
    }
}

// MARK: - Risk and environment as evidence

/// One topic: its result, the area it covers, the kind of evidence, its
/// source and date, and the way to its full detail. Every caveat stays on the
/// Risk page; nothing here adds a score.
struct PlaceEvidenceRow: View {
    let env: PlaceSectionEnvelope
    var verifiesFirst = false
    var onOpen: (() -> Void)?
    var onUnlock: (() -> Void)?

    var body: some View {
        let cfg = PlacePresentation.config(for: env.id)
        let live = env.access != .locked && (env.status == .ready || env.status == .stale || env.status == .partial)
        let reading = live ? PlacePresentation.reading(for: env) : PlaceSectionReading()
        Button { onOpen?() } label: {
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(cfg.title)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 6)
                    if let chip = reading.chip {
                        PlaceChip(model: chip)
                    }
                }
                Text(resultLine(reading, live: live))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                if let evidence = Self.evidenceLine(env) {
                    Text(evidence)
                        .font(Theme.Font.caption)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(onOpen == nil)
        .accessibilityElement(children: .combine)
        .accessibilityHint(onOpen == nil ? "" : "Opens the full result, its source and its limits.")
        .accessibilityIdentifier("place.evidence.\(cfg.title)")
        if env.access == .locked, let onUnlock {
            PlaceTextButton(title: PlacePresentation.lockCta(env.band, verifiesFirst: verifiesFirst)) { onUnlock() }
                .frame(minHeight: 44)
        }
    }

    private func resultLine(_ reading: PlaceSectionReading, live: Bool) -> String {
        if env.access == .locked { return PlacePresentation.lockReason(env) }
        switch PlacePresentation.cardState(env) {
        case .error: return env.id == .alerts ? "Alerts unavailable" : "Couldn't load this · pull to refresh"
        case .unavailable: return env.unavailableReason ?? "Not available for this address yet."
        default: break
        }
        return live ? (reading.value ?? reading.chip?.text ?? "") : ""
    }

    /// "Your parcel's map point · Map classification · FEMA NFHL · Oct 2026".
    static func evidenceLine(_ env: PlaceSectionEnvelope) -> String? {
        let date = PlacePresentation.fmtMonthYear(env.asOf)
        let parts = [env.scope?.label, env.evidence?.label, env.source, date].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

// MARK: - Systems timeline

/// Each system on one line from its install year to now over its typical
/// service-life range: the age, how the year is known, and its status in
/// words. An unknown year stays unknown (no bar). Beyond a typical range isn't
/// proof of failure. `full` adds service dates and the system's note.
struct PlaceSystemsTimeline: View {
    let data: PlaceHomeSystemsData
    var full = false
    var currentYear = Calendar(identifier: .gregorian).component(.year, from: Date())

    var body: some View {
        VStack(alignment: .leading, spacing: full ? 14 : 10) {
            Text(data.summary.headline)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
            ForEach(data.systems, id: \.key) { system in
                row(system)
            }
            Text("Age isn't condition: beyond a typical range isn't proof of failure.")
                .font(Theme.Font.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityIdentifier("place.systemsTimeline")
    }

    private func row(_ system: PlaceHomeSystem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(system.label)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: 8)
                // Verbatim: a localized Text groups the year as a number ("1,938").
                Text(verbatim: system.installedYear.map { "\($0) · \(system.ageYears ?? max(currentYear - $0, 0)) yrs" } ?? "Year unknown")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Self.tone(system.status))
            }
            if let installed = system.installedYear {
                PlaceLifeBar(
                    installed: installed,
                    low: system.typicalLifeLow,
                    high: system.typicalLifeHigh,
                    currentYear: currentYear,
                    tone: Self.tone(system.status)
                )
            }
            Text("\(Self.statusWords(system)) · \(system.sourceLabel) · typical \(system.typicalLifeLow)–\(system.typicalLifeHigh) yrs")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
            if let service = system.lastService {
                Text("Last service \(Self.serviceDate(service.date))\(service.title.map { ": \($0)" } ?? "") · \(service.sourceLabel)")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if full, !system.note.isEmpty {
                Text(system.note)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    static func statusWords(_ system: PlaceHomeSystem) -> String {
        switch system.status {
        case "past_expected": "Beyond its typical range"
        case "aging": "Nearing its typical range"
        case "ok": "Within its typical range"
        default: "Install year unknown"
        }
    }

    static func tone(_ status: String) -> Color {
        switch status {
        case "past_expected": Theme.Color.error
        case "aging": Theme.Color.warning
        case "ok": Theme.Color.home
        default: Theme.Color.appTextMuted
        }
    }

    /// "Mar 14, 2026" from "2026-03-14".
    static func serviceDate(_ day: String) -> String {
        guard let date = PlacePresentation.parseCalendarDay(day) else { return day }
        return date.formatted(Date.FormatStyle(timeZone: TimeZone(identifier: "UTC") ?? .current).month(.abbreviated).day().year())
    }
}

/// The years from install to now on a track, with the typical range shaded.
struct PlaceLifeBar: View {
    let installed: Int
    let low: Int
    let high: Int
    let currentYear: Int
    let tone: Color

    var body: some View {
        GeometryReader { geo in
            let span = Double(max(high, currentYear - installed, 1)) + 2
            let x = { (years: Double) in geo.size.width * min(max(years / span, 0), 1) }
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Color.appSurfaceSunken)
                // The typical service-life range.
                Rectangle()
                    .fill(Theme.Color.appBorder)
                    .frame(width: max(x(Double(high)) - x(Double(low)), 2))
                    .offset(x: x(Double(low)))
                // Install year to now.
                Capsule()
                    .fill(tone)
                    .frame(width: max(x(Double(max(currentYear - installed, 0))), 4), height: 5)
            }
        }
        .frame(height: 7)
        .accessibilityHidden(true)
    }
}
