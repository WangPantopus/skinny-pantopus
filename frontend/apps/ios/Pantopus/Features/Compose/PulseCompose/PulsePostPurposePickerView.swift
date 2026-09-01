//
//  PulsePostPurposePickerView.swift
//  Pantopus
//
//  Step 2 — "What is this post for?" Two-column grid of purpose cards
//  (icon tile + label + one-line description) filtered by the selected
//  posting target.
//

import SwiftUI

public struct PulsePostPurposePickerView: View {
    private let target: PulsePostingTarget
    private let onSelect: @MainActor (PulseComposePurpose) -> Void
    private let onBack: @MainActor () -> Void

    private var purposes: [PulseComposePurpose] {
        PulseComposePurpose.allowed(for: target)
    }

    public init(
        target: PulsePostingTarget,
        onSelect: @escaping @MainActor (PulseComposePurpose) -> Void,
        onBack: @escaping @MainActor () -> Void
    ) {
        self.target = target
        self.onSelect = onSelect
        self.onBack = onBack
    }

    public var body: some View {
        FormShell(
            title: "New post",
            leading: .back,
            rightActionLabel: nil,
            isValid: false,
            isDirty: false,
            onClose: onBack,
            onCommit: {},
            content: {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        Text("What is this post for?")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(Theme.Color.appText)
                        Text("This helps neighbors find your post.")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }

                    if target.isPlaceTarget {
                        HStack(spacing: Spacing.s1) {
                            Icon(.mapPin, size: 13, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                            Text("Posting to \(target.displayLabel)")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        .padding(.horizontal, Spacing.s2)
                        .frame(minHeight: 26)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(Capsule())
                        .accessibilityIdentifier("pulsePurposeTargetBadge")
                    }

                    LazyVGrid(
                        columns: [GridItem(.flexible(), spacing: Spacing.s2), GridItem(.flexible(), spacing: Spacing.s2)],
                        spacing: Spacing.s2
                    ) {
                        ForEach(purposes) { purpose in
                            purposeCard(purpose)
                        }
                    }
                }
                .padding(.horizontal, Spacing.s4)
            }
        )
        .accessibilityIdentifier("pulsePostPurposePicker")
    }

    private func purposeCard(_ purpose: PulseComposePurpose) -> some View {
        let accent = purposeAccent(purpose)
        return Button { onSelect(purpose) } label: {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(purposeBackground(purpose))
                    .frame(width: 36, height: 36)
                    .overlay {
                        Icon(purposeIcon(purpose), size: 18, strokeWidth: 2, color: accent)
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(purpose.label)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                    Text(purposeDescription(purpose))
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2, reservesSpace: true)
                        .multilineTextAlignment(.leading)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s3)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
            )
            .contentShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(purpose.label). \(purposeDescription(purpose))")
        .accessibilityIdentifier("pulsePurpose-\(purpose.rawValue)")
    }

    private func purposeDescription(_ purpose: PulseComposePurpose) -> String {
        switch purpose {
        case .ask: "Get help or answers from neighbors"
        case .headsUp: "Warn people nearby about something"
        case .recommend: "Share a place or service you love"
        case .lostFound: "Reunite lost items and pets"
        case .localUpdate: "Share news from around the area"
        case .neighborhoodWin: "Celebrate something good nearby"
        case .visitorGuide: "Tips for people visiting the area"
        case .event: "Invite neighbors to something"
        case .deal: "Share a local discount or offer"
        }
    }

    private func purposeIcon(_ purpose: PulseComposePurpose) -> PantopusIcon {
        switch purpose {
        case .ask: .helpCircle
        case .headsUp: .megaphone
        case .recommend: .star
        case .lostFound: .search
        case .localUpdate: .fileText
        case .neighborhoodWin: .crown
        case .visitorGuide: .compass
        case .event: .calendar
        case .deal: .tag
        }
    }

    private func purposeAccent(_ purpose: PulseComposePurpose) -> Color {
        switch purpose {
        case .ask: Theme.Color.primary600
        case .headsUp: Theme.Color.error
        case .recommend: Theme.Color.warmAmber
        case .lostFound: Theme.Color.warning
        case .localUpdate: Theme.Color.primary700
        case .neighborhoodWin: Theme.Color.success
        case .visitorGuide: Theme.Color.home
        case .event: Theme.Color.primary600
        case .deal: Theme.Color.success
        }
    }

    private func purposeBackground(_ purpose: PulseComposePurpose) -> Color {
        switch purpose {
        case .ask: Theme.Color.primary50
        case .headsUp: Theme.Color.errorBg
        case .recommend: Theme.Color.warmAmberBg
        case .lostFound: Theme.Color.warningBg
        case .localUpdate: Theme.Color.primary50
        case .neighborhoodWin: Theme.Color.successBg
        case .visitorGuide: Theme.Color.homeBg
        case .event: Theme.Color.primary50
        case .deal: Theme.Color.successBg
        }
    }
}
