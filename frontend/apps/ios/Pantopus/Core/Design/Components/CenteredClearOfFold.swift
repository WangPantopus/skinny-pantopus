//
//  CenteredClearOfFold.swift
//  Pantopus
//
//  Placeholders and short centered notes keep off the iPhone Duo's fold
//  (founder, 2026-11-04). Half folded, the Duo's hinge is a crease across
//  the inner screen: down the middle like a book held sideways, across it
//  like a laptop held upright. Centered on a screen, a placeholder such as
//  Messages' "Pick a conversation" sits right on it. Apple reports the
//  hinge as a division region, active only while the Duo is half folded
//  (lying open it is flat, and inactive); this centers the content in the
//  larger part beside it instead, when the content fits there. Open flat,
//  closed and on every other iPhone, it centers as before.
//

import SwiftUI

public extension View {
    /// Fills the space offered and centers this view in it, as `.frame(maxWidth: .infinity, maxHeight: .infinity)`
    /// does; while the iPhone Duo is half folded across it, in the larger part beside the fold instead, when this
    /// view fits there. For placeholders and short notes (an empty column, an error with Try again), not for content
    /// that scrolls.
    func centeredClearOfFold() -> some View {
        modifier(CenteredClearOfFold(minHeight: 0, bottomClearance: 0))
    }

    /// The same for a placeholder in a scroll view, which offers no height: at least `minHeight` tall (pass the
    /// scroll view's height, so the placeholder fills the screen and still scrolls when the text is large), as
    /// `.frame(minHeight:)` would make it. Beside the fold it also stays above the bottom `bottomClearance` points,
    /// where a floating button sits over it.
    func centeredClearOfFold(minHeight: CGFloat, bottomClearance: CGFloat = 0) -> some View {
        modifier(CenteredClearOfFold(minHeight: minHeight, bottomClearance: bottomClearance))
    }

    /// For a bar's button that stays put while the screen scrolls (a form's bottom button, a wizard's Continue):
    /// while the iPhone Duo is half folded like a book with the fold down through it, the button takes the larger
    /// side beside the fold, at that side's width, instead of running across the fold. Everywhere else it keeps the
    /// width offered.
    func besideFold() -> some View {
        modifier(BesideFold())
    }
}

private struct BesideFold: ViewModifier {
    @State private var fold: CGRect?

    func body(content: Content) -> some View {
        FoldSideLayout(fold: fold) { content }
            .readsActiveFold($fold)
    }
}

/// Lays its one subview out across the width offered, or, where a fold runs down through it, in the larger side
/// beside the fold (the leading one when they match) at that side's width.
private struct FoldSideLayout: Layout {
    let fold: CGRect?

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        guard let content = subviews.first else { return .zero }
        let width = proposal.width ?? content.sizeThatFits(proposal).width
        let side = side(in: CGRect(x: 0, y: 0, width: width, height: proposal.height ?? 0))?.width ?? width
        return CGSize(width: width, height: content.sizeThatFits(ProposedViewSize(width: side, height: proposal.height)).height)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        guard let content = subviews.first else { return }
        let area = side(in: bounds) ?? bounds
        content.place(
            at: CGPoint(x: area.midX, y: bounds.midY),
            anchor: .center,
            proposal: ProposedViewSize(width: area.width, height: bounds.height)
        )
    }

    /// The larger side of `bounds` beside a fold that runs down through it; nil for no fold or one across it.
    private func side(in bounds: CGRect) -> CGRect? {
        guard let fold else { return nil }
        let crease = fold.offsetBy(dx: bounds.minX, dy: bounds.minY)
        guard crease.height > crease.width, crease.minX > bounds.minX, crease.maxX < bounds.maxX else { return nil }
        let leading = CGRect(x: bounds.minX, y: bounds.minY, width: crease.minX - bounds.minX, height: bounds.height)
        let trailing = CGRect(x: crease.maxX, y: bounds.minY, width: bounds.maxX - crease.maxX, height: bounds.height)
        return leading.width >= trailing.width ? leading : trailing
    }
}

private struct CenteredClearOfFold: ViewModifier {
    let minHeight: CGFloat
    let bottomClearance: CGFloat
    /// The active fold where it crosses this view, with the room to keep clear beside it, in its own coordinates.
    @State private var fold: CGRect?

    func body(content: Content) -> some View {
        FoldClearCentering(fold: fold, minHeight: minHeight, bottomClearance: bottomClearance) { content }
            .readsActiveFold($fold)
    }
}

/// Centers its one subview in the space offered (at least `minHeight` tall), or in the larger part beside `fold`
/// (above the bottom `bottomClearance`) when the subview fits there.
private struct FoldClearCentering: Layout {
    let fold: CGRect?
    let minHeight: CGFloat
    let bottomClearance: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        guard let content = subviews.first else { return .zero }
        let natural = content.sizeThatFits(proposal)
        let width = proposal.width ?? natural.width
        var height = max(proposal.height ?? natural.height, minHeight)
        // Offered no height (in a scroll view), it grows to the content's height beside a fold that runs down through
        // it, where the content wraps narrower, so it can sit there.
        if proposal.height == nil, let fold, fold.height > fold.width, fold.minX > 0, fold.maxX < width {
            let side = max(fold.minX, width - fold.maxX)
            let beside = content.sizeThatFits(ProposedViewSize(width: side, height: nil))
            if beside.width <= side + 0.5 {
                height = max(height, beside.height + bottomClearance)
            }
        }
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        guard let content = subviews.first else { return }
        let area = clearArea(in: bounds, for: content) ?? bounds
        content.place(at: CGPoint(x: area.midX, y: area.midY), anchor: .center, proposal: ProposedViewSize(area.size))
    }

    /// The larger part of `bounds` beside the fold (the top or leading one when they match), if the fold runs across
    /// `bounds` and the content fits in that part at its width.
    private func clearArea(in bounds: CGRect, for content: LayoutSubview) -> CGRect? {
        guard let fold else { return nil }
        let crease = fold.offsetBy(dx: bounds.minX, dy: bounds.minY)
        let bottom = bounds.maxY - bottomClearance
        let sides: [CGRect] = if crease.height > crease.width {
            [
                CGRect(x: bounds.minX, y: bounds.minY, width: crease.minX - bounds.minX, height: bottom - bounds.minY),
                CGRect(x: crease.maxX, y: bounds.minY, width: bounds.maxX - crease.maxX, height: bottom - bounds.minY)
            ]
        } else {
            [
                CGRect(x: bounds.minX, y: bounds.minY, width: bounds.width, height: crease.minY - bounds.minY),
                CGRect(x: bounds.minX, y: crease.maxY, width: bounds.width, height: bottom - crease.maxY)
            ]
        }
        // Only a fold through the content's space: one along its edge leaves nothing to avoid.
        guard sides.allSatisfy({ $0.width > 0 && $0.height > 0 }),
              let side = sides.max(by: { $0.width * $0.height < $1.width * $1.height }) else { return nil }
        let size = content.sizeThatFits(ProposedViewSize(width: side.width, height: nil))
        return size.width <= side.width + 0.5 && size.height <= side.height + 0.5 ? side : nil
    }
}

extension View {
    /// Keeps `fold` at the iPhone Duo's fold while it is half folded and the fold crosses this view; nil otherwise.
    /// `ReadableColumn` reads it too.
    @ViewBuilder
    func readsActiveFold(_ fold: Binding<CGRect?>) -> some View {
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            modifier(ActiveFoldReader(fold: fold))
        } else {
            self
        }
        #else
        self
        #endif
    }
}

#if compiler(>=6.4)
/// The hinge is a division region. Lying open it is inactive (and left out here); half folded it is active. Its
/// margins are the room Apple asks to keep clear beside it.
@available(iOS 27.1, *)
private struct ActiveFoldReader: ViewModifier {
    @Binding var fold: CGRect?

    func body(content: Content) -> some View {
        content.onGeometryChange(for: CGRect?.self) { proxy in
            let bounds = CGRect(origin: .zero, size: proxy.size)
            guard let region = proxy.reservedRegions(kind: .division)
                .first(where: { $0.isActive && $0.frame.intersects(bounds) }) else { return nil }
            let frame = region.frame
            let margins = region.margins
            return CGRect(
                x: frame.minX - margins.leading,
                y: frame.minY - margins.top,
                width: frame.width + margins.leading + margins.trailing,
                height: frame.height + margins.top + margins.bottom
            )
        } action: { fold = $0 }
    }
}
#endif
