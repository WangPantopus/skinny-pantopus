//
//  BallotGlyph.swift
//  Pantopus
//
//  The canvas's ballot-box glyph (Board: Place: Your ballot card) and
//  the 34pt home-green tile that carries it. Not a Lucide icon: the
//  canvas draws its own three strokes on a 24-unit grid, reproduced
//  here exactly (2-unit stroke, round caps and joins).
//

import SwiftUI

struct BallotGlyphShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 24
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: rect.minX + x * s, y: rect.minY + y * s)
        }
        var path = Path()
        // M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z — the box.
        path.move(to: p(4, 11))
        path.addLine(to: p(20, 11))
        path.addLine(to: p(20, 20))
        path.addArc(tangent1End: p(20, 21), tangent2End: p(19, 21), radius: s)
        path.addLine(to: p(5, 21))
        path.addArc(tangent1End: p(4, 21), tangent2End: p(4, 20), radius: s)
        path.closeSubpath()
        // M9 11V4h6v7 — the ballot sheet.
        path.move(to: p(9, 11))
        path.addLine(to: p(9, 4))
        path.addLine(to: p(15, 4))
        path.addLine(to: p(15, 11))
        // M8 16h8 — the slot.
        path.move(to: p(8, 16))
        path.addLine(to: p(16, 16))
        return path
    }
}

struct BallotGlyph: View {
    var size: CGFloat = 19
    var color: Color = Theme.Color.home

    var body: some View {
        BallotGlyphShape()
            .stroke(color, style: StrokeStyle(lineWidth: 2 * size / 24, lineCap: .round, lineJoin: .round))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

/// 34pt rounded tile, home-green, radius 9 — the Place section tile.
struct BallotTile: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(Theme.Color.homeBg)
            BallotGlyph(size: 19)
        }
        .frame(width: 34, height: 34)
    }
}
