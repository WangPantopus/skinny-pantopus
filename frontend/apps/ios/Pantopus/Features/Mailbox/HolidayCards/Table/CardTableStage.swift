//
//  CardTableStage.swift
//  Pantopus
//
//  The picture of the moment (launch key `card_table`): the cloth, the mail on
//  it in the right order, and the window's light over everything, moving as one.
//  Nothing here takes a touch; `CardTableScreen` has the finger and the buttons.
//

import SwiftUI
import UIKit

struct CardTableStage: View {
    let model: CardTableModel
    let art: CardTableArt
    /// The card's picture; nil shows plain paper until it loads.
    let picture: UIImage?
    let layout: CardTableLayout

    var body: some View {
        let pages = model.fold.pages(screen: layout.screen, bottomRoom: model.pagesBottomRoom(layout))
        let pose = CardTablePose(springs: model.springs, layout: layout, pages: pages)
        let content = model.content
        let ready = model.isReady
        ZStack(alignment: .topLeading) {
            cloth(pose, tint: MailPaper.tableTint(content.table))
            if ready {
                envelopeBack(pose)
                cardLayer(pose)
                    .frame(width: layout.screen.width, height: layout.screen.height, alignment: .topLeading)
                    // Enlarged (plan 6.1), from the card's middle; the light over it keeps moving.
                    .scaleEffect(model.zoom, anchor: zoomAnchor(pose))
                    .offset(model.zoomOffset)
                    .zIndex(pose.cardIsOut && pose.showsCard ? 20 : (pose.showsCard ? 5 : -1))
                envelopeFront(pose)
                    .zIndex(10)
            }
            light(pose)
                .zIndex(30)
            moodLayer(pose)
                .zIndex(30.5)
            CardTableVignette(spread: pose.spread)
                .frame(width: layout.screen.width, height: layout.screen.height)
                .zIndex(31)
            if let pages, pose.spread > 0 {
                CardTableCrease(pages: pages, screen: layout.screen, spread: pose.spread, halfClosed: model.fold.isHalfClosed)
                    .zIndex(31.5)
            }
            grain
                .zIndex(32)
        }
        .frame(width: layout.screen.width, height: layout.screen.height, alignment: .topLeading)
        .clipped()
        .allowsHitTesting(false)
    }

    /// The card's middle, as a point of the screen.
    private func zoomAnchor(_ pose: CardTablePose) -> UnitPoint {
        guard layout.screen.width > 0, layout.screen.height > 0 else { return .center }
        return UnitPoint(
            x: (pose.cardX + layout.cardWidth / 2) / layout.screen.width,
            y: (pose.cardY + layout.cardHeight / 2) / layout.screen.height
        )
    }

    // MARK: The table and its light

    private func cloth(_ pose: CardTablePose, tint: Color) -> some View {
        Image(uiImage: art.cloth)
            .resizable()
            .scaledToFill()
            .frame(width: layout.screen.width + 28, height: layout.screen.height + 28)
            .clipped()
            .colorMultiply(tint)
            .offset(x: -14 - pose.lightX * 7, y: -14 - pose.lightY * 7)
    }

    /// The mood over the table (plan Part 7): snow's shadows falling through the window's light, which move with it;
    /// or, for reverence, candlelight from the lower left.
    @ViewBuilder
    private func moodLayer(_ pose: CardTablePose) -> some View {
        if model.mood == .reverence {
            CardTableCandle(size: layout.screen, breathes: model.moodMoves)
        } else if model.moodMoves, model.isReady {
            CardTableSnow(size: CGSize(width: layout.screen.width + 80, height: layout.screen.height + 80))
                .scaleEffect(1.04)
                .offset(x: -40 + pose.lightX * 22, y: -40 + pose.lightY * 22)
                .opacity(cardTableLerp(1, 0.8, pose.spread))
        }
    }

    private func light(_ pose: CardTablePose) -> some View {
        Image(uiImage: art.light)
            .resizable()
            .frame(width: layout.screen.width + 80, height: layout.screen.height + 80)
            .scaleEffect(1.04)
            .offset(x: -40 + pose.lightX * 22, y: -40 + pose.lightY * 22)
            .opacity(cardTableLerp(0.88, 0.8, pose.spread))
            .blendMode(.softLight)
    }

    private var grain: some View {
        Image(uiImage: art.grain)
            .resizable(resizingMode: .tile)
            .frame(width: layout.screen.width, height: layout.screen.height)
            .opacity(0.36)
            .blendMode(.overlay)
    }

    // MARK: The envelope

    /// One layer of the envelope's flap side: it turns about its middle, tilts with the mail, and lies where the
    /// envelope lies.
    private func flapSideLayer(_ content: some View, _ pose: CardTablePose) -> some View {
        content
            .frame(width: layout.envelopeWidth, height: layout.envelopeHeight, alignment: .topLeading)
            .projectionEffect(pose.envelopeSettled ? ProjectionTransform() : .cardTableTurn(
                rotateY: pose.envelopeAngle + 180,
                perspective: layout.envelopeWidth * 3.6,
                anchor: CGPoint(x: layout.envelopeWidth / 2, y: layout.envelopeHeight / 2)
            ))
            .scaleEffect(pose.envelopeScale, anchor: .topLeading)
            .rotationEffect(.degrees(pose.envelopeRotation))
            .offset(x: pose.envelopeX, y: pose.envelopeY)
            .opacity(pose.flapSide ? 1 : 0)
    }

    @ViewBuilder
    private func envelopeBack(_ pose: CardTablePose) -> some View {
        CardTableSoftShadow(
            width: layout.envelopeWidth,
            height: layout.envelopeHeight,
            blur: layout.envelopeWidth * 0.08,
            spread: layout.envelopeWidth * 0.02,
            alpha: 0.72
        )
        .scaleEffect(x: max(0.02, abs(pose.envelopeCos)), y: 1)
        .rotationEffect(.degrees(pose.envelopeRotation))
        .offset(x: pose.envelopeX + 3 - pose.lightX * 7, y: pose.envelopeY + 7 - pose.lightY * 7)
        .opacity(0.78 * pose.envelopeBodyOpacity)
        .zIndex(1)
        flapSideLayer(Image(uiImage: art.inside).resizable().opacity(pose.envelopeBodyOpacity), pose)
            .zIndex(2)
        flapSideLayer(flapInside(pose).opacity(pose.flapOpacity), pose)
            .zIndex(3)
        flapSideLayer(Image(uiImage: art.pocketShadow).resizable().opacity(pose.envelopeBodyOpacity), pose)
            .zIndex(6)
        flapSideLayer(Image(uiImage: art.pocket).resizable().opacity(pose.envelopeBodyOpacity), pose)
            .zIndex(7)
        flapSideLayer(Image(uiImage: art.flapShadow).resizable().opacity(pose.flapShadowOpacity * pose.envelopeBodyOpacity), pose)
            .zIndex(8)
        flapSideLayer(flapOutside(pose), pose)
            .zIndex(9)
    }

    /// The open flap, lining up, turning over the envelope's top edge; a band of light slides over its gold.
    private func flapInside(_ pose: CardTablePose) -> some View {
        let width = layout.envelopeWidth
        let depth = layout.flapDepth
        return ZStack(alignment: .topLeading) {
            Image(uiImage: art.flapIn)
                .resizable()
                .frame(width: width, height: depth)
            CardTableGlint(width: width, depth: depth, mask: art.flapGold, lightX: pose.lightX, lightY: pose.lightY)
            // Reverence: one slow glint crosses the gold as the flap opens, left to right (plan Part 7).
            let sweep = model.springs.glint.x
            if model.mood == .reverence, sweep > 0.001, sweep < 0.999 {
                CardTableGlint(width: width, depth: depth, mask: art.flapGold, lightX: -1.2 + 2.4 * sweep, lightY: 0, band: 0.05)
            }
        }
        .frame(width: width, height: depth)
        .colorMultiply(Color(white: pose.flapIsOpen ? pose.flapBrightness : 1))
        .projectionEffect(pose.flapIsOpen && pose.flapAngle < 179.99 ? .cardTableTurn(
            rotateX: pose.flapAngle - 180,
            perspective: width * 2.4,
            anchor: CGPoint(x: width / 2, y: depth)
        ) : ProjectionTransform())
        .offset(y: -depth)
        .opacity(pose.flapIsOpen ? 1 : 0)
    }

    /// The shut flap and its wax seal, which swaps to cracked as the flap starts to lift.
    private func flapOutside(_ pose: CardTablePose) -> some View {
        let width = layout.envelopeWidth
        let depth = layout.flapDepth
        let sealWidth = width * 0.28
        return ZStack(alignment: .topLeading) {
            Image(uiImage: art.flapOut)
                .resizable()
                .frame(width: width, height: depth)
            if model.sending != nil, !model.sealShown {
                CardTableSealSpot(width: sealWidth, press: model.sealPress)
                    .offset(x: width * 0.36, y: depth * 0.71)
            }
            Image(uiImage: model.cracked ? art.waxCracked : art.wax)
                .resizable()
                .frame(width: sealWidth, height: sealWidth * 546 / 540)
                .rotationEffect(.degrees(model.cracked ? 2.5 : 0))
                .offset(y: model.cracked ? -sealWidth * 0.01 : 0)
                .animation(.easeInOut(duration: 0.16), value: model.cracked)
                // Sealing by hand: it's pressed on, and a refused seal lifts off.
                .scaleEffect(model.sealShown ? 1 : 1.18)
                .opacity(model.sealShown ? 1 : 0)
                .animation(.spring(response: 0.22, dampingFraction: 0.62), value: model.sealShown)
                .offset(x: width * 0.36, y: depth * 0.71)
        }
        .frame(width: width, height: depth, alignment: .topLeading)
        .colorMultiply(Color(white: pose.flapIsOpen ? 1 : pose.flapBrightness))
        .projectionEffect(!pose.flapIsOpen && pose.flapAngle > 0.01 ? .cardTableTurn(
            rotateX: pose.flapAngle,
            perspective: width * 2.4,
            anchor: CGPoint(x: width / 2, y: 0)
        ) : ProjectionTransform())
        .opacity(pose.flapIsOpen ? 0 : 1)
    }

    private func envelopeFront(_ pose: CardTablePose) -> some View {
        let content = model.content
        let setup = model.sendingSetup
        return CardTableEnvelopeFront(
            paper: art.envelopeFront,
            stamp: art.stamp(number: content.number),
            postmark: art.postmark,
            fromName: content.fromName,
            toName: content.toName,
            mailedOn: content.mailedOn,
            year: content.year,
            sealed: setup?.sealedForChristmas ?? content.sealed,
            reveal: model.addressing
        )
        .equatable()
        // To several people: a stack of envelopes under the top one.
        .background {
            if let setup, setup.count > 1 {
                ZStack {
                    Image(uiImage: art.envelopeFront).resizable()
                        .rotationEffect(.degrees(3.2))
                        .offset(x: layout.envelopeWidth * 0.03, y: layout.envelopeWidth * 0.035)
                    Image(uiImage: art.envelopeFront).resizable()
                        .rotationEffect(.degrees(-2.4))
                        .offset(x: -layout.envelopeWidth * 0.02, y: layout.envelopeWidth * 0.022)
                }
                .brightness(-0.12)
                .shadow(color: .black.opacity(0.35), radius: 6, x: 0, y: 4)
            }
        }
        .frame(width: layout.envelopeWidth, height: layout.envelopeHeight)
        .projectionEffect(pose.envelopeSettled ? ProjectionTransform() : .cardTableTurn(
            rotateY: pose.envelopeAngle,
            perspective: layout.envelopeWidth * 3.6,
            anchor: CGPoint(x: layout.envelopeWidth / 2, y: layout.envelopeHeight / 2)
        ))
        .rotationEffect(.degrees(pose.envelopeRotation))
        .offset(x: pose.envelopeX, y: pose.envelopeY)
        .opacity(pose.flapSide ? 0 : 1)
    }

    // MARK: The card

    /// The card and its shadows. Mounted from the start under the cloth, so it's drawn before it first shows.
    private func cardLayer(_ pose: CardTablePose) -> some View {
        ZStack(alignment: .topLeading) {
            if pose.cardIsOut {
                cardShadows(pose)
            }
            CardTableCardView(
                model: model,
                art: art,
                picture: picture,
                pose: pose,
                cardWidth: layout.cardWidth,
                cardHeight: layout.cardHeight
            )
        }
    }

    private func cardShadows(_ pose: CardTablePose) -> some View {
        let width = layout.cardWidth
        let height = layout.cardHeight
        let off = 6 + pose.cardLift * 26
        let scale = pose.cardScale * pose.pageScale
        let turning = pose.spread > 0 ? 1 : pose.cardShadowWidth
        return ZStack(alignment: .topLeading) {
            CardTableSoftShadow(width: width, height: height, blur: width * 0.14, spread: width * 0.035, alpha: 1)
                .scaleEffect(x: scale * turning, y: scale, anchor: pose.spread > 0 ? .topLeading : .center)
                .rotationEffect(.degrees(pose.cardRotation))
                .offset(x: pose.cardX + off * 0.45 - pose.lightX * 10, y: pose.cardY + off - pose.lightY * 10)
                .opacity(0.4 + pose.cardLift * 0.16)
            if pose.spread > 0 {
                // The note page's shadow comes as it lies flat.
                CardTableSoftShadow(width: width, height: height, blur: width * 0.14, spread: width * 0.035, alpha: 1)
                    .scaleEffect(scale, anchor: .topLeading)
                    .offset(x: pose.notePageX + off * 0.45, y: pose.notePageY + off)
                    .opacity(0.4 * pose.spread * pose.spread)
            }
            CardTableSoftShadow(width: width, height: height, blur: width * 0.03, spread: width * 0.0075, alpha: 1)
                .scaleEffect(x: scale * turning, y: scale, anchor: pose.spread > 0 ? .topLeading : .center)
                .rotationEffect(.degrees(pose.cardRotation))
                .offset(x: pose.cardX + 1.5 - pose.lightX * 2, y: pose.cardY + 2.5 - pose.lightY * 2)
                .opacity(0.55 * (1 - pose.cardLift))
        }
    }
}

/// The card itself: one card turning, each face showing only while it faces you; or on the open Duo, the folded
/// card's two pages.
private struct CardTableCardView: View {
    let model: CardTableModel
    let art: CardTableArt
    let picture: UIImage?
    let pose: CardTablePose
    let cardWidth: CGFloat
    let cardHeight: CGFloat

    var body: some View {
        let content = model.content
        let isOpen = pose.spread > 0
        let frontUp = isOpen || cos(pose.cardAngle * .pi / 180) >= 0
        let backUp = isOpen || !frontUp
        let center = CGPoint(x: cardWidth / 2, y: cardHeight / 2)
        let perspective = cardWidth * 5.2
        let anchor: UnitPoint = isOpen ? .topLeading : .center
        ZStack(alignment: .topLeading) {
            face(
                CardTableBack(
                    paperGrain: art.paper,
                    paper: content.paper,
                    note: content.note,
                    fromName: content.firstName,
                    year: content.year,
                    number: content.number,
                    signature: content.signature
                )
                .equatable()
            )
            .projectionEffect(isOpen ? notePageTurn : .cardTableTurn(
                rotateY: pose.cardAngle + 180,
                rotateX: pose.cardTiltX,
                perspective: perspective,
                anchor: center
            ))
            .scaleEffect(pose.cardScale * pose.pageScale, anchor: anchor)
            .rotationEffect(.degrees(isOpen ? 0 : pose.cardRotation))
            .offset(x: isOpen ? pose.notePageX : pose.cardX, y: isOpen ? pose.notePageY : pose.cardY)
            .opacity(backUp ? 1 : 0)
            face(
                CardTableFront(
                    picture: picture,
                    paperGrain: art.paper,
                    paper: content.paper,
                    caption: content.caption,
                    year: content.year,
                    mailedOn: content.mailedOn
                )
                .equatable()
            )
            .projectionEffect(isOpen ? ProjectionTransform() : .cardTableTurn(
                rotateY: pose.cardAngle,
                rotateX: pose.cardTiltX,
                perspective: perspective,
                anchor: center
            ))
            .scaleEffect(pose.cardScale * pose.pageScale, anchor: anchor)
            .rotationEffect(.degrees(pose.cardRotation))
            .offset(x: pose.cardX, y: pose.cardY)
            .opacity(frontUp ? 1 : 0)
        }
    }

    /// The note page swinging out from behind the picture, about the fold.
    private var notePageTurn: ProjectionTransform {
        if pose.spreadIsSideways {
            return .cardTableTurn(rotateY: pose.notePageTurn, perspective: cardWidth * 5.2, anchor: CGPoint(x: 0, y: cardHeight / 2))
        }
        return .cardTableTurn(rotateX: -pose.notePageTurn, perspective: cardWidth * 5.2, anchor: CGPoint(x: cardWidth / 2, y: 0))
    }

    /// A face, with the sheen that slides as the light moves and the shade as it turns.
    private func face(_ drawing: some View) -> some View {
        ZStack(alignment: .topLeading) {
            drawing
                .frame(width: cardWidth, height: cardHeight)
            CardTableSheen(width: cardWidth, height: cardHeight, x: pose.sheenX, y: pose.sheenY)
            Color.black.opacity(pose.turnShade)
        }
        .frame(width: cardWidth, height: cardHeight, alignment: .topLeading)
        .clipShape(RoundedRectangle(cornerRadius: cardWidth * 0.007, style: .continuous))
        .compositingGroup()
    }
}

/// Where the seal goes while a card is sealed by hand: a soft gold ring, and the stamp head's round shadow growing
/// over it while the finger holds.
private struct CardTableSealSpot: View {
    let width: CGFloat
    let press: Double

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(MailPaper.tableGold.opacity(0.55 + 0.35 * press), lineWidth: width * 0.035)
                .shadow(color: MailPaper.tableGold.opacity(0.7), radius: width * 0.12)
                .padding(width * 0.08)
            Circle()
                .fill(RadialGradient(
                    colors: [.black.opacity(0.5), .black.opacity(0.28), .clear],
                    center: .center,
                    startRadius: 0,
                    endRadius: width * 0.5
                ))
                .scaleEffect(0.35 + 0.75 * press)
                .opacity(press > 0 ? 0.35 + 0.65 * press : 0)
        }
        .frame(width: width, height: width * 546 / 540)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
