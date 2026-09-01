//
//  EnvelopeOcrBox.swift
//  Pantopus
//
//  Bounding-box overlay drawn on top of the scanned envelope hero in the
//  A13.15 Disambiguate flow. Two tones — `clean` (solid sky frame, sky
//  tinted fill) and `unclear` (dashed amber frame, amber-tinted fill with
//  a soft water-stain radial). Caller supplies the bounding rect in
//  envelope-local coordinates; the primitive renders the overlay only,
//  so it composes inside any `.overlay(alignment: .topLeading) { … }`.
//

import SwiftUI

/// Tone of an `EnvelopeOcrBox` overlay.
///
/// - `clean` — solid 2pt sky border + sky-tinted fill. Used when the OCR
///   confidence is high enough to trust.
/// - `unclear` — dashed 2pt amber border + amber-tinted fill with a soft
///   radial water-stain texture. Used when the scan is smudged / damaged
///   so the OCR confidence is low.
///
/// Mirrors `EnvelopeOcrTone` on Android.
public enum EnvelopeOcrTone: Sendable, Equatable {
    case clean
    case unclear
}

/// Overlay box drawn on top of a scanned envelope preview. The optional
/// `label` is the tiny mono-pill that tags the box (e.g. `NAME · 97%`),
/// rendered just above the top-left corner of the box.
@MainActor
public struct EnvelopeOcrBox: View {
    private let rect: CGRect
    private let tone: EnvelopeOcrTone
    private let label: String?

    public init(rect: CGRect, tone: EnvelopeOcrTone, label: String? = nil) {
        self.rect = rect
        self.tone = tone
        self.label = label
    }

    public var body: some View {
        ZStack(alignment: .topLeading) {
            shape
            if let label {
                labelPill(label)
                    .offset(x: -1, y: -16)
            }
        }
        .frame(width: rect.width, height: rect.height, alignment: .topLeading)
        .offset(x: rect.minX, y: rect.minY)
        .allowsHitTesting(false)
        .accessibilityElement()
        .accessibilityLabel(accessibilityLabel)
    }

    private var shape: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                .fill(fillColor)
            if tone == .unclear {
                waterStain
            }
            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                .stroke(strokeColor, style: strokeStyle)
        }
    }

    private var waterStain: some View {
        RadialGradient(
            colors: [
                Theme.Color.warning.opacity(0.35),
                Theme.Color.warning.opacity(0.18),
                Color.clear
            ],
            center: .center,
            startRadius: 0,
            endRadius: max(rect.width, rect.height) * 0.6
        )
        .blendMode(.multiply)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
    }

    private func labelPill(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 8, weight: .bold, design: .monospaced))
            .tracking(0.3)
            .foregroundStyle(Theme.Color.appTextInverse)
            .padding(.horizontal, Spacing.s1)
            .padding(.vertical, 1)
            .background(
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .fill(strokeColor)
            )
            .textCase(.uppercase)
    }

    private var fillColor: Color {
        switch tone {
        case .clean: Theme.Color.primary600.opacity(0.08)
        case .unclear: Theme.Color.warning.opacity(0.12)
        }
    }

    private var strokeColor: Color {
        switch tone {
        case .clean: Theme.Color.primary500
        case .unclear: Theme.Color.warning
        }
    }

    private var strokeStyle: StrokeStyle {
        switch tone {
        case .clean:
            StrokeStyle(lineWidth: 2, lineCap: .round)
        case .unclear:
            StrokeStyle(lineWidth: 2, lineCap: .round, dash: [4, 4])
        }
    }

    private var accessibilityLabel: String {
        let base = tone == .clean ? "OCR bounding box, clean" : "OCR bounding box, unclear"
        if let label { return "\(base): \(label)" }
        return base
    }
}

#Preview("OCR box on envelope") {
    let envelope = RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
        .fill(Theme.Color.appSurfaceMuted)
        .frame(width: 320, height: 200)
    return VStack(spacing: Spacing.s5) {
        envelope.overlay(alignment: .topLeading) {
            EnvelopeOcrBox(
                rect: CGRect(x: 16, y: 60, width: 120, height: 22),
                tone: .clean,
                label: "name · 97%"
            )
        }
        envelope.overlay(alignment: .topLeading) {
            EnvelopeOcrBox(
                rect: CGRect(x: 16, y: 60, width: 120, height: 22),
                tone: .unclear,
                label: "name · 31%"
            )
        }
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
