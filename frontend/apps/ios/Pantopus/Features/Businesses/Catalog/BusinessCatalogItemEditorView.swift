//
//  BusinessCatalogItemEditorView.swift
//  Pantopus
//
//  Add / edit a catalog item. Reuses the A13 Form archetype (`FormShell`
//  + `FormFieldGroup` + `PantopusTextField` + `ChipPicker`) rather than a
//  bespoke sheet, and carries the same field vocabulary as the React
//  Native editor (`src/components/business/tabs/CatalogTab.tsx:296-369`):
//  name · type · price · max price · price unit · duration · description ·
//  category · featured · active-vs-draft.
//
//  Donation items hide the price inputs: the backend rejects a fixed
//  price on `kind = donation` (`DONATION_NO_FIXED_PRICE`,
//  `backend/routes/businesses.js:2350`).
//

// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

/// Item create / edit sheet.
@MainActor
struct BusinessCatalogItemEditorView: View {
    let target: BusinessCatalogEditorTarget
    let categories: [BusinessCatalogCategoryRow]
    let isSaving: Bool
    let onCancel: @MainActor () -> Void
    let onSave: @MainActor (BusinessCatalogItemDraft) async -> Void

    @State private var draft: BusinessCatalogItemDraft
    private let original: BusinessCatalogItemDraft

    init(
        target: BusinessCatalogEditorTarget,
        categories: [BusinessCatalogCategoryRow],
        isSaving: Bool,
        onCancel: @escaping @MainActor () -> Void,
        onSave: @escaping @MainActor (BusinessCatalogItemDraft) async -> Void
    ) {
        self.target = target
        self.categories = categories
        self.isSaving = isSaving
        self.onCancel = onCancel
        self.onSave = onSave
        let seed: BusinessCatalogItemDraft = switch target {
        case .create: BusinessCatalogItemDraft()
        case let .edit(row): BusinessCatalogItemDraft(row: row)
        }
        _draft = State(initialValue: seed)
        original = seed
    }

    private var isEditing: Bool {
        if case .edit = target { return true }
        return false
    }

    var body: some View {
        FormShell(
            title: isEditing ? "Edit item" : "New item",
            rightActionLabel: nil,
            bottomActionLabel: isEditing ? "Save item" : "Add item",
            isValid: draft.isValid,
            isDirty: draft != original,
            isSaving: isSaving,
            onClose: onCancel,
            onCommit: { Task { await onSave(draft) } }
        ) {
            VStack(spacing: Spacing.s5) {
                itemGroup
                if draft.kind != .donation { pricingGroup }
                placementGroup
            }
        }
        .accessibilityIdentifier("businessCatalog.editor")
    }

    // MARK: - Groups

    private var itemGroup: some View {
        FormFieldGroup("Item") {
            PantopusTextField(
                "Name",
                text: $draft.name,
                placeholder: "e.g. Deep clean, Large pizza",
                isRequired: true,
                identifier: "businessCatalog.editor.name"
            )
            fieldLabel("Type")
            ChipPicker(
                options: BusinessCatalogKind.allCases.map {
                    ChipPicker.Option(id: $0.rawValue, label: $0.label, icon: $0.icon)
                },
                selection: Binding<String?>(
                    get: { draft.kind.rawValue },
                    set: { draft.kind = BusinessCatalogKind.from($0) }
                ),
                style: .tinted,
                identifier: "businessCatalog.editor.kind"
            )
            PantopusTextField(
                "Description",
                text: $draft.description,
                placeholder: "What's included?",
                identifier: "businessCatalog.editor.description"
            )
        }
    }

    private var pricingGroup: some View {
        FormFieldGroup("Pricing") {
            PantopusTextField(
                "Price (cents)",
                text: $draft.priceCents,
                placeholder: "1500 = $15.00",
                keyboardType: .numberPad,
                identifier: "businessCatalog.editor.price"
            )
            PantopusTextField(
                "Max price (cents)",
                text: $draft.priceMaxCents,
                placeholder: "For a price range",
                keyboardType: .numberPad,
                identifier: "businessCatalog.editor.priceMax"
            )
            PantopusTextField(
                "Price unit",
                text: $draft.priceUnit,
                placeholder: "e.g. hour, day, visit",
                identifier: "businessCatalog.editor.priceUnit"
            )
            PantopusTextField(
                "Duration (minutes)",
                text: $draft.durationMinutes,
                placeholder: "e.g. 60",
                keyboardType: .numberPad,
                identifier: "businessCatalog.editor.duration"
            )
        }
    }

    private var placementGroup: some View {
        FormFieldGroup("Placement") {
            if !categories.isEmpty {
                fieldLabel("Category")
                ChipPicker(
                    options: [ChipPicker.Option(id: Self.noCategoryId, label: "None")]
                        + categories.map { ChipPicker.Option(id: $0.id, label: $0.name) },
                    selection: Binding<String?>(
                        get: { draft.categoryId ?? Self.noCategoryId },
                        set: { draft.categoryId = $0 == Self.noCategoryId ? nil : $0 }
                    ),
                    style: .tinted,
                    identifier: "businessCatalog.editor.category"
                )
            }
            toggleRow(
                title: "Featured",
                subtitle: "Pin this to the top of your public page.",
                isOn: $draft.isFeatured,
                identifier: "businessCatalog.editor.featured"
            )
            toggleRow(
                title: "Save as draft",
                subtitle: "Drafts stay hidden from neighbors until you switch them to active.",
                isOn: $draft.isDraft,
                identifier: "businessCatalog.editor.draft"
            )
        }
    }

    // MARK: - Pieces

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func toggleRow(
        title: String,
        subtitle: String,
        isOn: Binding<Bool>,
        identifier: String
    ) -> some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(Theme.Color.business)
                .accessibilityLabel(title)
                .accessibilityIdentifier(identifier)
        }
    }

    /// Sentinel id for the "None" category chip — `nil` can't be a chip id.
    private static let noCategoryId = "__none__"
}
