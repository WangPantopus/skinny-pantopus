//
//  BroadcastDetailView.swift
//  Pantopus
//
//  P1.3 Broadcast detail full-screen takeover, reached from a tap on
//  an update card inside the creator's Audience Profile. Layout from
//  top to bottom: 44pt top bar (back / "Broadcast" / kebab) → hero
//  card (visibility chip + body + media + timestamp) → 2x2 analytics
//  grid → tier read-share bar → replies list → sticky footer (Reply
//  primary + Boost / Pin secondaries) via `.safeAreaInset`. The full-
//  screen presentation hides the host tab bar through the `YouTabRoot`
//  navigation stack push.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

public struct BroadcastDetailView: View {
    @State private var viewModel: BroadcastDetailViewModel
    private let onBack: @MainActor () -> Void
    private let onOverflow: @MainActor () -> Void
    private let onReply: @MainActor () -> Void
    private let onBoost: (@MainActor () -> Void)?
    private let onPin: (@MainActor () -> Void)?

    public init(
        viewModel: BroadcastDetailViewModel,
        onBack: @escaping @MainActor () -> Void = {},
        onOverflow: @escaping @MainActor () -> Void = {},
        onReply: @escaping @MainActor () -> Void = {},
        onBoost: (@MainActor () -> Void)? = nil,
        onPin: (@MainActor () -> Void)? = nil
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onOverflow = onOverflow
        self.onReply = onReply
        self.onBoost = onBoost
        self.onPin = onPin
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .task { await viewModel.load() }
        .toolbar(.hidden, for: .tabBar)
        .accessibilityIdentifier("broadcastDetail")
    }

    private var topBar: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("broadcastDetailBackButton")
            Spacer()
            Text("Broadcast")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Button(action: onOverflow) {
                Icon(.moreHorizontal, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("More actions")
            .accessibilityIdentifier("broadcastDetailOverflow")
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading: loadingFrame
        case let .loaded(loaded):
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    heroCard(loaded.hero)
                    analyticsGrid(loaded.analyticsCells)
                    tierBreakdownCard(loaded.tierBreakdown)
                    repliesSection(loaded)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
                .padding(.bottom, Spacing.s4)
            }
            .accessibilityIdentifier("broadcastDetailContent")
            .safeAreaInset(edge: .bottom, spacing: Spacing.s0) {
                stickyFooter
            }
        case let .error(message): errorFrame(message: message)
        }
    }

    // MARK: - States

    private var loadingFrame: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 180, cornerRadius: Radii.xl)
                Shimmer(height: 72, cornerRadius: Radii.lg)
                Shimmer(height: 96, cornerRadius: Radii.lg)
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 72, cornerRadius: Radii.lg)
                }
            }
            .padding(Spacing.s4)
        }
        .accessibilityIdentifier("broadcastDetailLoading")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load broadcast")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.load() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("broadcastDetailRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("broadcastDetailError")
    }

    // MARK: - Hero

    private func heroCard(_ hero: BroadcastDetailHero) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                HStack(spacing: Spacing.s2) {
                    visibilityChip(hero)
                    Text(hero.timestamp.isEmpty ? "Just now" : hero.timestamp)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Text(hero.body)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("broadcastDetailBody")
            }
            .padding(Spacing.s3)
            // The real attachments, through the same grid the Pulse card
            // and the Beacon profile use — the hero shipped with a tinted
            // `Rectangle` + `.image` glyph placeholder that never showed
            // the photo, let alone a Live Photo's LIVE dot or playback.
            if !hero.media.isEmpty {
                PostMediaGridView(
                    items: hero.media,
                    style: .regular,
                    accessibilityID: "broadcastDetailMedia"
                )
                .padding(.horizontal, Spacing.s3)
                .padding(.bottom, Spacing.s3)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .accessibilityIdentifier("broadcastDetailHero")
    }

    private func visibilityChip(_ hero: BroadcastDetailHero) -> some View {
        let icon: PantopusIcon = switch hero.visibility {
        case .publicVisible: .radioTower
        case .followers: .users
        case .tierOrAbove: .lock
        }
        return HStack(spacing: 3) {
            Icon(icon, size: 11, strokeWidth: 2.4, color: Theme.Color.primary700)
            Text(hero.visibilityLabel.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.primary700)
                .kerning(0.4)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(Theme.Color.primary50)
        .clipShape(Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("broadcastDetailVisibilityChip")
    }

    // MARK: - Analytics

    private func analyticsGrid(_ cells: [BroadcastAnalyticsCell]) -> some View {
        let columns = [
            GridItem(.flexible(), spacing: Spacing.s2),
            GridItem(.flexible(), spacing: Spacing.s2)
        ]
        return LazyVGrid(columns: columns, spacing: Spacing.s2) {
            ForEach(cells) { cell in
                analyticsCell(cell)
            }
        }
        .accessibilityIdentifier("broadcastDetailAnalytics")
    }

    private func analyticsCell(_ cell: BroadcastAnalyticsCell) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(cell.label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
                Text(cell.value)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let sub = cell.sub {
                    Text(sub)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.success)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(cell.label) \(cell.value)\(cell.sub.map { " (\($0))" } ?? "")")
        .accessibilityIdentifier("broadcastDetailCell_\(cell.id)")
    }

    // MARK: - Tier breakdown

    private func tierBreakdownCard(_ breakdown: BroadcastTierBreakdown) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Read by tier")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .kerning(0.6)
                .accessibilityAddTraits(.isHeader)
            if breakdown.segments.isEmpty {
                Text("Per-tier breakdown will appear once reads roll in.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            } else {
                tierStackedBar(breakdown)
                tierLegend(breakdown)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("broadcastDetailTierBreakdown")
    }

    private func tierStackedBar(_ breakdown: BroadcastTierBreakdown) -> some View {
        GeometryReader { geo in
            HStack(spacing: Spacing.s0) {
                if breakdown.total <= 0 {
                    Rectangle()
                        .fill(Theme.Color.appBorder)
                        .frame(width: geo.size.width, height: 10)
                } else {
                    ForEach(breakdown.segments) { segment in
                        let proportion = CGFloat(segment.count) / CGFloat(breakdown.total)
                        let width = geo.size.width * proportion
                        Rectangle()
                            .fill(AudienceProfileView.tierColor(rank: segment.rank))
                            .frame(width: max(width, segment.count >= 1 ? 4 : 0), height: 10)
                    }
                }
            }
        }
        .frame(height: 10)
        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(tierBreakdownAccessibilitySummary(breakdown))
        .accessibilityIdentifier("broadcastDetailTierBar")
    }

    private func tierLegend(_ breakdown: BroadcastTierBreakdown) -> some View {
        let columns = [
            GridItem(.flexible(), spacing: Spacing.s3, alignment: .leading),
            GridItem(.flexible(), spacing: Spacing.s3, alignment: .leading)
        ]
        return LazyVGrid(columns: columns, spacing: Spacing.s2) {
            ForEach(breakdown.segments) { segment in
                HStack(spacing: Spacing.s1) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(AudienceProfileView.tierColor(rank: segment.rank))
                        .frame(width: 8, height: 8)
                    Text(segment.name)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Spacer(minLength: Spacing.s0)
                    Text("\(segment.count)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("· \(segment.percent(of: breakdown.total))%")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("broadcastDetailTierLegend_\(segment.id)")
            }
        }
    }

    private func tierBreakdownAccessibilitySummary(_ breakdown: BroadcastTierBreakdown) -> String {
        guard !breakdown.segments.isEmpty else { return "No reads yet" }
        let parts = breakdown.segments.map { segment in
            "\(segment.name) \(segment.count), \(segment.percent(of: breakdown.total)) percent"
        }
        return "Reads by tier: " + parts.joined(separator: ", ")
    }

    // MARK: - Replies

    private func repliesSection(_ loaded: BroadcastDetailLoaded) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack {
                Text("Replies · \(loaded.totalReplies)".uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .kerning(0.6)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
            }
            if loaded.replies.isEmpty {
                emptyRepliesCard
            } else {
                VStack(spacing: Spacing.s0) {
                    ForEach(Array(loaded.replies.enumerated()), id: \.element.id) { offset, reply in
                        replyRow(reply)
                        if offset < loaded.replies.count - 1 {
                            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                        }
                    }
                }
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
        }
        .accessibilityIdentifier("broadcastDetailRepliesSection")
    }

    private var emptyRepliesCard: some View {
        VStack(spacing: Spacing.s2) {
            Icon(.messageCircle, size: 28, color: Theme.Color.appTextMuted)
            Text("No replies yet")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Text("Reply first — your followers will see your message under this broadcast.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("broadcastDetailEmptyReplies")
    }

    private func replyRow(_ reply: BroadcastReplyRow) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            ZStack {
                Circle().fill(Theme.Color.primary50).frame(width: 32, height: 32)
                Text(reply.displayName.prefix(1).uppercased())
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.s1) {
                    Text(reply.handle)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    tierChip(name: reply.tierName, rank: reply.tierRank)
                    Spacer(minLength: Spacing.s0)
                    Text(reply.timeAgo)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Text(reply.body)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(reply.displayName), \(reply.tierName) tier. \(reply.body). \(reply.timeAgo)")
        .accessibilityIdentifier("broadcastDetailReply_\(reply.id)")
    }

    private func tierChip(name: String, rank: Int) -> some View {
        let color = AudienceProfileView.tierColor(rank: rank)
        return Text(name.uppercased())
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(color)
            .kerning(0.4)
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
            .accessibilityHidden(true)
    }

    // MARK: - Sticky footer

    private var stickyFooter: some View {
        HStack(spacing: Spacing.s2) {
            if let onBoost {
                secondaryFooterButton(icon: .rocket, label: "Boost", action: onBoost)
                    .accessibilityIdentifier("broadcastDetailBoost")
            }
            if let onPin {
                secondaryFooterButton(icon: .pin, label: "Pin", action: onPin)
                    .accessibilityIdentifier("broadcastDetailPin")
            }
            Button(action: onReply) {
                HStack(spacing: Spacing.s1) {
                    Icon(.reply, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text("Reply")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Reply to broadcast")
            .accessibilityIdentifier("broadcastDetailReply")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s2)
        .background(
            Theme.Color.appSurface
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
                }
        )
        .accessibilityIdentifier("broadcastDetailFooter")
    }

    private func secondaryFooterButton(
        icon: PantopusIcon,
        label: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s1) {
                Icon(icon, size: 14, strokeWidth: 2.0, color: Theme.Color.appTextStrong)
                Text(label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minWidth: 88, minHeight: 44)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

#Preview("Populated") {
    BroadcastDetailView(
        viewModel: BroadcastDetailViewModel(
            broadcastId: "b_demo",
            seed: UpdateCardContent(
                id: "b_demo",
                body: "Today's loaf has a crumb you could read poetry through. " +
                    "I'll set a few aside if you want to swing by the stoop between 4–6.",
                timeAgo: "Today · 9:14am",
                visibility: .publicVisible,
                targetTierRank: nil,
                deliveredCount: 1247,
                readCount: 892
            ),
            tierSegments: [
                .init(id: "t1", rank: 1, name: "Followers", count: 374),
                .init(id: "t2", rank: 2, name: "Members", count: 276),
                .init(id: "t3", rank: 3, name: "Insiders", count: 160),
                .init(id: "t4", rank: 4, name: "Direct", count: 82)
            ]
        )
    )
}
