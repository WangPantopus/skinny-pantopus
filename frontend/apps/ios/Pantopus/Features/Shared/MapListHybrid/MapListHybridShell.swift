//
//  MapListHybridShell.swift
//  Pantopus
//
//  T6.6a (P24) — shared archetype for map+list hybrid surfaces.
//  Full-bleed `MapKit` layer underneath, five chrome slots overlaid
//  (top pill, category chips, map controls), and a draggable bottom
//  sheet that snaps between three detents (`.collapsed` / `.standard`
//  / `.expanded`). Future consumers: Gigs map (current `NearbyMapView`,
//  migrates in P26), Marketplace map mode, Discover Businesses map.
//
//  Decision context: docs/t6-open-questions-decisions.md Q9.
//

import CoreLocation
import MapKit
import SwiftUI

// swiftlint:disable file_length

/// Shell for a full-bleed map paired with a 3-detent bottom sheet.
///
/// The shell owns:
/// - the MapKit canvas (rendering supplied `pins` + optional anchor disc)
/// - the sheet shell (rounded card, drag handle, drag-to-snap gesture)
/// - the chrome layout (top pill / category chips at top, map controls
///   anchored above the sheet edge)
///
/// The shell does **not** own:
/// - the pin model itself — consumers project their data into `MapPin`
/// - the camera — auto-fits on first load via the supplied anchor; if
///   richer camera control is needed, expose a `cameraPosition` binding
///   in a follow-up additive change
/// - any of the chrome content — every slot is a `@ViewBuilder` so
///   consumers supply their own back-pill, category strip, locate-me
///   stack, sheet header, and sheet body
///
/// Pin↔list sync is the consumer's job: when a pin is tapped the shell
/// calls `onPinTap(id)`; the consumer typically (a) updates its own
/// selection state and (b) snaps `detent` to `.standard` so the sheet
/// surfaces the matching card.
@MainActor
public struct MapListHybridShell<
    TopPill: View,
    CategoryChips: View,
    MapControlsContent: View,
    SheetHeader: View,
    SheetBody: View,
    FloatingAction: View
>: View {
    private let pins: [MapPin]
    private let clusters: [MapClusterPin]
    private let anchor: MapAnchor?
    private let selectedPinId: String?
    private let recenterTrigger: Int
    private let showSearchRadius: Bool
    private let cameraRequest: MapListHybridCameraRequest?
    /// When set, the shell-owned markers carry consumer-namespaced
    /// identifiers — `<prefix>.pin_<id>`, `<prefix>.cluster_<index>`,
    /// `<prefix>.youAreHere`, `<prefix>.radiusRing`, `<prefix>.sheet` —
    /// so cross-platform UI tests can mirror by string (A11.1 canonical
    /// ids). `nil` keeps the legacy `mapListHybrid*` names.
    private let markerAccessibilityPrefix: String?
    /// Height of the consumer's map-control stack — drives where the
    /// controls clamp when the sheet expands. Default matches the
    /// original two-button stack (2 × 38 + 8).
    private let controlsStackHeight: CGFloat
    private let onPinTap: (String) -> Void
    private let onClusterTap: (String) -> Void
    /// Fired when the camera settles (`.onMapCameraChange(.onEnd)` —
    /// MapKit's own settle debounce stands in for the design's ~350 ms).
    private let onCameraChange: ((MapListHybridRegion) -> Void)?
    @Binding private var detent: MapListHybridDetent

    private let topPill: () -> TopPill
    private let categoryChips: () -> CategoryChips
    private let mapControls: () -> MapControlsContent
    private let sheetHeader: () -> SheetHeader
    private let sheetBody: () -> SheetBody
    private let floatingAction: () -> FloatingAction

    @State private var dragTranslation: CGFloat = 0
    @State private var cameraPosition: MapCameraPosition = .automatic
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Vertical room below the safe-area top for the Post-task FAB when
    /// the sheet is at the expanded (90%) stop.
    private static var fabTopReserve: CGFloat {
        56
    }

    /// A11.1 — gap above sheet, control stack, gap, then FAB.
    private var fabLiftAboveSheet: CGFloat {
        Self.sheetToControlsGap + controlsStackHeight + Self.sheetToControlsGap
    }

    private static var sheetToControlsGap: CGFloat {
        14
    }

    public init(
        pins: [MapPin],
        clusters: [MapClusterPin] = [],
        anchor: MapAnchor? = nil,
        selectedPinId: String? = nil,
        recenterTrigger: Int = 0,
        showSearchRadius: Bool = false,
        cameraRequest: MapListHybridCameraRequest? = nil,
        markerAccessibilityPrefix: String? = nil,
        controlsStackHeight: CGFloat = 84,
        detent: Binding<MapListHybridDetent>,
        onPinTap: @escaping (String) -> Void = { _ in },
        onClusterTap: @escaping (String) -> Void = { _ in },
        onCameraChange: ((MapListHybridRegion) -> Void)? = nil,
        @ViewBuilder topPill: @escaping () -> TopPill = { EmptyView() },
        @ViewBuilder categoryChips: @escaping () -> CategoryChips = { EmptyView() },
        @ViewBuilder mapControls: @escaping () -> MapControlsContent = { EmptyView() },
        @ViewBuilder floatingAction: @escaping () -> FloatingAction = { EmptyView() },
        @ViewBuilder sheetHeader: @escaping () -> SheetHeader = { EmptyView() },
        @ViewBuilder sheetBody: @escaping () -> SheetBody
    ) {
        self.pins = pins
        self.clusters = clusters
        self.anchor = anchor
        self.selectedPinId = selectedPinId
        self.recenterTrigger = recenterTrigger
        self.showSearchRadius = showSearchRadius
        self.cameraRequest = cameraRequest
        self.markerAccessibilityPrefix = markerAccessibilityPrefix
        self.controlsStackHeight = controlsStackHeight
        _detent = detent
        self.onPinTap = onPinTap
        self.onClusterTap = onClusterTap
        self.onCameraChange = onCameraChange
        self.topPill = topPill
        self.categoryChips = categoryChips
        self.mapControls = mapControls
        self.floatingAction = floatingAction
        self.sheetHeader = sheetHeader
        self.sheetBody = sheetBody
    }

    // MARK: - Marker identifiers

    private func pinIdentifier(_ id: String) -> String {
        markerAccessibilityPrefix.map { "\($0).pin_\(id)" } ?? "mapListHybridPin_\(id)"
    }

    private func clusterIdentifier(_ index: Int) -> String {
        markerAccessibilityPrefix.map { "\($0).cluster_\(index)" } ?? "mapListHybridCluster_\(index)"
    }

    private var anchorIdentifier: String {
        markerAccessibilityPrefix.map { "\($0).youAreHere" } ?? "mapListHybridYouAreHere"
    }

    private var radiusRingIdentifier: String {
        markerAccessibilityPrefix.map { "\($0).radiusRing" } ?? "mapListHybridRadiusRing"
    }

    private var sheetIdentifier: String {
        markerAccessibilityPrefix.map { "\($0).sheet" } ?? "mapListHybridSheet"
    }

    public var body: some View {
        GeometryReader { geo in
            let sheetHeight = max(120, detent.height(in: geo.size.height) + dragTranslation)
            let mapStripTop = geo.safeAreaInsets.top
            let maxControlsBottom = max(
                Self.sheetToControlsGap,
                geo.size.height - mapStripTop - controlsStackHeight - Self.sheetToControlsGap
            )
            let maxFabBottom = max(
                fabLiftAboveSheet,
                geo.size.height - mapStripTop - Self.fabTopReserve
            )
            let controlsInset = min(sheetHeight + Self.sheetToControlsGap, maxControlsBottom)
            let fabInset = min(sheetHeight + fabLiftAboveSheet, maxFabBottom)
            ZStack(alignment: .top) {
                mapLayer
                topPill()
                    .accessibilityIdentifier("mapListHybridTopPill")
                categoryChips()
                    .accessibilityIdentifier("mapListHybridChips")
                mapControlsLayer(bottomInset: controlsInset)
                floatingActionLayer(bottomInset: fabInset)
                bottomSheet(height: sheetHeight, containerHeight: geo.size.height)
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .accessibilityIdentifier("mapListHybridShell")
        .onAppear {
            recenterCamera()
        }
        .onChange(of: anchor) { _, _ in
            recenterCamera()
        }
        .onChange(of: recenterTrigger) { _, _ in
            recenterCamera()
        }
        .onChange(of: cameraRequest) { _, request in
            guard let request else { return }
            withAnimation(reduceMotion ? .linear(duration: 0.001) : .easeInOut(duration: 0.45)) {
                cameraPosition = .region(request.region.mkRegion)
            }
        }
    }

    // MARK: - Map

    private var mapLayer: some View {
        Map(position: $cameraPosition, interactionModes: [.pan, .zoom]) {
            ForEach(pins) { pin in
                Annotation("", coordinate: pin.coordinate, anchor: .center) {
                    Button {
                        onPinTap(pin.id)
                    } label: {
                        MapListHybridPinDot(
                            pin: pin,
                            isActive: pin.id == selectedPinId,
                            reduceMotion: reduceMotion
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier(pinIdentifier(pin.id))
                    .accessibilityLabel("Map pin")
                }
            }
            ForEach(Array(clusters.enumerated()), id: \.element.id) { index, cluster in
                Annotation("", coordinate: cluster.coordinate, anchor: .center) {
                    Button {
                        onClusterTap(cluster.id)
                    } label: {
                        MapListHybridClusterDot(count: cluster.count)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier(clusterIdentifier(index))
                    .accessibilityLabel("\(cluster.count) pins, zoom in")
                }
            }
            if let anchor {
                Annotation("", coordinate: anchor.coordinate, anchor: .center) {
                    MapListHybridAnchorDot()
                        .accessibilityIdentifier(anchorIdentifier)
                        .accessibilityLabel("You are here")
                }
                if showSearchRadius {
                    // Dashed search-radius ring — A11.1 empty-map
                    // treatment. Screen-pt sized (~220 pt diameter per
                    // the design frame) so it reads the same at every
                    // zoom; annotation-based so it can carry the
                    // canonical identifier.
                    Annotation("", coordinate: anchor.coordinate, anchor: .center) {
                        ZStack {
                            Circle()
                                .fill(Theme.Color.primary600.opacity(0.05))
                            Circle()
                                .stroke(
                                    Theme.Color.primary600.opacity(0.45),
                                    style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])
                                )
                        }
                        .frame(width: 220, height: 220)
                        .allowsHitTesting(false)
                        .accessibilityIdentifier(radiusRingIdentifier)
                        .accessibilityLabel("Search radius")
                    }
                }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .onMapCameraChange(frequency: .onEnd) { context in
            onCameraChange?(MapListHybridRegion(mkRegion: context.region))
        }
        .accessibilityIdentifier("mapListHybridMap")
    }

    private func recenterCamera() {
        if let anchor {
            cameraPosition = .region(MKCoordinateRegion(
                center: anchor.coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.024, longitudeDelta: 0.024)
            ))
        } else if let first = pins.first {
            cameraPosition = .region(MKCoordinateRegion(
                center: first.coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.024, longitudeDelta: 0.024)
            ))
        }
    }

    // MARK: - Floating map controls

    private func mapControlsLayer(bottomInset: CGFloat) -> some View {
        mapControls()
            .padding(.trailing, 14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .padding(.bottom, bottomInset)
            .accessibilityIdentifier("mapListHybridMapControls")
    }

    private func floatingActionLayer(bottomInset: CGFloat) -> some View {
        floatingAction()
            .padding(.trailing, 14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .padding(.bottom, bottomInset)
            .accessibilityIdentifier("mapListHybridFloatingAction")
    }

    // MARK: - Bottom sheet

    private func bottomSheet(height: CGFloat, containerHeight: CGFloat) -> some View {
        VStack(spacing: Spacing.s0) {
            Spacer(minLength: Spacing.s0)
            VStack(spacing: Spacing.s0) {
                MapListHybridSheetGrabber()
                sheetHeader()
                    .accessibilityIdentifier("mapListHybridSheetHeader")
                sheetBody()
                    .frame(maxHeight: .infinity, alignment: .top)
                    .accessibilityIdentifier("mapListHybridSheetBody")
            }
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 10, x: 0, y: -10)
            .gesture(
                DragGesture()
                    .onChanged { gesture in
                        // `translation.height` is positive when the
                        // finger moves down. Negate so `dragTranslation`
                        // is positive when the sheet is being *grown*
                        // (finger moves up).
                        dragTranslation = -gesture.translation.height
                    }
                    .onEnded { gesture in
                        // Pass raw velocity (positive = downward) so the
                        // resolver semantics align with Android + web.
                        let velocity = gesture.predictedEndTranslation.height
                        let displacedHeight = detent.height(in: containerHeight) + dragTranslation
                        let displacedFraction = containerHeight > 0
                            ? displacedHeight / containerHeight
                            : detent.heightFraction
                        let target = MapListHybridDetentResolver.resolve(
                            from: detent,
                            velocity: velocity,
                            displacedFraction: displacedFraction
                        )
                        withAnimation(snapAnimation) {
                            detent = target
                            dragTranslation = 0
                        }
                    }
            )
        }
        .accessibilityIdentifier(sheetIdentifier)
        .accessibilityElement(children: .contain)
    }

    private var snapAnimation: Animation {
        if reduceMotion {
            return .linear(duration: 0.001)
        }
        return .interpolatingSpring(stiffness: 320, damping: 30)
    }
}

// MARK: - Sheet grabber

/// 40 × 4 pt rounded grabber tab. Lifted out so unit tests + previews
/// can match the design's pixel-exact handle without re-implementing it.
public struct MapListHybridSheetGrabber: View {
    public init() {}

    public var body: some View {
        Capsule()
            .fill(Theme.Color.appBorderStrong)
            .frame(width: 40, height: 4)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s1)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
            .accessibilityHidden(true)
    }
}

// MARK: - Pin glyph

/// Internal pin glyph. Mirrors the design — colored disc + white ring
/// for confirmed, dashed outline for pending, dual pulse halos for the
/// active selection (suppressed under reduce-motion).
struct MapListHybridPinDot: View {
    let pin: MapPin
    let isActive: Bool
    let reduceMotion: Bool

    @State private var pulse = false

    var body: some View {
        ZStack {
            if isActive && !reduceMotion {
                // A11.1 pulse spec: two halos, scale 0.6 → 1.6 with
                // opacity 0.6 → 0 over 1.6 s easeOut, repeating; second
                // layer offset by 0.4 s.
                Circle()
                    .fill(pin.color)
                    .frame(width: 30, height: 30)
                    .scaleEffect(pulse ? 1.6 : 0.6)
                    .opacity(pulse ? 0 : 0.6)
                    .animation(
                        .easeOut(duration: 1.6).repeatForever(autoreverses: false),
                        value: pulse
                    )
                Circle()
                    .fill(pin.color)
                    .frame(width: 30, height: 30)
                    .scaleEffect(pulse ? 1.6 : 0.6)
                    .opacity(pulse ? 0 : 0.6)
                    .animation(
                        .easeOut(duration: 1.6).delay(0.4).repeatForever(autoreverses: false),
                        value: pulse
                    )
            } else if isActive {
                Circle()
                    .stroke(pin.color.opacity(0.4), lineWidth: 2)
                    .frame(width: 34, height: 34)
            }
            Circle()
                .fill(pin.color)
                .frame(width: 22, height: 22)
                .overlay(
                    Circle().stroke(
                        pin.state == .confirmed ? Color.white : Color.clear,
                        lineWidth: 2
                    )
                )
                .overlay(
                    Circle()
                        .strokeBorder(
                            pin.state == .pending ? pin.color : .clear,
                            style: StrokeStyle(lineWidth: 2, dash: [3, 2])
                        )
                        .scaleEffect(1.25)
                )
                .shadow(color: .black.opacity(0.30), radius: 2, x: 0, y: 2)
        }
        .frame(width: 50, height: 50)
        .onAppear { pulse = isActive && !reduceMotion }
        .onChange(of: isActive) { _, newValue in
            pulse = newValue && !reduceMotion
        }
    }
}

/// "You are here" — 14 pt primary disc, 3 pt white border, 6 pt soft
/// halo (primary600 at 18%) per the A11.1 frame.
struct MapListHybridAnchorDot: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.Color.primary600.opacity(0.18))
                .frame(width: 26, height: 26)
            Circle()
                .fill(Theme.Color.primary600)
                .frame(width: 14, height: 14)
                .overlay(Circle().stroke(Color.white, lineWidth: 3))
        }
    }
}

/// Cluster marker — 28 pt primary600 disc, white count, white ring.
struct MapListHybridClusterDot: View {
    let count: Int

    var body: some View {
        Text("\(count)")
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(width: 28, height: 28)
            .background(Circle().fill(Theme.Color.primary600))
            .overlay(Circle().stroke(Color.white, lineWidth: 2))
            .shadow(color: .black.opacity(0.30), radius: 4, x: 0, y: 2)
    }
}

// MARK: - MapPin coordinate convenience

extension MapPin {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

extension MapClusterPin {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

extension MapAnchor {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

// MARK: - Region bridging (MapKit stays inside the shell)

extension MapListHybridRegion {
    init(mkRegion: MKCoordinateRegion) {
        self.init(
            centerLatitude: mkRegion.center.latitude,
            centerLongitude: mkRegion.center.longitude,
            latitudeSpan: mkRegion.span.latitudeDelta,
            longitudeSpan: mkRegion.span.longitudeDelta
        )
    }

    var mkRegion: MKCoordinateRegion {
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: centerLatitude, longitude: centerLongitude),
            span: MKCoordinateSpan(latitudeDelta: latitudeSpan, longitudeDelta: longitudeSpan)
        )
    }
}
