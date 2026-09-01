//
//  PlaceRiskDetailContent.swift
//  Pantopus
//
//  C5 — Risk & readiness. Flood / seismic / wildfire, the folded
//  health & environment group (lead·radon, water, EPA facilities), and
//  the local-state emergency-plan checklist (Ready.gov / Red Cross).
//

import SwiftUI

struct PlaceRiskDetailContent: View {
    let intel: PlaceIntelligence
    let vm: PlaceDetailViewModel
    @State private var fridge: PlaceFridgeCardViewModel

    init(intel: PlaceIntelligence, vm: PlaceDetailViewModel) {
        self.intel = intel
        self.vm = vm
        _fridge = State(initialValue: PlaceFridgeCardViewModel(homeId: vm.homeId))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Heat & cold leads: it is the only thing here with a forecast
            // horizon short enough to act on today. The rest are standing facts.
            if let heat = vm.section(.heatCold, in: intel) {
                PlaceDetailSectionLabel(text: "Heat & cold")
                if let data = heat.heatCold, heat.status == .ready || heat.status == .stale {
                    HeatColdCard(data: data)
                    PlaceSourceNote(name: heat.source ?? "", asOf: "7-day forecast")
                } else {
                    vm.fallbackCard(heat)
                }
            }

            PlaceDetailSectionLabel(text: "Flood & hazards")
            VStack(spacing: 8) {
                if let flood = vm.section(.flood, in: intel) { riskCard(flood) }
                if let seismic = vm.section(.seismic, in: intel) { riskCard(seismic) }
                if let wildfire = vm.section(.wildfire, in: intel) { riskCard(wildfire) }
            }
            if let flood = vm.section(.flood, in: intel) {
                PlaceSourceNote(name: "FEMA · USGS · USFS", asOf: PlacePresentation.fmtMonthYear(flood.asOf))
            }

            let health = [PlaceSectionID.leadRadon, .drinkingWater, .environmentalHazards]
                .compactMap { vm.section($0, in: intel) }
            if !health.isEmpty {
                PlaceDetailSectionLabel(text: "Health & environment")
                VStack(spacing: 8) {
                    ForEach(health, id: \.id) { env in healthCard(env) }
                }
                PlaceSourceNote(name: "EPA radon zones · SDWIS · ECHO", asOf: nil)
            }

            PlaceDetailSectionLabel(text: "Emergency plan")
            EmergencyChecklist()
            PlaceSourceNote(name: "Ready.gov · American Red Cross", asOf: nil)

            PlaceDetailSectionLabel(text: "Fridge card")
            if intel.tier == .t4 {
                PlaceFridgeCardSection(vm: fridge)
                    .task { await fridge.load() }
            } else {
                PlaceLockedCard(
                    icon: .heartPulse,
                    title: "The 911-ready household card",
                    reason: "Verify your address to issue a fridge card — its headline is the verified address a caller reads to 911.",
                    cta: "Verify address",
                    onTap: nil
                )
            }
        }
    }

    @ViewBuilder
    private func riskCard(_ env: PlaceSectionEnvelope) -> some View {
        let cfg = PlacePresentation.config(for: env.id)
        if env.status == .ready || env.status == .stale {
            let reading = PlacePresentation.reading(for: env)
            PlaceDetailCard(padding: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 11) {
                        PlaceIconTile(icon: cfg.icon, tone: .home, size: 32)
                        Text(cfg.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Spacer(minLength: 0)
                        if let chip = reading.chip { PlaceChip(model: chip) }
                    }
                    if let summary = riskSummary(env) {
                        Text(summary)
                            .font(.system(size: 13.5))
                            .lineSpacing(2)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    if let disclaimer = riskDisclaimer(env) {
                        Text(disclaimer)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    if let nfip = env.flood?.nfip {
                        nfipBlock(nfip)
                    }
                }
            }
        } else {
            vm.fallbackCard(env)
        }
    }

    // Wave 2 — what flood policies in this tract actually cost. Absent
    // while the benchmark warms or sits below the 10-policy floor, so
    // the card degrades to zone-only. A benchmark, never a quote.
    @ViewBuilder
    private func nfipBlock(_ nfip: PlaceFloodNfipData) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Divider()
            Text("What flood policies near you cost")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextMuted)
                .textCase(.uppercase)
            let band = "\(PlacePresentation.money(nfip.premiumP25) ?? "")–\(PlacePresentation.money(nfip.premiumP75) ?? "")"
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(band)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("/yr · median \(PlacePresentation.money(nfip.premiumMedian) ?? "")")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Text(nfipCaption(nfip))
                .pantopusTextStyle(.caption)
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.top, 2)
    }

    private func nfipCaption(_ nfip: PlaceFloodNfipData) -> String {
        let sampled = nfip.coverage == "partial" ? " (sampled)" : ""
        return "Real NFIP premiums for the \(nfip.policyCount) policies written in your census tract "
            + "over the last \(nfip.windowMonths) months\(sampled). "
            + "A benchmark, not a quote — premiums vary house to house."
    }

    private func riskSummary(_ env: PlaceSectionEnvelope) -> String? {
        switch env.id {
        case .flood: env.flood?.plainMeaning
        case .seismic: env.seismic?.summary
        case .wildfire: env.wildfire?.summary
        default: nil
        }
    }

    private func riskDisclaimer(_ env: PlaceSectionEnvelope) -> String? {
        switch env.id {
        case .seismic: env.seismic?.disclaimer
        case .wildfire: env.wildfire?.disclaimer
        default: nil
        }
    }

    @ViewBuilder
    private func healthCard(_ env: PlaceSectionEnvelope) -> some View {
        let cfg = PlacePresentation.config(for: env.id)
        if env.status == .ready || env.status == .stale {
            PlaceDetailCard(padding: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 11) {
                        PlaceIconTile(icon: cfg.icon, tone: .home, size: 32)
                        Text(cfg.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Spacer(minLength: 0)
                    }
                    if let summary = healthSummary(env) {
                        Text(summary)
                            .font(.system(size: 13.5))
                            .lineSpacing(2)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    if let facilities = env.environmentalHazards?.facilities, !facilities.isEmpty {
                        VStack(spacing: 6) {
                            ForEach(Array(facilities.prefix(4).enumerated()), id: \.offset) { _, f in
                                HStack {
                                    Text(f.name).font(.system(size: 12.5, weight: .medium))
                                        .foregroundStyle(Theme.Color.appTextStrong)
                                    Spacer()
                                    Text(String(format: "%.1f mi", f.distanceMi))
                                        .pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextMuted)
                                }
                            }
                        }
                    }
                    if let disclaimer = healthDisclaimer(env) {
                        Text(disclaimer).pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextMuted)
                    }
                }
            }
        } else {
            vm.fallbackCard(env)
        }
    }

    private func healthSummary(_ env: PlaceSectionEnvelope) -> String? {
        switch env.id {
        case .leadRadon: env.leadRadon?.summary
        case .drinkingWater: env.drinkingWater?.summary
        case .environmentalHazards: env.environmentalHazards?.summary
        default: nil
        }
    }

    private func healthDisclaimer(_ env: PlaceSectionEnvelope) -> String? {
        switch env.id {
        case .leadRadon: env.leadRadon?.disclaimer
        case .environmentalHazards: env.environmentalHazards?.disclaimer
        default: nil
        }
    }
}

// MARK: - Emergency checklist (local state)

private struct EmergencyChecklist: View {
    private struct Group { let title: String
        let items: [String]
    }

    private static let groups: [Group] = [
        Group(
            title: "Go-bag essentials",
            items: [
                "Water (1 gal/person/day)",
                "Three days of food",
                "Flashlight + batteries",
                "First-aid kit",
                "Medications",
                "Phone charger / power bank"
            ]
        ),
        Group(
            title: "Key contacts",
            items: ["Out-of-area contact", "Local emergency numbers", "Utility shut-off info"]
        ),
        Group(
            title: "Meeting point",
            items: ["Neighborhood spot", "Out-of-town spot", "Reunification plan"]
        )
    ]

    @State private var checked: Set<String> = []

    private var total: Int {
        Self.groups.reduce(0) { $0 + $1.items.count }
    }

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Your household plan")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer()
                    Text("\(checked.count) of \(total) ready")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.home)
                }
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.Color.appSurfaceSunken).frame(height: 6)
                        Capsule().fill(Theme.Color.home)
                            .frame(width: proxy.size.width * (total == 0 ? 0 : Double(checked.count) / Double(total)), height: 6)
                    }
                }
                .frame(height: 6)
                ForEach(Self.groups, id: \.title) { group in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(group.title.uppercased())
                            .font(.system(size: 11, weight: .bold))
                            .kerning(0.6)
                            .foregroundStyle(Theme.Color.appTextMuted)
                        ForEach(group.items, id: \.self) { item in
                            checkRow(item)
                        }
                    }
                }
            }
        }
    }

    private func checkRow(_ item: String) -> some View {
        Button {
            if checked.contains(item) { checked.remove(item) } else { checked.insert(item) }
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    Circle().strokeBorder(checked.contains(item) ? Theme.Color.home : Theme.Color.appBorder, lineWidth: 2)
                        .background(Circle().fill(checked.contains(item) ? Theme.Color.home : Color.clear))
                        .frame(width: 22, height: 22)
                    if checked.contains(item) {
                        Icon(.check, size: 13, strokeWidth: 3, color: Theme.Color.appTextInverse)
                    }
                }
                Text(item)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }
}

/// Heat & cold — the 7-day NWS HeatRisk strip plus the verdict.
///
/// Level colours are the published HeatRisk ramp: a data-viz scale with no
/// token equivalent, the same treatment the EPA AQI bands get. Outside
/// CONUS the strip is replaced by a coverage note — `heatCovered == false`
/// is a GAP, not a reading of zero, and must never imply calm.
private struct HeatColdCard: View {
    let data: PlaceHeatColdData

    private static let levelColors: [Color] = [
        Color(red: 0.776, green: 0.894, blue: 0.706),
        Color(red: 1.0, green: 0.918, blue: 0.380),
        Color(red: 1.0, green: 0.639, blue: 0.247),
        Color(red: 0.910, green: 0.267, blue: 0.180),
        Color(red: 0.541, green: 0.169, blue: 0.886),
    ]

    private var tone: Color {
        if data.mode == "none" { return Theme.Color.appTextSecondary }
        if data.mode == "cold" || (data.peakLevel ?? 0) >= 3 { return Theme.Color.error }
        return Theme.Color.warning
    }

    private func weekday(_ date: String, isFirst: Bool) -> String {
        if isFirst { return "Today" }
        let parts = date.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return "" }
        var comps = DateComponents()
        comps.year = parts[0]; comps.month = parts[1]; comps.day = parts[2]
        guard let d = Calendar(identifier: .gregorian).date(from: comps) else { return "" }
        let fmt = DateFormatter()
        fmt.dateFormat = "EEE"
        return fmt.string(from: d)
    }

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(data.headline)
                        .font(.system(size: 15.5, weight: .semibold))
                        .foregroundStyle(tone)
                    if !data.guidance.isEmpty {
                        Text(data.guidance)
                            .font(.system(size: 13.5))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                }

                if data.heatCovered, !data.heatDays.isEmpty {
                    HStack(alignment: .bottom, spacing: 6) {
                        ForEach(Array(data.heatDays.prefix(7).enumerated()), id: \.element.date) { idx, day in
                            VStack(spacing: 4) {
                                Text(weekday(day.date, isFirst: idx == 0))
                                    .font(.system(size: 11.5, weight: .semibold))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(Self.levelColors[min(max(day.level, 0), 4)])
                                    .frame(height: idx == 0 ? 34 : 22)
                                Text("\(day.level)")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.Color.appTextMuted)
                            }
                            .frame(maxWidth: .infinity)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("\(weekday(day.date, isFirst: idx == 0)): \(day.label)")
                        }
                    }
                    Text("NWS HeatRisk, 0 (little to none) to 4 (extreme). Experimental product.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                } else {
                    Text("NWS HeatRisk covers the contiguous US. The freeze forecast above still applies here.")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
        }
    }
}
