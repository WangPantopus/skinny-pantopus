//
//  BookingPageZeroStateView.swift
//  Pantopus
//
//  H16 Booking-Link / Page Empty & Zero-State · Stream I4. A pillar-tinted
//  first-run hero (reusing EmptyState) that routes into A2 (first-run wizard)
//  or B2 (event-type editor). Tokens only.
//

import SwiftUI

public struct BookingPageZeroStateView: View {
    @State private var viewModel: BookingPageZeroStateViewModel

    public init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void
    ) {
        _viewModel = State(initialValue: BookingPageZeroStateViewModel(owner: owner, push: push))
    }

    init(viewModel: BookingPageZeroStateViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .navigationTitle("Get started")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .accessibilityIdentifier("bookingPageZeroState.screen")
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            ZeroStateLoadingView()
        case let .ready(hasEventTypes):
            hero(hasEventTypes: hasEventTypes)
        case let .error(message):
            ZeroStateErrorView(message: message) { Task { await viewModel.refresh() } }
        }
    }

    private func hero(hasEventTypes: Bool) -> some View {
        VStack(spacing: Spacing.s4) {
            EmptyState(
                icon: hasEventTypes ? .link : .calendarPlus,
                headline: hasEventTypes ? "Set up your booking link" : "Start taking bookings",
                subcopy: hasEventTypes
                    ? "Your services are ready. Claim a link people can use to book you."
                    : "Add a service and claim a link so people can book time with you.",
                cta: EmptyState.CTA(title: hasEventTypes ? "Set up booking link" : "Add an event type") {
                    await MainActor.run {
                        if hasEventTypes { viewModel.setUpBookingLink() } else { viewModel.addEventType() }
                    }
                },
                tint: viewModel.theme.accentBg,
                accent: viewModel.theme.accent
            )
            Button {
                if hasEventTypes { viewModel.addEventType() } else { viewModel.setUpBookingLink() }
            } label: {
                Text(hasEventTypes ? "Add another event type" : "Set up booking link")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(viewModel.theme.accent)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("bookingPageZeroState.secondaryCTA")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("bookingPageZeroState.hero")
    }
}

private struct ZeroStateLoadingView: View {
    var body: some View {
        VStack(spacing: Spacing.s3) {
            Shimmer(width: 72, height: 72, cornerRadius: Radii.pill)
            Shimmer(width: 180, height: 16)
            Shimmer(width: 220, height: 12)
            Shimmer(width: 200, height: 44, cornerRadius: Radii.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("bookingPageZeroState.loading")
    }
}

private struct ZeroStateErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load your setup")
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "Try again") { await MainActor.run { retry() } }
                .frame(maxWidth: 240)
        }
        .padding(Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("bookingPageZeroState.error")
    }
}

#if DEBUG
#Preview("No services") {
    let viewModel = BookingPageZeroStateViewModel(owner: .personal) { _ in }
    viewModel.setStateForPreview(.ready(hasEventTypes: false))
    return NavigationStack { BookingPageZeroStateView(viewModel: viewModel) }
}
#endif
