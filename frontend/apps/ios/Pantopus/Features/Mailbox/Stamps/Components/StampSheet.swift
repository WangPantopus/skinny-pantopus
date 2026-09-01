//
//  StampSheet.swift
//  Pantopus
//
//  A17.11 — "In this book": a 4-column grid of the book's stamps.
//  The first `used` cells are postmarked (slate ink + cancellation),
//  the rest are live Forever postage. Ports the `Sheet` block in
//  `stamps.jsx`.
//

import SwiftUI

/// 4-column sheet of the book's stamps with an available/used legend.
public struct StampSheet: View {
    private let book: StampBook

    private static let columns = Array(
        repeating: GridItem(.flexible(), spacing: Spacing.s2),
        count: 4
    )
    private static let cellHeight: CGFloat = 68

    public init(book: StampBook) {
        self.book = book
    }

    public var body: some View {
        StampCard {
            StampSectionLabel("In this book") {
                AnyView(legend)
            }
            LazyVGrid(columns: Self.columns, spacing: Spacing.s2) {
                ForEach(0..<book.total, id: \.self) { index in
                    cell(used: index < book.used)
                }
            }
            .padding(10)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("In this book. \(book.remaining) available, \(book.used) used.")
        .accessibilityIdentifier("stampsSheet")
    }

    private func cell(used: Bool) -> some View {
        GeometryReader { geo in
            PerforatedStamp(
                ink: used ? StampPalette.usedInk : StampInk.local.color,
                width: geo.size.width,
                height: Self.cellHeight,
                toothRadius: 3,
                toothGap: 9,
                used: used
            )
            .opacity(used ? 0.85 : 1)
        }
        .frame(height: Self.cellHeight)
    }

    private var legend: some View {
        HStack(spacing: Spacing.s1) {
            swatch(StampInk.local.color)
            Text("\(book.remaining) available")
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            swatch(Theme.Color.appTextMuted)
                .padding(.leading, Spacing.s1)
            Text("\(book.used) used")
                .font(.system(size: 10.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private func swatch(_ color: Color) -> some View {
        RoundedRectangle(cornerRadius: 2, style: .continuous)
            .fill(color)
            .frame(width: 7, height: 7)
    }
}

#if DEBUG
#Preview("Sheet") {
    StampSheet(book: StampsSampleData.populated.book)
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
#endif
