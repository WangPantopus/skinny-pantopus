//
//  BookingsInboxView.swift
//  Pantopus
//
//  E1 Bookings Inbox (Stream I8). A tabbed list-of-rows: custom top bar
//  (back · "Bookings" · search · filter), an owner scope pill, the
//  Upcoming/Pending/Past/Cancelled segmented control (Pending badge), and
//  day-sectioned booking rows with a "Share booking link" FAB. Pending rows
//  approve inline or open the decline sheet. Loading / empty / error states are
//  wrapped in the offline banner.
//

import SwiftUI

struct BookingsInboxView: View {
    @State private var viewModel: BookingsInboxViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: BookingsInboxViewModel) {
        _viewModel = State(wrappedValue: viewModel)
    }

    var body: some View {
        @Bindable var viewModel = viewModel
        return VStack(spacing: Spacing.s0) {
            topBar
            scopePills
            if viewModel.searchVisible {
                searchField($viewModel.searchText)
            }
            segmentedTabs
            if let actionError = viewModel.actionError {
                actionBanner(actionError)
            }
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task { await viewModel.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .sheet(item: $viewModel.activeSheet) { sheet in
            BookingActionSheetView(
                sheet: sheet,
                owner: viewModel.owner,
                eventName: viewModel.eventName(for: sheet.booking),
                onCompleted: { await viewModel.handleSheetCompleted() },
                onSwitchToReschedule: { booking in viewModel.activeSheet = .reschedule(booking) }
            )
        }
        .accessibilityIdentifier("scheduling.bookingsInbox")
    }

    // MARK: - Top bar

    private var topBar: some View {
        @Bindable var viewModel = viewModel
        return HStack(spacing: Spacing.s1) {
            iconButton(.chevronLeft, label: "Back", strong: true) { dismiss() }
            Text("Bookings")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .frame(maxWidth: .infinity)
            iconButton(.search, label: "Search bookings") { viewModel.toggleSearch() }
            iconButton(.slidersHorizontal, label: "Filter bookings") { viewModel.presentFilterSheet() }
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 46)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
        .sheet(isPresented: $viewModel.filterSheetVisible) {
            BookingFilterSheet(
                viewModel: viewModel.makeFilterViewModel(),
                onApply: { filters in Task { await viewModel.applyFilters(filters) } },
                onClose: { viewModel.filterSheetVisible = false }
            )
        }
    }

    private func iconButton(_ icon: PantopusIcon, label: String, strong: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(icon, size: strong ? 21 : 18, color: strong ? Theme.Color.appText : Theme.Color.appTextSecondary)
                .frame(width: 34, height: 34)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // MARK: - Scope pills

    /// The cross-owner scope row (All / Personal / Home / Business) matching the
    /// design's horizontally-scrolling pill switcher. The inbox is scoped to a
    /// single owner per route, so the pill for the active owner is filled in its
    /// identity colour and the others are rendered (for parity) but disabled —
    /// cross-owner navigation needs an owner directory the route doesn't carry
    /// (deferred). The active pill follows the owner-polymorphic accent.
    private var scopePills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                ForEach(BookingScopeFilter.allCases) { scope in
                    scopePill(scope)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, 11)
            .padding(.bottom, Spacing.s1 - 1)
        }
        .accessibilityIdentifier("scheduling.bookingsInbox.scopePills")
    }

    private func scopePill(_ scope: BookingScopeFilter) -> some View {
        let isActive = scope == viewModel.activeScopeKey
        let color = scopeColor(scope)
        return HStack(spacing: Spacing.s2 - 2) {
            if scope != .all {
                Circle()
                    .fill(isActive ? Theme.Color.appTextInverse.opacity(0.9) : color)
                    .frame(width: 7, height: 7)
            }
            Text(scope.label)
                .font(.system(size: 12, weight: isActive ? .bold : .semibold))
                .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s3 + 1)
        .frame(height: 31)
        .background {
            if isActive {
                Capsule().fill(color)
            } else {
                Capsule().fill(Theme.Color.appSurface)
                Capsule().strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            }
        }
        // Inbox is scoped to one owner per route; the non-active pills render for
        // visual parity but can't re-scope without an owner directory (deferred).
        .allowsHitTesting(false)
        .accessibilityLabel("Scope \(scope.label)")
        .accessibilityAddTraits(isActive ? [.isSelected] : [])
    }

    /// Identity colour for a scope pill. "All" uses the neutral product sky; the
    /// pillars use their identity accent.
    private func scopeColor(_ scope: BookingScopeFilter) -> Color {
        switch scope {
        case .all, .personal: Theme.Color.personal
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }

    // MARK: - Segmented tabs

    private var segmentedTabs: some View {
        HStack(spacing: 2) {
            ForEach(BookingStatusFilter.allCases, id: \.self) { tab in
                segmentButton(tab)
            }
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    private func segmentButton(_ tab: BookingStatusFilter) -> some View {
        let isOn = viewModel.selectedTab == tab
        return Button {
            Task { await viewModel.selectTab(tab) }
        } label: {
            HStack(spacing: Spacing.s1) {
                Text(tab.title)
                    .font(.system(size: 12.5, weight: isOn ? .bold : .semibold))
                    .foregroundStyle(isOn ? viewModel.accent : Theme.Color.appTextMuted)
                if tab == .pending, viewModel.pendingCount > 0 {
                    Text("\(viewModel.pendingCount)")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, 4)
                        .frame(minWidth: 15, minHeight: 15)
                        .background(Theme.Color.warning)
                        .clipShape(Capsule())
                }
            }
            .frame(maxWidth: .infinity, minHeight: 32)
            .background {
                if isOn {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurface)
                        .pantopusShadow(.sm)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab == .pending ? "Pending approval, \(viewModel.pendingCount)" : tab.title)
        .accessibilityAddTraits(viewModel.selectedTab == tab ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("scheduling.bookingsInbox.tab.\(tab.rawValue)")
    }

    // MARK: - Search

    private func searchField(_ text: Binding<String>) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 15, color: Theme.Color.appTextMuted)
            TextField("Search by name", text: text)
                .font(.system(size: 14))
                .textInputAutocapitalization(.never)
                .submitLabel(.search)
                .onSubmit { Task { await viewModel.submitSearch() } }
                .accessibilityIdentifier("scheduling.bookingsInbox.search")
            if !text.wrappedValue.isEmpty {
                Button {
                    text.wrappedValue = ""
                    Task { await viewModel.submitSearch() }
                } label: {
                    Icon(.x, size: 14, color: Theme.Color.appTextMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 38)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    private func actionBanner(_ message: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 15, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button { viewModel.actionError = nil } label: {
                Icon(.x, size: 13, color: Theme.Color.error)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .loading:
            loadingList
        case let .error(message):
            errorView(message)
        case .ready:
            if viewModel.isEmpty {
                emptyView
            } else {
                loadedList
            }
        }
    }
}

// MARK: - Content & states

extension BookingsInboxView {
    private var loadedList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s4) {
                ForEach(viewModel.sections) { section in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        sectionHeader(section)
                        ForEach(section.bookings, id: \.id) { booking in
                            row(booking)
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, 96)
        }
        .refreshable { await viewModel.refresh() }
        .overlay(alignment: .bottomTrailing) { fab }
    }

    private func sectionHeader(_ section: BookingSection) -> some View {
        HStack(spacing: Spacing.s2) {
            Text(section.title)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextMuted)
            if section.showsApprovalDot {
                Circle().fill(viewModel.accent).frame(width: 6, height: 6)
            }
        }
        .padding(.top, Spacing.s2)
    }

    private func row(_ booking: BookingDTO) -> some View {
        let isPending = SchedulingPillStatus(backend: booking.status) == .pending
        return BookingRowView(
            booking: booking,
            eventName: viewModel.eventName(for: booking),
            showQuickActions: isPending,
            onTap: { viewModel.openDetail(booking) },
            onApprove: { Task { await viewModel.approve(booking) } },
            onDecline: { viewModel.presentDecline(booking) },
            actions: viewModel.menuActions(for: booking)
        )
    }

    private var fab: some View {
        Button { viewModel.shareBookingLink() } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.link, size: 17, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                Text("Share booking link")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(height: 46)
            // Design (bookings-inbox-frames.jsx:222): FAB background is fixed
            // PRIMARY (0284c7) regardless of the active owner pillar — not
            // accent-polymorphic. Use the stable operational token so a
            // Home/Business host's FAB stays primary blue, not green/violet.
            .background(SchedulingIdentityTheme.operationalPrimary)
            .clipShape(Capsule())
            .pantopusShadow(.primary)
        }
        .buttonStyle(.plain)
        .padding(.trailing, Spacing.s4)
        .padding(.bottom, Spacing.s5)
        .accessibilityIdentifier("scheduling.bookingsInbox.share")
    }

    // MARK: - States

    private var loadingList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(width: 72, height: 11).padding(.top, Spacing.s3)
                ForEach(0..<2, id: \.self) { _ in BookingRowSkeleton() }
                Shimmer(width: 90, height: 11)
                ForEach(0..<2, id: \.self) { _ in BookingRowSkeleton() }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, 96)
        }
        .accessibilityLabel("Loading bookings")
    }

    private var emptyView: some View {
        EmptyState(
            icon: emptyIcon,
            headline: emptyHeadline,
            subcopy: emptySubcopy,
            cta: emptyCTA,
            tint: viewModel.owner.theme.accentBg,
            accent: viewModel.accent
        )
    }

    private func errorView(_ message: String) -> some View {
        EmptyState(
            icon: .cloudOff,
            headline: "Couldn't load bookings",
            subcopy: message,
            cta: .init(title: "Try again") { await viewModel.refresh() },
            tint: Theme.Color.errorBg,
            accent: Theme.Color.error
        )
    }

    private var emptyIcon: PantopusIcon {
        switch viewModel.selectedTab {
        case .upcoming: .calendarClock
        case .pending: .checkCircle
        case .past: .history
        case .cancelled: .circleSlash
        }
    }

    private var emptyHeadline: String {
        switch viewModel.selectedTab {
        case .upcoming: "No bookings yet"
        case .pending: "You're all caught up"
        case .past: "Nothing in your history yet"
        case .cancelled: "No cancellations"
        }
    }

    private var emptySubcopy: String {
        switch viewModel.selectedTab {
        case .upcoming: "When neighbors book time with you, they show up here."
        case .pending: "No requests are waiting on your approval."
        case .past: "Completed and past bookings will collect here once you've met with someone."
        case .cancelled: "Cancelled and declined bookings show up here."
        }
    }

    private var emptyCTA: EmptyState.CTA? {
        guard viewModel.selectedTab == .upcoming else { return nil }
        return .init(title: "Share your booking link") {
            await MainActor.run { viewModel.shareBookingLink() }
        }
    }
}

/// A shimmer placeholder mirroring a booking row's geometry.
struct BookingRowSkeleton: View {
    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 7) {
                Shimmer(width: 120, height: 10)
                Shimmer(width: 150, height: 9)
                Shimmer(width: 80, height: 8)
            }
            Spacer()
            Shimmer(width: 54, height: 16, cornerRadius: Radii.pill)
        }
        .padding(Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

#if DEBUG
#Preview("Upcoming") {
    NavigationStack { BookingsInboxView(viewModel: .previewLoaded()) }
}

#Preview("Pending") {
    NavigationStack { BookingsInboxView(viewModel: .previewLoaded(tab: .pending)) }
}

#Preview("Empty") {
    NavigationStack { BookingsInboxView(viewModel: .previewEmpty()) }
}
#endif
