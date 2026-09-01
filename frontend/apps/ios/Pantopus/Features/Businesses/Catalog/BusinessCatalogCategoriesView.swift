//
//  BusinessCatalogCategoriesView.swift
//  Pantopus
//
//  Category manager sheet for the owner catalog. Mirrors the React
//  Native "Categories" panel (`CatalogTab.tsx:205-232`) — list, add, and
//  delete — and adds the rename the backend already supports
//  (`PATCH …/catalog/categories/:catId`, `backend/routes/businesses.js:2277`).
//
//  Deleting names the category in the confirm, per the destructive-action
//  rule.
//

import SwiftUI

/// Category create / rename / delete sheet.
@MainActor
struct BusinessCatalogCategoriesView: View {
    let categories: [BusinessCatalogCategoryRow]
    let isSaving: Bool
    let onClose: @MainActor () -> Void
    let onCreate: @MainActor (String) async -> Bool
    let onRename: @MainActor (String, String) async -> Bool
    let onDelete: @MainActor (String) async -> Void

    @State private var newName = ""
    @State private var renameTarget: BusinessCatalogCategoryRow?
    @State private var renameText = ""
    @State private var pendingDelete: BusinessCatalogCategoryRow?

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(title: "Categories", onBack: onClose, action: nil)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    if categories.isEmpty {
                        emptyCopy
                    } else {
                        VStack(spacing: Spacing.s0) {
                            ForEach(Array(categories.enumerated()), id: \.element.id) { index, category in
                                row(category)
                                if index < categories.count - 1 {
                                    Rectangle()
                                        .fill(Theme.Color.appBorderSubtle)
                                        .frame(height: 1)
                                        .padding(.leading, 14)
                                }
                            }
                        }
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                    }
                    addRow
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s4)
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("businessCatalog.categoriesSheet")
        .alert("Rename category", isPresented: renamePresented, presenting: renameTarget) { category in
            TextField("Category name", text: $renameText)
            Button("Save") {
                let id = category.id
                let name = renameText
                renameTarget = nil
                Task { _ = await onRename(id, name) }
            }
            Button("Cancel", role: .cancel) { renameTarget = nil }
        } message: { category in
            Text("Rename “\(category.name)”.")
        }
        .confirmationDialog(
            "Delete category",
            isPresented: deletePresented,
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { category in
            Button("Delete", role: .destructive) {
                let id = category.id
                pendingDelete = nil
                Task { await onDelete(id) }
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: { category in
            Text("Delete “\(category.name)”? Items keep their prices but lose this grouping.")
        }
    }

    // MARK: - Pieces

    private var emptyCopy: some View {
        Text("No categories yet. Group your services and products so neighbors can scan your page faster.")
            .font(.system(size: 12.5))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("businessCatalog.categoriesSheet.empty")
    }

    private func row(_ category: BusinessCatalogCategoryRow) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(.tag, size: 16, strokeWidth: 2, color: Theme.Color.business)
            VStack(alignment: .leading, spacing: 1) {
                Text(category.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                if let detail = category.detail, !detail.isEmpty {
                    Text(detail)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: Spacing.s2)
            Button {
                renameText = category.name
                renameTarget = category
            } label: {
                Icon(.pencil, size: 15, strokeWidth: 2, color: Theme.Color.appTextSecondary)
                    .frame(width: 30, height: 30)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Rename \(category.name)")
            .accessibilityIdentifier("businessCatalog.renameCategory.\(category.id)")

            Button { pendingDelete = category } label: {
                Icon(.trash2, size: 15, strokeWidth: 2, color: Theme.Color.error)
                    .frame(width: 30, height: 30)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Delete \(category.name)")
            .accessibilityIdentifier("businessCatalog.deleteCategory.\(category.id)")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s2)
    }

    private var addRow: some View {
        HStack(alignment: .bottom, spacing: Spacing.s2) {
            PantopusTextField(
                "New category",
                text: $newName,
                placeholder: "e.g. Giving, Repairs",
                identifier: "businessCatalog.newCategoryName"
            )
            Button {
                let name = newName
                Task {
                    if await onCreate(name) { newName = "" }
                }
            } label: {
                Text("Add")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s4)
                    .frame(minHeight: 44)
                    .background(Theme.Color.business)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(isSaving || newName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(newName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.5 : 1)
            .accessibilityIdentifier("businessCatalog.addCategory")
        }
    }

    private var renamePresented: Binding<Bool> {
        Binding(
            get: { renameTarget != nil },
            set: { if !$0 { renameTarget = nil } }
        )
    }

    private var deletePresented: Binding<Bool> {
        Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        )
    }
}
