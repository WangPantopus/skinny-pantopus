//
//  CardTablePose.swift
//  Pantopus
//
//  Where everything lies at this moment (launch key `card_table`), worked out
//  from the springs and the layout. The numbers are the sample's.
//

import SwiftUI

func cardTableLerp(_ a: Double, _ b: Double, _ t: Double) -> Double {
    a + (b - a) * t
}

/// Eases from 0 at `a` to 1 at `b`.
func cardTableEase(_ a: Double, _ b: Double, _ x: Double) -> Double {
    let t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
}

struct CardTablePose {
    // The light, and how the table shifts with it.
    let lightX: Double
    let lightY: Double

    // The envelope.
    let envelopeX: Double
    let envelopeY: Double
    let envelopeRotation: Double
    /// Shrinks to the flap above the Duo's two pages.
    let envelopeScale: Double
    let envelopeAngle: Double
    /// Showing its flap side.
    let flapSide: Bool
    /// Lying flat, so nothing needs a perspective.
    let envelopeSettled: Bool
    let envelopeCos: Double
    /// The envelope's own body; only the flap stays once the card lies open on the Duo.
    let envelopeBodyOpacity: Double
    /// The flap itself: upright on the Duo it goes too.
    let flapOpacity: Double

    // The flap, turning over its top edge.
    let flapAngle: Double
    let flapIsOpen: Bool
    let flapShadowOpacity: Double
    let flapBrightness: Double

    // The card.
    let showsCard: Bool
    let cardIsOut: Bool
    let cardX: Double
    let cardY: Double
    let cardRotation: Double
    let cardScale: Double
    let cardAngle: Double
    let cardTiltX: Double
    /// Lifted off the paper, 0 to 1: the shadows grow.
    let cardLift: Double
    let cardShadowWidth: Double
    let sheenX: Double
    let sheenY: Double
    let turnShade: Double

    /// The Duo's two pages: 0 one card, 1 open across the hinge.
    let spread: Double
    /// The picture's scale from the card's size to the page's.
    let pageScale: Double
    /// The note page: where it starts, and how far it's still folded behind the picture.
    let notePageX: Double
    let notePageY: Double
    let notePageTurn: Double
    let spreadIsSideways: Bool

    /// The flap darkens as it turns: the outside less, the lining more.
    private static func flapBrightness(_ theta: Double) -> Double {
        if theta < 0.01 || theta >= 179.99 { return 1 }
        return 1 - (theta < 90 ? 0.3 : 0.45) * sin(theta * .pi / 180)
    }

    /// The light's sheen and how the card turns: follows only the springs.
    private struct CardTurn {
        let angle: Double
        let tilt: Double
        let shadowWidth: Double
        let sheenX: Double
        let sheenY: Double
        let shade: Double

        init(_ s: CardTableSprings) {
            let tx = s.lightX.x
            let ty = s.lightY.x
            let radians = s.card.x * .pi / 180
            angle = s.card.x + tx * 3.2
            tilt = -ty * 2.6
            shadowWidth = max(0.03, abs(cos(radians)))
            sheenX = (tx * 0.9 + s.card.x / 180 * 0.6) * 0.26
            sheenY = ty * 0.16
            shade = abs(sin(radians)) * 0.34
        }
    }

    // One long working-out: the sample's `render()`, in its order, so the two can be read side by side.
    // swiftlint:disable:next function_body_length
    init(springs s: CardTableSprings, layout g: CardTableLayout, pages: CardTablePages? = nil) {
        let pull = s.pull.x
        let lay = s.lay.x
        let tx = s.lightX.x
        let ty = s.lightY.x
        let drop = s.drop.x
        lightX = tx
        lightY = ty
        let open = pages == nil ? 0 : min(1, max(0, s.spread.x))
        spread = open

        let flapT = cardTableEase(0, CardTableModel.flapOpen, pull)
        let theta = 180 * flapT
        let rise = cardTableEase(CardTableModel.flapOpen, 1, pull)

        // The envelope.
        let rotation = cardTableLerp(cardTableLerp(-1.1, 0.4, rise), 1.5, lay)
        var top = cardTableLerp(cardTableLerp(g.envelopeTop, g.envelopeTopOpen, flapT), g.envelopeTopOut, rise)
        top = cardTableLerp(top, g.envelopeTopFinal, lay)
        let arrive = drop * (g.height * 0.9)
        var envelopeLeft = g.envelopeX + tx * 2.5
        var envelopeTop = top + ty * 2.5 - arrive
        var scaleOfEnvelope = 1.0
        var turned = rotation - drop * 6
        if let pages, let flapWidth = pages.flapWidth {
            // Sideways, the flap stays above the middle of the two pages.
            scaleOfEnvelope = cardTableLerp(1, Double(flapWidth) / Double(g.envelopeWidth), open)
            envelopeLeft = cardTableLerp(envelopeLeft, pages.spine - flapWidth / 2, open)
            envelopeTop = cardTableLerp(envelopeTop, pages.flapTop + flapWidth * 512 / 1200, open)
            turned = cardTableLerp(turned, 0, open)
        }
        envelopeX = envelopeLeft
        envelopeY = envelopeTop
        envelopeRotation = turned
        envelopeScale = scaleOfEnvelope
        envelopeAngle = s.envelope.x
        envelopeCos = cos(s.envelope.x * .pi / 180)
        flapSide = envelopeCos < 0
        envelopeSettled = abs(sin(s.envelope.x * .pi / 180)) < 0.001
        envelopeBodyOpacity = 1 - open
        flapOpacity = pages?.flapWidth == nil ? 1 - open : 1

        // The flap.
        flapAngle = theta
        flapIsOpen = theta >= 90
        flapShadowOpacity = theta >= 90 ? 0 : pow(max(0, cos(theta * .pi / 180)), 1.4)
        flapBrightness = Self.flapBrightness(theta)

        // The card.
        var cardTop = cardTableLerp(top + g.envelopeHeight * 0.02, g.cardTopOut, rise)
        var cardRot = cardTableLerp(rotation, -0.8, rise)
        var scale = cardTableLerp(0.94, 1.03, cardTableEase(0.2, 1, rise))
        cardTop = cardTableLerp(cardTop, g.cardTop, lay)
        cardRot = cardTableLerp(cardRot, -1.05, lay)
        scale = cardTableLerp(scale, 1, lay)
        showsCard = flapSide && pull > 0.001
        cardIsOut = rise >= 0.999
        var left = g.cardX + tx * 5
        // It grows from its top edge.
        var cardTopNow = cardTop + ty * 5 - arrive + Double(g.cardHeight) * (scale - 1) / 2
        var pageScaleNow = 1.0
        if let pages {
            // The folded card opens across the hinge: the picture goes to its page, and the note swings out from
            // behind it.
            pageScaleNow = cardTableLerp(1, Double(pages.pictureFrame.width) / Double(g.cardWidth), open)
            left = cardTableLerp(left, pages.pictureFrame.minX, open)
            cardTopNow = cardTableLerp(cardTopNow, pages.pictureFrame.minY, open)
            cardRot = cardTableLerp(cardRot, 0, open)
            scale = cardTableLerp(scale, 1, open)
        }
        cardX = left
        cardY = cardTopNow
        cardRotation = cardRot
        cardScale = scale
        pageScale = pageScaleNow
        spreadIsSideways = pages?.isSideways ?? true
        if let pages {
            let gapAcross = pages.isSideways ? 0 : (pages.noteFrame.minY - pages.pictureFrame.maxY) * open
            notePageX = pages.isSideways ? left + g.cardWidth * pageScaleNow : left
            notePageY = pages.isSideways ? cardTopNow : cardTopNow + g.cardHeight * pageScaleNow + gapAcross
            notePageTurn = 90 * (1 - open)
        } else {
            notePageX = 0
            notePageY = 0
            notePageTurn = 90
        }
        let turn = CardTurn(s)
        cardAngle = turn.angle
        cardTiltX = turn.tilt
        cardLift = (1 - lay) * rise
        cardShadowWidth = turn.shadowWidth
        sheenX = turn.sheenX
        sheenY = turn.sheenY
        turnShade = turn.shade
    }
}
