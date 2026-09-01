//
//  FollowingView.swift
//  Pantopus
//
//  §1A① — "Following" (Beacons you follow). A pushed sub-route: back
//  chevron, centred title + count line, a segmented sort control, and the
//  list grouped client-side into New updates · Active · Quiet. Models the
//  My bids screen's view + view-model + service shape; rendered bespoke so
//  every row carries the cross-platform contract identifiers.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

public struct FollowingView: View {
    @State private var viewModel: FollowingViewModel

    public init(viewModel: FollowingViewModel) {
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
        .accessibilityIdentifier("followingScreen")
        .task { await viewModel.load() }
        .sheet(item: $bindable.actionTarget) { target in
            // Read the live target back off the VM so the notification
            // picker re-renders after `setNotificationLevel` lands.
            FollowingActionSheet(
                target: viewModel.actionTarget ?? target,
                onMarkSeen: { Task { await viewModel.markSeen(target) } },
                onMute: { days in Task { await viewModel.mute(target, days: days) } },
                onUnfollow: { Task { await viewModel.unfollow(target) } },
                onNotificationLevel: { level in
                    Task { await viewModel.setNotificationLevel(target, level: level) }
                },
                onCancel: { viewModel.closeActions() }
            )
        }
        .confirmationDialog(
            bindable.pendingBulkUnfollow?.title ?? "Unfollow Beacons?",
            isPresented: Binding(
                get: { bindable.pendingBulkUnfollow != nil },
                set: { if !$0 { viewModel.cancelBulkUnfollow() } }
            ),
            titleVisibility: .visible,
            presenting: bindable.pendingBulkUnfollow
        ) { request in
            Button("Unfollow", role: .destructive) {
                Task { await viewModel.confirmBulkUnfollow(request) }
            }
            .accessibilityIdentifier("followingBulkUnfollow.confirm")
            Button("Cancel", role: .cancel) { viewModel.cancelBulkUnfollow() }
        } message: { request in
            Text(request.message)
        }
        .overlay(alignment: .bottom) { toastOverlay }
    }

    // MARK: - Top bar

    @ViewBuilder private var topBar: some View {
        if viewModel.isSelecting {
            selectionTopBar
        } else {
            defaultTopBar
        }
    }

    /// Multi-select chrome: Cancel · "N selected" · Unfollow.
    /// Mirrors RN `renderHeader`'s select branch
    /// (`pantopus/frontend/apps/mobile/src/app/beacons/following.tsx:280`).
    private var selectionTopBar: some View {
        HStack {
            Button { viewModel.exitSelection() } label: {
                Text("Cancel")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.Color.primary600)
                    .frame(height: 40)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("followingSelect.cancel")
            Spacer()
            Text("\(viewModel.selectedRowIDs.count) selected")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Button { viewModel.requestBulkUnfollow() } label: {
                Text("Unfollow")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(
                        viewModel.selectedRowIDs.isEmpty
                            ? Theme.Color.appTextMuted
                            : Theme.Color.error
                    )
                    .frame(height: 40)
            }
            .buttonStyle(.plain)
            .disabled(viewModel.selectedRowIDs.isEmpty)
            .accessibilityIdentifier("followingSelect.unfollow")
        }
        .frame(height: 54)
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("followingSelectBar")
    }

    private var defaultTopBar: some View {
        ZStack {
            HStack {
                Button { viewModel.back() } label: {
                    Icon(.chevronLeft, size: 25, strokeWidth: 2.2, color: Theme.Color.appText)
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("followingBack")
                Spacer()
            }
            VStack(spacing: 1) {
                Text("Following")
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
        case let .loaded(_, total, unread):
            if total == 0 { return nil }
            if unread > 0 { return "\(total) Beacons \u{00B7} \(unread) with updates" }
            return "\(total) Beacon\(total == 1 ? "" : "s")"
        case .empty:
            return "0 Beacons"
        case .loading, .error:
            return nil
        }
    }

    // MARK: - Content

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            VStack(spacing: 0) {
                sortControl
                loadingList
            }
        case let .loaded(sections, _, _):
            VStack(spacing: 0) {
                sortControl
                loadedList(sections)
            }
        case .empty:
            emptyState
        case let .error(message):
            errorState(message)
        }
    }

    // MARK: - Sort control

    private var sortControl: some View {
        HStack(spacing: 2) {
            ForEach(FollowingSort.allCases) { sort in
                let active = sort == viewModel.selectedSort
                Button { Task { await viewModel.selectSort(sort) } } label: {
                    Text(sort.label)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(active ? Theme.Color.appText : Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .fill(active ? Theme.Color.appSurface : Color.clear)
                                .shadow(color: active ? Color.black.opacity(0.10) : .clear, radius: 1, y: 1)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("followingSort.\(sort.rawValue)")
            }
        }
        .padding(3)
        .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurfaceSunken))
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("followingSortControl")
    }

    // MARK: - Loaded list

    private func loadedList(_ sections: [FollowingSection]) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0, pinnedViews: []) {
                ForEach(sections) { section in
                    sectionHeader(section)
                    rowGroup(section.rows)
                        .padding(.horizontal, Spacing.s3)
                }
            }
            .padding(.bottom, Spacing.s5)
        }
        .refreshable { await viewModel.refresh() }
    }

    private func sectionHeader(_ section: FollowingSection) -> some View {
        HStack(spacing: Spacing.s2) {
            Text(section.header.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(section.isTinted ? Theme.Color.primary600 : Theme.Color.appTextMuted)
            Text("\u{00B7}")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appTextMuted)
            Text("\(section.count)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appTextMuted)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, 18)
        .padding(.bottom, Spacing.s2)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(section.kind.accessibilityID)
    }

    private func rowGroup(_ rows: [FollowingRow]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                if index > 0 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, 70)
                }
                FollowingRowView(
                    row: row,
                    isSelecting: viewModel.isSelecting,
                    isSelected: viewModel.isSelected(row),
                    onTap: {
                        if viewModel.isSelecting {
                            viewModel.toggleSelection(row)
                        } else {
                            viewModel.openPersona(handle: row.handle)
                        }
                    },
                    onLongPress: { viewModel.beginSelection(row) },
                    onBell: { Task { await viewModel.cycleNotificationLevel(row) } },
                    onOverflow: { viewModel.openActions(for: row) }
                )
            }
        }
        .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    // MARK: - Loading

    private var loadingList: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(0..<6, id: \.self) { _ in
                    FollowingSkeletonRow()
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
        .accessibilityIdentifier("followingLoading")
    }

    // MARK: - Empty

    private var emptyState: some View {
        VStack(spacing: Spacing.s3) {
            ZStack {
                Circle().fill(Theme.Color.primary50).frame(width: 76, height: 76)
                Icon(.radioTower, size: 34, strokeWidth: 1.7, color: Theme.Color.primary600)
            }
            Text("You\u{2019}re not following any Beacons yet")
                .font(.system(size: 20, weight: .bold))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appText)
            Text("Follow Beacons \u{2014} verified people, businesses, and civic accounts \u{2014} to get their updates here.")
                .font(.system(size: 13.5))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: 280)
            Button { viewModel.discover() } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.compass, size: 16, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text("Discover Beacons")
                        .font(.system(size: 14.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s6)
                .frame(height: 46)
                .background(Capsule().fill(Theme.Color.primary600))
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.s1)
            .accessibilityIdentifier("followingEmpty.discoverBtn")
        }
        .padding(.horizontal, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appSurfaceMuted)
        .accessibilityIdentifier("followingEmpty")
    }

    // MARK: - Error

    private func errorState(_ message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Icon(.alertCircle, size: 34, color: Theme.Color.appTextMuted)
            Text("Couldn\u{2019}t load who you follow")
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
            .accessibilityIdentifier("followingError.retry")
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appSurfaceMuted)
        .accessibilityIdentifier("followingError")
    }

    // MARK: - Toast

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
                .accessibilityIdentifier("followingToast")
        }
    }
}

// MARK: - Row

struct FollowingRowView: View {
    let row: FollowingRow
    var isSelecting: Bool = false
    var isSelected: Bool = false
    let onTap: @MainActor () -> Void
    var onLongPress: @MainActor () -> Void = {}
    var onBell: @MainActor () -> Void = {}
    let onOverflow: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            if isSelecting {
                selectionTick
            }
            Button(action: onTap) {
                HStack(spacing: Spacing.s3) {
                    FollowingAvatar(
                        initials: row.initials,
                        color: row.tone.color,
                        imageURL: row.avatarURL,
                        verified: row.verified,
                        size: 44,
                        dim: row.isMuted
                    )
                    textColumn
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.35).onEnded { _ in onLongPress() }
            )

            if !isSelecting {
                trailingAccessory
                bellButton
                overflowButton
            }
        }
        .padding(.leading, 14)
        .padding(.trailing, Spacing.s3)
        .padding(.vertical, 11)
        .opacity(row.isMuted || row.isPaused ? 0.62 : 1)
        .background(isSelected ? Theme.Color.primary50 : Color.clear)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("followingRow.\(row.id)")
    }

    private var selectionTick: some View {
        Icon(
            isSelected ? .checkCircle : .circle,
            size: 22,
            color: isSelected ? Theme.Color.primary600 : Theme.Color.appBorderStrong
        )
        .accessibilityLabel(isSelected ? "Selected" : "Not selected")
        .accessibilityIdentifier("followingRow.selectTick")
    }

    /// Inline All / Highlights / Off bell. Tapping cycles the level.
    private var bellButton: some View {
        Button(action: onBell) {
            HStack(spacing: Spacing.s1) {
                Icon(
                    row.notificationLevel.icon,
                    size: 14,
                    color: bellTint
                )
                Text(row.notificationLevel.label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(
                        row.isPaused ? Theme.Color.appTextMuted : Theme.Color.appTextStrong
                    )
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(row.isPaused)
        .accessibilityLabel("Notifications: \(row.notificationLevel.label)")
        .accessibilityIdentifier("followingRow.bell")
    }

    private var bellTint: Color {
        if row.isPaused || row.notificationLevel == .none {
            return Theme.Color.appTextMuted
        }
        return Theme.Color.primary600
    }

    private var textColumn: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 5) {
                Text(row.displayName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                if row.verified {
                    Icon(.badgeCheck, size: 14, color: Theme.Color.primary600)
                }
                if let tier = row.tierName {
                    tierPill(tier)
                }
            }
            Text(row.subtitle)
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                Text(row.bodyText)
                    .pantopusTextStyle(.caption)
                    .italic(row.bodyIsQuiet)
                    .foregroundStyle(row.bodyIsQuiet ? Theme.Color.appTextMuted : Theme.Color.appTextStrong)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let time = row.timeLabel {
                    Text(time)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .padding(.top, 3)
        }
    }

    @ViewBuilder private var trailingAccessory: some View {
        switch row.trailing {
        case let .unread(text):
            Text(text)
                .font(.system(size: 11.5, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(minWidth: 20)
                .padding(.horizontal, 6)
                .frame(height: 20)
                .background(Capsule().fill(Theme.Color.primary600))
                .accessibilityIdentifier("followingRow.unreadBadge")
        case .muted:
            Icon(.bellOff, size: 16, color: Theme.Color.appTextMuted)
        case .chevron:
            // The inline notification bell now owns the trailing rail, so
            // the pure-affordance chevron is dropped to keep the row from
            // stacking three trailing controls.
            EmptyView()
        }
    }

    private var overflowButton: some View {
        Button(action: onOverflow) {
            Icon(.moreHorizontal, size: 18, color: Theme.Color.appTextMuted)
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("More")
        .accessibilityIdentifier("followingRow.overflow")
    }

    private func tierPill(_ name: String) -> some View {
        HStack(spacing: 3) {
            Icon(.star, size: 9, color: Theme.Color.primary700)
            Text(name)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.primary700)
        }
        .padding(.leading, 5)
        .padding(.trailing, 7)
        .padding(.vertical, 1)
        .background(Capsule().fill(Theme.Color.primary100))
        .accessibilityIdentifier("followingRow.tierPill")
    }
}

// MARK: - Avatar

struct FollowingAvatar: View {
    let initials: String
    let color: Color
    let imageURL: URL?
    let verified: Bool
    var size: CGFloat = 44
    var dim: Bool = false

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle().fill(color)
                if let imageURL {
                    AsyncImage(url: imageURL) { image in
                        image.resizable().aspectRatio(contentMode: .fill)
                    } placeholder: {
                        initialsText
                    }
                    .clipShape(Circle())
                } else {
                    initialsText
                }
            }
            .frame(width: size, height: size)
            if verified {
                VerifiedBadge(size: size >= 44 ? 16 : 13, tint: Theme.Color.primary600)
                    .offset(x: 1, y: 1)
            }
        }
        .opacity(dim ? 0.9 : 1)
    }

    private var initialsText: some View {
        Text(initials)
            .font(.system(size: size * 0.34, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextInverse)
    }
}

// MARK: - Skeleton

struct FollowingSkeletonRow: View {
    var body: some View {
        HStack(spacing: Spacing.s3) {
            Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                RoundedRectangle(cornerRadius: Radii.xs).fill(Theme.Color.appSurfaceSunken).frame(width: 140, height: 12)
                RoundedRectangle(cornerRadius: Radii.xs).fill(Theme.Color.appSurfaceSunken).frame(width: 90, height: 10)
                RoundedRectangle(cornerRadius: Radii.xs).fill(Theme.Color.appSurfaceSunken).frame(maxWidth: .infinity).frame(height: 10)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 11)
        .redacted(reason: .placeholder)
    }
}

#if DEBUG
#Preview("Populated") {
    NavigationStack { FollowingView(viewModel: .previewLoaded()) }
}

#Preview("Empty") {
    NavigationStack { FollowingView(viewModel: .previewEmpty()) }
}
#endif
