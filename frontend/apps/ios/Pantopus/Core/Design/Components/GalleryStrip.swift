//
//  GalleryStrip.swift
//  Pantopus
//
//  Horizontal rail of rounded photo tiles with an optional trailing "+N"
//  see-all tile and a dashed empty / add-target variant. Backs the
//  "Recent work" gallery on A10.6 Business profile and A10.7 owner view.
//
//  Design reference: `docs/designs/A10/business-frames.jsx` (Gallery) and
//  `docs/new-design-parity-batch2.md` § A10.6.
//
//  Tiles render a token tint + center glyph placeholder by default; pass an
//  `imageURL` for real photos (resolved via `AsyncImage`, falling back to the
//  tint while loading / on failure). Snapshots pass tint-only tiles so no
//  network is hit.
//

import SwiftUI

/// A single tile in a `GalleryStrip`.
public struct GalleryTile: Identifiable, Hashable {
    public let id: String
    public let imageURL: URL?
    public let label: String?
    public let tint: Color
    public let icon: PantopusIcon?
    /// When non-nil, the tile renders a dark "+N" see-all overlay instead of a
    /// photo — the trailing "+9" affordance in the design.
    public let moreCount: Int?

    public init(
        id: String = UUID().uuidString,
        imageURL: URL? = nil,
        label: String? = nil,
        tint: Color = Theme.Color.appSurfaceSunken,
        icon: PantopusIcon? = .image,
        moreCount: Int? = nil
    ) {
        self.id = id
        self.imageURL = imageURL
        self.label = label
        self.tint = tint
        self.icon = icon
        self.moreCount = moreCount
    }
}

/// Horizontal photo rail. When `tiles` is empty it renders `emptySlots`
/// dashed add-targets wired to `onAdd`.
@MainActor
public struct GalleryStrip: View {
    private let tiles: [GalleryTile]
    private let emptySlots: Int
    private let onTileTap: ((GalleryTile) -> Void)?
    private let onAdd: (() -> Void)?

    private static let tileWidth: CGFloat = 116
    private static let tileHeight: CGFloat = 92

    public init(
        tiles: [GalleryTile],
        emptySlots: Int = 3,
        onTileTap: ((GalleryTile) -> Void)? = nil,
        onAdd: (() -> Void)? = nil
    ) {
        self.tiles = tiles
        self.emptySlots = emptySlots
        self.onTileTap = onTileTap
        self.onAdd = onAdd
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                if tiles.isEmpty {
                    ForEach(0..<emptySlots, id: \.self) { _ in
                        addTile
                    }
                } else {
                    ForEach(tiles) { tile in
                        tileView(tile)
                    }
                }
            }
        }
        .accessibilityIdentifier("galleryStrip")
    }

    private func tileView(_ tile: GalleryTile) -> some View {
        tileVisual(tile)
            .frame(width: Self.tileWidth, height: Self.tileHeight)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .onTapGesture { onTileTap?(tile) }
            .accessibilityElement(children: .ignore)
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel(tile.moreCount.map { "See \($0) more photos" } ?? (tile.label ?? "Photo"))
    }

    private func tileVisual(_ tile: GalleryTile) -> some View {
        ZStack {
            tileBackground(tile)
            if let moreCount = tile.moreCount {
                Color.black.opacity(0.55)
                Text("+\(moreCount)")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            } else {
                if let icon = tile.icon {
                    Icon(icon, size: 24, strokeWidth: 1.6, color: Theme.Color.appTextInverse)
                        .opacity(0.92)
                }
                if let label = tile.label {
                    labelScrim(label)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                }
            }
        }
    }

    @ViewBuilder private func tileBackground(_ tile: GalleryTile) -> some View {
        if let url = tile.imageURL {
            AsyncImage(url: url) { phase in
                switch phase {
                case let .success(image): image.resizable().scaledToFill()
                default: tile.tint
                }
            }
        } else {
            tile.tint
        }
    }

    private func labelScrim(_ label: String) -> some View {
        Text(label)
            .font(.system(size: 10.5, weight: .semibold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 6)
            .background(
                LinearGradient(
                    colors: [Color.black.opacity(0), Color.black.opacity(0.45)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
    }

    private var addTile: some View {
        ZStack {
            Icon(.plus, size: 20, strokeWidth: 2, color: Theme.Color.appTextMuted)
        }
        .frame(width: Self.tileWidth, height: Self.tileHeight)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(
                    Theme.Color.appBorder,
                    style: StrokeStyle(lineWidth: 1, dash: [5, 4])
                )
        )
        .contentShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .onTapGesture { onAdd?() }
        .accessibilityElement(children: .ignore)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("Add photo")
    }
}

#Preview("GalleryStrip — populated + empty") {
    VStack(alignment: .leading, spacing: Spacing.s4) {
        GalleryStrip(tiles: [
            GalleryTile(id: "kitchen", label: "Kitchen", tint: Theme.Color.primary600),
            GalleryTile(id: "bath", label: "Bathroom", tint: Theme.Color.success),
            GalleryTile(id: "living", label: "Living room", tint: Theme.Color.slate),
            GalleryTile(id: "more", tint: Theme.Color.primary800, icon: nil, moreCount: 9)
        ])
        GalleryStrip(tiles: [])
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
