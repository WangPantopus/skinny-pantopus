//
//  PickCategoryStep.swift
//  Pantopus
//
//  A12.10 Frame 1 (populated) — Create Business wizard step 1.
//
//  Composition: identity chip → headline + subcopy → search field
//  → 2×4 category grid → "What you'll get" strip (when a designed
//  payload exists) → step-preview meta row. The sticky-CTA
//  "Continue" button is owned by `WizardShell`.
//
//  When the user types into the search field, the wizard view swaps
//  this step out for `PickCategorySearchStep`; the populated frame
//  re-renders the moment the query clears.
//

import SwiftUI

struct PickCategoryStep: View {
    @Bindable var viewModel: CreateBusinessWizardViewModel

    var body: some View {
        BusinessIdentityChip()

        HeadlineBlock(
            "What does your business do?",
            subtitle: "Pick the closest fit — this shapes your listings, tax setup, and the badges " +
                "customers see. You can refine the specifics on step 3."
        )

        BusinessSearchField(text: $viewModel.searchText, focused: false)

        BusinessCategoryGrid(selectedId: viewModel.selectedCategoryId) {
            viewModel.selectCategory($0)
        }

        if !viewModel.whatYouGetItems.isEmpty,
           let selected = viewModel.selectedCategoryId {
            WhatYouGetStrip(category: selected, items: viewModel.whatYouGetItems)
        }

        StepPreviewMeta()
    }
}

// MARK: - Business identity chip (violet)

struct BusinessIdentityChip: View {
    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.building2, size: 11, color: Theme.Color.business)
            Text("Business · new")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.business)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.businessBg)
        .clipShape(Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Business, new")
        .accessibilityIdentifier("createBusinessIdentityChip")
    }
}

// MARK: - Category grid (2 × 4)

struct BusinessCategoryGrid: View {
    let selectedId: BusinessCategory?
    let onPick: (BusinessCategory) -> Void

    private let columns = [
        GridItem(.flexible(), spacing: Spacing.s3),
        GridItem(.flexible(), spacing: Spacing.s3)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: Spacing.s3) {
            ForEach(BusinessCategory.allCases) { category in
                BusinessCategoryCard(
                    category: category,
                    selected: selectedId == category
                ) {
                    onPick(category)
                }
                .accessibilityIdentifier("createBusinessCategoryTile_\(category.rawValue)")
            }
        }
        .accessibilityIdentifier("createBusinessCategoryGrid")
    }
}

private struct BusinessCategoryCard: View {
    let category: BusinessCategory
    let selected: Bool
    let onPick: () -> Void

    var body: some View {
        Button(action: onPick) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(selected ? category.accent : category.accent.opacity(0.1))
                        .frame(width: 34, height: 34)
                    Icon(
                        category.icon,
                        size: 16,
                        strokeWidth: 2,
                        color: selected ? Theme.Color.appTextInverse : category.accent
                    )
                }
                Text(category.label)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .multilineTextAlignment(.leading)
                Text(category.subcopy)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(
                        selected ? category.accent : Theme.Color.appBorder,
                        lineWidth: selected ? 1.5 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .pantopusShadow(cardShadow)
            .overlay(alignment: .topTrailing) {
                if selected {
                    ZStack {
                        Circle().fill(category.accent)
                            .frame(width: 18, height: 18)
                        Icon(
                            .check,
                            size: 11,
                            strokeWidth: 3.5,
                            color: Theme.Color.appTextInverse
                        )
                    }
                    .padding(Spacing.s2)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(category.label). \(category.subcopy)")
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    /// Selected tile gets a category-tinted "0 6px 16px {accent}22"
    /// shadow per the audit; deselected tiles render flush.
    private var cardShadow: PantopusShadow {
        if selected {
            return PantopusShadow(color: category.accent, opacity: 0.13, radius: 16, x: 0, y: 6)
        }
        return PantopusShadow(color: .black, opacity: 0.03, radius: 2, x: 0, y: 1)
    }
}

// MARK: - "What you'll get" strip

private struct WhatYouGetStrip: View {
    let category: BusinessCategory
    let items: [WhatYouGetItem]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s1) {
                Icon(.sparkles, size: 11, color: Theme.Color.businessDark)
                Text("What you'll get with \(category.label.lowercased())")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.businessDark)
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(items) { item in
                    WhatYouGetRow(item: item)
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.businessBg.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.businessBg, lineWidth: 1)
        )
        .accessibilityIdentifier("createBusinessWhatYouGetStrip")
    }
}

private struct WhatYouGetRow: View {
    let item: WhatYouGetItem

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(Theme.Color.appSurface)
                .frame(width: 20, height: 20)
                .overlay {
                    Icon(item.icon, size: 11, strokeWidth: 2.4, color: Theme.Color.business)
                }
            VStack(alignment: .leading, spacing: 1) {
                Text(item.label)
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appText)
                Text(item.subcopy)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
    }
}

// MARK: - Step preview meta row

private struct StepPreviewMeta: View {
    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.map, size: 13, color: Theme.Color.appTextSecondary)
            (
                Text("Next: ")
                    .foregroundColor(Theme.Color.appTextSecondary)
                    + Text("legal info")
                    .foregroundColor(Theme.Color.appTextStrong)
                    + Text(" · ")
                    .foregroundColor(Theme.Color.appTextSecondary)
                    + Text("profile")
                    .foregroundColor(Theme.Color.appTextStrong)
                    + Text(" · ")
                    .foregroundColor(Theme.Color.appTextSecondary)
                    + Text("confirm")
                    .foregroundColor(Theme.Color.appTextStrong)
            )
            .pantopusTextStyle(.caption)
            Spacer(minLength: Spacing.s2)
            Text("~6 min")
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Next: legal info, profile, confirm. About 6 minutes.")
        .accessibilityIdentifier("createBusinessStepPreview")
    }
}

// MARK: - Search field (shared with the search frame)

struct BusinessSearchField: View {
    @Binding var text: String
    let focused: Bool

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.search, size: 16, color: Theme.Color.appTextSecondary)
            TextField(
                "Search categories — e.g. \"tutor\", \"lawn care\"",
                text: $text
            )
            .font(Theme.Font.body)
            .foregroundStyle(Theme.Color.appText)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .submitLabel(.search)
            .accessibilityIdentifier("createBusinessSearchField")
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    ZStack {
                        Circle().fill(Theme.Color.appSurfaceSunken)
                            .frame(width: 22, height: 22)
                        Icon(.x, size: 12, color: Theme.Color.appTextSecondary)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
                .accessibilityIdentifier("createBusinessSearchClear")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(
                    focused || !text.isEmpty ? Theme.Color.business : Theme.Color.appBorder,
                    lineWidth: 1
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
    }
}

#Preview {
    ScrollView {
        VStack(spacing: Spacing.s5) {
            PickCategoryStep(viewModel: CreateBusinessWizardViewModel())
        }
        .padding()
    }
    .background(Theme.Color.appBg)
}
