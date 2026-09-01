//
//  EventTypeEditorCards.swift
//  Pantopus
//
//  Stream I2 — B2 editor card / row subviews: the Stripe-connect card, the
//  icon toggle row, the collective member-avatar stack, and the inline
//  info / call-to-action card. Split out of `EventTypeEditorComponents.swift`
//  to keep each file under the line-length budget. Tokens only.
//

import SwiftUI

/// Stripe-not-connected inline card — the design's Stripe-branded `StripeCard`
/// (stripeBg surface, brand-purple border, Stripe-purple tile) with a
/// credit-card tile, the connect copy, and a full-width sky "Connect Stripe"
/// button carrying an external-link glyph. Uses the dedicated Stripe brand mark
/// token rather than the business pillar violet.
struct StripeConnectCard: View {
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .fill(Theme.Color.stripeBrand)
                        .frame(width: 30, height: 30)
                    Icon(.creditCard, size: 15, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                }
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Connect payments to charge for bookings")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                    Text("Pantopus uses Stripe to collect payments and deposits. It takes about a minute.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
            }
            Button(action: action) {
                HStack(spacing: Spacing.s2) {
                    Icon(.externalLink, size: 14, color: Theme.Color.appTextInverse)
                    Text("Connect Stripe")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity, minHeight: 38)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("scheduling.eventType.connectStripe")
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Stripe brand tint (design stripeBg) + brand-purple border, both
        // derived from the Stripe brand mark token so no raw hex reaches a
        // Color initialiser.
        .background(Theme.Color.stripeBrand.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.stripeBrand.opacity(0.22), lineWidth: 1)
        )
    }
}

/// Toggle row with a leading icon tile — the design's `ControlsCard` `ToggleRow`
/// idiom (icon tile tints sky when on, sunken when off; product-sky switch on
/// the trailing edge; title + sub).
struct IconToggleRow: View {
    let icon: PantopusIcon
    let title: String
    let subtitle: String
    @Binding var isOn: Bool

    var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(isOn ? Theme.Color.primary50 : Theme.Color.appSurfaceSunken)
                    .frame(width: 30, height: 30)
                Icon(icon, size: 15, color: isOn ? Theme.Color.primary600 : Theme.Color.appTextSecondary)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text(subtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Toggle("", isOn: $isOn)
                .labelsHidden()
                .tint(Theme.Color.primary600)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Overlapping avatar discs for the Assignment-card collective mode — mirrors
/// the design's `MemberAvatars` row (event-editor-frames.jsx line 129).
/// Renders `totalCount` discs using the pillar accent; discs beyond
/// `requiredCount` are dimmed (opacity 0.35) to signal they're not required
/// for the slot to open. Member data is not yet surfaced by the event-type DTO
/// so this uses placeholder user-icon discs; real initials can be wired in when
/// the DTO exposes a `members` array.
struct CollectiveMemberAvatarStack: View {
    /// Total number of seated team members on this event type.
    let totalCount: Int
    /// How many must be free for a slot to open (mirrors `requiredHosts`).
    let requiredCount: Int
    /// Pillar accent colour for the disc fill tint and icon stroke.
    let accent: Color

    var body: some View {
        HStack(spacing: -10) {
            ForEach(0..<max(1, min(totalCount, 6)), id: \.self) { index in
                let isRequired = index < requiredCount
                ZStack {
                    Circle()
                        .fill(accent.opacity(isRequired ? 0.18 : 0.07))
                    Circle()
                        .strokeBorder(Theme.Color.appSurface, lineWidth: 2)
                    Icon(.user, size: 11, color: accent.opacity(isRequired ? 1.0 : 0.35))
                }
                .frame(width: 28, height: 28)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(requiredCount) of \(totalCount) hosts required")
    }
}

/// Inline info / call-to-action card (Stripe connect, coming-soon notice).
struct EventInfoCard: View {
    enum Tone { case info, warning }

    let icon: PantopusIcon
    let title: String
    let message: String
    var tone: Tone = .info
    var actionTitle: String?
    var action: (() -> Void)?

    private var fg: Color {
        tone == .warning ? Theme.Color.warning : Theme.Color.info
    }

    private var bg: Color {
        tone == .warning ? Theme.Color.warningBg : Theme.Color.infoBg
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 18, color: fg)
                Text(title)
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
            }
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(fg)
                        .padding(.horizontal, Spacing.s3)
                        .padding(.vertical, Spacing.s2)
                        .overlay(Capsule().stroke(fg, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .padding(.top, Spacing.s1)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}
