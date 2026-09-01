//
//  WeeklyHoursComponents.swift
//  Pantopus
//
//  Stream I3 — B5 weekly-hours editor subviews: the per-weekday on/off +
//  time-range rows (real labelled time buttons, VoiceOver-ready), the
//  no-hours warning card, and the link-out rows. Tokens only.
//

import SwiftUI

// ─── Per-day checkbox copy popover ────────────────────────────────────────────
//
// Mirrors JSX CopyMenu (weekly-hours-frames.jsx:97-134): a 192pt floating
// card with a header ("Copy to other days" + sourceDay subtitle), a scrollable
// list of the 6 other weekdays each with an independent checkbox, and a "Copy
// to N days" confirm button. Displayed as an overlay anchored to the copy icon
// button, positioned above or below depending on available space.

private struct DayCopyPopover: View {
    let sourceDay: Int // weekday index of the row being copied
    @Binding var checkedDays: Set<Int> // independent per-day toggles
    let onCopy: ([Int]) -> Void
    let onDismiss: () -> Void

    private var targets: [Int] {
        Weekday.displayOrder.filter { $0 != sourceDay }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 2) {
                Text("Copy to other days")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("\(Weekday.longName(sourceDay))'s hours")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .overlay(alignment: .bottom) {
                Divider()
            }

            // Per-day checkbox list
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    ForEach(targets, id: \.self) { weekday in
                        let isChecked = checkedDays.contains(weekday)
                        Button {
                            if isChecked {
                                checkedDays.remove(weekday)
                            } else {
                                checkedDays.insert(weekday)
                            }
                        } label: {
                            HStack(spacing: Spacing.s2) {
                                // 17×17 checkbox tile
                                ZStack {
                                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                                        .fill(isChecked ? Theme.Color.primary600 : Theme.Color.appSurface)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                                .stroke(
                                                    isChecked ? Theme.Color.primary600 : Theme.Color.appBorderStrong,
                                                    lineWidth: 1.5
                                                )
                                        )
                                    if isChecked {
                                        Icon(.check, size: 11, strokeWidth: 3, color: .white)
                                    }
                                }
                                .frame(width: 17, height: 17)

                                Text(Weekday.longName(weekday))
                                    .font(.system(size: 12.5, weight: .medium))
                                    .foregroundStyle(Theme.Color.appText)
                            }
                            .padding(.horizontal, Spacing.s3)
                            .padding(.vertical, 7)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(Weekday.longName(weekday)), \(isChecked ? "checked" : "unchecked")")
                    }
                }
            }
            .frame(maxHeight: 168)

            // Confirm button
            Divider()
            Button {
                onCopy(Array(checkedDays).sorted())
                onDismiss()
            } label: {
                Text("Copy to \(checkedDays.count) day\(checkedDays.count == 1 ? "" : "s")")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 34)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(checkedDays.isEmpty)
            .padding(Spacing.s2)
        }
        .frame(width: 192)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.18), radius: 15, x: 0, y: 8)
        .shadow(color: Color.black.opacity(0.06), radius: 3, x: 0, y: 1)
    }
}

// MARK: - WeekdayHoursRow

/// A single weekday: leading on/off toggle, then (when on) its time ranges
/// (each a labeled time-range button), an "Add a block" affordance, and a
/// per-day checkbox "Copy to other days" popover.
struct WeekdayHoursRow: View {
    let day: DayHours
    var disabled: Bool = false
    let onToggle: (Bool) -> Void
    let onAddRange: () -> Void
    let onCopy: ([Int]) -> Void
    let onEditRange: (TimeRange) -> Void
    let onRemoveRange: (UUID) -> Void

    /// Whether the per-day checkbox popover is visible.
    @State private var showCopyPopover = false
    /// Independent day-checkbox state: defaults to weekdays other than source.
    @State private var copyChecked: Set<Int> = []

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s3) {
                // Design weekly-hours-frames.jsx DayRow:146-147 puts the switch FIRST and the
                // day label after it. A labelled SwiftUI Toggle renders the inverse (label
                // leading, switch trailing), so the control order is built explicitly here.
                // `labelsHidden()` drops the VoiceOver name, hence the explicit label.
                Toggle("", isOn: Binding(get: { day.isEnabled }, set: onToggle))
                    .labelsHidden()
                    .toggleStyle(.switch)
                    .tint(Theme.Color.primary600)
                    .disabled(disabled)
                    .accessibilityLabel(Weekday.longName(day.weekday))
                    .accessibilityIdentifier("scheduling.weeklyHours.toggle.\(day.weekday)")

                Text(Weekday.longName(day.weekday))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(day.isEnabled ? Theme.Color.appText : Theme.Color.appTextSecondary)
                    .accessibilityHidden(true)

                Spacer(minLength: Spacing.s2)

                if day.isEnabled {
                    copyIconButton
                } else {
                    Text("Unavailable")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }

            if day.isEnabled {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    ForEach(day.ranges) { range in
                        AvailabilityTimeRangeButton(
                            label: range.display,
                            isValid: range.isValid,
                            disabled: disabled,
                            onTap: { onEditRange(range) },
                            onRemove: day.ranges.count > 1 ? { onRemoveRange(range.id) } : nil
                        )
                        if !range.isValid {
                            Text("End must be after start")
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.error)
                        }
                    }
                    if !disabled {
                        addBlockButton
                    }
                }
                .padding(.leading, Spacing.s12)
            }
        }
        .padding(.vertical, Spacing.s1)
        .opacity(disabled ? 0.7 : 1)
    }

    /// Icon button that opens the per-day checkbox copy popover (JSX `copy` glyph).
    /// Uses SwiftUI `.popover` for placement; falls back gracefully on iPhone
    /// (`.popover` presents as a sheet on compact width, which is acceptable —
    /// the checkbox list and confirm button remain intact).
    private var copyIconButton: some View {
        Button {
            // Seed weekdays (excluding source) as default selection, matching
            // JSX `checked` default (Mon-Fri minus the source day).
            let weekdaySet = Set([1, 2, 3, 4, 5])
            copyChecked = weekdaySet.subtracting([day.weekday])
            showCopyPopover = true
        } label: {
            Icon(.copy, size: 15, color: Theme.Color.appTextMuted)
                .frame(width: 30, height: 30)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityLabel("Copy \(Weekday.longName(day.weekday)) hours to other days")
        .popover(isPresented: $showCopyPopover, arrowEdge: .top) {
            DayCopyPopover(
                sourceDay: day.weekday,
                checkedDays: $copyChecked,
                onCopy: { targets in onCopy(targets) },
                onDismiss: { showCopyPopover = false }
            )
            .presentationCompactAdaptation(.popover)
        }
    }

    private var addBlockButton: some View {
        Button(action: onAddRange) {
            HStack(spacing: Spacing.s1) {
                Icon(.plus, size: 13, strokeWidth: 2.4, color: Theme.Color.primary600)
                Text("Add a block")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add a time block to \(Weekday.longName(day.weekday))")
    }
}

/// Sky-tinted "Use 9–5, Mon–Fri" quick-default button shared by the warning
/// card and the empty hero (JSX `QuickDefaultButton`).
struct QuickDefaultButton: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s2) {
                Icon(.wandSparkles, size: 15, color: Theme.Color.primary700)
                Text("Use 9–5, Mon–Fri")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 42)
            .background(Theme.Color.primary50)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.primary200, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Use 9 to 5, Monday to Friday")
    }
}

/// Inline amber warning shown when every weekday is off (JSX `WarningCard`).
struct NoHoursWarningCard: View {
    let onUseDefault: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.alertTriangle, size: 17, color: Theme.Color.warning)
                VStack(alignment: .leading, spacing: 2) {
                    // Design `WarningCard` (weekly-hours-frames.jsx:209-210):
                    // amber-800 title over an amber-900 body — the amber-600
                    // `warning` stays on the triangle glyph.
                    Text("No hours set")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.warningStrong)
                    Text("People can't book you until you add at least one block.")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.warningDeep)
                }
            }
            QuickDefaultButton(onTap: onUseDefault)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .padding(.horizontal, Spacing.s3)
        .accessibilityIdentifier("scheduling.weeklyHours.noHoursWarning")
    }
}

/// Sky-tinted explainer card shown when the schedule is unset — these hours
/// are the source the home & business pages compose on (JSX `CompositionGapCard`).
struct CompositionGapCard: View {
    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            Icon(.layers, size: 16, color: Theme.Color.primary700)
                .frame(width: 32, height: 32)
                .background(Theme.Color.primary100)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text("Start with your hours")
                    .pantopusTextStyle(.body)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text("Your family and business pages build on these hours, so set them first.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .padding(.horizontal, Spacing.s3)
        .accessibilityIdentifier("scheduling.weeklyHours.compositionGap")
    }
}

/// Empty / unset hero shown when the schedule has no hours set and the user
/// has not yet seeded a default. Mirrors the design's `EmptyHero` inside a
/// bordered `Card` (54pt icon tile + headline + body + quick-default button).
struct WeeklyHoursEmptyHero: View {
    let onUseDefault: () -> Void

    var body: some View {
        AvailabilityCard {
            VStack(spacing: Spacing.s3) {
                Icon(.calendarClock, size: 26, strokeWidth: 1.9, color: Theme.Color.primary600)
                    .frame(width: 54, height: 54)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                Text("Set your hours")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Tell people the days and times you're open to bookings. You can fine-tune any day after.")
                    .font(.system(size: 12.5))
                    .lineSpacing(3)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: 226)
                QuickDefaultButton(onTap: onUseDefault)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s1)
        }
        .accessibilityIdentifier("scheduling.weeklyHours.emptyHero")
    }
}

/// A time-range editor sheet with two wheel pickers (start / end). Presented
/// when a `AvailabilityTimeRangeButton` is tapped, mirroring the design's
/// "tap a labeled button to open a picker" idiom.
struct TimeRangePickerSheet: View {
    let title: String
    @State private var start: Date
    @State private var end: Date
    let onCommit: (TimeOfDay, TimeOfDay) -> Void
    @Environment(\.dismiss) private var dismiss

    init(
        range: TimeRange,
        onCommit: @escaping (TimeOfDay, TimeOfDay) -> Void
    ) {
        title = "Edit time range"
        _start = State(initialValue: range.start.referenceDate())
        _end = State(initialValue: range.end.referenceDate())
        self.onCommit = onCommit
    }

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.top, Spacing.s4)
            HStack(spacing: Spacing.s2) {
                VStack(spacing: Spacing.s1) {
                    AvailabilityFieldLabel(text: "Starts")
                    DatePicker("Start time", selection: $start, displayedComponents: .hourAndMinute)
                        .labelsHidden()
                        .datePickerStyle(.wheel)
                        .accessibilityLabel("Start time")
                }
                VStack(spacing: Spacing.s1) {
                    AvailabilityFieldLabel(text: "Ends")
                    DatePicker("End time", selection: $end, displayedComponents: .hourAndMinute)
                        .labelsHidden()
                        .datePickerStyle(.wheel)
                        .accessibilityLabel("End time")
                }
            }
            PrimaryButton(title: "Done") {
                onCommit(TimeOfDay(from: start), TimeOfDay(from: end))
                await MainActor.run { dismiss() }
            }
            .padding(.horizontal, Spacing.s4)
            Spacer(minLength: 0)
        }
        .background(Theme.Color.appBg)
        .presentationDetents([.height(360)])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("scheduling.weeklyHours.timeRangeSheet")
    }
}

/// A chevron link-out row inside the editor (date overrides / booking limits /
/// block off time).
struct SchedulingLinkRow: View {
    let icon: PantopusIcon
    let title: String
    let subtitle: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 15, color: Theme.Color.appTextSecondary)
                    .frame(width: 30, height: 30)
                    .background(Theme.Color.appSurfaceSunken)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    if let subtitle {
                        Text(subtitle)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s2)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
