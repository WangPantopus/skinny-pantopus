//
//  CardTableStageParts.swift
//  Pantopus
//
//  The smaller pieces of the picture of the moment (launch key `card_table`):
//  the sheen on the card, the glint on the lining's gold, the soft shadows, the
//  vignette, and the shading along the iPhone Duo's fold.
//

import SwiftUI
import UIKit

/// The soft bright band on the card's face.
struct CardTableSheen: View {
    let width: CGFloat
    let height: CGFloat
    /// How far it has slid, as shares of its own size.
    let x: Double
    let y: Double

    var body: some View {
        let boxWidth = width * 1.6
        let boxHeight = height * 1.6
        let points = CardTableGradientPoints(degrees: 112, width: boxWidth, height: boxHeight)
        LinearGradient(
            stops: [
                .init(color: MailPaper.tableSheen.opacity(0), location: 0.34),
                .init(color: MailPaper.tableSheen.opacity(0.5), location: 0.47),
                .init(color: MailPaper.tableSheen.opacity(0.1), location: 0.54),
                .init(color: MailPaper.tableSheen.opacity(0), location: 0.66)
            ],
            startPoint: points.start,
            endPoint: points.end
        )
        .frame(width: boxWidth, height: boxHeight)
        .offset(x: -width * 0.3 + x * boxWidth, y: -height * 0.3 + y * boxHeight)
        .blendMode(.softLight)
    }
}

/// The gold in the flap's lining catching the light.
struct CardTableGlint: View {
    let width: CGFloat
    let depth: CGFloat
    let mask: UIImage
    let lightX: Double
    let lightY: Double

    var body: some View {
        let boxWidth = width * 2.2
        let boxHeight = depth * 1.4
        let points = CardTableGradientPoints(degrees: 105, width: boxWidth, height: boxHeight)
        LinearGradient(
            stops: [
                .init(color: MailPaper.tableGlintEdge.opacity(0), location: 0.38),
                .init(color: MailPaper.tableGlint.opacity(0.9), location: 0.5),
                .init(color: MailPaper.tableGlintEdge.opacity(0), location: 0.62)
            ],
            startPoint: points.start,
            endPoint: points.end
        )
        .frame(width: boxWidth, height: boxHeight)
        .offset(x: -width * 0.6 + lightX * 0.28 * boxWidth, y: -depth * 0.2 + lightY * 0.1 * boxHeight)
        .frame(width: width, height: depth, alignment: .topLeading)
        .mask {
            Image(uiImage: mask)
                .resizable()
        }
        .blendMode(.screen)
    }
}

/// A soft shadow: a blurred dark shape under the mail, drawn once and then only moved.
struct CardTableSoftShadow: View, Equatable {
    let width: CGFloat
    let height: CGFloat
    let blur: CGFloat
    let spread: CGFloat
    let alpha: Double

    var body: some View {
        let margin = blur * 1.5 + spread
        Canvas(rendersAsynchronously: false) { context, _ in
            let core = CGRect(x: margin, y: margin, width: width, height: height)
            var soft = context
            soft.addFilter(.blur(radius: blur / 2))
            soft.fill(
                Path(roundedRect: core.insetBy(dx: -spread, dy: -spread), cornerRadius: 4),
                with: .color(.black.opacity(alpha))
            )
            context.fill(Path(roundedRect: core, cornerRadius: 4), with: .color(.black))
        }
        .frame(width: width + margin * 2, height: height + margin * 2)
        .padding(-margin)
        .frame(width: width, height: height)
    }
}

/// The window's vignette: darker toward the corners, around a point a little up and left of the middle. Open on the
/// Duo it sits a little nearer the middle.
struct CardTableVignette: View {
    var spread: Double = 0

    var body: some View {
        GeometryReader { geo in
            EllipticalGradient(
                stops: [
                    .init(color: MailPaper.tableVignette.opacity(0), location: cardTableLerp(0.44, 0.46, spread)),
                    .init(color: MailPaper.tableVignette.opacity(cardTableLerp(0.46, 0.44, spread)), location: 1)
                ],
                center: .center,
                startRadiusFraction: 0,
                endRadiusFraction: 0.5
            )
            .frame(width: geo.size.width * 2.4, height: geo.size.height * cardTableLerp(1.76, 1.84, spread))
            .position(x: geo.size.width * cardTableLerp(0.46, 0.48, spread), y: geo.size.height * cardTableLerp(0.4, 0.42, spread))
        }
        .clipped()
    }
}

/// The shading along the Duo's real fold: faint lying flat, stronger half closed.
struct CardTableCrease: View {
    let pages: CardTablePages
    let screen: CGSize
    let spread: Double
    let halfClosed: Bool

    var body: some View {
        // Each shade reaches 58% of its half from the hinge.
        let opacity = (halfClosed ? 1 : 0.25) * spread
        let black = Color.black
        ZStack(alignment: .topLeading) {
            shade(
                stops: [
                    .init(color: black.opacity(0.42), location: 0),
                    .init(color: black.opacity(0.08), location: 0.16),
                    .init(color: black.opacity(0), location: 0.46)
                ],
                beforeHinge: true
            )
            shade(
                stops: [
                    .init(color: black.opacity(0.34), location: 0),
                    .init(color: Color.white.opacity(0.05), location: 0.08),
                    .init(color: black.opacity(0), location: 0.34)
                ],
                beforeHinge: false
            )
        }
        .opacity(opacity)
        .animation(.easeInOut(duration: 0.3), value: halfClosed)
    }

    private func shade(stops: [Gradient.Stop], beforeHinge: Bool) -> some View {
        let half = pages.isSideways ? pages.spine : (beforeHinge ? pages.spine : screen.height - pages.spine)
        let reach = half * 0.58
        let start: UnitPoint = pages.isSideways ? (beforeHinge ? .trailing : .leading) : (beforeHinge ? .bottom : .top)
        let end: UnitPoint = pages.isSideways ? (beforeHinge ? .leading : .trailing) : (beforeHinge ? .top : .bottom)
        return LinearGradient(stops: stops, startPoint: start, endPoint: end)
            .frame(width: pages.isSideways ? reach : screen.width, height: pages.isSideways ? screen.height : reach)
            .offset(
                x: pages.isSideways ? (beforeHinge ? pages.spine - reach : pages.spine) : 0,
                y: pages.isSideways ? 0 : (beforeHinge ? pages.spine - reach : pages.spine)
            )
    }
}

/// Where a CSS-style angled gradient starts and ends in a box.
struct CardTableGradientPoints {
    let start: UnitPoint
    let end: UnitPoint

    init(degrees: Double, width: CGFloat, height: CGFloat) {
        let angle = degrees * .pi / 180
        let sine = CGFloat(sin(angle))
        let cosine = CGFloat(cos(angle))
        let length = abs(width * sine) + abs(height * cosine)
        let dx = sine * length / 2 / width
        let dy = -cosine * length / 2 / height
        start = UnitPoint(x: 0.5 - dx, y: 0.5 - dy)
        end = UnitPoint(x: 0.5 + dx, y: 0.5 + dy)
    }
}

extension ProjectionTransform {
    /// A turn in 3D about `anchor` with a perspective, flat again on the screen: `perspective(p) rotateX(x) rotateY(y)`.
    static func cardTableTurn(rotateY: Double = 0, rotateX: Double = 0, perspective: CGFloat, anchor: CGPoint) -> ProjectionTransform {
        var matrix = CATransform3DMakeTranslation(-anchor.x, -anchor.y, 0)
        matrix = CATransform3DConcat(matrix, CATransform3DMakeRotation(rotateY * .pi / 180, 0, 1, 0))
        matrix = CATransform3DConcat(matrix, CATransform3DMakeRotation(rotateX * .pi / 180, 1, 0, 0))
        var view = CATransform3DIdentity
        view.m34 = -1 / perspective
        matrix = CATransform3DConcat(matrix, view)
        matrix = CATransform3DConcat(matrix, CATransform3DMakeTranslation(anchor.x, anchor.y, 0))
        return ProjectionTransform(matrix)
    }
}
