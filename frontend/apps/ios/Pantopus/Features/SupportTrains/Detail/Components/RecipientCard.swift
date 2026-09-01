//
//  RecipientCard.swift
//  Pantopus
//
//  A10.9 — "For" overline + recipient card. The household is
//  foregrounded with an identity-tinted avatar gradient + verified
//  disc + address pin, then a muted quote block with a leading quote
//  glyph so the request reads human.
//

import SwiftUI

@MainActor
public struct RecipientCard: View {
    private let content: RecipientCardContent

    public init(content: RecipientCardContent) {
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            header
            quoteBlock
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .pantopusShadow(.sm)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("supportTrainRecipientCard")
    }

    private var header: some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            avatar

            VStack(alignment: .leading, spacing: 2) {
                Text(content.householdName)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)

                HStack(spacing: Spacing.s1) {
                    Icon(.mapPin, size: 11, color: Theme.Color.appTextSecondary)
                    Text(addressLine)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            identityChip
        }
    }

    private var avatar: some View {
        ZStack(alignment: .bottomTrailing) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: identityGradient,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 48, height: 48)
                .overlay(
                    Text(content.initials)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                )
            if content.verified {
                ZStack {
                    Circle().fill(verifiedDiscColor)
                    Icon(.check, size: 8, strokeWidth: 4, color: Theme.Color.appTextInverse)
                }
                .frame(width: 16, height: 16)
                .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                .offset(x: 2, y: 2)
            }
        }
        .accessibilityHidden(true)
    }

    private var identityChip: some View {
        HStack(spacing: Spacing.s1) {
            Icon(identityChipIcon, size: 10, strokeWidth: 2.5, color: identityChipForeground)
            Text(identityChipLabel)
                .font(.system(size: 9.5, weight: .bold))
                .textCase(.uppercase)
                .foregroundStyle(identityChipForeground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(identityChipBackground)
        .clipShape(Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(identityChipLabel)
    }

    private var quoteBlock: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.messageCircle, size: 13, color: Theme.Color.appTextMuted)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 2) {
                Text(content.quote)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
                if let attribution = content.quoteAttribution {
                    Text("— \(attribution)")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("supportTrainRecipientQuote")
    }

    private var addressLine: String {
        if let proximity = content.proximity, !proximity.isEmpty {
            return "\(content.address) · \(proximity)"
        }
        return content.address
    }

    private var identityGradient: [Color] {
        switch content.identityTag {
        case .home: [Theme.Color.successLight, Theme.Color.home]
        case .personal: [Theme.Color.primary200, Theme.Color.primary600]
        case .business: [Theme.Color.businessBg, Theme.Color.business]
        }
    }

    private var verifiedDiscColor: Color {
        switch content.identityTag {
        case .home: Theme.Color.home
        case .personal: Theme.Color.personal
        case .business: Theme.Color.business
        }
    }

    private var identityChipIcon: PantopusIcon {
        switch content.identityTag {
        case .home: .home
        case .personal: .user
        case .business: .briefcase
        }
    }

    private var identityChipLabel: String {
        switch content.identityTag {
        case .home: "Home"
        case .personal: "Personal"
        case .business: "Business"
        }
    }

    private var identityChipForeground: Color {
        switch content.identityTag {
        case .home: Theme.Color.homeDark
        case .personal: Theme.Color.primary700
        case .business: Theme.Color.businessDark
        }
    }

    private var identityChipBackground: Color {
        switch content.identityTag {
        case .home: Theme.Color.homeBg
        case .personal: Theme.Color.personalBg
        case .business: Theme.Color.businessBg
        }
    }
}

#Preview("Reyes household") {
    RecipientCard(
        content: RecipientCardContent(
            initials: "MR",
            householdName: "The Reyes household",
            identityTag: .home,
            verified: true,
            address: "418 Elm St",
            proximity: "2 blocks from you",
            quote: "Baby Mateo arrived Nov 18 — we're home and overwhelmed in the best way. " +
                "Soft foods, no peanuts, no fish. Thank you, Elm Park.",
            quoteAttribution: "Ana & Jordan"
        )
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
