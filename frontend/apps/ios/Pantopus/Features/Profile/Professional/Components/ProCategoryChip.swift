//
//  ProCategoryChip.swift
//  Pantopus
//
//  Selectable category chip for the "Enable professional mode" form. Unlike
//  `ProSkillChip` (which renders an already-claimed skill with a remove ×)
//  this one toggles, and greys out once the server's 5-category cap is
//  reached — mirroring RN `professional.tsx:494`.
//

import SwiftUI

@MainActor
struct ProCategoryChip: View {
    let label: String
    let isOn: Bool
    var isDisabled = false
    let identifier: String
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(label)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(foreground)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s1)
                .frame(minHeight: 28)
                .background(background)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(label)
        .accessibilityAddTraits(.isButton)
        .accessibilityAddTraits(isOn ? .isSelected : [])
        .accessibilityHint(isDisabled ? "Category limit reached" : "")
    }

    private var foreground: Color {
        if isOn { return Theme.Color.appTextInverse }
        return isDisabled ? Theme.Color.appTextMuted : Theme.Color.appTextStrong
    }

    private var background: Color {
        isOn ? Theme.Color.business : Theme.Color.appSurface
    }

    private var border: Color {
        isOn ? Theme.Color.business : Theme.Color.appBorder
    }
}

#Preview {
    HStack {
        ProCategoryChip(label: "Handyman", isOn: true, identifier: "a") {}
        ProCategoryChip(label: "Plumber", isOn: false, identifier: "b") {}
        ProCategoryChip(label: "HVAC", isOn: false, isDisabled: true, identifier: "c") {}
    }
    .padding()
    .background(Theme.Color.appBg)
}
