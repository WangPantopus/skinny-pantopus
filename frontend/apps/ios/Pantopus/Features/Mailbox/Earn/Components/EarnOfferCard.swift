//
//  EarnOfferCard.swift
//  Pantopus
//
//  One envelope on the Earn drawer's paid-offer wall. Sealed envelopes
//  carry a warm-amber "OPEN TO EARN 25¢" flap and the whole card is the
//  open affordance; once opened the flap is replaced by an engagement
//  badge and the Save / Reveal actions unlock.
//
//  The advertiser's `business_color` is deliberately NOT painted — the
//  wall stays inside the token system on the warm-amber Earn accent.
//

import SwiftUI

struct EarnOfferCard: View {
    let offer: EarnOfferItem
    var isBusy: Bool = false
    var onOpen: () -> Void = {}
    var onSave: () -> Void = {}
    var onReveal: () -> Void = {}

    var body: some View {
        VStack(spacing: Spacing.s0) {
            if !offer.engagement.isOpen {
                flap
            }
            envelopeBody
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(
                    offer.engagement.isOpen ? Theme.Color.warmAmberBg : Theme.Color.appBorder,
                    lineWidth: offer.engagement.isOpen ? 1.5 : 1
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .pantopusShadow(.sm)
        .contentShape(Rectangle())
        .onTapGesture {
            guard !offer.engagement.isOpen, !isBusy else { return }
            onOpen()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("earnOfferCard-\(offer.id)")
    }

    // MARK: - Sealed flap

    private var flap: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.mail, size: 14, strokeWidth: 2.2, color: Theme.Color.warmAmber)
            Text(flapTitle)
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.warmAmber)
            Spacer(minLength: Spacing.s2)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warmAmberBg)
        .accessibilityIdentifier("earnOfferFlap-\(offer.id)")
    }

    private var flapTitle: String {
        offer.payoutLabel.isEmpty
            ? "OPEN TO EARN"
            : "OPEN TO EARN \(offer.payoutLabel)"
    }

    // MARK: - Body

    private var envelopeBody: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            header
            Text(offer.title)
                .font(.system(size: 14, weight: .semibold))
                .tracking(-0.15)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            if let subtitle = offer.subtitle {
                Text(subtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let hint = dwellHint {
                Text(hint)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .accessibilityIdentifier("earnOfferDwellHint-\(offer.id)")
            }
            if offer.engagement.isOpen {
                actions
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            avatar
            VStack(alignment: .leading, spacing: 1) {
                Text(offer.businessName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(offer.expiryLabel)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s2)
            if offer.engagement.isOpen {
                badge
            }
        }
    }

    private var avatar: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg - 2, style: .continuous)
                .fill(Theme.Color.warmAmberBg)
            Text(offer.initials)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.warmAmber)
        }
        .frame(width: 38, height: 38)
        .accessibilityHidden(true)
    }

    // MARK: - Engagement badge

    private var badge: some View {
        HStack(spacing: Spacing.s1) {
            Icon(badgeIcon, size: 12, strokeWidth: 2.2, color: badgeForeground)
            Text(badgeText)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(badgeForeground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(badgeBackground)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
        .accessibilityIdentifier("earnOfferBadge-\(offer.id)")
    }

    private var badgeText: String {
        switch offer.engagement {
        case .unopened: ""
        case let .dwelling(seconds): "Banking · \(seconds)s"
        case .pending: "Not banked yet"
        case .earned: offer.payoutLabel.isEmpty ? "Earned" : "+\(offer.payoutLabel) earned"
        case .held: "Under review"
        }
    }

    private var badgeIcon: PantopusIcon {
        switch offer.engagement {
        case .dwelling: .timer
        case .earned: .checkCircle
        case .held: .shieldAlert
        case .pending, .unopened: .clock
        }
    }

    private var badgeForeground: Color {
        switch offer.engagement {
        case .earned: Theme.Color.success
        case .held: Theme.Color.warning
        case .dwelling: Theme.Color.warmAmber
        case .pending, .unopened: Theme.Color.appTextSecondary
        }
    }

    private var badgeBackground: Color {
        switch offer.engagement {
        case .earned: Theme.Color.successBg
        case .held: Theme.Color.warningBg
        case .dwelling: Theme.Color.warmAmberBg
        case .pending, .unopened: Theme.Color.appSurfaceSunken
        }
    }

    private var dwellHint: String? {
        switch offer.engagement {
        case let .dwelling(seconds):
            "Keep this offer open for \(seconds)s more to bank it."
        case .pending:
            "This one didn't reach the \(EarnOfferDwell.seconds)-second window, so it hasn't been paid."
        case .held:
            "Held while we check unusual activity on your account."
        case .earned, .unopened:
            nil
        }
    }

    // MARK: - Actions

    private var actions: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onSave) {
                Text("Save offer")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .background(Theme.Color.warmAmber)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(isBusy)
            .accessibilityIdentifier("earnOfferSave-\(offer.id)")

            Button(action: onReveal) {
                Text("Reveal code")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
            .disabled(isBusy)
            .accessibilityIdentifier("earnOfferReveal-\(offer.id)")
        }
        .padding(.top, Spacing.s1)
    }
}

#Preview("Offer · sealed") {
    EarnOfferCard(
        offer: EarnOfferItem(
            id: "1",
            businessName: "Corner Bakery",
            initials: "CB",
            title: "Free coffee with any pastry",
            subtitle: "Weekdays before 11am",
            expiryLabel: "Offer expires Mar 4",
            payoutLabel: "25¢",
            engagement: .unopened
        )
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}

#Preview("Offer · banking") {
    EarnOfferCard(
        offer: EarnOfferItem(
            id: "2",
            businessName: "Corner Bakery",
            initials: "CB",
            title: "Free coffee with any pastry",
            subtitle: "Weekdays before 11am",
            expiryLabel: "Offer expires Mar 4",
            payoutLabel: "25¢",
            engagement: .dwelling(secondsRemaining: 9)
        )
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}

#Preview("Offer · earned") {
    EarnOfferCard(
        offer: EarnOfferItem(
            id: "3",
            businessName: "Corner Bakery",
            initials: "CB",
            title: "Free coffee with any pastry",
            subtitle: nil,
            expiryLabel: "Limited time",
            payoutLabel: "25¢",
            engagement: .earned
        )
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
