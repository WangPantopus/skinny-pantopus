//
//  ItemZoomTransition.swift
//  Pantopus
//
//  An item screen grows out of the card that was tapped, and dragging it
//  down (or swiping from the left edge) shrinks it back into the card
//  (founder request 2026-10-29). This is iOS 18's zoom navigation
//  transition; on iOS 17 the screen slides in as before. Each tab sets the
//  namespace once (`RootTabHostedRoot`), so a card and its screen only need
//  the same id.
//

import SwiftUI

private struct ItemZoomNamespaceKey: EnvironmentKey {
    static var defaultValue: Namespace.ID? {
        nil
    }
}

private struct OpensWithItemZoomKey: EnvironmentKey {
    static var defaultValue: Bool {
        false
    }
}

extension EnvironmentValues {
    /// Where a tab's cards and item screens match their zoom; nil slides in.
    var itemZoomNamespace: Namespace.ID? {
        get { self[ItemZoomNamespaceKey.self] }
        set { self[ItemZoomNamespaceKey.self] = newValue }
    }

    /// This screen zooms open, so a drag down closes it: pulling down to
    /// refresh would take that drag, so such a screen leaves it out.
    var opensWithItemZoom: Bool {
        get { self[OpensWithItemZoomKey.self] }
        set { self[OpensWithItemZoomKey.self] = newValue }
    }
}

/// What an item screen zooms from: the kind of item and its id, so a post and
/// a plan with the same id never match.
struct ItemZoomID: Hashable {
    enum Kind: String {
        case post
        case plan
        case mailPiece
    }

    let kind: Kind
    let id: String
}

extension View {
    /// The card an item screen opens from.
    func itemZoomSource(_ kind: ItemZoomID.Kind, id: String) -> some View {
        modifier(ItemZoomSource(zoomID: ItemZoomID(kind: kind, id: id)))
    }

    /// Put on an item screen's root: it opens out of its card, and a drag down
    /// closes it into the card again.
    func itemZoomDestination(_ kind: ItemZoomID.Kind, id: String) -> some View {
        modifier(ItemZoomDestination(zoomID: ItemZoomID(kind: kind, id: id)))
    }

    /// Pull to refresh, except on a screen that zooms open: there the drag
    /// down closes the screen.
    func refreshableUnlessZoomed(_ action: @escaping @Sendable () async -> Void) -> some View {
        modifier(RefreshableUnlessZoomed(action: action))
    }
}

private struct RefreshableUnlessZoomed: ViewModifier {
    @Environment(\.opensWithItemZoom) private var opensWithItemZoom
    let action: @Sendable () async -> Void

    func body(content: Content) -> some View {
        if opensWithItemZoom {
            content
        } else {
            content.refreshable { await action() }
        }
    }
}

private struct ItemZoomSource: ViewModifier {
    @Environment(\.itemZoomNamespace) private var namespace
    let zoomID: ItemZoomID

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *), let namespace {
            content.matchedTransitionSource(id: zoomID, in: namespace)
        } else {
            content
        }
    }
}

private struct ItemZoomDestination: ViewModifier {
    @Environment(\.itemZoomNamespace) private var namespace
    let zoomID: ItemZoomID

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *), let namespace {
            content
                .environment(\.opensWithItemZoom, true)
                .navigationTransition(.zoom(sourceID: zoomID, in: namespace))
        } else {
            content
        }
    }
}
