//
//  MomentsMapView+Float.swift
//  Pantopus
//
//  A ring's pin on the Moments map: today's pin standing on its spot, or, while
//  pins float by day (part D, `MomentsFloat.swift`) and the ring carries an
//  elevation, the floating disc over its spot with its shadow. One button
//  either way, with the same spoken label and test id; the pin playing in the
//  card beside the map (the open iPhone Duo) stays today's pin in its halo.
//

import MapKit
import SwiftUI

extension MomentsMapView {
    @MapContentBuilder
    func ringAnnotation(_ ring: MomentRingDTO, at coordinate: CLLocationCoordinate2D, plan: MomentsHeightTagPlan) -> some MapContent {
        let tag = heightTag(for: ring, plan: plan)
        if let sun = plan.float, let height = ring.shownHeight, !isPlaying(ring) {
            Annotation("", coordinate: coordinate, anchor: MomentFloatPin.anchor(tagged: tag, height: height)) {
                ringButton(ring, plan: plan) { MomentFloatPin(ring: ring, height: height, sun: sun).tagged(tag) }
            }
            .annotationTitles(.hidden)
        } else {
            Annotation("", coordinate: coordinate, anchor: MomentRingPin.anchor(tagged: tag)) {
                ringButton(ring, plan: plan) { MomentRingPin(ring: ring, playing: isPlaying(ring)).tagged(tag) }
            }
            .annotationTitles(.hidden)
        }
    }

    private func ringButton(_ ring: MomentRingDTO, plan: MomentsHeightTagPlan, @ViewBuilder label: () -> some View) -> some View {
        Button { open(ring) } label: { label() }
            .buttonStyle(.plain)
            .accessibilityLabel(MomentsSpeech.label(for: ring, height: plan.spoken(ring)))
            .accessibilityHint("Plays their Moments")
            .accessibilityIdentifier("moments.ring.\(ring.id)")
    }
}
