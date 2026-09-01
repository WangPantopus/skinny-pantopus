//
//  StatusWaitingComponents.swift
//  Pantopus
//
//  Presentational sub-pieces of the A18 `StatusWaitingView`: the tone-aware
//  status pill (with an optional spinning glyph), the in-body action-stack
//  button, and the date-bearing timeline (dots + connecting line + pulsing
//  current step). Split out of `StatusWaitingView.swift` to keep each file
//  under SwiftLint's length budget.
//

import SwiftUI

// MARK: - Status pill (tone + optional spinning glyph)

struct StatusPillView: View {
    let pill: StatusWaitingPill

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var spin = false

    var body: some View {
        let palette = StatusPillPalette.forTone(pill.tone)
        HStack(spacing: 6) {
            if let icon = pill.icon {
                Icon(icon, size: 12, strokeWidth: 2.2, color: palette.fg)
                    .rotationEffect(.degrees(pill.isSpinning && spin ? 360 : 0))
                    .animation(
                        spinningEnabled ? .linear(duration: 4).repeatForever(autoreverses: false) : nil,
                        value: spin
                    )
            }
            Text(pill.text)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(palette.fg)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 6)
        .background(palette.bg)
        .overlay(Capsule().stroke(palette.border, lineWidth: 1))
        .clipShape(Capsule())
        .accessibilityIdentifier("statusPill")
        .onAppear { if spinningEnabled { spin = true } }
    }

    private var spinningEnabled: Bool {
        pill.isSpinning && !reduceMotion
    }
}

private struct StatusPillPalette {
    let bg: Color
    let fg: Color
    let border: Color

    static func forTone(_ tone: StatusPillTone) -> StatusPillPalette {
        switch tone {
        case .neutral:
            StatusPillPalette(
                bg: Theme.Color.appSurfaceMuted,
                fg: Theme.Color.appTextSecondary,
                border: Theme.Color.appBorder
            )
        case .success:
            StatusPillPalette(
                bg: Theme.Color.successBg,
                fg: Theme.Color.success,
                border: Theme.Color.success.opacity(0.25)
            )
        case .warning:
            StatusPillPalette(
                bg: Theme.Color.warningBg,
                fg: Theme.Color.warning,
                border: Theme.Color.warning.opacity(0.2)
            )
        case .primary:
            StatusPillPalette(
                bg: Theme.Color.primary50,
                fg: Theme.Color.primary700,
                border: Theme.Color.primary100
            )
        }
    }
}

// MARK: - In-body action stack button

struct StatusStackButton: View {
    let button: StatusActionButton
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) { label }
            .buttonStyle(.plain)
            .disabled(button.isDisabled)
            .accessibilityIdentifier("statusStackButton_\(button.id)")
    }

    @ViewBuilder
    private var label: some View {
        switch button.style {
        case .primary:
            content(textColor: Theme.Color.appTextInverse)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .shadow(color: Theme.Color.primary600.opacity(0.3), radius: 9, x: 0, y: 8)
        case .outline:
            content(textColor: button.isDisabled ? Theme.Color.appTextMuted : Theme.Color.appText)
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(button.isDisabled ? Theme.Color.appSurfaceSunken : Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(button.isDisabled ? Theme.Color.appBorder : Theme.Color.appBorderStrong, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        case .underline:
            Text(button.label)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.Color.primary600)
                .underline()
                .frame(maxWidth: .infinity)
                .frame(height: 36)
        }
    }

    private func content(textColor: Color) -> some View {
        HStack(spacing: 7) {
            if let icon = button.icon {
                Icon(icon, size: 14, strokeWidth: 2.2, color: textColor)
            }
            Text(button.label)
                .font(.system(size: button.style == .primary ? 14.5 : 14, weight: .bold))
                .foregroundStyle(textColor)
        }
    }
}

// MARK: - Timeline (dots + dates + connecting line)

struct StatusTimelineView: View {
    let stages: [StatusTimelineStage]
    let currentStageId: String?
    /// A18.4 — recolor the active node/segment to warning and swap the
    /// pulsing current dot for an `alert-circle` (review paused / action
    /// needed). Defaults to `false` so A18.2/A18.3 call sites are unchanged.
    var paused: Bool = false

    var body: some View {
        let states = resolvedStates
        let allDone = !states.isEmpty && states.allSatisfy { $0 == .done }
        let lastActive = states.lastIndex { $0 == .done || $0 == .current } ?? 0
        let filledSegments = allDone ? max(stages.count - 1, 0) : lastActive
        let activeColor = paused ? Theme.Color.warning : Theme.Color.primary600
        let lineColor = allDone ? Theme.Color.success : activeColor

        VStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s0) {
                ForEach(Array(stages.enumerated()), id: \.element.id) { index, _ in
                    TimelineDot(state: states[index], paused: paused)
                    if index != stages.count - 1 {
                        Rectangle()
                            .fill(index < filledSegments ? lineColor : Theme.Color.appBorder)
                            .frame(height: 2)
                    }
                }
            }
            HStack(spacing: Spacing.s0) {
                ForEach(Array(stages.enumerated()), id: \.element.id) { index, stage in
                    VStack(spacing: 2) {
                        Text(stage.label)
                            .font(.system(size: 11, weight: states[index] == .pending ? .medium : .bold))
                            .foregroundStyle(
                                states[index] == .pending ? Theme.Color.appTextSecondary : Theme.Color.appText
                            )
                            .multilineTextAlignment(textAlignment(for: index))
                        if let sub = stage.sub {
                            Text(sub)
                                .font(.system(size: 10))
                                .foregroundStyle(
                                    paused && states[index] == .current
                                        ? Theme.Color.warning
                                        : Theme.Color.appTextSecondary
                                )
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: alignment(for: index))
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    /// Per-stage state: explicit override, else derived from `currentStageId`.
    private var resolvedStates: [StatusStepState] {
        if stages.contains(where: { $0.state != nil }) {
            return stages.map { $0.state ?? .pending }
        }
        let currentIndex = stages.firstIndex { $0.id == currentStageId } ?? 0
        return stages.indices.map { index in
            if index < currentIndex { return .done }
            if index == currentIndex { return .current }
            return .pending
        }
    }

    private var accessibilityLabel: String {
        let states = resolvedStates
        let current = stages.indices.first { states[$0] == .current }
        if let current { return "Verification timeline. Current stage: \(stages[current].label)." }
        return "Verification timeline."
    }

    private func alignment(for index: Int) -> Alignment {
        if index == 0 { return .leading }
        if index == stages.count - 1 { return .trailing }
        return .center
    }

    private func textAlignment(for index: Int) -> TextAlignment {
        if index == 0 { return .leading }
        if index == stages.count - 1 { return .trailing }
        return .center
    }
}

private struct TimelineDot: View {
    let state: StatusStepState
    /// A18.4 — when paused, the current dot recolors to warning and shows a
    /// static `alert-circle` instead of the pulsing inner dot.
    var paused: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    var body: some View {
        ZStack {
            // Soft halo ring behind done / current dots.
            if state != .pending {
                Circle()
                    .fill(haloFill)
                    .frame(width: 38, height: 38)
            }
            Circle()
                .fill(fill)
                .frame(width: 30, height: 30)
                .overlay(
                    Circle().stroke(
                        state == .pending ? Theme.Color.appBorderStrong : Color.clear,
                        lineWidth: 1.5
                    )
                )
            switch state {
            case .done:
                Icon(.check, size: 14, strokeWidth: 3, color: Theme.Color.appTextInverse)
            case .current where paused:
                Icon(.alertCircle, size: 16, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
            case .current:
                Circle()
                    .fill(Theme.Color.appTextInverse)
                    .frame(width: 8, height: 8)
                    .scaleEffect(pulseEnabled && pulse ? 0.7 : 1)
                    .opacity(pulseEnabled && pulse ? 0.5 : 1)
                    .animation(
                        pulseEnabled ? .easeInOut(duration: 1.6).repeatForever(autoreverses: true) : nil,
                        value: pulse
                    )
            case .pending:
                EmptyView()
            }
        }
        .frame(width: 38, height: 38)
        .accessibilityHidden(true)
        .onAppear { if pulseEnabled { pulse = true } }
    }

    /// Paused current dots pulse no longer (the alert glyph is static).
    private var pulseEnabled: Bool {
        state == .current && !paused && !reduceMotion
    }

    private var haloFill: Color {
        switch state {
        case .done: Theme.Color.successBg
        case .current: paused ? Theme.Color.warningBg : Theme.Color.primary50
        case .pending: Theme.Color.appSurface
        }
    }

    private var fill: Color {
        switch state {
        case .done: Theme.Color.success
        case .current: paused ? Theme.Color.warning : Theme.Color.primary600
        case .pending: Theme.Color.appSurface
        }
    }
}
