//
//  SideBySideSplit.swift
//  Pantopus
//
//  Two columns on a wide screen (founder, 2026-11-01). Open, the iPhone
//  Duo's inner screen is regular width, and a tab whose narrow layout is one
//  stack shows its own screen on the leading side and the screens it would
//  push beside it, in Apple's split view: Messages (`InboxSplitView`) and the
//  Nearby tab's two segments. The column shows the tab's route stack with
//  its first route as the root, so folding or unfolding keeps what is open:
//  closed, the same routes are the one stack again. Phones never come here.
//

import SwiftUI

/// How wide the leading column is allowed to be.
struct SideBySideColumnWidth {
    let min: CGFloat
    let ideal: CGFloat
    let max: CGFloat

    /// The chat list: a bit narrower than a phone, so the conversation gets the bigger side (the founder's pick).
    static let chatList = SideBySideColumnWidth(min: 320, ideal: 340, max: 480)
    /// The Nearby tab's leading column: a phone's width, so the Pulse header's buttons fit as they do closed (the
    /// founder's pick). Both segments use it, so the switch above them stays put.
    static let nearby = SideBySideColumnWidth(min: 340, ideal: 382, max: 440)
}

/// Apple's split view with the tab's screen on the leading side. The screens draw their own headers, so the
/// sidebar button and the navigation bars stay hidden.
struct SideBySideSplit<Leading: View, Detail: View>: View {
    let leadingWidth: SideBySideColumnWidth
    @ViewBuilder let leading: () -> Leading
    @ViewBuilder let detail: () -> Detail
    @State private var columnVisibility = NavigationSplitViewVisibility.all

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            leading()
                .toolbar(removing: .sidebarToggle)
                .toolbar(.hidden, for: .navigationBar)
                .navigationSplitViewColumnWidth(min: leadingWidth.min, ideal: leadingWidth.ideal, max: leadingWidth.max)
        } detail: {
            detail()
        }
        .navigationSplitViewStyle(.balanced)
    }
}

/// The column beside the leading screen: the route stack the narrow layout pushes, its first route as the root and
/// the rest pushed over it.
struct RouteColumn<Route: Hashable, Root: View, Destination: View>: View {
    @Binding var path: RouteStack<Route>
    /// Routes at the start of the path that the leading side shows instead (Messages' search).
    var skipping = 0
    /// The column's first screen, for its first route, or what the column says before one is picked (nil).
    @ViewBuilder let root: (Route?) -> Root
    @ViewBuilder let destination: (Route) -> Destination

    var body: some View {
        NavigationStack(path: pushedPath) {
            root(columnRoutes.first)
                .toolbar(.hidden, for: .navigationBar)
                .swipesBackFromEdge()
                .navigationDestination(for: Route.self) { route in
                    destination(route)
                        .readableColumn()
                        .toolbar(.hidden, for: .navigationBar)
                }
        }
    }

    /// The column's screens, first to top.
    private var columnRoutes: ArraySlice<Route> {
        path.routes.dropFirst(skipping)
    }

    /// The screens pushed over the column's first one. Pushes go through `path`; a swipe back drops routes off its end.
    private var pushedPath: Binding<NavigationPath> {
        Binding(
            get: { NavigationPath(columnRoutes.dropFirst()) },
            set: { newPath in
                let pushed = max(0, columnRoutes.count - 1)
                if newPath.count < pushed { path.removeLast(pushed - newPath.count) }
            }
        )
    }
}
