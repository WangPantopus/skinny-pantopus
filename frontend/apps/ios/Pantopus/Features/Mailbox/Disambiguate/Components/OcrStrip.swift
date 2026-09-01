//
//  OcrStrip.swift
//  Pantopus
//
//  A13.15 Disambiguate — strip below the scanned-envelope card summarising the
//  OCR read. `good` tone (success bg + check + reassurance) when the scan is
//  clean; `warn` tone (amber bg + alert + re-scan suggestion) when it's
//  unclear. Mirrors the Android `OcrStrip`.
//

import SwiftUI

/// Read-out strip pairing the OCR-detected text with a confidence pill.
@MainActor
struct OcrStrip: View {
    let tone: EnvelopeOcrTone
    /// Detected recipient text (mono), e.g. "Maria K. · 412 Elm St".
    let detected: String
    /// Whole-percent read confidence.
    let confidence: Int
    /// Reassurance / re-scan sub-line.
    let sub: String

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            iconTile
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("OCR detected")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text("“\(detected)”")
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundStyle(Theme.Color.appText)
                Text(sub)
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s2)
            confidencePill
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(palette.background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(palette.border, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("OCR detected \(detected), \(confidence) percent confidence. \(sub)")
    }

    private var iconTile: some View {
        Icon(palette.icon, size: 16, color: palette.accent)
            .frame(width: 32, height: 32)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(palette.border, lineWidth: 1)
            )
    }

    private var confidencePill: some View {
        Text("\(confidence)%")
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .foregroundStyle(palette.pillForeground)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .background(palette.pillBackground)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                    .stroke(palette.pillBorder, lineWidth: 1)
            )
    }

    private var palette: Palette {
        switch tone {
        case .clean:
            Palette(
                background: Theme.Color.successBg,
                border: Theme.Color.successLight,
                accent: Theme.Color.success,
                icon: .checkCircle,
                pillBackground: Theme.Color.successBg,
                pillForeground: Theme.Color.success,
                pillBorder: Theme.Color.successLight
            )
        case .unclear:
            Palette(
                background: Theme.Color.warningBg,
                border: Theme.Color.warningLight,
                accent: Theme.Color.warning,
                icon: .alertTriangle,
                pillBackground: Theme.Color.warmAmberBg,
                pillForeground: Theme.Color.warmAmber,
                pillBorder: Theme.Color.warningLight
            )
        }
    }

    private struct Palette {
        let background: Color
        let border: Color
        let accent: Color
        let icon: PantopusIcon
        let pillBackground: Color
        let pillForeground: Color
        let pillBorder: Color
    }
}

#Preview("OCR strips") {
    VStack(spacing: Spacing.s4) {
        OcrStrip(
            tone: .clean,
            detected: "Maria K. · 412 Elm St",
            confidence: 97,
            sub: "Address matches this household."
        )
        OcrStrip(
            tone: .unclear,
            detected: "M___ K___ · 4__ Elm St",
            confidence: 31,
            sub: "Smudge on the name line. Try a brighter re-scan for a sharper read."
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
