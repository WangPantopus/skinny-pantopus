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
import UIKit

/// How wide the leading column is allowed to be.
struct SideBySideColumnWidth {
    let min: CGFloat
    let ideal: CGFloat
    let max: CGFloat

    /// The chat list: a bit narrower than a phone, so the conversation gets the bigger side (the founder's pick).
    static let chatList = SideBySideColumnWidth(min: 320, ideal: 340, max: 480)
    /// The Nearby tab's leading column: a phone's width, so the Pulse header's buttons fit as they do closed (the
    /// founder's pick). Both segments use it, so the switch above them stays put. Never narrower, because the split
    /// view otherwise narrows a column it laid out before a rotation. Half folded like a book, the split view widens
    /// it to the fold, as it does the chat list, so the open post or the map has the other side to itself.
    static let nearby = SideBySideColumnWidth(min: 382, ideal: 382, max: 480)

    /// Whether a screen this wide holds the column with the narrowest iPhone's width (375 pt) beside it. Upright,
    /// the open iPhone Duo (669 pt) doesn't hold the Nearby column: a post beside it got 287 pt, and the map beside
    /// Neighborhood's column centered its cells under the column. There the tab keeps one column, as closed.
    func fitsBeside(in width: CGFloat) -> Bool {
        width >= ideal + 375
    }

    /// The ideal width in a split this wide: the narrowest where the ideal would leave the other column the smaller
    /// side. Upright, the open Duo (669 pt) leaves 329 pt beside a 340 pt chat list, and UIKit won't put a detail
    /// that narrow beside it: a split laid over its detail there (Mail off, after a launch open sideways or in book)
    /// stayed that way. At 320 pt the conversation gets 349 pt, as UIKit already lays it out when it tiles.
    func ideal(in width: CGFloat?) -> CGFloat {
        guard let width, width - ideal < ideal else { return ideal }
        return min
    }

    /// The column can narrow from its ideal to its minimum (`ideal(in:)`): the chat list. The Nearby tab's column
    /// and Mail's never do.
    var narrows: Bool {
        min < ideal
    }
}

/// Apple's split view with the tab's screen on the leading side. The screens draw their own headers, so the
/// sidebar button and the navigation bars stay hidden.
struct SideBySideSplit<Leading: View, Detail: View>: View {
    let leadingWidth: SideBySideColumnWidth
    @ViewBuilder let leading: () -> Leading
    @ViewBuilder let detail: () -> Detail
    @State private var columnVisibility = NavigationSplitViewVisibility.all
    /// The split's width, for the leading column's ideal width. Read only for a column that narrows: the width arrives
    /// a layout pass after a turn, and setting it laid the split out once more after the turn had settled, which took
    /// the keyboard from a post's comment box on the Nearby tab (half folded to upright).
    @State private var width: CGFloat?

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            leading()
                .toolbar(removing: .sidebarToggle)
                .toolbar(.hidden, for: .navigationBar)
                .navigationSplitViewColumnWidth(
                    min: leadingWidth.min,
                    ideal: leadingWidth.ideal(in: width),
                    max: leadingWidth.max
                )
        } detail: {
            detail()
                .background { KeepsColumnsBeside().accessibilityHidden(true) }
        }
        .navigationSplitViewStyle(.balanced)
        .onGeometryChange(for: CGFloat?.self) { leadingWidth.narrows ? $0.size.width : nil } action: { newWidth in
            if width != newWidth { width = newWidth }
        }
    }
}

/// Puts the two columns back side by side when the split has fallen back to an overlay. UIKit overlays the leading
/// column on a dimmed detail when the window is too narrow for both. A first launch under load can lay the split out
/// before the window reaches its width, and it then stays an overlay at full width, with no button to bring the
/// columns back, until a fold or a turn. This sits behind the detail column, which UIKit lays out again whenever the
/// split changes mode, and asks for side by side again whenever both columns fit.
private struct KeepsColumnsBeside: UIViewControllerRepresentable {
    func makeUIViewController(context _: Context) -> Controller {
        Controller()
    }

    func updateUIViewController(_: Controller, context _: Context) {}

    final class Controller: UIViewController {
        /// The narrowest detail UIKit puts beside the leading column.
        private let narrowestDetail: CGFloat = 320
        /// The split's width when this last asked for side by side: once per width, so a split UIKit won't tile isn't
        /// asked again on every layout pass.
        private var askedAtWidth: CGFloat?

        override func loadView() {
            view = UIView()
            view.isUserInteractionEnabled = false
        }

        override func viewDidLayoutSubviews() {
            super.viewDidLayoutSubviews()
            // After this layout pass: changing the mode inside one starts another.
            Task { @MainActor [weak self] in self?.keepBeside() }
        }

        private func keepBeside() {
            guard let split = splitViewController, !split.isCollapsed else { return }
            let width = split.view.bounds.width
            let besideColumn = width - split.primaryColumnWidth
            // Wider than the room beside the leading column: laid out under it (an overlay, or the column hidden). The
            // frames change as the mode does, while `displayMode` still reports the old mode.
            guard view.bounds.width > besideColumn + 24 else {
                askedAtWidth = nil
                return
            }
            guard besideColumn >= narrowestDetail, askedAtWidth != width else { return }
            askedAtWidth = width
            // An overlay brings the overlay behavior with it; side by side needs tiling back.
            split.preferredSplitBehavior = .tile
            // UIKit only works out its mode again when the preferred mode changes.
            if split.preferredDisplayMode == .oneBesideSecondary {
                split.preferredDisplayMode = .automatic
            }
            split.preferredDisplayMode = .oneBesideSecondary
        }
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
