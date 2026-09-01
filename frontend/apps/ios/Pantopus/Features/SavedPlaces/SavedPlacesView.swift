//
//  SavedPlacesView.swift
//  Pantopus
//
//  BLOCK 2E — "Saved places" (places you bookmark from Explore). A pushed
//  sub-route modelled on the Following screen: back chevron, centred title +
//  count line, an optional All · Home · Work · Saved filter-chip row, and the
//  list of saved-place rows. Each row taps through to the place on the map,
//  exposes an overflow action sheet (Open on map / Share place / Remove), and
//  — on iOS — a swipe-to-reveal Open / Remove shortcut. Removal is optimistic
//  and offers an Undo snackbar.
//

import SwiftUI

public struct SavedPlacesView: View {
    @State private var viewModel: SavedPlacesViewModel

    public init(viewModel: SavedPlacesViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        @Bindable var bindable = viewModel
        return VStack(spacing: 0) {
            topBar
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.Color.appSurfaceMuted)
        .navigationBarHidden(true)
        .accessibilityIdentifier("savedPlaces.screen")
        .task { await viewModel.load() }
        .sheet(item: $bindable.actionTarget) { target in
            SavedPlacesActionSheet(
                target: target,
                onOpenMap: { viewModel.openMap(target) },
                onRemove: { Task { await viewModel.remove(target) } },
                onCancel: { viewModel.closeActions() }
            )
        }
        .overlay(alignment: .bottom) { undoOverlay }
        .overlay(alignment: .bottom) { toastOverlay }
    }

    // MARK: - Top bar

    private var topBar: some View {
        ZStack {
            HStack {
                Button { viewModel.back() } label: {
                    Icon(.chevronLeft, size: 25, strokeWidth: 2.2, color: Theme.Color.appText)
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("savedPlaces.back")
                Spacer()
            }
            VStack(spacing: 1) {
                Text("Saved places")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let line = countLine {
                    Text(line)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
        }
        .frame(height: 54)
        .padding(.horizontal, Spacing.s2)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private var countLine: String? {
        switch viewModel.state {
        case let .loaded(_, _, total):
            "\(total) place\(total == 1 ? "" : "s")"
        case .empty:
            nil
        case .loading, .error:
            nil
        }
    }

    // MARK: - Content

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingList
        case let .loaded(rows, filters, _):
            VStack(spacing: 0) {
                if filters.count > 2 {
                    filterChips(filters)
                }
                loadedList(rows)
            }
        case .empty:
            emptyState
        case let .error(message):
            errorState(message)
        }
    }

    // MARK: - Filter chips

    private func filterChips(_ filters: [SavedPlaceFilter]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(filters) { filter in
                    let active = filter == viewModel.selectedFilter
                    Button { viewModel.selectFilter(filter) } label: {
                        Text(filter.label)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                            .padding(.horizontal, Spacing.s4)
                            .frame(height: 32)
                            .background(
                                Capsule().fill(active ? Theme.Color.primary600 : Theme.Color.appSurface)
                            )
                            .overlay(
                                Capsule().stroke(
                                    active ? Color.clear : Theme.Color.appBorder,
                                    lineWidth: 1
                                )
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier(filter.accessibilityID)
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("savedPlaces.filterChips")
    }

    // MARK: - Loaded list

    private func loadedList(_ rows: [SavedPlaceRow]) -> some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    if index > 0 {
                        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, 70)
                    }
                    SavedPlaceRowView(
                        row: row,
                        onTap: { viewModel.openMap(row.actionTarget) },
                        onOverflow: { viewModel.openActions(for: row) },
                        onSwipeOpen: { viewModel.openMap(row.actionTarget) },
                        onSwipeRemove: { Task { await viewModel.remove(row.actionTarget) } }
                    )
                }
            }
            .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s5)
        }
        .refreshable { await viewModel.refresh() }
    }

    // MARK: - Loading

    private var loadingList: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(0..<6, id: \.self) { _ in
                    SavedPlaceSkeletonRow()
                }
            }
            .padding(Spacing.s3)
            .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .padding(Spacing.s3)
        }
        .disabled(true)
        .accessibilityIdentifier("savedPlaces.loading")
    }

    // MARK: - Empty

    private var emptyState: some View {
        VStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.primary50).frame(width: 76, height: 76)
                Icon(.bookmark, size: 32, strokeWidth: 1.7, color: Theme.Color.primary600)
            }
            Text("No saved places yet")
                .font(.system(size: 20, weight: .bold))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appText)
            Text("Save spots you visit often from Explore \u{2014} your home, your go-to coffee shop, the park down the block.")
                .font(.system(size: 13.5))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: 280)
            Button { viewModel.explore() } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.compass, size: 16, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text("Explore nearby")
                        .font(.system(size: 14.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s6)
                .frame(height: 46)
                .background(Capsule().fill(Theme.Color.primary600))
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.s1)
            .accessibilityIdentifier("savedPlaces.exploreNearbyBtn")
        }
        .padding(.horizontal, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appSurfaceMuted)
        .accessibilityIdentifier("savedPlaces.empty")
    }

    // MARK: - Error

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.alertCircle, size: 34, color: Theme.Color.appTextMuted)
            Text("Couldn\u{2019}t load your saved places")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 13.5))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: 280)
            Button { Task { await viewModel.refresh() } } label: {
                Text("Retry")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 44)
                    .background(Capsule().fill(Theme.Color.primary600))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("savedPlaces.error.retry")
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appSurfaceMuted)
        .accessibilityIdentifier("savedPlaces.error")
    }

    // MARK: - Undo snackbar

    @ViewBuilder private var undoOverlay: some View {
        if let undo = viewModel.undo {
            HStack(spacing: Spacing.s3) {
                Icon(.checkCircle, size: 18, color: Theme.Color.appTextInverse)
                Text("Removed \u{201C}\(undo.dto.label)\u{201D}")
                    .font(.system(size: 13.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .lineLimit(1)
                Spacer(minLength: Spacing.s2)
                Button { Task { await viewModel.undoRemove() } } label: {
                    Text("Undo")
                        .font(.system(size: 13.5, weight: .bold))
                        .foregroundStyle(Theme.Color.primary300)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("savedPlaces.undoSnackbar.undo")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .background(Capsule().fill(Theme.Color.appText.opacity(0.95)))
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s8)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .task(id: undo) {
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                viewModel.dismissUndo()
            }
            .accessibilityIdentifier("savedPlaces.undoSnackbar")
        }
    }

    // MARK: - Toast

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s12)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
                .accessibilityIdentifier("savedPlaces.toast")
        }
    }
}
