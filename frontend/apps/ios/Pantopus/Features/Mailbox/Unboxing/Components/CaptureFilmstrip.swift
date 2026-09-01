//
//  CaptureFilmstrip.swift
//  Pantopus
//
//  A17.14 capture region — the `CameraScanner` viewfinder (live preview +
//  framing guide + shutter, falling back to a static placeholder on the
//  simulator / when camera access is off) stacked over the
//  `CapturedFilmstrip` of labeled thumbnails (B1.2 primitives). The shutter
//  and the trailing "Add" tile both append a labeled shot to the strip.
//

import SwiftUI

@MainActor
struct CaptureFilmstrip: View {
    let accent: Color
    let shots: [UnboxingShot]
    let onCapture: () -> Void
    let onAddShot: () -> Void
    /// Force the scan-line static regardless of the environment trait. Used
    /// by snapshot tests; leave `nil` in production.
    var reduceMotionOverride: Bool?

    init(
        accent: Color,
        shots: [UnboxingShot],
        reduceMotionOverride: Bool? = nil,
        onCapture: @escaping () -> Void,
        onAddShot: @escaping () -> Void
    ) {
        self.accent = accent
        self.shots = shots
        self.reduceMotionOverride = reduceMotionOverride
        self.onCapture = onCapture
        self.onAddShot = onAddShot
    }

    var body: some View {
        VStack(spacing: Spacing.s3) {
            CameraScanner(
                accent: accent,
                reduceMotionOverride: reduceMotionOverride
            ) { _ in onCapture() }
                .accessibilityIdentifier("unboxing_viewfinder")

            CapturedFilmstrip(
                accent: accent,
                shots: shots.map {
                    CameraScannerShot(id: $0.id, tag: $0.tag, label: $0.label, isMain: $0.isMain)
                },
                onAdd: onAddShot
            )
            .accessibilityIdentifier("unboxing_filmstrip")
        }
    }
}
