//
//  PlaceUnlistedBrokerList.swift
//  Pantopus
//
//  The broker half of Unlisted (Wave 4) — the grouped list of sites that
//  republish county property records, and the control the resident uses
//  to record where they have got to with each. Composed by
//  `PlaceUnlistedSection`, which renders the state program ABOVE this
//  and the verbatim `method_note` beside it.
//
//  Two rules live in this file specifically:
//
//  * Each broker's `note` is rendered WHOLE. It carries the thing the
//    person actually needs — a dead form, a flow where only step one was
//    verified, a site that relists you — and truncating it as clutter
//    removes the warning, not the noise.
//  * `typical_days == 0` means the site publishes NO processing time.
//    It renders as "not stated"; "0 days" would read as instant, which
//    is the opposite of true.
//
//  Recording a step is the resident's own bookkeeping: the removal
//  happens on the broker's own site, we never act as the person, and
//  nothing here may suggest otherwise.
//

import SwiftUI

// MARK: - One category of brokers

struct UnlistedGroupCard: View {
    let group: UnlistedBrokerGroup
    let profile: UnlistedExposureProfile
    let vm: PlaceUnlistedViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(group.label)
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextMuted)
                .padding(.top, 6)
                .padding(.horizontal, Spacing.s1)
            ForEach(group.brokers) { broker in
                UnlistedBrokerCard(broker: broker, profile: profile, vm: vm)
            }
        }
        .accessibilityIdentifier("place.unlisted.group.\(group.id)")
    }
}

private struct UnlistedBrokerCard: View {
    let broker: UnlistedBroker
    let profile: UnlistedExposureProfile
    let vm: PlaceUnlistedViewModel

    var body: some View {
        PlaceDetailCard(padding: 14) {
            VStack(alignment: .leading, spacing: 9) {
                HStack(spacing: Spacing.s2) {
                    Text(broker.name)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                    PlaceChip(model: PlaceChipModel(tone: .neutral, text: methodLabel))
                }
                if !publishes.isEmpty {
                    Text("Publishes: \(publishes)")
                        .font(.system(size: 12.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                requirementsLine
                // The caveat the person actually needs — a dead form, a
                // half-verified flow, a site that relists you. Never
                // truncated away as clutter.
                if !broker.note.isEmpty {
                    Text(broker.note)
                        .pantopusTextStyle(.caption)
                        .lineSpacing(2.5)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("place.unlisted.broker.\(broker.id).note")
                }
                if let url = broker.optOutURL {
                    Link(destination: url) {
                        HStack(spacing: 6) {
                            Text("Open their opt-out page")
                                .font(.system(size: 13, weight: .semibold))
                            Icon(.externalLink, size: 13, strokeWidth: 2, color: Theme.Color.primary600)
                        }
                        .foregroundStyle(Theme.Color.primary600)
                    }
                    .accessibilityIdentifier("place.unlisted.broker.\(broker.id).optOut")
                }
                UnlistedStatusControl(broker: broker, vm: vm)
            }
        }
        .accessibilityIdentifier("place.unlisted.broker.\(broker.id)")
    }

    private var publishes: String {
        broker.exposes.map(profile.exposureLabel).joined(separator: " · ")
    }

    private var methodLabel: String {
        switch broker.method {
        case .webForm: "Web form"
        case .email: "By email"
        case .phone: "By phone"
        case .mail: "By post"
        case .accountRequired: "Account needed"
        case .unknown: "See their page"
        }
    }

    @ViewBuilder
    private var requirementsLine: some View {
        let parts = requirements
        if !parts.isEmpty {
            Text(parts.joined(separator: " · "))
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    private var requirements: [String] {
        var parts: [String] = []
        if broker.requiresId { parts.append("Asks for photo ID") }
        if broker.requiresEmail { parts.append("Needs an email you can open") }
        // 0 means the site publishes no processing time. Saying "0 days"
        // would read as instant, which is the opposite of true.
        if let days = broker.statedProcessingDays {
            parts.append("Says it takes about \(days) days")
        } else {
            parts.append("No processing time stated")
        }
        return parts
    }
}

// MARK: - Recording a step (the resident's own bookkeeping)

private struct UnlistedStatusControl: View {
    let broker: UnlistedBroker
    let vm: PlaceUnlistedViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Where you are with this")
                .font(.system(size: 11.5, weight: .bold))
                .kerning(0.5)
                .foregroundStyle(Theme.Color.appTextMuted)
            HStack(spacing: 6) {
                ForEach(UnlistedRemovalStatus.selectable, id: \.self) { status in
                    statusButton(status)
                }
            }
            if case .unknown = vm.rowProgress(brokerId: broker.id) {
                Text("Nothing is marked here — we couldn't read your saved progress.")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.warning)
            }
        }
        .padding(.top, 2)
        .accessibilityIdentifier("place.unlisted.broker.\(broker.id).status")
    }

    private func statusButton(_ status: UnlistedRemovalStatus) -> some View {
        let selected = vm.rowProgress(brokerId: broker.id) == .status(status)
        return Button {
            Task { await vm.setStatus(brokerId: broker.id, to: status) }
        } label: {
            Text(label(status))
                .font(.system(size: 11.5, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7)
                .background(
                    selected ? Theme.Color.primary100 : Theme.Color.appSurface,
                    in: RoundedRectangle(cornerRadius: 9, style: .continuous)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .strokeBorder(
                            selected ? Theme.Color.primary600 : Theme.Color.appBorder,
                            lineWidth: 1.5
                        )
                )
                .foregroundStyle(selected ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
        }
        .buttonStyle(.plain)
        .disabled(vm.savingBrokerId == broker.id)
        .accessibilityIdentifier("place.unlisted.status.\(broker.id).\(status.rawValue)")
    }

    private func label(_ status: UnlistedRemovalStatus) -> String {
        switch status {
        case .todo: "Not started"
        case .requested: "Asked them"
        case .confirmed: "They confirmed"
        case .relisted: "Back again"
        case .unknown: ""
        }
    }
}
