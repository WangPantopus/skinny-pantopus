//
//  ScrollPlace.swift
//  Pantopus
//
//  Where the reader was down a page, kept through the iPhone Duo's folds
//  (founder, 2026-11-04). Folding or turning the Duo swaps Messages and the
//  Nearby tab's Pulse between one stack and two columns, which makes every
//  screen in them anew, back at the top of its page. A screen whose model
//  outlives the swap keeps a `ScrollPlace` in it: the page notes where the
//  reader scrolls to, and the new screen opens there.
//

import SwiftUI
import UIKit

/// How far down its page the reader scrolled, as a share of the page's height: a fold re-wraps the page at another
/// width, and the same share keeps about the same part of it in view. Kept by a screen's model; the page applies
/// `keepsScrollPlace(_:)`.
@MainActor
public final class ScrollPlace {
    /// 0 at the top of the page.
    fileprivate var share: CGFloat = 0

    public init() {}
}

public extension View {
    /// For the content of a vertical `ScrollView`: notes in `place` where the reader scrolls to, opens a new screen
    /// for the same model there, and goes back there when the page changes width. Nil does nothing.
    @ViewBuilder
    func keepsScrollPlace(_ place: ScrollPlace?) -> some View {
        if let place {
            modifier(KeepsScrollPlace(place: place))
        } else {
            self
        }
    }
}

private struct KeepsScrollPlace: ViewModifier {
    let place: ScrollPlace
    @State private var page = ScrollPlacePage()

    func body(content: Content) -> some View {
        content
            .background {
                ScrollPlaceProbe(page: page)
                    .frame(width: 0, height: 0)
                    .accessibilityHidden(true)
            }
            // The page moves as it scrolls. Only the reader's scrolling counts: a fold lays the old screen out at
            // the new size before it goes, which moves its page too.
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.frame(in: .scrollView).minY
            } action: { _ in
                page.note(in: place)
            }
            // Re-wrapped at another width (a fold or a turn, the columns settling): back to the same share.
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.width
            } action: { _ in
                Task { await page.returnTo(place) }
            }
            .task { await page.returnTo(place) }
    }
}

/// The page's UIKit scroll view, which `ScrollPlaceProbe` finds.
@MainActor
private final class ScrollPlacePage {
    weak var scrollView: UIScrollView?

    /// A finger is on the page, or the page is still moving from a flick.
    private var isScrolledByReader: Bool {
        guard let scrollView else { return false }
        return scrollView.isTracking || scrollView.isDragging || scrollView.isDecelerating
    }

    func note(in place: ScrollPlace) {
        guard isScrolledByReader, let scrollView, scrollView.contentSize.height > 0 else { return }
        let offset = scrollView.contentOffset.y + scrollView.adjustedContentInset.top
        place.share = max(0, offset) / scrollView.contentSize.height
    }

    /// Scrolls the page to `place` over its first frames (a new screen lays out over a few), unless the reader is
    /// scrolling it.
    func returnTo(_ place: ScrollPlace) async {
        guard place.share > 0 else { return }
        for delayMs: UInt64 in [16, 80, 250] {
            try? await Task.sleep(nanoseconds: delayMs * 1_000_000)
            guard !Task.isCancelled, !isScrolledByReader else { return }
            guard let scrollView, scrollView.contentSize.height > 0 else { continue }
            let inset = scrollView.adjustedContentInset
            let lowest = scrollView.contentSize.height + inset.bottom - scrollView.bounds.height
            let offset = min(place.share * scrollView.contentSize.height, lowest + inset.top) - inset.top
            scrollView.setContentOffset(CGPoint(x: scrollView.contentOffset.x, y: max(-inset.top, offset)), animated: false)
        }
    }
}

/// Finds the page's UIKit scroll view: it sits in the scroll content, so the scroll view is its nearest ancestor of
/// that kind.
private struct ScrollPlaceProbe: UIViewRepresentable {
    let page: ScrollPlacePage

    func makeUIView(context _: Context) -> ProbeView {
        let view = ProbeView()
        view.page = page
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ view: ProbeView, context _: Context) {
        view.page = page
    }

    final class ProbeView: UIView {
        weak var page: ScrollPlacePage?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard window != nil else { return }
            var ancestor = superview
            while let view = ancestor, !(view is UIScrollView) {
                ancestor = view.superview
            }
            if let scrollView = ancestor as? UIScrollView {
                page?.scrollView = scrollView
            }
        }
    }
}
