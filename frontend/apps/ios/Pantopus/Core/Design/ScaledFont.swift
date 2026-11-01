//
//  ScaledFont.swift
//  Pantopus
//
//  Most screens set type with `.font(.system(size:weight:))`, which stays the
//  same size when someone picks a larger text size in Settings. `scaledFont`
//  takes the same size and weight and grows them with Dynamic Type, so a
//  screen can move over one call at a time without a type ramp of its own
//  (Plans and Pulse keep theirs: `PlanTypography.swift`, `PulseTypography.swift`).
//

import SwiftUI

public extension View {
    /// `.font(.system(size:weight:))` that grows with the reader's text size.
    /// It follows `style`, or by default the system style nearest to `size`
    /// (28 grows like Title, 17 like Body, 13 like Footnote).
    func scaledFont(
        _ size: CGFloat,
        weight: Font.Weight = .regular,
        relativeTo style: Font.TextStyle? = nil
    ) -> some View {
        modifier(ScaledSystemFont(size: size, weight: weight, style: style ?? Font.TextStyle.nearest(to: size)))
    }
}

public extension Font.TextStyle {
    /// The system text style whose default size is nearest to `size`: Large
    /// Title 34, Title 28, Title 2 22, Title 3 20, Body 17, Callout 16,
    /// Subheadline 15, Footnote 13, Caption 12, Caption 2 11.
    static func nearest(to size: CGFloat) -> Font.TextStyle {
        switch size {
        case 31...: .largeTitle
        case 25..<31: .title
        case 21..<25: .title2
        case 18.5..<21: .title3
        case 16.5..<18.5: .body
        case 15.5..<16.5: .callout
        case 14..<15.5: .subheadline
        case 12.5..<14: .footnote
        case 11.5..<12.5: .caption
        default: .caption2
        }
    }
}

private struct ScaledSystemFont: ViewModifier {
    @ScaledMetric private var size: CGFloat
    private let weight: Font.Weight

    init(size: CGFloat, weight: Font.Weight, style: Font.TextStyle) {
        _size = ScaledMetric(wrappedValue: size, relativeTo: style)
        self.weight = weight
    }

    func body(content: Content) -> some View {
        content.font(.system(size: size, weight: weight))
    }
}
