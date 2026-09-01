//
//  WizardStepViews.swift
//  Pantopus
//
//  Reusable wizard step pieces shared by A2 (First-Run) and A6 (Onboarding):
//  the numbered StepRail, headline/overline, the handle (slug) field with live
//  check states, the type picker, the weekly-hours grid, the timezone chip, and
//  the SuccessHero. Pillar-accented via the caller's accent/accentBg. Matches
//  `scheduling-setup-frames.jsx` / `onboarding-shell.jsx`.
//

// swiftlint:disable file_length
import SwiftUI

// MARK: - Slug field state

/// Live availability-check state for the handle field.
enum SlugFieldState: Equatable {
    case idle
    case checking
    case available
    case taken(suggestions: [String])
    /// Claim/check failed for a non-"taken" reason (offline, server error). Distinct from
    /// `.taken` so a network blip doesn't misreport the handle as unavailable.
    case error(message: String)
}

// MARK: - Overline + headline

struct WizardOverline: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10.5, weight: .semibold))
            .tracking(0.84)
            .foregroundStyle(Theme.Color.appTextSecondary)
    }
}

struct WizardHeadline: View {
    let title: String
    let sub: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 22, weight: .bold))
                .tracking(-0.3)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            Text(sub)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Step rail

struct WizardStepRail: View {
    /// (number, label) pairs, 1-based.
    let steps: [(Int, String)]
    let current: Int
    let accent: Color
    let accentBg: Color
    /// Success frames mark every disc done — the design passes `done` including
    /// the current step (`StepRail current={4} done={[1,2,3,4]}`), so the final
    /// disc renders the check glyph, not its numeral. Pass `true` on success.
    var allComplete: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            WizardOverline(text: "You're on step \(current) of \(steps.count)")
            HStack(spacing: Spacing.s1) {
                ForEach(Array(steps.enumerated()), id: \.element.0) { idx, step in
                    disc(step)
                    if idx < steps.count - 1 {
                        Rectangle()
                            .fill(step.0 < current ? accent : Theme.Color.appBorder)
                            .frame(height: 2)
                            .clipShape(Capsule())
                            .padding(.bottom, 14)
                    }
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .setupCard(radius: Radii.lg, shadow: .sm)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func disc(_ step: (Int, String)) -> some View {
        let isDone = allComplete || step.0 < current
        let active = step.0 == current
        let filled = isDone || active
        return VStack(spacing: Spacing.s1) {
            ZStack {
                Circle().fill(filled ? accent : Theme.Color.appSurfaceSunken)
                if isDone {
                    Icon(.check, size: 11, strokeWidth: 3, color: Theme.Color.appTextInverse)
                } else {
                    Text("\(step.0)").font(.system(size: 10.5, weight: .bold))
                        .foregroundStyle(filled ? Theme.Color.appTextInverse : Theme.Color.appTextMuted)
                }
            }
            .frame(width: 22, height: 22)
            .overlay(active ? Circle().stroke(accent, lineWidth: 2) : nil)
            .overlay(active ? Circle().stroke(accentBg, lineWidth: 2).frame(width: 26, height: 26) : nil)
            Text(step.1)
                .font(.system(size: 9.5, weight: active ? .bold : .medium))
                .foregroundStyle(active ? accent : (isDone ? Theme.Color.appTextStrong : Theme.Color.appTextMuted))
        }
    }
}

// MARK: - Handle field

struct WizardHandleField: View {
    @Binding var slug: String
    let state: SlugFieldState
    let accent: Color
    let accentBg: Color
    var overline: String = "Your link"
    var availableHint: String = "People will book you at this link."
    let onPick: (String) -> Void

    @FocusState private var focused: Bool

    private var isTaken: Bool {
        if case .taken = state { return true }
        return false
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            WizardOverline(text: overline)
            field.padding(.top, Spacing.s2)
            statusArea
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var field: some View {
        HStack(spacing: Spacing.s0) {
            Text("pantopus.com/book/").font(.system(size: 13, design: .monospaced)).foregroundStyle(Theme.Color.appTextSecondary)
            TextField("handle", text: $slug)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(Theme.Color.appText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focused)
                .accessibilityIdentifier("wizardHandleField")
            Spacer(minLength: Spacing.s2)
            Icon(isTaken ? .alertCircle : .pencil, size: 15, color: isTaken ? Theme.Color.error : Theme.Color.appTextMuted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(isTaken ? Theme.Color.errorLight : Theme.Color.appBorder, lineWidth: 1.5)
        )
        .onTapGesture { focused = true }
    }

    @ViewBuilder
    private var statusArea: some View {
        switch state {
        case .idle:
            EmptyView()
        case .checking:
            HStack(spacing: Spacing.s2) {
                Shimmer(width: 92, height: 22, cornerRadius: Radii.pill)
                Shimmer(width: 150, height: 11, cornerRadius: Radii.xs)
            }
            .padding(.top, 10)
        case .available:
            HStack(spacing: Spacing.s2) {
                HStack(spacing: 5) {
                    Icon(.check, size: 12, strokeWidth: 3, color: Theme.Color.success)
                    Text("Available")
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(Theme.Color.success)
                }
                .padding(.horizontal, 9)
                .padding(.vertical, Spacing.s1)
                .background(Theme.Color.successLight)
                .clipShape(Capsule())
                Text(availableHint)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .padding(.top, 10)
        case let .taken(suggestions):
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Icon(.alertCircle, size: 13, color: Theme.Color.error)
                    Text("That link is taken")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.error)
                }
                if !suggestions.isEmpty {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("Try one of these:")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        FlowChips(suggestions: suggestions, accent: accent, accentBg: accentBg, onPick: onPick)
                    }
                }
            }
            .padding(.top, 10)
        case let .error(message):
            HStack(spacing: 6) {
                Icon(.alertCircle, size: 13, color: Theme.Color.error)
                Text(message)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.error)
                    .lineLimit(2)
            }
            .padding(.top, 10)
        }
    }
}

/// Wrapping suggestion chips.
private struct FlowChips: View {
    let suggestions: [String]
    let accent: Color
    let accentBg: Color
    let onPick: (String) -> Void

    var body: some View {
        // Two-per-row layout keeps within phone width; designs show up to 3.
        let rows = stride(from: 0, to: suggestions.count, by: 2).map { Array(suggestions[$0..<min($0 + 2, suggestions.count)]) }
        VStack(alignment: .leading, spacing: Spacing.s2) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: Spacing.s2) {
                    ForEach(row, id: \.self) { s in chip(s) }
                    Spacer(minLength: Spacing.s0)
                }
            }
        }
    }

    private func chip(_ s: String) -> some View {
        Button { onPick(s) } label: {
            HStack(spacing: 6) {
                Text(s)
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Theme.Color.primary700)
                Icon(.arrowUpRight, size: 12, color: Theme.Color.primary700)
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 7)
            .background(accentBg)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Theme.Color.primary100, lineWidth: 1))
        }
        .accessibilityIdentifier("wizardSuggestion_\(s)")
    }
}

// MARK: - Type picker (location mode + duration)

struct WizardTypePicker: View {
    @Binding var locationMode: String
    @Binding var duration: Int
    let accent: Color
    let accentBg: Color

    // swiftlint:disable:next large_tuple
    private let locations: [(String, String, PantopusIcon)] = [
        ("video", "Video call", .video),
        ("phone", "Phone", .phone),
        ("in_person", "In person", .mapPin),
        ("ask", "Ask invitee", .clipboardList)
    ]
    private let durations = [15, 30, 45, 60]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                WizardOverline(text: "How you meet")
                VStack(spacing: Spacing.s2) {
                    ForEach(
                        stride(from: 0, to: locations.count, by: 2).map { Array(locations[$0..<min($0 + 2, locations.count)]) },
                        id: \.first!.0
                    ) { pair in
                        HStack(spacing: Spacing.s2) {
                            ForEach(pair, id: \.0) { loc in
                                locationTile(loc)
                            }
                        }
                    }
                }
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                WizardOverline(text: "Duration")
                HStack(spacing: Spacing.s2) {
                    ForEach(durations, id: \.self) { d in durationChip(d) }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // swiftlint:disable:next large_tuple
    private func locationTile(_ loc: (String, String, PantopusIcon)) -> some View {
        let active = locationMode == loc.0
        return Button { locationMode = loc.0 } label: {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(active ? accent : Theme.Color.appSurfaceSunken)
                    Icon(loc.2, size: 15, strokeWidth: 2.2, color: active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                }
                .frame(width: 30, height: 30)
                Text(loc.1)
                    .font(.system(size: 12.5, weight: active ? .bold : .semibold))
                    .foregroundStyle(active ? accent : Theme.Color.appText)
                    .lineLimit(1)
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 13)
            .background(active ? accentBg : Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(
                active ? accent : Theme.Color.appBorder,
                lineWidth: 1.5
            ))
        }
        .accessibilityIdentifier("wizardLocation_\(loc.0)")
    }

    private func durationChip(_ d: Int) -> some View {
        let active = duration == d
        return Button { duration = d } label: {
            Text("\(d) min")
                .font(.system(size: 12.5, weight: active ? .bold : .semibold))
                .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .frame(height: 38)
                .background(active ? accent : Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(
                    active ? accent : Theme.Color.appBorder,
                    lineWidth: 1
                ))
        }
        .accessibilityIdentifier("wizardDuration_\(d)")
    }
}

// MARK: - Timezone chip

struct WizardTimezoneChip: View {
    let identifier: String
    let accent: Color
    let accentBg: Color

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            WizardOverline(text: "Timezone")
            HStack(spacing: Spacing.s2) {
                Icon(.globe, size: 15, color: Theme.Color.primary700)
                Text(identifier)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary700)
                Text("AUTO")
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Theme.Color.primary600)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .background(Theme.Color.appSurface)
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Theme.Color.primary100, lineWidth: 1))
                Icon(.chevronDown, size: 14, color: Theme.Color.primary700)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 9)
            .background(Theme.Color.primary50)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Theme.Color.primary100, lineWidth: 1))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Weekly hours grid

struct WizardHoursGrid: View {
    @Binding var enabled: [Int: Bool]
    let accent: Color
    let rangeLabel: String

    private let weekdays: [(Int, String)] = [
        (1, "Monday"), (2, "Tuesday"), (3, "Wednesday"), (4, "Thursday"),
        (5, "Friday"), (6, "Saturday"), (0, "Sunday")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            WizardOverline(text: "Weekly hours")
            VStack(spacing: Spacing.s0) {
                ForEach(Array(weekdays.enumerated()), id: \.element.0) { idx, day in
                    row(day)
                    if idx < weekdays.count - 1 {
                        Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                    }
                }
            }
            .setupCard(radius: Radii.lg, shadow: .sm)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func row(_ day: (Int, String)) -> some View {
        let on = enabled[day.0] ?? false
        return HStack(spacing: Spacing.s3) {
            Button { enabled[day.0] = !on } label: { SetupMiniToggle(isOn: on, accent: accent) }
                .accessibilityIdentifier("wizardDay_\(day.0)")
                .accessibilityLabel(day.1)
            Text(day.1)
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(on ? Theme.Color.appText : Theme.Color.appTextMuted)
                .frame(
                    width: 78,
                    alignment: .leading
                )
            Spacer(minLength: Spacing.s2)
            if on {
                HStack(spacing: 7) {
                    Icon(.clock, size: 13, color: accent)
                    Text(rangeLabel)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .monospacedDigit()
                    Icon(.chevronRight, size: 13, color: Theme.Color.appTextMuted)
                }
                .padding(.horizontal, 11)
                .padding(.vertical, 7)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            } else {
                Text("Unavailable")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
    }
}

// MARK: - Success hero

struct WizardSuccessHero: View {
    let accent: Color
    let accentBg: Color
    let shadow: PantopusShadow
    let title: String
    let sub: String
    let link: String
    let onCopy: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ZStack {
                Circle().fill(
                    RadialGradient(colors: [accentBg, accentBg.opacity(0.5)], center: .init(x: 0.3, y: 0.3), startRadius: 0, endRadius: 96)
                )
                Circle()
                    .fill(accent)
                    .frame(width: 60, height: 60)
                    .pantopusShadow(shadow)
                Icon(.check, size: 32, strokeWidth: 3, color: Theme.Color.appTextInverse)
            }
            .frame(width: 96, height: 96)
            .padding(.bottom, 22)
            Text(title)
                .font(.system(size: 22, weight: .bold))
                .tracking(-0.3)
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.s2)
            Text(sub)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .frame(maxWidth: 280)
                .padding(.bottom, 22)

            HStack(spacing: 10) {
                Icon(.link, size: 16, color: accent)
                Text(link)
                    .font(.system(size: 12.5, design: .monospaced))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: onCopy) {
                    HStack(spacing: 5) {
                        Icon(.copy, size: 13, color: Theme.Color.primary700)
                        Text("Copy")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Theme.Color.primary700)
                    }
                    .padding(.horizontal, 11)
                    .padding(.vertical, 7)
                    .background(accentBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(accentBg, lineWidth: 1))
                }
                .accessibilityIdentifier("wizardSuccessCopy")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .setupCard(radius: Radii.lg)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s6)
        .padding(.top, Spacing.s6)
    }
}
