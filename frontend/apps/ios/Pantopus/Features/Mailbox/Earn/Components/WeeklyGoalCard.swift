//
//  WeeklyGoalCard.swift
//  Pantopus
//
//  A10.11 — weekly-goal momentum card. Sits directly under the earnings
//  `BalanceHero` as a continuation of the balance story. Reuses the B1.5
//  `ProgressRing` (green goal arc) beside a "$X to go" headline +
//  progress subcopy. The design's in-hero teal→green goal bar is lifted
//  out into this dedicated card so the momentum reads as its own beat.
//

import SwiftUI

struct WeeklyGoalCard: View {
    let goal: EarnWeeklyGoal

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s4) {
            ProgressRing(
                progress: goal.progress,
                diameter: 64,
                lineWidth: 7,
                tint: Theme.Color.success,
                label: goal.ringLabel,
                sublabel: goal.ringSublabel,
                accessibilityLabel: "\(goal.ringLabel) \(goal.ringSublabel)"
            )
            VStack(alignment: .leading, spacing: 2) {
                Text("Weekly goal")
                    .font(.system(size: 10.5, weight: .bold))
                    .tracking(0.8)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(goal.headline)
                    .font(.system(size: 17, weight: .bold))
                    .tracking(-0.3)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
                Text(goal.subcopy)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous))
        .pantopusShadow(.sm)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Weekly goal. \(goal.headline). \(goal.subcopy)")
        .accessibilityIdentifier("earnWeeklyGoalCard")
    }
}

#Preview("WeeklyGoalCard") {
    Group {
        if let goal = EarnSampleData.populated.weeklyGoal {
            WeeklyGoalCard(goal: goal)
        }
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
