//
//  CardTableFaces.swift
//  Pantopus
//
//  The two faces of the card on the table (launch key `card_table`). Every size
//  is a share of the card's width (`u` = 1% of it): the card is 100u wide and
//  120u tall. Each face is one flat drawing, so it moves as one picture, turns
//  without redrawing, and draws the same into a share picture. Like the
//  Mailbox's drawn mail it has fixed type; VoiceOver reads it as one sentence.
//

import SwiftUI
import UIKit

/// The card's shape, width over height.
enum CardTableShape {
    static let aspect: CGFloat = 100.0 / 120.0
}

/// The hand a caption is printed in and the pen a note is written with.
enum CardTableType {
    static let handName = "NothingYouCouldDo"
    static let penName = "LaBelleAurore"

    static func hand(_ size: CGFloat) -> UIFont {
        UIFont(name: handName, size: size) ?? .italicSystemFont(ofSize: size)
    }

    static func pen(_ size: CGFloat) -> UIFont {
        UIFont(name: penName, size: size) ?? .italicSystemFont(ofSize: size)
    }

    /// Where a line's baseline sits in a line box this tall: half the spare room above the font's own height, then
    /// its ascent.
    static func baseline(_ font: UIFont, lineHeight: CGFloat) -> CGFloat {
        (lineHeight - (font.ascender - font.descender)) / 2 + font.ascender
    }

    /// A Bible verse's reference ("John 3:16 (KJV)", the Christmas with Jesus Christ collection): it's set in the
    /// card's serif, italic, so the colon reads (plan 1.12). Web's rule: it ends in chapter:verse, with an optional
    /// "(KJV)". Stored captions don't change.
    static func isVerseReference(_ caption: String) -> Bool {
        caption.range(of: #"[\s\u{00A0}]\d{1,3}:\d{1,3}([-–]\d{1,3})?(\s\(KJV\))?$"#, options: .regularExpression) != nil
    }

    /// The caption's type: the hand, or the serif italic for a verse's reference.
    static func caption(_ caption: String, size: CGFloat) -> UIFont {
        guard isVerseReference(caption) else { return hand(size) }
        let serif = CardTableSerif.font(size: size)
        guard let italic = serif.fontDescriptor.withSymbolicTraits(.traitItalic) else { return serif }
        return UIFont(descriptor: italic, size: size)
    }

    /// The size a caption is printed at, in u: a long one gets smaller so it stays on one line beside the postmark.
    static func captionSize(_ caption: String) -> CGFloat {
        min(4.8, 70 / max(1, CGFloat(caption.count) * 0.53))
    }
}

extension GraphicsContext {
    /// Draws text with its baseline at `y`.
    func drawText(_ text: Text, x: CGFloat, baseline y: CGFloat) {
        let resolved = resolve(text)
        let room = CGSize(width: 100_000, height: 100_000)
        draw(resolved, at: CGPoint(x: x, y: y - resolved.firstBaseline(in: room)), anchor: .topLeading)
    }

    /// Draws text centred on `x`, with its baseline at `y`.
    func drawText(_ text: Text, centeredOn x: CGFloat, baseline y: CGFloat) {
        let resolved = resolve(text)
        let room = CGSize(width: 100_000, height: 100_000)
        draw(resolved, at: CGPoint(x: x, y: y - resolved.firstBaseline(in: room)), anchor: .top)
    }

    /// Paper grain over `rect`, tiled every 60u.
    func fillPaperGrain(_ paper: UIImage?, in rect: CGRect, u: CGFloat, opacity: Double) {
        fillPaperGrain(paper, in: rect, tile: 60 * u, opacity: opacity)
    }

    /// Paper grain over `rect`, one tile this wide.
    func fillPaperGrain(_ paper: UIImage?, in rect: CGRect, tile: CGFloat, opacity: Double) {
        guard let paper else { return }
        var layer = self
        layer.blendMode = .multiply
        layer.opacity = opacity
        let scale = tile / max(1, paper.size.width)
        layer.fill(Path(rect), with: .tiledImage(Image(uiImage: paper), scale: scale))
    }

    /// The soft darker edges of an old card, over its whole face.
    func strokeCardEdges(in rect: CGRect, u: CGFloat) {
        var layer = self
        layer.addFilter(.blur(radius: 1.3 * u))
        let wide = 8 * u
        layer.stroke(Path(rect.insetBy(dx: -wide / 2, dy: -wide / 2)), with: .color(MailPaper.tableCardEdge), lineWidth: wide)
    }
}

/// The picture side: the picture in its cream border, the caption by hand, the year and the red postmark.
struct CardTableFront: View, Equatable {
    /// Nil shows plain paper until the picture loads.
    let picture: UIImage?
    let paperGrain: UIImage?
    let paper: String?
    let caption: String
    let year: Int
    /// The day it was mailed ("OCT 30"); none while it's being written.
    let mailedOn: String?
    var grainOpacity = 0.5

    var body: some View {
        Canvas(rendersAsynchronously: false) { context, size in
            let u = size.width / 100
            let rect = CGRect(origin: .zero, size: size)
            var face = context
            face.clip(to: Path(roundedRect: rect, cornerRadius: 0.7 * u, style: .continuous))
            face.fill(Path(rect), with: .color(MailPaper.cardPaper(paper)))
            drawPicture(in: face, u: u)
            drawStrip(in: face, u: u)
            face.fillPaperGrain(paperGrain, in: rect, u: u, opacity: grainOpacity)
            face.strokeCardEdges(in: rect, u: u)
        }
        .accessibilityHidden(true)
    }

    /// 96.6u by 103u at (1.7u, 1.7u), covering its box.
    private func drawPicture(in context: GraphicsContext, u: CGFloat) {
        let box = CGRect(x: 1.7 * u, y: 1.7 * u, width: 96.6 * u, height: 103 * u)
        guard let picture, picture.size.width > 0, picture.size.height > 0 else { return }
        var photo = context
        photo.clip(to: Path(box))
        photo.addFilter(.contrast(1.03))
        photo.addFilter(.saturation(1.04))
        let scale = max(box.width / picture.size.width, box.height / picture.size.height)
        let drawn = CGSize(width: picture.size.width * scale, height: picture.size.height * scale)
        photo.draw(
            Image(uiImage: picture),
            in: CGRect(x: box.midX - drawn.width / 2, y: box.midY - drawn.height / 2, width: drawn.width, height: drawn.height)
        )
        context.stroke(Path(box.insetBy(dx: -0.25, dy: -0.25)), with: .color(MailPaper.tablePhotoEdge), lineWidth: 0.5)
    }

    private func drawStrip(in context: GraphicsContext, u: CGFloat) {
        let size = CardTableType.captionSize(caption) * u
        let hand = CardTableType.caption(caption, size: size)
        context.drawText(
            Text(caption).font(Font(hand)).foregroundColor(MailPaper.cardCaptionInk),
            x: 4.2 * u,
            baseline: 107.4 * u + CardTableType.baseline(hand, lineHeight: size)
        )
        let yearFont = CardTableSerif.font(size: 2.2 * u)
        context.drawText(
            Text("CHRISTMAS, \(String(year))").font(Font(yearFont)).tracking(2.2 * u * 0.42).foregroundColor(MailPaper.cardYearInk),
            x: 4.2 * u,
            baseline: 114.2 * u + CardTableType.baseline(yearFont, lineHeight: 2.2 * u)
        )
        var mark = context
        let box = CGRect(x: 77.5 * u, y: 106.2 * u, width: 20 * u, height: 12 * u)
        mark.translateBy(x: box.midX, y: box.midY)
        mark.rotate(by: .degrees(-3))
        mark.translateBy(x: -box.width / 2, y: -box.height / 2)
        CardTablePostmark.draw(in: mark, width: box.width, day: mailedOn, year: year)
    }

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.picture === rhs.picture && lhs.paperGrain === rhs.paperGrain && lhs.paper == rhs.paper
            && lhs.caption == rhs.caption && lhs.year == rhs.year && lhs.mailedOn == rhs.mailedOn
            && lhs.grainOpacity == rhs.grainOpacity
    }
}

/// The small postmark on the card's face, in a 100 by 60 box: two rings with the day over the year, and three wavy
/// lines to the right.
enum CardTablePostmark {
    static func draw(in context: GraphicsContext, width: CGFloat, day: String?, year: Int) {
        let unit = width / 100
        let ink = MailPaper.cardPostmark
        let line = ink.opacity(0.86)
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: x * unit, y: y * unit)
        }
        let outer = CGRect(x: 14 * unit, y: 8 * unit, width: 44 * unit, height: 44 * unit)
        let inner = CGRect(x: 17.5 * unit, y: 11.5 * unit, width: 37 * unit, height: 37 * unit)
        context.stroke(Path(ellipseIn: outer), with: .color(line), lineWidth: 1.6 * unit)
        context.stroke(Path(ellipseIn: inner), with: .color(line), lineWidth: 0.8 * unit)
        for y: CGFloat in [21, 30, 39] {
            var wave = Path()
            wave.move(to: point(58, y))
            wave.addQuadCurve(to: point(70, y), control: point(64, y - 8))
            wave.addQuadCurve(to: point(82, y), control: point(76, y + 8))
            wave.addQuadCurve(to: point(94, y), control: point(88, y - 8))
            context.stroke(wave, with: .color(line), lineWidth: 1.6 * unit)
        }
        let dayText = day.flatMap { $0.isEmpty ? nil : $0 }
        let dayFont = Font.custom("Georgia-Bold", fixedSize: (dayText == nil ? 10 : 7.6) * unit)
        let yearFont = Font.custom("Georgia-Bold", fixedSize: 8.5 * unit)
        let dayLine = Text(dayText ?? "DEC").font(dayFont).foregroundColor(ink)
        let yearLine = Text(String(year)).font(yearFont).foregroundColor(ink)
        context.drawText(dayLine, centeredOn: 36 * unit, baseline: (dayText == nil ? 33 : 28) * unit)
        context.drawText(yearLine, centeredOn: 36 * unit, baseline: (dayText == nil ? 45 : 40) * unit)
    }
}

/// The serif the card's printing uses.
enum CardTableSerif {
    static func font(size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
        let base = UIFont.systemFont(ofSize: size, weight: weight)
        guard let serif = base.fontDescriptor.withDesign(.serif) else { return base }
        return UIFont(descriptor: serif, size: size)
    }
}

/// The back: rules, the note in the pen, who it's from, and the Pantopus Post line.
struct CardTableBack: View, Equatable {
    let paperGrain: UIImage?
    let paper: String?
    let note: String
    /// The sender's first name.
    let fromName: String
    let year: Int
    /// The card's number: each word's small shift and turn come from it, so the writing looks the same every time.
    let number: Int?
    /// Set by the writing step, which writes the note in its own text view on top.
    var drawsNote = true
    var grainOpacity = 1.0

    var body: some View {
        Canvas(rendersAsynchronously: false) { context, size in
            let u = size.width / 100
            let rect = CGRect(origin: .zero, size: size)
            var face = context
            face.clip(to: Path(roundedRect: rect, cornerRadius: 0.7 * u, style: .continuous))
            face.fill(Path(rect), with: .color(MailPaper.cardPaper(paper)))
            drawRules(in: face, u: u)
            if drawsNote {
                CardTableNoteLayout(text: note, seed: number, u: u).draw(in: face)
            }
            drawFrom(in: face, u: u)
            drawFoot(in: face, u: u, width: size.width)
            face.fillPaperGrain(paperGrain, in: rect, u: u, opacity: grainOpacity)
            face.strokeCardEdges(in: rect, u: u)
        }
        .accessibilityHidden(true)
    }

    private func drawRules(in context: GraphicsContext, u: CGFloat) {
        var rules = Path()
        for line in 1...CardTableNoteLayout.ruleCount {
            let y = (CardTableNoteLayout.top + CardTableNoteLayout.pitch * CGFloat(line)) * u - 0.5
            rules.move(to: CGPoint(x: 8 * u, y: y))
            rules.addLine(to: CGPoint(x: 92 * u, y: y))
        }
        context.stroke(rules, with: .color(MailPaper.tableRule), lineWidth: 1)
    }

    /// "FROM" and the name beside it in the pen, on one baseline, in a box at 97u.
    private func drawFrom(in context: GraphicsContext, u: CGFloat) {
        let labelFont = CardTableSerif.font(size: 2.3 * u)
        let penFont = CardTableType.pen(6.4 * u)
        let baseline = 97 * u + max(
            CardTableType.baseline(labelFont, lineHeight: 2.3 * u),
            CardTableType.baseline(penFont, lineHeight: 6.4 * u)
        )
        let tracking = 2.3 * u * 0.24
        let label = Text("FROM").font(Font(labelFont)).tracking(tracking).foregroundColor(MailPaper.tableFromLabel)
        context.drawText(label, x: 8 * u, baseline: baseline)
        let labelWidth = context.resolve(label).measure(in: CGSize(width: 100 * u, height: 20 * u)).width
        var pen = context
        pen.blendMode = .multiply
        pen.drawText(
            Text(fromName).font(Font(penFont)).foregroundColor(MailPaper.tablePenInk),
            x: 8 * u + labelWidth + 2 * u,
            baseline: baseline
        )
    }

    private func drawFoot(in context: GraphicsContext, u: CGFloat, width: CGFloat) {
        let font = CardTableSerif.font(size: 1.9 * u)
        context.drawText(
            Text("PANTOPUS POST · CHRISTMAS \(String(year))").font(Font(font)).tracking(1.9 * u * 0.3).foregroundColor(MailPaper.tableFoot),
            centeredOn: width / 2,
            baseline: 114.9 * u + CardTableType.baseline(font, lineHeight: 1.9 * u)
        )
    }

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.paperGrain === rhs.paperGrain && lhs.paper == rhs.paper && lhs.note == rhs.note && lhs.fromName == rhs.fromName
            && lhs.year == rhs.year && lhs.number == rhs.number && lhs.drawsNote == rhs.drawsNote
            && lhs.grainOpacity == rhs.grainOpacity
    }
}
