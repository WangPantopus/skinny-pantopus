//
//  PantopusCheckbox.swift
//  Pantopus
//
//  Square checkbox with a primary-tinted check, optional inline label,
//  and a 44pt minimum tap target. Use for inline gates (e.g. the
//  certified-mail acknowledgement gate from P18) where the platform
//  `Toggle` style would feel too heavy.
//

import SwiftUI

/// A bindable square checkbox.
///
/// - Parameters:
///   - isChecked: The two-way binding driving the checkbox state.
///   - label: Optional trailing label text. When non-empty the whole
///     row is the tap target; when empty the 22pt box itself is.
///   - isEnabled: Disables interaction and dims at 50% opacity.
@MainActor
public struct PantopusCheckbox: View {
    @Binding private var isChecked: Bool
    private let label: String?
    private let isEnabled: Bool
    private let accessibilityIdentifier: String?

    public init(
        isChecked: Binding<Bool>,
        label: String? = nil,
        isEnabled: Bool = true,
        accessibilityIdentifier: String? = nil
    ) {
        _isChecked = isChecked
        self.label = label
        self.isEnabled = isEnabled
        self.accessibilityIdentifier = accessibilityIdentifier
    }

    public var body: some View {
        Button {
            isChecked.toggle()
        } label: {
            HStack(alignment: .center, spacing: Spacing.s2) {
                box
                if let label, !label.isEmpty {
                    Text(label)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: Spacing.s0)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .opacity(isEnabled ? 1 : 0.5)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label ?? "Checkbox")
        .accessibilityValue(isChecked ? "Checked" : "Not checked")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier(accessibilityIdentifier ?? "")
    }

    private var box: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.sm)
                .fill(isChecked ? Theme.Color.primary600 : Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .stroke(
                            isChecked ? Theme.Color.primary600 : Theme.Color.appBorderStrong,
                            lineWidth: 1.5
                        )
                )
                .frame(width: 22, height: 22)
            if isChecked {
                Icon(.check, size: 14, color: Theme.Color.appTextInverse)
            }
        }
    }
}

#Preview("All states") {
    @Previewable @State var checked = true
    @Previewable @State var unchecked = false
    return VStack(alignment: .leading, spacing: Spacing.s3) {
        PantopusCheckbox(isChecked: $checked, label: "Checked with label")
        PantopusCheckbox(isChecked: $unchecked, label: "Unchecked with label")
        PantopusCheckbox(isChecked: $checked)
        PantopusCheckbox(isChecked: .constant(true), label: "Disabled checked", isEnabled: false)
        PantopusCheckbox(isChecked: .constant(false), label: "Disabled unchecked", isEnabled: false)
    }
    .padding()
    .background(Theme.Color.appBg)
}
