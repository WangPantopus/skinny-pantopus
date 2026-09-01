//
//  AvailabilitySheetComponents.swift
//  Pantopus
//
//  Bespoke design primitives for the Calendarly Availability surfaces
//  (weekly hours editor, booking limits, block off time). These mirror the
//  `event-editor-shell.jsx` primitives the design reuses across the four
//  availability frames: the Personal identity pill, bordered white cards
//  (1px border, 16pt radius), labeled field/time-range buttons (icon +
//  tabular value + chevron-down), the bordered numeric stepper, and the
//  private-hold lock footnote. Tokens only.
//
//  These replace the generic FormFieldGroup (overline-over-borderless-card)
//  and native SwiftUI pickers/steppers the parity audit flagged on iOS.
//

import SwiftUI

// MARK: - Personal identity pill

/// Sky identity pill rendered below the top bar on every availability editor
/// frame. Mirrors the design's `HeaderPill pillar="personal"`.
struct AvailabilityHeaderPill: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.user, size: 11, color: Theme.Color.personal)
            Text("PERSONAL")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.personal)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.personalBg)
        .clipShape(Capsule())
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s2)
        .accessibilityIdentifier("scheduling.availability.identityPill")
    }
}

// MARK: - Bordered white card

/// White card with a 1px border, 16pt corner radius and an optional sky
/// uppercase overline. Replaces FormFieldGroup, whose card carried no border
/// stroke and a 12pt radius. The overline (when present) is rendered INSIDE
/// the card per `Card overline=…` in the design, not floating above it.
struct AvailabilityCard<Content: View>: View {
    let overline: String?
    let content: Content

    init(overline: String? = nil, @ViewBuilder content: () -> Content) {
        self.overline = overline
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if let overline {
                // Design `Card` overline — 9.5pt bold, 0.08em tracking.
                Text(overline.uppercased())
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(0.7)
                    .foregroundStyle(Theme.Color.personal)
                    .accessibilityAddTraits(.isHeader)
            }
            content
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        // Design `Body` gutter — 12px (`padding:'8px 12px'`), not 16.
        .padding(.horizontal, Spacing.s3)
    }
}

// MARK: - Field label

/// 12pt semibold field label sitting above an input (mirrors `FieldLabel`).
struct AvailabilityFieldLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextStrong)
    }
}

// MARK: - Field button (date / time / repeat)

/// Full-width labeled button: leading accent icon, tabular value, trailing
/// chevron-down. Mirrors the design's `FieldButton` / `TimeRangeButton`.
struct AvailabilityFieldButton: View {
    let icon: PantopusIcon
    let value: String
    let accessibilityLabel: String
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 15, color: Theme.Color.primary600)
                Text(value)
                    .font(.system(size: 13, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronDown, size: 15, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .background(disabled ? Theme.Color.appSurfaceRaised : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .contentShape(Rectangle())
            .opacity(disabled ? 0.7 : 1)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityLabel(accessibilityLabel)
    }
}

// MARK: - Time-range button (radius 9, 1.5px border)

/// A labeled time-range button (clock · "9:00 AM – 5:00 PM" · chevron-down)
/// with an optional trailing remove affordance. Mirrors the design's
/// `TimeRangeButton` (radius 9, 1.5px border).
struct AvailabilityTimeRangeButton: View {
    let label: String
    let isValid: Bool
    var disabled: Bool = false
    let onTap: () -> Void
    let onRemove: (() -> Void)?

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onTap) {
                HStack(spacing: Spacing.s2) {
                    Icon(.clock, size: 14, color: Theme.Color.primary600)
                    Text(label)
                        .font(.system(size: 13, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(.chevronDown, size: 15, color: Theme.Color.appTextMuted)
                }
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, 9)
                .background(disabled ? Theme.Color.appSurfaceRaised : Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .stroke(isValid ? Theme.Color.appBorder : Theme.Color.error, lineWidth: 1.5)
                )
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                .contentShape(Rectangle())
                .opacity(disabled ? 0.7 : 1)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(label). Edit time range.")

            if let onRemove, !disabled {
                Button(action: onRemove) {
                    Icon(.x, size: 15, color: Theme.Color.appTextMuted)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove \(label)")
            }
        }
    }
}

// MARK: - Bordered numeric stepper

/// Bordered stepper: − | value (+ optional unit) | +, with hairline dividers.
/// Mirrors the design's `Stepper` — replaces the native SwiftUI Stepper pill.
struct AvailabilityStepper: View {
    let value: String
    var unit: String?
    var error: Bool = false
    var disabled: Bool = false
    let onMinus: () -> Void
    let onPlus: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            stepButton(.minus, tint: Theme.Color.appTextStrong, action: onMinus)
            divider
            HStack(spacing: Spacing.s1) {
                Text(value)
                    .font(.system(size: 13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appText)
                if let unit {
                    Text(unit)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .padding(.horizontal, Spacing.s2)
            divider
            stepButton(.plus, tint: Theme.Color.primary600, action: onPlus)
        }
        .frame(height: 36)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(error ? Theme.Color.error : Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .opacity(disabled ? 0.6 : 1)
    }

    private var divider: some View {
        Rectangle().fill(Theme.Color.appBorder).frame(width: 1, height: 36)
    }

    private func stepButton(
        _ icon: PantopusIcon,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Icon(icon, size: 14, color: disabled ? Theme.Color.appTextMuted : tint)
                .frame(width: 30, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityLabel(icon == .minus ? "Decrease" : "Increase")
    }
}

// MARK: - Lock footnote

/// Small "private to you" footnote with a leading lock glyph. 10.5pt per the
/// design's privacy note.
struct AvailabilityLockFootnote: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s1) {
            Icon(.lock, size: 12, strokeWidth: 2, color: Theme.Color.appTextMuted)
                .padding(.top, 1)
            Text(text)
                .font(.system(size: 10.5))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
