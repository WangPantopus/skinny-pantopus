//
//  CardTableEnvelopeFront.swift
//  Pantopus
//
//  The address side of the envelope (launch key `card_table`): red paper, the
//  sender and the person it's for in the pen, the stamp cancelled by a postmark
//  with the real mailed day, and "Christmas card" or, sealed, the stamped "Do
//  not open until Christmas". One flat drawing, like the card's faces. An
//  address never shows here.
//

import SwiftUI
import UIKit

struct CardTableEnvelopeFront: View, Equatable {
    let paper: UIImage
    let stamp: UIImage
    let postmark: UIImage
    let fromName: String
    let toName: String
    /// The day it was mailed ("OCT 30"); none while it's being written.
    let mailedOn: String?
    let year: Int
    let sealed: Bool

    var body: some View {
        Canvas(rendersAsynchronously: false) { context, size in
            let width = size.width
            let height = size.height
            context.draw(Image(uiImage: paper), in: CGRect(origin: .zero, size: size))
            let stampWidth = width * 0.2017
            context.draw(
                Image(uiImage: stamp),
                in: CGRect(x: width * 0.755, y: height * 0.0345, width: stampWidth, height: stampWidth * 300 / 242)
            )
            drawPostmark(in: context, size: size)
            drawNames(in: context, size: size)
            if sealed {
                drawSealedStamp(in: context, size: size)
            } else {
                drawKind(in: context, size: size)
            }
        }
        .accessibilityHidden(true)
    }

    /// The inked postmark, with the mailed day over its rings.
    private func drawPostmark(in context: GraphicsContext, size: CGSize) {
        let width = size.width * 0.5183
        let box = CGRect(x: size.width * 0.345, y: size.height * 0.0316, width: width, height: width * 365 / 622)
        CardTableInkedPostmark.draw(postmark, in: context, box: box, day: mailedOn, year: year)
    }

    private func drawNames(in context: GraphicsContext, size: CGSize) {
        let width = size.width
        // The sender small at the top left, turned a little.
        CardTablePenLine(
            text: fromName,
            fontSize: width * 0.05,
            lineHeight: width * 0.05 * 1.15,
            turn: -0.8,
            ink: MailPaper.tableFromName,
            maxWidth: width * 0.27
        )
        .draw(in: context, x: width * 0.066, top: size.height * 0.062)
        // Who it's for, large across the middle. A long name gets smaller instead of running off the paper.
        CardTablePenLine(
            text: toName,
            fontSize: width * 0.094,
            lineHeight: width * 0.094 * 1.1,
            turn: -1.6,
            ink: MailPaper.tableToName,
            maxWidth: width * 0.78,
            shadow: MailPaper.tableToNameShadow
        )
        .draw(in: context, x: width * 0.15, top: size.height * 0.46)
    }

    private func drawKind(in context: GraphicsContext, size: CGSize) {
        let fontSize = size.width * 0.0235
        let font = CardTableSerif.font(size: fontSize, weight: .semibold)
        let top = size.height - size.height * 0.054 - fontSize
        context.drawText(
            Text("CHRISTMAS CARD").font(Font(font)).tracking(fontSize * 0.2).foregroundColor(MailPaper.tableGold),
            x: size.width * 0.068,
            baseline: top + CardTableType.baseline(font, lineHeight: fontSize)
        )
    }

    /// "DO NOT OPEN UNTIL CHRISTMAS" in gold ink, in its double border, turned -7 degrees.
    private func drawSealedStamp(in context: GraphicsContext, size: CGSize) {
        CardTableSealedStamp(
            fontSize: size.width * 0.04,
            border: size.width * 0.007,
            padding: CGSize(width: size.width * 0.03, height: size.width * 0.018),
            radius: size.width * 0.012
        )
        .draw(in: context, center: CGPoint(x: size.width * 0.5, y: size.height * 0.74))
    }

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.paper === rhs.paper && lhs.stamp === rhs.stamp && lhs.postmark === rhs.postmark && lhs.fromName == rhs.fromName
            && lhs.toName == rhs.toName && lhs.mailedOn == rhs.mailedOn && lhs.year == rhs.year && lhs.sealed == rhs.sealed
    }
}

/// The inked postmark on an envelope: the art's rings and wavy lines, with the real mailed day printed over them.
enum CardTableInkedPostmark {
    static func draw(_ postmark: UIImage, in context: GraphicsContext, box: CGRect, day: String?, year: Int) {
        context.draw(Image(uiImage: postmark), in: box)
        func line(_ text: String, x: CGFloat, y: CGFloat, size: CGFloat, tracking: CGFloat) {
            var ink = context
            ink.translateBy(x: box.minX + box.width * x, y: box.minY + box.height * y)
            ink.rotate(by: .degrees(7))
            ink.drawText(
                Text(text)
                    .font(.custom("Georgia-Bold", fixedSize: box.width * size))
                    .tracking(box.width * tracking)
                    .foregroundColor(MailPaper.tablePostmarkInk),
                centeredOn: 0,
                baseline: 0
            )
        }
        if let day, !day.isEmpty {
            line(day, x: 0.2652, y: 0.4427, size: 0.064, tracking: 0.0028)
        }
        line(String(year), x: 0.2577, y: 0.5468, size: 0.0522, tracking: 0.0024)
    }
}

/// One line in the pen on the envelope, turned a little about its middle.
struct CardTablePenLine {
    let text: String
    let fontSize: CGFloat
    let lineHeight: CGFloat
    let turn: Double
    let ink: Color
    let maxWidth: CGFloat
    var shadow: Color?

    func draw(in context: GraphicsContext, x: CGFloat, top: CGFloat) {
        var font = CardTableType.pen(fontSize)
        var textWidth = (text as NSString).size(withAttributes: [.font: font]).width
        if textWidth > maxWidth {
            font = CardTableType.pen(fontSize * maxWidth / textWidth)
            textWidth = maxWidth
        }
        let baseline = top + CardTableType.baseline(font, lineHeight: lineHeight)
        var layer = context
        layer.translateBy(x: x + textWidth / 2, y: top + lineHeight / 2)
        layer.rotate(by: .degrees(turn))
        let relative = baseline - (top + lineHeight / 2)
        if let shadow {
            layer.drawText(Text(text).font(Font(font)).foregroundColor(shadow), centeredOn: 0, baseline: relative + 0.5)
        }
        layer.drawText(Text(text).font(Font(font)).foregroundColor(ink), centeredOn: 0, baseline: relative)
    }
}

/// The stamped words on a sealed envelope.
struct CardTableSealedStamp {
    let fontSize: CGFloat
    let border: CGFloat
    let padding: CGSize
    let radius: CGFloat

    private var lineHeight: CGFloat {
        fontSize * 1.18
    }

    private var font: UIFont {
        CardTableSerif.font(size: fontSize, weight: .bold)
    }

    private func line(_ text: String) -> Text {
        Text(text).font(Font(font)).tracking(fontSize * 0.11).foregroundColor(MailPaper.tableSealedStamp)
    }

    /// The whole stamp, with its border and padding.
    func size(in context: GraphicsContext) -> CGSize {
        let room = CGSize(width: 100_000, height: 100_000)
        let textWidth = max(
            context.resolve(line("DO NOT OPEN")).measure(in: room).width,
            context.resolve(line("UNTIL CHRISTMAS")).measure(in: room).width
        )
        return CGSize(width: textWidth + 2 * (padding.width + border), height: 2 * lineHeight + 2 * (padding.height + border))
    }

    func draw(in context: GraphicsContext, center: CGPoint) {
        let tracking = fontSize * 0.11
        let top = line("DO NOT OPEN")
        let bottom = line("UNTIL CHRISTMAS")
        let box = size(in: context)
        let boxWidth = box.width
        let boxHeight = box.height
        var stamp = context
        stamp.translateBy(x: center.x, y: center.y)
        stamp.rotate(by: .degrees(-7))
        let outer = CGRect(x: -boxWidth / 2, y: -boxHeight / 2, width: boxWidth, height: boxHeight)
        let third = border / 3
        let color = GraphicsContext.Shading.color(MailPaper.tableSealedStamp)
        stamp.stroke(Path(roundedRect: outer.insetBy(dx: third / 2, dy: third / 2), cornerRadius: radius), with: color, lineWidth: third)
        let inset = border - third / 2
        let inner = Path(roundedRect: outer.insetBy(dx: inset, dy: inset), cornerRadius: max(0, radius - inset))
        stamp.stroke(inner, with: color, lineWidth: third)
        let baselineInLine = CardTableType.baseline(font, lineHeight: lineHeight)
        let textTop = -lineHeight
        stamp.drawText(top, centeredOn: tracking / 2, baseline: textTop + baselineInLine)
        stamp.drawText(bottom, centeredOn: tracking / 2, baseline: textTop + lineHeight + baselineInLine)
    }
}
