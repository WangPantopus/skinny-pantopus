//
//  GigSavedSearchesSheet.swift
//  Pantopus
//
//  "Saved searches" manage sheet (P6a), presented from the Gig filter
//  sheet footer. Lists the caller's saved searches with a per-row
//  notify toggle + delete, both optimistic with revert-on-failure.
//  Four states: shimmer rows / designed empty / loaded / error+retry.
//

import SwiftUI

/// Saved-searches manage sheet. Host presents via `.sheet`.
public struct GigSavedSearchesSheet: View {
    @State private var viewModel: GigSavedSearchesViewModel
    @Environment(\.dismiss) private var dismiss

    init(viewModel: GigSavedSearchesViewModel = GigSavedSearchesViewModel()) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            content
        }
        .background(Theme.Color.appSurface)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .task { await viewModel.load() }
        .overlay(alignment: .bottom) { toastOverlay }
        .accessibilityIdentifier("savedSearchesSheet")
    }

    private var header: some View {
        HStack {
            Text("Saved searches")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button {
                dismiss()
            } label: {
                Icon(.x, size: 20, color: Theme.Color.appTextSecondary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("savedSearchesCloseButton")
        }
        .padding(.leading, Spacing.s4)
        .padding(.trailing, Spacing.s2)
        .frame(height: 56)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    // MARK: - States

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading: loadingFrame
        case .empty: emptyFrame
        case let .loaded(rows): listFrame(rows)
        case let .error(message): errorFrame(message)
        }
    }

    /// Shimmer rows mirroring the loaded row geometry.
    private var loadingFrame: some View {
        VStack(spacing: Spacing.s2) {
            ForEach(0..<3, id: \.self) { _ in
                HStack(spacing: Spacing.s3) {
                    VStack(alignment: .leading, spacing: 6) {
                        Shimmer(width: 170, height: 12, cornerRadius: Radii.xs)
                        Shimmer(width: 220, height: 9, cornerRadius: Radii.xs)
                        Shimmer(width: 90, height: 8, cornerRadius: Radii.xs)
                    }
                    Spacer()
                    Shimmer(width: 46, height: 26, cornerRadius: Radii.pill)
                }
                .padding(Spacing.s3)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            Spacer()
        }
        .padding(Spacing.s4)
        .accessibilityIdentifier("savedSearches.loading")
    }

    private var emptyFrame: some View {
        EmptyState(
            icon: .bell,
            headline: "No saved searches yet",
            subcopy: "Save a search from the filters and we'll alert you when a new task matches."
        )
        .accessibilityIdentifier("savedSearches.empty")
    }

    private func listFrame(_ rows: [GigSavedSearchRowContent]) -> some View {
        ScrollView {
            LazyVStack(spacing: Spacing.s2) {
                ForEach(rows) { row in
                    savedSearchRow(row)
                }
            }
            .padding(Spacing.s4)
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("savedSearches.list")
    }

    private func savedSearchRow(_ row: GigSavedSearchRowContent) -> some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            VStack(alignment: .leading, spacing: 3) {
                Text(row.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(row.summary)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
                if let created = row.createdLabel {
                    Text(created)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            Spacer(minLength: Spacing.s2)
            Toggle(
                "",
                isOn: Binding(
                    get: { row.notify },
                    set: { value in Task { await viewModel.setNotify(id: row.id, to: value) } }
                )
            )
            .labelsHidden()
            .tint(Theme.Color.primary600)
            .accessibilityLabel(row.notify ? "Alerts on" : "Alerts off")
            .accessibilityIdentifier("savedSearches.row_\(row.id).notify")
            Button {
                Task { await viewModel.deleteSearch(id: row.id) }
            } label: {
                Icon(.trash2, size: 16, strokeWidth: 2, color: Theme.Color.error)
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Delete saved search")
            .accessibilityIdentifier("savedSearches.row_\(row.id).delete")
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("savedSearches.row_\(row.id)")
    }

    private func errorFrame(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load saved searches")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("savedSearches.retry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("savedSearches.error")
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
                .accessibilityIdentifier("savedSearches.toast")
        }
    }
}

#Preview {
    GigSavedSearchesSheet()
}
