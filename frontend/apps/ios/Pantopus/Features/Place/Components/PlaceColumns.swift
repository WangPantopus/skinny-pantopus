//
//  PlaceColumns.swift
//  Pantopus
//
//  Place and Today in two columns where the screen holds two phone-wide
//  columns: the open iPhone Duo held sideways. Each column keeps to its own
//  side of the hinge, so half folded like a book each half of the screen is
//  one column. Everywhere else (a phone, the closed Duo, the open Duo
//  upright) the sections stay one column in the order they're written in,
//  as they do at the accessibility text sizes (as Messages does). The
//  sections are the same views either way, so folding keeps what is open,
//  scrolled to and typed.
//

import SwiftUI

/// The column a section goes in when there are two.
enum PlaceColumn {
    case leading
    case trailing
}

private struct PlaceColumnPlacement {
    var column = PlaceColumn.leading
    /// Top padding that is the gap below the section above it in one column, left out when it starts a column.
    var trimsTop: CGFloat = 0
}

private struct PlaceColumnKey: LayoutValueKey {
    static let defaultValue = PlaceColumnPlacement()
}

extension View {
    /// The column this section goes in when `PlaceColumns` lays out two; one column keeps the written order.
    /// `order`: its place in that one-column order, which VoiceOver keeps in two columns too (it would otherwise
    /// read across both columns line by line). `trimsTop`: how much of its top padding to leave out when it starts
    /// its column, so the two columns start level.
    func placeColumn(_ column: PlaceColumn, order: Int, trimsTop: CGFloat = 0) -> some View {
        // A container, so the priority orders the section as a whole and its rows keep their own frames (a priority
        // on a single row's wrapper would stretch the row's VoiceOver frame to the wrapper).
        accessibilityElement(children: .contain)
            .accessibilitySortPriority(-Double(order))
            .layoutValue(key: PlaceColumnKey.self, value: PlaceColumnPlacement(column: column, trimsTop: trimsTop))
    }
}

private struct PlaceColumnsSplitKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// The sections are in two columns (`PlaceColumns`), for the gaps that differ between the two layouts.
    var placeColumnsSplit: Bool {
        get { self[PlaceColumnsSplitKey.self] }
        set { self[PlaceColumnsSplitKey.self] = newValue }
    }
}

/// Sections in two columns where both fit beside each other, else in one.
struct PlaceColumns<Content: View>: View {
    @ViewBuilder let content: () -> Content
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var hinge: PlaceHinge?
    @State private var width: CGFloat = 0

    var body: some View {
        let splits = !dynamicTypeSize.isAccessibilitySize
        PlaceColumnsLayout(splits: splits, hinge: hinge) { content() }
            .environment(\.placeColumnsSplit, splits && PlaceColumnsSplit(width: width, hinge: hinge) != nil)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            .readsPlaceHinge($hinge)
    }
}

/// Where the two columns go, in the sections' own coordinates.
struct PlaceColumnsSplit: Equatable {
    /// The narrowest a column gets: an iPhone SE's content width, where every section already fits.
    static let minimumColumn: CGFloat = 343
    /// Between the columns where no hinge runs down the screen.
    static let gap = Spacing.s6
    /// The narrowest width that holds two columns.
    static var minimumWidth: CGFloat {
        2 * minimumColumn + gap
    }

    /// The narrowest screen that holds two columns with a 16-pt margin each side, as Place and Today have: the
    /// screen asks the reading column around it for its whole width from there (`readableColumnWidens`).
    static var minimumScreenWidth: CGFloat {
        minimumWidth + 2 * Spacing.s4
    }

    let leadingWidth: CGFloat
    let trailingX: CGFloat
    let trailingWidth: CGFloat

    /// Two columns, each on its own side of the hinge where one runs down the sections and leaves both room;
    /// else halves. Nil when two don't fit.
    init?(width: CGFloat, hinge: PlaceHinge?) {
        guard width >= Self.minimumWidth else { return nil }
        if let hinge, hinge.minX >= Self.minimumColumn, width - hinge.maxX >= Self.minimumColumn {
            leadingWidth = hinge.minX
            trailingX = hinge.maxX
            trailingWidth = width - hinge.maxX
        } else {
            let column = ((width - Self.gap) / 2).rounded(.down)
            leadingWidth = column
            trailingX = width - column
            trailingWidth = column
        }
    }
}

/// One column in the written order, or the leading sections beside the trailing ones, each column in the
/// written order. The sections keep their identity when the arrangement changes.
struct PlaceColumnsLayout: Layout {
    /// False keeps one column at any width.
    var splits = true
    var hinge: PlaceHinge?

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let width = proposal.width ?? PlaceColumnsSplit.minimumColumn
        guard splits, let split = PlaceColumnsSplit(width: width, hinge: hinge) else {
            return CGSize(width: width, height: Self.frames(subviews[...], width: width, trims: false).height)
        }
        let leading = Self.frames(subviews.filter { $0[PlaceColumnKey.self].column == .leading }, width: split.leadingWidth, trims: true)
        let trailing = Self.frames(subviews.filter { $0[PlaceColumnKey.self].column == .trailing }, width: split.trailingWidth, trims: true)
        return CGSize(width: width, height: max(leading.height, trailing.height))
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        guard splits, let split = PlaceColumnsSplit(width: bounds.width, hinge: hinge) else {
            Self.place(subviews[...], at: bounds.origin, width: bounds.width, trims: false)
            return
        }
        Self.place(
            subviews.filter { $0[PlaceColumnKey.self].column == .leading },
            at: bounds.origin,
            width: split.leadingWidth,
            trims: true
        )
        Self.place(
            subviews.filter { $0[PlaceColumnKey.self].column == .trailing },
            at: CGPoint(x: bounds.minX + split.trailingX, y: bounds.minY),
            width: split.trailingWidth,
            trims: true
        )
    }

    /// Each section's top and height in a column of this width, and the column's height. The first section with
    /// any height starts `trimsTop` higher when `trims`.
    private static func frames(
        _ column: some Collection<LayoutSubview>,
        width: CGFloat,
        trims: Bool
    ) -> (tops: [CGFloat], height: CGFloat) {
        var tops: [CGFloat] = []
        var y: CGFloat = 0
        var started = false
        for subview in column {
            let height = subview.sizeThatFits(ProposedViewSize(width: width, height: nil)).height
            if trims, !started, height > 0 {
                y -= min(subview[PlaceColumnKey.self].trimsTop, height)
            }
            started = started || height > 0
            tops.append(y)
            y += height
        }
        return (tops, max(0, y))
    }

    private static func place(_ column: some Collection<LayoutSubview>, at origin: CGPoint, width: CGFloat, trims: Bool) {
        let tops = frames(column, width: width, trims: trims).tops
        for (subview, top) in zip(column, tops) {
            let height = subview.sizeThatFits(ProposedViewSize(width: width, height: nil)).height
            subview.place(
                at: CGPoint(x: origin.x, y: origin.y + top),
                anchor: .topLeading,
                proposal: ProposedViewSize(width: width, height: height)
            )
        }
    }
}

/// The Duo's hinge where it runs down the view (held sideways), in the view's coordinates.
struct PlaceHinge: Equatable {
    let minX: CGFloat
    let maxX: CGFloat
}

#if compiler(>=6.4)
/// Reads the Duo's hinge: a division region, inactive while the Duo lies open. Its frame takes in the margins
/// Apple keeps clear beside the fold.
@available(iOS 27.1, *)
private struct PlaceHingeReader: ViewModifier {
    @Binding var hinge: PlaceHinge?

    func body(content: Content) -> some View {
        content.onGeometryChange(for: PlaceHinge?.self) { proxy in
            proxy.reservedRegions(kind: .division, options: .includeInactive)
                .first { $0.frame.height > $0.frame.width && $0.frame.minX > 0 && $0.frame.maxX < proxy.size.width }
                .map { PlaceHinge(minX: $0.frame.minX, maxX: $0.frame.maxX) }
        } action: { hinge = $0 }
    }
}
#endif

private extension View {
    func readsPlaceHinge(_ hinge: Binding<PlaceHinge?>) -> some View {
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            return AnyView(modifier(PlaceHingeReader(hinge: hinge)))
        }
        #endif
        return AnyView(self)
    }
}

/// The gap above a section that differs between one column and two (the section above it changes).
struct PlaceColumnGap: ViewModifier {
    let oneColumn: CGFloat
    let twoColumns: CGFloat
    @Environment(\.placeColumnsSplit) private var split

    func body(content: Content) -> some View {
        content.padding(.top, split ? twoColumns : oneColumn)
    }
}
