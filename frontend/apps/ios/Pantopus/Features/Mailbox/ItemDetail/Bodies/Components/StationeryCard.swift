//
//  StationeryCard.swift
//  Pantopus
//
//  Paper "letter" surface for the A17.7 Memory body. Renders the
//  handwritten note as multi-paragraph serif body on a sunken paper
//  card, closing with an italic serif signature. Serif is reserved for
//  ceremonial / mailbox letter surfaces only (per design system).
//

import SwiftUI

@MainActor
public struct StationeryCard: View {
    private let eyebrow: String
    private let paragraphs: [String]
    private let signature: String

    public init(eyebrow: String, paragraphs: [String], signature: String) {
        self.eyebrow = eyebrow
        self.paragraphs = paragraphs
        self.signature = signature
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            eyebrowRow

            VStack(alignment: .leading, spacing: Spacing.s3) {
                ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                    Text(paragraph)
                        .font(.system(.body, design: .serif))
                        .foregroundStyle(Theme.Color.appText)
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Text("— \(signature)")
                .font(.system(.title3, design: .serif))
                .italic()
                .foregroundStyle(Theme.Color.appText)
                .padding(.top, Spacing.s1)
                .accessibilityLabel("Signed, \(signature)")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s5)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private var eyebrowRow: some View {
        HStack(spacing: Spacing.s2) {
            RoundedRectangle(cornerRadius: Radii.pill)
                .fill(Theme.Color.warning)
                .frame(width: 24, height: 1)
            Text(eyebrow)
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    StationeryCard(
        eyebrow: "The note",
        paragraphs: [
            "It's been a year, can you believe it.",
            "I still think about how you walked back from the trail with Pepper under your arm.",
            "Thank you again. I baked you a loaf — it's on the porch."
        ],
        signature: "Mei (and Pepper)"
    )
    .padding()
    .background(Theme.Color.appBg)
}
