//
//  TasksMapView.swift
//  Pantopus
//
//  A11.1 Tasks map — the Gigs-only mode of the MapListHybrid archetype.
//  Same canvas as the generic Nearby map (`NearbyMapView`), filtered to
//  tasks, titled "Tasks map", and topped with a primary "Post task" FAB
//  stacked above the locate / layers / focus-pins controls.
//
//  Reached from the Gigs feed's list/map toggle. The floating-pill chevron
//  returns to the list.
//
//  Accessibility identifiers follow the canonical `tasksMap.*` grammar —
//  Android mirrors them verbatim as test tags.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

/// Tasks map entry point.
public struct TasksMapView: View {
    @State private var viewModel: TasksMapViewModel
    @State private var detent: MapListHybridDetent = .standard
    @State private var recenterToken = 0
    @State private var showFilterSheet = false
    /// Rail scroll-snap position (item id) — kept in lockstep with
    /// `viewModel.selectedId` for the pin↔card sync.
    @State private var railPosition: String?

    private let onOpenTask: @MainActor (String) -> Void
    private let onCompose: @MainActor (GigsCategory) -> Void
    private let onBack: (@MainActor () -> Void)?

    /// FAB (48) + three 38 pt controls + three 8 pt gaps.
    private static let controlsStackHeight: CGFloat = 186

    init(
        viewModel: TasksMapViewModel = TasksMapViewModel(),
        onOpenTask: @escaping @MainActor (String) -> Void = { _ in },
        onCompose: @escaping @MainActor (GigsCategory) -> Void = { _ in },
        onBack: (@MainActor () -> Void)? = nil
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onOpenTask = onOpenTask
        self.onCompose = onCompose
        self.onBack = onBack
    }

    public var body: some View {
        MapListHybridShell(
            pins: viewModel.mapPins,
            clusters: viewModel.mapClusters,
            anchor: viewModel.anchor,
            selectedPinId: viewModel.selectedId,
            recenterTrigger: recenterToken,
            showSearchRadius: {
                if case .empty = viewModel.state { return true }
                return false
            }(),
            cameraRequest: viewModel.cameraTarget,
            markerAccessibilityPrefix: "tasksMap",
            controlsStackHeight: Self.controlsStackHeight,
            detent: $detent,
            onPinTap: { id in
                viewModel.select(id)
                snapTo(.standard)
            },
            onClusterTap: { id in
                viewModel.tapCluster(id: id)
            },
            onCameraChange: { region in
                viewModel.cameraSettled(on: region)
            },
            topPill: { topChrome },
            categoryChips: { EmptyView() },
            mapControls: { mapControls },
            floatingAction: { EmptyView() },
            sheetHeader: { sheetHeader },
            sheetBody: { sheetBody }
        )
        .toolbar(.hidden, for: .navigationBar)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await viewModel.load() }
        .sheet(isPresented: $showFilterSheet) {
            // P2 follow-up — criteria live in the VM so the layers sheet
            // actually filters the pins (not just the badge).
            GigFilterSheet(
                criteria: viewModel.filterCriteria,
                onApply: { viewModel.applyFilters($0) },
                onClose: { showFilterSheet = false }
            )
        }
        .onChange(of: viewModel.selectedId) { _, newValue in
            guard let newValue, railPosition != newValue else { return }
            withAnimation(.easeInOut(duration: 0.25)) {
                railPosition = newValue
            }
        }
        .accessibilityIdentifier("tasksMap")
    }

    private func snapTo(_ target: MapListHybridDetent) {
        withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
            detent = target
        }
    }

    // MARK: - Top chrome (title pill · chips · search-this-area)

    private var topChrome: some View {
        VStack(spacing: Spacing.s2) {
            titlePill
            categoryChipStrip
            if viewModel.showsSearchThisArea {
                searchThisAreaPill
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.horizontal, 14)
        .animation(.easeInOut(duration: 0.2), value: viewModel.showsSearchThisArea)
    }

    /// A11.1 top floating pill — back chevron · centered "Tasks map" ·
    /// filters icon with an active-filter-count badge.
    private var titlePill: some View {
        ZStack {
            Text("Tasks map")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            HStack {
                if onBack != nil {
                    Button { onBack?() } label: {
                        Icon(.chevronLeft, size: 18, strokeWidth: 2.2, color: Theme.Color.appText)
                            .frame(width: 32, height: 32)
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Back to list")
                    .accessibilityIdentifier("tasksMap.backPill")
                } else {
                    Color.clear.frame(width: 32, height: 32)
                }
                Spacer(minLength: Spacing.s0)
                filtersButton
            }
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 44)
        .background(Theme.Color.appSurface.opacity(0.96))
        .background(.ultraThinMaterial)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.10), radius: 6, x: 0, y: 4)
    }

    private var filtersButton: some View {
        let activeCount = viewModel.filterCriteria.activeCount
        return Button { showFilterSheet = true } label: {
            ZStack(alignment: .topTrailing) {
                Icon(.slidersHorizontal, size: 16, strokeWidth: 2.2, color: Theme.Color.appText)
                    .frame(width: 32, height: 32)
                if activeCount > 0 {
                    Text("\(activeCount)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .frame(minWidth: 14, minHeight: 14)
                        .background(Circle().fill(Theme.Color.primary600))
                        .offset(x: 2, y: -2)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(activeCount > 0 ? "Filters, \(activeCount) active" : "Filters")
        .accessibilityIdentifier("tasksMap.filters")
    }

    private var categoryChipStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(GigsCategory.allCases, id: \.self) { category in
                    categoryChipButton(category)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("tasksMapCategoryChips")
    }

    private func categoryChipButton(_ category: GigsCategory) -> some View {
        let active = category == viewModel.activeCategory
        return Button {
            viewModel.selectCategory(category)
        } label: {
            HStack(spacing: 5) {
                if category != .all {
                    Circle()
                        .fill(active ? Theme.Color.appTextInverse : category.color)
                        .frame(width: 7, height: 7)
                }
                Text(category.label)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 28)
            .background(active ? category.color : Theme.Color.appSurface.opacity(0.96))
            .overlay(Capsule().stroke(active ? .clear : Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("tasksMap.chip_\(category.rawValue)")
    }

    /// Floating refetch affordance — shown when the camera settles on a
    /// viewport significantly away from the last-fetched region.
    private var searchThisAreaPill: some View {
        Button { Task { await viewModel.searchThisArea() } } label: {
            HStack(spacing: 6) {
                Icon(.refreshCw, size: 13, strokeWidth: 2.4, color: Theme.Color.primary600)
                Text("Search this area")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.horizontal, 14)
            .frame(height: 34)
            .background(Theme.Color.appSurface.opacity(0.96))
            .background(.ultraThinMaterial)
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.10), radius: 6, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("tasksMap.searchThisArea")
    }

    // MARK: - Map controls (locate / layers / focus-pins, "Post task" pill

    // at the bottom of the stack — product call, diverges from the A11.1
    // frame which drew the FAB on top)

    private var mapControls: some View {
        VStack(alignment: .trailing, spacing: Spacing.s2) {
            controlButton(icon: .locateFixed, label: "Locate me", identifier: "tasksMap.locate") {
                Task { await viewModel.locate() }
                recenterToken += 1
            }
            controlButton(icon: .layers, label: "Map layers", identifier: "tasksMap.layers") {
                showFilterSheet = true
            }
            controlButton(icon: .maximize, label: "Fit all tasks", identifier: "tasksMap.focusPins") {
                viewModel.focusOnPins()
            }
            postTaskFAB
        }
    }

    private var postTaskFAB: some View {
        Button { onCompose(viewModel.activeCategory) } label: {
            HStack(spacing: 7) {
                Icon(.plus, size: 18, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                Text("Post task")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.leading, 14)
            .padding(.trailing, 18)
            .frame(height: 48)
            .background(Theme.Color.primary600)
            .clipShape(Capsule())
            .shadow(color: Theme.Color.primary600.opacity(0.36), radius: 12, x: 0, y: 10)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Post task")
        .accessibilityIdentifier("tasksMap.postTask")
    }

    private func controlButton(
        icon: PantopusIcon,
        label: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Icon(icon, size: 16, color: Theme.Color.appText)
                .frame(width: 38, height: 38)
                .background(Theme.Color.appSurface.opacity(0.96))
                .background(.ultraThinMaterial)
                .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.10), radius: 4, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier)
    }

    // MARK: - Sheet header

    private var sheetHeader: some View {
        HStack {
            Text("\(headerCount) \(headerCount == 1 ? "task" : "tasks") nearby")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("tasksMapCount")
            Spacer()
            Menu {
                ForEach(GigsSort.allCases) { sort in
                    Button {
                        viewModel.selectSort(sort)
                    } label: {
                        if sort == viewModel.activeSort {
                            Label(sort.label, systemImage: "checkmark")
                        } else {
                            Text(sort.label)
                        }
                    }
                }
            } label: {
                HStack(spacing: Spacing.s1) {
                    Text("Sort:")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text(viewModel.activeSort.label)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Icon(.chevronDown, size: 12, strokeWidth: 2.4, color: Theme.Color.appTextStrong)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("tasksMap.sheet.sort")
        }
        .padding(.horizontal, 18)
        .padding(.top, Spacing.s1)
        .padding(.bottom, Spacing.s3)
    }

    private var headerCount: Int {
        if case let .populated(items) = viewModel.state {
            return items.count
        }
        return 0
    }

    // MARK: - Sheet body (four states × detent projection)

    @ViewBuilder private var sheetBody: some View {
        switch viewModel.state {
        case .loading:
            loadingBody
        case let .populated(items):
            populatedBody(items)
        case .empty:
            emptyBody
        case let .error(message):
            errorBody(message)
        }
    }

    /// Populated body per detent: header-only when collapsed, the card
    /// rail at the standard stop, the full vertical list when expanded.
    @ViewBuilder private func populatedBody(_ items: [TaskMapItem]) -> some View {
        switch TasksMapSheetMode.mode(for: detent) {
        case .headerOnly:
            Spacer(minLength: Spacing.s0)
        case .rail:
            railBody(items)
        case .fullList:
            fullListBody(items)
        }
    }

    private var loadingBody: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(0..<3, id: \.self) { _ in
                    TaskRailCard(item: Self.placeholderItem, selected: false) {}
                        .redacted(reason: .placeholder)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s3)
        }
        .accessibilityIdentifier("tasksMapLoading")
        .accessibilityLabel("Loading tasks")
    }

    private func railBody(_ items: [TaskMapItem]) -> some View {
        VStack(spacing: Spacing.s0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(items) { item in
                        TaskRailCard(item: item, selected: item.id == viewModel.selectedId) {
                            viewModel.select(item.id)
                            onOpenTask(item.id)
                        }
                    }
                }
                .scrollTargetLayout()
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s3)
            }
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: $railPosition)
            .accessibilityIdentifier("tasksMapRail")
            PaginationDots(total: items.count, index: viewModel.selectedIndex ?? 0)
                .padding(.bottom, Spacing.s3)
        }
        .onAppear {
            railPosition = viewModel.selectedId
        }
        .onChange(of: railPosition) { _, newValue in
            // Rail page settled → select that pin + pan the camera to it.
            guard let newValue, newValue != viewModel.selectedId,
                  let index = items.firstIndex(where: { $0.id == newValue }) else { return }
            viewModel.selectIndex(index)
        }
    }

    /// Expanded detent — full vertical list reusing the feed's `GigRow`.
    private func fullListBody(_ items: [TaskMapItem]) -> some View {
        ScrollView {
            LazyVStack(spacing: Spacing.s2) {
                ForEach(items) { item in
                    Button {
                        viewModel.select(item.id)
                        onOpenTask(item.id)
                    } label: {
                        GigRow(content: item.cardContent)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("tasksMap.fullListRow_\(item.id)")
                }
                Spacer(minLength: Spacing.s10)
            }
            .padding(.horizontal, Spacing.s3)
        }
        .accessibilityIdentifier("tasksMap.fullList")
    }

    private var emptyBody: some View {
        VStack(spacing: Spacing.s0) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .fill(Theme.Color.primary50)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                            .stroke(Theme.Color.primary100, lineWidth: 1)
                    )
                Icon(.mapPinOff, size: 24, color: Theme.Color.primary600)
            }
            .frame(width: 56, height: 56)
            .padding(.bottom, Spacing.s3)
            .accessibilityHidden(true)
            Text("No tasks in this area yet")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .padding(.bottom, 5)
            Text("Be the first to post one — verified neighbors within a half-mile will see it.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 248)
                .padding(.bottom, 14)
            HStack(spacing: Spacing.s2) {
                Button { onCompose(viewModel.activeCategory) } label: {
                    HStack(spacing: 6) {
                        Icon(.plus, size: 14, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                        Text("Post a task")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 36)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("tasksMap.empty.postTask")
                emptySecondaryButton
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, 28)
        .padding(.top, Spacing.s3)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("tasksMapEmpty")
    }

    /// Widen → jump-to-activity ladder (see `TasksMapEmptyAction`).
    @ViewBuilder private var emptySecondaryButton: some View {
        switch viewModel.emptyAction {
        case .widen:
            outlinedEmptyButton(
                title: "Widen search",
                icon: .search,
                identifier: "tasksMap.empty.widenSearch"
            ) {
                Task { await viewModel.widenSearch() }
            }
        case .jumpToActivity:
            outlinedEmptyButton(
                title: "Jump to activity",
                icon: .navigation,
                identifier: "tasksMap.empty.jumpToActivity"
            ) {
                Task { await viewModel.jumpToActivity() }
            }
        }
    }

    private func outlinedEmptyButton(
        title: String,
        icon: PantopusIcon,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Icon(icon, size: 13, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(Theme.Color.appSurface)
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: 10) {
            Icon(.alertCircle, size: 28, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button { Task { await viewModel.refresh() } } label: {
                Text("Try again")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s4)
                    .frame(height: 38)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("tasksMapRetry")
        }
        .padding(.horizontal, Spacing.s6)
        .padding(.top, Spacing.s1)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("tasksMapError")
    }

    private static let placeholderItem = TaskMapItem(
        id: "placeholder",
        category: .handyman,
        latitude: 0,
        longitude: 0,
        title: "Loading a task title that wraps",
        price: "$00",
        distanceLabel: "0.0 mi",
        bidCount: 0
    )
}

// MARK: - Rail card

private struct TaskRailCard: View {
    let item: TaskMapItem
    let selected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [item.category.color, item.category.color.opacity(0.8)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    Icon(taskCategoryGlyph(item.category), size: 22, color: .white)
                }
                .frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text(item.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: Spacing.s2) {
                        Text(item.price)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.primary600)
                        Text("· \(item.distanceLabel)")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        Spacer(minLength: Spacing.s0)
                        if item.bidCount > 0 {
                            Text("\(item.bidCount) \(item.bidCount == 1 ? "bid" : "bids")")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Theme.Color.warning)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 1)
                                .background(Theme.Color.warningBg)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
            .padding(Spacing.s3)
            .frame(width: 240, alignment: .leading)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(selected ? item.category.color : Theme.Color.appBorder, lineWidth: selected ? 2 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 2)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier("tasksMap.railCard_\(item.id)")
        .accessibilityLabel(accessibilityText)
    }

    private var accessibilityText: String {
        var parts = [item.title, item.price, item.distanceLabel]
        if item.bidCount > 0 {
            parts.append("\(item.bidCount) bids")
        }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Pagination dots

private struct PaginationDots: View {
    let total: Int
    let index: Int

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<max(total, 1), id: \.self) { i in
                Capsule()
                    .fill(i == index ? Theme.Color.primary600 : Theme.Color.appBorderStrong)
                    .frame(width: i == index ? 16 : 5, height: 5)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Page \(min(index + 1, max(total, 1))) of \(max(total, 1))")
        .accessibilityIdentifier("tasksMap.pageDots")
    }
}

#if DEBUG
#Preview("Populated") {
    TasksMapView(viewModel: TasksMapViewModel(seed: TasksMapSampleData.items))
}

#Preview("Empty") {
    TasksMapView(viewModel: TasksMapViewModel(seed: []))
}
#endif
