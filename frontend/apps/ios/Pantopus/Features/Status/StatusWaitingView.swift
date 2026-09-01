//
//  StatusWaitingView.swift
//  Pantopus
//
//  A18 Status / waiting / preview — a bespoke single-frame layout. Pure
//  presentational: the caller builds a `StatusWaitingContent` snapshot and
//  the view renders every slot the design lists, centred ceremonial-style:
//  HaloCircle → headline → body → optional address chip → optional timeline
//  → status pill → actions (in-body stack OR sticky dock) → optional footer.
//
//  P8.5 swapped the ad-hoc illustration disc for the `HaloCircle` primitive
//  and added the status-pill tones, address chip, date-bearing timeline, and
//  in-body button stack the A18.1/.2/.3 frames need. The pill / stack / timeline
//  sub-pieces live in `StatusWaitingComponents.swift`.
//

import SwiftUI

public struct StatusWaitingView: View {
    private let content: StatusWaitingContent
    private let onAction: @MainActor (StatusActionCard) -> Void
    private let onStackAction: @MainActor (StatusActionButton) -> Void
    private let onPrimary: @MainActor (StatusCTA) -> Void
    private let onSecondary: @MainActor (StatusCTA) -> Void

    public init(
        content: StatusWaitingContent,
        onAction: @escaping @MainActor (StatusActionCard) -> Void = { _ in },
        onStackAction: @escaping @MainActor (StatusActionButton) -> Void = { _ in },
        onPrimary: @escaping @MainActor (StatusCTA) -> Void = { _ in },
        onSecondary: @escaping @MainActor (StatusCTA) -> Void = { _ in }
    ) {
        self.content = content
        self.onAction = onAction
        self.onStackAction = onStackAction
        self.onPrimary = onPrimary
        self.onSecondary = onSecondary
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(spacing: Spacing.s5) {
                    StatusWaitingBodyView(
                        content: content,
                        onAction: onAction,
                        onStackAction: onStackAction
                    )
                    Spacer(minLength: Spacing.s6)
                }
                .padding(Spacing.s4)
                .frame(maxWidth: .infinity)
            }
            bottomChrome
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("statusWaiting")
    }

    // MARK: - Bottom chrome (footer OR sticky dock)

    @ViewBuilder
    private var bottomChrome: some View {
        if !content.actionStack.isEmpty {
            if let footnote = content.footnote { footnoteFooter(footnote) }
        } else if content.primaryCta != nil || content.secondaryCta != nil {
            stickyDock
        }
    }

    private func footnoteFooter(_ text: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.info, size: 11, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            Text(text)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s2)
        .padding(.bottom, Spacing.s6)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("statusFootnote")
    }

    private var stickyDock: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            VStack(spacing: Spacing.s2) {
                if let primary = content.primaryCta {
                    Button { onPrimary(primary) } label: {
                        HStack(spacing: 7) {
                            if let icon = primary.icon {
                                Icon(icon, size: 15, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                            }
                            Text(primary.label)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(Theme.Color.appTextInverse)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Theme.Color.primary600)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .shadow(color: Theme.Color.primary600.opacity(0.3), radius: 9, x: 0, y: 8)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("statusPrimaryCta")
                }
                if let secondary = content.secondaryCta {
                    Button { onSecondary(secondary) } label: {
                        Text(secondary.label)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("statusSecondaryCta")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s6)
            .background(Theme.Color.appSurface)
        }
    }
}

/// Status / waiting body used INSIDE another scaffold (e.g. the Homes
/// wizards' success step). Renders the centred body minus the bottom
/// chrome — the wizard's own sticky CTA row replaces it. Mirrors Android
/// `StatusWaitingBody`.
public struct StatusWaitingBodyView: View {
    private let content: StatusWaitingContent
    private let onAction: @MainActor (StatusActionCard) -> Void
    private let onStackAction: @MainActor (StatusActionButton) -> Void

    public init(
        content: StatusWaitingContent,
        onAction: @escaping @MainActor (StatusActionCard) -> Void = { _ in },
        onStackAction: @escaping @MainActor (StatusActionButton) -> Void = { _ in }
    ) {
        self.content = content
        self.onAction = onAction
        self.onStackAction = onStackAction
    }

    public var body: some View {
        VStack(spacing: Spacing.s5) {
            HaloCircle(tone: content.halo.tone, icon: content.halo.icon, isPulsing: content.halo.isPulsing)
            headlineBlock
            if let chip = content.addressChip { addressChip(chip) }
            if !content.timeline.isEmpty { timelineBlock }
            if let pill = content.statusPill { StatusPillView(pill: pill) }
            if !content.actionStack.isEmpty { actionStack }
            if !content.actionCards.isEmpty { actionCards }
            if !content.explainerBullets.isEmpty { explainerBlock }
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("statusWaitingBody")
    }

    // MARK: - Body slots

    private var headlineBlock: some View {
        VStack(spacing: Spacing.s2) {
            Text(content.headline)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("statusHeadline")
            styledSubcopy
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)
                .accessibilityIdentifier("statusSubcopy")
        }
        .frame(maxWidth: .infinity)
    }

    /// Body copy with the optional `bodyEmphasis` fragment rendered bold.
    private var styledSubcopy: Text {
        guard let emphasis = content.bodyEmphasis,
              !emphasis.isEmpty,
              let range = content.subcopy.range(of: emphasis)
        else {
            return Text(content.subcopy)
        }
        let before = String(content.subcopy[content.subcopy.startIndex..<range.lowerBound])
        let after = String(content.subcopy[range.upperBound...])
        return Text(before)
            + Text(emphasis).fontWeight(.bold).foregroundColor(Theme.Color.appText)
            + Text(after)
    }

    private func addressChip(_ text: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Icon(.home, size: 13, strokeWidth: 2.2, color: Theme.Color.primary600)
            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .frame(maxWidth: 300)
        .accessibilityIdentifier("statusAddressChip")
    }

    private var timelineBlock: some View {
        StatusTimelineView(stages: content.timeline, currentStageId: content.currentStageId)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s4)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .accessibilityIdentifier("statusTimeline")
    }

    private var actionStack: some View {
        VStack(spacing: 10) {
            ForEach(content.actionStack) { button in
                StatusStackButton(button: button) { onStackAction(button) }
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("statusActionStack")
    }

    private var actionCards: some View {
        VStack(spacing: 10) {
            ForEach(content.actionCards) { card in
                Button { onAction(card) } label: { actionCardBody(card) }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("statusActionCard_\(card.id)")
            }
        }
    }

    private func actionCardBody(_ card: StatusActionCard) -> some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.primary50).frame(width: 36, height: 36)
                Icon(card.icon, size: 18, color: Theme.Color.primary600)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(card.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                if let subtitle = card.subtitle {
                    Text(subtitle)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextSecondary)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var explainerBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("WHAT HAPPENS NEXT")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            ForEach(content.explainerBullets, id: \.self) { bullet in
                HStack(alignment: .top, spacing: Spacing.s2) {
                    Icon(.check, size: 14, color: Theme.Color.success)
                        .padding(.top, 2)
                    Text(bullet)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("statusExplainer")
    }
}

// MARK: - Previews

#Preview("A18.2 Claim submitted") {
    StatusWaitingView(content: .claimSubmitted(homeName: "418 Linden Ave, Oakland CA"))
}

#Preview("A18.2 Approved") {
    StatusWaitingView(content: .claimSubmitted(homeName: "418 Linden Ave, Oakland CA", approved: true))
}

#Preview("A18.3 Verification submitted") {
    StatusWaitingView(
        content: .verificationSubmitted(homeName: "418 Linden Ave · Apt 3B", landlordEmail: "r.osman@acme-realty.com")
    )
}

#Preview("A18.3 Landlord confirmed") {
    StatusWaitingView(
        content: .verificationSubmitted(
            homeName: "418 Linden Ave · Apt 3B",
            landlordEmail: "r.osman@acme-realty.com",
            landlordName: "Rashida Osman",
            confirmed: true
        )
    )
}

#Preview("A18.1 Check your email") {
    StatusWaitingView(content: .checkYourEmail(email: "maria.k@email.com"))
}

#Preview("A18.1 Resent") {
    StatusWaitingView(content: .checkYourEmail(email: "maria.k@email.com", resent: true))
}
