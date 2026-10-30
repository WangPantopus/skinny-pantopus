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
/// (`backend/routes/posts.js:3168`); the Pulse page uses them too.
let pulseReportReasons: [(key: String, label: String)] = [
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

/// The Pulse tab's top-right menu (Pulse S3): Nearby's people entries moved
/// here, beside the page's preferences.
public struct FeedTopMenu {
    /// Opens Connections (the existing screen).
    public let onOpenConnections: @MainActor () -> Void
    /// Opens Beacon Updates; nil while that launch cut is off.
    public let onOpenBeacons: (@MainActor () -> Void)?

    public init(onOpenConnections: @escaping @MainActor () -> Void, onOpenBeacons: (@MainActor () -> Void)? = nil) {
        self.onOpenConnections = onOpenConnections
        self.onOpenBeacons = onOpenBeacons
    }
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
    /// The assistant, opened from the header about what's nearby.
    @State private var askTopic: AIAskTopic?
    @FocusState private var searchFieldFocused: Bool
    /// The header has slid away: scrolling down hides it, scrolling up (or
    /// the map's reveal capsule) brings it back (founder request 2026-10-22).
    @State private var headerHidden = false
    @State private var quickReturn = PulseHeaderQuickReturn()
    /// The header block's height and the status bar's: the list starts below
    /// the one, the scrim covers the other.
    @State private var headerHeight: CGFloat = 0
    @State private var topSafeInset: CGFloat = 0
    /// Bumped by the "new posts" pill: the list scrolls back to the top.
    @State private var scrollToTopRequest = 0
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let onOpenPost: @MainActor (String) -> Void
    private let onCompose: @MainActor (PulseIntent) -> Void
    private let onEmptyCTA: (@MainActor () -> Void)?
    private let onFollowing: (@MainActor () -> Void)?
    private let onBack: (@MainActor () -> Void)?
    /// The top-right menu; nil keeps the plain preferences button.
    private let topMenu: FeedTopMenu?
    /// A card above the Nearby posts (the Pulse tab's quiet-state card).
    /// Type-erased so the slot doesn't make this shared screen generic.
    private let topCard: AnyView?
    /// Runs beside the feed's own read on a pull to refresh (the Pulse tab
    /// re-reads its quiet-state card's meter).
    private let onRefresh: (@MainActor () async -> Void)?
    /// The Nearby feed's header offers "Ask Pantopus" about what's nearby.
    private let asksPantopus: Bool
    /// Drawn above the top bar: the Nearby tab's segment header (the Pulse |
    /// Neighborhood switch and the side menu, founder decision 2026-10-20).
    private let header: AnyView?

    init(
        viewModel: PulseFeedViewModel? = nil,
        mapViewModel: FeedMapViewModel? = nil,
        onOpenPost: @escaping @MainActor (String) -> Void = { _ in },
        onCompose: @escaping @MainActor (PulseIntent) -> Void = { _ in },
        onEmptyCTA: (@MainActor () -> Void)? = nil,
        onFollowing: (@MainActor () -> Void)? = nil,
        onBack: (@MainActor () -> Void)? = nil,
        topMenu: FeedTopMenu? = nil,
        topCard: AnyView? = nil,
        onRefresh: (@MainActor () async -> Void)? = nil,
        header: AnyView? = nil,
        asksPantopus: Bool = false
    ) {
        // Swift 5.10 crashes while lowering PulseFeedViewModel() in a default-argument thunk.
        let resolved = viewModel ?? PulseFeedViewModel()
        let map = mapViewModel ?? FeedMapViewModel(surface: resolved.surface)
        _viewModel = State(initialValue: resolved)
        _mapViewModel = State(initialValue: map)
        // The feed's area callback references the context bar weakly. A new
        // area moves the map too.
        _contextBarViewModel = State(initialValue: FeedContextBarViewModel {
            Task { await resolved.refresh() }
            Task { await map.followChosenArea() }
        })
        self.onOpenPost = onOpenPost
        self.onCompose = onCompose
        self.onEmptyCTA = onEmptyCTA
        self.onFollowing = onFollowing
        self.onBack = onBack
        self.topMenu = topMenu
        self.topCard = topCard
        self.onRefresh = onRefresh
        self.header = header
        self.asksPantopus = asksPantopus
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // The list or the map fills the screen; the header floats over
            // its top and slides away as it scrolls (founder request 2026-10-22).
            ZStack(alignment: .top) {
                if viewMode == .map {
                    FeedMapView(
                        viewModel: mapViewModel,
                        query: FeedMapQuery(
                            surface: viewModel.surface,
                            postType: viewModel.activeIntent.postType
                        ),
                        searchText: viewModel.searchText,
                        topInset: isHeaderHidden ? Self.revealCapsuleHeight : headerHeight,
                        // The compose button: 52 pt, 40 pt off the bottom.
                        bottomClearance: viewModel.surface == .beacons ? 0 : 52 + Spacing.s10 + Spacing.s2,
                        onContentDrag: mapDragged,
                        onOpenPost: onOpenPost
                    )
                } else {
                    content
                }
                if showsNewPostsPill {
                    newPostsPill { scrollToTopRequest += 1 }
                        .padding(.top, isHeaderHidden ? 0 : headerHeight)
                }
                headerBlock
                    .offset(y: isHeaderHidden && !reduceMotion ? -(headerHeight + topSafeInset) : 0)
                    .opacity(isHeaderHidden && reduceMotion ? 0 : 1)
                    .allowsHitTesting(!isHeaderHidden)
                    .accessibilityHidden(isHeaderHidden)
                statusBarScrim
                if viewMode == .map, isHeaderHidden {
                    revealCapsule
                }
            }
            .background(Theme.Color.appBg)
            .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { topSafeInset = $0 }
            .animation(reduceMotion ? .easeInOut(duration: 0.2) : .snappy(duration: 0.25), value: isHeaderHidden)
            if viewModel.surface != .beacons {
                FeedComposeFAB { onCompose(viewModel.activeIntent) }
                    .padding(.trailing, Spacing.s4)
                    .padding(.bottom, Spacing.s10)
            }
        }
        // Anything that changes what's shown brings the header back.
        .onChange(of: viewMode) { _, _ in showHeader() }
        .onChange(of: viewModel.surface) { _, _ in showHeader() }
        .onChange(of: viewModel.activeIntent) { _, _ in showHeader() }
        .onChange(of: viewModel.activeTopic) { _, _ in showHeader() }
        .onChange(of: isSearchVisible) { _, _ in showHeader() }
        .onAppear { showHeader() }
        // Back from a post or another tab, the search box isn't still typing:
        // the keyboard came back by itself (founder report 2026-10-29).
        .onDisappear { searchFieldFocused = false }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .askPantopus($askTopic)
        .task {
            viewModel.onAreaResolved = { [weak contextBarViewModel] in
                contextBarViewModel?.applyCurrent($0)
            }
            viewModel.onFallbackArea = { [weak contextBarViewModel] in
                contextBarViewModel?.fallbackLabel = $0
            }
            await viewModel.load()
            if showsNearbyPosts { await NearbyFeedSeen.feedShown() }
        }
        // Back on Nearby from Connections, or loaded after an error.
        .onChange(of: showsNearbyPosts) { _, shown in
            if shown { Task { await NearbyFeedSeen.feedShown() } }
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
            ForEach(PulseIntent.filterCases, id: \.rawValue) { intent in
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
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulseFeed")
    }

    /// The Nearby feed (the one with Ask) shows its posts or its empty state.
    private var showsNearbyPosts: Bool {
        guard asksPantopus, viewModel.surface == .pulse else { return false }
        switch viewModel.state {
        case .loaded, .empty: return true
        case .loading, .error: return false
        }
    }

    // MARK: - Header

    /// Every item above the posts or the map, in one block that slides away
    /// as the content scrolls down and comes back as it scrolls up. Over the
    /// map a flick up on any of it tucks it away.
    private var headerBlock: some View {
        VStack(spacing: Spacing.s0) {
            VStack(spacing: Spacing.s0) {
                if let header { header }
                topBar
                if viewModel.surface == .beacons {
                    HStack(spacing: Spacing.s4) {
                        if let onEmptyCTA {
                            Button("Find Beacons", action: onEmptyCTA)
                                .frame(minHeight: 44)
                                .accessibilityIdentifier("beacons.find")
                        }
                        if let onFollowing {
                            Button("Following", action: onFollowing)
                                .frame(minHeight: 44)
                                .accessibilityIdentifier("beacons.following")
                        }
                        Spacer()
                    }
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s2)
                }
                if viewModel.showsSurfaceToggle {
                    surfaceTabs
                }
                if isSearchVisible {
                    searchField
                }
                if viewModel.surface == .pulse {
                    FeedContextBar(viewModel: contextBarViewModel)
                }
            }
            .modifier(PulseHeaderFlickRows(gesture: headerFlick, isEnabled: canFlickHeader, scrollsSideways: false))
            VStack(spacing: Spacing.s0) {
                if viewModel.showsTopics {
                    if LaunchFeatures.pulseRedesign {
                        PulseTopicChipRow(activeTopic: viewModel.activeTopic) { topic in
                            chipTapped { Task { await viewModel.selectTopic(topic) } }
                        }
                    } else {
                        // Launch cut #11 off: October 13's one topic lane, Sports.
                        PulseSportsLaneChipRow(activeTopic: viewModel.activeTopic) { topic in
                            chipTapped { Task { await viewModel.selectTopic(topic) } }
                        }
                    }
                }
                chipRow
            }
            .modifier(PulseHeaderFlickRows(gesture: headerFlick, isEnabled: canFlickHeader, scrollsSideways: true))
            VStack(spacing: Spacing.s0) {
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
            }
            .modifier(PulseHeaderFlickRows(gesture: headerFlick, isEnabled: canFlickHeader, scrollsSideways: false))
        }
        .background(Theme.Color.appBg)
        // Over the map, a soft edge lifts the header off it.
        .shadow(color: .black.opacity(viewMode == .map ? 0.10 : 0), radius: 6, x: 0, y: 3)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { headerHeight = $0 }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulseHeader")
    }

    /// Hidden only where there's something to scroll it away for, and never
    /// for VoiceOver, while searching, or on the Beacons surface.
    private var isHeaderHidden: Bool {
        guard headerHidden, !voiceOverEnabled, !searchFieldFocused, viewModel.surface != .beacons else { return false }
        if viewMode == .map { return true }
        if case .loaded = viewModel.state { return true }
        return false
    }

    /// Over the map the header can be flicked up out of the way (founder
    /// request 2026-10-22). Not over the list, where it would leave a blank
    /// band above the posts, and never where it may not hide.
    private var canFlickHeader: Bool {
        viewMode == .map && !voiceOverEnabled && !searchFieldFocused && viewModel.surface != .beacons
    }

    /// A mostly vertical drag on the header tucks it away once it has gone
    /// 24 points up, or sooner for a quick flick. The header stays put until
    /// then rather than following the finger: a button carried along under
    /// the finger would still take the tap when it lifts.
    private var headerFlick: some Gesture {
        DragGesture(minimumDistance: 12, coordinateSpace: .global)
            .onChanged { value in
                guard canFlickHeader, quickReturn.headerDragged(
                    from: value.startLocation,
                    translation: value.translation,
                    predicted: value.predictedEndTranslation
                ) else { return }
                flickHeaderAway()
            }
            .onEnded { _ in quickReturn.headerDragEnded() }
    }

    /// Flicked up: hidden as a map drag would hide it, so the map's drags
    /// and the capsule carry on from there.
    @MainActor
    private func flickHeaderAway() {
        quickReturn.hide()
        if !headerHidden { headerHidden = true }
    }

    /// Keeps the clock readable over whatever slides under it: the page's
    /// background over the list, frosted glass over the map.
    private var statusBarScrim: some View {
        Rectangle()
            .fill(viewMode == .map ? AnyShapeStyle(.ultraThinMaterial) : AnyShapeStyle(Theme.Color.appBg))
            .frame(height: topSafeInset)
            .frame(maxHeight: .infinity, alignment: .top)
            .ignoresSafeArea(edges: .top)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    private static let revealCapsuleHeight: CGFloat = 44

    /// Over the map with the header away: a glass capsule under the status
    /// bar that brings it back, naming what the map shows.
    private var revealCapsule: some View {
        Button {
            showHeader()
        } label: {
            HStack(spacing: 6) {
                Icon(.chevronDown, size: 14, strokeWidth: 2.4, color: Theme.Color.appText)
                Text(revealCapsuleLabel)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(height: 36)
            .background(Capsule().fill(.regularMaterial))
            .shadow(color: .black.opacity(0.12), radius: 5, x: 0, y: 2)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        // Pulled down, it brings the header back too, as a tap does.
        .simultaneousGesture(
            DragGesture(minimumDistance: 6).onChanged { value in
                let pull = value.translation.height
                if pull >= Self.revealPullDistance, pull > abs(value.translation.width) { showHeader() }
            }
        )
        .padding(.top, Self.revealCapsuleHeight - 36)
        .transition(.move(edge: .top).combined(with: .opacity))
        .accessibilityLabel("Show the Pulse header")
        .accessibilityIdentifier("pulseHeaderReveal")
    }

    /// How far the capsule is pulled down before the header comes back.
    private static let revealPullDistance: CGFloat = 16

    /// "Pulse · All", "Pulse · Event", "Pulse · Connections · Sports".
    private var revealCapsuleLabel: String {
        let surface = viewModel.surface == .pulse ? nil : viewModel.surface.toggleLabel
        let filter = viewModel.isInSportsLane ? "Sports" : viewModel.activeIntent.label
        return (["Pulse", surface, filter].compactMap { $0 }).joined(separator: " · ")
    }

    /// The map was dragged: its content moved `delta` points (`height` > 0:
    /// up). A mostly vertical drag scrolls the header, away after 16 points
    /// up, back after a deliberate 48 down, so panning around doesn't keep
    /// bringing it back.
    @MainActor
    private func mapDragged(_ delta: CGSize) {
        guard abs(delta.height) >= abs(delta.width) * 0.75 else { return }
        if let hidden = quickReturn.scroll(by: delta.height, hideAfter: 16, showAfter: 48) {
            headerHidden = hidden
        }
    }

    /// The list scrolled to `offset` (0 at the top).
    @MainActor
    private func listScrolled(to offset: CGFloat) {
        if let hidden = quickReturn.listScrolled(to: offset, nearTop: headerHeight) {
            headerHidden = hidden
        }
    }

    @MainActor
    private func showHeader() {
        quickReturn.reset()
        if headerHidden { headerHidden = false }
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
                    chipTapped { Task { await viewModel.selectSportsMode(mode) } }
                }
            }
        } else {
            FeedChipRow(
                chips: PulseIntent.filterCases.map { FeedChipItem(id: $0.rawValue, label: $0.label) },
                activeId: viewModel.activeIntent.rawValue,
                skeleton: isInitialLoading
            ) { id in
                let intent = PulseIntent(rawValue: id) ?? .all
                chipTapped { selectIntent(intent) }
            }
        }
    }

    /// A chip "tap" that lands as a flick which started on that chip tucks
    /// the header away belongs to the flick: the chip rows only watch the
    /// flick (so they keep scrolling sideways), and SwiftUI can still hand
    /// the chip the touch as the finger lifts.
    @MainActor
    private func chipTapped(_ select: () -> Void) {
        guard !quickReturn.justFlicked else { return }
        select()
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
                .dismissToast(after: toast, minimum: 2.5) {
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
                        .hitArea(horizontal: 4, vertical: 4)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("pulseBackButton")
            }
            // One line, shrinking a little where the Ask button leaves less room.
            Text(viewModel.surface.title)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Spacing.s1)
            if viewModel.surface.supportsMapMode {
                viewModeToggle.fixedSize(horizontal: true, vertical: false)
            }
            if asksPantopus {
                AskPantopusButton(accessibilityIdentifier: "pulseAskPantopus") {
                    askTopic = .nearby()
                } label: {
                    AskPantopusGlyph(size: 19)
                        .frame(width: 32, height: 36)
                        .hitArea(horizontal: 4, vertical: 4)
                }
            }
            Button {
                withAnimation(.easeOut(duration: 0.15)) { toggleSearch() }
            } label: {
                Icon(.search, size: 19, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
                    .hitArea(horizontal: 4, vertical: 4)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Search posts")
            .accessibilityIdentifier("pulseSearchButton")
            Button {
                showsIntentPicker = true
            } label: {
                Icon(.filter, size: 18, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
                    .hitArea(horizontal: 4, vertical: 4)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Filter posts")
            .accessibilityIdentifier("pulseFilterButton")
            if let topMenu {
                topMenuButton(topMenu)
            } else {
                Button {
                    viewModel.showsPreferences = true
                } label: {
                    Icon(.slidersHorizontal, size: 18, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                        .hitArea(horizontal: 4, vertical: 4)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Pulse preferences")
                .accessibilityIdentifier("pulsePreferencesButton")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    /// Connections (and Beacons while that launch cut is on), then the page's
    /// preferences: the Pulse tab's top-right menu.
    private func topMenuButton(_ menu: FeedTopMenu) -> some View {
        Menu {
            Button(action: menu.onOpenConnections) {
                Label { Text("Connections") } icon: { Icon(.users) }
            }
            .accessibilityIdentifier("pulseMenuConnections")
            if let onOpenBeacons = menu.onOpenBeacons {
                Button(action: onOpenBeacons) {
                    Label { Text("Beacons") } icon: { Icon(.radio) }
                }
                .accessibilityIdentifier("pulseMenuBeacons")
            }
            Button {
                viewModel.showsPreferences = true
            } label: {
                Label { Text("Pulse preferences") } icon: { Icon(.slidersHorizontal) }
            }
            .accessibilityIdentifier("pulseMenuPreferences")
        } label: {
            Icon(.moreHorizontal, size: 20, color: Theme.Color.appText)
                .frame(width: 36, height: 36)
                .hitArea(horizontal: 4, vertical: 4)
        }
        .accessibilityLabel("More")
        .accessibilityIdentifier("pulseMoreMenu")
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
                            color: active ? Theme.Color.primaryInk : Theme.Color.appTextSecondary
                        )
                        Text(tab.toggleLabel)
                            .font(.system(size: 14, weight: active ? .bold : .medium))
                            .foregroundStyle(active ? Theme.Color.primaryInk : Theme.Color.appTextSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                    .overlay(alignment: .bottom) {
                        Rectangle()
                            .fill(active ? Theme.Color.primaryInk : Color.clear)
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
                    .background(active ? Theme.Color.primarySolid : Color.clear)
                    .clipShape(Capsule())
                    .hitArea(vertical: 9)
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
        // Clearing the box keeps typing.
        .keepsKeyboardOnTap()
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

    /// The list's frames start below the header, which floats over them.
    private var content: some View {
        Group {
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
        .safeAreaPadding(.top, headerHeight)
    }

    private var loadingFrame: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(spacing: 1) {
                FeedSkeletonCard(edgeToEdge: true)
                FeedSkeletonCard(withTitle: true, edgeToEdge: true)
                FeedSkeletonCard(edgeToEdge: true)
                FeedSkeletonCard(edgeToEdge: true)
            }
            .background(Theme.Color.appBorderSubtle)
            .padding(.vertical, Spacing.s3)
        }
        .accessibilityIdentifier("pulseFeedLoading")
    }

    @ViewBuilder
    private func emptyFrame(_ content: FeedEmptyContent) -> some View {
        if let card = nearbyTopCard {
            // The quiet-state card sits above the empty state; together they scroll.
            ScrollView(.vertical, showsIndicators: true) {
                VStack(spacing: Spacing.s3) {
                    card
                        .padding(.bottom, Spacing.s5)
                    emptyStack(content)
                }
                .padding(Spacing.s5)
                .closesKeyboardFirst(searchFieldFocused)
            }
            .scrollDismissesKeyboard(.immediately)
            .accessibilityIdentifier("pulseFeedEmpty")
        } else {
            VStack(spacing: Spacing.s3) {
                Spacer()
                emptyStack(content)
                Spacer()
            }
            .padding(Spacing.s5)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .closesKeyboardFirst(searchFieldFocused)
            .accessibilityIdentifier("pulseFeedEmpty")
        }
    }

    /// The empty state's icon, words, button, scope footer and starters.
    @ViewBuilder
    private func emptyStack(_ content: FeedEmptyContent) -> some View {
        Icon(content.icon, size: 32, strokeWidth: 1.8, color: Theme.Color.primaryInk)
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
            if viewModel.needsArea {
                Task { await contextBarViewModel.openSwitcher() }
            } else if viewModel.quietTopic != nil {
                Task { await viewModel.selectTopic(nil) }
            } else if let onEmptyCTA {
                onEmptyCTA()
            } else {
                onCompose(viewModel.activeIntent)
            }
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(content.ctaIcon, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                Text(content.ctaLabel)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, 22)
            .frame(height: 44)
            .background(Theme.Color.primarySolid)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(viewModel.quietTopic == nil ? "pulseEmptyCreatePost" : "pulseTopicShowAll")
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
    }

    /// The top card, on the Nearby surface only.
    private var nearbyTopCard: AnyView? {
        viewModel.surface == .pulse ? topCard : nil
    }

    private func populatedFrame(_ rows: [PulsePostCardContent]) -> some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: true) {
                // While Search posts has the keyboard, a tap on the posts
                // only closes it (founder request 2026-10-29).
                postList(rows)
                    .closesKeyboardFirst(searchFieldFocused)
            }
            .scrollDismissesKeyboard(.immediately)
            .refreshable { await refreshFeedAndCard() }
            .onPulseListScroll { offset in listScrolled(to: offset) }
            .onChange(of: scrollToTopRequest) { _, _ in
                withAnimation { proxy.scrollTo(firstPostID ?? Self.listTopID, anchor: .top) }
            }
        }
        .accessibilityIdentifier("pulseFeedList")
    }

    /// The "new posts" pill shows over the list, below the header.
    private var showsNewPostsPill: Bool {
        guard viewMode == .list, viewModel.newPostsCount > 0, case .loaded = viewModel.state else { return false }
        return true
    }

    private static let listTopID = "pulseFeedTop"

    /// The first post on screen now: the pill scrolls to it (a lazy list
    /// can always find a post's row; the 1 pt marker is gone once far away).
    private var firstPostID: String? {
        guard case let .loaded(rows) = viewModel.state else { return nil }
        return rows.first?.id
    }

    /// Scrolled less than this from the top still reads as "at the top".
    private static let topSlack: CGFloat = 40

    /// "3 new posts": a refresh found new posts while the reader was further
    /// down; tapping shows them and goes back to the top.
    private func newPostsPill(scrollToTop: @escaping @MainActor () -> Void) -> some View {
        Button {
            viewModel.showNewPosts()
            // After the new page is in the list: a scroll in the same update is
            // undone by the list keeping the reader's rows in place.
            Task { @MainActor in scrollToTop() }
        } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.arrowUp, size: 14, color: Theme.Color.appTextInverse)
                Text(viewModel.newPostsCount == 1 ? "1 new post" : "\(viewModel.newPostsCount) new posts")
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 36)
            .background(Theme.Color.primary600)
            .clipShape(Capsule())
            .pantopusShadow(.sm)
        }
        .buttonStyle(.plain)
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("pulseFeedNewPosts")
    }

    private func postList(_ rows: [PulsePostCardContent]) -> some View {
        LazyVStack(spacing: Spacing.s0) {
            // Whether the reader is at the top decides if new posts slide in or
            // wait behind the pill: where this marker is in the scroll view, not
            // whether it appeared (a pushed post coming back re-appears it).
            // The list starts below the header, which it scrolls under.
            Color.clear
                .frame(height: 1)
                .id(Self.listTopID)
                .onGeometryChange(for: Bool.self) { [threshold = headerHeight - Self.topSlack] proxy in
                    proxy.frame(in: .scrollView).minY > threshold
                } action: { atTop in
                    viewModel.isReadingAtTop = atTop
                }
                .accessibilityHidden(true)
            if let card = nearbyTopCard {
                card
                    .padding(Spacing.s3)
            }
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
            } else if let message = viewModel.loadMoreError {
                VStack(spacing: Spacing.s2) {
                    Text(message)
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Button("Try again") {
                        Task { await viewModel.retryLoadMore() }
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("pulseFeedLoadMoreRetry")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s3)
            }
            Spacer(minLength: 80)
        }
        .padding(.vertical, Spacing.s3)
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
        // The post opens out of this card and closes back into it.
        .itemZoomSource(.post, id: row.id)
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
                    .background(Theme.Color.primarySolid)
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

    /// Pull to refresh: the feed, and beside it the host's own read.
    @MainActor
    private func refreshFeedAndCard() async {
        let card = onRefresh.map { work in Task { @MainActor in await work() } }
        await viewModel.refresh()
        await card?.value
    }
}

/// Rows of the Pulse header that a flick up tucks away. On rows of buttons
/// the flick takes precedence once the finger has moved, so the button it
/// started on doesn't also take the tap; a tap still reaches the button. On
/// the chip rows it only watches, so they keep scrolling sideways (and their
/// scroll already stops the chip under the finger). Their blank space takes
/// the flick too.
private struct PulseHeaderFlickRows<Flick: Gesture>: ViewModifier {
    let gesture: Flick
    let isEnabled: Bool
    let scrollsSideways: Bool

    func body(content: Content) -> some View {
        let mask: GestureMask = isEnabled ? .all : .subviews
        if scrollsSideways {
            content
                .contentShape(Rectangle())
                .simultaneousGesture(gesture, including: mask)
        } else {
            content
                .contentShape(Rectangle())
                .highPriorityGesture(gesture, including: mask)
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
            .alert("Close this question?", isPresented: presentingCloseAsk) {
                Button("Close", role: .destructive) {
                    guard let id = viewModel.closingAskPostId else { return }
                    viewModel.closingAskPostId = nil
                    run { await viewModel.closeAsk(postId: id) }
                }
                .accessibilityIdentifier("pulseAskCloseConfirm")
                Button("Cancel", role: .cancel) { viewModel.closingAskPostId = nil }
            } message: {
                Text("It leaves Pulse. You can restore it from My posts.")
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
            // Pulse S4: everywhere until areas exist (S5 adds "in this area").
            // Not on your own post, which a topic mute never hides.
            if !actions.isSeeded, !actions.isOwner, row.pulseTopic != nil {
                Button("Mute this topic") {
                    dismissOverflow()
                    run { await viewModel.mutePulseTopic(postId: row.id) }
                }
                .accessibilityIdentifier("pulseFeedOverflowMuteThisTopic")
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
            if actions.canKeepAskOpen {
                Button("Keep open 7 more days") {
                    dismissOverflow()
                    run { await viewModel.keepAskOpen(postId: row.id) }
                }
                .accessibilityIdentifier("pulseAskKeepOpen")
            }
            if actions.canCloseAsk {
                Button("Close") {
                    viewModel.overflowPostId = nil
                    viewModel.closingAskPostId = row.id
                }
                .accessibilityIdentifier("pulseAskClose")
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

    private var presentingCloseAsk: Binding<Bool> {
        Binding(
            get: { viewModel.closingAskPostId != nil },
            set: { shown in if !shown { viewModel.closingAskPostId = nil } }
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

private extension View {
    /// Reports how far the list has scrolled from its top, for the header's
    /// quick return. iOS 18 and later; on iOS 17 the header stays put over
    /// the list (the map still moves it).
    @ViewBuilder
    func onPulseListScroll(_ action: @escaping (CGFloat) -> Void) -> some View {
        if #available(iOS 18.0, *) {
            onScrollGeometryChange(for: CGFloat.self) { geometry in
                geometry.contentOffset.y + geometry.contentInsets.top
            } action: { _, offset in
                action(offset)
            }
        } else {
            self
        }
    }
}

#Preview {
    FeedView()
}
