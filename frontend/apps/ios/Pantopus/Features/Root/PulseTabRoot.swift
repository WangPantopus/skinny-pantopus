//
//  PulseTabRoot.swift
//  Pantopus
//
//  The Pulse tab (Pulse S3: a tab of the bar, where it used to be a sheet
//  from the Nearby door). Hosts its own NavigationStack so drill-down
//  survives tab switches. Nearby's other content moved here: Connections
//  (and Beacons, while that launch cut is on) open from the page's top-right
//  menu, and the neighborhood meter and "Set up a home" are one quiet-state
//  card at the top of the feed. The launch-cut Tasks and Marketplace surfaces
//  still present as sheets from here when a link asks for them
//  (`NeighborhoodDoorStore`).
//
//  While the Pulse redesign is off (launch cut #11) this is the October 13
//  Pulse instead, inside the bar's Pulse tab (`NeighborhoodTabRoot`, named
//  Nearby until the founder's November 7 decision): the feed (`FeedView`)
//  under its List | Map switch and the side menu, and the tab root presents
//  Tasks and Marketplace itself. On a wide screen (the iPhone Duo open, held
//  sideways) that feed and the open post sit side by side (`PulseSplitView`);
//  the feed's models live here, so a fold or a turn keeps its posts, filters
//  and List / Map.
//

import SwiftUI

/// Typed routes within the Pulse tab's NavigationStack.
public enum PulseRoute: Hashable {
    case post(postId: String)
    case compose(intent: String)
    case editPost(postId: String)
    case publicProfile(userId: String)
    /// A DM opened from a profile's Message button.
    case chatConversation(InboxConversationDestination)
}

/// NavigationStack wrapper for the Pulse tab.
public struct PulseTabRoot: View {
    @Environment(AuthManager.self) private var auth
    @Environment(RootTabModel.self) private var rootTabs
    @State private var path = RouteStack<PulseRoute>()
    @State private var navigationReady = false
    @State private var router = DeepLinkRouter.shared
    @State private var door = NeighborhoodDoorStore.shared
    @State private var presentedSurface: NeighborhoodDoorStore.Surface?
    /// The quiet-state card's meter, held here so a pull to refresh re-reads
    /// it with the feed (as a pull on the old Nearby door did).
    @State private var neighborhood = NeighborhoodViewModel()
    /// The October 13 feed's models (posts and filters, map, viewing area) and its List / Map, kept while a fold or
    /// a turn moves the feed between the stack and the two columns.
    @State private var feed: PulseFeedViewModel
    @State private var feedMap: FeedMapViewModel
    @State private var feedArea: FeedContextBarViewModel
    @State private var feedViewMode = FeedViewMode.list
    /// What was open beside the feed, for the stack to show after a fold or a turn upright.
    @State private var routesBeside: [PulseRoute] = []
    /// Keep detail models above both layouts, including the stack's brief route replay.
    @State private var detailModels = PulseDetailModels()
    @State private var restoringRoutes: [PulseRoute] = []

    /// Starts adding a home (the quiet card's "Set up a home"), in the Place tab.
    private let onAddHome: @MainActor () -> Void
    /// Closes the sheet this surface is presented in, when it is one; nil
    /// draws no Back.
    private let onClose: (@MainActor () -> Void)?
    /// The October 13 feed is the bar's Pulse tab (the Pulse redesign off): its header opens with the big List | Map
    /// switch and the side menu (founder decision 2026-11-07).
    private let mapSwitchOnTop: Bool
    /// Whether the Pulse tab has room for the October 13 feed and the open post side by side (the iPhone Duo
    /// open, held sideways).
    private let sideBySide: Bool

    public init(
        onAddHome: @escaping @MainActor () -> Void = {},
        onClose: (@MainActor () -> Void)? = nil,
        mapSwitchOnTop: Bool = false,
        sideBySide: Bool = false
    ) {
        self.onAddHome = onAddHome
        self.onClose = onClose
        self.mapSwitchOnTop = mapSwitchOnTop
        self.sideBySide = sideBySide
        let feed = PulseFeedViewModel()
        let feedMap = FeedMapViewModel(surface: feed.surface)
        _feed = State(initialValue: feed)
        _feedMap = State(initialValue: feedMap)
        // The viewing area above the feed, as `FeedView` makes it: a new area refetches the feed and moves the map.
        _feedArea = State(initialValue: FeedContextBarViewModel {
            Task { await feed.refresh() }
            Task { await feedMap.followChosenArea() }
        })
    }

    private var currentUserId: String {
        if case let .signedIn(user) = auth.state { return user.id }
        return ""
    }

    public var body: some View {
        // A fold or a turn replaces the layout inside (one stack or two columns); this stays, so it sees the change.
        ZStack {
            tabContent
        }
        .onChange(of: rootTabs.selected, initial: true) { _, selected in
            detailModels.tabSelected(selected == RootTab.pulseHome)
        }
        .onChange(of: isSideBySide) { _, _ in
            if detailModels.layoutChanged() { feed.screens.screensMoved() }
        }
    }

    private var tabContent: some View {
        navigationLayout
            .accessibilityIdentifier("pulseTabRoot")
            .onChange(of: retainedRoutes) { _, routes in
                detailModels.retain(routes: routes, userId: currentUserId)
            }
            .onChange(of: currentUserId) { _, userId in
                detailModels.retain(routes: [], userId: userId)
            }
            .sheet(item: $presentedSurface) { surface in
                surfaceRoot(surface)
            }
            .onChange(of: router.pending) { _, pending in
                consumeDeepLinkIfNeeded(pending: pending)
            }
            .onChange(of: door.pendingSurface) { _, pending in
                presentPendingSurfaceIfNeeded(pending)
            }
            .onChange(of: rootTabs.selected) { _, selected in
                // A link owned by another tab selects it underneath a presented
                // surface sheet; close the sheet so the destination is visible.
                if selected != .pulse { presentedSurface = nil }
                consumeDeepLinkIfNeeded(pending: router.pending)
                presentPendingSurfaceIfNeeded(door.pendingSurface)
            }
            .task {
                await Task.yield()
                guard !Task.isCancelled else { return }
                navigationReady = true
                consumeDeepLinkIfNeeded(pending: router.pending)
                presentPendingSurfaceIfNeeded(door.pendingSurface)
            }
    }

    private var retainedRoutes: [PulseRoute] {
        path.routes + routesBeside + restoringRoutes
    }

    private var navigationLayout: some View {
        Group {
            if isSideBySide {
                PulseSplitView(path: $path) {
                    feedPage
                } destination: { route in
                    destination(for: route)
                }
                .onChange(of: path.routes, initial: true) { _, routes in
                    routesBeside = routes
                }
            } else {
                NavigationStack(path: navigationPathBinding) {
                    feedPage
                        .readableColumn()
                        .toolbar(.hidden, for: .navigationBar)
                        .swipesBackFromEdge()
                        .navigationDestination(for: PulseRoute.self) { route in
                            destination(for: route)
                                .readableColumn()
                                .toolbar(.hidden, for: .navigationBar)
                        }
                }
                .onAppear { stackRoutesBeside() }
            }
        }
    }

    /// The October 13 feed side by side with the post (the Pulse redesign keeps its own stack).
    private var isSideBySide: Bool {
        sideBySide && !LaunchFeatures.pulseRedesign
    }

    /// Folded or turned upright, the stack starts at the feed: what was open beside it goes back on top once the
    /// stack is up.
    private func stackRoutesBeside() {
        let routes = routesBeside
        restoringRoutes = routes
        routesBeside = []
        guard !routes.isEmpty else { return }
        Task { @MainActor in
            defer { if restoringRoutes == routes { restoringRoutes = [] } }
            await Task.yield()
            guard path.routes.isEmpty || path.routes == routes else { return }
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) { path.replace(with: []) }
            await Task.yield()
            withTransaction(transaction) { path.replace(with: routes) }
        }
    }

    @ViewBuilder private var feedPage: some View {
        if LaunchFeatures.pulseRedesign {
            // The Pulse page (Pulse S6) reads `GET /api/pulse/feed`.
            PulsePageView(
                onOpenPost: { postId in
                    path.append(.post(postId: postId))
                },
                onCompose: {
                    path.append(.compose(intent: PulseIntent.all.rawValue))
                },
                onEdit: { postId in
                    path.append(.editPost(postId: postId))
                },
                topMenu: topMenu,
                quietCard: quietCard,
                onRefresh: refreshQuietCard,
                isActive: path.isEmpty && rootTabs.selected == .pulse && presentedSurface == nil
            )
        } else {
            // Launch cut #11 off: the October 13 feed, `GET /api/posts/feed`.
            FeedView(
                viewModel: feed,
                mapViewModel: feedMap,
                contextBarViewModel: feedArea,
                viewMode: $feedViewMode,
                onOpenPost: { path.open(.post(postId: $0), sideBySide: isSideBySide) },
                onOpenAuthor: { path.open($0, sideBySide: isSideBySide) },
                onCompose: { intent in
                    path.append(.compose(intent: intent.rawValue))
                },
                onBack: onClose,
                mapSwitchOnTop: mapSwitchOnTop,
                scrollToTop: rootTabs.pulseHomeReselected,
                asksPantopus: true
            )
        }
    }

    /// Nearby's people entries, in the page's top-right menu.
    private var topMenu: FeedTopMenu {
        var onOpenBeacons: (@MainActor () -> Void)?
        // Launch cut #1: Beacons stays hidden while the cut is on.
        if LaunchFeatures.beacon {
            onOpenBeacons = { DeepLinkRouter.shared.handle(path: "/beacons") }
        }
        return FeedTopMenu(
            onOpenConnections: { DeepLinkRouter.shared.handle(path: "/connections") },
            onOpenBeacons: onOpenBeacons
        )
    }

    /// The neighborhood meter or "Set up a home", above the Nearby posts.
    private var quietCard: AnyView {
        AnyView(PulseQuietCard(viewModel: neighborhood, onSetUpHome: onAddHome))
    }

    /// A pull to refresh re-reads the quiet card's meter beside the feed.
    private func refreshQuietCard() async {
        await neighborhood.refresh()
    }

    private var navigationPathBinding: Binding<NavigationPath> {
        Binding(
            get: { path.navigationPath },
            set: { path.replaceNavigationPath($0) }
        )
    }

    private func consumeDeepLinkIfNeeded(pending: DeepLinkRouter.Destination?) {
        // The bar's Pulse tab, whichever root hosts it (launch cut #11 on or off).
        guard navigationReady, rootTabs.selected == RootTab.pulseHome, let pending, pending == router.pending else { return }
        // With the redesign off, /nearby opens "Verified homes nearby" in the
        // Place stack: leave it to the root dispatcher, which can run after us.
        if pending == .pulse, !LaunchFeatures.pulseRedesign { return }
        switch pending {
        case .feed, .pulse:
            path.replaceNavigationPath(NavigationPath())
            _ = router.consume()
        case let .post(id):
            path.replaceNavigationPath(NavigationPath())
            path.append(.post(postId: id))
            _ = router.consume()
        default:
            break
        }
    }

    private func presentPendingSurfaceIfNeeded(_ pending: NeighborhoodDoorStore.Surface?) {
        guard let pending, rootTabs.selected == .pulse else { return }
        door.pendingSurface = nil
        // Pulse is this tab itself; launch cuts #3/#4 never open a hidden surface.
        guard pending != .pulse, pending.isAvailableAtLaunch else { return }
        presentedSurface = pending
    }

    /// The launch-cut surfaces' own tab roots, unchanged: each brings its own
    /// NavigationStack and consumes its own deep-link destinations.
    @ViewBuilder
    private func surfaceRoot(_ surface: NeighborhoodDoorStore.Surface) -> some View {
        switch surface {
        case .tasks:
            TasksTabRoot { presentedSurface = nil }
        case .marketplace:
            MarketplaceTabRoot { presentedSurface = nil }
        case .pulse:
            EmptyView()
        }
    }

    @MainActor
    private func pop() {
        if !path.isEmpty { path.removeLast() }
    }

    @ViewBuilder
    private func destination(for route: PulseRoute) -> some View {
        switch route {
        case let .post(postId):
            PulsePostDetailView(
                postId: postId,
                currentUserId: currentUserId.isEmpty ? nil : currentUserId,
                viewModel: detailModels.model(postId: postId, userId: currentUserId),
                onBack: pop,
                onOpenProfile: { userId in
                    Task { @MainActor in path.append(.publicProfile(userId: userId)) }
                },
                onEdit: { id in
                    Task { @MainActor in path.append(.editPost(postId: id)) }
                },
                onOpenBusiness: { business in
                    // The Pulse stack has no business-profile route; hand the
                    // public `/business/:key` link (a username or an id) to the
                    // router, which opens it in the Hub tab's stack.
                    Task { @MainActor in DeepLinkRouter.shared.handle(path: "/business/\(business)") }
                },
                onContentLoaded: { router.completePostArrival(id: postId) }
            )
            // A post link opened over another post replaces this stack entry;
            // a new identity gives the new post its own view model and load.
            .id(postId)
            .onDisappear { router.completePostArrival(id: postId) }
        case let .compose(intent):
            PulseComposeFlowView(
                prefillFeedIntent: PulseIntent(rawValue: intent),
                session: detailModels.composeSession(for: route, userId: currentUserId),
                onCancel: { pop() },
                onPosted: { _ in pop() }
            )
        case let .editPost(postId):
            PulseComposeFlowView(
                editingPostId: postId,
                session: detailModels.composeSession(for: route, userId: currentUserId),
                onCancel: { pop() },
                onPosted: { _ in pop() }
            )
        case let .publicProfile(userId):
            PublicProfileView(
                userId: userId,
                viewModel: detailModels.profileModel(for: route, profileId: userId, userId: currentUserId),
                onBack: pop,
                onOpenMessages: { profile in
                    Task { @MainActor in path.append(.chatConversation(.directMessage(with: profile))) }
                },
                onOpenGig: { gigId in
                    // The Pulse stack has no gig-detail route; hand the
                    // public `/gig/:id` link to the router, which opens it
                    // where tasks live (the Tasks sheet, or the Place stack
                    // while Open gigs is cut).
                    Task { @MainActor in DeepLinkRouter.shared.handle(path: "/gig/\(gigId)") }
                },
                onOpenProfile: { reviewerId in
                    Task { @MainActor in path.append(.publicProfile(userId: reviewerId)) }
                },
                onOpenPost: { postId in
                    Task { @MainActor in path.append(.post(postId: postId)) }
                }
            )
        case let .chatConversation(dest):
            chatConversation(dest)
        }
    }
}

extension PulseTabRoot {
    private func chatConversation(_ dest: InboxConversationDestination) -> some View {
        ChatConversationView(
            viewModel: detailModels.conversationModel(for: dest, userId: currentUserId) {
                ChatConversationViewModel(
                    mode: dest.threadMode,
                    counterparty: dest.counterparty,
                    counterpartyAvatarURL: dest.avatarURL.flatMap(URL.init(string:)),
                    currentUserId: currentUserId,
                    initialTopic: dest.initialTopic
                )
            },
            mode: dest.kind,
            onOpenProfile: { userId in
                Task { @MainActor in path.append(.publicProfile(userId: userId)) }
            },
            onBack: pop
        )
        // The whole screen has no tab bar; beside the feed, the bar stays.
        .hidesTabBar(!isSideBySide)
    }
}

/// A fold replaces the detail view, but must not replace an unfinished reply,
/// a post being written (the composer's step and draft), or where a
/// conversation, a post or a profile was being read. Models leave this account-scoped cache when
/// their routes actually close.
@MainActor
private final class PulseDetailModels {
    private var userId = ""
    private var models: [String: PulsePostDetailViewModel] = [:]
    private var composeSessions: [PulseRoute: PulseComposeSession] = [:]
    private var conversations: [InboxConversationDestination: ChatConversationViewModel] = [:]
    private var profiles: [PulseRoute: PublicProfileViewModel] = [:]
    /// Since when the tab has been the one picked; nil while another is.
    private var selectedSince: Date?

    func model(postId: String, userId: String) -> PulsePostDetailViewModel {
        if self.userId != userId { retain(routes: [], userId: userId) }
        if let model = models[postId] { return model }
        let model = PulsePostDetailViewModel(postId: postId, currentUserId: userId.isEmpty ? nil : userId)
        models[postId] = model
        return model
    }

    /// The composer open at this route (`.compose` or `.editPost`).
    func composeSession(for route: PulseRoute, userId: String) -> PulseComposeSession {
        if self.userId != userId { retain(routes: [], userId: userId) }
        if let session = composeSessions[route] { return session }
        let isEditing = if case .editPost = route { true } else { false }
        let session = PulseComposeSession(editing: isEditing)
        composeSessions[route] = session
        return session
    }

    /// A conversation opened from a profile's Message button.
    func conversationModel(
        for destination: InboxConversationDestination,
        userId: String,
        make: () -> ChatConversationViewModel
    ) -> ChatConversationViewModel {
        if self.userId != userId { retain(routes: [], userId: userId) }
        if let model = conversations[destination] { return model }
        let model = make()
        conversations[destination] = model
        return model
    }

    /// A profile opened from a post, a reply or another profile: what is loaded, its tab and where it was read.
    func profileModel(for route: PulseRoute, profileId: String, userId: String) -> PublicProfileViewModel {
        if self.userId != userId { retain(routes: [], userId: userId) }
        if let model = profiles[route] { return model }
        let model = PublicProfileViewModel(userId: profileId)
        profiles[route] = model
        return model
    }

    /// The tab was picked, or another one was.
    func tabSelected(_ isSelected: Bool) {
        selectedSince = isSelected ? Date() : nil
    }

    /// The tab moved its screens to its other layout. With the tab up a moment, that is a fold or a turn (not the
    /// tab coming back): the open screens move, and the ones under them show for a moment as the stack is rebuilt.
    /// None of them reads again for it. Returns whether it was such a move.
    func layoutChanged() -> Bool {
        guard let selectedSince, Date().timeIntervalSince(selectedSince) >= 0.5 else { return false }
        models.values.forEach { $0.screens.screensMoved() }
        composeSessions.values.forEach { $0.screensMoved() }
        return true
    }

    func retain(routes: [PulseRoute], userId: String) {
        let postIds = Set(routes.compactMap { route -> String? in
            guard case let .post(postId) = route else { return nil }
            return postId
        })
        models = self.userId == userId ? models.filter { postIds.contains($0.key) } : [:]
        composeSessions = self.userId == userId ? composeSessions.filter { routes.contains($0.key) } : [:]
        conversations = self.userId == userId
            ? conversations.filter { routes.contains(.chatConversation($0.key)) }
            : [:]
        profiles = self.userId == userId ? profiles.filter { routes.contains($0.key) } : [:]
        self.userId = userId
    }
}

#Preview {
    PulseTabRoot()
        .environment(AuthManager.previewSignedIn)
        .environment(RootTabModel())
}
