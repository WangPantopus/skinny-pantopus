//
//  StartTrainRecipientCard.swift
//  Pantopus
//
//  A12.11 — Verified-neighbor recipient card for step 1 of the
//  support-train wizard (Frame 1). Avatar + name + verified-neighbor
//  shield + a mutuals strip (micro-avatars + "2 mutuals: Marisa, Devon")
//  so the organizer can confirm they picked the right person, with a
//  trailing "Change" affordance back to search.
//
//  The type is `StartTrainRecipientCard` rather than `RecipientCard`
//  because the support-train *detail* feature already ships a public
//  `RecipientCard` (`Detail/Components/RecipientCard.swift`); Swift has no
//  module-local namespacing, so the start-train card is prefixed to avoid
//  the symbol clash.
//

import SwiftUI

/// Selected verified-neighbor card with a mutuals strip. Pairs with the
/// step's "RECIPIENT" overline.
struct StartTrainRecipientCard: View {
    let recipient: MailRecipientDTO
    let mutuals: [StartSupportTrainMutual]
    let onChange: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            avatar
            VStack(alignment: .leading, spacing: 3) {
                nameRow
                Text(metaLine)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
                if !mutuals.isEmpty {
                    mutualsStrip
                }
            }
            Spacer(minLength: Spacing.s2)
            changeButton
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("startSupportTrainSelectedBeneficiary")
    }

    private var avatar: some View {
        ZStack(alignment: .bottomTrailing) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Theme.Color.primary200, Theme.Color.primary600],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 48, height: 48)
                .overlay(
                    Text(initials)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                )
            ZStack {
                Circle().fill(Theme.Color.success)
                Icon(.shieldCheck, size: 9, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
            }
            .frame(width: 18, height: 18)
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
            .offset(x: 2, y: 2)
        }
        .accessibilityHidden(true)
    }

    private var nameRow: some View {
        HStack(spacing: 6) {
            Text(displayName)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
            HStack(spacing: 3) {
                Icon(.shieldCheck, size: 9, strokeWidth: 2.6, color: Theme.Color.success)
                Text("VERIFIED")
                    .font(.system(size: 9, weight: .bold))
                    .kerning(0.3)
                    .foregroundStyle(Theme.Color.success)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Theme.Color.successBg)
            .clipShape(Capsule())
            .accessibilityLabel("Verified neighbor")
        }
    }

    private var mutualsStrip: some View {
        HStack(spacing: Spacing.s1) {
            HStack(spacing: -6) {
                ForEach(mutuals.prefix(2)) { mutual in
                    Circle()
                        .fill(Theme.Color.personalBg)
                        .frame(width: 16, height: 16)
                        .overlay(
                            Text(mutual.initials.prefix(1))
                                .font(.system(size: 8, weight: .bold))
                                .foregroundStyle(Theme.Color.personal)
                        )
                        .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 1.5))
                }
            }
            Text(mutualsSummary)
                .font(.system(size: 10))
                .foregroundStyle(Theme.Color.appTextMuted)
                .lineLimit(1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(mutualsSummary)
    }

    private var changeButton: some View {
        Button(action: onChange) {
            Text("Change")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.primary600)
                .frame(minWidth: 44, minHeight: 44)
        }
        .accessibilityLabel("Change recipient")
        .accessibilityIdentifier("startSupportTrainChangeRecipient")
    }

    private var displayName: String {
        recipient.name ?? recipient.username ?? "Recipient"
    }

    private var metaLine: String {
        if let address = recipient.homeAddress, !address.isEmpty {
            return "Neighbor · \(address)"
        }
        return "Verified neighbor"
    }

    private var mutualsSummary: String {
        let names = mutuals.prefix(2).map(\.name).joined(separator: ", ")
        let noun = mutuals.count == 1 ? "mutual" : "mutuals"
        return "\(mutuals.count) \(noun): \(names)"
    }

    private var initials: String {
        let source = recipient.name ?? recipient.username ?? "Recipient"
        let pieces = source.split(separator: " ")
        let chars = pieces.prefix(2).compactMap(\.first)
        let letters = chars.map(String.init).joined()
        return letters.isEmpty ? "R" : letters.uppercased()
    }
}

#Preview {
    StartTrainRecipientCard(
        recipient: StartSupportTrainSampleData.verifiedNeighbor,
        mutuals: StartSupportTrainSampleData.mutuals
    ) {}
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
