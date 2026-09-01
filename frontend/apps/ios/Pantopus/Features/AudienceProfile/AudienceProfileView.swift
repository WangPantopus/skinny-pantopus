//
//  AudienceProfileView.swift
//  Pantopus
//
//  T3.3 Public Profile management — bespoke tabbed dashboard. Top
//  header carries the persona display name, handle, and follower
//  count + new-this-week stat. Three tabs: Updates (composer +
//  recent updates), Followers (analytics + tier chips + followers),
//  Threads (DM inbox).
//

// swiftlint:disable file_length type_body_length

import SwiftUI

public struct AudienceProfileView: View {
    @State private var viewModel: AudienceProfileViewModel
    private let onBack: @MainActor () -> Void
    private let onOpenFollower: @MainActor (FollowerRowContent) -> Void
    private let onOpenThread: @MainActor (ThreadRowContent) -> Void
    private let onOpenBroadcast: @MainActor (UpdateCardContent, [TierBreakdownContent.TierSegment]) -> Void
    private let onOpenSetup: @MainActor () -> Void
    private let onOpenCreatorInbox: @MainActor () -> Void
    /// A.10.8 — reserved entry point into the fan-side membership detail.
    /// Nothing on this owner-facing hub can supply a real membership
    /// today, so no row calls it — the host keeps passing it so the route
    /// stays wired.
    /// A.7 (A22.2) — Push the full-screen Compose Broadcast surface. The
    /// inline composer below stays a lightweight quick-post; this is the
    /// canonical broadcast composer.
    private let onComposeBroadcast: @MainActor (String) -> Void
    /// A13.12 — top-bar "Edit persona" action into the creator-side editor.
    private let onOpenEditPersona: @MainActor () -> Void
    /// A03.2 — "Beacon Updates" entry into the followed-beacons feed
    /// (`surface=personas`). Distinct from this surface, which manages the
    /// persona the creator *owns*.
    private let onOpenBeacons: @MainActor () -> Void
    /// §1A① — entry into "Following" (the list of Beacons the user
    /// follows). Optional so only the host that wires it renders the row.
    private let onOpenFollowing: (@MainActor () -> Void)?
    /// A22.2 — "Your audience" creator member management (pending requests
    /// + tier-grouped members). Sibling surface to this broadcast hub.
    private let onOpenMembers: @MainActor () -> Void

    init(
        viewModel: AudienceProfileViewModel = AudienceProfileViewModel(),
        onBack: @escaping @MainActor () -> Void = {},
        onOpenFollower: @escaping @MainActor (FollowerRowContent) -> Void = { _ in },
        onOpenThread: @escaping @MainActor (ThreadRowContent) -> Void = { _ in },
        onOpenBroadcast: @escaping @MainActor (UpdateCardContent, [TierBreakdownContent.TierSegment]) -> Void = { _, _ in },
        onOpenSetup: @escaping @MainActor () -> Void = {},
        onOpenCreatorInbox: @escaping @MainActor () -> Void = {},
        onComposeBroadcast: @escaping @MainActor (String) -> Void = { _ in },
        onOpenEditPersona: @escaping @MainActor () -> Void = {},
        onOpenFollowing: (@MainActor () -> Void)? = nil,
        onOpenMembers: @escaping @MainActor () -> Void = {},
        onOpenBeacons: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onOpenFollower = onOpenFollower
        self.onOpenThread = onOpenThread
        self.onOpenBroadcast = onOpenBroadcast
        self.onOpenSetup = onOpenSetup
        self.onOpenCreatorInbox = onOpenCreatorInbox
        self.onComposeBroadcast = onComposeBroadcast
        self.onOpenEditPersona = onOpenEditPersona
        self.onOpenBeacons = onOpenBeacons
        self.onOpenFollowing = onOpenFollowing
        self.onOpenMembers = onOpenMembers
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .accessibilityIdentifier("audienceProfile")
    }

    private var topBar: some View {
        HStack {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("audienceProfileBackButton")
            Spacer()
            Text(headerTitle)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button(action: onOpenEditPersona) {
                Icon(.pencil, size: 20, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Edit persona")
            .accessibilityIdentifier("audienceProfileEditPersonaButton")
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private var headerTitle: String {
        if case let .loaded(loaded) = viewModel.state {
            return loaded.header.displayName
        }
        return "Public Profile"
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading: loadingFrame
        case let .empty(message): emptyFrame(message: message)
        case let .loaded(loaded): loadedFrame(loaded)
        case let .error(message): errorFrame(message: message)
        }
    }

    // MARK: - States

    private var loadingFrame: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                Shimmer(height: 90, cornerRadius: Radii.xl)
                Shimmer(height: 44, cornerRadius: 22)
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 88, cornerRadius: 14)
                }
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("audienceProfileLoading")
    }

    private func emptyFrame(message: String) -> some View {
        ScrollView {
            VStack(spacing: Spacing.s4) {
                VStack(spacing: 14) {
                    ZStack {
                        Circle()
                            .fill(Theme.Color.primary50)
                            .frame(width: 72, height: 72)
                        Circle()
                            .stroke(Theme.Color.primary100, lineWidth: 1)
                            .frame(width: 72, height: 72)
                        Icon(.radioTower, size: 30, color: Theme.Color.primary600)
                    }
                    VStack(spacing: 6) {
                        Text("Your audience starts here")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                            .multilineTextAlignment(.center)
                            .accessibilityAddTraits(.isHeader)
                        Text(message)
                            .font(.system(size: 13.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .multilineTextAlignment(.center)
                            .lineSpacing(2)
                    }
                    VStack(spacing: 10) {
                        Button {
                            onOpenSetup()
                        } label: {
                            HStack(spacing: Spacing.s2) {
                                Icon(.dollarSign, size: 15, color: Theme.Color.appTextInverse)
                                Text("Set up payments")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(Theme.Color.appTextInverse)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 46)
                            .background(Theme.Color.primary600)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Set up payments")
                        .accessibilityIdentifier("audienceProfileSetupButton")

                        Button {
                            onComposeBroadcast(viewModel.personaId ?? "")
                        } label: {
                            HStack(spacing: Spacing.s2) {
                                Icon(.share, size: 15, color: Theme.Color.primary700)
                                Text("Tell people you're here")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(Theme.Color.primary700)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 46)
                            .background(Theme.Color.appSurface)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                    .stroke(Theme.Color.primary100, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Tell people you're here")
                        .accessibilityIdentifier("audienceProfileTellPeopleButton")
                    }
                }
                .padding(Spacing.s5)
                .frame(maxWidth: .infinity)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))

                onboardingCard
                Spacer(minLength: Spacing.s6)
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("audienceProfileEmpty")
    }

    private var onboardingCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Start in three steps")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            onboardingStep(number: 1, title: "Set up payments", subtitle: "Turn on tiers so supporters can join.")
            onboardingStep(number: 2, title: "Tell people you're here", subtitle: "Share your profile with neighbors and customers.")
            onboardingStep(number: 3, title: "Send your first broadcast", subtitle: "Post one useful update people can react to.")
        }
        .padding(14)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("audienceProfileOnboardingCard")
    }

    private func onboardingStep(number: Int, title: String, subtitle: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(number)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.primary700)
                .frame(width: 24, height: 24)
                .background(Theme.Color.appSurface)
                .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(subtitle)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(2)
            }
            Spacer(minLength: Spacing.s0)
        }
        .accessibilityElement(children: .combine)
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load Public Profile")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.load() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("audienceProfileRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .accessibilityIdentifier("audienceProfileError")
    }

    private func loadedFrame(_ loaded: AudienceProfileLoaded) -> some View {
        VStack(spacing: Spacing.s0) {
            statusLine(loaded.header)
            tabStrip
            tabContent(loaded)
            beaconsFooter
            followingFooter
            // The "You're a member of <persona>, <tier> tier" footer is
            // gone: it rendered `MembershipSampleData.audienceFooter`, a
            // fixture persona ("Lara Chen · Silver"), to every viewer of
            // their own beacon hub. `/api/personas/me` carries no
            // viewer-membership payload, so there is nothing real to put
            // here — see the report for the endpoint gap.
        }
        .accessibilityIdentifier("audienceProfileContent")
    }

    /// A03.2 — entry into the Beacon Updates feed (broadcasts from beacons
    /// the user follows). Mirrors `followingFooter`'s row recipe.
    private var beaconsFooter: some View {
        Button(action: onOpenBeacons) {
            HStack(spacing: Spacing.s2) {
                Icon(.rss, size: 16, color: Theme.Color.primary600)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Beacon Updates")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Broadcasts from beacons you follow")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Text("Open")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
                Icon(.chevronRight, size: 14, color: Theme.Color.primary600)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 10)
            .frame(minHeight: 44)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .top) {
                Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Beacon Updates. Broadcasts from beacons you follow. Open.")
        .accessibilityIdentifier("audienceProfileBeaconsEntry")
    }

    /// §1A① — entry into "Following", the list of Beacons the user
    /// follows. Mirrors `beaconsFooter`'s row recipe; only rendered when
    /// the host wires `onOpenFollowing`.
    @ViewBuilder private var followingFooter: some View {
        if let onOpenFollowing {
            Button(action: onOpenFollowing) {
                HStack(spacing: Spacing.s2) {
                    Icon(.users, size: 16, color: Theme.Color.primary600)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Following")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        Text("Beacons you follow")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer(minLength: Spacing.s0)
                    Text("Open")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary700)
                    Icon(.chevronRight, size: 14, color: Theme.Color.primary600)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, 10)
                .frame(minHeight: 44)
                .background(Theme.Color.appSurface)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                }
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Following. Beacons you follow. Open.")
            .accessibilityIdentifier("audienceProfileFollowingEntry")
        }
    }

    private func statusLine(_ header: AudienceHeaderContent) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.radioTower, size: 15, color: Theme.Color.primary600)
                .frame(width: 18, height: 18)
            Text("\(Self.formattedCount(header.followerCount)) followers")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextStrong)
            if header.newThisWeek > 0 {
                Text("+\(header.newThisWeek) this week")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.success)
            } else {
                Text("Invite to grow")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            Text("View")
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
            Icon(.chevronRight, size: 12, color: Theme.Color.primary600)
        }
        .padding(.horizontal, Spacing.s4)
        .frame(height: 38)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("audienceProfileHeader")
    }

    private var tabStrip: some View {
        HStack(spacing: 22) {
            ForEach(AudienceProfileTab.allCases, id: \.self) { tab in
                tabButton(tab)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private func tabButton(_ tab: AudienceProfileTab) -> some View {
        let isActive = viewModel.activeTab == tab
        return Button {
            viewModel.selectTab(tab)
        } label: {
            VStack(spacing: Spacing.s0) {
                Text(tab.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(isActive ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                    .padding(.top, 10)
                    .padding(.bottom, Spacing.s2)
                Rectangle()
                    .fill(isActive ? Theme.Color.primary600 : SwiftUI.Color.clear)
                    .frame(height: 2)
            }
            .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("audienceProfileTab_\(tab.rawValue)")
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    @ViewBuilder
    private func tabContent(_ loaded: AudienceProfileLoaded) -> some View {
        switch viewModel.activeTab {
        case .updates: updatesTab(loaded)
        case .followers: followersTab(loaded)
        case .threads: threadsTab(loaded)
        }
    }

    // MARK: - Updates tab

    private func updatesTab(_ loaded: AudienceProfileLoaded) -> some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                followerStackCard(header: loaded.header, breakdown: loaded.tierBreakdown, followers: loaded.followers)
                composerCard(channelId: loaded.channelId)
                sectionHeader(title: "Recent broadcasts", action: loaded.updates.isEmpty ? nil : "See all")
                if loaded.updates.isEmpty {
                    emptyUpdatesState
                } else {
                    ForEach(loaded.updates) { card in
                        updateCard(card, tierSegments: loaded.tierBreakdown.segments)
                    }
                }
                Spacer(minLength: Spacing.s6)
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("audienceProfileUpdatesList")
    }

    private func followerStackCard(
        header: AudienceHeaderContent,
        breakdown: TierBreakdownContent,
        followers: [FollowerRowContent]
    ) -> some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 9) {
                Text("Follower stack")
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .kerning(0.8)
                    .textCase(.uppercase)
                HStack(spacing: Spacing.s0) {
                    ForEach(Array(followers.prefix(4).enumerated()), id: \.element.id) { index, follower in
                        tierAvatar(follower)
                            .offset(x: CGFloat(index) * -8)
                            .zIndex(Double(10 - index))
                    }
                    if followers.count > 4 {
                        Text("+\(followers.count - 4)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                            .frame(width: 36, height: 36)
                            .background(Theme.Color.appSurfaceSunken)
                            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                            .clipShape(Circle())
                            .offset(x: -32)
                    }
                }
                .frame(height: 38)
                .padding(.leading, followers.isEmpty ? 0 : CGFloat(max(followers.prefix(4).count - 1, 0)) * 8)
                HStack(spacing: 10) {
                    ForEach(breakdown.segments.prefix(3), id: \.id) { segment in
                        HStack(spacing: Spacing.s1) {
                            Circle().fill(Self.tierColor(rank: segment.rank)).frame(width: 7, height: 7)
                            Text("\(segment.name) \(segment.count)")
                                .font(.system(size: 10.5, weight: .medium))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
            Spacer(minLength: Spacing.s0)
            VStack(alignment: .trailing, spacing: 5) {
                Text(Self.formattedCount(header.followerCount))
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(header.newThisWeek > 0 ? "+\(header.newThisWeek) / 7 days" : "Past 7 days")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(header.newThisWeek > 0 ? Theme.Color.success : Theme.Color.appTextSecondary)
                SparklineShape(points: Self.growthSamples(header))
                    .stroke(Theme.Color.primary600, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    .frame(width: 88, height: 28)
                    .background(Theme.Color.primary50.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                    .accessibilityHidden(true)
            }
        }
        .padding(14)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Follower stack, \(header.followerCount) followers, \(header.newThisWeek) new in the past 7 days"
        )
        .accessibilityIdentifier("audienceProfileFollowerStack")
    }

    private func tierAvatar(_ follower: FollowerRowContent) -> some View {
        Text(follower.displayName.prefix(1).uppercased())
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(width: 36, height: 36)
            .background(Self.tierColor(rank: follower.tierRank))
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
            .clipShape(Circle())
            .accessibilityHidden(true)
    }

    private func sectionHeader(title: String, action: String?) -> some View {
        HStack {
            Text(title.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.8)
            Spacer(minLength: Spacing.s0)
            if let action {
                HStack(spacing: 2) {
                    Text(action)
                    Icon(.chevronRight, size: 12, color: Theme.Color.primary600)
                }
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
            }
        }
        .padding(.top, 2)
        .accessibilityIdentifier("audienceProfileBroadcastsHeader")
    }

    private func composerCard(channelId: String?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            fullComposerEntry
            HStack(spacing: 6) {
                Text("Posting as")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .kerning(0.6)
                Text(headerTitle)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer()
                visibilityPicker
            }
            ZStack(alignment: .topLeading) {
                if viewModel.composer.text.isEmpty {
                    Text("Share an update with your followers")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.top, 6)
                        .padding(.leading, Spacing.s1)
                }
                TextEditor(text: Binding(
                    get: { viewModel.composer.text },
                    set: { viewModel.composer.text = $0 }
                ))
                .frame(minHeight: 80)
                .scrollContentBackground(.hidden)
                .accessibilityIdentifier("audienceProfileComposerInput")
            }
            if let error = viewModel.composer.error {
                Text(error)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
            }
            HStack {
                Spacer()
                Button {
                    Task { await viewModel.submitUpdate() }
                } label: {
                    HStack(spacing: 6) {
                        if viewModel.composer.isSubmitting {
                            ProgressView().tint(Theme.Color.appTextInverse)
                        }
                        Text("Post update")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .frame(height: 38)
                    .background(
                        viewModel.composer.canSubmit && channelId != nil
                            ? Theme.Color.primary600
                            : Theme.Color.appBorderStrong
                    )
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(!viewModel.composer.canSubmit || channelId == nil)
                .accessibilityIdentifier("audienceProfileComposerSubmit")
            }
        }
        .padding(14)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityIdentifier("audienceProfileComposer")
    }

    /// Entry to the canonical full-screen Compose Broadcast surface. The
    /// quick-post composer beneath it stays for one-tap text updates.
    private var fullComposerEntry: some View {
        Button {
            onComposeBroadcast(viewModel.personaId ?? "")
        } label: {
            HStack(spacing: 10) {
                Icon(.megaphone, size: 16, color: Theme.Color.primary600)
                    .frame(width: 34, height: 34)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Compose a broadcast")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Full editor · media · audience · scheduling")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
            .padding(10)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.primary50.opacity(0.5))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.primary100, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Compose a broadcast")
        .accessibilityHint("Opens the full broadcast composer")
        .accessibilityIdentifier("audienceProfileComposeBroadcast")
    }

    private var visibilityPicker: some View {
        Menu {
            ForEach(UpdateVisibility.allCases, id: \.self) { visibility in
                Button {
                    viewModel.composer.visibility = visibility
                    if visibility != .tierOrAbove { viewModel.composer.targetTierRank = nil }
                } label: {
                    HStack {
                        Text(visibility.title)
                        if viewModel.composer.visibility == visibility {
                            Icon(.check, size: 14, color: Theme.Color.primary600)
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: Spacing.s1) {
                Text("Visible to \(viewModel.composer.visibility.title)")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
                Icon(.chevronDown, size: 12, color: Theme.Color.primary700)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Theme.Color.primary50)
            .clipShape(Capsule())
        }
        .accessibilityIdentifier("audienceProfileVisibilityPicker")
    }

    private var emptyUpdatesState: some View {
        VStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.primary50).frame(width: 52, height: 52)
                Circle().stroke(Theme.Color.primary100, lineWidth: 1).frame(width: 52, height: 52)
                Icon(.radioTower, size: 22, color: Theme.Color.primary600)
            }
            Text("No broadcasts yet")
                .font(.system(size: 14.5, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Share an update with your audience so it appears in their Pulse and inbox.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
            Button {
                onComposeBroadcast(viewModel.personaId ?? "")
            } label: {
                HStack(spacing: 6) {
                    Icon(.pencil, size: 13, color: Theme.Color.appTextInverse)
                    Text("Compose broadcast")
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, 14)
                .frame(height: 38)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("audienceProfileEmptyBroadcastCompose")
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.vertical, 28)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    private func updateCard(
        _ card: UpdateCardContent,
        tierSegments: [TierBreakdownContent.TierSegment]
    ) -> some View {
        Button {
            onOpenBroadcast(card, tierSegments)
        } label: {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s2) {
                    Text(card.timeAgo)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text("·")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                    visibilityChip(card)
                    Spacer(minLength: Spacing.s0)
                    Icon(.moreHorizontal, size: 14, color: Theme.Color.appTextMuted)
                }
                Text(card.body)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
                    .lineLimit(3)
                HStack(spacing: 10) {
                    metricLabel(icon: .radioTower, value: Self.compactCount(card.deliveredCount))
                    metricLabel(icon: .eye, value: Self.compactCount(card.readCount))
                    metricLabel(icon: .heart, value: "\(max(0, card.readCount / 26))")
                    Spacer(minLength: Spacing.s0)
                    Icon(.chevronRight, size: 13, color: Theme.Color.appTextMuted)
                }
                .padding(.top, Spacing.s2)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Broadcast \(card.body). Delivered \(card.deliveredCount), read \(card.readCount).")
        .accessibilityHint("Opens broadcast detail")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("updateCard_\(card.id)")
    }

    private func visibilityChip(_ card: UpdateCardContent) -> some View {
        let colors = Self.visibilityColors(card)
        return HStack(spacing: 3) {
            Icon(Self.visibilityIcon(card), size: 9, color: colors.foreground)
            Text(Self.visibilityTitle(card))
                .font(.system(size: 9.5, weight: .bold))
                .foregroundStyle(colors.foreground)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(colors.background)
        .clipShape(Capsule())
    }

    private func metricLabel(icon: PantopusIcon, value: String) -> some View {
        HStack(spacing: 3) {
            Icon(icon, size: 12, color: Theme.Color.appTextSecondary)
            Text(value)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    // MARK: - Followers tab

    private func followersTab(_ loaded: AudienceProfileLoaded) -> some View {
        let visible = viewModel.visibleFollowers
        let hasQuery = !viewModel.followerSearchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                analyticsRow(loaded.analyticsCells)
                manageAudienceRow
                tierStackedBar(loaded.tierBreakdown)
                tierChipRow(loaded.tierChips)
                followerSearchField
                followerSortChipRow
                if visible.isEmpty {
                    if hasQuery {
                        emptyFollowerSearchState
                    } else {
                        emptyFollowersState
                    }
                } else {
                    VStack(spacing: Spacing.s2) {
                        ForEach(visible) { follower in
                            followerRow(follower)
                        }
                    }
                }
                Spacer(minLength: Spacing.s6)
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("audienceProfileFollowersList")
    }

    /// A22.2 entry point — pushes the "Your audience" member-management
    /// surface (pending requests + tier-grouped members).
    private var manageAudienceRow: some View {
        Button(action: onOpenMembers) {
            HStack(spacing: Spacing.s3) {
                Icon(.usersRound, size: 20, color: Theme.Color.primary600)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Your audience")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Approve requests · manage members")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("audienceProfileOpenMembers")
    }

    private var followerSearchField: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 15, color: Theme.Color.appTextMuted)
            TextField(
                "Search followers by name or handle",
                text: Binding(
                    get: { viewModel.followerSearchText },
                    set: { viewModel.followerSearchText = $0 }
                )
            )
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(Theme.Color.appText)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled(true)
            .submitLabel(.search)
            .accessibilityIdentifier("followerSearchInput")
            if !viewModel.followerSearchText.isEmpty {
                Button {
                    viewModel.followerSearchText = ""
                } label: {
                    Icon(.x, size: 14, color: Theme.Color.appTextSecondary)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
                .accessibilityIdentifier("followerSearchClear")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 40)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("followerSearchField")
    }

    private var followerSortChipRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(FollowerSort.allCases, id: \.self) { sort in
                    followerSortChip(sort)
                }
            }
        }
        .accessibilityIdentifier("followerSortChipRow")
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Sort followers")
    }

    private func followerSortChip(_ sort: FollowerSort) -> some View {
        let isActive = viewModel.followerSort == sort
        return Button {
            viewModel.selectFollowerSort(sort)
        } label: {
            HStack(spacing: Spacing.s1) {
                if isActive {
                    Icon(.check, size: 11, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                }
                Text(sort.title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 28)
            .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurface)
            .overlay(
                Capsule().stroke(
                    isActive ? Theme.Color.primary600 : Theme.Color.appBorder,
                    lineWidth: 1
                )
            )
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(sort.title)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("followerSortChip_\(sort.rawValue)")
    }

    private var emptyFollowerSearchState: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.search, size: 32, color: Theme.Color.appTextMuted)
            Text("No followers match that search")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text("Try a different name or handle.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("followerSearchEmpty")
    }

    private func analyticsRow(_ cells: [AnalyticsCellContent]) -> some View {
        HStack(spacing: Spacing.s2) {
            ForEach(cells) { cell in
                VStack(alignment: .leading, spacing: 2) {
                    Text(cell.label.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .kerning(0.6)
                    Text(cell.value)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    if let trend = cell.trend {
                        Text(trend)
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.Color.success)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .accessibilityIdentifier("analyticsCell_\(cell.id)")
            }
        }
    }

    private func tierStackedBar(_ breakdown: TierBreakdownContent) -> some View {
        let segments = breakdown.segments

        return VStack(alignment: .leading, spacing: 6) {
            Text("Audience by tier")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            GeometryReader { geo in
                HStack(spacing: 2) {
                    ForEach(segments, id: \.id) { segment in
                        tierSegmentBar(segment, total: breakdown.total, availableWidth: geo.size.width)
                    }
                }
                .frame(height: 14)
            }
            .frame(height: 14)
            HStack(spacing: Spacing.s3) {
                ForEach(segments, id: \.id) { segment in
                    tierLegendItem(segment)
                }
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("tierStackedBar")
    }

    private func tierSegmentBar(
        _ segment: TierBreakdownContent.TierSegment,
        total: Int,
        availableWidth: CGFloat
    ) -> some View {
        let width = total > 0
            ? availableWidth * CGFloat(segment.count) / CGFloat(total)
            : 0
        return Rectangle()
            .fill(Self.tierColor(rank: segment.rank))
            .frame(width: max(width, segment.count >= 1 ? 4 : 0), height: 14)
    }

    private func tierLegendItem(_ segment: TierBreakdownContent.TierSegment) -> some View {
        HStack(spacing: Spacing.s1) {
            Circle().fill(Self.tierColor(rank: segment.rank)).frame(width: 8, height: 8)
            Text("\(segment.name) · \(segment.count)")
                .font(.system(size: 10.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private func tierChipRow(_ chips: [TierChipContent]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(chips) { chip in
                    let isActive = viewModel.selectedTierRank == chip.rank
                    Button {
                        viewModel.selectTierFilter(chip.rank)
                    } label: {
                        Text("\(chip.label) · \(chip.count)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                            .padding(.horizontal, 10)
                            .frame(height: 28)
                            .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurface)
                            .overlay(
                                Capsule().stroke(
                                    isActive ? Theme.Color.primary600 : Theme.Color.appBorder,
                                    lineWidth: 1
                                )
                            )
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("tierChip_\(chip.id)")
                }
            }
        }
    }

    private func followerRow(_ row: FollowerRowContent) -> some View {
        Button {
            onOpenFollower(row)
        } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    Circle().fill(Theme.Color.primary50).frame(width: 40, height: 40)
                    Text(row.displayName.prefix(1).uppercased())
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.Color.primary700)
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(row.displayName)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        if row.verifiedLocal {
                            Icon(.shieldCheck, size: 12, color: Theme.Color.success)
                        }
                    }
                    Text(row.handle)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(row.tierName)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Self.tierColor(rank: row.tierRank))
                    if let tenure = row.tenureLabel {
                        Text(tenure)
                            .font(.system(size: 10.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("followerRow_\(row.id)")
    }

    private var emptyFollowersState: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.user, size: 32, color: Theme.Color.appTextMuted)
            Text("No followers in this tier yet")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text("Share your Public Profile to start building your audience.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Threads tab

    private func threadsTab(_ loaded: AudienceProfileLoaded) -> some View {
        VStack(spacing: Spacing.s0) {
            threadsFilterStrip(chips: loaded.threadsFilterChips)
            threadsListBody(loaded: loaded)
        }
        .accessibilityIdentifier("audienceProfileThreadsList")
    }

    private func threadsFilterStrip(chips: [ThreadsFilterChipContent]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(chips) { chip in
                    threadsFilterChip(chip)
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("audienceProfileThreadsFilterStrip")
    }

    private func threadsFilterChip(_ chip: ThreadsFilterChipContent) -> some View {
        let isActive = viewModel.activeThreadFilter == chip.filter
        return Button {
            viewModel.selectThreadFilter(chip.filter)
        } label: {
            HStack(spacing: 5) {
                Text(chip.label)
                    .font(.system(size: 11.5, weight: .semibold))
                if let count = chip.count {
                    Text("\(count)")
                        .font(.system(size: 9.5, weight: .bold))
                        .opacity(0.85)
                }
            }
            .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            .padding(.horizontal, 11)
            .padding(.vertical, 5)
            .frame(minHeight: 28)
            .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurface)
            .overlay(
                Capsule().stroke(
                    isActive ? Theme.Color.primary600 : Theme.Color.appBorder,
                    lineWidth: 1
                )
            )
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("threadsFilterChip_\(chip.id)")
        .accessibilityLabel(chip.count.map { "\(chip.label), \($0)" } ?? chip.label)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    private func threadsListBody(loaded: AudienceProfileLoaded) -> some View {
        ScrollView {
            VStack(spacing: Spacing.s2) {
                if loaded.threads.isEmpty {
                    emptyThreadsState
                } else {
                    let visible = viewModel.visibleThreads
                    if visible.isEmpty {
                        emptyFilteredThreadsState
                    } else {
                        viewAllMessagesCTA
                        ForEach(visible) { thread in
                            threadRow(thread)
                        }
                    }
                }
                Spacer(minLength: Spacing.s6)
            }
            .padding(Spacing.s4)
        }
    }

    private var viewAllMessagesCTA: some View {
        Button(action: onOpenCreatorInbox) {
            HStack(spacing: Spacing.s2) {
                Icon(.inbox, size: 14, color: Theme.Color.primary600)
                Text("View all messages")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 12, color: Theme.Color.primary600)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 44)
            .background(Theme.Color.primary50)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.primary100, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("audienceProfileViewAllMessages")
        .accessibilityLabel("View all messages in Creator Inbox")
    }

    private func threadRow(_ row: ThreadRowContent) -> some View {
        Button {
            onOpenThread(row)
        } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    Circle().fill(Theme.Color.primary50).frame(width: 40, height: 40)
                    Text(row.displayName.prefix(1).uppercased())
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Theme.Color.primary700)
                    if row.unreadCount > 0 {
                        Text("\(row.unreadCount)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                            .padding(.horizontal, Spacing.s1)
                            .frame(minWidth: 16, minHeight: 16)
                            .background(Theme.Color.error)
                            .clipShape(Capsule())
                            .offset(x: 14, y: -14)
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(row.displayName)
                            .font(.system(size: 14, weight: row.unreadCount > 0 ? .bold : .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        if let tier = row.tierName {
                            Text(tier)
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Theme.Color.primary700)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(Theme.Color.primary50)
                                .clipShape(Capsule())
                        }
                    }
                    Text(row.preview)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                }
                Spacer(minLength: Spacing.s0)
                Text(row.timeAgo)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("threadRow_\(row.id)")
    }

    private var emptyThreadsState: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.inbox, size: 32, color: Theme.Color.appTextMuted)
            Text("No threads yet")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text("Tier 2+ followers can open a thread with you.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity)
    }

    private var emptyFilteredThreadsState: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.inbox, size: 32, color: Theme.Color.appTextMuted)
            Text("No threads in this view")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("Try another filter to see the rest of your inbox.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("audienceProfileThreadsFilteredEmpty")
    }

    // MARK: - Tier color (rank 1=Follower / 2=Member / 3=Insider / 4=Direct)

    static func tierColor(rank: Int) -> Color {
        switch rank {
        case 1: Theme.Color.primary600
        case 2: Theme.Color.success
        case 3: Theme.Color.warning
        case 4: Theme.Color.business
        default: Theme.Color.appTextSecondary
        }
    }

    private static func tierBgColor(rank: Int) -> Color {
        switch rank {
        case 1: Theme.Color.primary50
        case 2: Theme.Color.successBg
        case 3: Theme.Color.warningBg
        case 4: Theme.Color.businessBg
        default: Theme.Color.appSurfaceSunken
        }
    }

    private static func visibilityTitle(_ card: UpdateCardContent) -> String {
        switch card.visibility {
        case .publicVisible:
            "All beacons"
        case .followers:
            "Followers"
        case .tierOrAbove:
            switch card.targetTierRank {
            case 2: "Bronze+"
            case 3: "Silver+"
            case 4: "Gold+"
            default: card.visibilityLabel
            }
        }
    }

    private static func visibilityIcon(_ card: UpdateCardContent) -> PantopusIcon {
        switch card.visibility {
        case .publicVisible: .globe
        case .followers: .users
        case .tierOrAbove: .lock
        }
    }

    private static func visibilityColors(_ card: UpdateCardContent) -> (foreground: Color, background: Color) {
        switch card.visibility {
        case .publicVisible:
            return (Theme.Color.primary700, Theme.Color.primary50)
        case .followers:
            return (Theme.Color.appTextStrong, Theme.Color.appSurfaceSunken)
        case .tierOrAbove:
            let rank = card.targetTierRank ?? 2
            return (tierColor(rank: rank), tierBgColor(rank: rank))
        }
    }

    private static func growthSamples(_ header: AudienceHeaderContent) -> [CGFloat] {
        let current = max(header.followerCount, 0)
        let gain = max(header.newThisWeek, 0)
        let start = max(current - gain, 0)
        guard gain > 0 else {
            return Array(repeating: CGFloat(current), count: 7)
        }
        return (0..<7).map { index in
            CGFloat(start + Int((Double(gain) * Double(index)) / 6.0))
        }
    }

    private static func formattedCount(_ value: Int) -> String {
        NumberFormatter.localizedString(from: NSNumber(value: value), number: .decimal)
    }

    private static func compactCount(_ value: Int) -> String {
        if value >= 1000 {
            let oneDecimal = Double(value) / 1000.0
            return String(format: oneDecimal >= 10 ? "%.0fK" : "%.1fK", oneDecimal)
        }
        return "\(value)"
    }
}

private struct SparklineShape: Shape {
    let points: [CGFloat]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard points.count > 1 else { return path }
        let minValue = points.min() ?? 0
        let maxValue = points.max() ?? 1
        let range = max(maxValue - minValue, 1)
        for index in points.indices {
            let x = rect.minX + (rect.width * CGFloat(index) / CGFloat(points.count - 1))
            let normalized = (points[index] - minValue) / range
            let y = rect.maxY - (normalized * rect.height)
            if index == points.startIndex {
                path.move(to: CGPoint(x: x, y: y))
            } else {
                path.addLine(to: CGPoint(x: x, y: y))
            }
        }
        return path
    }
}

#Preview {
    AudienceProfileView()
}
