//
//  HubView.swift
//  Pantopus
//
//  Designed hub screen. Wires the 11 sections to `HubViewModel` state.
//

// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

/// Designed hub screen.
struct HubView: View {
    @State private var viewModel: HubViewModel
    private let onNavigate: @MainActor (HubNavigationIntent) -> Void

    init(
        viewModel: HubViewModel = HubViewModel(),
        onNavigate: @escaping @MainActor (HubNavigationIntent) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onNavigate = onNavigate
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .skeleton:
                ScrollView { HubSkeleton() }
                    .background(Theme.Color.appBg)
            case let .firstRun(content):
                firstRunLayout(content)
            case let .populated(content):
                populatedLayout(content)
            case let .error(message):
                ErrorView(message: message) { Task { await viewModel.refresh() } }
            }
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityIdentifier("hubScreen")
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        .onAppear { Analytics.track(.screenHubViewed) }
    }

    private func populatedLayout(_ content: HubState.PopulatedContent) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s4, pinnedViews: [.sectionHeaders]) {
                HubTopBar(
                    content: content.topBar,
                    onAvatarTap: { onNavigate(.openProfile) },
                    onBellTap: { onNavigate(.openNotifications) },
                    onAudienceTap: content.topBar.audienceUnreadCount > 0
                        ? { onNavigate(.openAudienceNotifications) }
                        : nil
                ) { onNavigate(.openMenu) }
                HubActionStrip(chips: content.actionChips) { onNavigate(.action($0)) }
                if let density = content.neighborDensity {
                    HubNeighborDensitySection(content: density) {
                        Task { await viewModel.dismissDensityMilestone() }
                    }
                }
                // Rendered unconditionally: the empty set is the design's
                // "All caught up" pill, not a hidden section (RN
                // `HubActionStrip.tsx:33-38`).
                HubStatusStrip(
                    items: content.statusItems,
                    onTap: { onNavigate(.statusItem($0)) },
                    onDismiss: { viewModel.dismissStatusItem(id: $0) }
                )
                if let banner = content.setupBanner {
                    HubSetupBanner(
                        content: banner,
                        onStart: { onNavigate(.startVerification) },
                        onDismiss: { viewModel.dismissSetupBanner() }
                    )
                }
                if let today = content.today {
                    HubTodayCard(summary: today) { onNavigate(.openToday) }
                }
                HubPillarGrid(tiles: content.pillars) { onNavigate(.pillar($0)) }
                // Rendered unconditionally: the filter tabs must stay
                // reachable when a filter comes back with zero rows (the
                // rail renders its own empty row instead).
                HubDiscoveryRail(
                    items: content.discovery,
                    onTap: { onNavigate(.openDiscovery($0)) },
                    activeFilter: viewModel.discoveryFilter,
                    onFilterChange: { filter in
                        Task { await viewModel.selectDiscoveryFilter(filter) }
                    },
                    isLoading: viewModel.discoveryLoading,
                    onSeeAll: { onNavigate(.openDiscoverHub) },
                    onExploreMap: { onNavigate(.openExploreMap) },
                    onFindBusinesses: { onNavigate(.openFindBusinesses) }
                )
                if !content.jumpBackIn.isEmpty {
                    HubJumpBackIn(items: content.jumpBackIn) { onNavigate(.jumpBackIn($0)) }
                }
                if !content.activity.isEmpty {
                    HubRecentActivity(entries: content.activity) {
                        onNavigate(.openRecentActivity)
                    }
                }
                Spacer(minLength: Spacing.s10)
            }
        }
    }

    private func firstRunLayout(_ content: HubState.FirstRunContent) -> some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Spacing.s4) {
                    HubTopBar(
                        content: TopBarContent(
                            greeting: content.greeting,
                            name: content.name,
                            avatarInitials: content.avatarInitials,
                            identity: content.identity,
                            ringProgress: content.ringProgress,
                            unreadCount: 0
                        ),
                        onAvatarTap: { onNavigate(.openProfile) },
                        onBellTap: { onNavigate(.openNotifications) },
                        onMenuTap: { onNavigate(.openMenu) }
                    )
                    HubFirstRunHero(content: content) { onNavigate(.startVerification) }
                    HubPillarGrid(tiles: content.pillars) { onNavigate(.pillar($0)) }
                    HubDiscoveryRail(
                        items: content.discovery,
                        onTap: { onNavigate(.openDiscovery($0)) },
                        activeFilter: viewModel.discoveryFilter,
                        onFilterChange: { filter in
                            Task { await viewModel.selectDiscoveryFilter(filter) }
                        },
                        isLoading: viewModel.discoveryLoading,
                        onSeeAll: { onNavigate(.openDiscoverHub) },
                        onExploreMap: { onNavigate(.openExploreMap) },
                        onFindBusinesses: { onNavigate(.openFindBusinesses) }
                    )
                    // Bottom padding leaves room for the floating progress
                    // card pinned below by the ZStack alignment.
                    Spacer(minLength: 96)
                }
            }
            HubFloatingProgress(
                fraction: content.profileCompleteness,
                stepsDone: content.stepsDone,
                stepsTotal: content.stepsTotal
            ) { onNavigate(.startVerification) }
                .padding(.bottom, Spacing.s6)
        }
    }
}

/// Outbound navigation intents raised by the hub.
enum HubNavigationIntent {
    case openNotifications
    /// S5 — megaphone shortcut straight into the Beacon (audience)
    /// notification zone. Host pushes
    /// `HubRoute.notificationsZone(context: "audience")`.
    case openAudienceNotifications
    case openMenu
    case openProfile
    case action(ActionChipContent.Kind)
    /// Tap on a server-driven "Needs attention" pill. The host resolves
    /// `item.route` the same way it resolves a jump-back-in route.
    case statusItem(StatusStripItem)
    case startVerification
    case pillar(PillarTile.Pillar)
    case openDiscovery(DiscoveryCardContent)
    case openDiscoverHub
    /// "Explore Map" header link on the Discover section — RN
    /// `src/app/(tabs)/index.tsx:505`.
    case openExploreMap
    /// "Find Businesses" header link on the Discover section — RN
    /// `src/app/(tabs)/index.tsx:506`.
    case openFindBusinesses
    case jumpBackIn(JumpBackItem)
    /// Today-card tap — currently a no-op host-side (the design's tap
    /// destination is "home calendar" but P11 hasn't shipped the native
    /// route yet). Wired in P11.
    case openToday
    /// "See all" on the Recent activity section — pushes the standalone
    /// Recent activity list (`HubRoute.recentActivity`).
    case openRecentActivity
}

private struct ErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load your hub")
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
    }
}

#Preview("Skeleton") {
    let vm = HubViewModel()
    HubView(viewModel: vm)
}

#Preview("First-run fixture") {
    let vm = HubViewModel()
    return HubView(viewModel: vm)
}
