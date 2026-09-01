//
//  CreatorInboxView.swift
//  Pantopus
//
//  P1.2 Creator Inbox — standalone DM thread list for creators.
//  Top bar (back · "Creator inbox" · "@handle" subtitle · mark-all-read
//  + filter trailing actions). Sunken counts banner. Filter chip strip
//  with All / Unread / Bronze+ / Flagged. Avatar-first row list reusing
//  the visual language of `ConversationRow` plus a tier chip + flagged
//  indicator. Tap a row to push the persona-DM thread (`PersonaDmThreadView`),
//  addressed by thread id — not generic chat.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

private struct CreatorInboxPromptContent {
    let id: String
    let icon: PantopusIcon
    let title: String
    let subtitle: String
    let cta: String
}

public struct CreatorInboxView: View {
    @State private var viewModel: CreatorInboxViewModel
    private let onBack: @MainActor () -> Void
    private let onOpenThread: @MainActor (CreatorInboxRowContent) -> Void
    private let onOpenBroadcast: @MainActor () -> Void
    private let onOpenSettings: @MainActor () -> Void

    public init(
        viewModel: CreatorInboxViewModel = CreatorInboxViewModel(),
        onBack: @escaping @MainActor () -> Void = {},
        onOpenThread: @escaping @MainActor (CreatorInboxRowContent) -> Void = { _ in },
        onOpenBroadcast: @escaping @MainActor () -> Void = {},
        onOpenSettings: @escaping @MainActor () -> Void = {}
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onOpenThread = onOpenThread
        self.onOpenBroadcast = onOpenBroadcast
        self.onOpenSettings = onOpenSettings
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .accessibilityIdentifier("creatorInbox")
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(alignment: .center, spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("creatorInboxBackButton")

            VStack(spacing: 1) {
                Text("Creator inbox")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                if let handle = headerHandle, !handle.isEmpty {
                    Text(handle)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("creatorInboxTitle")

            HStack(spacing: Spacing.s0) {
                Icon(.check, size: 19, color: Theme.Color.appTextStrong)
                    .frame(width: 36, height: 36)
                    .accessibilityHidden(true)
                Icon(.slidersHorizontal, size: 19, color: Theme.Color.appTextStrong)
                    .frame(width: 36, height: 36)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 56)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    private var headerHandle: String? {
        switch viewModel.state {
        case let .loaded(loaded): loaded.header.handle
        case let .empty(header): header.handle
        case .loading, .error: nil
        }
    }

    // MARK: - Content

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingFrame
        case let .loaded(loaded):
            loadedFrame(loaded)
        case .empty:
            emptyFrame
        case let .error(message):
            errorFrame(message: message)
        }
    }

    private var loadingFrame: some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                Shimmer(height: 36, cornerRadius: Radii.sm)
                Shimmer(height: 44, cornerRadius: Radii.pill)
                ForEach(0..<5, id: \.self) { _ in
                    Shimmer(height: 68, cornerRadius: Radii.lg)
                }
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("creatorInboxLoading")
    }

    private func loadedFrame(_ loaded: CreatorInboxLoaded) -> some View {
        VStack(spacing: Spacing.s0) {
            countsBanner(loaded.counts)
            filterStrip(chips: loaded.chips)
            threadsList(rows: loaded.rows, isCrossPersona: loaded.header.isCrossPersona)
        }
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load your inbox")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.s5)
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
            .accessibilityIdentifier("creatorInboxRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("creatorInboxError")
    }

    // MARK: - Counts banner

    private func countsBanner(_ counts: CreatorInboxCounts) -> some View {
        HStack(spacing: 14) {
            Icon(.inbox, size: 15, color: Theme.Color.primary600)
            HStack(spacing: Spacing.s0) {
                Text("\(counts.total)")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(" threads · ")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text("\(counts.unread)")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(counts.unread > 0 ? Theme.Color.primary700 : Theme.Color.appTextStrong)
                Text(" unread · ")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text("\(counts.flagged)")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(counts.flagged > 0 ? Theme.Color.warning : Theme.Color.appTextStrong)
                Text(" flagged")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            Spacer(minLength: Spacing.s0)
            Button(action: onOpenSettings) {
                HStack(spacing: 2) {
                    Text("Settings")
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                    Icon(.chevronRight, size: 12, color: Theme.Color.primary600)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("creatorInboxSettingsLink")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 10)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(counts.total) threads, \(counts.unread) unread, \(counts.flagged) flagged"
        )
        .accessibilityIdentifier("creatorInboxCounts")
    }

    // MARK: - Filter strip

    private func filterStrip(chips: [CreatorInboxChipContent]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(chips) { chip in
                    filterChip(chip)
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityIdentifier("creatorInboxFilterStrip")
    }

    private func filterChip(_ chip: CreatorInboxChipContent) -> some View {
        let isActive = viewModel.activeFilter == chip.filter
        return Button {
            viewModel.selectFilter(chip.filter)
        } label: {
            HStack(spacing: 5) {
                Text(chip.label)
                    .font(.system(size: 11.5, weight: .semibold))
                Text("\(chip.count)")
                    .font(.system(size: 9.5, weight: .bold))
                    .opacity(0.85)
            }
            .foregroundStyle(isActive ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            .padding(.horizontal, 11)
            .padding(.vertical, 5)
            .background(isActive ? Theme.Color.primary600 : Theme.Color.appSurface)
            .overlay(
                Capsule().stroke(
                    isActive ? Theme.Color.primary600 : Theme.Color.appBorder,
                    lineWidth: 1
                )
            )
            .clipShape(Capsule())
            .frame(minHeight: 28)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("creatorInboxChip_\(chip.id)")
        .accessibilityLabel("\(chip.label), \(chip.count)")
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: - Threads list

    private func threadsList(rows: [CreatorInboxRowContent], isCrossPersona: Bool) -> some View {
        Group {
            if rows.isEmpty {
                filteredEmptyState
            } else {
                ScrollView {
                    VStack(spacing: Spacing.s0) {
                        ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                            threadRow(row, isLast: index == rows.count - 1, isCrossPersona: isCrossPersona)
                        }
                    }
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s3)
                    .padding(.bottom, Spacing.s5)
                }
                .refreshable { await viewModel.refresh() }
                .accessibilityIdentifier("creatorInboxList")
            }
        }
    }

    private var filteredEmptyState: some View {
        VStack(spacing: Spacing.s2) {
            Spacer()
            Icon(.inbox, size: 32, color: Theme.Color.appTextMuted)
            Text("No threads in this view")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("Try another filter to see the rest of your inbox.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("creatorInboxFilteredEmpty")
    }

    // MARK: - Empty state (no threads at all)

    private var emptyFrame: some View {
        ScrollView {
            VStack(spacing: Spacing.s0) {
                emptyHero
                emptyPromptList
                emptyFootnote
            }
            .padding(.horizontal, 28)
            .padding(.top, Spacing.s8)
            .padding(.bottom, 60)
            .frame(maxWidth: .infinity)
        }
        .accessibilityIdentifier("creatorInboxEmpty")
    }

    private var emptyHero: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(Theme.Color.primary50)
                    .frame(width: 88, height: 88)
                Icon(.inbox, size: 38, strokeWidth: 1.7, color: Theme.Color.primary600)
            }
            VStack(spacing: Spacing.s2) {
                Text("No DM threads yet")
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text(
                    "Your fans haven't reached out. DMs usually start after a broadcast, " +
                        "a paywall reply, or a tip — try one of these to get the inbox moving."
                )
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
            }
        }
        .padding(.bottom, 22)
    }

    private var emptyPromptList: some View {
        VStack(spacing: Spacing.s2) {
            emptyPromptRow(
                CreatorInboxPromptContent(
                    id: "broadcast",
                    icon: .megaphone,
                    title: "Send a broadcast",
                    subtitle: "Fans can reply privately to anything you post",
                    cta: "Compose"
                ),
                action: onOpenBroadcast
            )
            emptyPromptRow(
                CreatorInboxPromptContent(
                    id: "unlock",
                    icon: .shield,
                    title: "Unlock fan DMs",
                    subtitle: "Bronze+ fans can message you directly",
                    cta: "Settings"
                ),
                action: onOpenSettings
            )
            emptyPromptRow(
                CreatorInboxPromptContent(
                    id: "tip",
                    icon: .handCoins,
                    title: "Enable tip-with-message",
                    subtitle: "Tips arrive as paid DMs at the top of inbox",
                    cta: "Turn on"
                ),
                action: onOpenSettings
            )
        }
        .padding(.bottom, 18)
    }

    private func emptyPromptRow(
        _ prompt: CreatorInboxPromptContent,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.primary50)
                    Icon(prompt.icon, size: 16, color: Theme.Color.primary600)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(prompt.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(prompt.subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s0)
                HStack(spacing: 2) {
                    Text(prompt.cta)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.Color.primary600)
                    Icon(.arrowRight, size: 11, color: Theme.Color.primary600)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 48)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("creatorInboxPrompt_\(prompt.id)")
    }

    private var emptyFootnote: some View {
        HStack(spacing: 6) {
            Icon(.shieldCheck, size: 12, color: Theme.Color.primary600)
            Text("Only verified fans can message. Spam is filtered out by default.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: 280)
    }

    // MARK: - Row

    private func threadRow(
        _ row: CreatorInboxRowContent,
        isLast: Bool,
        isCrossPersona: Bool
    ) -> some View {
        Button {
            onOpenThread(row)
        } label: {
            HStack(alignment: .top, spacing: Spacing.s3) {
                avatar(row)
                middle(row, isCrossPersona: isCrossPersona)
                if row.unread {
                    Circle()
                        .fill(Theme.Color.primary600)
                        .frame(width: 8, height: 8)
                        .padding(.top, Spacing.s2)
                        .accessibilityHidden(true)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 56)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .bottom) {
                if !isLast {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel(row))
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("creatorInboxRow_\(row.id)")
    }

    private func avatar(_ row: CreatorInboxRowContent) -> some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle().fill(Theme.Color.primary500)
                Text(row.initials.isEmpty ? "?" : row.initials)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(width: 44, height: 44)
            if row.verifiedLocal {
                Icon(.check, size: 8, strokeWidth: 4, color: Theme.Color.appTextInverse)
                    .frame(width: 16, height: 16)
                    .background(Theme.Color.primary600)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 1, y: 1)
                    .accessibilityLabel("Verified")
            }
        }
        .frame(width: 46, height: 46)
    }

    private func middle(_ row: CreatorInboxRowContent, isCrossPersona: Bool) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                Text(row.handle.isEmpty ? row.displayName : row.handle)
                    .font(.system(size: 13.5, weight: row.unread ? .bold : .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                if let tier = row.tierName {
                    tierChip(tier: tier, rank: row.tierRank)
                }
                if isCrossPersona, let persona = row.personaChip {
                    personaChip(persona)
                }
                if row.flagged {
                    Icon(.flag, size: 11, strokeWidth: 2.4, color: Theme.Color.warning)
                        .accessibilityLabel("Flagged")
                }
                Spacer(minLength: Spacing.s0)
                Text(row.timeAgo)
                    .font(.system(size: 10.5, weight: row.unread ? .bold : .medium))
                    .foregroundStyle(row.unread ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                    .lineLimit(1)
            }
            Text(row.preview)
                .font(.system(size: 12, weight: row.unread ? .semibold : .regular))
                .foregroundStyle(row.unread ? Theme.Color.appText : Theme.Color.appTextSecondary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func tierChip(tier: String, rank: Int) -> some View {
        HStack(spacing: 3) {
            if rank >= 4 {
                Icon(.crown, size: 9, strokeWidth: 2.4, color: Self.tierColor(rank: rank))
            } else if rank >= 2 {
                Icon(.shield, size: 9, strokeWidth: 2.4, color: Self.tierColor(rank: rank))
            }
            Text(tier.uppercased())
                .font(.system(size: 9, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Self.tierColor(rank: rank))
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(Self.tierBgColor(rank: rank))
        .clipShape(Capsule())
        .accessibilityLabel("\(tier) tier")
    }

    private func personaChip(_ label: String) -> some View {
        Text(label)
            .font(.system(size: 9, weight: .bold))
            .tracking(0.4)
            .foregroundStyle(Theme.Color.primary700)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Theme.Color.primary50)
            .clipShape(Capsule())
            .accessibilityLabel("Persona \(label)")
    }

    private func rowAccessibilityLabel(_ row: CreatorInboxRowContent) -> String {
        var parts: [String] = [row.displayName.isEmpty ? row.handle : row.displayName]
        if let tier = row.tierName { parts.append("\(tier) tier") }
        if row.verifiedLocal { parts.append("verified") }
        if row.flagged { parts.append("flagged") }
        parts.append(row.preview)
        if row.unread { parts.append("unread") }
        parts.append(row.timeAgo)
        return parts.joined(separator: ". ")
    }

    // MARK: - Tier color helpers (rank → semantic token)

    //
    // Mirrors the rank → semantic-token mapping already used in
    // `AudienceProfileView.tierColor(rank:)` so the tier chip on
    // a Creator Inbox row reads the same as on the Audience Profile
    // Threads tab. The design names (bronze / silver / gold) are
    // intentionally rendered via the existing semantic tokens —
    // bronze/silver/gold aren't in `Theme.Color`, and the preamble
    // forbids introducing new color values.

    static func tierColor(rank: Int) -> Color {
        switch rank {
        case 1: Theme.Color.appTextSecondary
        case 2: Theme.Color.warning
        case 3: Theme.Color.appTextStrong
        case 4: Theme.Color.warning
        default: Theme.Color.appTextSecondary
        }
    }

    static func tierBgColor(rank: Int) -> Color {
        switch rank {
        case 1: Theme.Color.appSurfaceSunken
        case 2: Theme.Color.warningBg
        case 3: Theme.Color.appSurfaceSunken
        case 4: Theme.Color.warningLight
        default: Theme.Color.appSurfaceSunken
        }
    }
}

#Preview {
    CreatorInboxView()
}
