//
//  CategoryRow.swift
//  Pantopus
//
//  A10.6 — the category-chip row under the stat strip. The lead category
//  carries a per-type accent (cleaning green, handyman orange, pet red, or
//  business violet); the rest are neutral pills.
//
//  Design reference: `docs/designs/A10/business-frames.jsx` (CategoryRow).
//

import SwiftUI

@MainActor
struct BizCategoryRow: View {
    let categories: [BusinessCategoryChip]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(categories) { chip in
                    categoryChip(chip)
                }
            }
        }
        .accessibilityIdentifier("businessProfile.categories")
    }

    private func categoryChip(_ chip: BusinessCategoryChip) -> some View {
        HStack(spacing: Spacing.s1) {
            if let icon = chip.icon {
                Icon(icon, size: 11, strokeWidth: 2.2, color: foreground(chip.accent))
            }
            Text(chip.label)
                .font(.system(size: 11, weight: .semibold))
                .tracking(-0.05)
                .foregroundStyle(foreground(chip.accent))
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(background(chip.accent))
        .clipShape(Capsule())
        .accessibilityLabel(chip.label)
    }

    private func background(_ accent: BusinessCategoryAccent) -> Color {
        switch accent {
        case .business: Theme.Color.businessBg
        case .cleaning: Theme.Color.successBg
        case .handyman: Theme.Color.warningBg
        case .pet: Theme.Color.errorBg
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    private func foreground(_ accent: BusinessCategoryAccent) -> Color {
        switch accent {
        case .business: Theme.Color.business
        case .cleaning: Theme.Color.cleaning
        case .handyman: Theme.Color.handyman
        case .pet: Theme.Color.petCare
        case .neutral: Theme.Color.appTextSecondary
        }
    }
}

#Preview("CategoryRow") {
    VStack(alignment: .leading, spacing: Spacing.s4) {
        BizCategoryRow(categories: [
            BusinessCategoryChip(id: "clean", label: "Cleaning", icon: .sparkles, accent: .cleaning),
            BusinessCategoryChip(id: "home", label: "Home & apartment", icon: .home, accent: .neutral),
            BusinessCategoryChip(id: "move", label: "Move-out", icon: .package, accent: .neutral)
        ])
        BizCategoryRow(categories: [
            BusinessCategoryChip(id: "pet", label: "Pet care", icon: .pawPrint, accent: .pet),
            BusinessCategoryChip(id: "dog", label: "Dog walking", icon: .dog, accent: .neutral)
        ])
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
