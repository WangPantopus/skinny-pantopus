//
//  TrainChip.swift
//  Pantopus
//
//  A12.11 — Warm-amber "Support train" identity pill that anchors the top
//  of the wizard's first step. Uses the warm-amber identity pillar
//  (`warmAmber` / `warmAmberBg`) so the chip reads as the same accent the
//  shell paints the progress rail and primary CTA in.
//

import SwiftUI

/// Small uppercase identity chip — "SUPPORT TRAIN" in the warm-amber
/// pillar. Mirrors the design's `TrainChip`.
struct TrainChip: View {
    var body: some View {
        HStack(spacing: 5) {
            Icon(.heart, size: 11, strokeWidth: 2.4, color: Theme.Color.warmAmber)
            Text("SUPPORT TRAIN")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.warmAmber)
                .kerning(0.4)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.warmAmberBg)
        .clipShape(Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Support train")
        .accessibilityIdentifier("startSupportTrainChip")
    }
}

#Preview {
    TrainChip()
        .padding(Spacing.s4)
        .background(Theme.Color.appBg)
}
