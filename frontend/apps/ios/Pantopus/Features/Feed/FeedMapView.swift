//
//  FeedMapView.swift
//  Pantopus
//
//  Pulse feed — Map mode. The A11 "Map + list hybrid" archetype narrowed
//  to a single layer: a full-bleed MapKit canvas of post pins (clustered
//  by the Explore clusterer), a floating "Search this area" pill that
//  appears once the camera leaves the fetched viewport, a recenter
//  control, and a bottom preview card for the selected pin.
//
//  Reuses `ExploreTypedPin` / `ExploreClusterDot` / `ExploreYouAreHereDot`
//  so Pulse and Explore render one pin vocabulary.
//

// swiftlint:disable line_length type_body_length

import CoreLocation
import MapKit
import SwiftUI

/// Map half of the Pulse feed's List / Map toggle.
struct FeedMapView: View {
    let viewModel: FeedMapViewModel
    /// Active surface + chip-row filter, forwarded onto the marker
    /// request. Changing either re-requests the current viewport.
    let query: FeedMapQuery
    let onOpenPost: @MainActor (String) -> Void

    @State private var cameraPosition: MapCameraPosition = .automatic
    @State private var hasSeededCamera = false

    var body: some View {
        ZStack(alignment: .top) {
            mapLayer
            if viewModel.viewportDirty {
                searchThisAreaPill
                    .padding(.top, Spacing.s3)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            overlays
        }
        .task(id: query) { await viewModel.activate(query: query) }
        .onChange(of: viewModel.region) { _, next in
            syncCamera(to: next)
        }
        .accessibilityIdentifier("pulseFeedMap")
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
                            } label: {
                                ExploreTypedPin(entity: entity, isActive: loaded.selectedId == entity.id)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("pulseMapPin_\(entity.id)")
                            .accessibilityLabel("Post: \(entity.title)")
                        }
                    case let .cluster(cluster):
                        Annotation("", coordinate: marker.coordinate, anchor: .center) {
                            Button {
                                zoomToCluster(cluster)
                            } label: {
                                ExploreClusterDot(cluster: cluster)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("pulseMapCluster_\(cluster.id)")
                            .accessibilityLabel("Cluster of \(cluster.count) posts")
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
                }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .onMapCameraChange(frequency: .onEnd) { context in
            let span = context.region.span
            viewModel.cameraDidSettle(on: FeedMapRegion(
                latitude: context.region.center.latitude,
                longitude: context.region.center.longitude,
                latitudeDelta: span.latitudeDelta,
                longitudeDelta: span.longitudeDelta
            ))
        }
        .onAppear {
            if !hasSeededCamera {
                hasSeededCamera = true
                syncCamera(to: viewModel.region)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Pulse map")
    }

    private func syncCamera(to region: FeedMapRegion) {
        cameraPosition = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: region.latitude, longitude: region.longitude),
            span: MKCoordinateSpan(
                latitudeDelta: region.latitudeDelta,
                longitudeDelta: region.longitudeDelta
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
    }

    // MARK: - Floating chrome

    private var searchThisAreaPill: some View {
        Button {
            Task { await viewModel.searchThisArea() }
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.search, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                Text("Search this area")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(height: 38)
            .background(Theme.Color.primary600)
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.18), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("pulseMapSearchThisArea")
    }

    private var overlays: some View {
        VStack(spacing: Spacing.s0) {
            Spacer(minLength: Spacing.s0)
            HStack {
                Spacer()
                recenterButton
            }
            .padding(.trailing, 14)
            statusLayer
        }
    }

    private var recenterButton: some View {
        Button {
            Task { await viewModel.recenter() }
        } label: {
            Icon(.mapPin, size: 16, color: Theme.Color.appText)
                .frame(width: 40, height: 40)
                .background(.ultraThinMaterial)
                .overlay(Circle().stroke(Theme.Color.appBorder, lineWidth: 1))
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.10), radius: 4, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Recenter map")
        .accessibilityIdentifier("pulseMapRecenter")
    }

    @ViewBuilder private var statusLayer: some View {
        switch viewModel.state {
        case .loading:
            loadingCard
        case let .error(message):
            errorCard(message)
        case let .loaded(loaded):
            if let selected = viewModel.selectedEntity {
                previewCard(selected)
            } else if loaded.isEmpty {
                emptyCard(hasHint: loaded.nearestActivityCenter != nil)
            }
        }
    }

    private var loadingCard: some View {
        HStack(spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
                .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(height: 12)
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(width: 120, height: 10)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s4)
        .accessibilityIdentifier("pulseMapLoading")
        .accessibilityLabel("Loading nearby posts")
    }

    private func errorCard(_ message: String) -> some View {
        VStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 22, color: Theme.Color.error)
            Text("Couldn't load the map")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(message)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Try again")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 40)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pulseMapRetry")
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s4)
        .accessibilityIdentifier("pulseMapError")
    }

    private func emptyCard(hasHint: Bool) -> some View {
        VStack(spacing: Spacing.s2) {
            Icon(.mapPinOff, size: 22, color: Theme.Color.primary600)
            Text("No posts in this area")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(
                hasHint
                    ? "Nothing has been posted inside this viewport yet. Jump to the nearest active neighborhood, or drag the map and search again."
                    : "Nothing has been posted inside this viewport yet. Drag the map and search again."
            )
            .font(.system(size: 12.5))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .multilineTextAlignment(.center)
            if hasHint {
                Button {
                    Task { await viewModel.jumpToNearestActivity() }
                } label: {
                    Text("Show nearest activity")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, Spacing.s5)
                        .frame(height: 40)
                        .background(Theme.Color.primary600)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pulseMapNearestActivity")
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s4)
        .accessibilityIdentifier("pulseMapEmpty")
    }

    private func previewCard(_ entity: ExploreEntity) -> some View {
        Button {
            onOpenPost(entity.id)
        } label: {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(entity.kind.color)
                    Icon(entity.kind.glyph, size: 20, color: .white)
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 3) {
                    Text(entity.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Text("\(entity.metaLead) · \(entity.distanceLabel)")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(entity.kind.color, lineWidth: 2)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(color: .black.opacity(0.10), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s4)
        .accessibilityIdentifier("pulseMapPreviewCard")
    }
}
