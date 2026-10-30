//
//  HolidayCardEnvelope.swift
//  Pantopus
//
//  A Christmas card in the Mailbox (`holiday_cards`; the web's `MailPiece`):
//  a red envelope addressed in cream ink, its stamp cancelled by the
//  postmark; the "Do not open until Christmas" seal while it's sealed,
//  "Christmas card" otherwise; and once opened, the card's picture peeking
//  out of the torn top. A sealed card never shows torn.
//

import SwiftUI

/// The red envelope, drawn where a letter's cream one would be.
struct HolidayCardEnvelopePiece: View {
    let model: MailPieceModel

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    Text(model.from).lineLimit(1)
                    if let line = model.fromLine { Text(line).lineLimit(1) }
                }
                .font(.system(size: 13, design: .serif).italic())
                .foregroundStyle(MailPaper.cardEnvelopeInk)
                .frame(maxWidth: geo.size.width * 0.48, alignment: .leading)
                .padding(.leading, Spacing.s4)
                .padding(.top, Spacing.s4)

                MailPostage(model: model)
                    .frame(maxWidth: .infinity, alignment: .topTrailing)
                    .padding(.trailing, 14)
                    .padding(.top, Spacing.s3)

                VStack(alignment: .leading, spacing: Spacing.s0) {
                    Text(model.to).lineLimit(1)
                    if let line = model.toLine { Text(line).lineLimit(1) }
                }
                .font(.system(size: 16, design: .serif).italic())
                .foregroundStyle(MailPaper.cardEnvelopeAddress)
                .minimumScaleFactor(0.8)
                .frame(width: geo.size.width * 0.58, alignment: .leading)
                .offset(x: geo.size.width * 0.38, y: 72)

                if model.card?.sealed == true {
                    ChristmasSeal()
                        .frame(width: 58, height: 58)
                        .frame(maxHeight: .infinity, alignment: .bottomLeading)
                        .padding(.leading, Spacing.s3)
                        .padding(.bottom, Spacing.s2)
                } else {
                    Text("Christmas card")
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(1.1)
                        .textCase(.uppercase)
                        .foregroundStyle(MailPaper.cardEnvelopeLabel)
                        .frame(maxHeight: .infinity, alignment: .bottomLeading)
                        .padding(.leading, Spacing.s4)
                        .padding(.bottom, Spacing.s3)
                }
            }
        }
        .frame(height: 150)
        // The faint light flecks of the red paper.
        .background(CardGrain(color: .white.opacity(0.05)))
        .mailPaper(MailPaper.cardEnvelope, edge: MailPaper.cardSealInk.opacity(0.35), radius: 6, torn: model.isOpened)
    }
}

/// The card's seal while it waits for Christmas morning.
struct ChristmasSeal: View {
    var body: some View {
        Canvas { context, size in
            let unit = size.width / 58
            let ink = MailPaper.cardSealInk
            let outer = Path(ellipseIn: CGRect(x: 2 * unit, y: 2 * unit, width: 54 * unit, height: 54 * unit))
            context.fill(outer, with: .color(MailPaper.cardSeal))
            context.stroke(outer, with: .color(ink), lineWidth: 2 * unit)
            context.stroke(
                Path(ellipseIn: CGRect(x: 6.5 * unit, y: 6.5 * unit, width: 45 * unit, height: 45 * unit)),
                with: .color(ink),
                style: StrokeStyle(lineWidth: 0.8 * unit, dash: [2 * unit, 2 * unit])
            )
            // A touch under the web's 6.4: the system monospace runs wider, and the words stay inside the ring.
            let fontSize = 6.0 * unit
            for (line, baseline) in [("DO NOT OPEN", 23.0), ("UNTIL", 31.5), ("CHRISTMAS", 40.0)] {
                context.draw(
                    Text(line).font(.system(size: fontSize, weight: .bold, design: .monospaced)).foregroundColor(ink),
                    at: CGPoint(x: 29 * unit, y: CGFloat(baseline) * unit - fontSize * 0.35)
                )
            }
        }
        .accessibilityHidden(true)
    }
}

/// The picture of an opened card, peeking out over its envelope's torn top.
struct HolidayCardPeek: View {
    let design: String

    var body: some View {
        GeometryReader { geo in
            if let image = HolidayCardPicture.image(design, thumb: true) {
                let height = geo.size.width / max(0.1, image.size.width / max(1, image.size.height))
                Image(uiImage: image)
                    .resizable()
                    .frame(width: geo.size.width, height: height)
                    // Its upper middle shows, as on the web (28% down the picture).
                    .offset(y: -(height - geo.size.height) * 0.28)
            } else {
                MailPaper.cardPaper(nil)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 2, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
        .shadow(color: .black.opacity(0.1), radius: 1, x: 0, y: 1)
        .accessibilityHidden(true)
    }
}
