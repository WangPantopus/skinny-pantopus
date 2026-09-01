//
//  BarcodeView.swift
//  Pantopus
//
//  Visual placeholder barcode rendered from a deterministic hash of the
//  coupon code. NOT a real Code-128/EAN renderer — a future prompt
//  swaps in a proper barcode library when scanning is in scope.
//

import SwiftUI

/// 60pt-tall faux barcode strip rendered from `code`. Two codes that
/// hash to the same value will look identical; that's intentional —
/// this is a visual affordance, not a scannable artefact.
@MainActor
public struct BarcodeView: View {
    private let code: String
    private let height: CGFloat
    private let foreground: Color

    public init(
        code: String,
        height: CGFloat = 60,
        foreground: Color = Theme.Color.appText
    ) {
        self.code = code
        self.height = height
        self.foreground = foreground
    }

    public var body: some View {
        GeometryReader { proxy in
            HStack(spacing: 1) {
                ForEach(Array(bars.enumerated()), id: \.offset) { _, width in
                    Rectangle()
                        .fill(foreground)
                        .frame(width: width, height: proxy.size.height)
                }
            }
            .frame(width: proxy.size.width, alignment: .center)
        }
        .frame(height: height)
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .accessibilityHidden(true) // the human-readable code text below is the source of truth
    }

    /// Deterministic per-character widths that look like a barcode.
    private var bars: [CGFloat] {
        let seed = code.isEmpty ? "PANTOPUS" : code
        return seed.unicodeScalars.flatMap { scalar -> [CGFloat] in
            let v = Int(scalar.value)
            return [
                CGFloat((v % 3) + 1),
                CGFloat(((v / 3) % 4) + 1),
                CGFloat(((v / 7) % 3) + 1),
                CGFloat(((v / 11) % 5) + 1)
            ]
        }
    }
}

#Preview {
    VStack(spacing: Spacing.s3) {
        BarcodeView(code: "PANTO20OFF")
        BarcodeView(code: "1234567890")
        BarcodeView(code: "")
    }
    .padding()
    .background(Theme.Color.appBg)
}
