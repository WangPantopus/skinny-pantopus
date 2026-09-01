//
//  ViewToggle.swift
//  Pantopus
//
//  A17.13 — the Translated · Original · Side by side segmented control.
//  The active segment lifts onto a white pill in the translation accent;
//  selecting a segment swaps the body the screen renders.
//

import SwiftUI

struct TranslationViewToggle: View {
    let active: TranslationViewMode
    let onSelect: (TranslationViewMode) -> Void

    private let segmentHeight: CGFloat = 36

    private struct Option {
        let mode: TranslationViewMode
        let label: String
        let icon: PantopusIcon
    }

    private static let options: [Option] = [
        Option(mode: .translated, label: "Translated", icon: .globe),
        Option(mode: .original, label: "Original", icon: .fileText),
        Option(mode: .side, label: "Side by side", icon: .gripVertical)
    ]

    var body: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(Self.options, id: \.mode) { option in
                segment(option)
            }
        }
        .padding(Spacing.s1)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("translation_viewToggle")
    }

    @ViewBuilder
    private func segment(_ option: Option) -> some View {
        let isOn = option.mode == active
        Button {
            onSelect(option.mode)
        } label: {
            HStack(spacing: Spacing.s1) {
                Icon(option.icon, size: 14, color: isOn ? Theme.Color.categoryTranslation : Theme.Color.appTextSecondary)
                Text(option.label)
                    .font(.system(size: 12, weight: isOn ? .bold : .semibold))
                    .foregroundStyle(isOn ? Theme.Color.categoryTranslation : Theme.Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .frame(height: segmentHeight)
            .background(segmentBackground(isOn: isOn))
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.label)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("translation_viewToggle_\(option.mode.rawValue)")
    }

    @ViewBuilder
    private func segmentBackground(isOn: Bool) -> some View {
        if isOn {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.appSurface)
                .pantopusShadow(.sm)
        } else {
            Color.clear
        }
    }
}

#if DEBUG
#Preview("View toggle") {
    VStack(spacing: Spacing.s4) {
        TranslationViewToggle(active: .side) { _ in }
        TranslationViewToggle(active: .translated) { _ in }
        TranslationViewToggle(active: .original) { _ in }
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
#endif
