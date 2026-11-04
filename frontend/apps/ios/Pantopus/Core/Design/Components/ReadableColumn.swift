//
//  ReadableColumn.swift
//  Pantopus
//
//  Screens keep a readable width on a wide screen (founder, 2026-11-01). Open,
//  the iPhone Duo's inner screen is about 950 pt wide, and a phone layout
//  stretched across it runs every card and line edge to edge, which Apple's
//  guidelines name as the thing to avoid ("You don't want just a stretched out
//  iPhone app"). This keeps the content in a centered column of Apple's reading
//  width by padding the safe area: the content moves in, while backgrounds,
//  maps and anything else that ignores the safe area still fill the screen. On
//  a phone the reading width is wider than the screen, so nothing changes.
//
//  It goes inside a navigation stack, on the stack's first screen and on each
//  pushed screen: padding added outside a stack doesn't reach the screens in
//  it, and a stack narrowed from outside keeps an empty strip for the Duo's
//  side controls inside the column. Full width, the stack's controls join the
//  Duo's side strip, as Apple places them.
//
//  A screen that lays out its own readable columns where the screen is wide
//  enough (Place and Today, `PlaceColumns`) says from which width; there the
//  column leaves it the screen's whole width.
//

import SwiftUI

public extension View {
    /// Keeps this screen's content in a centered column no wider than the reading width. Put it on a navigation
    /// stack's first screen and on the screens its `navigationDestination` pushes, or on the root of a screen
    /// that has no stack (a signed-out screen, a full-screen cover).
    func readableColumn() -> some View {
        modifier(ReadableColumn())
    }

    /// For a screen inside `readableColumn()` that lays out its own readable columns on a wide screen: where the
    /// screen is at least `width` wide, the column leaves this screen the whole width.
    func readableColumnWidens(from width: CGFloat) -> some View {
        preference(key: ReadableColumnWidensKey.self, value: width)
    }
}

/// The narrowest screen width at which a screen inside the column lays out its own columns; nil for none.
private struct ReadableColumnWidensKey: PreferenceKey {
    static let defaultValue: CGFloat? = nil

    static func reduce(value: inout CGFloat?, nextValue: () -> CGFloat?) {
        if let next = nextValue() { value = min(value ?? next, next) }
    }
}

private struct ReadableColumn: ViewModifier {
    /// Apple's readable content width at the default text size (UIKit's `readableContentGuide`); it grows with
    /// larger text, so the lines keep about the same number of words.
    @ScaledMetric(relativeTo: .body) private var readableWidth: CGFloat = 672
    @State private var width: CGFloat = 0
    @State private var widensFrom: CGFloat?

    func body(content: Content) -> some View {
        content
            .safeAreaPadding(.horizontal, sideInset)
            .onPreferenceChange(ReadableColumnWidensKey.self) { widensFrom = $0 }
            // Measured outside the padding, so the inset never feeds back into the width it comes from. The screen
            // sits inside the safe area already (the Duo's side controls are outside it), so its width is the room
            // the column centers in.
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
    }

    private var sideInset: CGFloat {
        if let widensFrom, width >= widensFrom { return 0 }
        return max(0, ((width - readableWidth) / 2).rounded(.down))
    }
}
