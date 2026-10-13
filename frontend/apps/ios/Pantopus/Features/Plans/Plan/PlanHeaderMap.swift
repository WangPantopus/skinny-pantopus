//
//  PlanHeaderMap.swift
//  Pantopus
//
//  The map at the top of a plan (boards J1 to J9, H9): the area (about
//  500 m, or about 1 km for a playdate) until the viewer is in; the exact
//  pin for the host and people who are in. When the host says yes it plays
//  the reveal of board P3: the area contracts toward the true point and
//  fades (0–280 ms), the pin grows from its tip to 106% and settles
//  (200–420 ms), with a success haptic as it lands. Under Reduce Motion
//  the change is a 150 ms crossfade.
//

import MapKit
import SwiftUI

struct PlanHeaderMap: View {
    let card: PlanCardDTO
    /// The exact place, for the host and people who are in.
    let place: PlanPlaceDTO?
    let isHosting: Bool
    /// Changes when the reveal should play.
    let revealToken: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var camera: MapCameraPosition = .automatic
    @State private var areaOffset: CGSize = .zero
    @State private var areaScale: CGFloat = 1
    @State private var areaOpacity: Double = 1
    @State private var pinScale: CGFloat = 1
    @State private var pinOpacity: Double = 1
    @State private var landed = 0
    @State private var revealing = false

    static let height: CGFloat = 236

    var body: some View {
        MapReader { proxy in
            Map(position: $camera, interactionModes: []) {
                if showsArea {
                    Annotation("", coordinate: areaCoordinate, anchor: .center) {
                        areaView
                            .offset(areaOffset)
                            .scaleEffect(areaScale)
                            .opacity(areaOpacity)
                    }
                    .annotationTitles(.hidden)
                }
                if let place {
                    Annotation(
                        "",
                        coordinate: CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude),
                        anchor: .center
                    ) {
                        PlanPinView(look: PlanPinLook(
                            kind: card.kind,
                            tag: pinTag(place),
                            isSelected: true,
                            badge: isHosting ? .hosting : .going
                        ))
                        .scaleEffect(pinScale, anchor: .center)
                        .opacity(pinOpacity)
                    }
                    .annotationTitles(.hidden)
                }
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .onChange(of: revealToken) { _, _ in reveal(proxy) }
            .onChange(of: place) { _, newPlace in
                guard newPlace != nil else { return }
                // The exact place arrived: frame it, unless the reveal does (it
                // starts in this same update and frames the place as it ends).
                Task { @MainActor in
                    guard !revealing else { return }
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.35)) { frame() }
                }
            }
        }
        .frame(height: Self.height)
        .sensoryFeedback(.success, trigger: landed)
        .onAppear { frame() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

    // MARK: - Pieces

    /// Before you're in the area shows; once in, a faint ghost stays under the pin.
    private var showsArea: Bool {
        place == nil || revealing || !isHosting
    }

    private var areaCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: card.area.latitude, longitude: card.area.longitude)
    }

    private var isNeighborhood: Bool {
        card.area.precision == "neighborhood" || card.kind == .playdate
    }

    /// Area diameter in points at the header's zoom (about 70% of its height
    /// for the 500 m area; the 1 km neighborhood spills past it).
    private var areaDiameter: CGFloat {
        isNeighborhood ? Self.height * 1.27 : Self.height * 0.72
    }

    private var areaView: some View {
        let ghost = place != nil && !revealing
        return Circle()
            .fill(RadialGradient(
                colors: [
                    card.kind.color.opacity(ghost ? 0.10 : 0.24),
                    card.kind.color.opacity(ghost ? 0.06 : 0.20),
                    card.kind.color.opacity(0)
                ],
                center: .center,
                startRadius: 0,
                endRadius: areaDiameter / 2
            ))
            .frame(width: areaDiameter, height: areaDiameter)
            .overlay {
                if isNeighborhood, place == nil {
                    Text(card.area.label)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(card.kind.color)
                        .shadow(color: Theme.Color.appSurface, radius: 2)
                        .offset(y: -12)
                }
            }
            .allowsHitTesting(false)
    }

    private func pinTag(_ place: PlanPlaceDTO) -> String {
        if isHosting { return card.placeKind == .home ? "Your place" : place.name ?? "Your plan" }
        return place.name ?? "Here"
    }

    private var accessibilitySummary: String {
        if place != nil {
            return isHosting ? "Map of your plan's place" : "Map showing the exact place"
        }
        return "Map showing the area, \(card.area.label). The exact place is shared when you're in."
    }

    // MARK: - Camera and the reveal

    /// Where the exact place (or the area, before it) sits in the header: below
    /// the middle, clear of the status bar and the buttons over the map.
    private static let focusY: CGFloat = 150

    private func frame() {
        let target = place.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) } ?? areaCoordinate
        // The area's diameter in meters over the share of the header it fills.
        let meters = isNeighborhood ? 1000.0 / 1.27 : 500.0 / 0.72
        // The region fills the header's height, so the camera's center sits
        // north of the target by the gap between the middle and `focusY`.
        let north = Double(Self.focusY - Self.height / 2) * meters / Double(Self.height) / 111_000
        let center = CLLocationCoordinate2D(latitude: target.latitude + north, longitude: target.longitude)
        camera = .region(MKCoordinateRegion(center: center, latitudinalMeters: meters, longitudinalMeters: meters))
    }

    private func reveal(_ proxy: MapProxy) {
        guard let place else { return }
        let exact = CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)
        guard !reduceMotion else {
            withAnimation(.easeInOut(duration: 0.15)) { frame() }
            landed += 1
            return
        }
        // Start from the area as the guest always saw it, the pin unseen.
        revealing = true
        areaOffset = .zero
        areaScale = 1
        areaOpacity = 1
        pinScale = 0.01
        pinOpacity = 0
        let delta: CGSize = if let from = proxy.convert(areaCoordinate, to: .local), let to = proxy.convert(exact, to: .local) {
            CGSize(width: to.x - from.x, height: to.y - from.y)
        } else {
            .zero
        }
        withAnimation(.easeOut(duration: 0.28)) {
            areaOffset = delta
            areaScale = 0.3
            areaOpacity = 0
        }
        withAnimation(.spring(response: 0.22, dampingFraction: 0.55).delay(0.2)) {
            pinScale = 1
            pinOpacity = 1
        }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(420))
            landed += 1
            revealing = false
            areaOffset = .zero
            areaScale = 1
            areaOpacity = 1
            // The pin landed: bring the exact place to the header's focus.
            withAnimation(.easeInOut(duration: 0.35)) { frame() }
        }
    }
}
