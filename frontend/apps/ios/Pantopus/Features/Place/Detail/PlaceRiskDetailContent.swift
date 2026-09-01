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

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
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
                }
            }
        } else {
            vm.fallbackCard(env)
        }
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
