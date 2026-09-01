//
//  FeedView.swift
//  Pantopus
//
//  Pulse tab — the public neighborhood feed reached from
//  Hub → pillar(.pulse). Replaces the legacy List-of-Strings stub with
//  the designed Pulse archetype: chip-row filter, intent-colored cards,
//  shimmer skeleton, verified-floor empty state, persistent compose FAB.
//

import SwiftUI

// swiftlint:disable type_body_length file_length

/// Report reasons accepted by `reportPostSchema`
/// (`backend/routes/posts.js:3168`).
private let pulseReportReasons: [(key: String, label: String)] = [
    ("spam", "Spam"),
    ("harassment", "Harassment"),
    ("inappropriate", "Inappropriate content"),
    ("misinformation", "Misinformation"),
    ("safety", "Safety concern"),
    ("other", "Other")
]

/// Payload handed to the system share sheet.
private struct FeedShareTarget: Identifiable {
    let id: String
    let url: URL
}

/// Pulse tab entry point.
public struct FeedView: View {
    @State private var viewModel: PulseFeedViewModel
    /// Map-mode engine. Lazily activated the first time the Map segment
    /// is selected (`FeedMapView.task`).
    @State private var mapViewModel: FeedMapViewModel
    /// Viewing-location switcher above the Nearby feed — RN
    /// `FeedScreen.tsx:151-155`.
    @State private var contextBarViewModel: FeedContextBarViewModel
    /// List / Map segment — mirrors RN `FeedHeader.tsx:35-52`.
    @State private var viewMode: FeedViewMode = .list
    @State private var isSearchVisible = false
    @State private var showsIntentPicker = false
    /// Sports starter tapped in the empty state — presents the compose
    /// flow with the prompt already in the body.
    @State private var sportsStarter: PulseSportsStarter?
    /// Non-nil while the system share sheet is up for one post.
    @State private var shareTarget: FeedShareTarget?
    @FocusState private var searchFieldFocused: Bool
    private let onOpenPost: @MainActor (String) -> Void
    private let onCompose: @MainActor (PulseIntent) -> Void
    private let onEmptyCTA: (@MainActor () -> Void)?
    private let onBack: (@MainActor () -> Void)?

    init(
        viewModel: PulseFeedViewModel? = nil,
        mapViewModel: FeedMapViewModel? = nil,
        onOpenPost: @escaping @MainActor (String) -> Void = { _ in },
        onCompose: @escaping @MainActor (PulseIntent) -> Void = { _ in },
        onEmptyCTA: (@MainActor () -> Void)? = nil,
        onBack: (@MainActor () -> Void)? = nil
    ) {
        // Swift 5.10 crashes while lowering PulseFeedViewModel() in a default-argument thunk.
        let resolved = viewModel ?? PulseFeedViewModel()
        _viewModel = State(initialValue: resolved)
        _mapViewModel = State(initialValue: mapViewModel ?? FeedMapViewModel(surface: resolved.surface))
        // No retain cycle: the feed view-model never references the
        // context bar back.
        _contextBarViewModel = State(initialValue: FeedContextBarViewModel {
            Task { await resolved.refresh() }
        })
        self.onOpenPost = onOpenPost
        self.onCompose = onCompose
        self.onEmptyCTA = onEmptyCTA
        self.onBack = onBack
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: Spacing.s0) {
                topBar
                if viewModel.showsSurfaceToggle {
                    surfaceTabs
                }
                if isSearchVisible {
                    searchField
                }
                if viewModel.surface == .pulse {
                    FeedContextBar(viewModel: contextBarViewModel)
                }
                if !viewModel.availableTopics.isEmpty {
                    PulseTopicChipRow(
                        topics: viewModel.availableTopics,
                        activeTopic: viewModel.activeTopic
                    ) { topic in
                        Task { await viewModel.selectTopic(topic) }
                    }
                }
                chipRow
                if viewModel.isInSportsLane, let event = viewModel.primarySportsEvent {
                    PulseSportsEventModule(
                        event: event,
                        onSeeThreads: {
                            Task { await viewModel.selectSportsEvent(eventKey: event.eventKey) }
                        },
                        onStartThread: { onCompose(viewModel.activeIntent) }
                    )
                }
                if viewModel.surface == .pulse, let suggestion = viewModel.radiusSuggestion {
                    FeedRadiusSuggestionBanner(
                        suggestion: suggestion,
                        onApply: {
                            Task {
                                if await contextBarViewModel.applyRadius(suggestion.suggestedRadius) {
                                    viewModel.viewingRadiusMiles = suggestion.suggestedRadius
                                }
                            }
                        },
                        onDismiss: { viewModel.dismissRadiusSuggestion() }
                    )
                }
                if viewMode == .map {
                    FeedMapView(
                        viewModel: mapViewModel,
                        query: FeedMapQuery(
                            surface: viewModel.surface,
                            postType: viewModel.activeIntent.postType
                        ),
                        onOpenPost: onOpenPost
                    )
                } else {
                    content
                }
            }
            .background(Theme.Color.appBg)
            FeedComposeFAB { onCompose(viewModel.activeIntent) }
                .padding(.trailing, Spacing.s4)
                .padding(.bottom, Spacing.s10)
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .task {
            guard viewModel.surface == .pulse else { return }
            await contextBarViewModel.load()
            viewModel.viewingRadiusMiles = contextBarViewModel.radiusMiles
        }
        .onReceive(NotificationCenter.default.publisher(for: .pulsePostsDidChange)) { _ in
            Task { await viewModel.refresh() }
        }
        .onAppear { Analytics.track(.screenPulseFeedViewed(intent: viewModel.activeIntent.rawValue)) }
        .confirmationDialog(
            "Filter by intent",
            isPresented: $showsIntentPicker,
            titleVisibility: .visible
        ) {
            ForEach(PulseIntent.allCases, id: \.rawValue) { intent in
                Button(intent.label) { selectIntent(intent) }
            }
            Button("Cancel", role: .cancel) {}
        }
        .modifier(FeedPostActionSurfaces(
            viewModel: viewModel,
            shareTarget: $shareTarget,
            overflowRow: overflowRow
        ))
        .overlay(alignment: .bottom) { toastOverlay }
        .fullScreenCover(item: $sportsStarter) { starter in
            PulseComposeFlowView(
                prefillFeedIntent: .ask,
                prefillBody: starter.placeholder,
                onCancel: { sportsStarter = nil },
                onPosted: { _ in
                    sportsStarter = nil
                    Task { await viewModel.refresh() }
                }
            )
        }
        .accessibilityIdentifier("pulseFeed")
    }

    /// Open the composer pre-filled from a Sports starter prompt.
    @MainActor
    private func onComposeStarter(_ starter: PulseSportsStarter) {
        sportsStarter = starter
    }

    /// Filter chips. Inside a topic lane the post-type row is replaced by
    /// the lane's own mode chips — RN `FeedScreen.tsx:129`.
    @ViewBuilder private var chipRow: some View {
        if viewModel.isInSportsLane {
            let chips = viewModel.sportsModeChips
            if !chips.isEmpty {
                FeedChipRow(
                    chips: chips.map { FeedChipItem(id: $0.mode.rawValue, label: $0.label) },
                    activeId: viewModel.sportsMode.rawValue,
                    skeleton: isInitialLoading
                ) { id in
                    let mode = PulseSportsMode(rawValue: id) ?? .forYou
                    Task { await viewModel.selectSportsMode(mode) }
                }
            }
        } else {
            FeedChipRow(
                chips: PulseIntent.allCases.map { FeedChipItem(id: $0.rawValue, label: $0.label) },
                activeId: viewModel.activeIntent.rawValue,
                skeleton: isInitialLoading
            ) { id in
                let intent = PulseIntent(rawValue: id) ?? .all
                selectIntent(intent)
            }
        }
    }

    /// The row whose overflow menu is open, if any.
    private var overflowRow: PulsePostCardContent? {
        guard let id = viewModel.overflowPostId,
              case let .loaded(rows) = viewModel.state else { return nil }
        return rows.first { $0.id == id }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toastMessage {
            ToastView(message: ToastMessage(text: toast, kind: .neutral))
                .padding(.bottom, Spacing.s16)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .accessibilityIdentifier("pulseFeedToast")
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toastMessage = nil
                }
        }
    }

    private var topBar: some View {
        HStack(spacing: Spacing.s0) {
            if let onBack {
                Button(action: onBack) {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("pulseBackButton")
            }
            Text(viewModel.surface.title)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            if viewModel.surface.supportsMapMode {
                viewModeToggle
            }
            Button {
                withAnimation(.easeOut(duration: 0.15)) { toggleSearch() }
            } label: {
                Icon(.search, size: 19, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Search posts")
            .accessibilityIdentifier("pulseSearchButton")
            Button {
                showsIntentPicker = true
            } label: {
                Icon(.filter, size: 18, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Filter posts")
            .accessibilityIdentifier("pulseFilterButton")
            Button {
                viewModel.showsPreferences = true
            } label: {
                Icon(.slidersHorizontal, size: 18, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Pulse preferences")
            .accessibilityIdentifier("pulsePreferencesButton")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    /// Nearby / Connections surface toggle — RN
    /// `src/components/feed/FeedSurfaceTabs.tsx:19-33`. Switching hits
    /// `GET /api/posts/feed?surface=place|connections`.
    private var surfaceTabs: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(FeedSurface.toggleSurfaces, id: \.rawValue) { tab in
                let active = viewModel.surface == tab
                Button {
                    selectSurface(tab)
                } label: {
                    HStack(spacing: 6) {
                        Icon(
                            tab.toggleIcon,
                            size: 15,
                            strokeWidth: 2.2,
                            color: active ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                        )
                        Text(tab.toggleLabel)
                            .font(.system(size: 14, weight: active ? .bold : .medium))
                            .foregroundStyle(active ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                    .overlay(alignment: .bottom) {
                        Rectangle()
                            .fill(active ? Theme.Color.primary600 : Color.clear)
                            .frame(height: 2)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.toggleLabel)
                .accessibilityAddTraits(active ? [.isSelected] : [])
                .accessibilityIdentifier("pulseSurfaceTab_\(tab.rawValue)")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("pulseSurfaceTabs")
    }

    /// List / Map segmented pill. RN hides it on the `personas`
    /// (Beacons) surface — `FeedHeader.tsx:36`.
    private var viewModeToggle: some View {
        HStack(spacing: 2) {
            ForEach(FeedViewMode.allCases, id: \.rawValue) { mode in
                let active = viewMode == mode
                Button {
                    withAnimation(.easeOut(duration: 0.15)) { viewMode = mode }
                } label: {
                    HStack(spacing: 5) {
                        Icon(
                            mode.icon,
                            size: 13,
                            strokeWidth: 2.4,
                            color: active ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary
                        )
                        Text(mode.label)
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                    }
                    .padding(.horizontal, 10)
                    .frame(height: 26)
                    .background(active ? Theme.Color.primary600 : Color.clear)
                    .clipShape(Capsule())
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pulseViewModeSegment_\(mode.rawValue)")
                .accessibilityLabel(mode.label)
                .accessibilityAddTraits(active ? [.isSelected] : [])
            }
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .accessibilityIdentifier("pulseViewModeToggle")
    }

    private var searchField: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 14, color: Theme.Color.appTextMuted)
            TextField(
                "Search posts",
                text: Binding(
                    get: { viewModel.searchText },
                    set: { viewModel.searchText = $0 }
                )
            )
            .font(Theme.Font.role(.small))
            .foregroundStyle(Theme.Color.appText)
            .focused($searchFieldFocused)
            .submitLabel(.search)
            .accessibilityIdentifier("pulseSearchField")
            if !viewModel.searchText.isEmpty {
                Button {
                    viewModel.searchText = ""
                } label: {
                    Icon(.x, size: 13, color: Theme.Color.appTextMuted)
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 36)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s2)
        .background(Theme.Color.appBg)
    }

    @MainActor
    private func toggleSearch() {
        isSearchVisible.toggle()
        if isSearchVisible {
            searchFieldFocused = true
        } else {
            viewModel.searchText = ""
            searchFieldFocused = false
        }
    }

    private var isInitialLoading: Bool {
        if case .loading = viewModel.state { return true }
        return false
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingFrame
        case let .empty(content):
            emptyFrame(content)
        case let .loaded(rows):
            populatedFrame(rows)
        case let .error(message):
            errorFrame(message: message)
        }
    }

    private var loadingFrame: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(spacing: Spacing.s2) {
                FeedSkeletonCard()
                FeedSkeletonCard(withTitle: true)
                FeedSkeletonCard()
                FeedSkeletonCard()
            }
            .padding(Spacing.s3)
        }
        .accessibilityIdentifier("pulseFeedLoading")
    }

    private func emptyFrame(_ content: FeedEmptyContent) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(content.icon, size: 32, strokeWidth: 1.8, color: Theme.Color.primary600)
                .frame(width: 72, height: 72)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            Text(content.headline)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text(content.body)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 268)
            Button {
                if let onEmptyCTA { onEmptyCTA() } else { onCompose(viewModel.activeIntent) }
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(content.ctaIcon, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text(content.ctaLabel)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, 22)
                .frame(height: 44)
                .background(Theme.Color.primary600)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pulseEmptyCreatePost")
            if let emphasis = content.footerEmphasis, !emphasis.isEmpty {
                HStack(spacing: Spacing.s2) {
                    Icon(content.footerIcon, size: 13, color: Theme.Color.appTextMuted)
                    Group {
                        Text(content.footerLead)
                            .font(.system(size: 11.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            + Text(emphasis)
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                            + Text(content.footerTrail)
                            .font(.system(size: 11.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .padding(.top, Spacing.s4)
            }
            // Sports lane starter prompts — tapping one opens the
            // composer pre-filled (RN `FeedEmptyState` starters).
            if viewModel.isInSportsLane {
                PulseSportsStarterRow { starter in
                    onComposeStarter(starter)
                }
                .padding(.top, Spacing.s4)
            }
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("pulseFeedEmpty")
    }

    private func populatedFrame(_ rows: [PulsePostCardContent]) -> some View {
        ScrollView(.vertical, showsIndicators: true) {
            // Card gap is 10 per the A03 frame (off-scale by design).
            LazyVStack(spacing: 10) {
                if rows.isEmpty, !viewModel.searchText.isEmpty {
                    Text("No posts match your search")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.top, Spacing.s8)
                }
                ForEach(rows) { row in
                    postCard(row)
                        .onAppear {
                            let id = row.id
                            Task { await viewModel.loadMoreIfNeeded(rowId: id) }
                        }
                }
                if viewModel.isLoadingMore {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.s3)
                        .accessibilityLabel("Loading more posts")
                }
                Spacer(minLength: 80)
            }
            .padding(Spacing.s3)
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("pulseFeedList")
    }

    private func postCard(_ row: PulsePostCardContent) -> some View {
        let onRSVP: (@MainActor () -> Void)? = {
            guard row.attendees != nil else { return nil }
            return { @MainActor in react(to: row.id) }
        }()
        let seeded = row.actions.isSeeded
        var onOverflow: (@MainActor () -> Void)?
        var onDismissSeeded: (@MainActor () -> Void)?
        var onToggleSave: (@MainActor () -> Void)?
        var onToggleRepost: (@MainActor () -> Void)?
        if seeded {
            onDismissSeeded = { @MainActor in run { await viewModel.dismissSeededFact(factId: row.id) } }
        } else {
            onOverflow = { @MainActor in viewModel.overflowPostId = row.id }
            onToggleSave = { @MainActor in run { await viewModel.toggleSave(postId: row.id) } }
            onToggleRepost = { @MainActor in run { await viewModel.toggleRepost(postId: row.id) } }
        }
        return PulsePostCard(
            content: row,
            onTap: { onOpenPost(row.id) },
            onPrimaryReaction: { react(to: row.id) },
            onRSVP: onRSVP,
            onOverflow: onOverflow,
            onDismissSeeded: onDismissSeeded,
            onToggleSave: onToggleSave,
            onToggleRepost: onToggleRepost
        )
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load Pulse")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                refresh()
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
            .accessibilityIdentifier("pulseFeedRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("pulseFeedError")
    }

    @MainActor
    private func selectIntent(_ intent: PulseIntent) {
        let _: Task<Void, Never> = Task(priority: nil) { @MainActor in
            await viewModel.selectIntent(intent)
        }
    }

    /// Fire-and-forget helper for the overflow actions.
    @MainActor
    private func run(_ operation: @escaping @MainActor () async -> Void) {
        let _: Task<Void, Never> = Task(priority: nil) { @MainActor in
            await operation()
        }
    }

    @MainActor
    private func selectSurface(_ next: FeedSurface) {
        guard next != viewModel.surface else { return }
        // Land on the list while the new surface loads; the map picks the
        // new surface up through its `FeedMapQuery`.
        viewMode = .list
        let _: Task<Void, Never> = Task(priority: nil) { @MainActor in
            await viewModel.selectSurface(next)
        }
    }

    @MainActor
    private func react(to postId: String) {
        let _: Task<Void, Never> = Task(priority: nil) { @MainActor in
            await viewModel.tapReaction(postId: postId)
        }
    }

    @MainActor
    private func refresh() {
        let _: Task<Void, Never> = Task(priority: nil) { @MainActor in
            await viewModel.refresh()
        }
    }
}

/// Every modal the Pulse card overflow menu drives: the menu itself, the
/// report-reason picker, the delete + mute confirms, the system share
/// sheet, and the Pulse preferences sheet. Split out of `FeedView.body`
/// so the type-checker (and SwiftLint's body-length rule) stay happy.
@MainActor
private struct FeedPostActionSurfaces: ViewModifier {
    let viewModel: PulseFeedViewModel
    @Binding var shareTarget: FeedShareTarget?
    let overflowRow: PulsePostCardContent?

    func body(content: Content) -> some View {
        content
            .confirmationDialog(
                "Post options",
                isPresented: presentingOverflow,
                titleVisibility: .visible
            ) {
                overflowMenu
            }
            .confirmationDialog(
                "Report this post?",
                isPresented: presentingReport,
                titleVisibility: .visible
            ) {
                ForEach(pulseReportReasons, id: \.key) { reason in
                    Button(reason.label) {
                        guard let id = viewModel.reportingPostId else { return }
                        viewModel.reportingPostId = nil
                        run { await viewModel.reportPost(postId: id, reason: reason.key) }
                    }
                    .accessibilityIdentifier("pulseFeedReportReason_\(reason.key)")
                }
                Button("Cancel", role: .cancel) { viewModel.reportingPostId = nil }
            } message: {
                Text("Reports are reviewed by the Pantopus team. The author isn't told who reported.")
            }
            .confirmationDialog(
                "Delete post?",
                isPresented: presentingDelete,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    guard let id = viewModel.deletingPostId else { return }
                    viewModel.deletingPostId = nil
                    run { await viewModel.deletePost(postId: id) }
                }
                .accessibilityIdentifier("pulseFeedDeleteConfirm")
                Button("Cancel", role: .cancel) { viewModel.deletingPostId = nil }
            } message: {
                Text("This will permanently remove your post.")
            }
            .confirmationDialog(
                muteTitle,
                isPresented: presentingMute,
                titleVisibility: .visible
            ) {
                Button("Mute", role: .destructive) {
                    guard let id = viewModel.mutingPostId else { return }
                    viewModel.mutingPostId = nil
                    run { await viewModel.muteAuthor(postId: id) }
                }
                .accessibilityIdentifier("pulseFeedMuteConfirm")
                Button("Cancel", role: .cancel) { viewModel.mutingPostId = nil }
            } message: {
                Text("You won't see their posts in any feed. You can undo this from their profile.")
            }
            .sheet(item: $shareTarget) { target in
                SystemShareSheet(items: [target.url])
                    .onDisappear {
                        run { await viewModel.recordShare(postId: target.id) }
                    }
            }
            .sheet(isPresented: presentingPreferences) {
                FeedPreferencesSheet(
                    onClose: { viewModel.showsPreferences = false },
                    onPrefsChanged: { run { await viewModel.refresh() } }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
    }

    @ViewBuilder private var overflowMenu: some View {
        if let row = overflowRow {
            let actions = row.actions
            Button(actions.isSaved ? "Remove bookmark" : "Save post") {
                dismissOverflow()
                run { await viewModel.toggleSave(postId: row.id) }
            }
            .accessibilityIdentifier("pulseFeedOverflowSave")
            Button(actions.isReposted ? "Undo repost" : "Repost") {
                dismissOverflow()
                run { await viewModel.toggleRepost(postId: row.id) }
            }
            .accessibilityIdentifier("pulseFeedOverflowRepost")
            if let url = viewModel.shareURL(postId: row.id) {
                Button("Share…") {
                    dismissOverflow()
                    shareTarget = FeedShareTarget(id: row.id, url: url)
                }
                .accessibilityIdentifier("pulseFeedOverflowShare")
            }
            Button("Hide this post") {
                dismissOverflow()
                run { await viewModel.hidePost(postId: row.id) }
            }
            .accessibilityIdentifier("pulseFeedOverflowHide")
            if actions.canFlagNotHelpful {
                Button("Not helpful here") {
                    dismissOverflow()
                    run { await viewModel.markNotHelpful(postId: row.id) }
                }
                .accessibilityIdentifier("pulseFeedOverflowNotHelpful")
            }
            if actions.canMuteAuthor {
                Button("Mute \(actions.muteEntityName)") {
                    viewModel.overflowPostId = nil
                    viewModel.mutingPostId = row.id
                }
                .accessibilityIdentifier("pulseFeedOverflowMuteAuthor")
            }
            if actions.canMuteTopic, let topic = actions.topicLabel, !topic.isEmpty {
                Button("Mute \(topic) posts") {
                    dismissOverflow()
                    run { await viewModel.muteTopic(postId: row.id) }
                }
                .accessibilityIdentifier("pulseFeedOverflowMuteTopic")
            }
            if actions.canMarkSolved {
                Button("Mark solved") {
                    dismissOverflow()
                    run { await viewModel.markSolved(postId: row.id) }
                }
                .accessibilityIdentifier("pulseFeedOverflowMarkSolved")
            }
            if actions.canReport {
                Button("Report post", role: .destructive) {
                    viewModel.overflowPostId = nil
                    viewModel.reportingPostId = row.id
                }
                .accessibilityIdentifier("pulseFeedOverflowReport")
            }
            if actions.canDelete {
                Button("Delete post", role: .destructive) {
                    viewModel.overflowPostId = nil
                    viewModel.deletingPostId = row.id
                }
                .accessibilityIdentifier("pulseFeedOverflowDelete")
            }
            Button("Cancel", role: .cancel) { dismissOverflow() }
        }
    }

    private var muteTitle: String {
        "Mute \(overflowMuteName)?"
    }

    private var overflowMuteName: String {
        guard let id = viewModel.mutingPostId,
              case let .loaded(rows) = viewModel.state,
              let row = rows.first(where: { $0.id == id }) else { return "this author" }
        return row.actions.muteEntityName
    }

    @MainActor
    private func dismissOverflow() {
        viewModel.overflowPostId = nil
    }

    /// Each dialog presents while its view-model id is non-nil and clears
    /// that id when dismissed.
    private var presentingOverflow: Binding<Bool> {
        Binding(
            get: { viewModel.overflowPostId != nil },
            set: { shown in if !shown { viewModel.overflowPostId = nil } }
        )
    }

    private var presentingReport: Binding<Bool> {
        Binding(
            get: { viewModel.reportingPostId != nil },
            set: { shown in if !shown { viewModel.reportingPostId = nil } }
        )
    }

    private var presentingDelete: Binding<Bool> {
        Binding(
            get: { viewModel.deletingPostId != nil },
            set: { shown in if !shown { viewModel.deletingPostId = nil } }
        )
    }

    private var presentingMute: Binding<Bool> {
        Binding(
            get: { viewModel.mutingPostId != nil },
            set: { shown in if !shown { viewModel.mutingPostId = nil } }
        )
    }

    private var presentingPreferences: Binding<Bool> {
        Binding(
            get: { viewModel.showsPreferences },
            set: { viewModel.showsPreferences = $0 }
        )
    }

    @MainActor
    private func run(_ operation: @escaping @MainActor () async -> Void) {
        let _: Task<Void, Never> = Task(priority: nil) { @MainActor in
            await operation()
        }
    }
}

#Preview {
    FeedView()
}
