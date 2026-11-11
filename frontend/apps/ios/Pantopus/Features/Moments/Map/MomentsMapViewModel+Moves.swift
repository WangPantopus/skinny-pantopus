//
//  MomentsMapViewModel+Moves.swift
//  Pantopus
//
//  When the map moves by itself (founder, 2026-11-11: "automatically move the
//  map zoomed in or out with some kind of triggering events"), and the rules
//  that keep it from fighting the person: it moves once per thing they did,
//  never while a crowded spot is open, never after they have moved the map
//  themselves, and opening on you it only ever zooms out.
//
//  - The place under a Moment's name, tapped: the map closes in on it.
//  - The viewer closes (a push's Moment included): the last person watched is
//    brought into view when the map isn't showing them.
//  - The map opens on you: what's new just outside the view is framed with
//    you, and with nothing in view at all the nearest Moments are.
//

import Foundation
import MapKit

extension MomentsMapViewModel {
    /// The place under a Moment's name, tapped in the viewer.
    func showPlace(latitude: Double, longitude: Double) {
        ask(MomentsPlaceRequest(latitude: latitude, longitude: longitude))
    }

    /// The viewer closed on this person: the map shows where that was, when it isn't showing it already. A place
    /// asked for in the same breath (its name tapped, which also closes the viewer) keeps the map.
    func showWatched(_ ring: MomentRingDTO?) {
        guard let ring, !ring.noLocation else { return }
        if let asked = placeRequest, asked.move == .closeIn, Date().timeIntervalSince(asked.askedAt) < 1 { return }
        ask(MomentsPlaceRequest(latitude: ring.latitude, longitude: ring.longitude, move: .intoView))
    }

    /// Called after each read. Once after the map opens on you (the tab opening, "Show my location", "Your home"),
    /// when the camera has settled there, it looks around.
    func lookAroundIfOpening() {
        guard looksAround, focus == nil, let center, let region = lastRegion else { return }
        // The first read can come before the camera reports where it settled: wait for the one after.
        guard region.shows(CLLocationCoordinate2D(latitude: center.latitude, longitude: center.longitude)) else { return }
        looksAround = false
        let nothingInView = !visibleRings.contains { !$0.noLocation }
        Task { [weak self] in await self?.lookAround(from: center, region: region, nothingInView: nothingInView) }
    }

    /// Reads the box the tab's dot counts in (about two miles around you). New Moments there that the map isn't
    /// showing are framed with you. With nothing in view at all it looks further (about 10, then 50 miles) and
    /// frames the nearest.
    private func lookAround(from center: UserCoordinate, region: MKCoordinateRegion, nothingInView: Bool) async {
        var reach = 1.0
        for step in 0..<3 {
            let box = MomentsViewport(
                south: center.latitude - 0.015 * reach,
                west: center.longitude - 0.02 * reach,
                north: center.latitude + 0.015 * reach,
                east: center.longitude + 0.02 * reach,
                zoom: 14 - step * 2
            )
            guard let reply: MomentsMapResponse = try? await MomentsAPI.send(box.endpoint, api: api) else { return }
            let placed = reply.rings.filter { !$0.noLocation }
            let fresh = placed.filter { ring in !ring.mine && ring.moments.contains { !$0.seen } }
            // With something in view only what's new is worth a move; with nothing, anything is.
            var wanted = fresh.isEmpty && nothingInView ? placed : fresh
            if step > 0 { wanted = Self.nearest(wanted, to: center) }
            if !wanted.isEmpty {
                frame(wanted, around: center, from: region)
                return
            }
            guard nothingInView else { return }
            reach *= 5
        }
    }

    /// Frames these rings with you in the middle, unless the map shows them all already or has been moved since.
    private func frame(_ rings: [MomentRingDTO], around center: UserCoordinate, from region: MKCoordinateRegion) {
        guard self.center == center, focus == nil, let current = lastRegion,
              abs(current.center.latitude - region.center.latitude) < region.span.latitudeDelta * 0.1,
              abs(current.center.longitude - region.center.longitude) < region.span.longitudeDelta * 0.1,
              abs(current.span.latitudeDelta - region.span.latitudeDelta) < region.span.latitudeDelta * 0.2 else { return }
        let outside = rings.contains { !region.shows(CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)) }
        guard outside else { return }
        let tall = rings.map { abs($0.latitude - center.latitude) }.max() ?? 0
        let wide = rings.map { abs($0.longitude - center.longitude) }.max() ?? 0
        // Room around the farthest one, and never closer in than the map is.
        ask(MomentsPlaceRequest(
            latitude: center.latitude,
            longitude: center.longitude,
            move: .frame(
                latitudeSpan: max(tall * 3.4, region.span.latitudeDelta),
                longitudeSpan: max(wide * 3.4, region.span.longitudeDelta)
            )
        ))
    }

    /// The nearest ring and the ones about as near (within half again its distance).
    private static func nearest(_ rings: [MomentRingDTO], to center: UserCoordinate) -> [MomentRingDTO] {
        func distance(_ ring: MomentRingDTO) -> Double {
            hypot(ring.latitude - center.latitude, (ring.longitude - center.longitude) * cos(center.latitude * .pi / 180))
        }
        guard let closest = rings.map(distance).min() else { return [] }
        return rings.filter { distance($0) <= closest * 1.5 + 0.002 }
    }
}
