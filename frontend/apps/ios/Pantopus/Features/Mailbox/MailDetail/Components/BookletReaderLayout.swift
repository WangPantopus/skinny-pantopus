//
//  BookletReaderLayout.swift
//  Pantopus
//
//  How big a booklet's pages are and when two face each other (founder,
//  2026-11-04, "Build it as drawn"). The page sits right under the top bar,
//  and the whole page shows above the letter's pinned actions. Where two
//  pages fit nearly as tall as one, such as the open iPhone Duo held
//  sideways, the booklet lies open: two facing pages with the spine on the
//  hinge, and half folded each page stays on its own side of the fold.
//

import SwiftUI
import UIKit

/// The scroll view a mail screen reads in (`MailItemDetailShell`): its size
/// and the part its pinned actions cover.
struct MailItemReadingArea: Equatable {
    var size: CGSize = .zero
    var coveredBottom: CGFloat = 0

    /// The height not under the pinned actions; zero while unknown.
    var readingHeight: CGFloat {
        size == .zero ? 0 : max(0, size.height - coveredBottom)
    }
}

private struct MailItemReadingAreaKey: EnvironmentKey {
    static var defaultValue: MailItemReadingArea {
        MailItemReadingArea()
    }
}

extension EnvironmentValues {
    /// Set by `MailItemDetailShell` on its scroll content.
    var mailItemReadingArea: MailItemReadingArea {
        get { self[MailItemReadingAreaKey.self] }
        set { self[MailItemReadingAreaKey.self] = newValue }
    }
}

/// The reader's page size and arrangement for the room it has.
struct BookletReaderLayout: Equatable {
    /// The next page's edge beside a page (`BookletPaperPageChrome`).
    static let edge = Spacing.s3
    /// Without a reading area (a preview, the older layout), a page keeps its former height.
    static let fallbackHeight: CGFloat = 420

    let pageWidth: CGFloat
    let pageHeight: CGFloat
    /// Two pages side by side.
    let isSpread: Bool
    /// The width pages are laid out in: the reader's, or wider when a spread uses the side margins.
    let areaWidth: CGFloat
    /// The spine's distance from the area's leading edge, and the fold to keep clear (half folded).
    let spine: CGFloat
    let foldGap: CGFloat

    /// - Parameters:
    ///   - width: the reader's own width.
    ///   - screenMargin: how far the screen reaches past the reader on each side (`readsBookletScreenMargin`).
    ///   - hinge: the Duo's hinge where it runs down the reader, in the reader's coordinates.
    init(
        width: CGFloat,
        screenMargin: CGFloat,
        reading: MailItemReadingArea,
        controlsHeight: CGFloat,
        pageCount: Int,
        hinge: BookletHinge?
    ) {
        // The page, its controls and the gaps above and below them fit above the pinned actions.
        let chrome = Spacing.s3 + Spacing.s2 + controlsHeight + Spacing.s2
        let fit = reading.readingHeight > 0 ? max(200, reading.readingHeight - chrome) : Self.fallbackHeight
        let single = min(max(0, width - Self.edge) * 4 / 3, fit)
        // A spread may use the screen's side margins, keeping a margin from its edges.
        let room = max(0, screenMargin - Spacing.s4)
        let area = width + 2 * room
        let spreadHeight = min(max(0, area - Self.edge) / 2 * 4 / 3, fit)
        // Not before the reader knows its width.
        isSpread = pageCount > 1 && width > 0 && spreadHeight >= single * 0.85
        guard isSpread else {
            pageHeight = single
            pageWidth = single * 3 / 4
            areaWidth = width
            spine = width / 2
            foldGap = 0
            return
        }
        // The spine is on the hinge (the middle of the reader where there's none); half folded, the pages keep
        // clear of the fold.
        let center = hinge.map { $0.midX + room } ?? area / 2
        let gap = hinge?.foldGap ?? 0
        spine = min(max(center, area * 0.3), area * 0.7)
        let side = max(0, min(spine - gap / 2, area - spine - gap / 2 - Self.edge))
        pageHeight = min(side * 4 / 3, fit)
        pageWidth = pageHeight * 3 / 4
        areaWidth = area
        foldGap = gap
    }

    /// Where the left page starts in the area, so the spine sits where it should.
    var leftPageX: CGFloat {
        spine - foldGap / 2 - pageWidth
    }

    /// The width of two facing pages with the next page's edge.
    var spreadWidth: CGFloat {
        2 * pageWidth + foldGap + Self.edge
    }

    /// How far the spread's middle sits from the reader's middle (the hinge isn't the column's middle).
    var spreadShift: CGFloat {
        leftPageX + spreadWidth / 2 - areaWidth / 2
    }
}

/// The Duo's hinge where it runs down the reader, in the reader's coordinates.
struct BookletHinge: Equatable {
    /// The hinge's middle, where the spine goes.
    let midX: CGFloat
    /// The fold to keep clear while the Duo is half folded like a book; zero while it lies open.
    let foldGap: CGFloat
}

#if compiler(>=6.4)
/// Reads the Duo's hinge (a division region, inactive while the Duo lies open), in the view's coordinates.
@available(iOS 27.1, *)
private struct BookletHingeReader: ViewModifier {
    @Binding var hinge: BookletHinge?

    func body(content: Content) -> some View {
        // Only where it runs across: scrolling moves the reader, not the hinge.
        content.onGeometryChange(for: BookletHinge?.self) { proxy in
            proxy.reservedRegions(kind: .division, options: .includeInactive)
                .first { $0.frame.height > $0.frame.width }
                .map { BookletHinge(midX: $0.frame.midX, foldGap: $0.isActive ? $0.frame.width : 0) }
        } action: { hinge = $0 }
    }
}
#endif

extension View {
    /// Keeps `hinge` at the Duo's hinge where it runs down the view (held sideways); nil otherwise.
    func readsBookletHinge(_ hinge: Binding<BookletHinge?>) -> some View {
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            return AnyView(modifier(BookletHingeReader(hinge: hinge)))
        }
        #endif
        return AnyView(self)
    }

    /// Keeps `margin` at how far the screen's safe area reaches past the view on its nearer side: the reading
    /// column's side margins, which SwiftUI's padding around the column hides from the view.
    func readsBookletScreenMargin(_ margin: Binding<CGFloat>) -> some View {
        background(BookletScreenMarginReader(margin: margin))
    }
}

private struct BookletScreenMarginReader: UIViewRepresentable {
    @Binding var margin: CGFloat

    func makeUIView(context _: Context) -> BookletScreenMarginView {
        let view = BookletScreenMarginView()
        view.isHidden = true
        view.isUserInteractionEnabled = false
        view.onChange = { margin = $0 }
        return view
    }

    func updateUIView(_ view: BookletScreenMarginView, context _: Context) {
        view.onChange = { margin = $0 }
    }
}

private final class BookletScreenMarginView: UIView {
    var onChange: (@MainActor (CGFloat) -> Void)?
    private var reported: CGFloat?

    override func layoutSubviews() {
        super.layoutSubviews()
        report()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        report()
    }

    private func report() {
        guard let window else { return }
        let screen = convert(window.bounds.inset(by: window.safeAreaInsets), from: window)
        let margin = max(0, min(-screen.minX, screen.maxX - bounds.width))
        guard margin != reported else { return }
        reported = margin
        // After the layout pass that measured it.
        Task { @MainActor [weak self] in self?.onChange?(margin) }
    }
}
