//
//  EventTypeEditorComponents.swift
//  Pantopus
//
//  Stream I2 — B2 editor subviews: colour swatch picker, bordered/segmented
//  inputs, duration chips, labelled stepper + caption toggle rows, and the
//  sticky save bar. The card / row subviews (Stripe connect, icon toggle row,
//  member-avatar stack, info card) live in `EventTypeEditorCards.swift`.
//  Tokens only.
//

import SwiftUI

/// Row of fixed colour swatches. The selected one wears a double-ring halo —
/// a white gap then a thin ring in the swatch's own colour — per the design's
/// `0 0 0 2px #fff, 0 0 0 4px c` selection treatment (no inner check glyph).
struct EventTypeColorPicker: View {
    @Binding var selection: EventTypeSwatch

    var body: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(EventTypeSwatch.allCases) { swatch in
                Button { selection = swatch } label: {
                    ZStack {
                        if selection == swatch {
                            Circle()
                                .stroke(Theme.Color.appSurface, lineWidth: 2)
                                .frame(width: 24, height: 24)
                            Circle()
                                .stroke(swatch.color, lineWidth: 2)
                                .frame(width: 28, height: 28)
                        }
                        Circle().fill(swatch.color).frame(width: 24, height: 24)
                    }
                    .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(swatch.rawValue.capitalized) colour")
                .accessibilityAddTraits(selection == swatch ? [.isSelected] : [])
            }
            Spacer(minLength: Spacing.s0)
        }
        .accessibilityIdentifier("scheduling.eventType.colorPicker")
    }
}

/// Bordered text input box (design `TextInput`, event-editor-shell.jsx) — a
/// 1.5px-bordered, radius-8 surface holding the field, with an optional caption
/// label above and an error tint on the border. Mirrors Android's `EtTextField`
/// so the Basics fields read as boxed inputs rather than bare list rows.
struct BorderedTextField<Field: View>: View {
    var label: String?
    var isError: Bool = false
    @ViewBuilder let field: () -> Field

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if let label {
                Text(label)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            field()
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(isError ? Theme.Color.error : Theme.Color.appBorder, lineWidth: 1.5)
                )
        }
    }
}

/// Sunken-track segmented control (design `Segmented`, event-editor-shell.jsx) —
/// a sunken pill track holding equal-width segments; the selected segment is a
/// white surface card with a soft shadow and a product-blue bold label, idle
/// labels are fg3. Generic over a `Hashable` option so the editor can drive it
/// with `EventLocationMode`, `EventAssignmentMode`, `CollectMode`, `DurationMode`,
/// or a currency string. Mirrors Android's `EtSegmented`.
struct EventTypeSegmented<Option: Hashable>: View {
    let options: [Option]
    @Binding var selection: Option
    let label: (Option) -> String
    var accessibilityID: String?

    var body: some View {
        HStack(spacing: 3) {
            ForEach(options, id: \.self) { option in
                segment(option)
            }
        }
        .padding(3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .accessibilityIdentifier(accessibilityID ?? "")
    }

    private func segment(_ option: Option) -> some View {
        let on = option == selection
        return Button { selection = option } label: {
            Text(label(option))
                .font(.system(size: 12, weight: on ? .bold : .semibold))
                .foregroundStyle(on ? Theme.Color.primary700 : Theme.Color.appTextSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity)
                .frame(height: 30)
                .background(selectedBackground(on))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func selectedBackground(_ on: Bool) -> some View {
        if on {
            RoundedRectangle(cornerRadius: 7, style: .continuous)
                .fill(Theme.Color.appSurface)
                .pantopusShadow(.sm)
        } else {
            Color.clear
        }
    }
}

/// A selectable duration chip used in multiple-duration mode. A small "Default"
/// marker rides on the one the booker gets by default.
struct DurationChip: View {
    let minutes: Int
    let isSelected: Bool
    let isDefault: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                if isDefault { Icon(.star, size: 11, color: Theme.Color.appTextInverse) }
                Text(EventTypeFormat.duration(minutes))
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
            }
            .foregroundStyle(isSelected ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(isSelected ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(EventTypeFormat.duration(minutes))\(isDefault ? ", default" : "")")
    }
}

/// `title  …  value [−/+]` with an optional one-line caption.
struct LabeledStepper: View {
    let title: String
    var caption: String?
    @Binding var value: Int
    let range: ClosedRange<Int>
    var step = 1
    let format: (Int) -> String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Stepper(value: $value, in: range, step: step) {
                HStack {
                    Text(title)
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s2)
                    Text(format(value))
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            if let caption {
                Text(caption)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }
}

/// A platform toggle with a title + optional caption underneath.
struct CaptionToggle: View {
    let title: String
    var caption: String?
    @Binding var isOn: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Toggle(isOn: $isOn) {
                Text(title)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
            }
            .tint(Theme.Color.primary600)
            if let caption {
                Text(caption)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }
}

/// White card with a **pillar-colored** UPPERCASE overline — the design's
/// `Card.overline` (sky personal / violet business). Mirrors the shared
/// `FormFieldGroup` geometry (16px-radius surface, s4 padding) but paints the
/// overline in the active pillar accent instead of grey, and supports an
/// overline-less card (the Controls/Visibility card draws no overline) plus a
/// trailing chevron for the collapsible Advanced card.
struct PillarFieldGroup<Content: View>: View {
    let overline: String?
    let accent: Color
    var isExpanded: Bool?
    var onToggle: (() -> Void)?
    @ViewBuilder let content: () -> Content

    init(
        _ overline: String?,
        accent: Color,
        isExpanded: Bool? = nil,
        onToggle: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.overline = overline
        self.accent = accent
        self.isExpanded = isExpanded
        self.onToggle = onToggle
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            if let overline {
                overlineHeader(overline)
            }
            content()
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .pantopusShadow(.sm)
        .padding(.horizontal, Spacing.s4)
    }

    @ViewBuilder
    private func overlineHeader(_ text: String) -> some View {
        if let isExpanded, let onToggle {
            Button(action: onToggle) {
                HStack {
                    Text(text.uppercased())
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(accent)
                    Spacer()
                    Icon(isExpanded ? .chevronUp : .chevronDown, size: 16, color: Theme.Color.appTextMuted)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(.isHeader)
        } else {
            Text(text.uppercased())
                .pantopusTextStyle(.overline)
                .foregroundStyle(accent)
                .accessibilityAddTraits(.isHeader)
        }
    }
}

/// Compact bordered stepper box — the design `DurationCard` `Stepper` that sits
/// inline beside the quick chips: a 1px-bordered pill showing "30 min" flanked
/// by − / + tap targets. Distinct from `LabeledStepper` (a full-width row).
struct CompactDurationStepper: View {
    @Binding var value: Int
    var unit = "min"
    var range: ClosedRange<Int> = 5...480
    var step = 5

    var body: some View {
        HStack(spacing: Spacing.s2) {
            button(.minus) { value = max(range.lowerBound, value - step) }
            Text("\(value) \(unit)")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .monospacedDigit()
                .frame(minWidth: 52)
            button(.plus) { value = min(range.upperBound, value + step) }
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s2)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Length")
        .accessibilityValue("\(value) \(unit)")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: value = min(range.upperBound, value + step)
            case .decrement: value = max(range.lowerBound, value - step)
            @unknown default: break
            }
        }
    }

    private func button(_ icon: PantopusIcon, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(icon, size: 14, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                .frame(width: 22, height: 22)
        }
        .buttonStyle(.plain)
    }
}

/// A small outlined "+ N" pill that adds a preset length in single-duration
/// mode — the design's `QuickChip`.
struct QuickDurationChip: View {
    let minutes: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(.plus, size: 11, color: Theme.Color.primary600)
                Text("\(minutes)")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Set length to \(minutes) minutes")
    }
}

/// Pinned, full-width primary save bar — the design's sticky `SaveBar`
/// ("Create event type" / "Save event type"), shimmering while a commit is in
/// flight. Functional chrome stays product sky.
struct EventTypeSaveBar: View {
    let label: String
    let isEnabled: Bool
    let isSaving: Bool
    let onCommit: () -> Void

    var body: some View {
        Group {
            if isSaving {
                HStack {
                    Text("Saving…")
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            } else {
                Button(action: onCommit) {
                    Text(label)
                        .pantopusTextStyle(.body)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .background(isEnabled ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .disabled(!isEnabled)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s4)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("scheduling.eventType.saveBar")
    }
}
