//
//  FeedMapView.swift
//  Pantopus
//
//  Pulse feed — Map mode. The A11 "Map + list hybrid" archetype narrowed
//  to a single layer: a full-bleed MapKit canvas of post pins (clustered
//  by the Explore clusterer), a floating "Search this area" pill that
//  appears once the camera leaves the fetched viewport, a recenter
//  control, and a bottom preview card for the selected pin (or the posts
//  of a tapped cluster that zooming can't split).
//
//  The map fills the whole screen under the Pulse header (founder request
//  2026-10-22) and opens in 3D: realistic elevation, a camera tilted to
//  45° that flies in from above, tilt and turn gestures, and the system's
//  compass and 2D / 3D toggle. Pins wear their post's intent colour and
//  glyph; posts from the last day ripple; clusters show their intent mix.
//  Dragging the map reports how far its content moved, so the header can
//  hide and come back as a list's would.
//
//  Reuses `ExploreYouAreHereDot` and the Explore clusterer, so Pulse and
//  Explore group pins the same way.
//

// swiftlint:disable line_length type_body_length file_length

import CoreLocation
import MapKit
import SwiftUI

/// The camera bookkeeping the map does on every frame, kept out of view
/// state so that a drag doesn't redraw the pins on every frame.
@MainActor
private final class FeedMapCameraTracker {
    /// The camera as of the latest change, gesture or animation.
    var camera: MapCamera?
    /// Until then, camera changes are the view's own moves: they don't move
    /// the header, and (with `adoptsSettle`) their settle isn't the person's.
    var ownMoveUntil = Date.distantPast
    var adoptsSettle = false
}

/// Map half of the Pulse feed's List / Map toggle.
struct FeedMapView: View {
    let viewModel: FeedMapViewModel
    /// Active surface + chip-row filter, forwarded onto the marker
    /// request. Changing either re-requests the current viewport.
    let query: FeedMapQuery
    /// How far down from the top of the safe area the Pulse header (or its
    /// reveal capsule) reaches; the "Search this area" pill sits below it.
    let topInset: CGFloat
    /// The person dragged the map: how far its content moved, in points
    /// (`height` > 0: up, as when scrolling a list down).
    let onContentDrag: @MainActor (CGSize) -> Void
    let onOpenPost: @MainActor (String) -> Void

    /// The tilt the map opens with and keeps for its own moves.
    static let pitch: Double = 45

    @Namespace private var mapScope
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var cameraPosition: MapCameraPosition
    /// True once the camera is (or was put) in 3D.
    @State private var hasTilted: Bool
    @State private var tracker = FeedMapCameraTracker()
    /// The latitude span a straight-down map would show at the camera's
    /// centre, as of the last settle.
    @State private var centerSpan: Double?
    @State private var mapSize: CGSize = .zero
    @State private var clusterRowsHeight: CGFloat = 0

    init(
        viewModel: FeedMapViewModel,
        query: FeedMapQuery,
        topInset: CGFloat = 0,
        onContentDrag: @escaping @MainActor (CGSize) -> Void = { _ in },
        onOpenPost: @escaping @MainActor (String) -> Void
    ) {
        self.viewModel = viewModel
        self.query = query
        self.topInset = topInset
        self.onContentDrag = onContentDrag
        self.onOpenPost = onOpenPost
        // Back in Map mode: the camera where it was. Else the map waits
        // zoomed out for the view model's first camera request, then flies in.
        if let camera = viewModel.lastCamera {
            _cameraPosition = State(initialValue: .camera(MapCamera(camera)))
            _hasTilted = State(initialValue: true)
        } else {
            _cameraPosition = State(initialValue: .automatic)
            _hasTilted = State(initialValue: false)
        }
    }

    var body: some View {
        ZStack(alignment: .top) {
            mapLayer
            if viewModel.viewportDirty {
                searchThisAreaPill
                    .padding(.top, topInset + Spacing.s3)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            overlays
        }
        .mapScope(mapScope)
        .task(id: query) { await viewModel.activate(query: query) }
        .onChange(of: viewModel.cameraRequest) { _, request in
            if let request { follow(request) }
        }
        .onAppear {
            // A request made before this view existed (the map was in List mode).
            if !hasTilted, let request = viewModel.cameraRequest { follow(request) }
        }
        // A container, so the pill, the recenter control and the cards keep their own identifiers.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulseFeedMap")
    }

    // MARK: - Map

    private var mapLayer: some View {
        MapReader { proxy in
            Map(position: $cameraPosition, interactionModes: .all, scope: mapScope) {
                if case let .loaded(loaded) = viewModel.state {
                    ForEach(loaded.markers) { marker in
                        switch marker {
                        case let .entity(entity):
                            Annotation("", coordinate: entity.coordinate, anchor: .center) {
                                Button {
                                    viewModel.selectEntity(entity.id)
                                } label: {
                                    PulseMapPin(
                                        style: loaded.pinStyles[entity.id] ?? Self.plainPin,
                                        isActive: loaded.selectedId == entity.id
                                    )
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("pulseMapPin_\(entity.id)")
                                .accessibilityLabel("Post: \(entity.title)")
                            }
                            .annotationTitles(.hidden)
                        case let .cluster(cluster):
                            Annotation("", coordinate: marker.coordinate, anchor: .center) {
                                Button {
                                    openCluster(cluster)
                                } label: {
                                    PulseMapClusterBubble(cluster: cluster, styles: loaded.pinStyles)
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("pulseMapCluster_\(cluster.id)")
                                .accessibilityLabel("Cluster of \(cluster.count) posts")
                            }
                            .annotationTitles(.hidden)
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
            .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
            .mapControlVisibility(.hidden)
            .onMapCameraChange(frequency: .continuous) { context in
                trackDrag(to: context.camera, proxy: proxy)
            }
            .onMapCameraChange(frequency: .onEnd) { context in
                settle(context, proxy: proxy)
            }
            .onGeometryChange(for: CGSize.self) { $0.size } action: { mapSize = $0 }
        }
        // Under the status bar too: the header and its scrim sit on top.
        .ignoresSafeArea(edges: .top)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Pulse map")
    }

    /// A post with no style on record (never expected): a plain post pin.
    private static let plainPin = FeedMapPinStyle(intent: .generic, isLive: false)

    // MARK: - Camera

    /// Moves the camera for the view model (opening, Recenter, a new area,
    /// the nearest activity). In 3D the centre moves and the tilt, turn and
    /// height stay; the first move flies in from above to the tilted view.
    private func follow(_ request: FeedMapCameraRequest) {
        let center = CLLocationCoordinate2D(latitude: request.region.latitude, longitude: request.region.longitude)
        if hasTilted, let current = tracker.camera {
            moveCamera(
                to: MapCamera(centerCoordinate: center, distance: current.distance, heading: current.heading, pitch: current.pitch),
                duration: 0.6,
                adoptsSettle: true
            )
        } else {
            hasTilted = true
            moveCamera(
                to: MapCamera(centerCoordinate: center, distance: distance(showing: request.region), heading: 0, pitch: Self.pitch),
                duration: 1.4,
                adoptsSettle: true
            )
        }
    }

    private func moveCamera(to camera: MapCamera, duration: Double, adoptsSettle adopts: Bool) {
        let animated = !reduceMotion
        tracker.ownMoveUntil = Date().addingTimeInterval((animated ? duration : 0) + 0.6)
        tracker.adoptsSettle = adopts
        if animated {
            withAnimation(.easeInOut(duration: duration)) { cameraPosition = .camera(camera) }
        } else {
            cameraPosition = .camera(camera)
        }
    }

    /// The camera height that shows `region` about as a straight-down map
    /// of this shape would (MapKit's vertical field of view is about 30°).
    private func distance(showing region: FeedMapRegion) -> Double {
        let metersPerDegree = 111_000.0
        let latitudeMeters = region.latitudeDelta * metersPerDegree
        let longitudeMeters = region.longitudeDelta * metersPerDegree * cos(region.latitude * .pi / 180)
        let aspect = mapSize.width > 0 && mapSize.height > 0 ? mapSize.height / mapSize.width : 2
        return max(latitudeMeters, longitudeMeters * aspect) / (2 * tan(15 * Double.pi / 180))
    }

    /// The person dragging the map scrolls the header away (or back):
    /// where the last frame's centre is now shows how far the content moved.
    /// Zooming, turning, tilting and the view's own moves don't count.
    private func trackDrag(to camera: MapCamera, proxy: MapProxy) {
        defer { tracker.camera = camera }
        guard Date() >= tracker.ownMoveUntil, let previous = tracker.camera else { return }
        let zoomed = abs(camera.distance - previous.distance) > previous.distance * 0.01
        let turned = abs(angle(camera.heading - previous.heading)) > 0.5 || abs(camera.pitch - previous.pitch) > 0.5
        guard !zoomed, !turned,
              let was = proxy.convert(previous.centerCoordinate, to: .local),
              let now = proxy.convert(camera.centerCoordinate, to: .local) else { return }
        onContentDrag(CGSize(width: now.x - was.x, height: now.y - was.y))
    }

    /// A heading difference in -180...180.
    private func angle(_ degrees: Double) -> Double {
        var value = degrees.truncatingRemainder(dividingBy: 360)
        if value > 180 { value -= 360 }
        if value < -180 { value += 360 }
        return value
    }

    private func settle(_ context: MapCameraUpdateContext, proxy: MapProxy) {
        tracker.camera = context.camera
        let byUser = Date() >= tracker.ownMoveUntil || !tracker.adoptsSettle
        if !byUser { tracker.ownMoveUntil = .distantPast }
        centerSpan = straightDownSpan(proxy: proxy)
        let camera = context.camera
        viewModel.cameraDidSettle(
            on: FeedMapRegion(
                latitude: context.region.center.latitude,
                longitude: context.region.center.longitude,
                latitudeDelta: context.region.span.latitudeDelta,
                longitudeDelta: context.region.span.longitudeDelta
            ),
            camera: FeedMapCamera(
                latitude: camera.centerCoordinate.latitude,
                longitude: camera.centerCoordinate.longitude,
                distance: camera.distance,
                heading: camera.heading,
                pitch: camera.pitch
            ),
            clusterLatitudeDelta: centerSpan,
            byUser: byUser
        )
    }

    /// The latitude span a straight-down map would show, measured 100 pt
    /// around the centre of the screen (a tilted map's region reaches far
    /// past its foreground).
    private func straightDownSpan(proxy: MapProxy) -> Double? {
        guard mapSize.height > 0 else { return nil }
        let middle = CGPoint(x: mapSize.width / 2, y: mapSize.height / 2)
        guard let above = proxy.convert(CGPoint(x: middle.x, y: middle.y - 50), from: .local),
              let below = proxy.convert(CGPoint(x: middle.x, y: middle.y + 50), from: .local) else { return nil }
        let latitude = above.latitude - below.latitude
        let longitude = (above.longitude - below.longitude) * cos(above.latitude * .pi / 180)
        let degreesPerPoint = (latitude * latitude + longitude * longitude).squareRoot() / 100
        return degreesPerPoint * mapSize.height
    }

    /// Zooms in on a tapped cluster that zooming can split (the pins regroup
    /// as the camera settles). Its posts are listed instead when they share
    /// a point or the camera is already as close as the tap zooms.
    private func openCluster(_ cluster: ExploreCluster) {
        let target = clusterRegion(cluster)
        if zoomCanSplit(cluster), zoomsCloser(to: target.span), let current = tracker.camera {
            let ratio = target.span.latitudeDelta / max(centerSpan ?? target.span.latitudeDelta * 2, 0.000_1)
            moveCamera(
                to: MapCamera(
                    centerCoordinate: target.center,
                    distance: current.distance * min(ratio, 1),
                    heading: current.heading,
                    pitch: current.pitch
                ),
                duration: 0.6,
                adoptsSettle: false
            )
        } else {
            viewModel.showClusterPosts(cluster)
        }
    }

    /// Whether zooming in can split `cluster`: its posts fall in more than one
    /// bucket at the smallest cluster radius. Approximate-area posts from one
    /// 0.005° cell share a displayed point (`backend/utils/locationPrivacy.js`),
    /// so a cluster of only those never splits.
    private func zoomCanSplit(_ cluster: ExploreCluster) -> Bool {
        let radius = FeedMapViewModel.minClusterRadius
        return (cluster.minLatitude / radius).rounded(.down) != (cluster.maxLatitude / radius).rounded(.down)
            || (cluster.minLongitude / radius).rounded(.down) != (cluster.maxLongitude / radius).rounded(.down)
    }

    /// The region a cluster tap moves to: the cluster with a margin, at least 0.004° a side.
    private func clusterRegion(_ cluster: ExploreCluster) -> MKCoordinateRegion {
        let latDelta = max((cluster.maxLatitude - cluster.minLatitude) * 1.4, 0.004)
        let lonDelta = max((cluster.maxLongitude - cluster.minLongitude) * 1.4, 0.004)
        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: (cluster.minLatitude + cluster.maxLatitude) / 2,
                longitude: (cluster.minLongitude + cluster.maxLongitude) / 2
            ),
            span: MKCoordinateSpan(latitudeDelta: latDelta, longitudeDelta: lonDelta)
        )
    }

    /// The camera is already as close as `target` once the span it shows
    /// at its centre is no wider.
    private func zoomsCloser(to target: MKCoordinateSpan) -> Bool {
        guard let centerSpan else { return true }
        return centerSpan > target.latitudeDelta * 1.1
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
            .background(Theme.Color.primarySolid)
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
                VStack(spacing: Spacing.s2) {
                    // The system's 2D / 3D switch, and its compass once the map is turned.
                    MapPitchToggle(scope: mapScope)
                        .accessibilityIdentifier("pulseMapPitchToggle")
                    MapCompass(scope: mapScope)
                        .accessibilityIdentifier("pulseMapCompass")
                    recenterButton
                }
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
            } else if !loaded.clusterPosts.isEmpty {
                clusterCard(loaded.clusterPosts)
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
                    .background(Theme.Color.primarySolid)
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
            Icon(.mapPinOff, size: 22, color: Theme.Color.primaryInk)
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
                        .background(Theme.Color.primarySolid)
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
            postSummary(entity)
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

    /// The posts of a tapped cluster that zooming can't split, in the preview
    /// card's slot. Each row opens its post, as the preview card does.
    private func clusterCard(_ posts: [ExploreEntity]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(spacing: Spacing.s2) {
                Text(posts.count == 1 ? "1 post in this area" : "\(posts.count) posts in this area")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: Spacing.s0)
                Button {
                    viewModel.selectEntity(nil)
                } label: {
                    Icon(.x, size: 16, color: Theme.Color.appTextMuted)
                        .frame(width: 40, height: 40)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                // Into the card's padding, so the X lines up with the rows' chevrons.
                .padding(.trailing, -Spacing.s3)
                .accessibilityLabel("Close")
                .accessibilityIdentifier("pulseMapClusterCardClose")
            }
            ScrollView {
                clusterRows(posts)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { clusterRowsHeight = $0 }
            }
            // Just tall enough for the rows, up to about three and a half; a longer list scrolls.
            .frame(height: min(clusterRowsHeight, 212))
            .scrollBounceBehavior(.basedOnSize)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.10), radius: 8, x: 0, y: 4)
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s4)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulseMapClusterCard")
    }

    private func clusterRows(_ posts: [ExploreEntity]) -> some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(posts.enumerated()), id: \.element.id) { index, post in
                if index > 0 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
                Button {
                    onOpenPost(post.id)
                } label: {
                    postSummary(post)
                        .padding(.vertical, Spacing.s2)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pulseMapClusterRow_\(post.id)")
            }
        }
    }

    /// A post's tile, title, meta line and chevron, as the preview card and the cluster list show them.
    private func postSummary(_ entity: ExploreEntity) -> some View {
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
    }
}
