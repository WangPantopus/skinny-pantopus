//
//  PlanFormParts.swift
//  Pantopus
//
//  The composer's form parts (plans.css "forms"): a labelled field, the
//  48 pt input, the bordered form card, date rows, the segmented control
//  and a switch row.
//

import SwiftUI

/// An upper-case label over its content; `locked` adds the lock (private fields).
struct PlanFormField<Content: View>: View {
    let label: String
    var locked = false
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: 6) {
                if locked { Icon(.lock, size: 14, color: Theme.Color.appTextSecondary) }
                Text.planOverline(label)
            }
            content()
        }
    }
}

/// The board's text input: 48 pt, strong border, 8 pt corners.
struct PlanTextInput: View {
    let placeholder: String
    @Binding var text: String
    var multiline = false
    var limit = 120
    var identifier: String?

    var body: some View {
        Group {
            if multiline {
                TextField(placeholder, text: $text, axis: .vertical)
                    .lineLimit(3...8)
                    .frame(minHeight: 54, alignment: .topLeading)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .planFont(.body)
        .foregroundStyle(Theme.Color.appText)
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(minHeight: 48)
        .background(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
        .onChange(of: text) { _, new in
            if new.count > limit { text = String(new.prefix(limit)) }
        }
        .accessibilityIdentifier(identifier ?? placeholder)
    }
}

/// A bordered white card holding rows.
struct PlanFormCard<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 0, content: content)
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s1)
            .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
    }
}

/// "Starts  Sun, Oct 18 · 1:25 PM" with the system picker.
struct PlanDateRow: View {
    let label: String
    @Binding var date: Date
    let components: DatePickerComponents
    let range: ClosedRange<Date>

    var body: some View {
        DatePicker(selection: $date, in: range, displayedComponents: components) {
            Text(label).planFont(.body).foregroundStyle(Theme.Color.appText)
        }
        .tint(Theme.Color.primary700)
        .padding(.vertical, Spacing.s2)
        .frame(minHeight: 52)
    }
}

/// The board's segmented control: a sunken track, the chosen segment raised.
struct PlanSegmented<Value: Hashable>: View {
    let options: [(Value, String)]
    @Binding var selection: Value
    let label: String

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(spacing: 3) { segments }
            } else {
                HStack(spacing: 3) { segments }
            }
        }
        .padding(3)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Theme.Color.appSurfaceSunken))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
    }

    private var segments: some View {
        ForEach(Array(options.enumerated()), id: \.offset) { _, option in
            let isOn = option.0 == selection
            Button { selection = option.0 } label: {
                Text(option.1)
                    .planFont(.smallStrong)
                    .foregroundStyle(isOn ? Theme.Color.appText : Theme.Color.appTextSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, minHeight: 38)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .fill(isOn ? Theme.Color.appSurface : Color.clear)
                            .shadow(color: .black.opacity(isOn ? 0.06 : 0), radius: 3, x: 0, y: 2)
                    )
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(option.1)
            .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
        }
    }
}

/// A title, a line under it, and a switch.
struct PlanSwitchRow: View {
    let title: String
    let subtitle: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 0) {
                Text(title).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                Text(subtitle).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .tint(Theme.Color.successSolid)
    }
}
