//
//  BusinessPageBlocksView.swift
//  Pantopus
//
//  C4 — the block-based business Page builder. Separate surface from
//  `EditBusinessPageView` (which edits business *profile* fields): this one
//  drives `/api/businesses/:id/pages/:pageId/blocks`, `…/publish` and
//  `…/revisions`. Mirrors RN `src/app/businesses/[id]/page-editor.tsx`.
//

// swiftlint:disable type_body_length

import SwiftUI

/// Block builder for one custom business page.
@MainActor
public struct BusinessPageBlocksView: View {
    @State private var viewModel: BusinessPageBlocksViewModel
    private let pageTitle: String
    private let onBack: @MainActor () -> Void

    public init(
        businessId: String,
        pageId: String,
        pageTitle: String,
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(
            initialValue: BusinessPageBlocksViewModel(businessId: businessId, pageId: pageId)
        )
        self.pageTitle = pageTitle
        self.onBack = onBack
    }

    /// Test seam.
    init(
        viewModel: BusinessPageBlocksViewModel,
        pageTitle: String,
        onBack: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.pageTitle = pageTitle
        self.onBack = onBack
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
        .navigationTitle(pageTitle.isEmpty ? "Page editor" : pageTitle)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { onBack() } label: {
                    Icon(.arrowLeft, size: 20, color: Theme.Color.appText)
                }
                .accessibilityIdentifier("businessPageBlocks.back")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { viewModel.isPreviewing.toggle() } label: {
                    Icon(
                        viewModel.isPreviewing ? .pencil : .eye,
                        size: 20,
                        color: viewModel.isPreviewing ? Theme.Color.business : Theme.Color.appText
                    )
                }
                .accessibilityIdentifier("businessPageBlocks.previewToggle")
            }
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        .sheet(isPresented: pickerBinding) {
            BusinessPageBlockTypePicker(
                onSelect: { kind in
                    viewModel.showsPicker = false
                    viewModel.addBlock(kind: kind)
                },
                onClose: { viewModel.showsPicker = false }
            )
        }
        .sheet(item: editingBinding) { target in
            BusinessPageBlockEditorSheet(
                block: target.block,
                onSave: { updated in
                    viewModel.update(at: target.index, to: updated)
                    viewModel.editingIndex = nil
                },
                onClose: { viewModel.editingIndex = nil }
            )
        }
        .confirmationDialog(
            "Delete block",
            isPresented: deleteBinding,
            titleVisibility: .visible
        ) {
            Button("Delete block", role: .destructive) {
                if let index = viewModel.pendingDeleteIndex {
                    viewModel.deleteBlock(at: index)
                }
                viewModel.pendingDeleteIndex = nil
            }
            .accessibilityIdentifier("businessPageBlocks.deleteConfirm")
            Button("Cancel", role: .cancel) { viewModel.pendingDeleteIndex = nil }
        } message: {
            Text("Remove this block? It disappears from the draft until you undo it by re-adding it.")
        }
        .accessibilityIdentifier("businessPageBlocks.screen")
    }

    // MARK: - States

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingSkeleton
        case let .error(message):
            ErrorState(
                headline: "Couldn't load this page",
                message: message
            ) { await viewModel.refresh() }
                .accessibilityIdentifier("businessPageBlocks.error")
        case .loaded:
            if viewModel.isPreviewing {
                previewBody
            } else {
                editorBody
            }
        }
    }

    private var loadingSkeleton: some View {
        VStack(spacing: Spacing.s3) {
            ForEach(0..<4, id: \.self) { _ in
                Shimmer(height: 72, cornerRadius: Radii.lg)
            }
            Spacer()
        }
        .padding(Spacing.s4)
        .accessibilityIdentifier("businessPageBlocks.loading")
    }

    // MARK: - Preview mode

    private var previewBody: some View {
        VStack(spacing: Spacing.s0) {
            HStack(spacing: Spacing.s2) {
                Icon(.eye, size: 16, color: Theme.Color.warning)
                Text("Preview mode — changes not saved")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.warning)
                Spacer()
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.warningBg)

            ScrollView {
                BusinessPageBlocksPreview(blocks: viewModel.blocks)
                    .padding(Spacing.s4)
            }

            VStack(spacing: Spacing.s0) {
                PrimaryButton(title: "Exit preview") { viewModel.isPreviewing = false }
                    .accessibilityIdentifier("businessPageBlocks.exitPreview")
            }
            .padding(Spacing.s4)
            .background(Theme.Color.appSurface)
        }
        .accessibilityIdentifier("businessPageBlocks.previewMode")
    }

    // MARK: - Editor mode

    private var editorBody: some View {
        VStack(spacing: Spacing.s0) {
            revisionStrip
            if viewModel.blocks.isEmpty {
                EmptyState(
                    icon: .package,
                    headline: "No blocks yet",
                    subcopy: "Add blocks to build your page content.",
                    cta: EmptyState.CTA(title: "Add block") {
                        await MainActor.run { viewModel.showsPicker = true }
                    }
                )
                .accessibilityIdentifier("businessPageBlocks.empty")
            } else {
                ScrollView {
                    LazyVStack(spacing: Spacing.s2) {
                        ForEach(Array(viewModel.blocks.enumerated()), id: \.element.localId) { index, block in
                            blockCard(index: index, block: block)
                        }
                    }
                    .padding(Spacing.s4)
                }
            }
            bottomBar
        }
    }

    private var revisionStrip: some View {
        HStack(spacing: Spacing.s2) {
            if viewModel.publishedRevision > 0 {
                Text("v\(viewModel.publishedRevision)")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.success)
                    .accessibilityIdentifier("businessPageBlocks.publishedRevision")
            } else {
                Text("Unpublished")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            if viewModel.hasChanges {
                Circle()
                    .fill(Theme.Color.warning)
                    .frame(width: 6, height: 6)
                Text("Unsaved")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.warning)
                    .accessibilityIdentifier("businessPageBlocks.unsaved")
            }
            Spacer()
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
    }

    private func blockCard(index: Int, block: BusinessPageBlock) -> some View {
        let entry = BusinessPageBlockRegistry.entry(for: block.kind)
        return VStack(spacing: Spacing.s0) {
            Button {
                viewModel.editingIndex = index
            } label: {
                HStack(spacing: Spacing.s3) {
                    ZStack {
                        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                            .fill(Theme.Color.primary50)
                            .frame(width: 32, height: 32)
                        Icon(entry.icon, size: 16, color: Theme.Color.primary600)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.label)
                            .pantopusTextStyle(.body)
                            .foregroundStyle(Theme.Color.appTextStrong)
                        Text(block.summaryLine)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(1)
                    }
                    Spacer()
                    if !block.isVisible {
                        Icon(.eyeOff, size: 16, color: Theme.Color.warning)
                    }
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(Spacing.s3)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("businessPageBlocks.block.\(index)")

            Divider().overlay(Theme.Color.appBorderSubtle)

            HStack(spacing: Spacing.s2) {
                Button { viewModel.moveUp(index) } label: {
                    Icon(
                        .arrowUp,
                        size: 16,
                        color: index == 0 ? Theme.Color.appBorderStrong : Theme.Color.appTextSecondary
                    )
                }
                .buttonStyle(.plain)
                .disabled(index == 0)
                .accessibilityIdentifier("businessPageBlocks.moveUp.\(index)")

                Button { viewModel.moveDown(index) } label: {
                    Icon(
                        .arrowDown,
                        size: 16,
                        color: index == viewModel.blocks.count - 1
                            ? Theme.Color.appBorderStrong
                            : Theme.Color.appTextSecondary
                    )
                }
                .buttonStyle(.plain)
                .disabled(index == viewModel.blocks.count - 1)
                .accessibilityIdentifier("businessPageBlocks.moveDown.\(index)")

                Spacer()

                Button { viewModel.pendingDeleteIndex = index } label: {
                    Icon(.trash2, size: 16, color: Theme.Color.error)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("businessPageBlocks.delete.\(index)")
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(
                    block.isVisible ? Theme.Color.appBorder : Theme.Color.warningLight,
                    lineWidth: 1
                )
        }
    }

    private var bottomBar: some View {
        HStack(spacing: Spacing.s2) {
            Button { viewModel.showsPicker = true } label: {
                Icon(.plus, size: 18, color: Theme.Color.appTextStrong)
                    .frame(width: 44, height: 44)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("businessPageBlocks.addBlock")

            GhostButton(
                title: "Save draft",
                isLoading: viewModel.isSaving,
                isEnabled: viewModel.hasChanges
            ) {
                await viewModel.saveDraft()
            }
            .accessibilityIdentifier("businessPageBlocks.saveDraft")

            PrimaryButton(
                title: "Publish",
                isLoading: viewModel.isPublishing,
                isEnabled: !viewModel.blocks.isEmpty
            ) {
                await viewModel.publish()
            }
            .accessibilityIdentifier("businessPageBlocks.publish")
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
    }

    // MARK: - Bindings

    private struct EditingTarget: Identifiable {
        let index: Int
        let block: BusinessPageBlock
        var id: String {
            block.localId
        }
    }

    private var editingBinding: Binding<EditingTarget?> {
        Binding(
            get: {
                guard let index = viewModel.editingIndex,
                      viewModel.blocks.indices.contains(index) else { return nil }
                return EditingTarget(index: index, block: viewModel.blocks[index])
            },
            set: { if $0 == nil { viewModel.editingIndex = nil } }
        )
    }

    private var deleteBinding: Binding<Bool> {
        Binding(
            get: { viewModel.pendingDeleteIndex != nil },
            set: { if !$0 { viewModel.pendingDeleteIndex = nil } }
        )
    }

    private var pickerBinding: Binding<Bool> {
        Binding(
            get: { viewModel.showsPicker },
            set: { viewModel.showsPicker = $0 }
        )
    }
}
