//
//  CertifiedStampBadge.swift
//  Pantopus
//
//  T6.5c (P21) — Postal-stamp visual rendered on the Certified mail
//  hero. Lifted from `certified.jsx:181-227`. Bordered rect with the
//  "USPS · Certified MAIL™" lockup, a barcode hash-mark strip, and a
//  monospace tracking number. Tilted slightly so it reads as a real
//  postmark.
//
//  Feature-local — only the Certified variant uses the stamp visual.
//

import SwiftUI

/// Decorative postal stamp. Pure SwiftUI — no asset dependencies.
public struct CertifiedStampBadge: View {
    public let trackingId: String

    public init(trackingId: String) {
        self.trackingId = trackingId
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("USPS · CERTIFIED")
                .font(.system(size: 9, weight: .bold))
                .tracking(1.2)
                .foregroundStyle(stampForeground)
            Text("MAIL™")
                .font(.system(size: 13, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(stampForeground)
                .padding(.top, 2)
            barcodeStrip
                .padding(.top, Spacing.s1)
            Text(displayTracking)
                .font(.system(size: 8, weight: .semibold, design: .monospaced))
                .tracking(0.5)
                .foregroundStyle(stampForeground)
                .padding(.top, 2)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(stampBackground)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xs)
                .stroke(stampForeground, lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs))
        .rotationEffect(.degrees(-1.5))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("USPS Certified Mail · tracking \(displayTracking)")
        .accessibilityIdentifier("certifiedStampBadge")
    }

    /// Pretty-print the tracking id in 4-digit groups. The design's
    /// hard-coded example renders "7014 2026 0411" — three groups.
    private var displayTracking: String {
        let trimmed = trackingId.replacingOccurrences(of: " ", with: "")
        guard trimmed.count > 8 else { return trackingId }
        let prefix = trimmed.prefix(12)
        var groups: [String] = []
        var idx = prefix.startIndex
        while idx < prefix.endIndex {
            let nextIdx = prefix.index(idx, offsetBy: 4, limitedBy: prefix.endIndex) ?? prefix.endIndex
            groups.append(String(prefix[idx..<nextIdx]))
            idx = nextIdx
        }
        return groups.joined(separator: " ")
    }

    private var barcodeStrip: some View {
        // Fixed bar widths lifted from the design (1.5/2.5/1/3/...pt) —
        // baked into the file so the hash marks look "stamped" rather
        // than uniformly striped.
        let widths: [CGFloat] = [1.5, 2.5, 1, 3, 1.5, 2, 1, 2.5, 1.5, 3, 1, 2, 1.5]
        return HStack(spacing: 1) {
            ForEach(0..<widths.count, id: \.self) { i in
                Rectangle()
                    .fill(stampForeground)
                    .frame(width: widths[i], height: 12)
            }
        }
    }

    /// Documented per-component palette exception — the postal-stamp
    /// orange-brown isn't in the semantic token set, so we encode the
    /// design's "B45623 / 7B2D0E" stamp pair here. Same justification
    /// as the per-feature palettes documented in `MailItemCategory`.
    private var stampForeground: Color {
        // CSS 7B2D0E
        Color(red: 0x7B / 255.0, green: 0x2D / 255.0, blue: 0x0E / 255.0)
    }

    private var stampBackground: Color {
        // rgba(180, 86, 35, 0.04) — barely-tinted parchment.
        Color(red: 180.0 / 255.0, green: 86.0 / 255.0, blue: 35.0 / 255.0, opacity: 0.04)
    }
}

#Preview {
    CertifiedStampBadge(trackingId: "7014 2026 0411 3344 5577")
        .padding()
        .background(Theme.Color.appBg)
}
