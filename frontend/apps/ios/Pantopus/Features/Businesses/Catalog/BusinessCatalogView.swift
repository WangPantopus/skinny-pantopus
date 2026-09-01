//
//  BusinessCatalogView.swift
//  Pantopus
//
//  A10.7 → Services → "Manage". The owner catalog manager: an in-screen
//  frame of the Business owner dashboard (same idiom as the existing
//  owner ↔ preview toggle) that lists catalog items in `sort_order` with
//  move-up / move-down reorder, opens the item editor sheet on tap, and
//  archives an item behind a confirm that names it.
//
//  Android twin: `ui/screens/businesses/catalog/BusinessCatalogScreen.kt`.
//

import SwiftUI

/// Which editor the sheet is showing.
enum BusinessCatalogEditorTarget: Identifiable {
    case create
    case edit(BusinessCatalogItemRow)

    var id: String {
        switch self {
        case .create: "create"
        case let .edit(row): row.id
        }
    }
}

/// Owner catalog manager frame.
@MainActor
public struct BusinessCatalogView: View {
    @State private var viewModel: BusinessCatalogViewModel
    @State private var editorTarget: BusinessCatalogEditorTarget?
    @State private var showsCategories = false
    @State private var pendingDelete: BusinessCatalogItemRow?

    private let onBack: @MainActor () -> Void

    public init(businessId: String, onBack: @escaping @MainActor () -> Void) {
        _viewModel = State(initialValue: BusinessCatalogViewModel(businessId: businessId))
        self.onBack = onBack
    }

    /// Test / preview seam — inject a view-model that skips the network.
    init(viewModel: BusinessCatalogViewModel, onBack: @escaping @MainActor () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            ContentDetailTopBar(
                title: "Catalog",
                onBack: onBack,
                action: ContentDetailTopBarAction(
                    icon: .folderPlus,
                    accessibilityLabel: "Manage categories"
                ) {
                    Task { @MainActor in showsCategories = true }
                }
            )
            stateBody(for: viewModel.state)
        }
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) { dock }
        .overlay(alignment: .bottom) { toastOverlay }
        .accessibilityIdentifier("businessCatalog")
        .task { await viewModel.load() }
        .sheet(item: $editorTarget) { target in
            BusinessCatalogItemEditorView(
                target: target,
                categories: viewModel.state.categories,
                isSaving: viewModel.isMutating,
                onCancel: { editorTarget = nil },
                onSave: { draft in
                    let ok: Bool = switch target {
                    case .create:
                        await viewModel.createItem(draft)
                    case let .edit(row):
                        await viewModel.updateItem(id: row.id, draft: draft)
                    }
                    if ok { editorTarget = nil }
                }
            )
        }
        .sheet(isPresented: $showsCategories) {
            BusinessCatalogCategoriesView(
                categories: viewModel.state.categories,
                isSaving: viewModel.isMutating,
                onClose: { showsCategories = false },
                onCreate: { name in await viewModel.createCategory(name: name) },
                onRename: { id, name in await viewModel.renameCategory(id: id, name: name) },
                onDelete: { id in await viewModel.deleteCategory(id: id) }
            )
        }
        .confirmationDialog(
            "Archive item",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { row in
            Button("Archive", role: .destructive) {
                let id = row.id
                pendingDelete = nil
                Task { await viewModel.deleteItem(id: id) }
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: { row in
            Text("Archive “\(row.name)”? It disappears from your page but stays in your records.")
        }
    }

    // MARK: - States

    @ViewBuilder
    private func stateBody(for state: BusinessCatalogState) -> some View {
        switch state {
        case .loading:
            loadingLayout
        case .empty:
            EmptyState(
                icon: .tag,
                headline: "No catalog items yet",
                subcopy: "Add the services or products you sell so neighbors can see what you offer and what it costs.",
                cta: EmptyState.CTA(title: "Add item") {
                    await MainActor.run { editorTarget = .create }
                },
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .frame(maxHeight: .infinity)
            .accessibilityIdentifier("businessCatalog.empty")
        case let .loaded(content):
            list(content)
        case let .error(message):
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't load your catalog",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") {
                    await viewModel.refresh()
                },
                tint: Theme.Color.businessBg,
                accent: Theme.Color.business
            )
            .frame(maxHeight: .infinity)
            .accessibilityIdentifier("businessCatalog.error")
        }
    }

    private var loadingLayout: some View {
        ScrollView {
            VStack(spacing: Spacing.s2) {
                ForEach(0..<5, id: \.self) { _ in
                    Shimmer(height: 66, cornerRadius: Radii.lg)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
        }
        .accessibilityIdentifier("businessCatalog.loading")
    }

    private func list(_ content: BusinessCatalogContent) -> some View {
        ScrollView {
            VStack(spacing: Spacing.s2) {
                ForEach(Array(content.items.enumerated()), id: \.element.id) { index, row in
                    BusinessCatalogItemCard(
                        row: row,
                        canMoveUp: index > 0 && !viewModel.isMutating,
                        canMoveDown: index < content.items.count - 1 && !viewModel.isMutating,
                        onEdit: { editorTarget = .edit(row) },
                        onMoveUp: { Task { await viewModel.move(itemId: row.id, direction: .up) } },
                        onMoveDown: { Task { await viewModel.move(itemId: row.id, direction: .down) } },
                        onDelete: { pendingDelete = row }
                    )
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, 96)
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("businessCatalog.list")
    }

    // MARK: - Dock

    private var dock: some View {
        Button { editorTarget = .create } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.plus, size: 16, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                Text("Add item")
                    .font(.system(size: 14, weight: .bold))
                    .tracking(-0.1)
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.business)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 14)
        .padding(.top, 10)
        .padding(.bottom, Spacing.s2)
        .background(
            Theme.Color.appSurface
                .opacity(0.97)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                }
                .ignoresSafeArea(edges: .bottom)
        )
        .accessibilityIdentifier("businessCatalog.addItem")
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, 96)
                .task {
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    viewModel.toast = nil
                }
                .transition(.opacity)
                .accessibilityIdentifier("businessCatalog.toast")
        }
    }
}

// MARK: - Item card

/// One catalog row: reorder chevrons · name + badges + meta · price ·
/// archive. Mirrors RN's `catalogCard`.
@MainActor
struct BusinessCatalogItemCard: View {
    let row: BusinessCatalogItemRow
    let canMoveUp: Bool
    let canMoveDown: Bool
    let onEdit: @MainActor () -> Void
    let onMoveUp: @MainActor () -> Void
    let onMoveDown: @MainActor () -> Void
    let onDelete: @MainActor () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s2) {
            reorderColumn
            Button(action: onEdit) { detail }
                .buttonStyle(.plain)
            Button(action: onDelete) {
                Icon(.trash2, size: 18, strokeWidth: 2, color: Theme.Color.error)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Archive \(row.name)")
            .accessibilityIdentifier("businessCatalog.delete.\(row.id)")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityIdentifier("businessCatalog.item.\(row.id)")
    }

    private var reorderColumn: some View {
        VStack(spacing: Spacing.s1) {
            Button(action: onMoveUp) {
                Icon(
                    .chevronUp,
                    size: 16,
                    strokeWidth: 2.2,
                    color: canMoveUp ? Theme.Color.appTextSecondary : Theme.Color.appTextMuted
                )
                .frame(width: 26, height: 20)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!canMoveUp)
            .accessibilityLabel("Move \(row.name) up")
            .accessibilityIdentifier("businessCatalog.moveUp.\(row.id)")

            Button(action: onMoveDown) {
                Icon(
                    .chevronDown,
                    size: 16,
                    strokeWidth: 2.2,
                    color: canMoveDown ? Theme.Color.appTextSecondary : Theme.Color.appTextMuted
                )
                .frame(width: 26, height: 20)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!canMoveDown)
            .accessibilityLabel("Move \(row.name) down")
            .accessibilityIdentifier("businessCatalog.moveDown.\(row.id)")
        }
    }

    private var detail: some View {
        HStack(alignment: .center, spacing: Spacing.s2) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Text(row.name)
                        .font(.system(size: 13.5, weight: .semibold))
                        .tracking(-0.1)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if row.kind == .donation { badge("Donation", tint: Theme.Color.business, bg: Theme.Color.businessBg) }
                    if row.isFeatured {
                        Icon(.star, size: 12, strokeWidth: 2.2, color: Theme.Color.warning)
                    }
                    if row.taxDeductible { badge("Tax-deductible", tint: Theme.Color.success, bg: Theme.Color.successBg) }
                    if row.status == .draft { badge("Draft", tint: Theme.Color.warning, bg: Theme.Color.warningBg) }
                }
                Text(row.metaLabel)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let categoryName = row.categoryName, !categoryName.isEmpty {
                    Text(categoryName)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            Spacer(minLength: Spacing.s2)
            if let priceLabel = row.priceLabel {
                Text(priceLabel)
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(row.kind == .donation ? Theme.Color.appTextSecondary : Theme.Color.appText)
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(row.name), \(row.metaLabel)\(row.priceLabel.map { ", \($0)" } ?? "")")
        .accessibilityHint("Opens the item editor")
    }

    private func badge(_ text: String, tint: Color, bg: Color) -> some View {
        Text(text)
            .font(.system(size: 9.5, weight: .semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
    }
}
