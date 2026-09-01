//
//  MyPostsView.swift
//  Pantopus
//
//  T5.3.3 — My posts. Thin wrapper around the shared `ListOfRowsView`.
//  The shell renders the back chevron, centered title, trailing filter
//  action, two equal-width tabs, row cards (with intent header chips +
//  engagement footer + kebab), and the 52pt secondary-create FAB.
//
//  The only screen-bespoke pieces are the per-row kebab confirmation
//  dialog (Archive/Restore + Delete) and the destructive delete
//  confirmation alert — both attached at the bottom of the view.
//

import SwiftUI

public struct MyPostsView: View {
    @State private var viewModel: MyPostsViewModel

    public init(viewModel: MyPostsViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        @Bindable var bindable = viewModel
        return ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier("my-posts")
            .onReceive(NotificationCenter.default.publisher(for: .pulsePostsDidChange)) { _ in
                Task { await viewModel.refresh() }
            }
            .confirmationDialog(
                "Post options",
                isPresented: Binding(
                    get: { bindable.kebabTarget != nil },
                    set: { newValue in if !newValue { bindable.kebabTarget = nil } }
                ),
                titleVisibility: .hidden,
                presenting: bindable.kebabTarget
            ) { target in
                if target.isArchived {
                    Button("Restore post") {
                        restore(postId: target.postId)
                    }
                    .accessibilityIdentifier("kebab-restore")
                } else {
                    Button("Archive post") {
                        archive(postId: target.postId)
                    }
                    .accessibilityIdentifier("kebab-archive")
                }
                Button("Delete post", role: .destructive) {
                    deleteRequest(postId: target.postId)
                }
                .accessibilityIdentifier("kebab-delete")
                Button("Cancel", role: .cancel) {
                    viewModel.cancelKebab()
                }
            }
            .alert(
                "Delete this post?",
                isPresented: Binding(
                    get: { bindable.deleteTarget != nil },
                    set: { newValue in if !newValue { bindable.deleteTarget = nil } }
                ),
                presenting: bindable.deleteTarget
            ) { _ in
                Button("Delete", role: .destructive) {
                    Task { await viewModel.confirmDelete() }
                }
                .accessibilityIdentifier("delete-confirm")
                Button("Cancel", role: .cancel) {
                    viewModel.cancelDelete()
                }
                .accessibilityIdentifier("delete-cancel")
            } message: { _ in
                Text("This post will be permanently removed from your profile and the Pulse feed.")
            }
            .sheet(isPresented: $bindable.isFilterPresented) {
                ActivityFilterSheet(
                    statusTitle: viewModel.statusFilterTitle,
                    statusOptions: viewModel.statusFilterOptions,
                    sortOptions: viewModel.sortFilterOptions,
                    filter: viewModel.activityFilter,
                    onApply: { viewModel.applyFilter($0) },
                    onClose: { viewModel.isFilterPresented = false }
                )
            }
    }

    // MARK: - Action helpers

    /// Look up the DTO for a post id from the VM's current cache via the
    /// kebab target metadata. The VM exposes archive / unarchive / delete
    /// by full DTO; tests assert against VM methods directly.
    private func archive(postId: String) {
        // The VM expects the DTO; we already know the id matches a row.
        // Look up via the loaded state.
        if let dto = currentDTO(for: postId) {
            Task { @MainActor in await viewModel.archive(dto) }
        }
    }

    private func restore(postId: String) {
        if let dto = currentDTO(for: postId) {
            Task { @MainActor in await viewModel.unarchive(dto) }
        }
    }

    private func deleteRequest(postId: String) {
        if let dto = currentDTO(for: postId) {
            viewModel.requestDelete(dto)
        }
    }

    /// Scan the VM's loaded state for a DTO matching the kebab target.
    /// Since the kebab target carries enough info on its own (id +
    /// archive state), this can also be omitted — but we keep it because
    /// the archive endpoint will eventually take other DTO fields too
    /// (e.g. archive reason) and the lookup centralises that future hook.
    private func currentDTO(for postId: String) -> MyPostDTO? {
        // We only need an id + archive state to drive the VM today, so
        // synthesise a minimal DTO. When the archive endpoint accepts
        // more fields, this becomes a real lookup.
        MyPostDTO(
            id: postId,
            userId: "",
            createdAt: ""
        )
    }
}

#Preview {
    NavigationStack {
        MyPostsView(viewModel: MyPostsViewModel())
    }
}
