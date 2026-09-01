//
//  SuccessHeroBlock.swift
//  Pantopus
//
//  Wizard content block — large success hero shown on the terminal step.
//  Centered green check + headline + subcopy. Wizards render their own
//  CTAs via the shell's primary + secondary slots; this block is content
//  only.
//

import SwiftUI

/// Hero block for a wizard's success step.
public struct SuccessHeroBlock: View {
    private let headline: String
    private let subcopy: String

    public init(headline: String, subcopy: String) {
        self.headline = headline
        self.subcopy = subcopy
    }

    public var body: some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle()
                    .fill(Theme.Color.successBg)
                    .frame(width: 96, height: 96)
                Icon(.checkCircle, size: 48, color: Theme.Color.success)
            }
            .accessibilityHidden(true)
            Text(headline)
                .pantopusTextStyle(.h2)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            Text(subcopy)
                .pantopusTextStyle(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s8)
        .accessibilityIdentifier("wizardSuccessHero")
    }
}
