//
//  PublicProfileView+Owner.swift
//  Pantopus
//
//  Your own profile (the 11-01 redesign, `Own.dc.html`, `OwnWhole.dc.html`):
//  the same page neighbors see, with ✕ (or Back) and Share on top, the name
//  neighbors see and a line saying your account name stays private, Edit
//  profile and Preview as, up to two tips only you see, your latest two posts
//  and "See all", your month, "Your account" and Log out. Preview as shows
//  the page exactly as an audience gets it (`?as=`, `PreviewAnyone.dc.html`).
//

import SwiftUI

extension PublicProfileView {
    // MARK: - Owner page

    func ownerLayout(
        _ payload: PublicProfileContent,
        neighbor: NeighborProfileContent,
        owner: OwnerPageModel
    ) -> some View {
        let tabs = viewModel.localTabs(for: payload)
        let selected = tabs.contains(viewModel.selectedLocalTab) ? viewModel.selectedLocalTab : .posts
        let shown = owner.localProfile?.profile
        let name = shown?.displayName ?? payload.header.displayName
        return VStack(spacing: Spacing.s0) {
            ProfileTopBar(
                leading: onClose == nil ? .back : .close,
                title: "Your profile",
                trailingIcon: .share,
                onBack: onClose ?? onBack,
                moreLabel: "Share your profile"
            ) { shareOwnProfile() }
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    ProfilePageHeader(
                        name: name,
                        showsInitials: !name.isEmpty,
                        handle: shown?.handle.flatMap { MadeUpUsername.chosen($0) } ?? payload.header.handle,
                        avatarURL: shown.map { $0.avatarUrl.flatMap(URL.init(string:)) } ?? payload.header.avatarURL,
                        color: payload.header.avatarColor,
                        trust: ProfileTrustFacts(
                            isVerifiedNeighbor: payload.header.isVerifiedNeighbor,
                            city: payload.header.trustCity,
                            joined: payload.header.joinedLabel
                        ),
                        tagline: payload.header.tagline,
                        bio: payload.stats.bio,
                        privateNameNote: owner.privateAccountNameLine,
                        onTrustTap: { showTrustExplainer = true },
                        actions: { ownerActions }
                    )
                    .accessibilityElement(children: .contain)
                    .accessibilityIdentifier("profileOwnerHeader")

                    ownerTips(payload, owner: owner)

                    promptsAndPins(payload, firstName: Self.firstWord(name), mode: .owner)

                    LocalProfileTabStrip(
                        tabs: tabs,
                        postCount: viewModel.postCards.cards.isEmpty ? nil : viewModel.postCards.cards.count,
                        selected: selected
                    ) { viewModel.selectedLocalTab = $0 }
                        .padding(.top, 28)
                        .padding(.horizontal, Spacing.s5)

                    if selected == .posts {
                        ownerPosts(payload)
                    } else {
                        localTabContent(payload, neighbor: neighbor, tab: selected)
                    }

                    ownerExtras(owner)
                        .padding(.horizontal, Spacing.s5)
                        .padding(.top, 28)
                }
                .padding(.bottom, Spacing.s12)
            }
            .refreshable { await Task { await refreshOwnPage() }.value }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("profileOwnerPage")
    }

    /// Edit profile and Preview as ▾.
    private var ownerActions: some View {
        ProfileActionRow {
            ProfileActionButton(title: "Edit profile", icon: .pencil)
                .button { showEditProfile = true }
                .accessibilityIdentifier("publicProfileEditProfile")
            ProfileActionButton(title: "Preview as", icon: .eye, style: .secondary, showsChevron: true)
                .button(spoken: "Preview your profile as") { showPreviewMenu = true }
                .accessibilityIdentifier("profilePreviewAs")
        }
    }

    @ViewBuilder
    private func ownerTips(_ payload: PublicProfileContent, owner: OwnerPageModel) -> some View {
        let canPin = viewModel.pinnedReadSucceeded && viewModel.pinnedPosts.isEmpty && !viewModel.postCards.cards.isEmpty
        let tips = owner.tips(for: payload.profile, canPin: canPin)
        if !tips.isEmpty {
            VStack(spacing: Spacing.s3) {
                ForEach(tips) { tip in
                    ProfileOwnerTipCard(
                        tip: tip,
                        // Pins are made from a post's ⋯ menu, in My posts; the rest in the editor.
                        onOpen: { if tip == .pinPost { open(.myPosts) } else { showEditProfile = true } },
                        onDismiss: { owner.dismiss(tip) }
                    )
                }
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.top, Spacing.s4)
        }
    }

    /// Your latest two posts, then "See all N posts" (My posts).
    private func ownerPosts(_ payload: PublicProfileContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            PublicProfilePostsFeed(
                kind: .local,
                posts: payload.posts,
                onUnlock: { _ in },
                localName: payload.header.displayName,
                loadFailed: viewModel.postsLoadFailed,
                onRetry: retryLoad,
                isOwnProfile: true,
                isLoading: viewModel.postsLoading,
                maxCards: 2,
                pulseCards: viewModel.postCards,
                onOpenPost: onOpenPost
            )
            let count = viewModel.postCards.cards.count
            if count > 0 {
                ProfileSeeAllPostsButton(count: count) { open(.myPosts) }
                    .padding(.horizontal, Spacing.s5)
            }
        }
        .padding(.top, Spacing.s3)
    }

    /// Your month, "Your account" and Log out.
    private func ownerExtras(_ owner: OwnerPageModel) -> some View {
        VStack(alignment: .leading, spacing: 28) {
            if let month = owner.monthLine {
                ProfileMonthCard(
                    title: month.title,
                    detail: month.detail,
                    onOpen: { showMonth = true },
                    onShare: owner.monthShareMessage.map { message in { @MainActor in shareText = message } }
                )
            }
            ProfileAccountSection(
                rows: accountRows(owner),
                onRow: { action in
                    switch action {
                    case let .open(destination): open(destination)
                    case .invite: shareText = owner.inviteShareMessage
                    }
                },
                onLogOut: { showSignOutConfirm = true }
            )
        }
    }

    private func accountRows(_ owner: OwnerPageModel) -> [ProfileAccountRow] {
        var rows = [
            ProfileAccountRow(
                id: "connections",
                icon: .users,
                title: "Connections",
                value: owner.connectionCount.map(String.init),
                action: .open(.connections)
            ),
            ProfileAccountRow(id: "supportTrains", icon: .handCoins, title: "Support trains", value: nil, action: .open(.supportTrains)),
            ProfileAccountRow(id: "savedPlaces", icon: .bookmark, title: "Saved places", value: nil, action: .open(.savedPlaces))
        ]
        // Shown once there's an invite link to share.
        if owner.inviteShareMessage != nil {
            rows.append(ProfileAccountRow(
                id: "invite",
                icon: .userPlus,
                title: "Invite neighbors",
                value: owner.inviteJoinedLabel,
                action: .invite
            ))
        }
        rows.append(ProfileAccountRow(
            id: "settings",
            icon: .slidersHorizontal,
            title: "Settings & privacy",
            value: nil,
            action: .open(.settings)
        ))
        rows.append(ProfileAccountRow(id: "help", icon: .helpCircle, title: "Help", value: nil, action: .open(.help)))
        #if DEBUG
        if onOwnerDestination != nil {
            rows.append(ProfileAccountRow(
                id: "developerTools", icon: .wrench, title: "Developer tools", value: nil, action: .open(.developerTools)
            ))
        }
        #endif
        return rows
    }

    /// The cover pushes the screen itself; a profile pushed in another tab
    /// asks the root to open the cover on it.
    func open(_ destination: ProfileOwnerDestination) {
        if let onOwnerDestination {
            onOwnerDestination(destination)
        } else {
            rootTabs?.profileCoverDestination = destination
        }
    }

    /// Share, with the one-time "pick a username for your link" first.
    func shareOwnProfile() {
        if viewModel.asksForUsernameBeforeSharing {
            viewModel.markAskedForUsername()
            usernameShare = UsernameShareSheetModel(currentUsername: viewModel.loadedUsername)
        } else {
            shareURL = viewModel.profileShareURL
        }
    }

    func refreshOwnPage() async {
        await viewModel.refresh()
        if viewModel.isOwnProfileLoaded { await owner?.load(force: true) }
    }

    /// Loads your extras once the page turns out to be yours; a monthly
    /// receipt push opens your month.
    func ownerPageAppeared() async {
        guard viewModel.isOwnProfileLoaded, let owner else { return }
        await owner.load()
        if expandMonthlyReceipt, owner.monthlyReceipt != nil { showMonth = true }
    }

    /// Your whole month (the receipt card the Me screen showed).
    @ViewBuilder var monthSheet: some View {
        if let receipt = owner?.monthlyReceipt {
            ScrollView {
                MonthlyReceiptCard(receipt: receipt, startExpanded: true) {
                    let message = owner?.monthShareMessage
                    showMonth = false
                    Task { @MainActor in
                        try? await Task.sleep(for: .milliseconds(600))
                        shareText = message
                    }
                }
                .padding(Spacing.s4)
            }
            .background(Theme.Color.appBg)
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Prompts and pins

    enum ExtrasMode {
        case visitor, owner, preview
    }

    /// "Get to know <name>" and "Pinned", between the header (or "You and")
    /// and the tabs. On your own profile Edit opens the editor; a preview
    /// shows them without opening anything.
    @ViewBuilder
    func promptsAndPins(_ payload: PublicProfileContent, firstName: String, mode: ExtrasMode) -> some View {
        let edit: (@MainActor () -> Void)? = mode == .owner ? { showEditProfile = true } : nil
        let prompts = ProfilePromptCatalog.shown(payload.profile.prompts)
        if !prompts.isEmpty {
            ProfilePromptsCard(firstName: firstName, prompts: prompts, onEdit: edit)
                .padding(.horizontal, Spacing.s5)
                .padding(.top, 28)
        }
        if !viewModel.pinnedPosts.isEmpty, viewModel.connection != .blocked {
            ProfilePinnedRow(posts: viewModel.pinnedPosts, onEdit: edit, onOpen: onOpenPost)
                .padding(.top, 28)
                .allowsHitTesting(mode != .preview)
        }
    }

    static func firstWord(_ name: String) -> String {
        name.split(separator: " ").first.map(String.init) ?? name
    }

    // MARK: - Preview as

    /// The chooser closed: open the preview it picked.
    func openPickedPreview() {
        guard let picked = pickedPreview else { return }
        pickedPreview = nil
        shownPreview = picked
    }

    @ViewBuilder
    func previewCover(_ audience: ProfileAudience) -> some View {
        if case let .loaded(payload) = viewModel.state {
            PublicProfileView(userId: payload.profile.id, onBack: { shownPreview = nil }, previewAudience: audience)
        }
    }

    /// Your profile as `audience` sees it: their buttons (shown, not used),
    /// their posts, and for anyone with the link "Posts are for neighbors".
    func previewLayout(
        _ payload: PublicProfileContent,
        neighbor: NeighborProfileContent,
        audience: ProfileAudience
    ) -> some View {
        let tabs = viewModel.localTabs(for: payload)
        let selected = tabs.contains(viewModel.selectedLocalTab) ? viewModel.selectedLocalTab : .posts
        return VStack(spacing: Spacing.s0) {
            ProfilePreviewBanner(audience: audience, onDone: onBack)
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
                        actions: { previewActions(payload, audience: audience) }
                    )
                    .accessibilityElement(children: .contain)
                    .accessibilityIdentifier("publicProfileLocalHeader")

                    promptsAndPins(payload, firstName: payload.header.firstName, mode: .preview)

                    if audience == .anyone {
                        // Signed-out visitors can't read posts (or pins).
                        ProfileSignInRequiredCard(firstName: payload.header.firstName)
                            .padding(.horizontal, Spacing.s5)
                            .padding(.top, 28)
                    } else {
                        LocalProfileTabStrip(
                            tabs: tabs,
                            postCount: viewModel.postCards.cards.isEmpty ? nil : viewModel.postCards.cards.count,
                            selected: selected
                        ) { viewModel.selectedLocalTab = $0 }
                            .padding(.top, 28)
                            .padding(.horizontal, Spacing.s5)
                        // What they see, not what they'd tap.
                        localTabContent(payload, neighbor: neighbor, tab: selected)
                            .allowsHitTesting(false)
                    }
                }
                .padding(.bottom, Spacing.s10)
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("profilePreview_\(audience.rawValue)")
    }

    /// The buttons that audience gets, drawn but not active.
    private func previewActions(_ payload: PublicProfileContent, audience: ProfileAudience) -> some View {
        Group {
            switch audience {
            case .anyone:
                ProfileActionButton(title: "Join Pantopus to connect with \(payload.header.firstName)", icon: .userPlus)
            case .neighbors:
                ProfileActionRow {
                    ProfileActionButton(title: "Connect", icon: .userPlus)
                    ProfileActionButton(title: "Message", icon: .messageSquare, style: .secondary)
                }
            case .connections:
                ProfileActionRow {
                    ProfileActionButton(title: "Message", icon: .messageSquare)
                    ProfileActionButton(title: "Connected", icon: .check, style: .secondary, showsChevron: true)
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityElement(children: .combine)
        .accessibilityHint("What they see. Buttons don't work in a preview.")
        .accessibilityIdentifier("profilePreviewButtons")
    }
}
