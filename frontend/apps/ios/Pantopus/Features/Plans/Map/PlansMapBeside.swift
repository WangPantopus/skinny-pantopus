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
//  The map reads Plans again when they change, since it stays on screen
//  while a plan covers the column's list: a request sent or answered there
//  shows on its pin at once.
//

import MapKit
import SwiftUI

struct PlansMapBeside: View {
    let viewModel: PlansMapViewModel
    /// The plan open in the column, shown selected.
    let selectedId: String?
    let onOpen: @MainActor (PlanPinDTO) -> Void
    @State private var camera: MapCameraPosition = .automatic
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let insets = geo.safeAreaInsets
            // The map runs under the status bar, the side tab bar and the home indicator.
            let mapSize = CGSize(
                width: geo.size.width + insets.leading + insets.trailing,
                height: geo.size.height + insets.top + insets.bottom
            )
            let window = openMap(size: geo.size, insets: insets)
            ZStack(alignment: .topTrailing) {
                PlansMapCanvas(
                    viewModel: viewModel,
                    camera: $camera,
                    selectedId: selectedId,
                    pinHint: "Opens the plan",
                    onPin: onOpen,
                    onCluster: { zoom(to: $0, window: window, mapSize: mapSize) },
                    onBackground: {}
                )
                .ignoresSafeArea()
                if viewModel.phase == .ready, !viewModel.isEmpty {
                    PlansLocateButton(viewModel: viewModel)
                        .padding(.top, Spacing.s1)
                        .padding(.trailing, Spacing.s3)
                }
            }
            .onChange(of: mapSize.height, initial: true) { _, mapHeight in
                if abs(viewModel.mapPoints - mapHeight) > 1 { viewModel.mapPoints = mapHeight }
            }
            .onChange(of: viewModel.fitRequest) { _, _ in fitPlans(window: window, mapSize: mapSize) }
            .onChange(of: viewModel.pins.isEmpty) { _, isEmpty in
                // Plans read for a map never placed (a plan link opened the column first): the first look.
                if !isEmpty, camera == .automatic { fitPlans(window: window, mapSize: mapSize) }
            }
            .onChange(of: viewModel.widenRequest) { _, _ in widen(window: window, mapSize: mapSize) }
            .onChange(of: viewModel.recenterRequest) { _, _ in recenter(window: window, mapSize: mapSize) }
            .onChange(of: selectedId) { _, id in bringIntoSight(id, window: window, mapSize: mapSize) }
            .onAppear { restoreCamera(window: window, mapSize: mapSize) }
        }
        .refreshesOnStoreChange(affects: { PlansStoreReads.affects($0) }, perform: { await viewModel.start() })
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plansMapBeside")
    }

    /// The map clear of "Show my location" and the edges, in the map's own coordinates (it starts under the
    /// status bar and runs under the side tab bar). A pin's head stands about 44 pt above its point.
    private func openMap(size: CGSize, insets: EdgeInsets) -> CGRect {
        CGRect(x: insets.leading + 32, y: insets.top + 72, width: size.width - 64, height: size.height - 72 - 32)
    }

    /// A map made again for the same plans (an unfold, a turn) opens where the last one was left, at its zoom; with
    /// a plan open in the column, with that plan in the open map's middle. Plans read before any map settled: the
    /// first look.
    private func restoreCamera(window: CGRect, mapSize: CGSize) {
        guard camera == .automatic else { return }
        if let id = selectedId, let pin = viewModel.pin(for: id), let span = viewModel.lastRegion?.span {
            camera = .region(centered(on: pin, span: span, window: window, mapSize: mapSize))
        } else if let last = viewModel.lastCamera {
            camera = .camera(last)
        } else if !viewModel.pins.isEmpty {
            fitPlans(window: window, mapSize: mapSize)
        }
    }

    /// F1's first look: you and the plans around you, inside the open map. A plan open in the column keeps the map
    /// where it is, unless the map was never placed (the plan came from a link): then the first look takes it in too.
    private func fitPlans(window: CGRect, mapSize: CGSize) {
        guard let center = viewModel.center, selectedId == nil || camera == .automatic else { return }
        let plans = viewModel.pins.filter { viewModel.kindFilter == nil || $0.kind == viewModel.kindFilter || $0.id == selectedId }
        guard !plans.isEmpty else { return }
        let points = plans.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
            + [CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude)]
        guard let region = PlansCameraFit.region(showing: points, in: window, mapSize: mapSize) else { return }
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
