//
//  MomentsMapMemo.swift
//  Pantopus
//
//  What the Moments map works out from its rings, kept until something it is
//  made from changes. The map's screen reads the rings still running and the
//  map's pins and bubbles many times each time it is drawn (the pins, the strip
//  of faces, the bottom row); working them out again each time read every
//  Moment's end time and compared every ring with every other, which froze the
//  map for about a second each time it settled with a few hundred Moments in
//  view (measured for part D, 2026-11-13). Nothing it shows changes.
//

import Foundation

/// The rings still running and the map's markers, until the view model says what they are made from changed.
@MainActor
final class MomentsMapMemo {
    /// The markers, and the zoom and map height they were worked out for.
    private struct Markers {
        let span: Double
        let mapPoints: Double
        let value: [MomentsMarker]
    }

    private var current: [MomentRingDTO]?
    private var markers: Markers?

    /// The rings, the clock, what was watched or what was hidden changed: everything is worked out again.
    func reset() {
        current = nil
        markers = nil
    }

    func current(_ make: () -> [MomentRingDTO]) -> [MomentRingDTO] {
        if let current { return current }
        let value = make()
        current = value
        return value
    }

    /// Every ring read, with what was watched or hidden since, and only Moments still running.
    static func running(_ rings: [MomentRingDTO], now: Date, watched: Set<String>, hidden: [String: Date]) -> [MomentRingDTO] {
        rings.compactMap { ring in
            guard hidden[ring.author.id] == nil else { return nil }
            var ring = ring
            ring.moments = ring.moments.compactMap { moment in
                if let end = moment.expiresAtDate, end <= now { return nil }
                var moment = moment
                if watched.contains(moment.id) { moment.seen = true }
                return moment
            }
            return ring.moments.isEmpty ? nil : ring
        }
    }

    /// The markers also depend on the zoom and on how tall the map is.
    func markers(span: Double, mapPoints: Double, _ make: () -> [MomentsMarker]) -> [MomentsMarker] {
        if let markers, markers.span == span, markers.mapPoints == mapPoints { return markers.value }
        let value = make()
        markers = Markers(span: span, mapPoints: mapPoints, value: value)
        return value
    }
}
