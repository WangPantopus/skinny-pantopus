//
//  PolaroidFrame.swift
//  Pantopus
//
//  Keepsake photograph hero for the A17.7 Memory body. A white polaroid
//  card sits — slightly rotated — on a paper "table", with a handwritten
//  serif caption printed under the photo and a small printed label below.
//

import SwiftUI

@MainActor
public struct PolaroidFrame: View {
    private let imageURL: URL?
    private let caption: String
    private let label: String

    /// Subtle keepsake tilt — matches the design's ~-2° rotation.
    private let tilt: Angle = .degrees(-2)

    public init(imageURL: URL?, caption: String, label: String) {
        self.imageURL = imageURL
        self.caption = caption
        self.label = label
    }

    public var body: some View {
        VStack(spacing: Spacing.s3) {
            polaroidCard
                .rotationEffect(tilt)
                .padding(.horizontal, Spacing.s2)
                .padding(.top, Spacing.s2)

            Text(label)
                .font(.system(size: 11, weight: .bold))
                .tracking(1.4)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityLabel(label)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s5)
        .padding(.horizontal, Spacing.s4)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private var polaroidCard: some View {
        VStack(spacing: Spacing.s3) {
            photo
                .aspectRatio(4.0 / 5.0, contentMode: .fit)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xs))

            Text(caption)
                .font(.system(size: 14, design: .serif))
                .italic()
                .foregroundStyle(Theme.Color.appText)
                .accessibilityLabel("Caption: \(caption)")
        }
        .padding(Spacing.s3)
        .padding(.bottom, Spacing.s2)
        .frame(width: 232)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
        .shadow(color: Theme.Color.appText.opacity(0.18), radius: 10, x: 0, y: 6)
    }

    @ViewBuilder private var photo: some View {
        if let imageURL {
            AsyncImage(url: imageURL) { phase in
                switch phase {
                case let .success(image):
                    image.resizable().scaledToFill()
                default:
                    placeholder
                }
            }
        } else {
            placeholder
        }
    }

    private var placeholder: some View {
        ZStack {
            Theme.Color.warningBg
            Icon(.image, size: 32, color: Theme.Color.warning)
                .opacity(0.7)
        }
        .accessibilityLabel("Photograph")
    }
}

#Preview {
    PolaroidFrame(
        imageURL: nil,
        caption: "Pepper, May 19 2025",
        label: "1 of 1 · sent by Mei"
    )
    .padding()
    .background(Theme.Color.appBg)
}
