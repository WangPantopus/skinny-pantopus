//
//  CardPhotoFront.swift
//  Pantopus
//
//  A photo card's front (cards-next 4.2): the sender's own photo in one of three frames drawn in code, the card's
//  shape and size as every card front (100 by 120). Heirloom Cream: the cotton paper, the photo with a crisp border
//  inset 1.67%, the line by hand in ink, the spaced serif year and the red postmark. Midnight Velvet: dark stock, a thin
//  gold hairline, cream serif line and year, a gold-ink postmark. Winter Arch: an alabaster mat, the photo under a
//  gently rounded top arch, a quiet serif line under it. The table, the send flow and the studio all draw this face.
//

import SwiftUI
import UIKit

/// One of the three frames.
enum CardPhotoFrame: String, CaseIterable, Identifiable {
    case heirloom, midnight, arch

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .heirloom: "Heirloom Cream"
        case .midnight: "Midnight Velvet"
        case .arch: "Winter Arch"
        }
    }

    init(_ name: String?) {
        self = CardPhotoFrame(rawValue: name ?? "") ?? .heirloom
    }
}

/// What a photo card's front draws: its frame and line, where its photo comes from, and whether it is covered for this
/// reader (a sender who isn't their connection: veiled until a tap).
struct CardPhotoFrontSpec: Equatable {
    /// The photo card's design id as the server names it (`photo_card.design`), for a sealed one that carries no
    /// `front` yet: it is never shared.
    static let designId = "christmas-2026-photo"

    let frame: CardPhotoFrame
    let caption: String
    /// The photo's bytes; nil while the studio holds it on the phone.
    let source: CardMediaSource?
    /// Width over height of the photo (its shape).
    let aspect: CGFloat
    var covered = false
}

extension CardPhotoFrontSpec {
    /// A read's `front` with its photo (cards-next 4.2); nil for every other card and while sealed (both are null then).
    init?(front: CardFront?, photo: CardPhoto?, covered: Bool = false, source: (CardPhoto) -> CardMediaSource) {
        guard let front, let photo else { return nil }
        self.init(
            frame: CardPhotoFrame(front.frame),
            caption: front.caption ?? "",
            source: source(photo),
            aspect: photo.aspect,
            covered: covered
        )
    }
}

enum CardPhotoFrontLayout {
    /// The photo's box on a 100-wide card for a photo this shape, in card units.
    static func photoBox(frame: CardPhotoFrame, aspect: CGFloat) -> CGRect {
        let area: CGRect = switch frame {
        case .heirloom: CGRect(x: 1.67, y: 1.67, width: 96.66, height: 101.5)
        case .midnight: CGRect(x: 7, y: 7, width: 86, height: 90)
        case .arch: CGRect(x: 9, y: 8, width: 82, height: 90)
        }
        let shape = max(0.2, aspect)
        var width = area.width
        var height = width / shape
        if height > area.height {
            height = area.height
            width = height * shape
        }
        // Centred across; Heirloom keeps its top edge, the others sit in the middle of their area.
        let y = frame == .heirloom ? area.minY : area.minY + (area.height - height) / 2
        return CGRect(x: area.midX - width / 2, y: y, width: width, height: height)
    }

    /// The arch's outline: a rectangle whose top is a gentle round arch.
    static func archPath(_ box: CGRect) -> Path {
        var path = Path()
        let rise = min(box.width * 0.5, box.height * 0.4)
        path.move(to: CGPoint(x: box.minX, y: box.maxY))
        path.addLine(to: CGPoint(x: box.minX, y: box.minY + rise))
        path.addQuadCurve(
            to: CGPoint(x: box.maxX, y: box.minY + rise),
            control: CGPoint(x: box.midX, y: box.minY - rise * 0.6)
        )
        path.addLine(to: CGPoint(x: box.maxX, y: box.maxY))
        path.closeSubpath()
        return path
    }
}

/// The face itself. `photo` nil draws the frame with its photo place empty (still loading, or veiled with `veil`).
struct CardPhotoFrontFace: View, Equatable {
    let frame: CardPhotoFrame
    let photo: UIImage?
    /// Width over height of the photo place (the photo's shape).
    let aspect: CGFloat
    let caption: String
    let year: Int
    let mailedOn: String?
    var paperGrain: UIImage?
    var grainOpacity = 0.5
    /// "Tap to view Maya’s photo": drawn over the empty photo place while the photo is covered.
    var veil: String?
    /// The studio lays its own crop over the photo place.
    var leavesPhotoPlace = false

    var body: some View {
        Canvas(rendersAsynchronously: false) { context, size in
            let u = size.width / 100
            let rect = CGRect(origin: .zero, size: size)
            var face = context
            face.clip(to: Path(roundedRect: rect, cornerRadius: 0.7 * u, style: .continuous))
            face.fill(Path(rect), with: .color(stock))
            let box = CardPhotoFrontLayout.photoBox(frame: frame, aspect: aspect)
            let photoRect = CGRect(x: box.minX * u, y: box.minY * u, width: box.width * u, height: box.height * u)
            if frame == .midnight {
                face.stroke(Path(rect.insetBy(dx: 3.2 * u, dy: 3.2 * u)), with: .color(MailPaper.photoGold), lineWidth: 0.35 * u)
            }
            drawPhoto(in: face, rect: photoRect, u: u)
            drawWords(in: face, photoRect: photoRect, u: u)
            face.fillPaperGrain(paperGrain, in: rect, u: u, opacity: frame == .midnight ? grainOpacity * 0.4 : grainOpacity)
            face.strokeCardEdges(in: rect, u: u)
        }
        .accessibilityHidden(true)
    }

    private var stock: Color {
        switch frame {
        case .heirloom: MailPaper.photoHeirloom
        case .midnight: MailPaper.photoMidnight
        case .arch: MailPaper.photoArch
        }
    }

    private func outline(_ rect: CGRect) -> Path {
        frame == .arch ? CardPhotoFrontLayout.archPath(rect) : Path(rect)
    }

    private func drawPhoto(in context: GraphicsContext, rect: CGRect, u: CGFloat) {
        let shape = outline(rect)
        guard !leavesPhotoPlace else { return }
        if let photo, photo.size.width > 0, photo.size.height > 0 {
            var place = context
            place.clip(to: shape)
            let scale = max(rect.width / photo.size.width, rect.height / photo.size.height)
            let drawn = CGSize(width: photo.size.width * scale, height: photo.size.height * scale)
            place.draw(
                Image(uiImage: photo),
                in: CGRect(x: rect.midX - drawn.width / 2, y: rect.midY - drawn.height / 2, width: drawn.width, height: drawn.height)
            )
        } else {
            context.fill(shape, with: .color(frame == .midnight ? MailPaper.photoCream.opacity(0.12) : MailPaper.cardRowEdge))
            if let veil {
                let font = CardTableSerif.font(size: 3.4 * u)
                context.drawText(
                    Text(veil).font(Font(font)).foregroundColor(frame == .midnight ? MailPaper.photoCream : MailPaper.cardTextSoft),
                    centeredOn: rect.midX,
                    baseline: rect.midY + CardTableType.baseline(font, lineHeight: 3.4 * u) / 2
                )
            }
        }
        // A crisp border round the photo (Heirloom), a gold hairline (Midnight), a soft line on the arch.
        let edge: Color = switch frame {
        case .heirloom: MailPaper.tablePhotoEdge
        case .midnight: MailPaper.photoGold
        case .arch: MailPaper.cardRowEdge
        }
        context.stroke(shape, with: .color(edge), lineWidth: (frame == .midnight ? 0.3 : 0.25) * u)
    }

    private func drawWords(in context: GraphicsContext, photoRect: CGRect, u: CGFloat) {
        switch frame {
        case .heirloom:
            if !caption.isEmpty {
                // By hand, smaller for a long line so it stops before the postmark.
                let start = CardTableType.captionSize(caption) * u
                let size = fitted(start, room: 72 * u, in: context) { CardTableType.caption(caption, size: $0) }
                let hand = CardTableType.caption(caption, size: size)
                context.drawText(
                    Text(caption).font(Font(hand)).foregroundColor(MailPaper.cardCaptionInk),
                    x: 4.2 * u,
                    baseline: 107.4 * u + CardTableType.baseline(hand, lineHeight: size)
                )
            }
            drawYear(in: context, x: 4.2 * u, baseline: 114.2 * u, ink: MailPaper.cardYearInk, u: u)
            drawPostmark(in: context, u: u, ink: MailPaper.cardPostmark)
        case .midnight:
            if !caption.isEmpty {
                let size = fitted(4 * u, room: 69 * u, in: context) { CardTableSerif.font(size: $0) }
                let font = CardTableSerif.font(size: size)
                context.drawText(
                    Text(caption).font(Font(font)).foregroundColor(MailPaper.photoCream),
                    x: 7 * u,
                    baseline: 106 * u + CardTableType.baseline(font, lineHeight: 4 * u)
                )
            }
            drawYear(in: context, x: 7 * u, baseline: 112.6 * u, ink: MailPaper.photoCream.opacity(0.8), u: u)
            drawPostmark(in: context, u: u, ink: MailPaper.photoGold)
        case .arch:
            let font = CardTableSerif.font(size: fitted(3.8 * u, room: 84 * u, in: context) { CardTableSerif.font(size: $0) })
            let below = photoRect.maxY + 6 * u
            if !caption.isEmpty {
                context.drawText(
                    Text(caption).font(Font(font)).foregroundColor(MailPaper.cardTextSoft),
                    centeredOn: 50 * u,
                    baseline: below + CardTableType.baseline(font, lineHeight: 3.8 * u)
                )
            }
            let yearFont = CardTableSerif.font(size: 2.2 * u)
            context.drawText(
                Text("CHRISTMAS, \(String(year))")
                    .font(Font(yearFont))
                    .tracking(2.2 * u * 0.42)
                    .foregroundColor(MailPaper.cardYearInk.opacity(0.7)),
                centeredOn: 50 * u,
                baseline: 114.6 * u + CardTableType.baseline(yearFont, lineHeight: 2.2 * u)
            )
        }
    }

    /// The caption's size, made smaller (to half at most) when the line is wider than `room`.
    private func fitted(_ size: CGFloat, room: CGFloat, in context: GraphicsContext, font: (CGFloat) -> UIFont) -> CGFloat {
        let wide = context.resolve(Text(caption).font(Font(font(size)))).measure(in: CGSize(width: 100_000, height: 100_000)).width
        guard wide > room, wide > 0 else { return size }
        return max(size * 0.5, size * room / wide)
    }

    private func drawYear(in context: GraphicsContext, x: CGFloat, baseline: CGFloat, ink: Color, u: CGFloat) {
        let yearFont = CardTableSerif.font(size: 2.2 * u)
        context.drawText(
            Text("CHRISTMAS, \(String(year))").font(Font(yearFont)).tracking(2.2 * u * 0.42).foregroundColor(ink),
            x: x,
            baseline: baseline + CardTableType.baseline(yearFont, lineHeight: 2.2 * u)
        )
    }

    private func drawPostmark(in context: GraphicsContext, u: CGFloat, ink: Color) {
        var mark = context
        let box = CGRect(x: 77.5 * u, y: 106.2 * u, width: 20 * u, height: 12 * u)
        mark.translateBy(x: box.midX, y: box.midY)
        mark.rotate(by: .degrees(-3))
        mark.translateBy(x: -box.width / 2, y: -box.height / 2)
        CardTablePostmark.draw(in: mark, width: box.width, day: mailedOn, year: year, ink: ink)
    }

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.frame == rhs.frame && lhs.photo === rhs.photo && lhs.aspect == rhs.aspect && lhs.caption == rhs.caption
            && lhs.year == rhs.year && lhs.mailedOn == rhs.mailedOn && lhs.paperGrain === rhs.paperGrain
            && lhs.grainOpacity == rhs.grainOpacity && lhs.veil == rhs.veil && lhs.leavesPhotoPlace == rhs.leavesPhotoPlace
    }
}

/// The face off the table (the send flow, Look it over): loads the photo from its route or this phone's upload.
struct CardPhotoFrontPage: View {
    let spec: CardPhotoFrontSpec
    let year: Int
    let mailedOn: String?
    /// The photo on this phone (the sender's, while it uploads), drawn until the stored copy is read.
    var preview: UIImage?
    @State private var photo: UIImage?

    var body: some View {
        CardPhotoFrontFace(
            frame: spec.frame,
            photo: photo ?? preview,
            aspect: spec.aspect,
            caption: spec.caption,
            year: year,
            mailedOn: mailedOn,
            paperGrain: CardTableSmallArt.shared.paperGrain,
            grainOpacity: 0.25
        )
        .equatable()
        .aspectRatio(CardTableShape.aspect, contentMode: .fit)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spec.caption.isEmpty ? "A photo card" : "A photo card: \(spec.caption)")
        .task(id: spec.source?.fileId) {
            await CardTableSmallArt.shared.load()
            guard !spec.covered else { return }
            photo = await CardPhotoFrontImage.load(spec.source)
        }
    }
}

/// A photo card's photo as a picture, from memory or its route; nil when it can't be read.
@MainActor
enum CardPhotoFrontImage {
    static func load(_ source: CardMediaSource?) async -> UIImage? {
        guard let source, let data = try? await HolidayCardMediaStore.shared.data(for: source) else { return nil }
        return UIImage(data: data)
    }
}

extension CardTableModel {
    /// A photo card's front is still veiled for this reader.
    var photoFrontVeiled: Bool {
        content.photoFront?.covered == true && !photoFrontUncovered
    }

    /// "Tap to view {first name}’s photo": the photo loads and the front shows it.
    func uncoverPhotoFront() {
        guard let front = content.photoFront, !photoFrontUncovered else { return }
        photoFrontUncovered = true
        Task { @MainActor [weak self] in
            self?.photoFrontImage = await CardPhotoFrontImage.load(front.source)
        }
    }
}
