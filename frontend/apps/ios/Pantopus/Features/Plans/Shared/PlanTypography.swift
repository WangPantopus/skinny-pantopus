//
//  PlanTypography.swift
//  Pantopus
//
//  The Plans boards' type sizes (`project/plans.css`), scaled with Dynamic
//  Type so every Plans screen still reads at the largest text size (BRIEF
//  journey 13). Each role names the system text style it grows with.
//

import SwiftUI

/// One role from the Plans type ramp.
enum PlanTextRole {
    /// 34/41 bold: Today's large title.
    case largeTitle
    /// 30/36 bold.
    case h1
    /// 24/30 bold.
    case h2
    /// 20/26 semibold.
    case h3
    /// 17/22 semibold.
    case h4
    /// 16/24.
    case body
    /// 16/24 semibold.
    case bodyStrong
    /// 16/21 semibold: a plan row's title.
    case rowTitle
    /// 15/20 semibold: small buttons.
    case buttonSmall
    /// 14/20.
    case small
    /// 14/20 semibold.
    case smallStrong
    /// 13/18: a row's second line, specs.
    case footnote
    /// 13/18 semibold: tags, labels.
    case label
    /// 12/16.
    case caption
    /// 12/16 medium: status chips.
    case chip
    /// 12/16 semibold, upper case, +0.07em: section labels.
    case overline
    /// 11/13 bold: the time under a pin.
    case pinTag

    var size: CGFloat {
        switch self {
        case .largeTitle: 34
        case .h1: 30
        case .h2: 24
        case .h3: 20
        case .h4: 17
        case .body, .bodyStrong, .rowTitle: 16
        case .buttonSmall: 15
        case .small, .smallStrong: 14
        case .footnote, .label: 13
        case .caption, .chip, .overline: 12
        case .pinTag: 11
        }
    }

    var weight: Font.Weight {
        switch self {
        case .largeTitle, .h1, .h2, .pinTag: .bold
        case .h3, .h4, .bodyStrong, .rowTitle, .buttonSmall, .smallStrong, .label, .overline: .semibold
        case .chip: .medium
        case .body, .small, .footnote, .caption: .regular
        }
    }

    /// The system style the size grows with.
    var relativeTo: Font.TextStyle {
        switch self {
        case .largeTitle: .largeTitle
        case .h1: .title
        case .h2: .title2
        case .h3: .title3
        case .h4, .bodyStrong, .rowTitle: .headline
        case .body: .body
        case .buttonSmall, .small, .smallStrong: .subheadline
        case .footnote, .label: .footnote
        case .caption, .chip, .overline: .caption
        case .pinTag: .caption2
        }
    }

    /// Letter spacing in points (CSS `em` × size).
    var tracking: CGFloat {
        switch self {
        case .largeTitle, .h1: -0.02 * size
        case .h2: -0.015 * size
        case .h3: -0.012 * size
        case .h4: -0.01 * size
        case .overline: 0.07 * size
        default: 0
        }
    }
}

private struct PlanFont: ViewModifier {
    @ScaledMetric private var size: CGFloat
    private let role: PlanTextRole

    init(_ role: PlanTextRole) {
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
    /// A Plans board type role that grows with Dynamic Type.
    func planFont(_ role: PlanTextRole) -> some View {
        modifier(PlanFont(role))
    }
}

extension Text {
    /// An upper-case section label ("YOUR PLANS", "TODAY").
    static func planOverline(_ copy: String) -> some View {
        Text(verbatim: copy.uppercased())
            .planFont(.overline)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .accessibilityAddTraits(.isHeader)
    }
}
