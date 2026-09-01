//
//  PersonaCard.swift
//  Pantopus
//
//  Identity card for a persona (creator / business): an identity-pillar
//  tinted surface, an avatar with initials, the display name with a pillar
//  chip, a subtitle line, and an optional disclosure chevron. Used by the
//  fan-side Membership detail ("You support") and, later, Edit Persona.
//  Tap-through is opt-in via `onTap`.
//

import SwiftUI

/// Pillar-tinted persona identity card.
@MainActor
public struct PersonaCard: View {
    private let name: String
    private let initials: String
    private let subtitle: String
    private let pillar: IdentityPillar
    private let pillarLabel: String
    private let verified: Bool
    private let showsChevron: Bool
    private let identifier: String?
    private let onTap: (@MainActor () -> Void)?

    public init(
        name: String,
        initials: String,
        subtitle: String,
        pillar: IdentityPillar,
        pillarLabel: String,
        verified: Bool = false,
        showsChevron: Bool = true,
        identifier: String? = nil,
        onTap: (@MainActor () -> Void)? = nil
    ) {
        self.name = name
        self.initials = initials
        self.subtitle = subtitle
        self.pillar = pillar
        self.pillarLabel = pillarLabel
        self.verified = verified
        self.showsChevron = showsChevron
        self.identifier = identifier
        self.onTap = onTap
    }

    public var body: some View {
        Group {
            if let onTap {
                Button(action: onTap) { card }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(.isButton)
            } else {
                card
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .modifier(PersonaCardIdentifier(identifier: identifier))
    }

    private var card: some View {
        HStack(spacing: Spacing.s3) {
            avatar
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Text(name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    pillarChip
                }
                Text(subtitle)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s2)
            if showsChevron {
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(pillar.backgroundColor)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(pillar.color.opacity(0.18), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }

    private var avatar: some View {
        Circle()
            .fill(pillar.color)
            .frame(width: 44, height: 44)
            .overlay {
                Text(initials)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .overlay(alignment: .bottomTrailing) {
                if verified {
                    Circle()
                        .fill(pillar.color)
                        .frame(width: 15, height: 15)
                        .overlay {
                            Icon(.check, size: 8, strokeWidth: 4, color: Theme.Color.appTextInverse)
                        }
                        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                }
            }
            .accessibilityHidden(true)
    }

    private var pillarChip: some View {
        HStack(spacing: 3) {
            Icon(pillarIcon, size: 9, strokeWidth: 2.5, color: pillar.color)
            Text(pillarLabel.uppercased())
                .font(.system(size: 9.5, weight: .bold))
                .foregroundStyle(pillar.color)
                .kerning(0.4)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 1)
        .background(Theme.Color.appSurface)
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }

    private var pillarIcon: PantopusIcon {
        switch pillar {
        case .personal: .userRound
        case .home: .home
        case .business: .briefcase
        }
    }

    private var accessibilityText: String {
        let verifiedPart = verified ? ", verified" : ""
        return "\(name), \(pillarLabel)\(verifiedPart). \(subtitle)"
    }
}

/// Conditional `accessibilityIdentifier` so the combined card keeps a
/// single stable id for UI tests while leaving it unset when none is given.
private struct PersonaCardIdentifier: ViewModifier {
    let identifier: String?

    func body(content: Content) -> some View {
        if let identifier {
            content.accessibilityIdentifier(identifier)
        } else {
            content
        }
    }
}

#Preview("Pillars") {
    VStack(spacing: Spacing.s3) {
        PersonaCard(
            name: "Lara Chen",
            initials: "LC",
            subtitle: "Elm Park Eats · food critic · 1,240 members",
            pillar: .business,
            pillarLabel: "Business",
            verified: true
        )
        PersonaCard(
            name: "Maya Rivera",
            initials: "MR",
            subtitle: "@mayar · neighbourhood notes",
            pillar: .personal,
            pillarLabel: "Personal",
            showsChevron: false
        )
        PersonaCard(
            name: "412 Birch Ln",
            initials: "BL",
            subtitle: "Maplewood Ridge · 4 members",
            pillar: .home,
            pillarLabel: "Home"
        )
    }
    .padding()
    .background(Theme.Color.appBg)
}
