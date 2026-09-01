//
//  NoAvailabilityView.swift
//  Pantopus
//
//  C8 Slot / No-Availability State (Stream I5). The dedicated calm full screen
//  for "nothing open" — never alarm styling. Offers next-horizon paging and,
//  when a later month has times, hands off to C6 so the booker is never
//  dead-ended.
//

import SwiftUI

struct NoAvailabilityView: View {
    @State private var viewModel: NoAvailabilityViewModel

    init(viewModel: NoAvailabilityViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
            .navigationTitle("Pick a time")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.noAvailability")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loading
        case let .noTimes(monthName):
            DiscoveryEmptyCard(
                // Spec frame 3 (no-times-in-range) uses the neutral `calendar-search`
                // glyph; `calendar-x` is reserved for the composed-empty frame and
                // reads as alarm styling the design explicitly forbids here.
                icon: .calendarSearch,
                headline: "No open times in \(monthName)",
                caption: "Availability changes often. Try a later month.",
                primaryTitle: "See \(viewModel.nextMonthName)",
                primaryIcon: .arrowRight,
                primaryAction: { await viewModel.seeNextMonth() },
                secondaryTitle: "Get notified when times open",
                secondaryIcon: .bell,
                // swiftlint:disable:next trailing_closure
                secondaryAction: { viewModel.notifyWhenAvailable() }
            )
            .padding(.horizontal, Spacing.s4)
        case let .found(monthName):
            DiscoveryEmptyCard(
                icon: .calendarClock,
                headline: "Times open up in \(monthName)",
                caption: "Open times are available — pick one that works for you.",
                primaryTitle: "See open times",
                primaryIcon: .arrowRight
            ) { viewModel.openPicker() }
                .padding(.horizontal, Spacing.s4)
        case .paused:
            DiscoveryNotice(
                icon: .pause,
                title: "This page isn't taking bookings right now",
                message: "Check back later — the host can reopen it at any time."
            )
            .padding(.horizontal, Spacing.s4)
        case let .error(message):
            EmptyState(
                icon: .link,
                headline: message,
                subcopy: "It may have been turned off or moved.",
                cta: .init(title: "Try again") { await viewModel.refresh() }
            )
        }
    }

    private var loading: some View {
        VStack(spacing: Spacing.s3) {
            ForEach(0..<4, id: \.self) { _ in
                SchedulingSlotRowSkeleton()
            }
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityLabel("Checking for open times")
    }
}

#if DEBUG
#Preview("No availability") {
    NavigationStack {
        NoAvailabilityView(viewModel: .previewNoTimes())
    }
}
#endif
