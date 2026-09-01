//
//  GigsBrowseSections.swift
//  Pantopus
//
//  Sectioned browse surface for the Gigs feed (RN "BrowseFeed" parity).
//  Rendered by `GigsFeedView` when no search / filters / category narrow
//  the feed: Best matches → Urgent rail → New today → High paying rail →
//  Quick jobs → category cluster chips → "See all N tasks" footer.
//

import SwiftUI

/// Scrollable browse-mode body. Sections render only when non-empty.
struct GigsBrowseSectionsView: View {
    let content: GigsBrowseContent
    let onOpenGig: @MainActor (String) -> Void
    let onSeeAll: @MainActor (GigsSort) -> Void
    let onSeeAllQuickJobs: @MainActor () -> Void
    let onSelectCategory: @MainActor (GigsCategory) -> Void
    let onRefresh: @MainActor () async -> Void

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.s4) {
                if !content.bestMatches.isEmpty {
                    verticalSection(
                        title: "Best matches",
                        identifier: "gigsBrowse.bestMatches",
                        rows: content.bestMatches
                    ) { onSeeAll(.newest) }
                }
                if !content.urgentRail.isEmpty {
                    railSection(
                        title: "Urgent nearby",
                        identifier: "gigsBrowse.urgent",
                        cards: content.urgentRail
                    ) { onSeeAll(.urgency) }
                }
                if !content.newToday.isEmpty {
                    verticalSection(
                        title: "New today",
                        identifier: "gigsBrowse.newToday",
                        rows: content.newToday
                    ) { onSeeAll(.newest) }
                }
                if !content.highPayingRail.isEmpty {
                    railSection(
                        title: "High paying",
                        identifier: "gigsBrowse.highPaying",
                        cards: content.highPayingRail
                    ) { onSeeAll(.highestPay) }
                }
                if !content.quickJobs.isEmpty {
                    verticalSection(
                        title: "Quick jobs",
                        identifier: "gigsBrowse.quickJobs",
                        rows: content.quickJobs,
                        onSeeAll: onSeeAllQuickJobs
                    )
                }
                if !content.clusters.isEmpty {
                    clusterSection
                }
                if content.totalActive > 0 {
                    seeAllFooter
                }
                Spacer(minLength: 110)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.top, Spacing.s1)
        }
        .refreshable { await onRefresh() }
        .accessibilityIdentifier("gigsBrowseFeed")
    }

    // MARK: - Section scaffolding

    private func sectionHeader(_ title: String, onSeeAll: @escaping @MainActor () -> Void) -> some View {
        HStack {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .kerning(1.2)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            Button(action: onSeeAll) {
                HStack(spacing: 3) {
                    Text("See all")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.primary600)
                    Icon(.chevronRight, size: 12, strokeWidth: 2.4, color: Theme.Color.primary600)
                }
                .frame(minHeight: 32)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, Spacing.s1)
    }

    private func verticalSection(
        title: String,
        identifier: String,
        rows: [GigCardContent],
        onSeeAll: @escaping @MainActor () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader(title, onSeeAll: onSeeAll)
            ForEach(rows) { row in
                Button {
                    onOpenGig(row.id)
                } label: {
                    GigRow(content: row)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("gigsRow_\(row.id)")
            }
        }
        .accessibilityIdentifier(identifier)
    }

    private func railSection(
        title: String,
        identifier: String,
        cards: [GigRailCardContent],
        onSeeAll: @escaping @MainActor () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            sectionHeader(title, onSeeAll: onSeeAll)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.s2) {
                    ForEach(cards) { card in
                        GigRailCard(content: card) { onOpenGig(card.id) }
                    }
                }
                .padding(.horizontal, Spacing.s1)
            }
        }
        .accessibilityIdentifier(identifier)
    }

    // MARK: - Clusters

    private var clusterSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Browse by category".uppercased())
                .font(.system(size: 11, weight: .bold))
                .kerning(1.2)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s1)
            LazyVGrid(
                columns: [GridItem(.flexible(), spacing: Spacing.s2), GridItem(.flexible(), spacing: Spacing.s2)],
                spacing: Spacing.s2
            ) {
                ForEach(content.clusters) { cluster in
                    GigClusterChip(content: cluster) { onSelectCategory(cluster.category) }
                }
            }
        }
        .accessibilityIdentifier("gigsBrowse.clusters")
    }

    private var seeAllFooter: some View {
        Button {
            onSeeAll(.newest)
        } label: {
            Text("See all \(content.totalActive) tasks")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.primary600)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("gigsBrowse.seeAllFooter")
    }
}

/// Compact ~240pt rail card — category-colored leading tile, 2-line
/// title, price + distance. Mirrors the Tasks-map rail card geometry.
struct GigRailCard: View {
    let content: GigRailCardContent
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [content.category.color, content.category.color.opacity(0.8)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    Icon(taskCategoryGlyph(content.category), size: 22, color: .white)
                    // P1.F follow-up — browse `first_image` thumbnail when
                    // the gig has one; the glyph tile shows while loading
                    // and stays as the no-photo fallback.
                    if let imageUrl = content.imageUrl, let url = URL(string: imageUrl) {
                        AsyncImage(url: url) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: {
                            Color.clear
                        }
                        .frame(width: 48, height: 48)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
                .frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(content.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: Spacing.s2) {
                        Text(content.price)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.primary600)
                        if let distance = content.distanceLabel {
                            Text("· \(distance)")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                }
            }
            .padding(Spacing.s3)
            .frame(width: 240, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(content.title), \(content.price)")
        .accessibilityIdentifier("gigsBrowseRail_\(content.id)")
    }
}

/// One "Browse by category" cluster chip — category-tinted dot, label,
/// count, optional "From $X" hint.
struct GigClusterChip: View {
    let content: GigClusterChipContent
    let onTap: @MainActor () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(content.category.color.opacity(0.14))
                    Icon(taskCategoryGlyph(content.category), size: 15, color: content.category.color)
                }
                .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(content.category.label)
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    HStack(spacing: Spacing.s1) {
                        Text("\(content.count) \(content.count == 1 ? "task" : "tasks")")
                            .font(.system(size: 10.5, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        if let hint = content.priceHint {
                            Text("· \(hint)")
                                .font(.system(size: 10.5, weight: .medium))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(content.category.label), \(content.count) tasks")
        .accessibilityIdentifier("gigsBrowseCluster_\(content.id)")
    }
}

/// Browse-mode loading frame — stacked section skeletons mirroring the
/// loaded geometry (header shimmer + rows / rail tiles).
struct GigsBrowseSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                skeletonSection(rows: 2)
                railSkeleton
                skeletonSection(rows: 2)
            }
            .padding(Spacing.s3)
        }
        .accessibilityIdentifier("gigsBrowseLoading")
    }

    private func skeletonSection(rows: Int) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Shimmer(width: 120, height: 12, cornerRadius: Radii.xs)
            ForEach(0..<rows, id: \.self) { _ in
                FeedSkeletonCard()
            }
        }
    }

    private var railSkeleton: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Shimmer(width: 120, height: 12, cornerRadius: Radii.xs)
            HStack(spacing: Spacing.s2) {
                Shimmer(width: 240, height: 76, cornerRadius: 14)
                Shimmer(width: 240, height: 76, cornerRadius: 14)
            }
        }
    }
}
