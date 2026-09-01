//
//  YourAudienceView.swift
//  Pantopus
//
//  A22.2 "Your audience" — creator-side member management. Pushed
//  sub-route (back chevron, no tab bar). List-of-Rows-with-pending-section
//  archetype: join requests to approve/decline sit above active members
//  grouped by tier. Sibling of A22.1 Audience (the broadcast hub); member
//  rows reuse the A10.8 membership styling. All four states ship: loading
//  shimmer, populated, full-empty, and error (inline retry).
//

// swiftlint:disable file_length type_body_length

import SwiftUI

public struct YourAudienceView: View {
    @State private var viewModel: YourAudienceViewModel
    private let onBack: @MainActor () -> Void

    init(
        viewModel: YourAudienceViewModel = YourAudienceViewModel(),
        onBack: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    public var body: some View {
        @Bindable var bindable = viewModel
        return VStack(spacing: Spacing.s0) {
            topBar
            if case .loaded = viewModel.state {
                filterChipStrip
            }
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .refreshable { await viewModel.refresh() }
        .sheet(item: $bindable.overflowTarget) { member in
            YourAudienceOverflowSheet(
                member: member,
                onMessage: { viewModel.message(member) },
                onChangeTier: { viewModel.changeTier(member) },
                onMute: { Task { await viewModel.mute(member) } },
                onUnmute: { Task { await viewModel.unmute(member) } },
                onRemove: { Task { await viewModel.remove(member) } },
                onBlock: { viewModel.requestBlock(member) }
            )
            .presentationDetents([.height(460)])
        }
        .alert(
            "Block follower?",
            isPresented: Binding(
                get: { viewModel.blockTarget != nil },
                set: { if !$0 { viewModel.blockTarget = nil } }
            ),
            presenting: viewModel.blockTarget
        ) { member in
            Button("Cancel", role: .cancel) { viewModel.blockTarget = nil }
            Button("Block", role: .destructive) {
                Task { await viewModel.confirmBlock(member) }
            }
            .accessibilityIdentifier("audienceBlockConfirm")
        } message: { member in
            Text(viewModel.blockConfirmationMessage(for: member))
        }
        .overlay(alignment: .bottom) { undoToastOverlay }
        .overlay(alignment: .bottom) { toastOverlay }
        .accessibilityIdentifier("audienceScreen")
    }

    // MARK: - Top bar

    private var topBar: some View {
        ZStack {
            HStack {
                Button(action: onBack) {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("audienceBackButton")
                Spacer()
            }
            HStack {
                Spacer()
                Button {
                    Task { await viewModel.cycleSort() }
                } label: {
                    Icon(.arrowDownUp, size: 20, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Sort: \(viewModel.sort.label)")
                .accessibilityIdentifier("audienceSortButton")
            }
            VStack(spacing: 1) {
                Text("Your audience")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(viewModel.countLine)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    // MARK: - Filter chips

    private var filterChipStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                chip(.all, label: "All", count: nil, id: "audienceChip.all")
                chip(.pending, label: "Pending", count: viewModel.counts.pending, id: "audienceChip.pending")
                ForEach(viewModel.tierChips) { tierChip in
                    chip(
                        .tier(rank: tierChip.rank),
                        label: tierChip.name,
                        count: tierChip.count,
                        id: "audienceChip.tier\(tierChip.rank)"
                    )
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("audienceFilterChips")
    }

    private func chip(_ chipFilter: AudienceFilter, label: String, count: Int?, id: String) -> some View {
        let isSelected = viewModel.filter == chipFilter
        return Button {
            Task { await viewModel.select(filter: chipFilter) }
        } label: {
            HStack(spacing: Spacing.s1) {
                Text(label)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(isSelected ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                if let count {
                    Text("· \(count)")
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(isSelected ? Theme.Color.appTextInverse.opacity(0.85) : Theme.Color.appTextMuted)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 30)
            .background(isSelected ? Theme.Color.primary600 : Theme.Color.appSurface)
            .clipShape(Capsule())
            .overlay {
                if !isSelected {
                    Capsule().stroke(Theme.Color.appBorder, lineWidth: 1)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
        .accessibilityAddTraits(.isButton)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: - Content states

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading: loadingFrame
        case let .loaded(loaded): loadedFrame(loaded)
        case .empty: emptyFrame
        case let .error(message): errorFrame(message)
        }
    }

    private var loadingFrame: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(0..<2, id: \.self) { _ in
                    Shimmer(height: 12, cornerRadius: Radii.xs)
                        .frame(width: 130)
                        .padding(.leading, Spacing.s5)
                        .padding(.top, Spacing.s4)
                    Shimmer(height: 132, cornerRadius: Radii.xl)
                        .padding(.horizontal, Spacing.s3)
                }
            }
            .padding(.top, Spacing.s2)
        }
        .accessibilityIdentifier("audienceLoading")
    }

    private func loadedFrame(_ loaded: AudienceLoaded) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s0) {
                if viewModel.filter.showsPendingSection {
                    pendingSection(loaded.pending)
                    if case .pending = viewModel.filter {
                        helperText
                    }
                }
                if viewModel.filter.showsTierGroups {
                    ForEach(loaded.tierGroups) { group in
                        tierSection(group)
                    }
                }
                // Bottom sentinel — inside the LazyVStack it is only composed
                // once the user reaches the end of the list, which is exactly
                // RN's `onEndReached`.
                if viewModel.hasMore {
                    Color.clear
                        .frame(height: 1)
                        .task { await viewModel.loadMore() }
                }
                if viewModel.isLoadingMore {
                    loadMoreFooter
                }
                Spacer(minLength: Spacing.s6)
            }
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s4)
        }
    }

    /// Next-page indicator. RN renders the same footer under its
    /// `onEndReached` loader (`src/app/audience/members.tsx:320-326`).
    private var loadMoreFooter: some View {
        HStack(spacing: Spacing.s2) {
            Shimmer(height: 12, cornerRadius: Radii.xs).frame(width: 90)
            Text("Loading more…")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s4)
        .accessibilityIdentifier("audienceLoadingMore")
    }

    // MARK: - Pending section

    @ViewBuilder private func pendingSection(_ pending: [AudienceMember]) -> some View {
        sectionHeader(label: "Pending requests", count: viewModel.counts.pending, tint: Theme.Color.warning)
            .accessibilityIdentifier("audienceSection.pending")
        if pending.isEmpty {
            inlineNoPending
        } else {
            groupCard {
                ForEach(Array(pending.enumerated()), id: \.element.id) { index, member in
                    if index > 0 { rowDivider }
                    pendingRow(member)
                }
            }
        }
    }

    private func pendingRow(_ member: AudienceMember) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                memberAvatar(member)
                VStack(alignment: .leading, spacing: 1) {
                    nameLine(member)
                    Text(member.handle)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                    HStack(spacing: Spacing.s2) {
                        tierPill(rank: member.tierRank, name: member.tierName)
                        Text(AudienceFormat.requestedLabel(month: member.joinedMonth, tenureMonths: member.tenureMonths))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    .padding(.top, 2)
                }
                Spacer(minLength: 0)
            }
            HStack(spacing: Spacing.s2) {
                Spacer(minLength: 0)
                Button {
                    Task { await viewModel.decline(member) }
                } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.x, size: 14, strokeWidth: 2.6, color: Theme.Color.appTextStrong)
                        Text("Decline")
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .frame(height: 32)
                    .overlay(Capsule().stroke(Theme.Color.appBorderStrong, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("audiencePending.decline")

                Button {
                    Task { await viewModel.approve(member) }
                } label: {
                    HStack(spacing: Spacing.s1) {
                        Icon(.check, size: 14, strokeWidth: 3, color: Theme.Color.appTextInverse)
                        Text("Approve")
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .frame(height: 32)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("audiencePending.approve")
            }
        }
        .padding(Spacing.s3)
        .accessibilityIdentifier("audienceRow.\(member.membershipId)")
    }

    private var inlineNoPending: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.inbox, size: 16, color: Theme.Color.appTextMuted)
            Text("No pending requests")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s4)
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        )
        .padding(.horizontal, Spacing.s3)
        .accessibilityIdentifier("audienceNoPending")
    }

    private var helperText: some View {
        Text("Approve to add someone to their requested tier. Declining is silent — they aren't notified.")
            .font(.system(size: 12))
            .foregroundStyle(Theme.Color.appTextMuted)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Spacing.s5)
            .padding(.top, Spacing.s4)
    }

    // MARK: - Tier section

    @ViewBuilder private func tierSection(_ group: AudienceTierGroup) -> some View {
        sectionHeader(label: group.name, count: group.members.count, tint: AudienceTierStyle.color(rank: group.rank))
            .accessibilityIdentifier("audienceSection.tier\(group.rank)")
        groupCard {
            ForEach(Array(group.members.enumerated()), id: \.element.id) { index, member in
                if index > 0 { rowDivider }
                memberRow(member)
            }
        }
    }

    private func memberRow(_ member: AudienceMember) -> some View {
        HStack(alignment: .center, spacing: Spacing.s3) {
            memberAvatar(member)
            VStack(alignment: .leading, spacing: 1) {
                nameLine(member)
                Text(member.handle)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
                if let since = AudienceFormat.memberSinceLabel(month: member.joinedMonth) {
                    Text(since)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.top, 2)
                }
            }
            Spacer(minLength: 0)
            if member.isMuted {
                Icon(.bellOff, size: 16, color: Theme.Color.appTextMuted)
                    .accessibilityLabel("Muted")
            }
            Button {
                viewModel.overflowTarget = member
            } label: {
                Icon(.moreHorizontal, size: 18, color: Theme.Color.appTextMuted)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("More options for \(member.displayName)")
            .accessibilityIdentifier("audienceRow.overflow")
        }
        .padding(.vertical, Spacing.s3)
        .padding(.horizontal, Spacing.s3)
        .accessibilityIdentifier("audienceRow.\(member.membershipId)")
    }

    // MARK: - Shared row pieces

    private func nameLine(_ member: AudienceMember) -> some View {
        HStack(spacing: Spacing.s1) {
            Text(member.displayName)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
            if member.verifiedLocal {
                localBadge
            }
        }
    }

    private var localBadge: some View {
        HStack(spacing: 2) {
            Icon(.mapPin, size: 9, strokeWidth: 2.6, color: Theme.Color.success)
            Text("Local")
                .font(.system(size: 9.5, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s1)
        .padding(.vertical, 1)
        .background(Theme.Color.successLight)
        .clipShape(Capsule())
        .accessibilityIdentifier("audienceRow.localBadge")
    }

    private func tierPill(rank: Int, name: String) -> some View {
        HStack(spacing: 3) {
            Icon(AudienceTierStyle.icon(rank: rank), size: 9, strokeWidth: 2.5, color: AudienceTierStyle.color(rank: rank))
            Text(name)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(AudienceTierStyle.color(rank: rank))
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 2)
        .background(AudienceTierStyle.background(rank: rank))
        .clipShape(Capsule())
    }

    private func sectionHeader(label: String, count: Int, tint: Color) -> some View {
        HStack(spacing: Spacing.s2) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(tint)
                .lineLimit(1)
            Text("·")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appTextMuted)
            Text("\(count)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appTextMuted)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s5)
        .padding(.bottom, Spacing.s2)
    }

    private func groupCard(@ViewBuilder content: () -> some View) -> some View {
        VStack(spacing: Spacing.s0) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .padding(.horizontal, Spacing.s3)
    }

    private var rowDivider: some View {
        Rectangle()
            .fill(Theme.Color.appBorderSubtle)
            .frame(height: 1)
            .padding(.leading, 44 + Spacing.s3 + Spacing.s3)
    }

    private func memberAvatar(_ member: AudienceMember, size: CGFloat = 44) -> some View {
        let palette: [Color] = [
            Theme.Color.primary600,
            Theme.Color.business,
            Theme.Color.success,
            Theme.Color.warning
        ]
        let tint = palette[audienceStableIndex(member.handle, count: palette.count)]
        return ZStack {
            if let url = member.avatarURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case let .success(image):
                        image.resizable().scaledToFill()
                    default:
                        avatarMonogram(member, tint: tint, size: size)
                    }
                }
            } else {
                avatarMonogram(member, tint: tint, size: size)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private func avatarMonogram(_ member: AudienceMember, tint: Color, size: CGFloat) -> some View {
        ZStack {
            tint
            Text(audienceInitials(member.displayName))
                .font(.system(size: size >= 44 ? 16 : 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
    }

    // MARK: - Empty / error

    private var emptyFrame: some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle().fill(Theme.Color.primary50).frame(width: 76, height: 76)
                Icon(.usersRound, size: 33, color: Theme.Color.primary600)
            }
            Text("No audience yet")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text("When people follow your Beacon, they'll appear here — and join requests land at the top to approve.")
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button {
                viewModel.toast = "Sharing your Beacon is coming soon."
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.share, size: 16, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text("Share your Beacon")
                        .font(.system(size: 14.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s6)
                .frame(height: 46)
                .background(Theme.Color.primary600)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("audienceShareBeacon")

            HStack(spacing: Spacing.s2) {
                Icon(.megaphone, size: 13, color: Theme.Color.primary600)
                Text("Post a broadcast to get discovered nearby")
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(RoundedRectangle(cornerRadius: Radii.md).stroke(Theme.Color.appBorder, lineWidth: 1))
            .padding(.top, Spacing.s5)
        }
        .padding(.horizontal, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("audienceEmpty")
    }

    private func errorFrame(_ message: String) -> some View {
        VStack(spacing: Spacing.s4) {
            ZStack {
                Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 72, height: 72)
                Icon(.usersRound, size: 32, color: Theme.Color.appTextMuted)
            }
            Text("Couldn't load your audience")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            PrimaryButton(title: "Retry") { await viewModel.refresh() }
                .frame(maxWidth: 200)
        }
        .padding(.horizontal, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("audienceError")
    }

    // MARK: - Toast

    /// Destructive-action undo toast. The row is already gone; tapping the
    /// toast puts it back and cancels the pending `PATCH`. The view-model
    /// owns the 5-second window, so this overlay simply mirrors it.
    @ViewBuilder private var undoToastOverlay: some View {
        if let pending = viewModel.pendingUndo {
            Button {
                viewModel.undoPendingAction()
            } label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.undo2, size: 15, color: Theme.Color.appTextInverse)
                    Text(pending.message)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s3)
                .background(Theme.Color.appText)
                .clipShape(Capsule())
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .padding(.bottom, Spacing.s8)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityIdentifier("audienceUndoToast")
        }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast, viewModel.pendingUndo == nil {
            Text(toast)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s3)
                .background(Theme.Color.appText)
                .clipShape(Capsule())
                .padding(.bottom, Spacing.s8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
                .accessibilityIdentifier("audienceToast")
        }
    }
}

// MARK: - Avatar helpers

/// Up to two uppercased initials from a display name.
private func audienceInitials(_ name: String) -> String {
    let letters = name
        .split(separator: " ")
        .prefix(2)
        .compactMap { $0.first.map(String.init) }
        .joined()
    return letters.isEmpty ? "?" : letters.uppercased()
}

/// Deterministic palette index from a seed string. Avoids `String.hashValue`
/// (per-launch randomized) so the same handle always gets the same tint.
private func audienceStableIndex(_ seed: String, count: Int) -> Int {
    guard count > 0 else { return 0 }
    var sum = 0
    for scalar in seed.unicodeScalars {
        sum = (sum &+ Int(scalar.value)) % count
    }
    return sum
}

#if DEBUG
#Preview("Populated") {
    YourAudienceView(viewModel: YourAudienceSampleData.populatedViewModel())
}

#Preview("Empty") {
    YourAudienceView(viewModel: YourAudienceSampleData.emptyViewModel())
}
#endif
