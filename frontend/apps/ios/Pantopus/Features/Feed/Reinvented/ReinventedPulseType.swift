//
//  ReinventedPulseType.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 6 (PHASE-6 §2 C, the founder's point 2: "more elegance and less chaos"): the new Pulse's
//  words one step down (titles 15 semibold, body 14, meta 12), scaled with the person's own text size setting as the
//  phone's text styles are. Only this build's screens use it.
//

import SwiftUI

extension View {
    /// The new Pulse's type, from the size it was drawn at before phase 6: one step down, scaled like the text style of
    /// its size (a title like Subheadline, body like Footnote, meta like Caption).
    func pulseFont(_ size: CGFloat, weight: Font.Weight = .regular) -> some View {
        modifier(ReinventedPulseFont(size: ReinventedPulseFont.stepDown(size), weight: weight))
    }

    /// Phase 6's own screens, drawn at the new sizes already: scaled the same way, not stepped down again.
    func pulseFont(sized size: CGFloat, weight: Font.Weight = .regular) -> some View {
        modifier(ReinventedPulseFont(size: size, weight: weight))
    }
}

struct ReinventedPulseFont: ViewModifier {
    @ScaledMetric private var size: CGFloat
    private let weight: Font.Weight

    init(size: CGFloat, weight: Font.Weight) {
        let style: Font.TextStyle = size >= 15 ? .subheadline : size >= 13 ? .footnote : .caption
        _size = ScaledMetric(wrappedValue: size, relativeTo: style)
        self.weight = weight
    }

    func body(content: Content) -> some View {
        content.font(.system(size: size, weight: weight))
    }

    /// 17 and up lose two points, 13 to 17 one, 12 to 13 become 12 (meta); 12 and under stay.
    static func stepDown(_ size: CGFloat) -> CGFloat {
        if size >= 17 { return size - 2 }
        if size >= 13 { return size - 1 }
        return min(size, 12)
    }
}
