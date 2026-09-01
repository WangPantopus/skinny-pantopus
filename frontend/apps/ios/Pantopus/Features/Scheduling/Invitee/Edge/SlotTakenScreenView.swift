//
//  SlotTakenScreenView.swift
//  Pantopus
//
//  D5 Slot Taken / Conflict (Stream I7). The full-screen takeover that renders
//  the Foundation `SlotTakenSheet` body for the standalone conflict-recovery
//  route: refreshing while it re-reads availability, the nearest open times when
//  found, or the fully-booked / error fallbacks. Tokens only.
//

import SwiftUI

struct SlotTakenScreenView: View {
    @State private var viewModel: SlotTakenScreenViewModel

    init(viewModel: SlotTakenScreenViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        ScrollView {
            content
                .padding(.top, Spacing.s2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .navigationTitle("Pick a time")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("scheduling.slotTakenScreen")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            SlotTakenSheet(
                mode: .refreshing,
                alternatives: [],
                timeZoneIdentifier: viewModel.tz,
                onSelect: { _ in },
                onPickAnotherTime: { viewModel.pickAnotherTime() }
            )
        case let .alternatives(alternatives):
            SlotTakenSheet(
                mode: .alternatives,
                alternatives: alternatives,
                timeZoneIdentifier: viewModel.tz,
                onSelect: { viewModel.select($0) },
                onPickAnotherTime: { viewModel.pickAnotherTime() }
            )
        case .fullyBooked:
            SlotTakenSheet(
                mode: .fullyBooked,
                alternatives: [],
                timeZoneIdentifier: viewModel.tz,
                onSelect: { _ in },
                onPickAnotherTime: { viewModel.pickAnotherTime() },
                onSeeAnotherDay: { viewModel.pickAnotherTime() }
            )
        case let .error(message):
            EmptyState(
                icon: .calendarX,
                headline: message,
                subcopy: "Open times change often — try again.",
                cta: .init(title: "Try again") { await viewModel.refresh() }
            )
            .padding(.top, Spacing.s10)
        }
    }
}

#if DEBUG
#Preview("Alternatives") {
    NavigationStack {
        SlotTakenScreenView(viewModel: .preview(.alternatives([
            SchedulingSlotAlternative(start: "2026-06-17T21:30:00Z", end: "2026-06-17T22:00:00Z", startLocal: nil),
            SchedulingSlotAlternative(start: "2026-06-17T22:30:00Z", end: "2026-06-17T23:00:00Z", startLocal: nil)
        ])))
    }
}

#Preview("Fully booked") {
    NavigationStack { SlotTakenScreenView(viewModel: .preview(.fullyBooked)) }
}
#endif
