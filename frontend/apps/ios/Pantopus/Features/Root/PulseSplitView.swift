//
//  PulseSplitView.swift
//  Pantopus
//
//  Pulse side by side on a wide screen (founder, 2026-11-01). Open, the
//  iPhone Duo's inner screen is regular width: the Nearby tab's Pulse feed
//  (List or Map) sits on the leading side under the segment switch and the
//  open post beside it, as Messages does there (`SideBySideSplit`). The post
//  column shows the route stack the narrow layout pushes, so a profile, a
//  chat or the composer opens over the post with Back, and folding or
//  unfolding keeps what is open. The open post's card is tinted and the post
//  leaves Back out (the feed is the way back). Before a post is picked the
//  column waits with a note: it never opens one by itself, because opening a
//  post counts a view for its author. Phones never come here.
//

import SwiftUI

private struct SelectedPulsePostIdKey: EnvironmentKey {
    static var defaultValue: String? {
        nil
    }
}

private struct PulsePostShowsBackKey: EnvironmentKey {
    static var defaultValue: Bool {
        true
    }
}

extension EnvironmentValues {
    /// The feed card of the post open beside the feed, tinted as selected; nil while the feed stands alone.
    var selectedPulsePostId: String? {
        get { self[SelectedPulsePostIdKey.self] }
        set { self[SelectedPulsePostIdKey.self] = newValue }
    }

    /// Whether a post page's top bar shows Back. Not where the post is the first screen of its column beside the
    /// feed.
    var pulsePostShowsBack: Bool {
        get { self[PulsePostShowsBackKey.self] }
        set { self[PulsePostShowsBackKey.self] = newValue }
    }
}

/// The Pulse segment's two columns: the feed and the post column.
struct PulseSplitView<Feed: View, Destination: View>: View {
    @Binding var path: RouteStack<PulseRoute>
    @ViewBuilder let feed: () -> Feed
    @ViewBuilder let destination: (PulseRoute) -> Destination

    var body: some View {
        SideBySideSplit(leadingWidth: .nearby) {
            feed()
                .environment(\.selectedPulsePostId, openPostId)
                // Nothing opens out of the feed's cards here: the post goes in the column beside them.
                .environment(\.itemZoomNamespace, nil)
        } detail: {
            RouteColumn(path: $path) { first in
                if let first {
                    destination(first)
                        .readableColumn()
                        .environment(\.pulsePostShowsBack, false)
                        // Not opened out of a card, so no drag down closes it, and a pull refreshes it.
                        .environment(\.itemZoomNamespace, nil)
                } else {
                    PulsePostPlaceholder()
                }
            } destination: { route in
                destination(route)
            }
        }
    }

    /// The post first in the column.
    private var openPostId: String? {
        guard case let .post(postId)? = path.routes.first else { return nil }
        return postId
    }
}

/// The post column before a post is picked.
struct PulsePostPlaceholder: View {
    var body: some View {
        VStack(spacing: 14) {
            Icon(.fileText, size: 30, strokeWidth: 1.8, color: Theme.Color.primaryInk)
                .frame(width: 72, height: 72)
                .background(Theme.Color.primary50)
                .clipShape(Circle())
            Text("Pick a post")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Tap a post in Pulse to read it and its comments here.")
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("pulsePostPlaceholder")
    }
}

extension RouteStack where Route == PulseRoute {
    /// Opens a post from the feed: on top of the stack, or side by side in the post column's place.
    mutating func open(_ route: PulseRoute, sideBySide: Bool) {
        guard sideBySide else {
            append(route)
            return
        }
        replace(with: [route])
    }
}
