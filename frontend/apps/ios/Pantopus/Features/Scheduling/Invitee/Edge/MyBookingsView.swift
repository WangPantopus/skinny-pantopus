//
//  MyBookingsView.swift
//  Pantopus
//
//  D11 My Bookings — customer (Stream I7). The signed-in user's bookings in one
//  place: an Upcoming / Past segmented control over time-bucketed groups, each
//  row carrying the host pillar, the local time and an honest status pill.
//  Loading skeleton / empty / loaded / error states, wrapped in the offline
//  banner. Tokens only.
//

import SwiftUI

struct MyBookingsView: View {
    @State private var viewModel: MyBookingsViewModel

    init(viewModel: MyBookingsViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appBg)
            .navigationTitle("My bookings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {} label: {
                        Icon(.search, size: 18, color: Theme.Color.appTextSecondary)
                    }
                    .accessibilityLabel("Search bookings")
                    .accessibilityIdentifier("scheduling.myBookings.search")
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.refresh() }
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .accessibilityIdentifier("scheduling.myBookings")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loading
        case .empty:
            emptyState
        case let .error(message):
            EmptyState(
                icon: .calendar,
                headline: "We couldn't load your bookings",
                subcopy: message,
                cta: .init(title: "Try again") { await viewModel.refresh() }
            )
        case .loaded:
            loaded
        }
    }

    // MARK: - Loaded

    private var loaded: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                segmented
                if showTagline {
                    Text("Everything you've booked, in one place.")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .multilineTextAlignment(.center)
                }
                if currentGroups.isEmpty {
                    segmentEmpty
                } else {
                    ForEach(currentGroups) { group in
                        VStack(alignment: .leading, spacing: Spacing.s2) {
                            EdgeOverline(text: group.title, alert: group.attention)
                            ForEach(group.bookings) { booking in
                                bookingRow(booking)
                            }
                        }
                    }
                }
            }
            .padding(Spacing.s4)
        }
    }

    private var currentGroups: [BookingGroup] {
        viewModel.segment == .upcoming ? viewModel.upcomingGroups : viewModel.pastGroups
    }

    /// The design shows the tagline only on the populated Upcoming frame.
    private var showTagline: Bool {
        viewModel.segment == .upcoming && !currentGroups.isEmpty
    }

    private var segmented: some View {
        HStack(spacing: 3) {
            segmentButton(title: "Upcoming", value: .upcoming)
            segmentButton(title: "Past", value: .past)
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private func segmentButton(title: String, value: MyBookingsViewModel.Segment) -> some View {
        let isSelected = viewModel.segment == value
        return Button { viewModel.segment = value } label: {
            Text(title)
                .font(.system(size: 12.5, weight: isSelected ? .bold : .semibold))
                .foregroundStyle(isSelected ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s2)
                .background(isSelected ? Theme.Color.appSurface : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                .edgeShadow(isSelected ? .sm : nil)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("scheduling.myBookings.segment.\(title)")
    }

    // swiftlint:disable:next function_body_length
    private func bookingRow(_ booking: BookingDTO) -> some View {
        let isPast = viewModel.segment == .past
        let tz = booking.inviteeTimezone ?? SchedulingTime.deviceTimeZoneIdentifier
        let isBalanceDue = isBalanceDueStatus(booking.status)
        let showBookAgain = isPast
        let showPayAffordance = isBalanceDue

        return VStack(spacing: 0) {
            // Main row content
            HStack(spacing: 11) {
                EdgePillarAvatar(name: booking.inviteeName, ownerType: booking.ownerType, size: 42)
                VStack(alignment: .leading, spacing: 2) {
                    // Design primary line is the event-type name. The lean
                    // /my-bookings payload omits it, so we fall back to the
                    // pillar label as the title (event name is deferredBackend).
                    Text(titleLabel(booking.ownerType))
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .tracking(-0.1)
                        .lineLimit(1)
                    // Design secondary line is "with {host} · {when}". The host
                    // name is deferredBackend, so we render the {when} alone.
                    Text(EdgeFormat.dayTime(booking.startAt, tz: tz) ?? "Time to be confirmed")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
                VStack(alignment: .trailing, spacing: 6) {
                    statusPill(for: booking.status)
                    if !showBookAgain && !showPayAffordance {
                        Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                    }
                }
            }
            .padding(.horizontal, 13)
            .padding(.vertical, Spacing.s3)

            // Past rows: Book again footer (design: my-bookings-frames.jsx:184-189)
            if showBookAgain {
                Rectangle()
                    .fill(Theme.Color.appBorder)
                    .frame(height: 1)
                HStack {
                    Spacer()
                    Button {
                        // deferredBackend: re-book requires event-type id from lean payload
                    } label: {
                        HStack(spacing: 5) {
                            Icon(.rotateCcw, size: 12, strokeWidth: 2.3, color: Theme.Color.primary600)
                            Text("Book again")
                                .font(.system(size: 11.5, weight: .bold))
                                .foregroundStyle(Theme.Color.primary600)
                                .tracking(-0.05)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("scheduling.myBookings.bookAgain.\(booking.id)")
                }
                .padding(.horizontal, 13)
                .padding(.vertical, Spacing.s2)
            }

            // Needs-attention rows: Pay footer for balance-due bookings
            // (design: my-bookings-frames.jsx:191-196)
            // Balance amount is deferredBackend (not in lean payload); footer
            // structure ships as designed, amount placeholder shown.
            if showPayAffordance {
                Rectangle()
                    .fill(Theme.Color.appBorder)
                    .frame(height: 1)
                HStack {
                    Text("Balance due at confirm")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.warning)
                    Spacer()
                    Button {
                        // deferredBackend: payment amount not in lean payload
                    } label: {
                        Text("Pay")
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .padding(.horizontal, 14)
                            .frame(height: 28)
                            .background(Theme.Color.primary600)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("scheduling.myBookings.pay.\(booking.id)")
                }
                .padding(.horizontal, 13)
                .padding(.vertical, Spacing.s2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .edgeShadow(.sm)
        .opacity(isPast ? 0.66 : 1)
        .accessibilityElement(children: .combine)
    }

    /// Status pill with a local "Approve pending" label for the pending-approval
    /// state. All other statuses delegate to the shared pill which maps pending →
    /// INFO-blue (my-bookings-frames.jsx:157 — INFO_BG/F0F9FF, INFO/0369A1).
    @ViewBuilder
    private func statusPill(for status: String) -> some View {
        let key = status.lowercased().replacingOccurrences(of: "-", with: "_")
        if key == "pending_approval" || key == "approve_pending" {
            // Design frame 5: "Approve pending" INFO-blue pill (same tone as
            // the shared pending pill; only the label differs).
            HStack(spacing: 3) {
                Icon(.clock, size: 9, strokeWidth: 2.2, color: Theme.Color.info)
                Text("Approve pending")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.info)
                    .lineLimit(1)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(Theme.Color.infoBg)
            .overlay(Capsule().strokeBorder(Theme.Color.infoLight, lineWidth: 1))
            .clipShape(Capsule())
        } else if key == "balance_due" {
            // Design frame 5: "Balance due" WARN-amber pill.
            HStack(spacing: 3) {
                Icon(.alertCircle, size: 9, strokeWidth: 2.2, color: Theme.Color.warning)
                Text("Balance due")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                    .lineLimit(1)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 3)
            .background(Theme.Color.warningBg)
            .overlay(Capsule().strokeBorder(Theme.Color.warningLight, lineWidth: 1))
            .clipShape(Capsule())
        } else {
            SchedulingStatusPill(status: status)
        }
    }

    /// Whether a booking status signals a balance-due state.
    private func isBalanceDueStatus(_ status: String) -> Bool {
        let key = status.lowercased().replacingOccurrences(of: "-", with: "_")
        return key == "balance_due"
    }

    /// Design primary-line fallback: the host pillar as a title until the
    /// backend joins the event-type name into the lean payload.
    private func titleLabel(_ ownerType: String?) -> String {
        "\(EdgeOwnerTheme.owner(forOwnerType: ownerType).theme.title) booking"
    }

    // MARK: - States

    private var loading: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                segmented
                // Design groups skeleton rows under shimmer overline bars.
                skeletonGroup(overlineWidth: 80)
                skeletonGroup(overlineWidth: 64)
            }
            .padding(Spacing.s4)
        }
        .accessibilityLabel("Loading your bookings")
    }

    private func skeletonGroup(overlineWidth: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Shimmer(width: overlineWidth, height: 9)
            ForEach(0..<2, id: \.self) { _ in skeletonRow }
        }
    }

    private var skeletonRow: some View {
        HStack(spacing: 11) {
            Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 42, height: 42)
            VStack(alignment: .leading, spacing: 7) {
                Shimmer(width: 120, height: 11)
                Shimmer(width: 160, height: 9)
            }
            Spacer(minLength: Spacing.s2)
            Shimmer(width: 54, height: 16)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .edgeShadow(.sm)
    }

    private var emptyState: some View {
        EmptyState(
            icon: .calendar,
            headline: "You haven't booked anything yet",
            subcopy: "Bookings you make show up here — everything in one place.",
            cta: .init(title: "Find something to book") {
                // Destination (discovery) is not yet wired into SchedulingRoute;
                // the design renders this primary CTA, so it ships view-only.
            }
        )
    }

    private var segmentEmpty: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.calendar, size: 26, color: Theme.Color.appTextMuted)
            Text(viewModel.segment == .upcoming ? "No upcoming bookings" : "No past bookings")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s10)
    }
}

#if DEBUG
#Preview("Loaded") {
    NavigationStack { MyBookingsView(viewModel: .previewLoaded()) }
}

#Preview("Empty") {
    NavigationStack { MyBookingsView(viewModel: .previewEmpty()) }
}
#endif
