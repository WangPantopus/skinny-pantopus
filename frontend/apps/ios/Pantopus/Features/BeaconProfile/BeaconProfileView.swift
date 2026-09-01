//
//  BeaconProfileView.swift
//  Pantopus
//
//  A21.1 — the public Beacon profile screen. Reuses the shared
//  `PublicProfileChrome` primitives (banner + `BeaconIdentityBlock` +
//  broadcast cards + empty state) and adds the persona-specific tab strip
//  (Broadcasts · About · Tiers), the visitor follow handshake, and the
//  owner affordances (analytics strip, broadcast composer CTA, Edit).
//
//  Two roles share the screen: `.owner` ("My Beacon") and
//  `.visitor(handle)`. See `BeaconProfileViewModel`.
//

import SwiftUI

@MainActor
public struct BeaconProfileView: View {
    @State private var viewModel: BeaconProfileViewModel
    private let onBack: @MainActor @Sendable () -> Void
    private let onEditPersona: @MainActor @Sendable (String) -> Void
    private let onComposeBroadcast: @MainActor @Sendable (String) -> Void
    private let onOpenInsights: @MainActor @Sendable () -> Void
    private let onCreateBeacon: @MainActor @Sendable () -> Void
    private let onOpenLink: @MainActor @Sendable (URL) -> Void

    public init(
        mode: BeaconProfileMode,
        onBack: @escaping @MainActor @Sendable () -> Void,
        onEditPersona: @escaping @MainActor @Sendable (String) -> Void = { _ in },
        onComposeBroadcast: @escaping @MainActor @Sendable (String) -> Void = { _ in },
        onOpenInsights: @escaping @MainActor @Sendable () -> Void = {},
        onCreateBeacon: @escaping @MainActor @Sendable () -> Void = {},
        onOpenLink: @escaping @MainActor @Sendable (URL) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: BeaconProfileViewModel(mode: mode))
        self.onBack = onBack
        self.onEditPersona = onEditPersona
        self.onComposeBroadcast = onComposeBroadcast
        self.onOpenInsights = onOpenInsights
        self.onCreateBeacon = onCreateBeacon
        self.onOpenLink = onOpenLink
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            content
            if let toast = viewModel.toastMessage {
                ToastView(message: ToastMessage(text: toast, kind: .neutral))
                    .padding(.bottom, Spacing.s10)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.toastMessage = nil
                    }
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .sheet(
            isPresented: Binding(
                get: { viewModel.showFollowHandshake },
                set: { viewModel.showFollowHandshake = $0 }
            ),
            onDismiss: {
                viewModel.clearHandshakeTier()
                Task { await viewModel.refresh() }
            },
            content: {
                PrivacyHandshakeWizardView(
                    viewModel: PrivacyHandshakeViewModel(
                        personaHandle: viewModel.loadedHandle,
                        preselectedTierRank: viewModel.handshakePreselectedTierRank
                    ) {
                        Task { @MainActor in
                            viewModel.showFollowHandshake = false
                            viewModel.clearHandshakeTier()
                        }
                    }
                )
            }
        )
        .accessibilityIdentifier("beaconProfile")
        .task { await viewModel.load() }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            BeaconProfileLoadingLayout(onBack: onBack)
        case let .loaded(payload):
            loadedLayout(payload)
        case .empty:
            emptyOwnerLayout
        case let .error(message):
            BeaconProfileErrorLayout(message: message, onBack: onBack) {
                Task { await viewModel.refresh() }
            }
        }
    }

    // MARK: - Loaded

    private func loadedLayout(_ payload: BeaconProfileContent) -> some View {
        ContentDetailShell(
            title: nil,
            onBack: onBack,
            topBarAction: ContentDetailTopBarAction(
                icon: payload.isOwner ? .slidersHorizontal : .moreHorizontal,
                accessibilityLabel: payload.isOwner ? "Edit Beacon" : "More"
            ) {
                Task { @MainActor in
                    if payload.isOwner {
                        onEditPersona(payload.personaId)
                    } else if let url = URL(string: payload.shareURL) {
                        onOpenLink(url)
                    }
                }
            },
            header: {
                VStack(spacing: Spacing.s0) {
                    PublicProfileBanner(kind: .persona)
                    BeaconIdentityBlock(
                        identity: .personal,
                        name: payload.displayName,
                        handle: payload.handle,
                        tierLabel: payload.header.tierLabel,
                        isVerifiedNeighbor: false,
                        locality: nil,
                        bio: payload.bio,
                        isVerified: payload.header.isVerified,
                        avatarURL: payload.header.avatarURL,
                        stats: payload.stats
                    ) {
                        identityActions(for: payload)
                    }
                }
                .accessibilityIdentifier("beaconProfilePersonaHeader")
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    if payload.isOwner {
                        BeaconOwnerAnalyticsStrip(followerStat: payload.stats.first?.value ?? "—") {
                            onOpenInsights()
                        }
                        .padding(.horizontal, Spacing.s4)

                        if payload.broadcastEnabled {
                            BeaconComposeCTA(audienceLabel: payload.audienceLabel) {
                                onComposeBroadcast(payload.personaId)
                            }
                            .padding(.horizontal, Spacing.s4)
                        }
                    }

                    BeaconProfileTabStrip(
                        tabs: tabs(for: payload),
                        selected: viewModel.selectedTab
                    ) { viewModel.selectedTab = $0 }
                        .padding(.horizontal, Spacing.s4)

                    tabContent(payload)
                }
                .padding(.top, Spacing.s4)
            }
        )
    }

    @ViewBuilder
    private func tabContent(_ payload: BeaconProfileContent) -> some View {
        switch viewModel.selectedTab {
        case .broadcasts:
            if payload.posts.isEmpty && payload.isOwner {
                BeaconOwnerEmptyBroadcasts(
                    broadcastEnabled: payload.broadcastEnabled
                ) { onComposeBroadcast(payload.personaId) }
                    .padding(.horizontal, Spacing.s4)
            } else {
                PublicProfilePostsFeed(
                    kind: .persona,
                    posts: payload.posts,
                    onUnlock: { post in viewModel.unlockBroadcast(tierRank: post.targetTierRank) },
                    onEmptyCTA: { if !payload.isOwner { viewModel.follow() } }
                )
            }
        case .about:
            BeaconAboutSection(payload: payload, onOpenLink: onOpenLink)
                .padding(.horizontal, Spacing.s4)
        case .tiers:
            BeaconTiersSection(tiers: payload.tiers, isOwner: payload.isOwner)
                .padding(.horizontal, Spacing.s4)
        }
    }

    private func tabs(for payload: BeaconProfileContent) -> [BeaconProfileTabStrip.Tab] {
        var tabs: [BeaconProfileTabStrip.Tab] = [
            .init(tab: .broadcasts, label: "Broadcasts", count: payload.posts.isEmpty ? nil : payload.posts.count),
            .init(tab: .about, label: "About", count: nil)
        ]
        if !payload.tiers.isEmpty {
            tabs.append(.init(tab: .tiers, label: "Tiers", count: payload.tiers.count))
        }
        return tabs
    }

    // MARK: - Header actions

    @ViewBuilder
    private func identityActions(for payload: BeaconProfileContent) -> some View {
        if payload.isOwner {
            BeaconHeaderGhostButton(icon: .barChart3, accessibilityLabel: "Insights") {
                onOpenInsights()
            }
            BeaconHeaderGhostButton(title: "Edit", icon: .pencil, accessibilityLabel: "Edit Beacon") {
                onEditPersona(payload.personaId)
            }
        } else {
            BeaconHeaderGhostButton(icon: .share, accessibilityLabel: "Share Beacon") {
                shareBeacon(payload)
            }
            switch viewModel.followStatus {
            case .none:
                BeaconHeaderPrimaryButton(title: "Follow", icon: .plus) {
                    viewModel.follow()
                }
            case .pending:
                BeaconHeaderPrimaryButton(title: "Requested", icon: .check, isProminent: false) {}
            case .active:
                BeaconHeaderPrimaryButton(title: "Following", icon: .check, isProminent: false) {
                    Task { await viewModel.unfollow() }
                }
            }
        }
    }

    private func shareBeacon(_ payload: BeaconProfileContent) {
        guard let url = URL(string: payload.shareURL) else { return }
        onOpenLink(url)
    }

    // MARK: - Empty (owner, no Beacon yet)

    private var emptyOwnerLayout: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: nil, onBack: onBack, action: nil)
            EmptyState(
                icon: .radio,
                headline: "Your signal to the world",
                subcopy: "A public page for the people you address one-to-many — "
                    + "followers, students, clients, customers, members.",
                cta: EmptyState.CTA(title: "Create your Beacon") {
                    await MainActor.run { onCreateBeacon() }
                },
                tint: Theme.Color.primary50,
                accent: Theme.Color.primary600
            )
            .frame(maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("beaconProfileEmptyOwner")
    }
}

// MARK: - Loading / error layouts

private struct BeaconProfileLoadingLayout: View {
    let onBack: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: nil, onBack: onBack, action: nil)
            VStack(spacing: Spacing.s4) {
                Shimmer(height: 120, cornerRadius: Radii.lg)
                Shimmer(width: 72, height: 72, cornerRadius: 36)
                    .padding(.top, -36)
                Shimmer(width: 160, height: 22, cornerRadius: Radii.sm)
                Shimmer(width: 220, height: 12, cornerRadius: Radii.sm)
                Shimmer(height: 100, cornerRadius: Radii.lg)
                    .padding(.horizontal, Spacing.s4)
            }
            .padding(.horizontal, Spacing.s4)
            Spacer()
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("beaconProfileLoading")
    }
}

private struct BeaconProfileErrorLayout: View {
    let message: String
    let onBack: @MainActor () -> Void
    let onRetry: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: nil, onBack: onBack, action: nil)
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load this Beacon",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await MainActor.run { onRetry() } }
            )
            .frame(maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("beaconProfileError")
    }
}

#Preview("Owner") {
    BeaconProfileView(mode: .owner) {}
}

#Preview("Visitor") {
    BeaconProfileView(mode: .visitor(handle: "mariak")) {}
}
