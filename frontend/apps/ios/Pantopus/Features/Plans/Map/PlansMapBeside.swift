//
//  PlansMapBeside.swift
//  Pantopus
//
//  The Plans map beside the list's column (`PlansListColumn`), on a wide
//  screen (the iPhone Duo open, held sideways): the phone's map
//  (`PlansMapCanvas`), out to the screen's edge under the side tab bar, with
//  "Show my location" in its corner. A tapped pin opens its plan in the
//  column. The plan open there shows selected and the others dim; the
//  camera keeps its zoom, and moves only to bring that plan into sight.
//  The map starts Plans, and reads them again when they change, since it
//  stays on screen while a plan covers the column's list (a plan link opens
//  the column on the plan): a request sent or answered there shows on its
//  pin at once. Half folded like a book, the map keeps to the right page,
//  past the fold.
//

import MapKit
import SwiftUI

struct PlansMapBeside: View {
    let viewModel: PlansMapViewModel
    /// The plan open in the column, shown selected.
    let selectedId: String?
    let onOpen: @MainActor (PlanPinDTO) -> Void
    @State private var camera: MapCameraPosition = .automatic
    /// The map has had its first look, or the last map's place: from then on a plan open in the column keeps it where it is.
    @State private var placed = false
    /// Half folded like a book: how far the fold's far side is from this view's leading edge. Zero otherwise.
    @State private var foldEdge: CGFloat = 0
    /// The camera the map last reported, and the unfolded map's camera kept for it (`unfoldedCamera`).
    @State private var lastReport: CameraReport?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let insets = geo.safeAreaInsets
            // The map runs under the status bar, the side tab bar and the home indicator. Plans are framed for it
            // as it is unfolded.
            let unfoldedSize = CGSize(
                width: geo.size.width + insets.leading + insets.trailing,
                height: geo.size.height + insets.top + insets.bottom
            )
            let unfoldedWindow = openMap(size: geo.size, insets: insets)
            // Half folded like a book, the map starts past the fold, on the right page (with MapKit's Apple Maps mark
            // and Legal link in its corner), and the page shows from the column to the fold. It shows the unfolded
            // map's view from further out, so the narrower map loses nothing.
            let fold = min(foldEdge, geo.size.width)
            let mapInsets = fold > 0 ? EdgeInsets(top: insets.top, leading: 0, bottom: insets.bottom, trailing: insets.trailing) : insets
            let mapSize = CGSize(width: unfoldedSize.width - fold - insets.leading + mapInsets.leading, height: unfoldedSize.height)
            let window = openMap(size: CGSize(width: geo.size.width - fold, height: geo.size.height), insets: mapInsets)
            let foldZoom = Double(unfoldedSize.width / max(mapSize.width, 1))
            HStack(spacing: 0) {
                if fold > 0 {
                    Theme.Color.appBg
                        .frame(width: fold)
                        .ignoresSafeArea()
                }
                ZStack(alignment: .topTrailing) {
                    PlansMapCanvas(
                        viewModel: viewModel,
                        camera: $camera,
                        selectedId: selectedId,
                        pinHint: "Opens the plan",
                        onPin: onOpen,
                        onCluster: { zoom(to: $0, window: unfoldedWindow, mapSize: unfoldedSize) },
                        onBackground: {},
                        keptCamera: { unfoldedCamera($0, unfoldedWidth: unfoldedSize.width, height: mapSize.height) }
                    )
                    .ignoresSafeArea()
                    if viewModel.phase == .ready, !viewModel.isEmpty {
                        PlansLocateButton(viewModel: viewModel)
                            .padding(.top, Spacing.s1)
                            .padding(.trailing, Spacing.s3)
                    }
                }
            }
            .onChange(of: fold) { _, _ in foldChanged(zoom: foldZoom) }
            .onChange(of: mapSize.height, initial: true) { _, mapHeight in
                if abs(viewModel.mapPoints - mapHeight) > 1 { viewModel.mapPoints = mapHeight }
            }
            .onChange(of: viewModel.fitRequest) { _, _ in fitPlans(window: unfoldedWindow, mapSize: unfoldedSize) }
            .onChange(of: viewModel.widenRequest) { _, _ in widen(window: unfoldedWindow, mapSize: unfoldedSize) }
            .onChange(of: viewModel.recenterRequest) { _, _ in recenter(window: unfoldedWindow, mapSize: unfoldedSize) }
            // Whether a pin is in sight is up to the map as it is shown.
            .onChange(of: selectedId) { _, id in bringIntoSight(id, window: window, mapSize: mapSize) }
            .onAppear { restoreCamera(window: unfoldedWindow, mapSize: unfoldedSize, zoom: foldZoom) }
        }
        .readsFoldEdge($foldEdge)
        .task { await viewModel.start() }
        .refreshesOnStoreChange(affects: { PlansStoreReads.affects($0) }, perform: { await viewModel.start() })
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plansMapBeside")
    }

    /// The map clear of "Show my location" and the edges, in the map's own coordinates (it starts under the
    /// status bar and runs under the side tab bar). A pin's head stands about 44 pt above its point.
    private func openMap(size: CGSize, insets: EdgeInsets) -> CGRect {
        CGRect(x: insets.leading + 32, y: insets.top + 72, width: size.width - 64, height: size.height - 72 - 32)
    }

    /// Folding into a book takes the fold's width off the map's leading side, and opening the Duo gives it back. The
    /// kept camera is always the unfolded map's (`unfoldedCamera`), so the map shows that view, from further out while
    /// folded: no pin goes behind the fold, and opening again shows exactly what was there.
    private func foldChanged(zoom: Double) {
        guard let last = viewModel.lastCamera else { return }
        camera = .camera(last.zoomedOut(by: zoom))
    }

    /// A camera the map reports, as the unfolded map would show that view: from the narrower, half folded map, nearer
    /// in by as much as the map is narrower (its width comes from the region reported with the camera). The same
    /// camera reported again means the map only changed size, folding or opening before the camera that goes with
    /// it: the view, and the camera kept for it, are the ones it had.
    private func unfoldedCamera(_ context: MapCameraUpdateContext, unfoldedWidth: CGFloat, height: CGFloat) -> MapCamera {
        let span = context.region.span
        if let lastReport, lastReport.shown.isClose(to: context.camera, within: span.latitudeDelta / 500) {
            return lastReport.kept
        }
        var kept = context.camera
        if span.latitudeDelta > 0, unfoldedWidth > 0 {
            // On the map a degree of longitude is cos(latitude) of a degree of latitude, as on the ground.
            let width = height * span.longitudeDelta / span.latitudeDelta * cos(context.region.center.latitude * .pi / 180)
            if width < unfoldedWidth - 1 { kept = context.camera.zoomedOut(by: width / unfoldedWidth) }
        }
        lastReport = CameraReport(shown: context.camera, kept: kept)
        return kept
    }

    /// A map made again for the same plans (an unfold, a turn) opens where the last one was left, at its zoom; with
    /// a plan open in the column, with that plan in the open map's middle. Plans read before any map settled: the
    /// first look.
    private func restoreCamera(window: CGRect, mapSize: CGSize, zoom: Double) {
        guard camera == .automatic else { return }
        if let id = selectedId, let pin = viewModel.pin(for: id), let span = viewModel.lastRegion?.span {
            camera = .region(centered(on: pin, span: span, window: window, mapSize: mapSize))
            placed = true
        } else if let last = viewModel.lastCamera {
            camera = .camera(last.zoomedOut(by: zoom))
            placed = true
        } else if !viewModel.pins.isEmpty {
            fitPlans(window: window, mapSize: mapSize)
        }
    }

    /// F1's first look: you and the plans around you, inside the open map. Once the map is placed, a plan open in the
    /// column keeps it where it is; a plan link opens the column before the first look, which takes that plan in too.
    private func fitPlans(window: CGRect, mapSize: CGSize) {
        guard let center = viewModel.center, selectedId == nil || !placed else { return }
        let plans = viewModel.pins.filter { viewModel.kindFilter == nil || $0.kind == viewModel.kindFilter || $0.id == selectedId }
        guard !plans.isEmpty else { return }
        let points = plans.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
            + [CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude)]
        guard let region = PlansCameraFit.region(showing: points, in: window, mapSize: mapSize) else { return }
        placed = true
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) { camera = .region(region) }
    }

    /// F4 "Show": out far enough that the town with plans, `miles` away in a direction we don't know, fits.
    private func widen(window: CGRect, mapSize: CGSize) {
        guard let center = viewModel.center else { return }
        let miles = Double(viewModel.nearestElsewhere?.miles ?? 8) * 1.25 + 2
        guard let region = PlansCameraFit.region(showing: box(around: center, miles: miles), in: window, mapSize: mapSize)
        else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.4)) { camera = .region(region) }
    }

    /// "Show my location": about 5 miles across, around you, inside the open map.
    private func recenter(window: CGRect, mapSize: CGSize) {
        guard let center = viewModel.center,
              let region = PlansCameraFit.region(showing: box(around: center, miles: 2.5), in: window, mapSize: mapSize)
        else { return }
        camera = .region(region)
    }

    private func zoom(to cluster: PlansCluster, window: CGRect, mapSize: CGSize) {
        // More plans on one point than fit side by side: the column lists them.
        if cluster.isOnePoint, cluster.count > PlansClustering.fanLimit { return }
        let span = PlansClustering.span(toOpen: cluster)
        let points = [
            CLLocationCoordinate2D(latitude: cluster.latitude + span / 2, longitude: cluster.longitude),
            CLLocationCoordinate2D(latitude: cluster.latitude - span / 2, longitude: cluster.longitude)
        ]
        guard let region = PlansCameraFit.region(showing: points, in: window, mapSize: mapSize) else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) { camera = .region(region) }
    }

    /// A plan opened in the column: its pin into the open map, at the same zoom, when it's out of sight.
    private func bringIntoSight(_ id: String?, window: CGRect, mapSize: CGSize) {
        guard let id, let pin = viewModel.pin(for: id), let region = viewModel.lastRegion,
              mapSize.width > 0, mapSize.height > 0 else { return }
        let west = region.center.longitude - region.span.longitudeDelta / 2
        let north = region.center.latitude + region.span.latitudeDelta / 2
        let point = CGPoint(
            x: (pin.longitude - west) / region.span.longitudeDelta * mapSize.width,
            y: (north - pin.latitude) / region.span.latitudeDelta * mapSize.height
        )
        guard !window.contains(point) else { return }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) {
            camera = .region(centered(on: pin, span: region.span, window: window, mapSize: mapSize))
        }
    }

    /// A region of this span with the pin at the open map's middle.
    private func centered(on pin: PlanPinDTO, span: MKCoordinateSpan, window: CGRect, mapSize: CGSize) -> MKCoordinateRegion {
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: pin.latitude + (window.midY - mapSize.height / 2) * span.latitudeDelta / mapSize.height,
                longitude: pin.longitude - (window.midX - mapSize.width / 2) * span.longitudeDelta / mapSize.width
            ),
            span: span
        )
    }

    /// Four points `miles` north, south, east and west of a center.
    private func box(around center: UserCoordinate, miles: Double) -> [CLLocationCoordinate2D] {
        let latitude = miles / 69
        let longitude = miles / (69 * max(cos(center.latitude * .pi / 180), 0.2))
        return [
            CLLocationCoordinate2D(latitude: center.latitude + latitude, longitude: center.longitude),
            CLLocationCoordinate2D(latitude: center.latitude - latitude, longitude: center.longitude),
            CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude + longitude),
            CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude - longitude)
        ]
    }
}

/// A camera the map reported, and the unfolded map's camera kept for it.
private struct CameraReport {
    let shown: MapCamera
    let kept: MapCamera
}

private extension MapCamera {
    /// The same view from further out (`zoom` above 1), or nearer in (below 1).
    func zoomedOut(by zoom: Double) -> MapCamera {
        var camera = self
        camera.distance *= zoom
        return camera
    }

    /// The same camera, give or take `degrees` and a hair of distance: as MapKit reports it again after the map
    /// changes size.
    func isClose(to other: MapCamera, within degrees: Double) -> Bool {
        abs(centerCoordinate.latitude - other.centerCoordinate.latitude) <= degrees
            && abs(centerCoordinate.longitude - other.centerCoordinate.longitude) <= degrees
            && abs(distance - other.distance) <= distance / 200
            && abs(heading - other.heading) < 0.5 && abs(pitch - other.pitch) < 0.5
    }
}

private extension View {
    /// Keeps `edge` at how far the far side of the iPhone Duo's fold is from this view's leading edge while the Duo
    /// is half folded and the fold crosses this view; zero otherwise.
    @ViewBuilder
    func readsFoldEdge(_ edge: Binding<CGFloat>) -> some View {
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            modifier(FoldEdgeReader(edge: edge))
        } else {
            self
        }
        #else
        self
        #endif
    }
}

#if compiler(>=6.4)
/// The hinge is a division region. Lying open it is inactive (and left out here); half folded it is active.
@available(iOS 27.1, *)
private struct FoldEdgeReader: ViewModifier {
    @Binding var edge: CGFloat

    func body(content: Content) -> some View {
        content.onGeometryChange(for: CGFloat.self) { proxy in
            let bounds = CGRect(origin: .zero, size: proxy.size)
            guard let region = proxy.reservedRegions(kind: .division).first(where: {
                $0.isActive && $0.frame.height > $0.frame.width && $0.frame.intersects(bounds)
            }) else { return 0 }
            return max(0, region.frame.maxX)
        } action: { edge = $0 }
    }
}
#endif
