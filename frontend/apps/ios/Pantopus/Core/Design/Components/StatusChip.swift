//
//  StatusChip.swift
//  Pantopus
//
//  Semantic-colored pill. Variants cover success / warning / error / info,
//  the three identity pillars, and a neutral fallback.
//

import SwiftUI

/// Semantic variant for status / intent pills.
public enum StatusChipVariant: Sendable {
    case success, warning, error, info
    case personal, home, business
    case neutral
}

/// Pill chip with tinted background + foreground.
///
/// - Parameters:
///   - text: Visible label.
///   - variant: Semantic tint.
///   - icon: Optional leading Pantopus icon.
@MainActor
public struct StatusChip: View {
    private let text: String
    private let variant: StatusChipVariant
    private let icon: PantopusIcon?

    public init(_ text: String, variant: StatusChipVariant = .neutral, icon: PantopusIcon? = nil) {
        self.text = text
        self.variant = variant
        self.icon = icon
    }

    public var body: some View {
        HStack(spacing: Spacing.s1) {
            if let icon {
                Icon(icon, size: 14, color: foreground)
            }
            Text(text)
                .pantopusTextStyle(.caption)
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
        .accessibilityLabel("\(text), \(a11yVariant)")
    }

    private var background: Color {
        switch variant {
        case .success: Theme.Color.successBg
        case .warning: Theme.Color.warningBg
        case .error: Theme.Color.errorBg
        case .info: Theme.Color.infoBg
        case .personal: Theme.Color.personalBg
        case .home: Theme.Color.homeBg
        case .business: Theme.Color.businessBg
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    private var foreground: Color {
        switch variant {
        case .success: Theme.Color.success
        case .warning: Theme.Color.warning
        case .error: Theme.Color.error
        case .info: Theme.Color.info
        case .personal: Theme.Color.personal
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        case .neutral: Theme.Color.appTextSecondary
        }
    }

    private var a11yVariant: String {
        switch variant {
        case .success: "success"
        case .warning: "warning"
        case .error: "error"
        case .info: "info"
        case .personal: "personal"
        case .home: "home"
        case .business: "business"
        case .neutral: "neutral"
        }
    }
}

#Preview("All variants") {
    VStack(alignment: .leading, spacing: Spacing.s2) {
        HStack {
            StatusChip("Paid", variant: .success, icon: .check)
            StatusChip("Due in 3 days", variant: .warning)
            StatusChip("Overdue", variant: .error, icon: .alertCircle)
            StatusChip("Info", variant: .info)
        }
        HStack {
            StatusChip("Personal", variant: .personal)
            StatusChip("Home", variant: .home)
            StatusChip("Business", variant: .business)
            StatusChip("Neutral", variant: .neutral)
        }
    }
    .padding()
    .background(Theme.Color.appBg)
}
