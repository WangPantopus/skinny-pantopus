//
//  ExploreMapView.swift
//  Pantopus
//
//  A11.2 Explore — one map, every entity type. Inherits the A11 map +
//  list hybrid scaffolding (full-bleed MapKit canvas + 3-stop draggable
//  bottom sheet) and diverges where the archetype calls out: a 5-segment
//  entity-type toggle, typed glyph pins (square for items), numbered
//  cluster pins, and Filter elevated into the top pill with an
//  active-count badge.
//

// swiftlint:disable file_length type_body_length

import CoreLocation
import MapKit
import SwiftUI

/// Explore map entry point.
public struct ExploreMapView: View {
    @State private var viewModel: ExploreMapViewModel
    @State private var cameraPosition: MapCameraPosition = .automatic
    @State private var dragTranslation: CGFloat = 0
    @State private var showFilterSheet = false
    /// BLOCK 2E — backs the per-row bookmark toggle + the Save-place sheet.
    @State private var savedStore = SavedPlacesStore()
    private let focus: ExploreMapFocus?
    private let onOpenEntity: @MainActor (ExploreEntity) -> Void
    private let onBack: (@MainActor () -> Void)?
    private let onOpenSaved: (@MainActor () -> Void)?

    public init(
        viewModel: ExploreMapViewModel = ExploreMapViewModel(),
        focus: ExploreMapFocus? = nil,
        onOpenEntity: @escaping @MainActor (ExploreEntity) -> Void = { _ in },
        onBack: (@MainActor () -> Void)? = nil,
        onOpenSaved: (@MainActor () -> Void)? = nil
    ) {
        _viewModel = State(initialValue: viewModel)
        self.focus = focus
        self.onOpenEntity = onOpenEntity
        self.onBack = onBack
        self.onOpenSaved = onOpenSaved
    }

    public var body: some View {
        @Bindable var savedBindable = savedStore
        return GeometryReader { geo in
            let totalHeight = geo.size.height
            let sheetHeight = max(120, totalHeight * viewModel.sheetStop.heightFraction + dragTranslation)
            ZStack(alignment: .top) {
                mapLayer
                floatingPill
                    .padding(.top, geo.safeAreaInsets.top + 4)
                typeToggle
                    .padding(.top, geo.safeAreaInsets.top + 50)
                mapControls(bottomInset: sheetHeight + 14)
                bottomSheet(height: sheetHeight, screenHeight: totalHeight)
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .bottom) { savedAffordanceOverlay }
        .onAppear { focusOnMap(focus) }
        .onChange(of: focus) { _, newValue in focusOnMap(newValue) }
        .task { await viewModel.load() }
        .task { await savedStore.loadIfNeeded() }
        .sheet(isPresented: $showFilterSheet) {
            ExploreFilterSheet(
                criteria: viewModel.filters,
                onApply: { viewModel.applyFilters($0) },
                onClose: { showFilterSheet = false }
            )
        }
        .sheet(item: $savedBindable.pendingSave) { pending in
            SavePlaceSheet(
                pending: pending,
                onSave: { label, choice in
                    Task { await savedStore.commitSave(label: label, choice: choice) }
                },
                onClose: { savedStore.pendingSave = nil }
            )
        }
        .accessibilityIdentifier("exploreMap")
    }

    /// Bottom-floated Undo snackbar + error toast for save/unsave mutations.
    /// Content-sized so it never blocks map gestures.
    private var savedAffordanceOverlay: some View {
        VStack(spacing: Spacing.s2) {
            if let undo = savedStore.undo {
                HStack(spacing: Spacing.s3) {
                    Icon(.checkCircle, size: 18, color: Theme.Color.appTextInverse)
                    Text("Removed \u{201C}\(undo.dto.label)\u{201D}")
                        .font(.system(size: 13.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .lineLimit(1)
                    Spacer(minLength: Spacing.s2)
                    Button { Task { await savedStore.undoRemove() } } label: {
                        Text("Undo")
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(Theme.Color.primary300)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s3)
                .background(Capsule().fill(Theme.Color.appText.opacity(0.95)))
                .padding(.horizontal, Spacing.s4)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: undo) {
                    try? await Task.sleep(nanoseconds: 4_000_000_000)
                    savedStore.dismissUndo()
                }
                .accessibilityIdentifier("savedPlaces.undoSnackbar")
            }
            if let toast = savedStore.toast {
                ToastView(message: toast)
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_500_000_000)
                        savedStore.toast = nil
                    }
            }
        }
        .padding(.bottom, Spacing.s12)
    }

    // MARK: - Map

    private var mapLayer: some View {
        Map(position: $cameraPosition, interactionModes: [.pan, .zoom]) {
            if case let .loaded(loaded) = viewModel.state {
                ForEach(loaded.markers) { marker in
                    switch marker {
                    case let .entity(entity):
                        Annotation("", coordinate: entity.coordinate, anchor: .center) {
                            Button {
                                viewModel.selectEntity(entity.id)
                                Task { @MainActor in onOpenEntity(entity) }
                            } label: {
                                ExploreTypedPin(entity: entity, isActive: loaded.selectedId == entity.id)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("explorePin_\(entity.id)")
                            .accessibilityLabel("\(entity.kind.singularLabel): \(entity.title)")
                        }
                    case let .cluster(cluster):
                        Annotation("", coordinate: marker.coordinate, anchor: .center) {
                            Button {
                                zoomToCluster(cluster)
                            } label: {
                                ExploreClusterDot(cluster: cluster)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("exploreCluster_\(cluster.id)")
                            .accessibilityLabel("Cluster of \(cluster.count) nearby pins")
                        }
                    }
                }
                if let coord = loaded.userCoordinate {
                    Annotation(
                        "",
                        coordinate: CLLocationCoordinate2D(latitude: coord.latitude, longitude: coord.longitude),
                        anchor: .center
                    ) {
                        ExploreYouAreHereDot()
                            .accessibilityLabel("You are here")
                    }
                    if loaded.isEmpty {
                        // Dashed search-radius ring — the design's empty-frame
                        // "you-are-here + radius" treatment.
                        MapCircle(
                            center: CLLocationCoordinate2D(latitude: coord.latitude, longitude: coord.longitude),
                            radius: 800
                        )
                        .foregroundStyle(Theme.Color.primary600.opacity(0.05))
                        .stroke(
                            Theme.Color.primary600.opacity(0.45),
                            style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])
                        )
                    }
                }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .onChange(of: viewModel.userCoordinate) { _, newCoord in
            if focus == nil {
                recenter(on: newCoord)
            }
        }
        // Collapse the constantly-changing MapKit a11y subtree to a single
        // labeled element (same rationale as the Nearby map) — the sheet
        // list stays the accessible affordance for the entities.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Explore map")
    }

    private func recenter(on coord: UserCoordinate?) {
        guard let coord else { return }
        cameraPosition = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: coord.latitude, longitude: coord.longitude),
            span: MKCoordinateSpan(latitudeDelta: 0.024, longitudeDelta: 0.024)
        ))
    }

    private func focusOnMap(_ target: ExploreMapFocus?) {
        guard let target else { return }
        viewModel.selectEntity(nil)
        viewModel.setSheetStop(.standard)
        cameraPosition = .region(MKCoordinateRegion(
            center: target.coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.012)
        ))
    }

    /// "Fit all" control — frame the bounding box of every visible entity.
    private func fitAll() {
        guard case let .loaded(loaded) = viewModel.state, !loaded.entities.isEmpty else {
            recenter(on: viewModel.userCoordinate)
            return
        }
        let lats = loaded.entities.map(\.latitude)
        let lons = loaded.entities.map(\.longitude)
        let minLat = lats.min() ?? 0, maxLat = lats.max() ?? 0
        let minLon = lons.min() ?? 0, maxLon = lons.max() ?? 0
        cameraPosition = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2),
            span: MKCoordinateSpan(
                latitudeDelta: max((maxLat - minLat) * 1.4, 0.01),
                longitudeDelta: max((maxLon - minLon) * 1.4, 0.01)
            )
        ))
    }

    private func zoomToCluster(_ cluster: ExploreCluster) {
        let latDelta = max((cluster.maxLatitude - cluster.minLatitude) * 1.4, 0.004)
        let lonDelta = max((cluster.maxLongitude - cluster.minLongitude) * 1.4, 0.004)
        cameraPosition = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: (cluster.minLatitude + cluster.maxLatitude) / 2,
                longitude: (cluster.minLongitude + cluster.maxLongitude) / 2
            ),
            span: MKCoordinateSpan(latitudeDelta: latDelta, longitudeDelta: lonDelta)
        ))
        viewModel.setClusterRadius(max(latDelta, lonDelta) * 0.25)
    }

    // MARK: - Floating pill (back · Explore · Filter)

    private var floatingPill: some View {
        HStack(spacing: Spacing.s0) {
            Button {
                onBack?()
            } label: {
                Icon(.chevronLeft, size: 18, strokeWidth: 2.2, color: Theme.Color.appText)
                    .frame(width: 44, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .opacity(onBack == nil ? 0 : 1)
            .disabled(onBack == nil)
            Spacer(minLength: Spacing.s1)
            Text("Explore")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Spacing.s1)
            savedButton
            filterButton
        }
        .padding(.horizontal, 6)
        .padding(.vertical, Spacing.s2)
        .background(.ultraThinMaterial)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.10), radius: 8, x: 0, y: 4)
        .padding(.horizontal, 14)
        .accessibilityIdentifier("exploreFloatingPill")
    }

    /// BLOCK 2E entry point — opens the Saved-places list. Hidden when the
    /// host doesn't provide a destination (e.g. previews).
    @ViewBuilder private var savedButton: some View {
        if let onOpenSaved {
            Button {
                onOpenSaved()
            } label: {
                HStack(spacing: 5) {
                    Icon(.bookmark, size: 14, strokeWidth: 2.4, color: Theme.Color.primary700)
                    Text("Saved")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Color.primary700)
                }
                .padding(.horizontal, 11)
                .frame(height: 32)
                .background(Theme.Color.primary50)
                .overlay(Capsule().stroke(Theme.Color.primary200, lineWidth: 1))
                .clipShape(Capsule())
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Saved places")
            .accessibilityIdentifier("savedPlaces.entry.explore")
        }
    }

    /// Primary action: Filter — pill-shaped, primary-tinted, with an
    /// active-count badge. (Design elevates Filter into the pill — no FAB.)
    private var filterButton: some View {
        Button {
            showFilterSheet = true
        } label: {
            HStack(spacing: 5) {
                Icon(.slidersHorizontal, size: 14, strokeWidth: 2.4, color: Theme.Color.primary700)
                Text("Filter")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
                if viewModel.filters.activeCount > 0 {
                    Text("\(viewModel.filters.activeCount)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .frame(minWidth: 16, minHeight: 16)
                        .padding(.horizontal, Spacing.s1)
                        .background(Theme.Color.primary600)
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 11)
            .frame(height: 32)
            .background(Theme.Color.primary50)
            .overlay(Capsule().stroke(Theme.Color.primary200, lineWidth: 1))
            .clipShape(Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            viewModel.filters.activeCount > 0
                ? "Filter, \(viewModel.filters.activeCount) active"
                : "Filter"
        )
        .accessibilityIdentifier("exploreFilterButton")
    }

    // MARK: - Type toggle

    private var typeToggle: some View {
        HStack(spacing: 2) {
            segment(kind: nil, label: "All")
            ForEach(ExploreKind.allCases) { kind in
                segment(kind: kind, label: kind.pluralLabel)
            }
        }
        .padding(3)
        .background(.ultraThinMaterial)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
        .padding(.horizontal, 14)
        .accessibilityIdentifier("exploreTypeToggle")
    }

    private func segment(kind: ExploreKind?, label: String) -> some View {
        let active = kind == viewModel.activeKind
        return Button {
            viewModel.selectKind(kind)
        } label: {
            HStack(spacing: Spacing.s1) {
                if let kind {
                    Group {
                        if kind.isSquarePin {
                            RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                                .fill(active ? Theme.Color.appTextInverse : kind.color)
                        } else {
                            Circle().fill(active ? Theme.Color.appTextInverse : kind.color)
                        }
                    }
                    .frame(width: 6, height: 6)
                }
                Text(label)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 28)
            .background(active ? Theme.Color.appText : Color.clear)
            .clipShape(Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("exploreTypeSegment_\(kind?.rawValue ?? "all")")
    }

    // MARK: - Map controls

    private func mapControls(bottomInset: CGFloat) -> some View {
        VStack(spacing: Spacing.s2) {
            mapControlButton(icon: .mapPin, label: "Locate me") {
                Task { await viewModel.locate() }
            }
            mapControlButton(icon: .map, label: "Fit all pins") {
                fitAll()
            }
        }
        .padding(.trailing, 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        .padding(.bottom, bottomInset)
    }

    private func mapControlButton(
        icon: PantopusIcon,
        label: String,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        Button(action: action) {
            Icon(icon, size: 16, color: Theme.Color.appText)
                .frame(width: 38, height: 38)
                .background(.ultraThinMaterial)
                .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.10), radius: 4, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier("exploreControl_\(label == "Locate me" ? "locate" : "fitAll")")
    }

    // MARK: - Bottom sheet

    private func bottomSheet(height: CGFloat, screenHeight: CGFloat) -> some View {
        VStack(spacing: Spacing.s0) {
            Spacer(minLength: Spacing.s0)
            VStack(spacing: Spacing.s0) {
                Capsule()
                    .fill(Theme.Color.appBorderStrong)
                    .frame(width: 40, height: 4)
                    .padding(.top, Spacing.s2)
                    .padding(.bottom, Spacing.s1)
                    .accessibilityHidden(true)
                sheetHeader
                sheetBody
                    .frame(maxHeight: .infinity, alignment: .top)
            }
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 10, x: 0, y: -10)
            .gesture(
                DragGesture()
                    .onChanged { gesture in
                        dragTranslation = -gesture.translation.height
                    }
                    .onEnded { gesture in
                        let velocity = -gesture.predictedEndTranslation.height
                        let target = nextStop(from: viewModel.sheetStop, velocity: velocity, screenHeight: screenHeight)
                        withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
                            viewModel.setSheetStop(target)
                            dragTranslation = 0
                        }
                    }
            )
        }
        .accessibilityIdentifier("exploreSheet")
    }

    private func nextStop(from current: ExploreSheetStop, velocity: CGFloat, screenHeight: CGFloat) -> ExploreSheetStop {
        let displacedHeight = screenHeight * current.heightFraction + dragTranslation
        let displacedFraction = displacedHeight / screenHeight
        let candidates = ExploreSheetStop.allCases
            .sorted { abs($0.heightFraction - displacedFraction) < abs($1.heightFraction - displacedFraction) }
        var closest = candidates.first ?? current
        let velocityThreshold: CGFloat = 600
        if velocity > velocityThreshold {
            if current == .collapsed { closest = .standard } else if current == .standard { closest = .expanded }
        } else if velocity < -velocityThreshold {
            if current == .expanded { closest = .standard } else if current == .standard { closest = .collapsed }
        }
        return closest
    }

    private var sheetHeader: some View {
        HStack {
            Text(headerCountLabel)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityIdentifier("exploreSheetCount")
            if viewModel.filters.activeCount > 0 {
                ExploreActiveFilterChip(count: viewModel.filters.activeCount)
                    .padding(.leading, Spacing.s1)
            }
            Spacer()
            Menu {
                ForEach(ExploreSort.allCases) { sort in
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
            .accessibilityIdentifier("exploreSheetSort")
        }
        .padding(.horizontal, 18)
        .padding(.top, Spacing.s1)
        .padding(.bottom, Spacing.s3)
    }

    private var headerCountLabel: String {
        guard case let .loaded(loaded) = viewModel.state else { return "Explore" }
        var label = "\(loaded.entities.count) nearby"
        if viewModel.filters.activeCount > 0 {
            label += " · \(viewModel.filters.activeCount) filters on"
        }
        return label
    }

    @ViewBuilder private var sheetBody: some View {
        switch viewModel.state {
        case .loading:
            ExploreSkeletonRail()
        case let .error(message):
            errorBody(message)
        case let .loaded(loaded):
            if loaded.isEmpty {
                emptyBody
            } else {
                switch viewModel.sheetStop {
                case .collapsed: collapsedBody
                case .standard: standardBody(loaded)
                case .expanded: expandedBody(loaded)
                }
            }
        }
    }

    private func errorBody(_ message: String) -> some View {
        VStack(spacing: 10) {
            Icon(.alertCircle, size: 28, color: Theme.Color.error)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Try again")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s4)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("exploreRetry")
        }
        .padding()
        .frame(maxWidth: .infinity)
    }

    private var collapsedBody: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.chevronUp, size: 13, strokeWidth: 2.4, color: Theme.Color.appTextSecondary)
            Text("Drag up to see the list")
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 36)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s3)
        .accessibilityIdentifier("exploreCollapsedPrompt")
        .onTapGesture {
            withAnimation(.interpolatingSpring(stiffness: 320, damping: 30)) {
                viewModel.setSheetStop(.standard)
            }
        }
    }

    private func standardBody(_ loaded: ExploreMapLoaded) -> some View {
        VStack(spacing: Spacing.s0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(loaded.entities.prefix(12)) { entity in
                        ExploreEntityCard(
                            entity: entity,
                            selected: loaded.selectedId == entity.id,
                            isSaved: savedStore.isSaved(
                                geocodePlaceId: entity.geocodePlaceId,
                                latitude: entity.latitude,
                                longitude: entity.longitude
                            ),
                            onToggleSave: {
                                savedStore.toggle(pendingPlace(for: entity))
                            },
                            onTap: {
                                viewModel.selectEntity(entity.id)
                                onOpenEntity(entity)
                            }
                        )
                    }
                }
                .padding(.horizontal, Spacing.s4)
            }
            .accessibilityIdentifier("exploreSheetRail")
            ExplorePaginationDots(total: min(loaded.entities.count, 4), index: 0)
                .padding(.vertical, Spacing.s3)
        }
    }

    private func expandedBody(_ loaded: ExploreMapLoaded) -> some View {
        ScrollView {
            LazyVStack(spacing: Spacing.s0) {
                ForEach(loaded.entities) { entity in
                    ExploreEntityRow(
                        entity: entity,
                        selected: loaded.selectedId == entity.id,
                        isSaved: savedStore.isSaved(
                            geocodePlaceId: entity.geocodePlaceId,
                            latitude: entity.latitude,
                            longitude: entity.longitude
                        ),
                        onTap: {
                            viewModel.selectEntity(entity.id)
                            onOpenEntity(entity)
                        },
                        onToggleSave: {
                            savedStore.toggle(pendingPlace(for: entity))
                        }
                    )
                }
                Spacer(minLength: 80)
            }
        }
        .accessibilityIdentifier("exploreSheetList")
    }

    // MARK: - Empty hero (designed empty frame)

    private var emptyBody: some View {
        VStack(spacing: Spacing.s0) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .fill(Theme.Color.primary50)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                            .stroke(Theme.Color.primary100, lineWidth: 1)
                    )
                    .frame(width: 56, height: 56)
                Icon(.compass, size: 24, color: Theme.Color.primary600)
            }
            .accessibilityHidden(true)
            .padding(.bottom, Spacing.s3)

            Text("No activity in this area yet")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .padding(.bottom, 5)

            Text("3 filters are narrowing this view. Try clearing them, or widen the area to surface neighbors a little further out.")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 264)
                .padding(.bottom, 14)

            HStack(spacing: Spacing.s2) {
                Button {
                    viewModel.clearFilters()
                } label: {
                    HStack(spacing: 6) {
                        Icon(.x, size: 13, strokeWidth: 2.6, color: Theme.Color.appTextInverse)
                        Text("Clear filters")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("exploreClearFilters")

                Button {
                    viewModel.widenArea()
                } label: {
                    HStack(spacing: 6) {
                        Icon(.globe, size: 13, strokeWidth: 2.2, color: Theme.Color.appTextStrong)
                        Text("Widen area")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextStrong)
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 44)
                    .background(Theme.Color.appSurface)
                    .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("exploreWidenArea")
            }
        }
        .padding(.horizontal, 28)
        .padding(.top, 10)
        .frame(maxWidth: .infinity, alignment: .top)
        .accessibilityIdentifier("exploreEmptyState")
    }

    private func pendingPlace(for entity: ExploreEntity) -> PendingSavePlace {
        PendingSavePlace(
            label: entity.title,
            latitude: entity.latitude,
            longitude: entity.longitude,
            city: entity.city,
            state: entity.stateName,
            geocodePlaceId: entity.geocodePlaceId,
            sourceId: entity.sourceId
        )
    }
}

// MARK: - Pin

struct ExploreTypedPin: View {
    let entity: ExploreEntity
    let isActive: Bool
    @State private var pulse = false

    private var shape: AnyShape {
        entity.kind.isSquarePin
            ? AnyShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            : AnyShape(Circle())
    }

    var body: some View {
        ZStack {
            if isActive {
                shape
                    .fill(entity.kind.color.opacity(0.25))
                    .frame(width: 46, height: 46)
                    .scaleEffect(pulse ? 1.2 : 0.85)
                    .opacity(pulse ? 0 : 1)
                    .animation(.easeOut(duration: 1.6).repeatForever(autoreverses: false), value: pulse)
            }
            shape
                .fill(entity.kind.color)
                .frame(width: 26, height: 26)
                .overlay(
                    shape.stroke(entity.state == .confirmed ? Color.white : .clear, lineWidth: 2)
                )
                .overlay(
                    shape
                        .stroke(
                            entity.state == .pending ? entity.kind.color : .clear,
                            style: StrokeStyle(lineWidth: 2, dash: [3, 2])
                        )
                        .scaleEffect(1.3)
                )
                .shadow(color: .black.opacity(0.30), radius: 2, x: 0, y: 2)
            Icon(entity.kind.glyph, size: 13, strokeWidth: 2.4, color: .white)
        }
        .frame(width: 50, height: 50)
        .onAppear { if isActive { pulse = true } }
        .onChange(of: isActive) { _, newValue in pulse = newValue }
    }
}

/// Cluster glyph — larger disc with the entity count.
struct ExploreClusterDot: View {
    let cluster: ExploreCluster

    var body: some View {
        ZStack {
            Circle()
                .fill(cluster.kind.color.opacity(0.20))
                .frame(width: 44, height: 44)
            Circle()
                .fill(cluster.kind.color)
                .frame(width: 38, height: 38)
                .overlay(Circle().stroke(Color.white, lineWidth: 3))
                .shadow(color: .black.opacity(0.30), radius: 4, x: 0, y: 2)
            Text("\(cluster.count)")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
        }
    }
}

struct ExploreYouAreHereDot: View {
    var body: some View {
        Circle()
            .fill(Theme.Color.primary600)
            .frame(width: 14, height: 14)
            .overlay(Circle().stroke(Color.white, lineWidth: 3))
            .background(
                Circle()
                    .fill(Theme.Color.primary600.opacity(0.18))
                    .frame(width: 28, height: 28)
            )
    }
}

// MARK: - Rail card / list row

/// Resolve a badge tone to its token color pair (bg, fg).
private func exploreBadgeColors(_ tone: ExploreBadge.Tone) -> (Color, Color) {
    switch tone {
    case .bids: (Theme.Color.warningBg, Theme.Color.warning)
    case .new: (Theme.Color.homeBg, Theme.Color.home)
    case .replies: (Theme.Color.primary50, Theme.Color.primary700)
    case .rating: (Theme.Color.warningBg, Theme.Color.warning)
    }
}

private struct ExploreBadgeChip: View {
    let badge: ExploreBadge

    var body: some View {
        let colors = exploreBadgeColors(badge.tone)
        Text(badge.text)
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(colors.1)
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(colors.0)
            .clipShape(Capsule())
    }
}

private struct ExploreActiveFilterChip: View {
    let count: Int

    var body: some View {
        Text("\(count)")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(minWidth: 16, minHeight: 16)
            .padding(.horizontal, 5)
            .background(Theme.Color.primary600)
            .clipShape(Capsule())
            .accessibilityLabel("\(count) active filters")
            .accessibilityIdentifier("exploreSheetFilterCount")
    }
}

private struct ExploreKindTag: View {
    let kind: ExploreKind

    var body: some View {
        Text(kind.singularLabel.uppercased())
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(kind.color)
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(kind.color.opacity(0.12))
            .clipShape(Capsule())
    }
}

private struct ExploreEntityCard: View {
    let entity: ExploreEntity
    let selected: Bool
    let isSaved: Bool
    let onToggleSave: () -> Void
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onTap) {
                HStack(spacing: 10) {
                    tile
                    textColumn
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            SaveBookmarkButton(isSaved: isSaved, size: 30, onToggle: onToggleSave)
        }
        .padding(Spacing.s3)
        .frame(width: 240, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(selected ? entity.kind.color : Theme.Color.appBorder, lineWidth: selected ? 2 : 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 2)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("exploreCard_\(entity.id)")
    }

    private var tile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: entity.kind.isSquarePin ? 8 : 10, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [entity.kind.color, entity.kind.color.opacity(0.8)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Icon(entity.kind.glyph, size: 22, color: .white)
        }
        .frame(width: 48, height: 48)
    }

    private var textColumn: some View {
        VStack(alignment: .leading, spacing: 3) {
            ExploreKindTag(kind: entity.kind)
            Text(entity.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            HStack(spacing: Spacing.s2) {
                Text("\(entity.metaLead) · \(entity.distanceLabel)")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
                if let badge = entity.badge {
                    Spacer(minLength: Spacing.s0)
                    ExploreBadgeChip(badge: badge)
                }
            }
        }
    }
}

private struct ExploreEntityRow: View {
    let entity: ExploreEntity
    let selected: Bool
    let isSaved: Bool
    let onTap: () -> Void
    let onToggleSave: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Button(action: onTap) {
                HStack(spacing: Spacing.s3) {
                    tile
                    textColumn
                    Spacer(minLength: Spacing.s0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            // BLOCK 2E — bookmark toggle (saved if the coordinate matches a
            // GET /api/saved-places entry); a sibling button so its tap is
            // independent of the row's open-detail tap.
            SaveBookmarkButton(isSaved: isSaved, size: 32, onToggle: onToggleSave)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .background(selected ? entity.kind.color.opacity(0.06) : Theme.Color.appSurface)
        .overlay(
            Rectangle()
                .fill(Theme.Color.appBorder.opacity(0.5))
                .frame(height: 1),
            alignment: .bottom
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("exploreRow_\(entity.id)")
    }

    private var tile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: entity.kind.isSquarePin ? 8 : 10, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [entity.kind.color, entity.kind.color.opacity(0.8)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Icon(entity.kind.glyph, size: 20, color: .white)
        }
        .frame(width: 44, height: 44)
    }

    private var textColumn: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                ExploreKindTag(kind: entity.kind)
                Text(entity.distanceLabel)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Text(entity.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            HStack(spacing: Spacing.s2) {
                Text(entity.metaLead)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                if let badge = entity.badge {
                    ExploreBadgeChip(badge: badge)
                }
            }
        }
    }
}

// MARK: - Loading shimmer + pagination

/// Loading state — skeleton cards matching the populated rail geometry
/// (never a bare spinner, per the four-state rule).
private struct ExploreSkeletonRail: View {
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(0..<4, id: \.self) { _ in
                    HStack(spacing: 10) {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Theme.Color.appSurfaceSunken)
                            .frame(width: 48, height: 48)
                        VStack(alignment: .leading, spacing: 6) {
                            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                                .fill(Theme.Color.appSurfaceSunken)
                                .frame(width: 44, height: 10)
                            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                                .fill(Theme.Color.appSurfaceSunken)
                                .frame(height: 12)
                            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                                .fill(Theme.Color.appSurfaceSunken)
                                .frame(width: 90, height: 10)
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
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
        .accessibilityIdentifier("exploreSkeletonRail")
        .accessibilityLabel("Loading nearby activity")
    }
}

private struct ExplorePaginationDots: View {
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
        .accessibilityHidden(true)
    }
}

#Preview("Populated") {
    ExploreMapView(viewModel: ExploreMapViewModel(scenario: .populated))
}

#Preview("Empty") {
    ExploreMapView(viewModel: ExploreMapViewModel(scenario: .empty))
}
