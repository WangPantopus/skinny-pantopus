//
//  BallotStackView.swift
//  Pantopus
//
//  The still stack at the peel's geometry (Boards: Overview, The peel):
//  420 tall, scale .82, layers 32 apart, 1.4 stroke. P0 draws the
//  canvas's nine decorative polygons, never real boundaries, one per
//  counted government, widest first. Each layer uses the canvas's own
//  transform: translate(cx, base − i·gap) scale(S) scale(1, .5) rotate(45).
//  Layer 0 fills the stack-base grey, the rest white at 94%, and a dashed
//  home-green line drops to the home dot. During the story each told
//  government's layer lifts 8 and takes the green highlight.
//
//  P0 has no verified "nothing this year" status, so every layer uses the
//  solid stroke; the dashed style waits for verified-empty data.
//

import SwiftUI

enum BallotStackGeometry {
    static let height: CGFloat = 420
    static let base: CGFloat = 350
    static let gap: CGFloat = 32
    static let scale: CGFloat = 0.82
    static let stroke: CGFloat = 1.4

    /// The canvas's nine polygons, in its own units (Board: Overview).
    private static let raw: [[[CGFloat]]] = [
        [[-144, -133], [133, -144], [144, 130], [-133, 144]],
        [[-126, -105], [105, -130], [130, 84], [42, 122], [-119, 119]],
        [[-105, -77], [84, -98], [105, 63], [-28, 105], [-98, 84]],
        [[-84, -56], [49, -88], [91, 28], [21, 84], [-77, 67]],
        [[-70, -77], [63, -56], [74, 49], [-42, 74], [-80, 14]],
        [[-91, -28], [14, -67], [77, -14], [56, 56], [-63, 49]],
        [[-56, -49], [42, -60], [60, 21], [14, 56], [-53, 39]],
        [[-77, -42], [28, -49], [49, 42], [-42, 63]],
        [[-42, -35], [39, -42], [46, 32], [-35, 42]]
    ]

    static let polygons: [[CGPoint]] = raw.map { layer in
        layer.map { CGPoint(x: $0[0], y: $0[1]) }
    }

    /// Layers drawn for `count` governments: at least one, at most nine.
    static func layers(for count: Int) -> Int {
        max(1, min(count, polygons.count))
    }

    /// Top of the dashed home line: 10 above the top layer's centre.
    static func lineTop(layers: Int) -> CGFloat {
        base - CGFloat(layers - 1) * gap - 10
    }

    /// Layer `index`'s outline, placed exactly as the canvas's SVG transform.
    static func layer(_ index: Int, centerX: CGFloat) -> Path {
        let transform = CGAffineTransform(rotationAngle: .pi / 4)
            .concatenating(CGAffineTransform(scaleX: 1, y: 0.5))
            .concatenating(CGAffineTransform(scaleX: scale, y: scale))
            .concatenating(CGAffineTransform(translationX: centerX, y: base - CGFloat(index) * gap))
        var path = Path()
        path.addLines(polygons[index].map { $0.applying(transform) })
        path.closeSubpath()
        return path
    }
}

struct BallotStackView: View {
    /// Governments counted for this address (drawn up to nine).
    let count: Int
    /// The peel story being told, if any, and where it is.
    var story: BallotStory?
    var time: Double = .infinity

    var body: some View {
        let layers = BallotStackGeometry.layers(for: count)
        Canvas { context, canvasSize in
            let cx = canvasSize.width / 2
            for i in 0..<layers {
                let path = BallotStackGeometry.layer(i, centerX: cx)
                    .offsetBy(dx: 0, dy: story?.lift(i, at: time) ?? 0)
                let fill = i == 0 ? Theme.Color.ballotStackBase : Theme.Color.appSurface.opacity(0.94)
                context.fill(path, with: .color(fill))
                context.stroke(path, with: .color(Theme.Color.appText), lineWidth: BallotStackGeometry.stroke)
                if let story, i < story.steps {
                    let highlight = story.presence(i, at: time)
                    if highlight > 0 {
                        context.drawLayer { layer in
                            layer.opacity = highlight
                            layer.fill(path, with: .color(Theme.Color.homeBg))
                            layer.stroke(path, with: .color(Theme.Color.home), lineWidth: 3)
                        }
                    }
                }
            }
            let base = BallotStackGeometry.base
            var line = Path()
            line.move(to: CGPoint(x: cx, y: BallotStackGeometry.lineTop(layers: layers)))
            line.addLine(to: CGPoint(x: cx, y: base))
            context.stroke(line, with: .color(Theme.Color.home), style: StrokeStyle(lineWidth: 2, dash: [3, 4]))
            let dot = Path(ellipseIn: CGRect(x: cx - 7, y: base - 7, width: 14, height: 14))
            context.fill(dot, with: .color(Theme.Color.home))
            context.stroke(dot, with: .color(Theme.Color.appSurface), lineWidth: 2.5)
        }
        .frame(maxWidth: .infinity)
        .frame(height: BallotStackGeometry.height)
        .accessibilityElement()
        .accessibilityLabel("\(count) government boundary layers stacked above the address")
    }
}
