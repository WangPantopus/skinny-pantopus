//
//  ReinventedMapBox.swift
//  Pantopus
//
//  "Pulse, reinvented": the area a map asks the server about (the map's pins, My Atlas, Ask the map, the beams, the
//  town's sound), held inside the world. The server answers `400 MAP_INVALID` for a south or north past ±90 or a west or
//  east past ±180, and since the globe (#5196) a far-out zoom is ordinary: there the map would get no answer and keep its
//  last pins. So south and north stop at the poles, and a view as wide as the world or across the date line asks for the
//  whole width of the world.
//

import MapKit

struct ReinventedMapBox: Equatable {
    let south: Double
    let west: Double
    let north: Double
    let east: Double

    init(_ region: MKCoordinateRegion) {
        let halfLat = region.span.latitudeDelta / 2
        let halfLng = region.span.longitudeDelta / 2
        south = min(max(region.center.latitude - halfLat, -90), 90)
        north = min(max(region.center.latitude + halfLat, -90), 90)
        // West into [-180, 180), east into (-180, 180]: a box that then runs west past east crosses the date line.
        let rawWest = region.center.longitude - halfLng
        let rawEast = region.center.longitude + halfLng
        let wrappedWest = rawWest - 360 * ((rawWest + 180) / 360).rounded(.down)
        let wrappedEast = rawEast - 360 * ((rawEast - 180) / 360).rounded(.up)
        if region.span.longitudeDelta >= 360 || wrappedWest > wrappedEast {
            west = -180
            east = 180
        } else {
            west = wrappedWest
            east = wrappedEast
        }
    }
}
