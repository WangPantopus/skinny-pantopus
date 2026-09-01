//
//  BusinessPagesView.swift
//  Pantopus
//
//  C4 — custom business Pages (the multi-page CMS index). Create a page,
//  delete a non-default page, expand revision history, restore a revision,
//  and open the block builder for a page. Mirrors RN
//  `src/components/business/tabs/PagesTab.tsx`.
//

import SwiftUI

/// Pages index for one business.
@MainActor
public struct BusinessPagesView: View {
    @State private var viewModel: BusinessPagesViewModel
    private let onBack: @MainActor () -> Void
    /// Host pushes the block builder for the tapped page.
    private let onOpenPage: @MainActor (BusinessPageRow) -> Void

    public init(
        businessId: String,
        onBack: @escaping @MainActor () -> Void,
        onOpenPage: @escaping @MainActor (BusinessPageRow) -> Void
    ) {
        _viewModel = State(initialValue: BusinessPagesViewModel(businessId: businessId))
        self.onBack = onBack
        self.onOpenPage = onOpenPage
    }

    /// Test seam.
    init(
        viewModel: BusinessPagesViewModel,
        onBack: @escaping @MainActor () -> Void,
        onOpenPage: @escaping @MainActor (BusinessPageRow) -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onOpenPage = onOpenPage
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
            content
            if let toast = viewModel.toastMessage {
                ToastView(message: ToastMessage(text: toast, kind: .neutral))
                    .padding(.bottom, Spacing.s16)
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.toastMessage = nil
                    }
            }
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .navigationTitle("Pages")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { onBack() } label: {
                    Icon(.arrowLeft, size: 20, color: Theme.Color.appText)
                }
                .accessibilityIdentifier("businessPages.back")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    viewModel.showsAddForm.toggle()
                } label: {
                    Text(viewModel.showsAddForm ? "Cancel" : "Add page")
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.primary600)
                }
                .accessibilityIdentifier("businessPages.toggleAdd")
            }
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        .confirmationDialog(
            viewModel.pendingDelete.map { "Delete “\($0.title)”?" } ?? "",
            isPresented: deleteBinding,
            titleVisibility: .visible,
            presenting: viewModel.pendingDelete
        ) { row in
            Button("Delete \(row.title)", role: .destructive) {
                Task {
                    await viewModel.deletePage(row)
                    viewModel.pendingDelete = nil
                }
            }
            .accessibilityIdentifier("businessPages.deleteConfirm")
            Button("Cancel", role: .cancel) { viewModel.pendingDelete = nil }
        } message: { row in
            Text("The page “\(row.title)”, its blocks and its revision history are removed for good.")
        }
        .accessibilityIdentifier("businessPages.screen")
    }

    // MARK: - States

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingSkeleton
        case let .error(message):
            ErrorState(
                headline: "Couldn't load pages",
                message: message
            ) { await viewModel.refresh() }
                .accessibilityIdentifier("businessPages.error")
        case .empty:
            ScrollView {
                VStack(spacing: Spacing.s4) {
                    if viewModel.showsAddForm { addForm }
                    EmptyState(
                        icon: .fileText,
                        headline: "No pages yet",
                        subcopy: "Custom pages let you publish a menu, an about page, or anything else at its own link.",
                        cta: EmptyState.CTA(title: "Add page") {
                            await MainActor.run { viewModel.showsAddForm = true }
                        }
                    )
                    .frame(minHeight: 320)
                }
                .padding(Spacing.s4)
            }
            .accessibilityIdentifier("businessPages.empty")
        case let .loaded(rows):
            ScrollView {
                LazyVStack(spacing: Spacing.s2) {
                    if viewModel.showsAddForm { addForm }
                    ForEach(rows) { row in
                        pageCard(row)
                    }
                }
                .padding(Spacing.s4)
            }
            .accessibilityIdentifier("businessPages.loaded")
        }
    }

    private var loadingSkeleton: some View {
        VStack(spacing: Spacing.s2) {
            ForEach(0..<4, id: \.self) { _ in
                Shimmer(height: 64, cornerRadius: Radii.md)
            }
            Spacer()
        }
        .padding(Spacing.s4)
        .accessibilityIdentifier("businessPages.loading")
    }

    // MARK: - Add form

    private var addForm: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            PantopusTextField(
                "Page title",
                text: Binding(
                    get: { viewModel.draftTitle },
                    set: { viewModel.draftTitle = $0 }
                ),
                placeholder: "e.g. Menu, About Us",
                isRequired: true,
                identifier: "businessPages.titleField"
            )
            PantopusTextField(
                "Slug",
                text: Binding(
                    get: { viewModel.draftSlug },
                    set: { viewModel.setSlug($0) }
                ),
                placeholder: "e.g. menu, about",
                isRequired: true,
                identifier: "businessPages.slugField"
            )
            PrimaryButton(title: "Create page", isLoading: viewModel.isCreating) {
                await viewModel.createPage()
            }
            .accessibilityIdentifier("businessPages.create")
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        }
        .accessibilityIdentifier("businessPages.addForm")
    }

    // MARK: - Rows

    private func pageCard(_ row: BusinessPageRow) -> some View {
        VStack(spacing: Spacing.s0) {
            Button { onOpenPage(row) } label: {
                HStack(spacing: Spacing.s3) {
                    VStack(alignment: .leading, spacing: Spacing.s1) {
                        HStack(spacing: Spacing.s2) {
                            Text(row.title)
                                .pantopusTextStyle(.body)
                                .foregroundStyle(Theme.Color.appTextStrong)
                            if row.isDefault {
                                pill("Default", tint: Theme.Color.primary600, bg: Theme.Color.primary50)
                            }
                            pill(
                                row.statusLabel,
                                tint: row.isPublished ? Theme.Color.success : Theme.Color.appTextSecondary,
                                bg: row.isPublished ? Theme.Color.successBg : Theme.Color.appSurfaceSunken
                            )
                        }
                        Text("/\(row.slug)")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    Spacer()
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(Spacing.s3)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("businessPages.row.\(row.slug)")

            HStack(spacing: Spacing.s3) {
                if row.isPublished {
                    Button {
                        Task { await viewModel.toggleRevisions(for: row) }
                    } label: {
                        HStack(spacing: Spacing.s1) {
                            Icon(.history, size: 14, color: Theme.Color.primary600)
                            Text(viewModel.expandedRevisionsPageId == row.id ? "Hide history" : "History")
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.primary600)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("businessPages.history.\(row.slug)")
                }
                Spacer()
                if !row.isDefault {
                    Button { viewModel.pendingDelete = row } label: {
                        Icon(.trash2, size: 16, color: Theme.Color.error)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("businessPages.delete.\(row.slug)")
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.bottom, Spacing.s3)

            if viewModel.expandedRevisionsPageId == row.id {
                revisionPanel(pageId: row.id)
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
        }
    }

    private func revisionPanel(pageId: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if viewModel.isLoadingRevisions {
                Shimmer(height: 40, cornerRadius: Radii.sm)
                Shimmer(height: 40, cornerRadius: Radii.sm)
            } else if viewModel.revisions.isEmpty {
                Text("No revision history")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
            } else {
                ForEach(viewModel.revisions) { revision in
                    HStack(spacing: Spacing.s2) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(revision.title)
                                .pantopusTextStyle(.small)
                                .foregroundStyle(Theme.Color.appTextStrong)
                            Text(revision.subtitle)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer()
                        Button {
                            Task { await viewModel.restore(revision: revision.revision, pageId: pageId) }
                        } label: {
                            HStack(spacing: Spacing.s1) {
                                Icon(.undo2, size: 14, color: Theme.Color.appTextInverse)
                                Text("Restore")
                                    .pantopusTextStyle(.caption)
                                    .foregroundStyle(Theme.Color.appTextInverse)
                            }
                            .padding(.horizontal, Spacing.s3)
                            .padding(.vertical, Spacing.s1)
                            .background(Theme.Color.primary600)
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(viewModel.restoringRevision != nil)
                        .accessibilityIdentifier("businessPages.restore.\(revision.revision)")
                    }
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken)
        .accessibilityIdentifier("businessPages.revisions")
    }

    private func pill(_ text: String, tint: Color, bg: Color) -> some View {
        Text(text)
            .pantopusTextStyle(.caption)
            .foregroundStyle(tint)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 2)
            .background(bg)
            .clipShape(Capsule())
    }

    private var deleteBinding: Binding<Bool> {
        Binding(
            get: { viewModel.pendingDelete != nil },
            set: { if !$0 { viewModel.pendingDelete = nil } }
        )
    }
}
