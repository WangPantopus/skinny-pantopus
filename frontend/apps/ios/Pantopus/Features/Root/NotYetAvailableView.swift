//
//  NotYetAvailableView.swift
//  Pantopus
//
//  Placeholder body for destinations whose screen isn't in the app yet.
//  Says so plainly, names the destination in the bar, and always offers a
//  way back.
//

import SwiftUI

/// Empty-state placeholder for a destination that isn't built yet.
///
/// - Parameters:
///   - tabName: The destination's display name (e.g. "Nearby"). Never an id.
///   - icon: The icon to tint in the hero circle.
///   - accent: Background tint for the circle (one of the identity tokens).
///   - foreground: Foreground tint for the icon stroke.
///   - onBack: Pops the placeholder. When nil, the view dismisses itself
///     (a NavigationStack push pops).
public struct NotYetAvailableView: View {
    @Environment(\.dismiss) private var dismiss
    private let tabName: String
    private let icon: PantopusIcon
    private let accent: Color
    private let foreground: Color
    private let onBack: (@MainActor () -> Void)?

    public init(
        tabName: String,
        icon: PantopusIcon,
        accent: Color = Theme.Color.personalBg,
        foreground: Color = Theme.Color.primary600,
        onBack: (@MainActor () -> Void)? = nil
    ) {
        self.tabName = tabName
        self.icon = icon
        self.accent = accent
        self.foreground = foreground
        self.onBack = onBack
    }

    public var body: some View {
        EmptyState(
            icon: icon,
            headline: "\(tabName) isn't in the app yet",
            subcopy: "We're still building this part of Pantopus.",
            cta: EmptyState.CTA(title: "Go back") { @MainActor in goBack() },
            tint: accent,
            accent: foreground
        )
        .navigationTitle(tabName)
        .navigationBarTitleDisplayMode(.inline)
    }

    @MainActor
    private func goBack() {
        if let onBack {
            onBack()
        } else {
            dismiss()
        }
    }
}

#Preview {
    NotYetAvailableView(tabName: "Nearby", icon: .map)
}
