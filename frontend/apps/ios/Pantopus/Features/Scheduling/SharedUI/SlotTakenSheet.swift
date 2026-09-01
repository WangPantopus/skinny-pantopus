//
//  SlotTakenSheet.swift
//  Pantopus
//
//  Foundation (I0b) — the 409 conflict recovery sheet. The most important
//  scheduling error: it must NEVER dead-end. Presented locally on a
//  SLOT_TAKEN / SLOT_UNAVAILABLE / SLOT_FULL response, it leads with a calm
//  amber halo, re-renders the nearest open times (`SchedulingSlotAlternative`)
//  as live slot rows, and always offers "Pick another time". Entered details
//  are preserved by the caller. Tokens only.
//

import SwiftUI

/// Renders the 409 `alternatives` array as a recovery bottom sheet. Feature
/// streams present this via `.sheet` and apply `.presentationDetents`.
public struct SlotTakenSheet: View {
    /// Which recovery state to show.
    public enum Mode: Equatable, Sendable {
        /// Nearest open times available (use `alternatives`).
        case alternatives
        /// No alternatives — offer the waitlist.
        case fullyBooked
        /// Re-fetching live availability (shimmer rows).
        case refreshing
    }

    private let mode: Mode
    private let alternatives: [SchedulingSlotAlternative]
    private let takenTimeLabel: String?
    private let timeZoneIdentifier: String
    private let accent: Color
    private let onSelect: (SchedulingSlotAlternative) -> Void
    private let onPickAnotherTime: () -> Void
    private let onJoinWaitlist: (() -> Void)?
    private let onSeeAnotherDay: (() -> Void)?

    public init(
        mode: Mode = .alternatives,
        alternatives: [SchedulingSlotAlternative],
        takenTimeLabel: String? = nil,
        timeZoneIdentifier: String,
        accent: Color = Theme.Color.primary600,
        onSelect: @escaping (SchedulingSlotAlternative) -> Void,
        onPickAnotherTime: @escaping () -> Void,
        onJoinWaitlist: (() -> Void)? = nil,
        onSeeAnotherDay: (() -> Void)? = nil
    ) {
        self.mode = mode
        self.alternatives = alternatives
        self.takenTimeLabel = takenTimeLabel
        self.timeZoneIdentifier = timeZoneIdentifier
        self.accent = accent
        self.onSelect = onSelect
        self.onPickAnotherTime = onPickAnotherTime
        self.onJoinWaitlist = onJoinWaitlist
        self.onSeeAnotherDay = onSeeAnotherDay
    }

    public var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                errorBlock
                content
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s3)
            .frame(maxWidth: .infinity)
            savedNote
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("scheduling.slotTakenSheet")
    }

    // MARK: - Header (A18 error halo — centered)

    private var errorBlock: some View {
        VStack(spacing: Spacing.s3 - 1) {
            ZStack {
                // Outer soft halo.
                Circle().fill(Theme.Color.warningBg).opacity(0.6).frame(width: 64, height: 64)
                // Inner ringed disc.
                Circle()
                    .fill(Theme.Color.warningBg)
                    .frame(width: 50, height: 50)
                    .overlay(Circle().strokeBorder(Theme.Color.warningLight, lineWidth: 2))
                Icon(.calendarX, size: 24, strokeWidth: 2, color: Theme.Color.warning)
            }
            VStack(spacing: Spacing.s1 + 2) {
                Text("That time was just taken")
                    .pantopusTextStyle(.h3)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.center)
                Text(subtitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 228)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s1 + 2)
    }

    private var subtitle: String {
        switch mode {
        case .alternatives:
            if let takenTimeLabel {
                return "Someone grabbed \(takenTimeLabel) first. Here are the closest open times — no problem, these are still open."
            }
            return "Here are the closest open times — no problem, these are still open."
        case .fullyBooked:
            return "And the rest of this day just filled up too."
        case .refreshing:
            return "Checking which times are still open right now."
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch mode {
        case .alternatives:
            VStack(spacing: Spacing.s4) {
                VStack(spacing: Spacing.s2) {
                    // The first (nearest) alternative always carries the
                    // "Soonest" badge — slot-taken-frames.jsx:133-135.
                    ForEach(Array(alternatives.enumerated()), id: \.element) { index, alt in
                        SchedulingSlotRow(
                            time: timeLabel(for: alt),
                            detail: dayLabel(for: alt),
                            accent: accent,
                            isSoonest: index == 0
                        ) {
                            onSelect(alt)
                        }
                    }
                }
                ghostButton(icon: .search, title: "Pick another time", action: onPickAnotherTime)
            }
        case .fullyBooked:
            VStack(spacing: Spacing.s4) {
                emptyFullyBooked
                VStack(spacing: Spacing.s2 + 1) {
                    if let onJoinWaitlist {
                        primaryButton(icon: .bellPlus, title: "Join the waitlist", action: onJoinWaitlist)
                    }
                    ghostButton(icon: .search, title: "See another day", action: onSeeAnotherDay ?? onPickAnotherTime)
                }
            }
        case .refreshing:
            VStack(spacing: Spacing.s4) {
                VStack(spacing: Spacing.s2) {
                    ForEach(0..<3, id: \.self) { _ in SchedulingSlotRowSkeleton() }
                }
                .accessibilityLabel("Checking live availability")
                liveCheckIndicator
                ghostButton(icon: .search, title: "Pick another time", action: onPickAnotherTime)
            }
        }
    }

    /// "Checking live availability" pulse row beneath the skeleton rows.
    private var liveCheckIndicator: some View {
        HStack(spacing: Spacing.s2 - 1) {
            Circle()
                .fill(accent)
                .frame(width: 7, height: 7)
            Text("Checking live availability")
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var emptyFullyBooked: some View {
        VStack(spacing: Spacing.s2 + 1) {
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 48, height: 48)
                Icon(.calendarX, size: 22, strokeWidth: 1.9, color: Theme.Color.appTextSecondary)
            }
            Text("This day is fully booked")
                .pantopusTextStyle(.small)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.appText)
            Text("Join the waitlist and we'll text you the moment a time opens up.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 208)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s5 + 2)
        .padding(.horizontal, Spacing.s4)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg + 2, style: .continuous)
                .strokeBorder(
                    Theme.Color.appBorderStrong,
                    style: StrokeStyle(lineWidth: 1, dash: [4, 4])
                )
        )
    }

    // MARK: - Footer

    /// Sticky "Your details are saved." footer with a success shield-check.
    private var savedNote: some View {
        HStack(spacing: Spacing.s2 - 2) {
            Icon(.shieldCheck, size: 13, color: Theme.Color.success)
            Text("Your details are saved.")
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s2 + 2)
        .padding(.bottom, Spacing.s4 + 2)
        .padding(.horizontal, Spacing.s4)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
    }

    // MARK: - Icon-leading buttons (design ghost/primary carry a leading glyph)

    private func ghostButton(icon: PantopusIcon, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2 - 1) {
                Icon(icon, size: 15, strokeWidth: 2.1, color: Theme.Color.appText)
                Text(title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appText)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(.sm)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
    }

    private func primaryButton(icon: PantopusIcon, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2 - 1) {
                Icon(icon, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                Text(title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(accent)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(.primary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Formatting

    private func timeLabel(for alt: SchedulingSlotAlternative) -> String {
        SchedulingTime.localString(
            utcISO: alt.start, tz: timeZoneIdentifier, dateStyle: .none, timeStyle: .short
        ) ?? alt.startLocal ?? alt.start
    }

    private func dayLabel(for alt: SchedulingSlotAlternative) -> String? {
        SchedulingTime.localString(
            utcISO: alt.start, tz: timeZoneIdentifier, dateStyle: .medium, timeStyle: .none
        )
    }
}

#if DEBUG
#Preview("Alternatives") {
    SlotTakenSheet(
        mode: .alternatives,
        alternatives: [
            SchedulingSlotAlternative(start: "2026-07-01T16:00:00Z", end: "2026-07-01T16:30:00Z", startLocal: nil),
            SchedulingSlotAlternative(start: "2026-07-01T17:00:00Z", end: "2026-07-01T17:30:00Z", startLocal: nil)
        ],
        takenTimeLabel: "2:00 PM",
        timeZoneIdentifier: "America/New_York",
        onSelect: { _ in },
        onPickAnotherTime: {}
    )
}

#Preview("Fully booked") {
    SlotTakenSheet(
        mode: .fullyBooked,
        alternatives: [],
        timeZoneIdentifier: "America/New_York",
        onSelect: { _ in },
        onPickAnotherTime: {},
        onJoinWaitlist: {}
    )
}
#endif
