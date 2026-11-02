//
//  AssistantMemoryView.swift
//  Pantopus
//
//  Settings → What Pantopus remembers
//  (`docs/product/ai-assistant-phase3-contract-2026-10-22.md` §5.7), in the
//  Settings list style (Security & devices): the header line, the yearly
//  "Still right?" line, one row per item with its caption, Edit and Delete by
//  swipe, and Forget everything at the bottom. Loading, empty, loaded and
//  error states. Reached from the Privacy group and `pantopus://settings/memory`.
//

import SwiftUI

struct AssistantMemoryView: View {
    @State private var viewModel: AssistantMemoryViewModel
    private let onBack: @MainActor () -> Void

    init(viewModel: AssistantMemoryViewModel = AssistantMemoryViewModel(), onBack: @escaping @MainActor () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            SettingsTopBar(title: "What Pantopus remembers", onBack: onBack)
            content
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s6)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .accessibilityIdentifier("memory.toast")
                    .dismissToast(after: toast) { viewModel.toast = nil }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: viewModel.toast)
        .alert(viewModel.forgetAllTitle, isPresented: $viewModel.isForgetAllConfirmPresented) {
            Button("Cancel", role: .cancel) {}
            Button("Forget everything", role: .destructive) {
                Task { await viewModel.forgetAll() }
            }
        } message: {
            Text("This can\u{2019}t be undone.")
        }
        .sheet(item: $viewModel.editing) { row in
            AssistantMemoryEditor(row: row) { fact in
                await viewModel.save(row, fact: fact)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("memory.screen")
    }

    // MARK: - States

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            skeleton
        case let .error(message):
            ScrollView {
                ErrorState(headline: "Couldn\u{2019}t load what Pantopus remembers", message: message) {
                    await viewModel.load()
                }
                .padding(.horizontal, Spacing.s5)
                .padding(.top, Spacing.s16)
            }
            .accessibilityIdentifier("memory.error")
        case .empty:
            ScrollView {
                VStack(spacing: Spacing.s4) {
                    header
                    EmptyState(
                        icon: .bookmark,
                        headline: "Nothing yet",
                        subcopy: "Ask Pantopus to remember something, like your furnace filter size."
                    )
                    .accessibilityIdentifier("memory.empty")
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
            }
            .refreshable { [weak viewModel] in await viewModel?.refresh() }
        case .loaded:
            list
        }
    }

    private var skeleton: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 12, cornerRadius: Radii.xs)
                    .frame(maxWidth: 260)
                ForEach(0..<4, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Shimmer(height: 14, cornerRadius: Radii.xs)
                        Shimmer(width: 180, height: 10, cornerRadius: Radii.xs)
                    }
                    .padding(Spacing.s3)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("memory.loading")
    }

    private var header: some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            Icon(.lock, size: 14, color: Theme.Color.appTextSecondary)
                .padding(.top, 2)
                .accessibilityHidden(true)
            Text(AssistantMemoryViewModel.headerLine)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("memory.header")
    }

    // MARK: - Loaded

    private var list: some View {
        List {
            Section {
                header
                    .listRowBackground(Theme.Color.appBg)
                    .listRowInsets(EdgeInsets(top: Spacing.s2, leading: Spacing.s1, bottom: Spacing.s1, trailing: Spacing.s1))
                    .listRowSeparator(.hidden)
            }
            // Its own section, so the card gets all four rounded corners (the header row above has none).
            if viewModel.reviewDue {
                Section {
                    reviewLine
                        .listRowBackground(Theme.Color.appSurface)
                }
            }
            Section {
                ForEach(viewModel.rows) { row in
                    MemoryRow(row: row, isBusy: viewModel.busyIds.contains(row.id))
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                Task { await viewModel.delete(row) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                            .accessibilityIdentifier("memory.delete")
                            if row.editable {
                                Button {
                                    viewModel.editing = row
                                } label: {
                                    Label("Edit", systemImage: "pencil")
                                }
                                .tint(Theme.Color.primary600)
                                .accessibilityIdentifier("memory.edit")
                            }
                        }
                }
            } header: {
                Text("\(viewModel.rows.count) saved", style: .overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityAddTraits(.isHeader)
            } footer: {
                Text("Swipe left on one to edit or delete it.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Section {
                Button {
                    viewModel.isForgetAllConfirmPresented = true
                } label: {
                    HStack(spacing: Spacing.s3) {
                        Text("Forget everything")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Theme.Color.error)
                        Spacer(minLength: Spacing.s2)
                        if viewModel.isForgettingAll {
                            ProgressView().controlSize(.small)
                        }
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(viewModel.isForgettingAll)
                .accessibilityIdentifier("memory.forgetAll")
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.Color.appBg)
        .refreshable { [weak viewModel] in await viewModel?.refresh() }
        .accessibilityIdentifier("memory.list")
    }

    /// "It's been a year. Still right?" with Looks right (§5.5).
    private var reviewLine: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.history, size: 16, color: Theme.Color.primaryInk)
                    .padding(.top, 2)
                    .accessibilityHidden(true)
                Text("It\u{2019}s been a year. Still right?")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            CompactButton(title: viewModel.isConfirmingReview ? "Saving\u{2026}" : "Looks right", icon: .check) {
                Task { await viewModel.confirmReview() }
            }
            .disabled(viewModel.isConfirmingReview)
            .accessibilityIdentifier("memory.lookRight")
        }
        .padding(.vertical, Spacing.s1)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("memory.review")
    }
}

/// One remembered item: its words, its caption and, when its home was left, why it isn't used.
private struct MemoryRow: View {
    let row: AssistantMemoryViewModel.Row
    let isBusy: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text(row.fact)
                    .pantopusTextStyle(.small)
                    .foregroundStyle(row.notInUse ? Theme.Color.appTextSecondary : Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                Text(row.caption)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if row.notInUse {
                    Text(AssistantMemoryViewModel.notInUseLine)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.warning)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Spacing.s0)
            if isBusy {
                ProgressView().controlSize(.small)
            }
        }
        .padding(.vertical, Spacing.s1)
        .opacity(isBusy ? 0.6 : 1)
        .accessibilityElement(children: .combine)
        .accessibilityHint(row.editable ? "Swipe up or down for Edit and Delete." : "Swipe up or down for Delete.")
        .accessibilityIdentifier("memory.row")
    }
}

/// The one-field editor for a fact's words.
private struct AssistantMemoryEditor: View {
    let row: AssistantMemoryViewModel.Row
    let onSave: (String) async -> String?
    @Environment(\.dismiss) private var dismiss
    @State private var text: String
    @State private var error: String?
    @State private var isSaving = false
    @FocusState private var focused: Bool

    init(row: AssistantMemoryViewModel.Row, onSave: @escaping (String) async -> String?) {
        self.row = row
        self.onSave = onSave
        _text = State(initialValue: row.fact)
    }

    private var trimmed: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSave: Bool {
        !isSaving && trimmed.count >= 3 && trimmed.count <= 280 && trimmed != row.fact
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    TextField("What Pantopus should remember", text: $text, axis: .vertical)
                        .lineLimit(3...8)
                        .font(Theme.Font.role(.body))
                        .foregroundStyle(Theme.Color.appText)
                        .padding(Spacing.s3)
                        .background(Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(error == nil ? Theme.Color.appBorder : Theme.Color.error, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .focused($focused)
                        .accessibilityIdentifier("memory.editor.field")
                    HStack(alignment: .top) {
                        if let error {
                            Text(error)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.error)
                                .fixedSize(horizontal: false, vertical: true)
                                .accessibilityIdentifier("memory.editor.error")
                        }
                        Spacer(minLength: Spacing.s2)
                        Text("\(trimmed.count)/280")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(trimmed.count > 280 ? Theme.Color.error : Theme.Color.appTextMuted)
                    }
                    Text(AssistantMemoryViewModel.headerLine)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(Spacing.s4)
            }
            .background(Theme.Color.appBg)
            .navigationTitle("Edit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("memory.editor.cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving\u{2026}" : "Save") {
                        Task { await save() }
                    }
                    .disabled(!canSave)
                    .accessibilityIdentifier("memory.editor.save")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear { focused = true }
        .onChange(of: text) { _, _ in error = nil }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        if let message = await onSave(trimmed) {
            error = message
        } else {
            dismiss()
        }
    }
}
