//
//  GigsCategoryChipRow.swift
//  Pantopus
//
//  Horizontal category-filter chip strip shared by the Gigs feed (T2.3)
//  and the Gig Search surface (P4.4). The active chip fills with the
//  category brand color; inactive chips are surface + border. Mirrors the
//  Android `GigsCategoryChipRow` composable (same identifiers + visuals).
//

import SwiftUI

/// Scrollable row of category chips. `active` drives the filled chip;
/// `onSelect` fires with the tapped category (callers decide whether the
/// tap kicks an async refetch).
struct GigsCategoryChipRow: View {
    let active: GigsCategory
    let onSelect: (GigsCategory) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(GigsCategory.allCases, id: \.self) { category in
                    let isActive = category == active
                    Button {
                        onSelect(category)
                    } label: {
                        Text(category.label)
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                            .padding(.horizontal, 14)
                            .frame(height: 28)
                            .background(isActive ? category.color : Theme.Color.appSurface)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                                    .stroke(isActive ? .clear : Theme.Color.appBorder, lineWidth: 1)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(category.label)
                    .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("gigsChip_\(category.rawValue)")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .accessibilityIdentifier("gigsChipRow")
    }
}
