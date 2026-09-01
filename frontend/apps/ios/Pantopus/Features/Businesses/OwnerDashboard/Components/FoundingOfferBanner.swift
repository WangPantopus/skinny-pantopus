//
//  FoundingOfferBanner.swift
//  Pantopus
//
//  First-50 "Founding Business" offer banner on the owner dashboard.
//  Mirrors RN `src/app/businesses/[id]/index.tsx:194-228` — headline,
//  "<n> spots left — Claim yours!", a claim CTA, and a dismiss ✕ that
//  hides the banner for this business permanently.
//
//  Warning tokens throughout (the design's amber card); no hex literals.
//

import SwiftUI

@MainActor
struct FoundingOfferBanner: View {
    let offer: OwnerFoundingOffer
    let onClaim: @MainActor () -> Void
    let onDismiss: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.partyPopper, size: 16, strokeWidth: 2, color: Theme.Color.warning)
                Text("Founding Business Offer")
                    .font(.system(size: 15, weight: .bold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                Button(action: onDismiss) {
                    Icon(.x, size: 16, color: Theme.Color.appTextMuted)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Dismiss founding offer")
                .accessibilityIdentifier("businessOwner.foundingDismiss")
            }
            Text(spotsLabel)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)

            Button(action: onClaim) {
                HStack(spacing: Spacing.s2) {
                    if offer.isClaiming {
                        ProgressView()
                            .controlSize(.small)
                            .tint(Theme.Color.appTextInverse)
                    }
                    Text(offer.isClaiming ? "Claiming…" : "Claim Founding Slot")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s3)
                .background(Theme.Color.warning)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(offer.isClaiming)
            .padding(.top, Spacing.s2)
            .accessibilityIdentifier("businessOwner.foundingClaim")
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warning, lineWidth: 1)
        )
        .accessibilityIdentifier("businessOwner.foundingBanner")
    }

    private var spotsLabel: String {
        let noun = offer.slotsRemaining == 1 ? "spot" : "spots"
        return "\(offer.slotsRemaining) \(noun) left — Claim yours!"
    }
}
