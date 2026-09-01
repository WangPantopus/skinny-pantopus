//
//  ProfileStrengthCard.swift
//  Pantopus
//
//  A10.7 — the owner's profile-strength card: a percentage + caption over a
//  completion bar and a "finish these" checklist (done steps strike through;
//  the pending step surfaces an inline "Add" that opens Edit Business Page).
//
//  This is the strength-meter idiom (a progress bar over a per-item list)
//  applied to page completeness; the shared `StrengthMeter` primitive is
//  password-specific (four rule segments), so the owner page-strength reads
//  as its own card while keeping the same visual grammar.
//
//  Design reference: `docs/designs/A10/business-owner-frames.jsx`
//  (ProfileStrength).
//

import SwiftUI

@MainActor
struct ProfileStrengthCard: View {
    let strength: OwnerProfileStrength
    /// Opens Edit Business Page focused on the pending step.
    let onAddStep: @MainActor (OwnerStrengthStep) -> Void

    private var fraction: Double {
        Double(strength.percent) / 100
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            header
                .padding(.bottom, 9)
            bar
                .padding(.bottom, 11)
            checklist
        }
        .padding(.horizontal, 14)
        .padding(.top, 13)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("businessOwner.profileStrength")
    }

    private var header: some View {
        HStack(alignment: .center, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Profile strength")
                    .font(.system(size: 13, weight: .bold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appText)
                Text(strength.caption)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Text("\(strength.percent)%")
                .font(.system(size: 18, weight: .heavy).monospacedDigit())
                .tracking(-0.4)
                .foregroundStyle(Theme.Color.success)
                .accessibilityLabel("\(strength.percent) percent complete")
        }
    }

    private var bar: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule(style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                Capsule(style: .continuous)
                    .fill(Theme.Color.success)
                    .frame(width: max(0, proxy.size.width * fraction))
            }
        }
        .frame(height: 7)
        .accessibilityHidden(true)
    }

    private var checklist: some View {
        VStack(alignment: .leading, spacing: 7) {
            ForEach(strength.steps) { step in
                stepRow(step)
            }
        }
    }

    private func stepRow(_ step: OwnerStrengthStep) -> some View {
        HStack(spacing: 9) {
            checkmark(done: step.done)
            Text(step.label)
                .font(.system(size: 12.5, weight: step.done ? .medium : .semibold))
                .strikethrough(step.done, color: Theme.Color.appTextSecondary)
                .foregroundStyle(step.done ? Theme.Color.appTextSecondary : Theme.Color.appText)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let cta = step.ctaLabel, !step.done {
                Button { onAddStep(step) } label: {
                    Text(cta)
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.business)
                        .padding(.horizontal, 11)
                        .padding(.vertical, Spacing.s1)
                        .background(
                            Theme.Color.businessBg,
                            in: RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(cta) \(step.label)")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(step.label), \(step.done ? "done" : "to do")")
    }

    private func checkmark(done: Bool) -> some View {
        ZStack {
            if done {
                Circle().fill(Theme.Color.successBg)
                Icon(.check, size: 11, strokeWidth: 3, color: Theme.Color.success)
            } else {
                Circle()
                    .strokeBorder(
                        Theme.Color.appBorder,
                        style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])
                    )
            }
        }
        .frame(width: 18, height: 18)
    }
}

#Preview("ProfileStrengthCard") {
    ProfileStrengthCard(
        strength: OwnerProfileStrength(
            percent: 92,
            caption: "One step from a complete page",
            steps: [
                OwnerStrengthStep(id: "basics", label: "Logo, banner & description", done: true),
                OwnerStrengthStep(id: "hours", label: "Hours & service area", done: true),
                OwnerStrengthStep(id: "photos", label: "Add 2 more work photos", done: false, ctaLabel: "Add")
            ]
        )
    ) { _ in }
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
