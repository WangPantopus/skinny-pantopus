//
//  AIEstimateCard.swift
//  Pantopus
//
//  A15.3 — the inline "this would cost about $X" card rendered inside an
//  AI reply bubble. Magic-violet tinted.
//

import SwiftUI

/// Inline estimate card: a headline amount + basis on the left, a hairline
/// separator, and a confidence readout on the right.
public struct AIEstimateCard: View {
    private let estimate: ChatEstimate

    public init(estimate: ChatEstimate) {
        self.estimate = estimate
    }

    public var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(estimate.amount)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.magic)
                Text(estimate.basis)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Rectangle()
                .fill(Theme.Color.magicBorder)
                .frame(width: 1, height: 28)
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text("Confidence")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(estimate.confidence)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.magicBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.magicBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Estimate \(estimate.amount), \(estimate.basis), confidence \(estimate.confidence)")
    }
}

#Preview {
    AIEstimateCard(estimate: ChatEstimate(amount: "$55–70", basis: "based on 8 nearby jobs", confidence: "Medium–High"))
        .padding()
        .background(Theme.Color.appSurfaceSunken)
}
