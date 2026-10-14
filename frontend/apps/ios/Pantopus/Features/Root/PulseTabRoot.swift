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

import SwiftUI

/// Typed routes within the Pulse tab's NavigationStack.
public enum PulseRoute: Hashable {
    case post(postId: String)
    case compose(intent: String)
    case editPost(postId: String)
    case publicProfile(userId: String)
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

    /// Starts adding a home (the quiet card's "Set up a home"), in the Place tab.
    private let onAddHome: @MainActor () -> Void

    public init(onAddHome: @escaping @MainActor () -> Void = {}) {
        self.onAddHome = onAddHome
    }

    private var currentUserId: String {
        if case let .signedIn(user) = auth.state { return user.id }
        return ""
    }

    public var body: some View {
        NavigationStack(path: navigationPathBinding) {
            FeedView(
                onOpenPost: { postId in
                    path.append(.post(postId: postId))
                },
                onCompose: { intent in
                    path.append(.compose(intent: intent.rawValue))
                },
                topMenu: topMenu,
                topCard: quietCard,
                onRefresh: { [neighborhood] in await neighborhood.refresh() }
            )
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: PulseRoute.self) { route in
                destination(for: route)
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
        .accessibilityIdentifier("pulseTabRoot")
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

    private var navigationPathBinding: Binding<NavigationPath> {
        Binding(
            get: { path.navigationPath },
            set: { path.replaceNavigationPath($0) }
        )
    }

    private func consumeDeepLinkIfNeeded(pending: DeepLinkRouter.Destination?) {
        guard navigationReady, rootTabs.selected == .pulse, let pending, pending == router.pending else { return }
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
                onBack: pop,
                onOpenProfile: { userId in
                    Task { @MainActor in path.append(.publicProfile(userId: userId)) }
                },
                onEdit: { id in
                    Task { @MainActor in path.append(.editPost(postId: id)) }
                },
                onOpenBusiness: { username in
                    // The Pulse stack has no business-profile route; hand the
                    // public `/business/:username` link to the router, which
                    // opens it in the Hub tab's stack.
                    Task { @MainActor in DeepLinkRouter.shared.handle(path: "/business/\(username)") }
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
                onCancel: { pop() },
                onPosted: { _ in pop() }
            )
        case let .editPost(postId):
            PulseComposeFlowView(
                editingPostId: postId,
                onCancel: { pop() },
                onPosted: { _ in pop() }
            )
        case let .publicProfile(userId):
            PublicProfileView(
                userId: userId,
                onBack: pop,
                onOpenGig: { gigId in
                    // The Pulse stack has no gig-detail route; hand the
                    // public `/gig/:id` link to the router, which opens it
                    // where tasks live (the Tasks sheet, or the Place stack
                    // while Open gigs is cut).
                    Task { @MainActor in DeepLinkRouter.shared.handle(path: "/gig/\(gigId)") }
                },
                onOpenProfile: { reviewerId in
                    Task { @MainActor in path.append(.publicProfile(userId: reviewerId)) }
                }
            )
        }
    }
}

#Preview {
    PulseTabRoot()
        .environment(AuthManager.previewSignedIn)
        .environment(RootTabModel())
}
