//
//  DiscoveryNotice.swift
//  Pantopus
//
//  Stream I5 — the calm centered notice card shared by the public discovery
//  surfaces (C5 paused/empty, C6 paused, C8 no-availability variants). Matches
//  the Calendarly design: a sunken icon disc, a semibold title, and a secondary
//  caption, on either a solid white card or a dashed "nothing here yet" card.
//  No alarm styling.
//

import SwiftUI

struct DiscoveryNotice: View {
    let icon: PantopusIcon
    let title: String
    let message: String
    /// Dashed border (used for the "no times set up / no open times" empties).
    var dashed: Bool = false
    /// Rounded-square icon tile (vs. a circle).
    var iconRounded: Bool = false

    var body: some View {
        VStack(spacing: Spacing.s2) {
            Icon(icon, size: 21, strokeWidth: 1.9, color: Theme.Color.appTextSecondary)
                .frame(width: 46, height: 46)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: iconRounded ? Radii.lg : Radii.pill, style: .continuous))
            Text(title)
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 220)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s6)
        .padding(.horizontal, Spacing.s5)
        .background(background)
    }

    @ViewBuilder
    private var background: some View {
        if dashed {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [5]))
        } else {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .fill(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                )
        }
    }
}

/// The calm "no open times" card (C8 F3/F4): a dashed card with a sunken icon
/// disc, headline, caption, a filled-accent primary action, and an optional
/// outlined secondary action. No alarm styling.
struct DiscoveryEmptyCard: View {
    let icon: PantopusIcon
    let headline: String
    let caption: String
    let primaryTitle: String
    var primaryIcon: PantopusIcon?
    let primaryAction: () async -> Void
    var secondaryTitle: String?
    var secondaryIcon: PantopusIcon?
    var secondaryAction: (() -> Void)?

    var body: some View {
        VStack(spacing: Spacing.s2) {
            Icon(icon, size: 23, strokeWidth: 1.85, color: Theme.Color.appTextSecondary)
                .frame(width: 50, height: 50)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
            Text(headline)
                // Spec EmptyCard title: 15pt/700, 20px line-height, ~230 max width.
                .font(.system(size: 15, weight: .bold))
                .lineSpacing(20 - 15)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 230)
            Text(caption)
                // Spec EmptyCard body: 12pt, 17px line-height, ~225 max width.
                .font(.system(size: 12, weight: .regular))
                .lineSpacing(17 - 12)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 225)
            VStack(spacing: Spacing.s2) {
                Button { Task { await primaryAction() } } label: {
                    actionLabel(primaryTitle, icon: primaryIcon, filled: true)
                }
                .buttonStyle(.plain)
                if let secondaryTitle, let secondaryAction {
                    Button(action: secondaryAction) {
                        actionLabel(secondaryTitle, icon: secondaryIcon, filled: false)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, Spacing.s2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s6)
        .padding(.horizontal, Spacing.s5)
        .background(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [5]))
        )
    }

    private func actionLabel(_ title: String, icon: PantopusIcon?, filled: Bool) -> some View {
        HStack(spacing: Spacing.s2) {
            if let icon {
                Icon(icon, size: 15, color: filled ? Theme.Color.appTextInverse : Theme.Color.appText)
            }
            Text(title)
                .pantopusTextStyle(.small)
                .fontWeight(.bold)
                .foregroundStyle(filled ? Theme.Color.appTextInverse : Theme.Color.appText)
        }
        .frame(maxWidth: .infinity)
        .frame(height: filled ? 44 : 42)
        .background(filled ? Theme.Color.primary600 : Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(filled ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}
