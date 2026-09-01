//
//  NotYetAvailableView.swift
//  Pantopus
//
//  Placeholder body for tabs whose designed UI hasn't landed yet. Replaced
//  by the shared EmptyState component in Prompt P5.
//

import SwiftUI

/// Empty-state placeholder for an un-designed tab.
///
/// - Parameters:
///   - tabName: The tab's display name (e.g. "Nearby").
///   - icon: The icon to tint in the hero circle.
///   - accent: Background tint for the circle (one of the identity tokens).
///   - foreground: Foreground tint for the icon stroke.
public struct NotYetAvailableView: View {
    private let tabName: String
    private let icon: PantopusIcon
    private let accent: Color
    private let foreground: Color

    public init(
        tabName: String,
        icon: PantopusIcon,
        accent: Color = Theme.Color.personalBg,
        foreground: Color = Theme.Color.primary600
    ) {
        self.tabName = tabName
        self.icon = icon
        self.accent = accent
        self.foreground = foreground
    }

    public var body: some View {
        EmptyState(
            icon: icon,
            headline: "\(tabName) isn't here yet",
            subcopy: "We're still designing this tab. Check back soon.",
            tint: accent,
            accent: foreground
        )
    }
}

#Preview {
    NotYetAvailableView(tabName: "Nearby", icon: .map)
}
