//
//  MeView.swift
//  Pantopus
//
//  Designed Me tab — one chrome, three identity bindings. Hosts the
//  identity-switcher pill row (top of the gradient header), the
//  72pt verification-ring avatar + name + tagline, the 3-tile stats
//  card, the 2×3 action grid, the section groups, and the
//  destructive card at the bottom. T6.2b re-skin.
//

// swiftlint:disable file_length

import SwiftUI

/// Render-only Me tab.
public struct MeView: View {
    @State private var viewModel: MeViewModel
    /// Share sheet for the Monthly Receipt / invite CTAs.
    @State private var systemSheet: SystemSheetRequest?
    private let onAction: @MainActor (MeActionTile) -> Void
    private let onSection: @MainActor (MeSectionRow) -> Void
    private let onLogOut: @MainActor () -> Void

    init(
        viewModel: MeViewModel? = nil,
        expandMonthlyReceipt: Bool = false,
        onAction: @escaping @MainActor (MeActionTile) -> Void = { _ in },
        onSection: @escaping @MainActor (MeSectionRow) -> Void = { _ in },
        onLogOut: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(
            initialValue: viewModel ?? MeViewModel(expandMonthlyReceipt: expandMonthlyReceipt)
        )
        self.onAction = onAction
        self.onSection = onSection
        self.onLogOut = onLogOut
    }

    public var body: some View {
        content
            .background(Theme.Color.appBg)
            .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
            .sheet(item: $systemSheet) { request in request.makeView() }
            .task { await viewModel.load() }
            .overlay(alignment: .bottom) {
                if let toast = viewModel.toastMessage {
                    ToastView(message: ToastMessage(text: toast, kind: .neutral))
                        .padding(.bottom, Spacing.s10)
                        .task(id: toast) {
                            try? await Task.sleep(nanoseconds: 2_000_000_000)
                            viewModel.toastMessage = nil
                        }
                }
            }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingFrame
        case let .loaded(personal, home, business):
            let active = current(personal: personal, home: home, business: business)
            populatedFrame(active)
        case let .error(message):
            errorFrame(message: message)
        }
    }

    private func current(personal: MeIdentityContent, home: MeIdentityContent, business: MeIdentityContent)
        -> MeIdentityContent {
        switch viewModel.activeIdentity {
        case .personal: personal
        case .home: home
        case .business: business
        }
    }

    // MARK: - Frames

    private var loadingFrame: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Shimmer(height: 200, cornerRadius: Radii.lg)
                    .padding(.horizontal, Spacing.s4)
                Shimmer(height: 70, cornerRadius: Radii.lg)
                    .padding(.horizontal, Spacing.s4)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 3), spacing: Spacing.s2) {
                    ForEach(0..<6, id: \.self) { _ in
                        Shimmer(height: 72, cornerRadius: Radii.md)
                    }
                }
                .padding(.horizontal, Spacing.s4)
                Shimmer(height: 140, cornerRadius: Radii.md)
                    .padding(.horizontal, Spacing.s4)
            }
            .padding(.top, Spacing.s4)
        }
        .accessibilityIdentifier("meLoading")
    }

    private func populatedFrame(_ active: MeIdentityContent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                MeHeader(
                    content: active
                ) { viewModel.selectIdentity($0) }
                if !active.isUnbound {
                    MeStatsRow(stats: active.stats)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s3)
                }
                MeActionGrid(
                    tiles: active.actionTiles,
                    accent: active.identity.accent,
                    isUnbound: active.isUnbound,
                    onTap: onAction
                )
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
                // Personal-only profile insight cards (RN parity — the
                // `(tabs)/profile` screen renders both under the stats row).
                if active.identity == .personal {
                    if let receipt = viewModel.monthlyReceipt {
                        MonthlyReceiptCard(
                            receipt: receipt,
                            startExpanded: viewModel.expandMonthlyReceipt
                        ) {
                            if let message = viewModel.receiptShareMessage {
                                systemSheet = .share(items: [message])
                            }
                        }
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s4)
                    }
                    if let progress = viewModel.inviteProgress {
                        InviteProgressCard(
                            progress: progress
                        ) { systemSheet = .share(items: [viewModel.inviteShareMessage]) }
                            .padding(.horizontal, Spacing.s4)
                            .padding(.top, Spacing.s4)
                    }
                }
                ForEach(active.sections) { section in
                    MeSectionGroup(section: section, onTap: onSection)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s4)
                }
                MeDestructiveCard(
                    identity: active.identity,
                    onAction: handleDestructive
                )
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s5)
            }
        }
        .refreshable { await viewModel.refresh() }
        .accessibilityIdentifier("meScreen")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load this tab")
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
            .accessibilityIdentifier("meRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("meError")
    }

    private func handleDestructive() {
        switch viewModel.activeIdentity {
        case .personal: onLogOut()
        case .home, .business: viewModel.selectIdentity(.personal)
        }
    }
}

// MARK: - Header

private struct MeHeader: View {
    let content: MeIdentityContent
    let onSwitch: @MainActor (MeIdentity) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            identityPillRow
            HStack(alignment: .center, spacing: 14) {
                avatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(content.displayName)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .lineLimit(1)
                    Text(content.handle)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextInverse.opacity(0.85))
                        .lineLimit(1)
                    if let locality = content.locality, !locality.isEmpty {
                        HStack(spacing: Spacing.s1) {
                            Icon(.mapPin, size: 11, color: Theme.Color.appTextInverse.opacity(0.85))
                            Text(locality)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Theme.Color.appTextInverse.opacity(0.85))
                                .lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: Spacing.s0)
            }
            if let tagline = content.tagline, !tagline.isEmpty {
                Text(tagline)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextInverse.opacity(0.9))
                    .lineLimit(2)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: content.identity.headerGradient,
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .accessibilityIdentifier("meHeader_\(content.identity.rawValue)")
    }

    /// 72pt avatar with the verification ring + 22pt verified badge.
    /// Ring colour stays white-on-gradient so it reads as an outline
    /// against the identity-tinted header card.
    private var avatar: some View {
        ZStack(alignment: .topTrailing) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [content.identity.accent, content.identity.accent.opacity(0.8)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                Text(content.initials)
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(width: 72, height: 72)
            .overlay(
                Circle().stroke(Theme.Color.appSurface, lineWidth: 3)
            )
            .shadow(color: Theme.Color.appText.opacity(0.18), radius: 6, x: 0, y: 4)
            if content.verified {
                Icon(.check, size: 11, strokeWidth: 3.5, color: Theme.Color.primary600)
                    .frame(width: 22, height: 22)
                    .background(Theme.Color.appSurface)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(content.identity.accent, lineWidth: 2))
                    .offset(x: 2, y: -2)
                    .accessibilityLabel("Verified")
                    .accessibilityIdentifier("meVerificationBadge")
            }
        }
        .frame(width: 76, height: 76)
    }

    private var identityPillRow: some View {
        IdentitySwitcherPillRow(
            options: MeIdentity.allCases.map { identity in
                IdentityOption(
                    id: identity.rawValue,
                    label: identity.label,
                    icon: identity.icon,
                    accent: identity.accent
                )
            },
            activeId: content.identity.rawValue,
            identifierPrefix: "meIdentityPill"
        ) { rawValue in
            if let identity = MeIdentity(rawValue: rawValue) {
                onSwitch(identity)
            }
        }
    }
}

// MARK: - Stats row

private struct MeStatsRow: View {
    let stats: [MeStat]

    var body: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(stats.enumerated()), id: \.element.id) { index, stat in
                VStack(spacing: 2) {
                    Text(stat.value)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(stat.label.uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.4)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.s3)
                if index < stats.count - 1 {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(width: 1)
                        .padding(.vertical, 10)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("meStatsRow")
    }
}

// MARK: - Action grid

private struct MeActionGrid: View {
    let tiles: [MeActionTile]
    let accent: Color
    let isUnbound: Bool
    let onTap: @MainActor (MeActionTile) -> Void

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 3), spacing: Spacing.s2) {
            ForEach(tiles) { tile in
                Button { onTap(tile) } label: {
                    ZStack(alignment: .topTrailing) {
                        VStack(spacing: 6) {
                            Icon(tile.icon, size: 20, color: isUnbound ? Theme.Color.appTextMuted : accent)
                            Text(tile.label)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(isUnbound ? Theme.Color.appTextMuted : Theme.Color.appText)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 72)
                        if let badge = tile.badge, !isUnbound {
                            Text("\(badge)")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Theme.Color.appTextInverse)
                                .padding(.horizontal, 5)
                                .frame(minWidth: 16, minHeight: 16)
                                .background(Theme.Color.primary600)
                                .clipShape(Capsule())
                                .padding(6)
                                .accessibilityLabel("\(badge) unread")
                        }
                    }
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(isUnbound)
                .accessibilityIdentifier("meActionTile_\(tile.id)")
            }
        }
    }
}

// MARK: - Section group

private struct MeSectionGroup: View {
    let section: MeSection
    let onTap: @MainActor (MeSectionRow) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(section.header.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.appTextMuted)
                .padding(.leading, Spacing.s1)
            VStack(spacing: Spacing.s0) {
                ForEach(Array(section.rows.enumerated()), id: \.element.id) { index, row in
                    Button { onTap(row) } label: {
                        HStack(spacing: Spacing.s3) {
                            Icon(row.icon, size: 17, color: Theme.Color.appTextStrong)
                            Text(row.label)
                                .font(.system(size: 13.5, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                            Spacer(minLength: Spacing.s2)
                            if let value = row.value {
                                Text(value)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                            Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, Spacing.s3)
                        .frame(minHeight: 48)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier(row.accessibilityID ?? "meSectionRow_\(section.id)_\(row.id)")
                    if index < section.rows.count - 1 {
                        Rectangle()
                            .fill(Theme.Color.appBorderSubtle)
                            .frame(height: 1)
                            .padding(.leading, 14 + 17 + 12)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
    }
}

// MARK: - Destructive card

private struct MeDestructiveCard: View {
    let identity: MeIdentity
    let onAction: @MainActor () -> Void

    var body: some View {
        Button(action: onAction) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 17, color: Theme.Color.error)
                Text(label)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.error)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .frame(minHeight: 48)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("meDestructiveCard_\(identity.rawValue)")
    }

    private var icon: PantopusIcon {
        switch identity {
        case .personal: .arrowLeft
        case .home, .business: .user
        }
    }

    private var label: String {
        switch identity {
        case .personal: "Log out"
        case .home: "Switch identity → Personal"
        case .business: "Switch identity → Personal"
        }
    }
}

#Preview {
    MeView(
        viewModel: MeViewModel(),
        onAction: { _ in },
        onSection: { _ in },
        onLogOut: {}
    )
}
