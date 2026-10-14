//
//  PulseTypography.swift
//  Pantopus
//
//  The Pulse build's type ramp (docs/product/pulse-build/01-build-spec.md,
//  "Accessibility"): every new Pulse screen scales with Dynamic Type, where
//  the app's older screens use fixed sizes. Same mechanism as the Plans
//  ramp (`PlanTypography.swift`): each role names the system text style it
//  grows with.
//

import SwiftUI

/// One role from the Pulse type ramp.
enum PulseTextRole {
    /// 20/26 bold: a card's or sheet's title.
    case title
    /// 17/22 semibold.
    case headline
    /// 16/22.
    case body
    /// 15/20 semibold: buttons.
    case button
    /// 14/20.
    case small
    /// 14/20 semibold: a chosen chip.
    case smallStrong
    /// 13/18.
    case footnote
    /// 13/18 semibold: a status pill.
    case footnoteStrong
    /// 12/16 semibold, upper case, +0.07em: section labels.
    case overline

    var size: CGFloat {
        switch self {
        case .title: 20
        case .headline: 17
        case .body: 16
        case .button: 15
        case .small, .smallStrong: 14
        case .footnote, .footnoteStrong: 13
        case .overline: 12
        }
    }

    var weight: Font.Weight {
        switch self {
        case .title: .bold
        case .headline, .button, .overline, .smallStrong, .footnoteStrong: .semibold
        case .body, .small, .footnote: .regular
        }
    }

    /// The system style the size grows with.
    var relativeTo: Font.TextStyle {
        switch self {
        case .title: .title3
        case .headline: .headline
        case .body: .body
        case .button, .small, .smallStrong: .subheadline
        case .footnote, .footnoteStrong: .footnote
        case .overline: .caption
        }
    }

    /// Letter spacing in points.
    var tracking: CGFloat {
        self == .overline ? 0.07 * size : 0
    }
}

private struct PulseFont: ViewModifier {
    @ScaledMetric private var size: CGFloat
    private let role: PulseTextRole

    init(_ role: PulseTextRole) {
        self.role = role
        _size = ScaledMetric(wrappedValue: role.size, relativeTo: role.relativeTo)
    }

    func body(content: Content) -> some View {
        content
            .font(.system(size: size, weight: role.weight))
            .tracking(role.tracking)
    }
}

extension View {
    /// A Pulse type role that grows with Dynamic Type.
    func pulseFont(_ role: PulseTextRole) -> some View {
        modifier(PulseFont(role))
    }
}
