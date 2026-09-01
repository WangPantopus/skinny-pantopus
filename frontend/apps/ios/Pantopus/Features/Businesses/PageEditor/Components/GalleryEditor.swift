//
//  GalleryEditor.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. 3-column gallery grid. Empty
//  variant shows a hero "Add cover photo" tile (2×2 span) + smaller
//  add tiles; populated variant shows photo tiles + one add tile (amber
//  rim when the latest upload is fresh).
//
//  Note: drag-to-reorder gestures are out of scope for v1 — the design
//  hint ("drag to reorder") renders via the `hintLabel` only; reorder
//  comes via long-press menu in a follow-up.
//

import SwiftUI

@MainActor
public struct EditBusinessGalleryEditor: View {
    private let state: EditBusinessPageGalleryState

    public init(state: EditBusinessPageGalleryState) {
        self.state = state
    }

    public var body: some View {
        Group {
            if state.isEmpty {
                emptyGrid
            } else {
                populatedGrid
            }
        }
        .accessibilityIdentifier("editBusinessPage.gallery")
    }

    private var columns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: Spacing.s2), count: 3)
    }

    private var populatedGrid: some View {
        LazyVGrid(columns: columns, spacing: Spacing.s2) {
            ForEach(state.tiles) { tile in
                GalleryTileView(tile: tile)
            }
            GalleryAddTile(fresh: state.freshAddTile)
        }
    }

    private var emptyGrid: some View {
        // 3-col grid where the first cell spans 2x2 and the other slots
        // are small add-tiles. LazyVGrid can't span natively, so layout
        // by hand.
        HStack(alignment: .top, spacing: Spacing.s2) {
            CoverHero()
                .frame(maxWidth: .infinity)
                .aspectRatio(1, contentMode: .fit)
                .layoutPriority(2)
                .overlay(alignment: .center) {
                    Color.clear
                }
                .frame(maxWidth: .infinity)

            VStack(spacing: Spacing.s2) {
                GalleryAddTile(fresh: false)
                GalleryAddTile(fresh: false)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

private struct GalleryTileView: View {
    let tile: EditBusinessPageGalleryTile

    var body: some View {
        ZStack(alignment: .topLeading) {
            paletteBackground
            if tile.isCover {
                Text("COVER")
                    .font(.system(size: 8.5, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Theme.Color.business)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
                    .padding(6)
            }
            HStack {
                Spacer()
                VStack {
                    ZStack {
                        Circle()
                            .fill(Theme.Color.appText.opacity(0.65))
                            .frame(width: 22, height: 22)
                        Icon(.x, size: 11, strokeWidth: 2.5, color: Theme.Color.appTextInverse)
                    }
                    .padding(4)
                    Spacer()
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(
                    tile.isCover ? Theme.Color.business : Color.clear,
                    lineWidth: tile.isCover ? 2 : 0
                )
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(tile.palette.rawValue) photo\(tile.isCover ? ", cover" : "")")
    }

    @ViewBuilder private var paletteBackground: some View {
        switch tile.palette {
        case .croissant:
            ZStack {
                LinearGradient(
                    colors: [Theme.Color.warningLight, Theme.Color.warmAmber],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Text("🥐").font(.system(size: 28))
            }
        case .coffee:
            ZStack {
                LinearGradient(
                    colors: [Theme.Color.warmAmber, Theme.Color.appText],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Text("☕").font(.system(size: 28))
            }
        case .interior:
            ZStack {
                LinearGradient(
                    colors: [Theme.Color.warningLight, Theme.Color.warmAmber],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                InteriorSilhouette()
            }
        case .bread:
            ZStack {
                LinearGradient(
                    colors: [Theme.Color.warningLight, Theme.Color.warning],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Text("🥖").font(.system(size: 28))
            }
        case .latte:
            ZStack {
                LinearGradient(
                    colors: [Theme.Color.warningLight, Theme.Color.warmAmber],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                LatteSilhouette()
            }
        case .crowd:
            ZStack {
                LinearGradient(
                    colors: [Theme.Color.warning, Theme.Color.businessDark],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                CrowdSilhouette()
            }
        }
    }
}

private struct InteriorSilhouette: View {
    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = proxy.size.height
            ZStack {
                ForEach(0..<3) { idx in
                    Rectangle()
                        .fill(Theme.Color.appText.opacity(0.35))
                        .frame(width: w * 0.23, height: h * 0.4)
                        .position(x: w * (0.2 + 0.3 * CGFloat(idx)), y: h * 0.55)
                }
                Rectangle()
                    .fill(Theme.Color.appText.opacity(0.6))
                    .frame(width: w, height: h * 0.25)
                    .position(x: w * 0.5, y: h * 0.88)
            }
        }
    }
}

private struct LatteSilhouette: View {
    var body: some View {
        Circle()
            .fill(Theme.Color.appText)
            .overlay(
                Circle().fill(Theme.Color.warningLight.opacity(0.9))
                    .scaleEffect(0.6)
                    .offset(y: -2)
            )
            .frame(width: 38, height: 38)
    }
}

private struct CrowdSilhouette: View {
    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = proxy.size.height
            ZStack {
                ForEach(0..<3) { idx in
                    let xPositions: [CGFloat] = [0.23, 0.5, 0.77]
                    if xPositions.indices.contains(idx) {
                        let positionX = w * xPositions[idx]
                        Circle()
                            .fill(Theme.Color.appText.opacity(0.55))
                            .frame(width: w * 0.13)
                            .position(x: positionX, y: h * 0.36)
                        Rectangle()
                            .fill(Theme.Color.appText.opacity(0.55))
                            .frame(width: w * 0.13, height: h * 0.36)
                            .position(x: positionX, y: h * 0.66)
                    }
                }
            }
        }
    }
}

private struct GalleryAddTile: View {
    let fresh: Bool

    var body: some View {
        VStack(spacing: 4) {
            Icon(.plus, size: 20, color: fresh ? Theme.Color.warmAmber : Theme.Color.appTextSecondary)
            Text(fresh ? "Uploaded" : "Add")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(fresh ? Theme.Color.warmAmber : Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(1, contentMode: .fit)
        .background(fresh ? Theme.Color.warmAmberBg : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(
                    fresh ? Theme.Color.warmAmber : Theme.Color.appBorderStrong,
                    style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                )
        )
        .accessibilityLabel(fresh ? "Photo uploaded, awaiting save" : "Add a photo")
        .accessibilityAddTraits(.isButton)
    }
}

private struct CoverHero: View {
    var body: some View {
        ZStack(alignment: .topLeading) {
            VStack(spacing: 4) {
                Icon(.imagePlus, size: 26, color: Theme.Color.appTextSecondary)
                Text("Add cover photo")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text("1080 × 1080")
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .strokeBorder(
                        Theme.Color.appBorderStrong,
                        style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                    )
            )

            Text("COVER")
                .font(.system(size: 8.5, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Theme.Color.business)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
                .padding(6)
        }
        .accessibilityLabel("Add cover photo")
        .accessibilityAddTraits(.isButton)
    }
}

#Preview("Populated") {
    EditBusinessGalleryEditor(state: .init(
        tiles: [
            .init(id: "1", palette: .croissant, isCover: true),
            .init(id: "2", palette: .interior),
            .init(id: "3", palette: .coffee),
            .init(id: "4", palette: .bread),
            .init(id: "5", palette: .latte)
        ],
        freshAddTile: true,
        hintLabel: "6 of 20 · drag to reorder"
    ))
    .padding()
    .background(Theme.Color.appBg)
}

#Preview("Empty") {
    EditBusinessGalleryEditor(state: .init(
        tiles: [],
        freshAddTile: false,
        hintLabel: "0 of 20 · cover photo first"
    ))
    .padding()
    .background(Theme.Color.appBg)
}
