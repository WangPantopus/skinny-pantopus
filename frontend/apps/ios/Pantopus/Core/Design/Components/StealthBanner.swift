//
//  StealthBanner.swift
//  Pantopus
//
//  A14.7 Privacy — the dark "Stealth mode is on" banner pinned above the
//  first group in the stealth (most-private) frame. A near-black slate
//  card with a sky-tinted eye-off icon disc + a one-line consequence
//  note. No action — it reflects state set elsewhere. Driven by
//  primitive params so the shared `GroupedListView` can render it from a
//  `GroupedListBanner` with `style == .stealth`.
//
//  The design slate is `#0b1220`; we use `appText` (`#111827`, the
//  darkest neutral token) to stay token-only — a hair lighter, no new
//  palette entry.
//

import SwiftUI

@MainActor
public struct StealthBanner: View {
    private let icon: PantopusIcon
    private let title: String
    private let subtitle: String?

    public init(
        icon: PantopusIcon,
        title: String,
        subtitle: String? = nil
    ) {
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
    }

    public var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                Circle()
                    .fill(Theme.Color.appTextInverse.opacity(0.1))
                    .frame(width: 32, height: 32)
                Icon(icon, size: 16, color: Theme.Color.primary300)
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextInverse.opacity(0.65))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appText)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("stealthBanner")
    }
}

#Preview("Stealth banner") {
    StealthBanner(
        icon: .eyeOff,
        title: "Stealth mode is on",
        subtitle: "Your profile is hidden from search. Existing connections still see you."
    )
    .padding(Spacing.s3)
    .background(Theme.Color.appBg)
}
