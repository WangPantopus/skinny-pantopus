//
//  ServiceChipsEditor.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. Flow row of `EditServiceChip`s
//  with a trailing dashed `AddServiceChip`. Fresh chips render with the
//  amber tone instead of identity violet.
//

import SwiftUI

@MainActor
public struct EditBusinessServiceChipsEditor: View {
    private let chips: [EditBusinessPageServiceChip]

    public init(chips: [EditBusinessPageServiceChip]) {
        self.chips = chips
    }

    public var body: some View {
        EditBusinessFlowLayout(spacing: 6) {
            ForEach(chips) { chip in
                EditServiceChip(chip: chip)
            }
            AddServiceChip()
        }
        .padding(Spacing.s2)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("editBusinessPage.services")
    }
}

private struct EditServiceChip: View {
    let chip: EditBusinessPageServiceChip

    var body: some View {
        HStack(spacing: 6) {
            Icon(iconFor(chip.iconKey), size: 13, color: foregroundColor)
                .opacity(0.85)
            Text(chip.label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(foregroundColor)
            ZStack {
                Circle()
                    .fill(Color.clear)
                    .frame(width: 16, height: 16)
                Icon(.x, size: 11, strokeWidth: 2.5, color: foregroundColor)
            }
        }
        .padding(.leading, 11)
        .padding(.trailing, 5)
        .padding(.vertical, 7)
        .background(backgroundColor)
        .clipShape(Capsule())
        .overlay(
            Capsule().stroke(borderColor, lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(chip.label) service\(chip.isFresh ? ", just added" : "")")
    }

    private var foregroundColor: Color {
        chip.isFresh ? Theme.Color.warmAmber : Theme.Color.businessDark
    }

    private var backgroundColor: Color {
        chip.isFresh ? Theme.Color.warmAmberBg : Theme.Color.businessBg
    }

    private var borderColor: Color {
        chip.isFresh ? Theme.Color.warning.opacity(0.4) : Theme.Color.business.opacity(0.25)
    }
}

private struct AddServiceChip: View {
    var body: some View {
        HStack(spacing: 4) {
            Icon(.plus, size: 12, color: Theme.Color.appTextSecondary)
            Text("Add service")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 7)
        .overlay(
            Capsule()
                .strokeBorder(
                    Theme.Color.appBorderStrong,
                    style: StrokeStyle(lineWidth: 1, dash: [3, 3])
                )
        )
        .accessibilityLabel("Add a service")
        .accessibilityAddTraits(.isButton)
    }
}

/// Map the Lucide token from the data layer onto our `PantopusIcon`
/// enum. Returns `.tag` as a safe fallback for unknown keys (one of
/// the existing icon vocabulary).
private func iconFor(_ key: String) -> PantopusIcon {
    switch key {
    case "utensils": .utensils
    case "shopping-bag": .shoppingBag
    case "trees": .trees
    case "wifi": .wifi
    case "paw-print": .pawPrint
    case "clock": .clock
    case "sparkles": .sparkles
    default: .tag
    }
}

#Preview {
    EditBusinessServiceChipsEditor(chips: [
        .init(id: "1", label: "Dine-in", iconKey: "utensils"),
        .init(id: "2", label: "Takeaway", iconKey: "shopping-bag"),
        .init(id: "3", label: "Outdoor seating", iconKey: "trees", isFresh: true),
        .init(id: "4", label: "Free Wi-Fi", iconKey: "wifi"),
        .init(id: "5", label: "Dog-friendly", iconKey: "paw-print"),
        .init(id: "6", label: "Pre-order", iconKey: "clock")
    ])
    .padding()
    .background(Theme.Color.appBg)
}
