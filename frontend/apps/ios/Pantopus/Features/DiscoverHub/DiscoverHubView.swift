//
//  DiscoverHubView.swift
//  Pantopus
//
//  A11.3 Discover magazine surface. The map compresses into a compact
//  context strip, while the sheet body stacks three grouped rails:
//  Tasks near you, Marketplace picks, and From your block.
//

// swiftlint:disable file_length

import SwiftUI

public struct DiscoverHubView: View {
    @State private var viewModel: DiscoverHubViewModel
    @Environment(\.dismiss) private var dismiss

    public init(viewModel: DiscoverHubViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        DiscoverHubMagazineContentView(
            state: viewModel.magazineState,
            selectedFilter: viewModel.selectedMagazineFilter,
            onBack: { dismiss() },
            onOpenMap: { viewModel.openMap() },
            onSelectFilter: { viewModel.selectMagazineFilter($0) },
            onSelectTask: { viewModel.selectTask($0) },
            onSelectMarketplace: { viewModel.selectMarketplaceItem($0) },
            onSelectPost: { viewModel.selectPost($0) },
            onSeeAllTasks: { viewModel.seeAllTasks() },
            onSeeAllMarketplace: { viewModel.seeAllMarketplace() },
            onSeeAllPosts: { viewModel.seeAllPosts() },
            onRetry: { Task { await viewModel.refreshMagazine() } },
            onNotify: { viewModel.notifyWhenActive() }
        )
        .task { await viewModel.loadMagazine() }
        .accessibilityIdentifier("discoverHub")
    }
}

struct DiscoverHubMagazineContentView: View {
    let state: DiscoverHubMagazineState
    let selectedFilter: DiscoverHubMapKind?
    let onBack: () -> Void
    let onOpenMap: () -> Void
    let onSelectFilter: (DiscoverHubMapKind?) -> Void
    let onSelectTask: (String) -> Void
    let onSelectMarketplace: (String) -> Void
    let onSelectPost: (String) -> Void
    let onSeeAllTasks: () -> Void
    let onSeeAllMarketplace: () -> Void
    let onSeeAllPosts: () -> Void
    let onRetry: () -> Void
    let onNotify: () -> Void

    private var mapPins: [DiscoverHubMapPin] {
        if case let .populated(content) = state {
            return content.pins
        }
        return []
    }

    private var mapCluster: DiscoverHubMapCluster? {
        if case let .populated(content) = state {
            return content.cluster
        }
        return nil
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                Theme.Color.appSurface
                    .ignoresSafeArea()
                DiscoverCompactMapPreview(
                    pins: mapPins,
                    cluster: mapCluster,
                    onOpenMap: onOpenMap
                )
                .frame(height: Self.mapHeight)
                .accessibilityIdentifier("discoverHubMapPreview")
                topPill
                    .padding(.horizontal, Spacing.s3)
                    .padding(.top, max(proxy.safeAreaInsets.top, Spacing.s2))
                expandMapButton
                    .padding(.trailing, Spacing.s3)
                    .padding(.top, Self.mapHeight - Spacing.s10)
                magazineSheet
                    .padding(.top, Self.sheetTopOffset)
            }
            .background(Theme.Color.appSurface)
            .ignoresSafeArea(edges: .bottom)
        }
    }

    private var topPill: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 18, strokeWidth: 2.2, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("discoverHubBack")

            Spacer(minLength: Spacing.s2)
            Text("Discover")
                .pantopusTextStyle(.small)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Spacing.s2)

            Button(
                action: {},
                label: {
                    Icon(.search, size: 16, strokeWidth: 2.2, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
            )
            .buttonStyle(.plain)
            .accessibilityLabel("Search discovery")
            .accessibilityIdentifier("discoverHubSearch")
        }
        .padding(.horizontal, Spacing.s1)
        .frame(height: 52)
        .background(Theme.Color.appSurface.opacity(0.96))
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.10), radius: 8, x: 0, y: 4)
        .accessibilityIdentifier("discoverHubTopPill")
    }

    private var expandMapButton: some View {
        HStack {
            Spacer()
            Button(action: onOpenMap) {
                HStack(spacing: Spacing.s1) {
                    Icon(.map, size: 13, strokeWidth: 2.2, color: Theme.Color.appText)
                    Text("Expand map")
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                }
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 44)
                .background(Theme.Color.appSurface.opacity(0.96))
                .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(Capsule())
                .shadow(color: .black.opacity(0.10), radius: 6, x: 0, y: 3)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Expand map")
            .accessibilityIdentifier("discoverHubExpandMap")
        }
    }

    private var magazineSheet: some View {
        VStack(spacing: Spacing.s0) {
            Capsule()
                .fill(Theme.Color.appBorderStrong)
                .frame(width: 40, height: 4)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s1)
                .accessibilityHidden(true)
            DiscoverEntityChipRow(
                selectedFilter: selectedFilter,
                onSelect: onSelectFilter
            )
            sheetBody
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .shadow(color: .black.opacity(0.12), radius: 12, x: 0, y: -8)
        .accessibilityIdentifier("discoverHubSheet")
    }

    @ViewBuilder private var sheetBody: some View {
        switch state {
        case .loading:
            DiscoverHubLoadingBody()
        case .empty:
            DiscoverHubEmptyBody(onNotify: onNotify)
        case let .populated(content):
            DiscoverHubRailsBody(
                content: content,
                onSelectTask: onSelectTask,
                onSelectMarketplace: onSelectMarketplace,
                onSelectPost: onSelectPost,
                onSeeAllTasks: onSeeAllTasks,
                onSeeAllMarketplace: onSeeAllMarketplace,
                onSeeAllPosts: onSeeAllPosts
            )
        case let .error(message):
            DiscoverHubErrorBody(message: message, onRetry: onRetry)
        }
    }

    private static let mapHeight: CGFloat = 190
    private static let sheetTopOffset: CGFloat = 172
}

// MARK: - Compact map

private struct DiscoverCompactMapPreview: View {
    let pins: [DiscoverHubMapPin]
    let cluster: DiscoverHubMapCluster?
    let onOpenMap: () -> Void

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Theme.Color.appSurfaceSunken
                mapBlobs
                mapRoads(size: geo.size)
                ForEach(pins) { pin in
                    DiscoverMiniPin(pin: pin)
                        .position(x: geo.size.width * pin.x, y: geo.size.height * pin.y)
                }
                if let cluster {
                    DiscoverMapClusterView(cluster: cluster)
                        .position(x: geo.size.width * cluster.x, y: geo.size.height * cluster.y)
                }
                DiscoverYouAreHereDot()
                    .position(x: geo.size.width * 0.46, y: geo.size.height * 0.79)
            }
            .contentShape(Rectangle())
            .onTapGesture(perform: onOpenMap)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Compact discover map. Opens Explore Map.")
            .accessibilityAddTraits(.isButton)
        }
        .clipped()
    }

    private var mapBlobs: some View {
        ZStack {
            Ellipse()
                .fill(Theme.Color.homeBg)
                .frame(width: 132, height: 88)
                .offset(x: -140, y: -28)
            Ellipse()
                .fill(Theme.Color.homeBg)
                .frame(width: 86, height: 60)
                .offset(x: 118, y: 58)
            Ellipse()
                .fill(Theme.Color.primary100)
                .frame(width: 158, height: 120)
                .offset(x: 160, y: -82)
        }
        .accessibilityHidden(true)
    }

    private func mapRoads(size: CGSize) -> some View {
        ZStack {
            road { path in
                path.move(to: CGPoint(x: 0, y: size.height * 0.32))
                path.addCurve(
                    to: CGPoint(x: size.width, y: size.height * 0.42),
                    control1: CGPoint(x: size.width * 0.28, y: size.height * 0.24),
                    control2: CGPoint(x: size.width * 0.60, y: size.height * 0.44)
                )
            }
            road(lineWidth: 4) { path in
                path.move(to: CGPoint(x: 0, y: size.height * 0.76))
                path.addCurve(
                    to: CGPoint(x: size.width, y: size.height * 0.84),
                    control1: CGPoint(x: size.width * 0.26, y: size.height * 0.88),
                    control2: CGPoint(x: size.width * 0.58, y: size.height * 0.72)
                )
            }
            road(lineWidth: 4) { path in
                path.move(to: CGPoint(x: size.width * 0.22, y: 0))
                path.addCurve(
                    to: CGPoint(x: size.width * 0.24, y: size.height),
                    control1: CGPoint(x: size.width * 0.26, y: size.height * 0.28),
                    control2: CGPoint(x: size.width * 0.16, y: size.height * 0.64)
                )
            }
            road { path in
                path.move(to: CGPoint(x: size.width * 0.50, y: 0))
                path.addCurve(
                    to: CGPoint(x: size.width * 0.50, y: size.height),
                    control1: CGPoint(x: size.width * 0.56, y: size.height * 0.32),
                    control2: CGPoint(x: size.width * 0.46, y: size.height * 0.58)
                )
            }
            road(lineWidth: 4) { path in
                path.move(to: CGPoint(x: size.width * 0.78, y: 0))
                path.addCurve(
                    to: CGPoint(x: size.width * 0.74, y: size.height),
                    control1: CGPoint(x: size.width * 0.72, y: size.height * 0.34),
                    control2: CGPoint(x: size.width * 0.84, y: size.height * 0.62)
                )
            }
        }
        .accessibilityHidden(true)
    }

    private func road(
        lineWidth: CGFloat = 6,
        build: @escaping (inout Path) -> Void
    ) -> some View {
        Path { path in build(&path) }
            .stroke(Theme.Color.appSurface, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
            .opacity(0.75)
    }
}

private struct DiscoverMiniPin: View {
    let pin: DiscoverHubMapPin
    @State private var pulse = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            if pin.pulses && !reduceMotion {
                RoundedRectangle(cornerRadius: pin.kind == .item ? Radii.md : Radii.pill, style: .continuous)
                    .fill(pin.kind.color.opacity(0.25))
                    .frame(width: 42, height: 42)
                    .scaleEffect(pulse ? 1.25 : 0.70)
                    .opacity(pulse ? 0 : 1)
                    .animation(.easeOut(duration: 1.6).repeatForever(autoreverses: false), value: pulse)
            }
            RoundedRectangle(cornerRadius: pin.kind == .item ? Radii.sm : Radii.pill, style: .continuous)
                .fill(pin.kind.color)
                .frame(width: 24, height: 24)
                .overlay(
                    RoundedRectangle(
                        cornerRadius: pin.kind == .item ? Radii.sm : Radii.pill,
                        style: .continuous
                    )
                    .stroke(Theme.Color.appSurface, lineWidth: 2)
                )
                .shadow(color: .black.opacity(0.22), radius: 4, x: 0, y: 2)
            Icon(pin.kind.icon, size: 11, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
        }
        .accessibilityHidden(true)
        .onAppear {
            if pin.pulses {
                pulse = true
            }
        }
    }
}

private struct DiscoverMapClusterView: View {
    let cluster: DiscoverHubMapCluster

    var body: some View {
        Text("\(cluster.count)")
            .pantopusTextStyle(.caption)
            .fontWeight(.bold)
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(width: 34, height: 34)
            .background(Theme.Color.primary600)
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 3))
            .clipShape(Circle())
            .shadow(color: .black.opacity(0.24), radius: 5, x: 0, y: 3)
            .accessibilityHidden(true)
    }
}

private struct DiscoverYouAreHereDot: View {
    var body: some View {
        Circle()
            .fill(Theme.Color.primary600)
            .frame(width: 13, height: 13)
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 3))
            .background(
                Circle()
                    .fill(Theme.Color.primary600.opacity(0.20))
                    .frame(width: 28, height: 28)
            )
            .accessibilityLabel("You are here")
    }
}

// MARK: - Chips

private struct DiscoverEntityChipRow: View {
    let selectedFilter: DiscoverHubMapKind?
    let onSelect: (DiscoverHubMapKind?) -> Void

    private var chips: [DiscoverEntityChip] {
        [DiscoverEntityChip(id: "all", label: "All", kind: nil)] +
            DiscoverHubMapKind.allCases.map {
                DiscoverEntityChip(id: $0.rawValue, label: $0.pluralLabel, kind: $0)
            }
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(chips, id: \.id) { chip in
                    let active = chip.kind == selectedFilter
                    Button {
                        onSelect(chip.kind)
                    } label: {
                        HStack(spacing: Spacing.s1) {
                            if let kind = chip.kind {
                                RoundedRectangle(
                                    cornerRadius: kind == .item ? Radii.xs : Radii.pill,
                                    style: .continuous
                                )
                                .fill(active ? Theme.Color.appTextInverse : kind.color)
                                .frame(width: 7, height: 7)
                            }
                            Text(chip.label)
                                .pantopusTextStyle(.caption)
                                .fontWeight(.semibold)
                                .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                        }
                        .padding(.horizontal, Spacing.s3)
                        .frame(height: 28)
                        .background(active ? Theme.Color.appText : Theme.Color.appSurface)
                        .overlay(Capsule().stroke(active ? .clear : Theme.Color.appBorder, lineWidth: 1))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .frame(minHeight: 44)
                    .accessibilityLabel(chip.kind == nil ? "Show all discovery" : "Show \(chip.label)")
                    .accessibilityIdentifier("discoverHubChip_\(chip.id)")
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
        .padding(.vertical, Spacing.s1)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
        }
        .accessibilityIdentifier("discoverHubChips")
    }
}

private struct DiscoverEntityChip: Identifiable {
    let id: String
    let label: String
    let kind: DiscoverHubMapKind?
}

// MARK: - Rail body

private struct DiscoverHubRailsBody: View {
    let content: DiscoverHubMagazineContent
    let onSelectTask: (String) -> Void
    let onSelectMarketplace: (String) -> Void
    let onSelectPost: (String) -> Void
    let onSeeAllTasks: () -> Void
    let onSeeAllMarketplace: () -> Void
    let onSeeAllPosts: () -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: Spacing.s0) {
                DiscoverRailSectionHeader(
                    icon: .hammer,
                    color: DiscoverHubMapKind.task.color,
                    title: "Tasks near you",
                    subcopy: "Closest first - 0.5 mi radius",
                    onSeeAll: onSeeAllTasks,
                    identifier: "discoverHubTasksSeeAll"
                )
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.s3) {
                        ForEach(content.tasks) { item in
                            DiscoverTaskRailCard(item: item) {
                                onSelectTask(item.id)
                            }
                        }
                    }
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s1)
                }
                .accessibilityIdentifier("discoverHubTasksRail")

                DiscoverRailSectionHeader(
                    icon: .tag,
                    color: DiscoverHubMapKind.item.color,
                    title: "Marketplace picks",
                    subcopy: "Fresh listings - 4 new today",
                    onSeeAll: onSeeAllMarketplace,
                    identifier: "discoverHubMarketplaceSeeAll"
                )
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.s3) {
                        ForEach(content.marketplace) { item in
                            DiscoverMarketplaceRailCard(item: item) {
                                onSelectMarketplace(item.id)
                            }
                        }
                    }
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s1)
                }
                .accessibilityIdentifier("discoverHubMarketplaceRail")

                DiscoverRailSectionHeader(
                    icon: .messageCircle,
                    color: DiscoverHubMapKind.post.color,
                    title: "From your block",
                    subcopy: "Pulse posts - last 24h",
                    onSeeAll: onSeeAllPosts,
                    identifier: "discoverHubPostsSeeAll"
                )
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.s3) {
                        ForEach(content.posts) { item in
                            DiscoverPostRailCard(item: item) {
                                onSelectPost(item.id)
                            }
                        }
                    }
                    .padding(.horizontal, Spacing.s4)
                    .padding(.vertical, Spacing.s1)
                    .padding(.bottom, Spacing.s4)
                }
                .accessibilityIdentifier("discoverHubPostsRail")
            }
        }
        .accessibilityIdentifier("discoverHubRails")
    }
}

private struct DiscoverRailSectionHeader: View {
    let icon: PantopusIcon
    let color: Color
    let title: String
    let subcopy: String
    let onSeeAll: () -> Void
    let identifier: String

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.s2) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(color.opacity(0.12))
                Icon(icon, size: 13, strokeWidth: 2.4, color: color)
            }
            .frame(width: 24, height: 24)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .pantopusTextStyle(.small)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appText)
                Text(subcopy)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            Button(action: onSeeAll) {
                HStack(spacing: Spacing.s1) {
                    Text("See all")
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                    Icon(.chevronRight, size: 13, strokeWidth: 2.4, color: Theme.Color.primary600)
                }
                .foregroundStyle(Theme.Color.primary600)
                .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier(identifier)
            .accessibilityLabel("See all \(title)")
        }
        .padding(.top, Spacing.s4)
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s1)
    }
}

private struct DiscoverTaskRailCard: View {
    let item: DiscoverHubTaskCard
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(DiscoverHubMapKind.task.color)
                    Icon(.hammer, size: 20, color: Theme.Color.appTextInverse)
                }
                .frame(width: 42, height: 42)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(item.title)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: Spacing.s1) {
                        Text(item.price)
                            .pantopusTextStyle(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(Theme.Color.primary600)
                        Text("- \(item.distance)")
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: Spacing.s0)
            }
            .padding(Spacing.s3)
            .frame(width: 208, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.title), \(item.price), \(item.distance), \(item.bids)")
        .accessibilityIdentifier("discoverHubTaskCard_\(item.id)")
    }
}

private struct DiscoverMarketplaceRailCard: View {
    let item: DiscoverHubMarketplaceCard
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(DiscoverHubMapKind.item.softColor)
                    Icon(item.icon, size: 32, strokeWidth: 1.7, color: DiscoverHubMapKind.item.color)
                    Text("Item")
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(DiscoverHubMapKind.item.color)
                        .padding(.horizontal, Spacing.s2)
                        .padding(.vertical, 2)
                        .background(Theme.Color.appSurface)
                        .overlay(Capsule().stroke(DiscoverHubMapKind.item.color.opacity(0.22), lineWidth: 1))
                        .clipShape(Capsule())
                        .padding(Spacing.s2)
                }
                .frame(height: 104)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(item.title)
                        .pantopusTextStyle(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                        .frame(height: 34, alignment: .topLeading)
                    HStack {
                        Text(item.price)
                            .pantopusTextStyle(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(Theme.Color.primary600)
                        Spacer(minLength: Spacing.s2)
                        Text(item.distance)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .padding(Spacing.s2)
            }
            .frame(width: 148)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.title), \(item.price), \(item.distance)")
        .accessibilityIdentifier("discoverHubMarketplaceCard_\(item.id)")
    }
}

private struct DiscoverPostRailCard: View {
    let item: DiscoverHubPostCard
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s2) {
                    Text(item.intent)
                        .pantopusTextStyle(.overline)
                        .foregroundStyle(intentColor)
                        .padding(.horizontal, Spacing.s2)
                        .padding(.vertical, 2)
                        .background(intentBackground)
                        .clipShape(Capsule())
                    Text(item.author)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Text(item.title)
                    .pantopusTextStyle(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(item.body)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                HStack(spacing: Spacing.s1) {
                    Icon(.messageSquare, size: 11, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                    Text("\(item.replies) replies")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s3)
            .frame(width: 264, alignment: .topLeading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.intent), \(item.title), by \(item.author), \(item.replies) replies")
        .accessibilityIdentifier("discoverHubPostCard_\(item.id)")
    }

    private var intentColor: Color {
        item.intent == "Recommend" ? Theme.Color.home : Theme.Color.primary700
    }

    private var intentBackground: Color {
        item.intent == "Recommend" ? Theme.Color.homeBg : Theme.Color.primary50
    }
}

// MARK: - Loading / empty / error

private struct DiscoverHubLoadingBody: View {
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: Spacing.s0) {
                ForEach(0..<3, id: \.self) { index in
                    DiscoverSkeletonHeader(titleWidth: index == 1 ? 164 : 142)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Spacing.s3) {
                            ForEach(0..<3, id: \.self) { _ in
                                DiscoverRailSkeletonCard(height: index == 1 ? 164 : 72)
                            }
                        }
                        .padding(.horizontal, Spacing.s4)
                        .padding(.vertical, Spacing.s1)
                    }
                }
            }
            .padding(.bottom, Spacing.s4)
        }
        .accessibilityLabel("Loading discovery")
        .accessibilityIdentifier("discoverHubLoading")
    }
}

private struct DiscoverHubEmptyBody: View {
    let onNotify: () -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: Spacing.s0) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .fill(Theme.Color.primary50)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                                .stroke(Theme.Color.primary100, lineWidth: 1)
                        )
                    Icon(.sparkles, size: 22, strokeWidth: 1.9, color: Theme.Color.primary600)
                }
                .frame(width: 52, height: 52)
                .padding(.top, Spacing.s4)
                .padding(.bottom, Spacing.s3)
                .accessibilityHidden(true)

                Text("Nothing to discover yet")
                    .pantopusTextStyle(.small)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appText)
                    .padding(.bottom, Spacing.s1)
                Text("Check back soon - as verified neighbors near you post, things will surface here grouped by category.")
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 264)
                    .padding(.bottom, Spacing.s3)

                VStack(alignment: .leading, spacing: Spacing.s3) {
                    ForEach(DiscoverHubSampleData.emptySkeletonRailTitles, id: \.self) { title in
                        VStack(alignment: .leading, spacing: Spacing.s1) {
                            Text(title)
                                .pantopusTextStyle(.overline)
                                .foregroundStyle(Theme.Color.appTextMuted)
                            HStack(spacing: Spacing.s2) {
                                ForEach(0..<3, id: \.self) { _ in
                                    DiscoverDiagonalSkeleton()
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: 280)
                .padding(.bottom, Spacing.s4)

                Button(action: onNotify) {
                    HStack(spacing: Spacing.s2) {
                        Icon(.bell, size: 13, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                        Text("Notify me when active")
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .frame(minHeight: 44)
                    .background(Theme.Color.appSurface)
                    .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("discoverHubNotify")
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, Spacing.s6)
            .padding(.bottom, Spacing.s5)
        }
        .accessibilityIdentifier("discoverHubEmpty")
    }
}

private struct DiscoverHubErrorBody: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.alertCircle, size: 28, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button(action: onRetry) {
                Text("Try again")
                    .pantopusTextStyle(.small)
                    .fontWeight(.bold)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(minHeight: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("discoverHubRetry")
        }
        .padding(.horizontal, Spacing.s6)
        .padding(.top, Spacing.s8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("discoverHubError")
    }
}

private struct DiscoverSkeletonHeader: View {
    let titleWidth: CGFloat

    var body: some View {
        HStack(spacing: Spacing.s2) {
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
                .frame(width: 24, height: 24)
            VStack(alignment: .leading, spacing: Spacing.s1) {
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(width: titleWidth, height: 14)
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(width: 128, height: 10)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.top, Spacing.s4)
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s1)
        .redacted(reason: .placeholder)
    }
}

private struct DiscoverRailSkeletonCard: View {
    let height: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
            .fill(Theme.Color.appSurface)
            .frame(width: height > 100 ? 148 : 208, height: height)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .overlay {
                if height > 100 {
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .fill(Theme.Color.appSurfaceSunken)
                            .frame(height: 92)
                        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                            .fill(Theme.Color.appSurfaceSunken)
                            .frame(width: 104, height: 12)
                        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                            .fill(Theme.Color.appSurfaceSunken)
                            .frame(width: 72, height: 10)
                    }
                    .padding(Spacing.s3)
                } else {
                    HStack(spacing: Spacing.s3) {
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .fill(Theme.Color.appSurfaceSunken)
                            .frame(width: 42, height: 42)
                        VStack(alignment: .leading, spacing: Spacing.s2) {
                            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                                .fill(Theme.Color.appSurfaceSunken)
                                .frame(width: 112, height: 12)
                            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                                .fill(Theme.Color.appSurfaceSunken)
                                .frame(width: 78, height: 10)
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                    .padding(Spacing.s3)
                }
            }
            .redacted(reason: .placeholder)
            .accessibilityHidden(true)
    }
}

private struct DiscoverDiagonalSkeleton: View {
    var body: some View {
        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
            .fill(Theme.Color.appSurfaceSunken)
            .frame(maxWidth: .infinity, minHeight: 44)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
            )
            .accessibilityHidden(true)
    }
}

#Preview("Populated") {
    DiscoverHubView(viewModel: DiscoverHubViewModel())
}

#Preview("Empty") {
    DiscoverHubView(viewModel: DiscoverHubViewModel(magazineScenario: .empty))
}
