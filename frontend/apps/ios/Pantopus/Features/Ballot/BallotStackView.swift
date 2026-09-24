//
//  BallotStackView.swift
//  Pantopus
//
//  The still stack (Boards: Overview, The peel, Web lookup). P0 draws the
//  canvas's nine decorative polygons, never real boundaries, one per
//  counted government, widest first. Each layer uses the canvas's own
//  transform: translate(cx, base − i·gap) scale(S) scale(1, .5) rotate(45).
//  Layer 0 fills the stack-base grey, the rest white at 94%, and a dashed
//  home-green line drops to the home dot.
//
//  P0 has no verified "nothing this year" status, so every layer uses the
//  solid stroke; the dashed style waits for verified-empty data.
//

import SwiftUI

enum BallotStackSize {
    /// Board: The peel — 390 × 420, scale .82, 32 apart, 1.4 stroke.
    case peel
    /// Board: Web lookup — 196 × 168, scale .45, 14 apart, 1.25 stroke.
    case teaser

    var canvas: CGSize {
        switch self {
        case .peel: CGSize(width: 390, height: 420)
        case .teaser: CGSize(width: 196, height: 168)
        }
    }

    var base: CGFloat {
        self == .peel ? 350 : 150
    }

    var gap: CGFloat {
        self == .peel ? 32 : 14
    }

    var scale: CGFloat {
        self == .peel ? 0.82 : 0.45
    }

    var stroke: CGFloat {
        self == .peel ? 1.4 : 1.25
    }

    var lineWidth: CGFloat {
        self == .peel ? 2 : 1.5
    }

    var dash: [CGFloat] {
        self == .peel ? [3, 4] : [2, 3]
    }

    var lineLead: CGFloat {
        self == .peel ? 10 : 8
    }

    var dot: CGFloat {
        self == .peel ? 7 : 5
    }

    var ring: CGFloat {
        self == .peel ? 2.5 : 2
    }
}

enum BallotStackGeometry {
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

    /// Layer `index`'s outline, placed exactly as the canvas's SVG transform.
    static func layer(_ index: Int, size: BallotStackSize, centerX: CGFloat) -> Path {
        let transform = CGAffineTransform(rotationAngle: .pi / 4)
            .concatenating(CGAffineTransform(scaleX: 1, y: 0.5))
            .concatenating(CGAffineTransform(scaleX: size.scale, y: size.scale))
            .concatenating(CGAffineTransform(translationX: centerX, y: size.base - CGFloat(index) * size.gap))
        var path = Path()
        path.addLines(polygons[index].map { $0.applying(transform) })
        path.closeSubpath()
        return path
    }
}

struct BallotStackView: View {
    /// Governments counted for this address (drawn up to nine).
    let count: Int
    let size: BallotStackSize

    var body: some View {
        let layers = max(1, min(count, BallotStackGeometry.polygons.count))
        Canvas { context, canvasSize in
            let cx = canvasSize.width / 2
            for i in 0..<layers {
                let path = BallotStackGeometry.layer(i, size: size, centerX: cx)
                let fill = i == 0 ? Theme.Color.ballotStackBase : Theme.Color.appSurface.opacity(0.94)
                context.fill(path, with: .color(fill))
                context.stroke(path, with: .color(Theme.Color.appText), lineWidth: size.stroke)
            }
            let top = size.base - CGFloat(layers - 1) * size.gap - size.lineLead
            var line = Path()
            line.move(to: CGPoint(x: cx, y: top))
            line.addLine(to: CGPoint(x: cx, y: size.base))
            context.stroke(
                line,
                with: .color(Theme.Color.home),
                style: StrokeStyle(lineWidth: size.lineWidth, dash: size.dash)
            )
            let dot = Path(ellipseIn: CGRect(
                x: cx - size.dot,
                y: size.base - size.dot,
                width: size.dot * 2,
                height: size.dot * 2
            ))
            context.fill(dot, with: .color(Theme.Color.home))
            context.stroke(dot, with: .color(Theme.Color.appSurface), lineWidth: size.ring)
        }
        .frame(width: size.canvas.width, height: size.canvas.height)
        .accessibilityElement()
        .accessibilityLabel("\(count) government boundary layers stacked above the address")
    }
}
