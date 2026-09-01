//
//  StepRail.swift
//  Pantopus
//
//  A12.11 — Mini 5-segment preview of the support-train wizard, rendered
//  at the bottom of step 1's body so the organizer can see the whole flow
//  ahead (Recipient · Type · Dates · Invites · Review). Completed and
//  current nodes fill in the warm-amber identity accent.
//

import SwiftUI

/// Five-node progress preview for the support-train wizard. `current` is
/// 1-based (step 1 = `Recipient`).
struct StepRail: View {
    let current: Int

    private let steps: [(Int, String)] = [
        (1, "Recipient"),
        (2, "Type"),
        (3, "Dates"),
        (4, "Invites"),
        (5, "Review")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("YOU'RE ON STEP \(current) OF 5")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            HStack(alignment: .top, spacing: Spacing.s1) {
                ForEach(Array(steps.enumerated()), id: \.element.0) { index, step in
                    node(step)
                    if index < steps.count - 1 {
                        Rectangle()
                            .fill(step.0 < current ? Theme.Color.warmAmber : Theme.Color.appBorder)
                            .frame(height: 2)
                            .padding(.top, 10)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(current) of 5")
        .accessibilityIdentifier("startSupportTrainStepRail")
    }

    private func node(_ step: (Int, String)) -> some View {
        let isDone = step.0 < current
        let isCurrent = step.0 == current
        return VStack(spacing: Spacing.s1) {
            ZStack {
                Circle()
                    .fill(step.0 <= current ? Theme.Color.warmAmber : Theme.Color.appSurfaceSunken)
                    .frame(width: 22, height: 22)
                if isDone {
                    Icon(.check, size: 11, strokeWidth: 3, color: Theme.Color.appTextInverse)
                } else {
                    Text("\(step.0)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(isCurrent ? Theme.Color.appTextInverse : Theme.Color.appTextMuted)
                }
            }
            Text(step.1)
                .font(.system(size: 9, weight: isCurrent ? .bold : .medium))
                .foregroundStyle(isCurrent ? Theme.Color.warmAmber : Theme.Color.appTextMuted)
                .lineLimit(1)
        }
    }
}

#Preview {
    StepRail(current: 1)
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
