//
//  MomentsMapView+Place.swift
//  Pantopus
//
//  "Where is that?" (founder, 2026-11-11): the place under a Moment's name in
//  the viewer is a button. It closes the viewer and brings the map in on that
//  spot, about a block across, so the Moments posted there are the ones in
//  view.
//

import MapKit
import SwiftUI

/// A spot the viewer asked the map to show; each ask is its own, so the same place asked twice moves the map twice.
struct MomentsPlaceRequest: Equatable {
    let id = UUID()
    let latitude: Double
    let longitude: Double
}

extension MomentsMapView {
    func showPlace(_ place: MomentsPlaceRequest?) {
        guard let place else { return }
        let region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude),
            span: MKCoordinateSpan(latitudeDelta: 0.006, longitudeDelta: 0.006)
        )
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.35)) {
            camera = .region(region)
        }
    }
}
