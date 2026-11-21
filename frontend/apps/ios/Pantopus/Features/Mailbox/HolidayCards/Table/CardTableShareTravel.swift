//
//  CardTableShareTravel.swift
//  Pantopus
//
//  A travelling card's share pictures (server switch `card_travel`, travelling card plan Part 7): the envelope's
//  address side with its postmarks and no names behind the picture, and a slip: "5 TOWNS · 2,692 MILES", "Still
//  travelling", "Start one at pantopus.com/cards". Story, Post and Link preview; never on a sealed card.
//

import SwiftUI

extension CardTableShareScene {
    /// A card that travels, not sealed: its postmarks show behind the picture; never on a sealed card.
    var travel: CardTravelEnvelope? {
        content.sealed ? nil : content.travel
    }

    /// The envelope's address side with its postmarks and no names behind the card, and the journey's slip.
    @ViewBuilder
    var travelObjects: some View {
        switch format {
        case .story:
            travelEnvelope(width: 380, x: 116, y: 132, rotation: 6)
            front(width: 330, x: 36, y: 404, rotation: -3.5)
            travelSlip(CardShareSlip(x: 70, y: 812, rotation: 1.2, width: 400, height: 84, title: 20, line: 15))
        case .post:
            travelEnvelope(width: 300, x: 204, y: 34, rotation: 6)
            front(width: 290, x: 46, y: 214, rotation: -3.5)
            travelSlip(CardShareSlip(x: 110, y: 592, rotation: 1.2, width: 320, height: 70, title: 16.5, line: 12.5))
        default:
            travelEnvelope(width: 168, x: 104, y: 22, rotation: 6)
            front(width: 168, x: 36, y: 98, rotation: -3.5)
            linkWords
        }
    }

    /// The address side: its postmarks, the stamp and CHRISTMAS CARD, no names.
    private func travelEnvelope(width: CGFloat, x: CGFloat, y: CGFloat, rotation: Double) -> some View {
        CardTableEnvelopeFront(
            paper: art.envelopeFront,
            stamp: art.stamp(number: content.number),
            postmark: art.postmark,
            fromName: "",
            toName: "",
            mailedOn: nil,
            year: content.year,
            sealed: false,
            travelMarks: travel?.marks ?? []
        )
        .frame(width: width, height: width * 1392 / 1200)
        .shadow(color: .black.opacity(0.5), radius: 4, x: 2, y: 6)
        .rotationEffect(.degrees(rotation))
        .offset(x: x, y: y)
    }

    /// "5 TOWNS · 2,692 MILES", "Still travelling", "Start one at pantopus.com/cards".
    private func travelSlip(_ slip: CardShareSlip) -> some View {
        VStack(spacing: slip.line * 0.2) {
            Text(travel?.slipLine ?? "")
                .font(.system(size: slip.title, weight: .semibold, design: .serif))
                .tracking(slip.title * 0.13)
                .foregroundStyle(MailPaper.tableSlipInk)
            Text("Still travelling")
                .font(.system(size: slip.line))
                .tracking(slip.line * 0.06)
                .foregroundStyle(MailPaper.tableSlipLine)
            Text("Start one at pantopus.com/cards")
                .font(.system(size: slip.line))
                .tracking(slip.line * 0.06)
                .foregroundStyle(MailPaper.tableSlipLine)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(width: slip.width, height: slip.height)
        .background {
            Canvas(rendersAsynchronously: false) { context, size in
                let rect = CGRect(origin: .zero, size: size)
                context.fill(Path(rect), with: .color(MailPaper.tableSlip))
                context.fillPaperGrain(art.paper, in: rect, tile: 220, opacity: 1)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 1.5))
        .shadow(color: .black.opacity(0.45), radius: 2.5, x: 1, y: 2)
        .rotationEffect(.degrees(slip.rotation))
        .offset(x: slip.x, y: slip.y)
    }
}
