//
//  ProFormRow.swift
//  Pantopus
//
//  A.5 (A13.11) — the small field primitives shared by the Professional
//  Profile editor and the "Enable professional mode" form: the overline
//  section block, the label row (required / optional / edited markers), and
//  the bordered text field.
//

import SwiftUI

/// Overline + a padded stack of fields. One per A13 form section.
@MainActor
struct ProSectionBlock<Content: View>: View {
    private let overline: String
    private let content: Content

    init(_ overline: String, @ViewBuilder content: () -> Content) {
        self.overline = overline
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(overline)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s4)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: Spacing.s3) {
                content
            }
            .padding(.horizontal, Spacing.s4)
        }
    }
}

/// Field label with optional `*` (required), `(optional)` hint, and the
/// amber fresh dot when the field was edited this session.
@MainActor
struct ProFieldLabelRow: View {
    let text: String
    var required = false
    var optional = false
    var dirty = false

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Text(text)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextStrong)
            if required {
                Text("*")
                    .pantopusTextStyle(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.business)
            }
            if optional {
                Text("(optional)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            if dirty { FreshDot() }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            text + (required ? ", required" : "") + (optional ? ", optional" : "") + (dirty ? ", edited" : "")
        )
    }
}

/// Everything a `ProTextFieldRow` needs to render.
struct ProTextFieldSpec {
    let label: String
    var required = false
    var optional = false
    let value: String
    let dirty: Bool
    let placeholder: String
    let identifier: String
    var keyboard: UIKeyboardType = .default
}

/// Label + bordered text field, growing to 3 lines.
@MainActor
struct ProTextFieldRow: View {
    let spec: ProTextFieldSpec
    let onChange: @MainActor @Sendable (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            ProFieldLabelRow(
                text: spec.label,
                required: spec.required,
                optional: spec.optional,
                dirty: spec.dirty
            )
            TextField(spec.placeholder, text: Binding(get: { spec.value }, set: onChange), axis: .vertical)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1...3)
                .keyboardType(spec.keyboard)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .frame(minHeight: 44)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier(spec.identifier)
                .accessibilityLabel(spec.label)
        }
    }
}
