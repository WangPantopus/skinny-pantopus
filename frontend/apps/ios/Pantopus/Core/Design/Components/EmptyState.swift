//
//  EmptyState.swift
//  Pantopus
//
//  Shared empty-state: 72×72 tinted circle + Lucide icon + H3 headline +
//  subcopy + optional primary CTA.
//

import SwiftUI

/// Shared empty-state scaffold.
///
/// - Parameters:
///   - icon: Pantopus icon rendered in the hero circle.
///   - headline: Bold H3 message, e.g. "No messages yet".
///   - subcopy: Supporting sentence in muted tone.
///   - cta: Optional primary action (title + async handler).
///   - tint: Hero circle background. Defaults to the personal identity bg.
///   - accent: Icon stroke color. Defaults to `primary-600`.
@MainActor
public struct EmptyState: View {
    /// Primary-CTA payload.
    public struct CTA {
        /// Title shown on the button.
        public let title: String
        /// Invoked on tap. Async to support sign-in / retry flows.
        public let action: () async -> Void

        public init(title: String, action: @escaping () async -> Void) {
            self.title = title
            self.action = action
        }
    }

    private let icon: PantopusIcon
    private let headline: String
    private let subcopy: String
    private let cta: CTA?
    private let tint: Color
    private let accent: Color

    public init(
        icon: PantopusIcon,
        headline: String,
        subcopy: String,
        cta: CTA? = nil,
        tint: Color = Theme.Color.personalBg,
        accent: Color = Theme.Color.primary600
    ) {
        self.icon = icon
        self.headline = headline
        self.subcopy = subcopy
        self.cta = cta
        self.tint = tint
        self.accent = accent
    }

    public var body: some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle().fill(tint).frame(width: 72, height: 72)
                Icon(icon, size: 32, color: accent)
            }
            .accessibilityHidden(true)

            Text(headline)
                .pantopusTextStyle(.h3)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)

            Text(subcopy)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)

            if let cta {
                PrimaryButton(title: cta.title, action: cta.action)
                    .padding(.top, Spacing.s2)
            }
        }
        .padding(.horizontal, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(headline). \(subcopy)")
    }
}

#Preview("No CTA") {
    EmptyState(
        icon: .inbox,
        headline: "No mail yet",
        subcopy: "When a neighbor sends you something, it'll land here."
    )
}

#Preview("With CTA") {
    EmptyState(
        icon: .home,
        headline: "No home verified",
        subcopy: "Claim your address to unlock neighborhood features.",
        cta: .init(title: "Claim address") {}
    )
}
