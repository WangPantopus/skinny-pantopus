//
//  PlansMapCanvas.swift
//  Pantopus
//
//  The Plans map itself (board P1): the "you" dot from the system, the pins,
//  their fans and clusters, and the areas, on MapKit's map. The phone screen
//  lays it under its chrome and sheet (`PlansMapView`); the open iPhone Duo
//  lays it beside the list's column (`PlansMapBeside`). Each moves the
//  camera its own way, around what covers its map.
//

import MapKit
import SwiftUI

struct PlansMapCanvas: View {
    let viewModel: PlansMapViewModel
    @Binding var camera: MapCameraPosition
    /// The plan shown selected; the others dim around it.
    let selectedId: String?
    /// What VoiceOver says a pin does.
    let pinHint: String
    let onPin: @MainActor (PlanPinDTO) -> Void
    let onCluster: @MainActor (PlansCluster) -> Void
    /// A tap on the map itself, away from the pins.
    let onBackground: @MainActor () -> Void
    /// The camera kept for the next map, from one the map reports. Beside the list, half folded, it's the camera the
    /// unfolded map would show.
    var keptCamera: @MainActor (MapCameraUpdateContext) -> MapCamera = { $0.camera }
    /// When a pin was last tapped: the same touch also reaches the map's own
    /// tap (which clears a selection) and must not undo the pin's.
    @State private var pinTappedAt: Date?

    var body: some View {
        Map(position: $camera, interactionModes: [.pan, .zoom]) {
            UserAnnotation()
            ForEach(areas, id: \.id) { area in
                MapCircle(center: area.coordinate, radius: area.radius)
                    .foregroundStyle(area.kind.color.opacity(0.2))
            }
            ForEach(viewModel.markers(selectedId: selectedId)) { marker in
                switch marker {
                case let .pin(pin):
                    Annotation("", coordinate: marker.coordinate, anchor: .center) {
                        pinButton(pin)
                    }
                    .annotationTitles(.hidden)
                case let .fan(pins):
                    Annotation("", coordinate: marker.coordinate, anchor: .center) {
                        // Plans sharing one point sit side by side, the point between them.
                        HStack(spacing: PlansClustering.fanStep - PlanPinView.width) {
                            ForEach(pins) { pin in
                                pinButton(pin).zIndex(pin.id == selectedId ? 1 : 0)
                            }
                        }
                    }
                    .annotationTitles(.hidden)
                case let .cluster(cluster):
                    Annotation("", coordinate: marker.coordinate, anchor: .center) {
                        Button { onCluster(cluster) } label: {
                            PlanClusterView(count: cluster.count, kinds: cluster.kinds, badge: cluster.badge)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(PlansPinSpeech.label(for: cluster))
                        .accessibilityHint("Zooms in")
                    }
                    .annotationTitles(.hidden)
                }
            }
        }
        // F4 and F5 dim the map with MapKit's own muted style: a filter on the live map redrew all
        // of it off screen on every frame, and an overlay that ignores the safe area moved the map down.
        .mapStyle(.standard(emphasis: dimsMap ? .muted : .automatic, pointsOfInterest: .excludingAll))
        .onMapCameraChange(frequency: .onEnd) { context in
            viewModel.cameraChanged(context.region, camera: keptCamera(context))
        }
        .onTapGesture {
            if let pinTappedAt, Date().timeIntervalSince(pinTappedAt) < 0.5 { return }
            onBackground()
        }
    }

    /// F4 and F5 mute the map under their sheet.
    private var dimsMap: Bool {
        viewModel.phase == .needsLocation || viewModel.isEmpty
    }

    /// The area under the selected pin (about 500 m), and every playdate's
    /// neighborhood (about 1 km), which playdates always show.
    private var areas: [PlansArea] {
        viewModel.pins.compactMap { pin in
            guard viewModel.kindFilter == nil || pin.kind == viewModel.kindFilter else { return nil }
            let isSelected = pin.id == selectedId
            guard isSelected || (pin.kind == .playdate && !pin.isExactPoint) else { return nil }
            return PlansArea(
                id: pin.id,
                kind: pin.kind,
                coordinate: CLLocationCoordinate2D(latitude: pin.latitude, longitude: pin.longitude),
                radius: pin.kind == .playdate && !pin.isExactPoint ? 500 : 250
            )
        }
    }

    private func look(for pin: PlanPinDTO) -> PlanPinLook {
        let selected = pin.id == selectedId
        let badge: PlanPinLook.Badge? = if pin.isHosting {
            .hosting
        } else if pin.isIn {
            .going
        } else if pin.viewerRequestStatus == .pending || pin.viewerRequestStatus == .waitlisted {
            .waiting
        } else {
            nil
        }
        let calendar = PlanFormat.calendar(for: pin.timezone ?? card(for: pin.id)?.timezone)
        let tag = PlanFormat.pinTag(
            state: pin.state,
            isFull: pin.isFull && !pin.isIn && !pin.isHosting,
            startsAt: pin.startsAtDate,
            dayPart: pin.dayPart,
            calendar: calendar
        )
        return PlanPinLook(
            kind: pin.kind,
            // "Your plan · Sun 1:25", as the posted pin reads (board H8) and Android's.
            tag: pin.isHosting && selected ? "Your plan · \(tag)" : tag,
            isSelected: selected,
            isDimmed: selectedId != nil && !selected,
            isFull: pin.isFull && !pin.isIn && !pin.isHosting,
            isLive: pin.state == .live,
            badge: badge
        )
    }

    private func pinButton(_ pin: PlanPinDTO) -> some View {
        Button {
            pinTappedAt = Date()
            onPin(pin)
        } label: {
            PlanPinView(look: look(for: pin))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(PlansPinSpeech.label(for: pin, card: card(for: pin.id), center: viewModel.center))
        .accessibilityHint(pinHint)
        .accessibilityIdentifier("planPin.\(pin.id)")
    }

    private func card(for id: String) -> PlanCardDTO? {
        viewModel.cards.first { $0.id == id } ?? viewModel.yourPlans.first { $0.id == id }
    }
}

/// An area circle on the map.
private struct PlansArea {
    let id: String
    let kind: PlanKind
    let coordinate: CLLocationCoordinate2D
    let radius: CLLocationDistance
}
