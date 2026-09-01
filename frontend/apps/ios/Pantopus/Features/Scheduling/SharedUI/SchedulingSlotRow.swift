//
//  SchedulingSlotRow.swift
//  Pantopus
//
//  Foundation (I0b) — the single slot-row primitive reused 1:1 across the slot
//  picker, the 409 slot-taken sheet, host reschedule, and find-a-time. Mirrors
//  the Support Trains weekday/time-range row: full-width button, time leading,
//  optional detail, trailing chevron, pillar accent on selection. Tokens only.
//

import SwiftUI

/// A single tappable open-time row. Callers format `time` / `detail` from their
/// own slot model (`SlotDTO`, `SchedulingSlotAlternative`, …).
public struct SchedulingSlotRow: View {
    private let time: String
    private let detail: String?
    private let accent: Color
    private let isSelected: Bool
    private let isDisabled: Bool
    private let isSoonest: Bool
    private let action: () -> Void

    public init(
        time: String,
        detail: String? = nil,
        accent: Color = Theme.Color.primary600,
        isSelected: Bool = false,
        isDisabled: Bool = false,
        isSoonest: Bool = false,
        action: @escaping () -> Void
    ) {
        self.time = time
        self.detail = detail
        self.accent = accent
        self.isSelected = isSelected
        self.isDisabled = isDisabled
        self.isSoonest = isSoonest
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(.clock, size: 14, color: isSelected ? accent : Theme.Color.appTextSecondary)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Spacing.s1 + 1) {
                        Text(time)
                            .pantopusTextStyle(.small)
                            .fontWeight(.bold)
                            .monospacedDigit()
                            .foregroundStyle(isSelected ? accent : Theme.Color.appText)
                        if isSoonest {
                            soonestBadge
                        }
                    }
                    if let detail {
                        Text(detail)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s2)
                if isSelected {
                    Icon(.checkCircle, size: 18, color: accent)
                } else {
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .frame(minHeight: 44)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? accent.opacity(0.10) : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(isSelected ? accent : Theme.Color.appBorder, lineWidth: isSelected ? 1.5 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .opacity(isDisabled ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
    }

    /// The design's uppercase "Soonest" chip on the first alternative — the
    /// nearest open time. blue50 fill / blue100 hairline / blue700 ink
    /// (slot-taken-frames.jsx:133-135). Operational info-blue, not the pillar
    /// accent, so it reads identically across pillars.
    private var soonestBadge: some View {
        Text("Soonest")
            .font(.system(size: 8, weight: .bold))
            .textCase(.uppercase)
            .tracking(0.3)
            .foregroundStyle(Theme.Color.primary700)
            .padding(.horizontal, Spacing.s1)
            .padding(.vertical, 1)
            .background(Theme.Color.primary50)
            .overlay(Capsule().strokeBorder(Theme.Color.primary100, lineWidth: 1))
            .clipShape(Capsule())
    }

    private var accessibilityLabel: String {
        let base = detail.map { "\(time), \($0)" } ?? time
        return isSoonest ? "\(base), soonest" : base
    }
}

/// A shimmer placeholder the exact width of a real slot row, for the loading and
/// "checking live availability" states. Mirrors the design `SkelSlotRow`: a
/// leading icon square, a single time bar, then a trailing chevron square — so
/// the skeleton geometry matches a real `SchedulingSlotRow` 1:1.
public struct SchedulingSlotRowSkeleton: View {
    public init() {}

    public var body: some View {
        HStack(spacing: Spacing.s2 + 2) {
            Shimmer(width: 14, height: 14, cornerRadius: Radii.xs)
            Shimmer(width: 66, height: 13, cornerRadius: Radii.xs)
            Spacer(minLength: 0)
            Shimmer(width: 16, height: 16, cornerRadius: Radii.xs)
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

#if DEBUG
#Preview {
    VStack(spacing: Spacing.s2) {
        SchedulingSlotRow(time: "9:30 AM", detail: "30 min · 12:30 PM for Maria") {}
        SchedulingSlotRow(time: "10:00 AM", detail: "30 min", isSelected: true) {}
        SchedulingSlotRowSkeleton()
    }
    .padding()
    .background(Theme.Color.appBg)
}
#endif
