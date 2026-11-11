//
//  MomentsMapView+Place.swift
//  Pantopus
//
//  The map moving without a finger on it (founder, 2026-11-11). Three moves,
//  asked for by the view model (`MomentsMapViewModel+Moves.swift`):
//  - close in on a spot, about a block across (the place under a Moment's
//    name, tapped in the viewer);
//  - bring a spot into view at the zoom the map has, only when it isn't
//    showing (the last person watched, when the viewer closes);
//  - frame an area around where you are (what's new just outside the view,
//    or the nearest Moments when nothing is in view).
//

import MapKit
import SwiftUI

/// A move the map is asked to make; each ask is its own, so the same spot asked twice moves the map twice.
struct MomentsPlaceRequest: Equatable {
    enum Move: Equatable {
        case closeIn
        case intoView
        /// The whole area, this many degrees tall and wide, around the point.
        case frame(latitudeSpan: Double, longitudeSpan: Double)
    }

    let id = UUID()
    let latitude: Double
    let longitude: Double
    var move: Move = .closeIn
    let askedAt = Date()
}

extension MomentsMapView {
    func showPlace(_ place: MomentsPlaceRequest?) {
        guard let place else { return }
        let spot = CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)
        let span: MKCoordinateSpan
        switch place.move {
        case .closeIn:
            span = MKCoordinateSpan(latitudeDelta: 0.006, longitudeDelta: 0.006)
        case .intoView:
            // Showing already: the map stays as the person left it.
            guard let region = viewModel.lastRegion, !region.shows(spot) else { return }
            let across = min(region.span.latitudeDelta, 0.025)
            span = MKCoordinateSpan(latitudeDelta: across, longitudeDelta: across)
        case let .frame(latitudeSpan, longitudeSpan):
            span = MKCoordinateSpan(latitudeDelta: latitudeSpan, longitudeDelta: longitudeSpan)
        }
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) {
            camera = .region(MKCoordinateRegion(center: spot, span: span))
        }
    }
}

extension MKCoordinateRegion {
    /// Whether a spot is inside the region, clear of its edges (the middle nine tenths).
    func shows(_ spot: CLLocationCoordinate2D) -> Bool {
        abs(center.latitude - spot.latitude) < span.latitudeDelta * 0.45
            && abs(center.longitude - spot.longitude) < span.longitudeDelta * 0.45
    }
}
