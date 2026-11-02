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

/// One line per group, the same rules and words as Android's `glanceSummary`.
/// Nil when the group has nothing to read; the dashboard then says why.
enum PlaceGlanceSummary {
    /// "37° fog · air 60 moderate · no active weather alerts".
    static func today(_ sections: [PlaceSectionEnvelope]) -> String? {
        var parts: [String] = []
        if let weather = live(.weather, in: sections)?.weather {
            parts.append("\(Int(weather.currentTempF.rounded()))° \(weather.conditionLabel.lowercased())")
        }
        if let air = live(.airQuality, in: sections)?.airQuality, air.category != .unknown {
            parts.append("air \(air.index) \(air.categoryLabel.lowercased())")
        }
        if let alerts = sections.first(where: { $0.id == .alerts }), alerts.access != .locked {
            if let active = live(.alerts, in: sections)?.alerts?.active {
                parts.append(active.isEmpty ? "no active weather alerts"
                    : (active.count == 1 ? "1 weather alert" : "\(active.count) weather alerts"))
            } else {
                parts.append("weather alerts unavailable")
            }
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// "Built 2011 · 2,858 sq ft · 2 beyond typical range" (or nearing it,
    /// install years unknown, or all within typical ranges).
    static func home(_ sections: [PlaceSectionEnvelope]) -> String? {
        var parts: [String] = []
        if let home = live(.yourHome, in: sections)?.yourHome {
            if let year = home.yearBuilt { parts.append("Built \(year)") }
            if let sqft = home.sqft { parts.append("\(PlacePresentation.grouped(sqft)) sq ft") }
        }
        if let systems = live(.homeSystems, in: sections)?.homeSystems?.systems, !systems.isEmpty {
            let past = systems.filter { $0.status == "past_expected" }.count
            let aging = systems.filter { $0.status == "aging" }.count
            let unknown = systems.filter { $0.installedYear == nil }.count
            if past > 0 {
                parts.append("\(past) beyond typical range")
            } else if aging > 0 {
                parts.append("\(aging) nearing typical range")
            } else if unknown > 0 {
                parts.append(unknown == 1 ? "1 install year unknown" : "\(unknown) install years unknown")
            } else {
                parts.append("systems within typical ranges")
            }
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The first two topics with a reading and how many more there are:
    /// "Flood: Minimal risk · Earthquake: Design category D · 5 more topics".
    /// With `chipsFirst` (Risk and environment) a short classification leads;
    /// otherwise the rows' order.
    static func topics(_ sections: [PlaceSectionEnvelope], chipsFirst: Bool = false) -> String? {
        let read = sections.compactMap { env -> (chip: Bool, text: String)? in
            guard let short = shortResult(env) else { return nil }
            return (short.chip, "\(PlacePresentation.config(for: env.id).title): \(short.text)")
        }
        let ordered = chipsFirst ? read.filter(\.chip) + read.filter { !$0.chip } : read
        let named = ordered.prefix(2).map(\.text)
        guard !named.isEmpty else { return nil }
        let more = sections.count - named.count
        let tail = more > 0 ? ["\(more) more topic\(more == 1 ? "" : "s")"] : []
        return (named + tail).joined(separator: " · ")
    }

    /// "6 voting districts · election Nov 3", from every section (the
    /// election row leaves Civic's list while the ballot card shows).
    static func civic(_ sections: [PlaceSectionEnvelope]) -> String? {
        var parts: [String] = []
        if let districts = live(.civicDistricts, in: sections)?.civicDistricts?.districts, !districts.isEmpty {
            parts.append(districts.count == 1 ? "1 voting district" : "\(districts.count) voting districts")
        }
        if let election = sections.first(where: { $0.id == .civicElection && $0.status == .ready })?.civicElection,
           election.daysUntil >= 0, let day = PlacePresentation.parseCalendarDay(election.date) {
            let utc = TimeZone(identifier: "UTC") ?? .current
            parts.append("election \(day.formatted(Date.FormatStyle(timeZone: utc).month(.abbreviated).day()))")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The identity topics, then what the group holds for this viewer.
    static func identity(_ sections: [PlaceSectionEnvelope], letters: Bool, verify: Bool, mirror: Bool) -> String? {
        var parts: [String] = []
        if let read = topics(sections) { parts.append(read) }
        if letters { parts.append("Residency letters & passes") }
        if verify { parts.append("locked until you verify") }
        if mirror { parts.append("what neighbors see") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The section when this viewer can read it now.
    private static func live(_ id: PlaceSectionID, in sections: [PlaceSectionEnvelope]) -> PlaceSectionEnvelope? {
        sections.first { $0.id == id && isLive($0) }
    }

    static func isLive(_ env: PlaceSectionEnvelope) -> Bool {
        env.access != .locked && (env.status == .ready || env.status == .stale || env.status == .partial)
    }

    /// A topic's own result, short: the block's activity, the chip, else the
    /// value's first clause.
    static func shortResult(_ env: PlaceSectionEnvelope) -> (text: String, chip: Bool)? {
        guard isLive(env) else { return nil }
        if let density = env.blockDensity { return (density.label, false) }
        let reading = PlacePresentation.reading(for: env)
        if let chip = reading.chip?.text, !chip.isEmpty { return (chip, true) }
        guard let text = reading.value.map(firstClause), !text.isEmpty else { return nil }
        return (text.hasSuffix(".") ? String(text.dropLast()) : text, false)
    }

    /// A long server sentence cut at its first full stop or dash.
    static func firstClause(_ text: String) -> String {
        let stops = [". ", " — ", "; "]
        let cut = stops.compactMap { text.range(of: $0)?.lowerBound }.min()
        return cut.map { String(text[..<$0]) } ?? text
    }

    /// The line as shown: its first letter capitalized.
    static func sentence(_ line: String) -> String {
        line.prefix(1).uppercased() + line.dropFirst()
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

/// A topic's next step where the app already has one (TPR contract §4): the
/// forecast's own guidance, or an existing action such as Today's radon
/// question. Topics without one show none.
struct PlaceNextStep {
    let text: String
    var action: (@MainActor () -> Void)?

    /// Heat and cold: the forecast's guidance, when there is something to act on.
    static func guidance(_ env: PlaceSectionEnvelope) -> PlaceNextStep? {
        guard PlaceGlanceSummary.isLive(env), let guidance = env.heatCold?.guidance, !guidance.isEmpty else { return nil }
        return PlaceNextStep(text: guidance)
    }
}

/// One topic: its result, the area it covers, the kind of evidence, its
/// source and date, its next step where there is one, and the way to its
/// full detail. Every caveat stays on the Risk page; nothing here adds a score.
struct PlaceEvidenceRow: View {
    let env: PlaceSectionEnvelope
    var verifiesFirst = false
    var nextStep: PlaceNextStep?
    var onOpen: (() -> Void)?
    var onUnlock: (() -> Void)?

    var body: some View {
        let cfg = PlacePresentation.config(for: env.id)
        Group {
            // A row that opens the page is a button; on the Risk page itself it's plain text.
            if let onOpen {
                Button(action: onOpen) { content }
                    .buttonStyle(.plain)
                    .accessibilityHint("Opens the full result, its source and its limits.")
            } else {
                content
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("place.evidence.\(cfg.title)")
        if env.access == .locked, let onUnlock {
            PlaceTextButton(title: PlacePresentation.lockCta(env.band, verifiesFirst: verifiesFirst), minHeight: 44) { onUnlock() }
        }
        if let nextStep, let action = nextStep.action {
            PlaceTextButton(title: "Next step: \(nextStep.text)", minHeight: 44) { action() }
                .accessibilityIdentifier("place.evidence.\(cfg.title).next")
        }
    }

    private var content: some View {
        let live = env.access != .locked && (env.status == .ready || env.status == .stale || env.status == .partial)
        let reading = live ? PlacePresentation.reading(for: env) : PlaceSectionReading()
        // The chip already says a short result ("Minimal risk"); a longer one reads under the title.
        let result = resultLine(reading, live: live)
        return VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(PlacePresentation.config(for: env.id).title)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: 6)
                if let chip = reading.chip {
                    PlaceChip(model: chip)
                }
            }
            if !result.isEmpty, result != reading.chip?.text {
                Text(result)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let evidence = Self.evidenceLine(env) {
                Text(evidence)
                    .font(Theme.Font.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            // A next step that is advice reads with the row; one that acts is its own button below.
            if let nextStep, nextStep.action == nil {
                Text("Next step: \(nextStep.text)")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
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
