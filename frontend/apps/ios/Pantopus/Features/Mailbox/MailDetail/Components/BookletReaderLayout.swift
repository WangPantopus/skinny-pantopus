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

/// The scroll view a mail screen reads in (`MailItemDetailShell`): its size,
/// the part its pinned actions cover, and the window it sits in.
struct MailItemReadingArea: Equatable {
    var size: CGSize = .zero
    var coveredBottom: CGFloat = 0
    /// The whole window in global coordinates; its middle is the Duo's hinge.
    var window: CGRect = .zero

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
    ///   - minX: the reader's leading edge in global coordinates.
    ///   - fold: the fold, in the reader's coordinates, while the device is half folded.
    init(width: CGFloat, minX: CGFloat, reading: MailItemReadingArea, controlsHeight: CGFloat, pageCount: Int, fold: CGRect?) {
        // The page, its controls and the gaps above and below them fit above the pinned actions.
        let chrome = Spacing.s3 + Spacing.s2 + controlsHeight + Spacing.s2
        let fit = reading.readingHeight > 0 ? max(200, reading.readingHeight - chrome) : Self.fallbackHeight
        let single = min(max(0, width - Self.edge) * 4 / 3, fit)
        // A spread may use the screen's side margins, keeping a margin from its edges.
        let room = reading.size.width > width ? max(0, (reading.size.width - width) / 2 - Spacing.s4) : 0
        let area = width + 2 * room
        let spreadHeight = min(max(0, area - Self.edge) / 2 * 4 / 3, fit)
        isSpread = pageCount > 1 && spreadHeight >= single * 0.85
        guard isSpread else {
            pageHeight = single
            pageWidth = single * 3 / 4
            areaWidth = width
            spine = width / 2
            foldGap = 0
            return
        }
        // Half folded, the spine is the fold; otherwise the hinge, the middle of the window.
        var center = area / 2
        if let fold {
            center = fold.midX + room
        } else if reading.window.width > 0 {
            center = reading.window.midX - minX + room
        }
        let gap = fold?.width ?? 0
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

#if compiler(>=6.4)
/// Reads the Duo's fold while it's half folded (a division region), in the view's coordinates.
@available(iOS 27.1, *)
private struct BookletFoldReader: ViewModifier {
    @Binding var fold: CGRect?

    func body(content: Content) -> some View {
        // Only where it runs across: scrolling moves the reader, not the fold.
        content.onGeometryChange(for: CGRect?.self) { proxy in
            proxy.reservedRegions(kind: .division)
                .first { $0.frame.height > $0.frame.width }
                .map { CGRect(x: $0.frame.minX, y: 0, width: $0.frame.width, height: 0) }
        } action: { fold = $0 }
    }
}
#endif

extension View {
    /// Keeps `fold` at the fold that runs down the view while the Duo is half folded like a book; nil otherwise.
    func readsBookletFold(_ fold: Binding<CGRect?>) -> some View {
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            return AnyView(modifier(BookletFoldReader(fold: fold)))
        }
        #endif
        return AnyView(self)
    }
}
