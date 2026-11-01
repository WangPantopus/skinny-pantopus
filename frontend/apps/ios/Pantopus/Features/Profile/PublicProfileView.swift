//
//  PublicProfileView.swift
//  Pantopus
//
//  Public profile screen wired through `ContentDetailShell` with
//  `BeaconBanner` + `BeaconIdentityBlock` + `StatsTabsBody`.
//
//  P6.5 — Differentiates between Persona (creator) and Local (verified
//  neighbor) profiles. The view-model picks the kind from the loaded
//  profile's metadata, then this view swaps:
//
//    - `BeaconBanner` identity tint (sky `.personal` vs green `.home`),
//    - in-header chips ("Persona · Verified" gold tier vs "Verified
//      neighbor" green shield),
//    - `BeaconIdentityBlock` action area (share + Follow vs Connect +
//      Message — P8.6 moved these in-header from the old sticky footer),
//    - post styling beneath the identity block (broadcasts with a tier
//      visibility chip + locked-paywall overlay vs Pulse-style posts
//      with an intent chip), incl. the full empty-state card.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

/// Public profile entry point.
@MainActor
public struct PublicProfileView: View {
    @State var viewModel: PublicProfileViewModel
    @State private var showReportSheet = false
    @State private var showBlockConfirm = false
    @State private var showUnblockConfirm = false
    @State var shareURL: URL?
    /// The "Pick a username for your link" sheet, asked before the first share.
    @State var usernameShare: UsernameShareSheetModel?
    /// The Connect sheet: the note, Send request, or just follow.
    @State private var showConnectSheet = false
    /// "What does Verified neighbor mean?" after a tap on the trust line.
    @State var showTrustExplainer = false
    /// The editor, opened from your own profile's Edit profile.
    @State var showEditProfile = false
    /// Your own profile's extras (`PublicProfileView+Owner.swift`); nil signed out.
    @State var owner: OwnerPageModel?
    /// "Preview your profile as", then the preview it opens.
    @State var showPreviewMenu = false
    @State var pickedPreview: ProfileAudience?
    @State var shownPreview: ProfileAudience?
    /// Your whole month, opened from "Your <month>".
    @State var showMonth = false
    @State var showSignOutConfirm = false
    /// Text for the system share sheet (your month, your invite link).
    @State var shareText: String?
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(RootTabModel.self) var rootTabs: RootTabModel?
    let onBack: @MainActor () -> Void
    let onOpenMessages: @MainActor (PublicProfile) -> Void
    private let onEditPersona: @MainActor () -> Void
    private let onOpenInsights: @MainActor () -> Void
    private let onComposeBroadcast: @MainActor () -> Void
    let onOpenGig: @MainActor (String) -> Void
    let onOpenProfile: @MainActor (String) -> Void
    let onOpenPost: @MainActor (String) -> Void
    /// The profile cover's ✕ (☰ → Your profile); nil when pushed (Back).
    let onClose: (@MainActor () -> Void)?
    /// Where your own profile's "Your account" rows go; nil asks the root to
    /// open the profile cover on that screen.
    let onOwnerDestination: (@MainActor (ProfileOwnerDestination) -> Void)?
    /// Opened from the `monthly_receipt` push: your whole month opens at once.
    let expandMonthlyReceipt: Bool

    public init(
        userId: String,
        currentUserId: String? = nil,
        onBack: @escaping @MainActor () -> Void,
        onOpenMessages: @escaping @MainActor (PublicProfile) -> Void = { _ in },
        onEditPersona: @escaping @MainActor () -> Void = {},
        onOpenInsights: @escaping @MainActor () -> Void = {},
        onComposeBroadcast: @escaping @MainActor () -> Void = {},
        onOpenGig: @escaping @MainActor (String) -> Void = { _ in },
        onOpenProfile: @escaping @MainActor (String) -> Void = { _ in },
        onOpenPost: @escaping @MainActor (String) -> Void = { _ in },
        previewAudience: ProfileAudience? = nil,
        onClose: (@MainActor () -> Void)? = nil,
        onOwnerDestination: (@MainActor (ProfileOwnerDestination) -> Void)? = nil,
        expandMonthlyReceipt: Bool = false
    ) {
        // No call site threads the signed-in id through, so fall back to the
        // session when the caller doesn't supply one — otherwise `isOwner`
        // (and the whole persona-owner chrome) is permanently false.
        let viewer = currentUserId ?? PublicProfileViewModel.signedInUserId()
        _viewModel = State(
            initialValue: PublicProfileViewModel(userId: userId, currentUserId: viewer, previewAudience: previewAudience)
        )
        _owner = State(initialValue: previewAudience == nil ? viewer.map { OwnerPageModel(userId: $0) } : nil)
        self.onClose = onClose
        self.onOwnerDestination = onOwnerDestination
        self.expandMonthlyReceipt = expandMonthlyReceipt
        self.onBack = onBack
        self.onOpenMessages = onOpenMessages
        self.onEditPersona = onEditPersona
        self.onOpenInsights = onOpenInsights
        self.onComposeBroadcast = onComposeBroadcast
        self.onOpenGig = onOpenGig
        self.onOpenProfile = onOpenProfile
        self.onOpenPost = onOpenPost
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            content
            if let toast = viewModel.toastMessage {
                ToastView(message: ToastMessage(text: toast, kind: .neutral))
                    .padding(.bottom, Spacing.s10)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .dismissToast(after: toast, minimum: 2) {
                        viewModel.toastMessage = nil
                    }
            }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .confirmationDialog(
            "More",
            isPresented: Binding(
                get: { viewModel.showOverflow },
                set: { viewModel.showOverflow = $0 }
            ),
            titleVisibility: .hidden
        ) {
            // The header's "Share profile" opens this sheet, so it shares first.
            if let url = viewModel.profileShareURL {
                Button("Share profile") {
                    if viewModel.asksForUsernameBeforeSharing {
                        viewModel.markAskedForUsername()
                        usernameShare = UsernameShareSheetModel(currentUsername: viewModel.loadedUsername)
                    } else {
                        shareURL = url
                    }
                }
            }
            // Nobody follows, blocks or reports themselves.
            if !viewModel.isOwnProfileLoaded {
                // Follow moved here (and into the Connect sheet) from the old Follow row;
                // Unfollow keeps its confirm.
                if viewModel.canFollow, viewModel.relationshipLoaded, viewModel.connection != .blocked {
                    if viewModel.isFollowing {
                        Button("Unfollow") { viewModel.showUnfollowConfirm = true }
                    } else {
                        Button("Follow") { Task { await viewModel.toggleFollow() } }
                    }
                }
                // Someone you blocked can be unblocked here, as in Settings → Blocked users.
                if viewModel.isBlockedByViewer {
                    Button("Unblock this user") {
                        showUnblockConfirm = true
                    }
                } else {
                    Button("Block this user", role: .destructive) {
                        showBlockConfirm = true
                    }
                }
                Button("Report") { showReportSheet = true }
            }
            Button("Cancel", role: .cancel) {}
        }
        // Blocking from a chat asks first (`ChatConversationDetailsSheet`), so
        // the profile does too before it sends `POST /api/users/:id/block`.
        .alert(blockTitle, isPresented: $showBlockConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Block", role: .destructive) {
                Task { await viewModel.block() }
            }
        } message: {
            Text("You won't be able to message each other or see each other's posts.")
        }
        .alert(unblockTitle, isPresented: $showUnblockConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Unblock") {
                Task { await viewModel.unblock() }
            }
        } message: {
            Text("You'll be able to see each other's posts and message each other again. They aren't notified.")
        }
        .sheet(isPresented: $showReportSheet) {
            reportSheet
        }
        .sheet(
            isPresented: Binding(
                get: { usernameShare != nil },
                set: { if !$0 { usernameShare = nil } }
            )
        ) {
            if let usernameShare {
                UsernameShareSheet(
                    model: usernameShare,
                    onShareAsIs: {
                        let url = viewModel.profileShareURL
                        self.usernameShare = nil
                        shareAfterSheet(url)
                    },
                    onSaved: { username in
                        self.usernameShare = nil
                        Task {
                            await viewModel.refresh()
                            shareAfterSheet(URL(string: InviteLinks.profileURLString(username: username)))
                        }
                    }
                )
            }
        }
        .sheet(
            isPresented: Binding(
                get: { shareURL != nil },
                set: { if !$0 { shareURL = nil } }
            )
        ) {
            if let shareURL {
                SystemShareSheet(items: [shareURL])
            }
        }
        // RN gates the same `DELETE /api/relationships/:id` behind a
        // "Disconnect · Remove this connection?" alert
        // (`src/app/connections.tsx:69-77`), so Connected ▾ → Disconnect
        // confirms before it removes the edge. An alert, so Cancel always
        // shows (iOS 27 shows a confirmation dialog as a popover with none).
        .alert(
            disconnectTitle,
            isPresented: Binding(
                get: { viewModel.showDisconnectConfirm },
                set: { viewModel.showDisconnectConfirm = $0 }
            )
        ) {
            Button("Cancel", role: .cancel) { viewModel.cancelDisconnect() }
                .accessibilityIdentifier("publicProfileDisconnectCancel")
            Button("Disconnect", role: .destructive) {
                Task { await viewModel.disconnect() }
            }
            .accessibilityIdentifier("publicProfileDisconnectConfirm")
        } message: {
            Text("You'll stop seeing each other's connections-only posts. They aren't notified.")
        }
        .alert(
            withdrawTitle,
            isPresented: Binding(
                get: { viewModel.showWithdrawConfirm },
                set: { viewModel.showWithdrawConfirm = $0 }
            )
        ) {
            Button("Cancel", role: .cancel) {}
                .accessibilityIdentifier("publicProfileWithdrawCancel")
            Button("Withdraw", role: .destructive) {
                Task { await viewModel.withdrawRequest() }
            }
            .accessibilityIdentifier("publicProfileWithdrawConfirm")
        } message: {
            Text("They aren't notified. You can send a new request later.")
        }
        .alert("Verified neighbor", isPresented: $showTrustExplainer) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(trustExplainer)
        }
        .sheet(isPresented: $showConnectSheet) {
            connectSheet
        }
        // Your own profile's Edit profile; the profile reads itself again after.
        .sheet(
            isPresented: $showEditProfile,
            onDismiss: { Task { await viewModel.refresh() } },
            content: {
                EditProfileView {
                    showEditProfile = false
                    open(.myHomes)
                }
            }
        )
        // A stray tap on Following never unfollows: it asks first, as Connected
        // does. An alert, like Block's, so Cancel shows beside Unfollow (as on
        // web and Android).
        .alert(
            unfollowTitle,
            isPresented: Binding(
                get: { viewModel.showUnfollowConfirm },
                set: { viewModel.showUnfollowConfirm = $0 }
            )
        ) {
            Button("Cancel", role: .cancel) {}
                .accessibilityIdentifier("publicProfileUnfollowCancel")
            Button("Unfollow", role: .destructive) {
                Task { await viewModel.unfollow() }
            }
            .accessibilityIdentifier("publicProfileUnfollowConfirm")
        } message: {
            Text("They won't be notified.")
        }
        .modifier(ProfilePostCardSurfaces(model: viewModel.postCards))
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
                        personaHandle: viewModel.loadedPersonaHandle,
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
        // Your own profile: Preview as, your month, sharing, Log out (`PublicProfileView+Owner.swift`).
        .sheet(isPresented: $showPreviewMenu, onDismiss: openPickedPreview) {
            ProfilePreviewMenu { audience in
                pickedPreview = audience
                showPreviewMenu = false
            }
            .presentationDetents(typeSize.isAccessibilitySize ? [.large] : [.fraction(0.62), .large])
        }
        .fullScreenCover(item: $shownPreview) { audience in
            previewCover(audience)
        }
        .sheet(isPresented: $showMonth) { monthSheet }
        .sheet(
            isPresented: Binding(get: { shareText != nil }, set: { if !$0 { shareText = nil } })
        ) {
            if let shareText { SystemShareSheet(items: [shareText]) }
        }
        .alert("Sign out of Pantopus?", isPresented: $showSignOutConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Sign out", role: .destructive) {
                Task { await AuthManager.shared.signOut() }
            }
            .accessibilityIdentifier("profileSignOutConfirm")
        } message: {
            Text("You'll need to sign in again to use your account. Signing out removes what Pantopus saved on this phone.")
        }
        // A saved edit (name, username, tagline…) changes the page.
        .onReceive(NotificationCenter.default.publisher(for: .pantopusProfileDidChange)) { _ in
            Task { await refreshOwnPage() }
        }
        .task(id: viewModel.isOwnProfileLoaded) { await ownerPageAppeared() }
        .accessibilityIdentifier("publicProfile")
        .task { await viewModel.load() }
    }

    /// Names the person being blocked, like the chat block confirm. `nil`
    /// before the profile resolves or when it has no display name.
    private var blockName: String? {
        guard case let .loaded(payload) = viewModel.state else { return nil }
        let name = payload.header.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? nil : name
    }

    private var blockTitle: String {
        blockName.map { "Block \($0)?" } ?? "Block this user?"
    }

    private var unblockTitle: String {
        blockName.map { "Unblock \($0)?" } ?? "Unblock this user?"
    }

    private var unfollowTitle: String {
        blockName.map { "Unfollow \($0)?" } ?? "Unfollow this person?"
    }

    /// Names the neighbor being disconnected, per the destructive-confirm
    /// rule. Falls back to the generic title before the profile resolves.
    private var disconnectTitle: String {
        blockName.map { "Disconnect from \($0)?" } ?? "Disconnect?"
    }

    private var withdrawTitle: String {
        blockName.map { "Withdraw your request to \($0)?" } ?? "Withdraw your request?"
    }

    private var trustExplainer: String {
        guard case let .loaded(payload) = viewModel.state else { return "" }
        return viewModel.trustExplainer(for: payload.header)
    }

    @ViewBuilder private var connectSheet: some View {
        if case let .loaded(payload) = viewModel.state {
            ConnectSheet(
                firstName: payload.header.firstName,
                name: payload.header.displayName,
                showsInitials: payload.header.hasName,
                avatarURL: payload.header.avatarURL,
                color: payload.header.avatarColor,
                isFollowing: viewModel.isFollowing,
                onSend: { note in await viewModel.sendConnectionRequest(note: note) },
                onFollow: { await viewModel.followFromConnectSheet() }
            )
            .presentationDetents(typeSize.isAccessibilitySize ? [.large] : [.fraction(0.78), .large])
        }
    }

    @ViewBuilder private var reportSheet: some View {
        if case let .loaded(payload) = viewModel.state {
            ReportUserSheet(
                userId: payload.profile.id,
                handle: payload.header.handle,
                displayName: payload.header.displayName,
                onClose: { showReportSheet = false },
                onSubmitted: {
                    showReportSheet = false
                    viewModel.toastMessage = "Report received"
                }
            )
        }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            LoadingLayout(onBack: onBack)
        case let .loaded(payload):
            loadedLayout(payload)
        case let .error(message):
            ErrorLayout(message: message, onBack: onBack) {
                Task { await viewModel.refresh() }
            }
        }
    }

    @ViewBuilder
    private func loadedLayout(_ payload: PublicProfileContent) -> some View {
        if payload.kind == .local, let neighbor = payload.neighbor {
            if let audience = viewModel.previewAudience {
                previewLayout(payload, neighbor: neighbor, audience: audience)
            } else if payload.isOwner, let owner {
                ownerLayout(payload, neighbor: neighbor, owner: owner)
            } else {
                localLayout(payload, neighbor: neighbor)
            }
        } else {
            personaLayout(payload)
        }
    }

    /// A plan opens on the Plans tab and a Support Train where trains live,
    /// as their links do.
    private func openTogether(_ target: ProfileTogetherLine.Target) {
        switch target {
        case let .plan(id): DeepLinkRouter.shared.handle(path: "/plans/\(id)")
        case let .supportTrain(id): DeepLinkRouter.shared.handle(path: "/support-trains/\(id)")
        }
    }

    /// The share sheet can't present while the username sheet is still
    /// going away, so it opens a moment later.
    private func shareAfterSheet(_ url: URL?) {
        guard let url else { return }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(600))
            shareURL = url
        }
    }

    // MARK: - Someone's profile (11-01 redesign)

    /// A person's profile (`Main.dc.html`): Back and ⋯ on the page itself, no
    /// banner; the header (photo, name, trust line, tagline, bio) with the
    /// buttons for your relationship; then Posts | About, and Work when there
    /// is work to show.
    private func localLayout(
        _ payload: PublicProfileContent,
        neighbor: NeighborProfileContent
    ) -> some View {
        let tabs = viewModel.localTabs(for: payload)
        let selected = tabs.contains(viewModel.selectedLocalTab) ? viewModel.selectedLocalTab : .posts
        return VStack(spacing: Spacing.s0) {
            ProfileTopBar(
                onBack: onBack,
                moreLabel: payload.isOwner ? "More: share your profile" : "More: share, follow, block or report"
            ) { viewModel.showOverflow = true }
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    ProfilePageHeader(
                        name: payload.header.displayName,
                        showsInitials: payload.header.hasName,
                        handle: payload.header.handle,
                        avatarURL: payload.header.avatarURL,
                        color: payload.header.avatarColor,
                        trust: ProfileTrustFacts(
                            isVerifiedNeighbor: payload.header.isVerifiedNeighbor,
                            city: payload.header.trustCity,
                            joined: payload.header.joinedLabel
                        ),
                        tagline: payload.header.tagline,
                        bio: payload.stats.bio,
                        onTrustTap: { showTrustExplainer = true },
                        actions: { localActions(for: payload) }
                    )
                    .accessibilityElement(children: .contain)
                    .accessibilityIdentifier("publicProfileLocalHeader")

                    let together = viewModel.togetherLines(for: payload)
                    if !together.isEmpty {
                        ProfileTogetherSection(firstName: payload.header.firstName, lines: together, onOpen: openTogether)
                            .padding(.horizontal, Spacing.s5)
                            .padding(.top, 28)
                    }

                    LocalProfileTabStrip(
                        tabs: tabs,
                        postCount: viewModel.connection == .blocked || viewModel.postCards.cards.isEmpty
                            ? nil
                            : viewModel.postCards.cards.count,
                        selected: selected
                    ) { viewModel.selectedLocalTab = $0 }
                        .padding(.top, 28)
                        .padding(.horizontal, Spacing.s5)

                    localTabContent(payload, neighbor: neighbor, tab: selected)
                }
                .padding(.bottom, Spacing.s10)
            }
            // Its own task: SwiftUI cancels a refresh's task once the content it
            // reloads changes, which would cut off the relationship read after the posts.
            .refreshable { await Task { await viewModel.refresh() }.value }
        }
        .background(Theme.Color.appBg)
    }

    @ViewBuilder
    func localTabContent(
        _ payload: PublicProfileContent,
        neighbor: NeighborProfileContent,
        tab: LocalProfileTab
    ) -> some View {
        switch tab {
        case .posts:
            PublicProfilePostsFeed(
                kind: .local,
                posts: payload.posts,
                onUnlock: { _ in },
                onEmptyCTA: { onOpenMessages(payload.profile) },
                localName: payload.header.displayName,
                loadFailed: viewModel.postsLoadFailed,
                onRetry: retryLoad,
                hiddenByBlock: viewModel.connection == .blocked,
                isOwnProfile: payload.isOwner,
                joinedRecently: payload.header.joinedRecently,
                isLoading: viewModel.postsLoading,
                pulseCards: viewModel.postCards,
                onOpenPost: onOpenPost
            )
            .padding(.top, Spacing.s3)
        case .about:
            LocalProfileAboutSection(content: neighbor, header: payload.header, profile: payload.profile)
                .padding(.horizontal, Spacing.s5)
                .padding(.top, Spacing.s5)
        case .work:
            LocalProfileWorkSection(
                userId: payload.profile.id,
                isOwnProfile: payload.isOwner,
                showsPortfolio: payload.isOwner || (viewModel.portfolioCount ?? 0) > 0,
                showsTasks: LaunchFeatures.openGigs && (payload.profile.gigsPosted ?? 0) > 0,
                showsReviews: (payload.profile.reviewCount ?? 0) > 0,
                onOpenGig: onOpenGig,
                onOpenReviewer: onOpenProfile
            )
            .padding(.horizontal, Spacing.s5)
            .padding(.top, Spacing.s5)
        }
    }

    /// The header's buttons for where you stand with this person:
    /// - none: Connect (opens the Connect sheet) + Message
    /// - request sent: Message + Requested (tap to withdraw, with a confirm)
    /// - request received: "<name> wants to connect" with Accept / Not now, above Message
    /// - connected: Message + Connected ▾ (Disconnect, with a confirm)
    /// - blocked: none (the posts say so; ⋯ unblocks)
    /// - your own profile: Edit profile, never Message or Connect
    @ViewBuilder
    private func localActions(for payload: PublicProfileContent) -> some View {
        if payload.isOwner {
            ProfileActionButton(title: "Edit profile", icon: .pencil)
                .button { showEditProfile = true }
                .accessibilityIdentifier("publicProfileEditProfile")
        } else if viewModel.connection != .blocked {
            let message = ProfileActionButton(title: "Message", icon: .messageSquare, style: .secondary)
            VStack(alignment: .leading, spacing: Spacing.s3) {
                if viewModel.relationshipLoaded, viewModel.connection == .pendingReceived {
                    ProfileRequestBanner(
                        name: payload.header.firstName,
                        isWorking: viewModel.connectState == .inFlight,
                        onAccept: { Task { await viewModel.connect() } },
                        onDecline: { Task { await viewModel.declineRequest() } }
                    )
                    message.button { onOpenMessages(payload.profile) }
                        .accessibilityIdentifier("publicProfileMessageCta")
                } else {
                    ProfileActionRow {
                        relationshipButtons(for: payload, message: message)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func relationshipButtons(for payload: PublicProfileContent, message: ProfileActionButton) -> some View {
        let openMessages: @MainActor () -> Void = { onOpenMessages(payload.profile) }
        if viewModel.relationshipLoaded, viewModel.canFollow {
            switch viewModel.connection {
            case .none, .blocked, .pendingReceived:
                ProfileActionButton(title: "Connect", icon: .userPlus)
                    .button { showConnectSheet = true }
                    .disabled(viewModel.connectState == .inFlight)
                    .accessibilityIdentifier("publicProfileConnectCta")
                message.button(action: openMessages)
                    .accessibilityIdentifier("publicProfileMessageCta")
            case .pendingSent:
                ProfileActionButton(title: "Message", icon: .messageSquare)
                    .button(action: openMessages)
                    .accessibilityIdentifier("publicProfileMessageCta")
                ProfileActionButton(title: "Requested", icon: .clock, style: .secondary)
                    .button(spoken: "Requested. Withdraw request") { viewModel.showWithdrawConfirm = true }
                    .disabled(viewModel.connectState == .inFlight)
                    .accessibilityIdentifier("publicProfileConnectCta")
            case .connected:
                ProfileActionButton(title: "Message", icon: .messageSquare)
                    .button(action: openMessages)
                    .accessibilityIdentifier("publicProfileMessageCta")
                Menu {
                    Button("Disconnect", role: .destructive) { viewModel.showDisconnectConfirm = true }
                } label: {
                    ProfileActionButton(title: "Connected", icon: .check, style: .secondary, showsChevron: true)
                }
                .menuStyle(.button)
                .buttonStyle(.plain)
                .disabled(viewModel.connectState == .inFlight)
                .accessibilityLabel("Connected. Options")
                .accessibilityIdentifier("publicProfileConnectCta")
            }
        } else {
            if viewModel.hasSignedInViewer, !viewModel.relationshipLoaded, !viewModel.relationshipReadFailed {
                // Holds Connect's place until the relationship read answers;
                // a failed read leaves it out rather than guessing.
                Shimmer(height: 48, cornerRadius: Radii.lg)
                    .frame(maxWidth: .infinity)
                    .accessibilityHidden(true)
            }
            message.button(action: openMessages)
                .accessibilityIdentifier("publicProfileMessageCta")
        }
    }

    private func personaLayout(_ payload: PublicProfileContent) -> some View {
        ContentDetailShell(
            title: nil,
            onBack: onBack,
            topBarAction: ContentDetailTopBarAction(
                icon: .moreHorizontal,
                accessibilityLabel: "More"
            ) {
                Task { @MainActor in viewModel.showOverflow = true }
            },
            header: {
                VStack(spacing: Spacing.s0) {
                    PublicProfileBanner(kind: payload.kind)
                    BeaconIdentityBlock(
                        identity: payload.kind == .persona ? .personal : .home,
                        name: payload.header.displayName,
                        handle: payload.header.handle,
                        tierLabel: payload.header.tierLabel,
                        isVerifiedNeighbor: payload.header.isVerifiedNeighbor,
                        locality: payload.header.locality,
                        bio: payload.stats.bio,
                        isVerified: payload.header.isVerified,
                        avatarURL: payload.header.avatarURL,
                        stats: payload.stats.stats,
                        avatarName: payload.header.hasName ? nil : ""
                    ) {
                        identityActions(for: payload)
                    }
                }
                .accessibilityIdentifier(
                    payload.kind == .persona
                        ? "publicProfilePersonaHeader"
                        : "publicProfileLocalHeader"
                )
            },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    // Launch cuts #1 + #2: no Beacon analytics strip.
                    if payload.isOwner, Self.showsPersonaParts {
                        BeaconOwnerAnalyticsStrip(followerStat: payload.stats.stats.first?.value ?? "—") {
                            onOpenInsights()
                        }
                    }
                    StatsTabsBody(
                        content: payload.stats,
                        selectedTab: Binding(
                            get: { viewModel.selectedTab },
                            set: { viewModel.selectedTab = $0 }
                        ),
                        showStats: false,
                        showActionRow: false,
                        profileUserId: payload.profile.id,
                        isOwnProfile: payload.isOwner,
                        onMessage: { onOpenMessages(payload.profile) },
                        onConnect: { Task { await viewModel.connect() } },
                        onOverflow: { viewModel.showOverflow = true },
                        onOpenGig: onOpenGig,
                        onOpenReviewer: onOpenProfile
                    )
                    // Launch cut #3 (Marketplace): no "Marketplace reviews" section, as on Android.
                    if LaunchFeatures.marketplace {
                        ReceivedReviewsSection(userId: payload.profile.id)
                    }
                    // Launch cuts #1 + #2: the persona broadcasts feed ("No broadcasts
                    // yet … Follow") is hidden; the rest of the profile stays.
                    if payload.kind != .persona || Self.showsPersonaParts {
                        PublicProfilePostsFeed(
                            kind: payload.kind,
                            posts: payload.posts,
                            onUnlock: { post in viewModel.unlockBroadcast(tierRank: post.targetTierRank) },
                            onEmptyCTA: { emptyCTAAction(for: payload) }
                        )
                    }
                }
            }
        )
    }

    /// Glyph paired with the Connect control's current label.
    private var connectIcon: PantopusIcon {
        switch viewModel.connection {
        case .connected: .check
        case .pendingSent: .clock
        default: .userPlus
        }
    }

    /// Kind-aware action buttons rendered top-right inside the
    /// `BeaconIdentityBlock` (replacing the former sticky footer).
    @ViewBuilder
    private func identityActions(for payload: PublicProfileContent) -> some View {
        switch payload.kind {
        case .persona:
            if payload.isOwner {
                // Launch cuts #1 + #2: no Beacon insights or persona editor.
                if Self.showsPersonaParts {
                    BeaconHeaderGhostButton(icon: .barChart3, accessibilityLabel: "Insights") {
                        onOpenInsights()
                    }
                    BeaconHeaderGhostButton(title: "Edit", icon: .pencil, accessibilityLabel: "Edit Persona") {
                        onEditPersona()
                    }
                }
            } else {
                BeaconHeaderGhostButton(icon: .share, accessibilityLabel: "Share profile") {
                    viewModel.showOverflow = true
                }
                // Follow / Following waits for the relationship read, so a
                // failed read can't show "Follow" to an existing follower.
                if viewModel.relationshipLoaded {
                    if viewModel.isFollowing {
                        BeaconHeaderGhostButton(
                            title: "Following",
                            icon: .check,
                            accessibilityLabel: "Following. Tap to unfollow"
                        ) {
                            viewModel.follow()
                        }
                        .accessibilityIdentifier("publicProfileFollowButton")
                    } else {
                        BeaconHeaderPrimaryButton(title: "Follow", icon: .plus) {
                            viewModel.follow()
                        }
                        .accessibilityIdentifier("publicProfileFollowButton")
                    }
                }
            }
        case .local:
            // The Connect control reads the real edge from
            // `GET /api/users/:id/relationship`: Connect → Requested →
            // Accept → Connected, and disappears once the viewer has
            // blocked this neighbor (RN `src/app/user/[id].tsx:391-398,523`).
            if viewModel.showsConnectAction {
                BeaconHeaderGhostButton(
                    title: viewModel.connectLabel,
                    icon: connectIcon,
                    accessibilityLabel: viewModel.connection.accessibilityLabel
                ) {
                    Task { await viewModel.connect() }
                }
                .disabled(!viewModel.isConnectEnabled)
                .opacity(viewModel.isConnectEnabled ? 1 : 0.7)
                .accessibilityIdentifier("publicProfileConnectCta")
            }
            // Someone you blocked can't be messaged (the block says so); Settings unblocks.
            // Nobody messages themselves.
            if !payload.isOwner, viewModel.connection != .blocked {
                BeaconHeaderPrimaryButton(title: "Message", icon: .messageSquare) {
                    onOpenMessages(payload.profile)
                }
            }
        }
    }

    /// Launch cuts #1 (Beacon) + #2 (Personas): the creator parts of the
    /// persona archetype (broadcasts, insights, persona editor).
    private static var showsPersonaParts: Bool {
        LaunchFeatures.beacon && LaunchFeatures.personas
    }

    /// Try again on a feed that couldn't load: reloads the profile, its posts
    /// and the relationship.
    func retryLoad() {
        Task { await viewModel.refresh() }
    }

    /// First-touch action behind the posts-feed empty-state CTA.
    private func emptyCTAAction(for payload: PublicProfileContent) {
        switch payload.kind {
        case .persona:
            if payload.isOwner {
                onComposeBroadcast()
            } else {
                viewModel.follow()
            }
        case .local:
            onOpenMessages(payload.profile)
        }
    }
}

/// The profile's shape while it loads: photo, name, trust line, bio, the two
/// buttons, then the tabs.
private struct LoadingLayout: View {
    let onBack: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            ProfileTopBar(onBack: onBack, moreLabel: "More", onMore: nil)
            VStack(alignment: .leading, spacing: Spacing.s0) {
                HStack(spacing: Spacing.s4) {
                    Shimmer(width: 84, height: 84, cornerRadius: 42)
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Shimmer(width: 170, height: 26, cornerRadius: Radii.sm)
                        Shimmer(width: 90, height: 14, cornerRadius: Radii.sm)
                    }
                }
                Shimmer(width: 250, height: 14, cornerRadius: Radii.sm)
                    .padding(.top, 18)
                Shimmer(height: 16, cornerRadius: Radii.sm)
                    .padding(.top, 18)
                Shimmer(width: 220, height: 16, cornerRadius: Radii.sm)
                    .padding(.top, Spacing.s2)
                HStack(spacing: 10) {
                    Shimmer(height: 48, cornerRadius: Radii.lg)
                    Shimmer(height: 48, cornerRadius: Radii.lg)
                }
                .padding(.top, 18)
                Shimmer(width: 140, height: 20, cornerRadius: Radii.sm)
                    .padding(.top, Spacing.s8)
                Shimmer(height: 140, cornerRadius: Radii.xl)
                    .padding(.top, Spacing.s4)
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.top, Spacing.s2)
            Spacer()
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("publicProfileLoading")
    }
}

private struct ErrorLayout: View {
    let message: String
    let onBack: @MainActor () -> Void
    let onRetry: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ProfileTopBar(onBack: onBack, moreLabel: "More", onMore: nil)
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load this profile",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") { await MainActor.run { onRetry() } }
            )
            .frame(maxHeight: .infinity)
        }
        .background(Theme.Color.appBg)
    }
}

#Preview {
    PublicProfileView(userId: "preview") {}
}
