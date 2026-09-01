//
//  EmptyBlock.swift
//  Pantopus
//
//  A10.6 — dashed, centered empty-section card for the Business Profile.
//  Backs every unfilled section on the newly-claimed + closed secondary
//  frame (About / Hours / Service area / Recent work / Reviews), with an
//  optional CTA ("Hire to review").
//
//  Design reference: `docs/designs/A10/business-frames.jsx` (EmptyBlock).
//  Identity-tinted (business violet) per A10.6 acceptance.
//

import SwiftUI

@MainActor
struct EmptyBlock: View {
    struct CTA {
        let label: String
        let icon: PantopusIcon
        let action: @MainActor () -> Void
    }

    let icon: PantopusIcon
    let title: String
    let message: String
    var cta: CTA?

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ZStack {
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .fill(Theme.Color.businessBg)
                    .frame(width: 44, height: 44)
                Icon(icon, size: 21, strokeWidth: 1.8, color: Theme.Color.business)
            }
            .padding(.bottom, 9)

            Text(title)
                .font(.system(size: 14, weight: .bold))
                .tracking(-0.2)
                .foregroundStyle(Theme.Color.appText)
                .padding(.bottom, 3)

            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .frame(maxWidth: 248)
                .fixedSize(horizontal: false, vertical: true)

            if let cta {
                Button { cta.action() } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(cta.icon, size: 13, color: Theme.Color.appText)
                        Text(cta.label)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                    }
                    .padding(.horizontal, 13)
                    .padding(.vertical, 7)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.top, 11)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 18)
        .padding(.vertical, 20)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(message)")
    }
}

#Preview("EmptyBlock") {
    VStack(spacing: Spacing.s4) {
        EmptyBlock(
            icon: .image,
            title: "No photos yet",
            message: "Work photos appear here after the first visits."
        )
        EmptyBlock(
            icon: .messageSquarePlus,
            title: "No reviews yet",
            message: "Be the first to hire Tide Pool. Your review helps the next neighbor decide.",
            cta: EmptyBlock.CTA(label: "Hire to review", icon: .pencil) {}
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
