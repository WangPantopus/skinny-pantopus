//
//  CardTableShareScene.swift
//  Pantopus
//
//  The pictures a card shares as (launch key `card_table`), drawn on the phone so
//  nothing private leaves it. Each is laid out in a 540-wide space, as the
//  sample's `share.html`, and drawn at twice that. The note and the sender's name
//  stay off unless the person turns on "Show the note"; then only the first name
//  shows. An address never shows, and a sealed card is only ever the sealed
//  envelope. The slip is how people find us, so it's in every picture.
//

import SwiftUI
import UIKit

/// A share picture's size.
enum CardShareFormat: String, CaseIterable, Identifiable {
    case story
    case post
    case link

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .story: "Story"
        case .post: "Post"
        case .link: "Link preview"
        }
    }

    /// In the space it's laid out in; drawn at twice this.
    var size: CGSize {
        switch self {
        case .story: CGSize(width: 540, height: 960)
        case .post: CGSize(width: 540, height: 675)
        case .link: CGSize(width: 600, height: 315)
        }
    }
}

struct CardTableShareScene: View {
    let format: CardShareFormat
    let showsNote: Bool
    let content: CardTableContent
    let art: CardTableArt
    let picture: UIImage?

    var body: some View {
        let size = format.size
        ZStack(alignment: .topLeading) {
            Image(uiImage: art.cloth)
                .resizable()
                .scaledToFill()
                .frame(width: size.width + 20, height: size.height + 20)
                .clipped()
                .colorMultiply(MailPaper.tableTint(content.table))
                .offset(x: -10, y: -10)
            objects
            Image(uiImage: art.light)
                .resizable()
                .frame(width: size.width + 120, height: size.height + 120)
                .offset(x: -60, y: -60)
                .opacity(0.95)
                .blendMode(.softLight)
            CardTableVignette()
                .frame(width: size.width, height: size.height)
            Image(uiImage: art.grain)
                .resizable(resizingMode: .tile)
                .frame(width: size.width, height: size.height)
                .opacity(0.34)
                .blendMode(.overlay)
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .clipped()
    }

    @ViewBuilder
    private var objects: some View {
        switch format {
        case .story:
            if content.sealed {
                shutEnvelope(width: 460, x: 40, y: 190, rotation: -2.4, sealWidth: 136)
                sealedStamp(fontSize: 21, left: 96, top: 506)
                slip(x: 122, y: 776, rotation: -1.6, width: 296, height: 54, title: 13.5, line: 13.5)
            } else if showsNote {
                openEnvelope(width: 350, x: 96, y: 276, rotation: 5)
                front(width: 330, x: 26, y: 118, rotation: -4.5)
                back(width: 330, x: 184, y: 412, rotation: 3.5)
                slip(x: 26, y: 806, rotation: -2.2, width: 250, height: 50, title: 12, line: 12.5)
            } else {
                openEnvelope(width: 424 * 1.012, x: 56, y: 236, rotation: 3.2)
                front(width: 424, x: 58, y: 244, rotation: -3)
                slip(x: 122, y: 776, rotation: -1.6, width: 296, height: 54, title: 13.5, line: 13.5)
            }
        case .post:
            if content.sealed {
                shutEnvelope(width: 410, x: 65, y: 62, rotation: -2.2, sealWidth: 122)
                sealedStamp(fontSize: 18, left: 118, top: 352)
                slip(x: 139, y: 606, rotation: -1.2, width: 262, height: 46, title: 12, line: 12)
            } else if showsNote {
                openEnvelope(width: 286, x: 127, y: 158, rotation: 2.5)
                front(width: 258, x: 16, y: 112, rotation: -3.2)
                back(width: 258, x: 266, y: 124, rotation: 2.8)
                slip(x: 139, y: 612, rotation: -1.2, width: 262, height: 46, title: 12, line: 12)
            } else {
                openEnvelope(width: 368 * 1.012, x: 84, y: 120, rotation: 3)
                front(width: 368, x: 86, y: 118, rotation: -2.6)
                slip(x: 139, y: 606, rotation: -1.2, width: 262, height: 46, title: 12, line: 12)
            }
        case .link:
            openEnvelope(width: 196 * 1.012, x: 43, y: 72, rotation: 3)
            front(width: 196, x: 44, y: 66, rotation: -3)
            linkWords
        }
    }

    // MARK: The mail

    /// The open envelope lying behind: flap up, lining, pocket.
    private func openEnvelope(width: CGFloat, x: CGFloat, y: CGFloat, rotation: Double) -> some View {
        let height = width * 1392 / 1200
        let depth = width * 512 / 1200
        return ZStack(alignment: .topLeading) {
            Image(uiImage: art.flapIn).resizable().frame(width: width, height: depth).offset(y: -depth)
            Image(uiImage: art.inside).resizable().frame(width: width, height: height)
            Image(uiImage: art.pocketShadow).resizable().frame(width: width, height: height)
            Image(uiImage: art.pocket).resizable().frame(width: width, height: height)
        }
        .frame(width: width, height: height, alignment: .topLeading)
        .compositingGroup()
        .shadow(color: .black.opacity(0.5), radius: 3.5, x: 2, y: 5)
        .rotationEffect(.degrees(rotation))
        .offset(x: x, y: y)
    }

    /// The shut envelope, its flap and a large seal.
    private func shutEnvelope(width: CGFloat, x: CGFloat, y: CGFloat, rotation: Double, sealWidth: CGFloat) -> some View {
        let height = width * 1392 / 1200
        let depth = width * 512 / 1200
        return ZStack(alignment: .topLeading) {
            Image(uiImage: art.pocket).resizable().frame(width: width, height: height)
            Image(uiImage: art.flapShadow).resizable().frame(width: width, height: height)
            Image(uiImage: art.flapOut).resizable().frame(width: width, height: depth)
            Image(uiImage: art.wax)
                .resizable()
                .frame(width: sealWidth, height: sealWidth * 546 / 540)
                .offset(x: (width - sealWidth) / 2, y: depth * 0.96 - sealWidth * 0.5)
        }
        .frame(width: width, height: height, alignment: .topLeading)
        .compositingGroup()
        .shadow(color: .black.opacity(0.55), radius: 5.5, x: 3, y: 8)
        .rotationEffect(.degrees(rotation))
        .offset(x: x, y: y)
    }

    private func front(width: CGFloat, x: CGFloat, y: CGFloat, rotation: Double) -> some View {
        cardBox(width: width, x: x, y: y, rotation: rotation) {
            CardTableFront(
                picture: picture,
                paperGrain: art.paper,
                paper: content.paper,
                caption: content.caption,
                year: content.year,
                mailedOn: content.mailedOn,
                grainOpacity: 0.7
            )
        }
    }

    private func back(width: CGFloat, x: CGFloat, y: CGFloat, rotation: Double) -> some View {
        cardBox(width: width, x: x, y: y, rotation: rotation) {
            CardTableBack(
                paperGrain: art.paper,
                paper: content.paper,
                note: content.note,
                fromName: content.firstName,
                year: content.year,
                number: content.number,
                grainOpacity: 0.7
            )
        }
    }

    /// A card lying on the table with its two soft shadows.
    private func cardBox(width: CGFloat, x: CGFloat, y: CGFloat, rotation: Double, @ViewBuilder face: () -> some View) -> some View {
        let unit = width / 100
        return face()
            .frame(width: width, height: width * 1.2)
            .shadow(color: .black.opacity(0.42), radius: unit, x: unit * 0.6, y: unit * 1.1)
            .shadow(color: .black.opacity(0.45), radius: unit * 4.5, x: unit * 1.6, y: unit * 3.2)
            .rotationEffect(.degrees(rotation))
            .offset(x: x, y: y)
    }

    private func sealedStamp(fontSize: CGFloat, left: CGFloat, top: CGFloat) -> some View {
        Canvas(rendersAsynchronously: false) { context, _ in
            // The stamp's box starts at (left, top); its padding is .55em by .9em, with a 3-point double border.
            let padding = CGSize(width: fontSize * 0.9, height: fontSize * 0.55)
            let stamp = CardTableSealedStamp(fontSize: fontSize, border: 3, padding: padding, radius: 6)
            let size = stamp.size(in: context)
            stamp.draw(in: context, center: CGPoint(x: left + size.width / 2, y: top + size.height / 2))
        }
        .frame(width: format.size.width, height: format.size.height)
    }

    /// The paper slip: "PANTOPUS POST" and where to send one.
    private func slip(
        x: CGFloat,
        y: CGFloat,
        rotation: Double,
        width: CGFloat,
        height: CGFloat,
        title: CGFloat,
        line: CGFloat
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("PANTOPUS POST")
                .font(.system(size: title, weight: .semibold, design: .serif))
                .tracking(title * 0.24)
                .foregroundStyle(MailPaper.tableSlipInk)
            Text("Send one at pantopus.com/cards")
                .font(.system(size: line, design: .serif))
                .tracking(line * 0.03)
                .foregroundStyle(MailPaper.tableSlipLine)
        }
        .lineLimit(1)
        .fixedSize()
        .padding(.leading, height * 0.36)
        .frame(width: width, height: height, alignment: .leading)
        .background {
            Canvas(rendersAsynchronously: false) { context, size in
                let rect = CGRect(origin: .zero, size: size)
                context.fill(Path(rect), with: .color(MailPaper.tableSlip))
                context.fillPaperGrain(art.paper, in: rect, tile: 220, opacity: 1)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 1.5))
        .shadow(color: .black.opacity(0.45), radius: 2.5, x: 1, y: 2)
        .rotationEffect(.degrees(rotation))
        .offset(x: x, y: y)
    }

    /// The link preview's words: the caption by hand, PANTOPUS POST and one line.
    private var linkWords: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(content.sealed ? "A Christmas card" : content.caption)
                .font(Font(CardTableType.hand(29)))
                .foregroundStyle(MailPaper.tableLinkCaption)
            Text("PANTOPUS POST")
                .font(.system(size: 12, weight: .semibold, design: .serif))
                .tracking(12 * 0.24)
                .foregroundStyle(MailPaper.tableLinkTitle)
                .padding(.top, 24)
            Text("A Christmas card that feels like real mail. Send one at pantopus.com/cards")
                .font(.system(size: 15, design: .serif))
                .lineSpacing(15 * 0.42 - 3)
                .foregroundStyle(MailPaper.tableCream.opacity(0.84))
                .padding(.top, 9)
        }
        .frame(width: 280, alignment: .leading)
        .offset(x: 294, y: 58)
    }
}

/// Draws a share picture.
@MainActor
enum CardTableSharePicture {
    static func draw(_ scene: CardTableShareScene) -> UIImage? {
        let renderer = ImageRenderer(content: scene)
        renderer.scale = 2
        renderer.proposedSize = ProposedViewSize(scene.format.size)
        renderer.isOpaque = true
        return renderer.uiImage
    }
}
