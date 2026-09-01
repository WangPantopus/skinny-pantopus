//
//  ReasonPicker.swift
//  Pantopus
//
//  A12.11 — Six-tile reason picker for step 1 of the support-train
//  wizard. Renders `StartSupportTrainReason.allCases` as a 3×2 grid:
//  everyday-help reasons on the first row (meal train · ride · errand)
//  and life moments on the second (surgery · baby · loss). The selected
//  tile fills with the warm-amber identity accent.
//

import SwiftUI

/// 3×2 grid of reason tiles. The selected tile is filled `warmAmberBg`
/// with a `warmAmber` border + icon chip, matching the wizard chrome.
struct ReasonPicker: View {
    let selected: StartSupportTrainReason
    let onSelect: (StartSupportTrainReason) -> Void

    private let columns = [
        GridItem(.flexible(), spacing: Spacing.s2),
        GridItem(.flexible(), spacing: Spacing.s2),
        GridItem(.flexible(), spacing: Spacing.s2)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("WHAT'S THE OCCASION?")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            LazyVGrid(columns: columns, spacing: Spacing.s2) {
                ForEach(StartSupportTrainReason.allCases) { reason in
                    tile(reason)
                }
            }
        }
    }

    private func tile(_ reason: StartSupportTrainReason) -> some View {
        let isSelected = reason == selected
        return Button {
            onSelect(reason)
        } label: {
            VStack(spacing: 6) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(isSelected ? Theme.Color.warmAmber : Theme.Color.appSurfaceSunken)
                    .frame(width: 32, height: 32)
                    .overlay(
                        Icon(
                            reason.icon,
                            size: 15,
                            strokeWidth: 2.2,
                            color: isSelected ? Theme.Color.appTextInverse : Theme.Color.appTextStrong
                        )
                    )
                Text(reason.title)
                    .font(.system(size: 12, weight: isSelected ? .bold : .semibold))
                    .foregroundStyle(isSelected ? Theme.Color.warmAmber : Theme.Color.appText)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s3)
            .padding(.horizontal, Spacing.s1)
            .frame(minHeight: 80)
            .background(isSelected ? Theme.Color.warmAmberBg : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Color.warmAmber : Theme.Color.appBorder,
                        lineWidth: isSelected ? 1.5 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(reason.title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityIdentifier("startSupportTrainReason_\(reason.rawValue)")
    }
}

#Preview {
    ReasonPicker(selected: .surgery) { _ in }
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
