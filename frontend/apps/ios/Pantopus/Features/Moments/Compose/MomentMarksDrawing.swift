//
//  MomentMarksDrawing.swift
//  Pantopus
//
//  One routine draws a Moment's marks, used twice so what the author sees is
//  what goes up: the live canvas over the picture (the editor, the Post
//  screen) and the photo flattened for the upload. The flatten works on a
//  copy at most 2048 px on its longest side, at scale 1 and opaque, off the
//  main thread, then hands it to the usual photo export; on a video it draws
//  them once on a clear picture the size of the exported frame. A label is laid out
//  where the picture is 1000 units wide, whatever size it's drawn at, so its
//  words break into the same lines on the screen and in the upload; its
//  letters are a share of the picture's width, never the phone's text size.
//

import SwiftUI
import UIKit

enum MomentMarksDrawing {
    /// The longest side of what's drawn on and uploaded (the photo export's own limit).
    static let maxPixels: CGFloat = 2048

    /// Draws `marks` over a picture filling `size` in `context`, whose origin is the picture's top-left corner. Labels
    /// are placed by the picture's own shape, `aspect` (width over height), when the size drawn at is rounded from it.
    static func draw(_ marks: MomentMarks, in context: CGContext, size: CGSize, aspect: CGFloat? = nil) {
        guard size.width > 0, size.height > 0, !marks.isEmpty else { return }
        context.saveGState()
        defer { context.restoreGState() }
        context.setLineCap(.round)
        context.setLineJoin(.round)
        for stroke in marks.strokes where !stroke.points.isEmpty {
            // The signature pen's smoothing: curves through the points, a dot for a tap.
            let points = stroke.points.map { CGPoint(x: $0.x * size.width, y: $0.y * size.height) }
            context.addPath(CardTableSignature.path([points]).cgPath)
            context.setStrokeColor(MomentsPalette.ink(stroke.ink.rawValue).cgColor)
            context.setLineWidth(max(stroke.width * size.width, 1))
            context.strokePath()
        }
        // Words over lines.
        drawLabels(marks.labels, in: context, size: size, aspect: aspect ?? size.width / size.height)
    }

    /// `image` redrawn upright at most 2048 px on its longest side (scale 1, opaque), with `marks` drawn in.
    static func flatten(_ image: UIImage, _ marks: MomentMarks) -> UIImage {
        let pixels = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        let scale = min(1, maxPixels / max(pixels.width, pixels.height, 1))
        let size = CGSize(width: max(1, (pixels.width * scale).rounded()), height: max(1, (pixels.height * scale).rounded()))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { renderer in
            image.draw(in: CGRect(origin: .zero, size: size))
            draw(marks, in: renderer.cgContext, size: size, aspect: image.size.width / max(image.size.height, 1))
        }
    }

    /// The marks alone on a clear picture of the size a video's export asks for: laid over every frame, labels placed by
    /// the video's own shape (`aspect`, as shown). Nil for none.
    static func overlay(_ marks: MomentMarks, aspect: CGFloat) -> MomentsVideoEncoder.Overlay? {
        guard !marks.isEmpty else { return nil }
        return { size in
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            format.opaque = false
            return UIGraphicsImageRenderer(size: size, format: format)
                .image { draw(marks, in: $0.cgContext, size: size, aspect: aspect) }
                .cgImage
        }
    }

    /// The copy the editor works on: the photo itself when it is 2048 px or less already.
    static func base(_ image: UIImage) async -> UIImage {
        guard max(image.size.width, image.size.height) * image.scale > maxPixels else { return image }
        return await Task.detached(priority: .userInitiated) { flatten(image, MomentMarks()) }.value
    }

    /// The photo with its marks, made ready to post in `folder` (the usual JPEG), off the main thread.
    static func export(_ base: UIImage, _ marks: MomentMarks, into folder: URL) async throws -> MomentPreparedMedia {
        try await Task.detached(priority: .userInitiated) {
            try MomentsMediaExport.photo(flatten(base, marks), into: folder)
        }.value
    }
}

// MARK: - Labels (board T2)

extension MomentMarksDrawing {
    /// The width the picture has while a label is laid out.
    static let unit: CGFloat = 1000
    /// A label's lines break at 13.1 times its letter size (288 of 390 points at 22, board T2), so a pinch scales the
    /// whole label without rewrapping it, or at the width every phone shows when that is narrower (a landscape picture
    /// shows a third of its width); the letters' lines are 1.27 times their size apart (28 at 22).
    static let wrap: CGFloat = 13.1
    static let lineHeight: CGFloat = 1.27

    /// A label laid out, in units where the picture is 1000 wide: its words and the rectangle they are drawn in (as
    /// wide as its lines may be, the words centered), and its plate (the label or the sign; the words' box when plain).
    struct LaidLabel {
        let words: NSAttributedString
        let edge: NSAttributedString?
        let wordsRect: CGRect
        let box: CGRect
        let plate: UIColor?
        let radius: CGFloat
    }

    /// `label` on a picture `aspect` wide (width over height).
    static func lay(_ label: MomentMarks.Label, aspect: CGFloat) -> LaidLabel {
        let em = label.size * unit
        let pad = padding(label.style, em: em)
        let widest = max(em, min(em * wrap, MomentMarks.safeBox(aspect: aspect).width * unit - 2 * pad.width))
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        paragraph.lineBreakMode = .byWordWrapping
        paragraph.minimumLineHeight = em * lineHeight
        paragraph.maximumLineHeight = em * lineHeight
        let font = UIFont.systemFont(ofSize: em, weight: .bold)
        let look = looks(label)
        let words = NSAttributedString(
            string: label.text,
            attributes: [.font: font, .foregroundColor: look.ink, .paragraphStyle: paragraph]
        )
        let fits = words.boundingRect(
            with: CGSize(width: widest, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            context: nil
        )
        let size = CGSize(width: ceil(max(fits.width, em * 0.5)), height: ceil(max(fits.height, em * lineHeight)))
        let center = CGPoint(x: label.center.x * unit, y: label.center.y * unit / max(aspect, 0.01))
        let box = CGRect(
            x: center.x - size.width / 2 - pad.width,
            y: center.y - size.height / 2 - pad.height,
            width: size.width + 2 * pad.width,
            height: size.height + 2 * pad.height
        )
        let edge = look.edge.map { color in
            NSAttributedString(string: label.text, attributes: [
                .font: font, .paragraphStyle: paragraph, .strokeColor: color, .strokeWidth: 16
            ])
        }
        return LaidLabel(
            words: words,
            edge: edge,
            wordsRect: CGRect(x: center.x - widest / 2, y: center.y - size.height / 2, width: widest, height: size.height),
            box: box,
            plate: look.plate,
            radius: label.style == .plain ? 0 : em * 0.45
        )
    }

    /// The widest single word of `label`, in the same units as `lay`: its letters shrink until this fits on a line.
    static func longestWord(_ label: MomentMarks.Label) -> CGFloat {
        let font = UIFont.systemFont(ofSize: label.size * unit, weight: .bold)
        let widest = label.text.split(whereSeparator: \.isWhitespace)
            .map { NSAttributedString(string: String($0), attributes: [.font: font]).size().width }
            .max() ?? 0
        return ceil(widest)
    }

    /// The room around a label's words: a little for plain letters' edge; for a label or a sign 0.64 and 0.41 of the
    /// letter size across and down (14 and 9 at 22, board T2).
    static func padding(_ style: MomentMarks.Style, em: CGFloat) -> CGSize {
        style == .plain ? CGSize(width: em * 0.12, height: em * 0.06) : CGSize(width: em * 0.64, height: em * 0.41)
    }

    /// A label's colors: its letters, its plate (none when plain) and plain letters' edge.
    struct Look {
        let ink: UIColor
        let plate: UIColor?
        let edge: UIColor?
    }

    /// Plain: letters in the ink with a thin dark edge (light for black ink). Label: letters in the ink on black at
    /// 66% (white at 88% for black ink). Sign: a plate in the ink, dark letters on light inks, white on black and red.
    static func looks(_ label: MomentMarks.Label) -> Look {
        let ink = MomentsPalette.ink(label.ink.rawValue)
        let dark = MomentsPalette.ink(MomentMarks.Ink.black.rawValue)
        let black = label.ink == .black
        switch label.style {
        case .plain:
            return Look(ink: ink, plate: nil, edge: black ? UIColor.white.withAlphaComponent(0.7) : UIColor.black.withAlphaComponent(0.45))
        case .label:
            return Look(ink: ink, plate: black ? UIColor.white.withAlphaComponent(0.88) : UIColor.black.withAlphaComponent(0.66), edge: nil)
        case .sign:
            let darkLetters = [.white, .yellow, .sky, .green].contains(label.ink)
            return Look(ink: darkLetters ? dark : .white, plate: ink, edge: nil)
        }
    }

    /// Draws the labels with words over a picture `size` big in `context` (origin at its top-left corner).
    static func drawLabels(_ labels: [MomentMarks.Label], in context: CGContext, size: CGSize, aspect: CGFloat) {
        let shown = labels.filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard !shown.isEmpty, size.width > 0, size.height > 0 else { return }
        context.saveGState()
        defer { context.restoreGState() }
        context.scaleBy(x: size.width / unit, y: size.width / unit)
        UIGraphicsPushContext(context)
        defer { UIGraphicsPopContext() }
        for label in shown {
            let laid = lay(label, aspect: aspect)
            if let plate = laid.plate {
                context.setFillColor(plate.cgColor)
                context.addPath(UIBezierPath(roundedRect: laid.box, cornerRadius: laid.radius).cgPath)
                context.fillPath()
            }
            laid.edge?.draw(with: laid.wordsRect, options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
            laid.words.draw(with: laid.wordsRect, options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
        }
    }
}

/// The marks over a picture that fills this view (an overlay on the picture as it's framed).
struct MomentMarksCanvas: View {
    let marks: MomentMarks
    /// The shape the labels are placed by, when the frame's own is rounded from it (a placed picture's canvas).
    var aspect: CGFloat?

    var body: some View {
        Canvas { context, size in
            context.withCGContext { MomentMarksDrawing.draw(marks, in: $0, size: size, aspect: aspect) }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// A photo filling its frame as the viewer shows it (centered, cropped), with its marks on it; a placed one (Resize) as
/// its canvas.
struct MomentsMarkedPhoto: View {
    let image: UIImage
    let marks: MomentMarks
    var placement: MomentPlacement?
    var backdrop: MomentPlacement.Backdrop?

    var body: some View {
        if let placement {
            MomentsPlacedPhoto(image: image, placement: placement, backdrop: backdrop, marks: marks)
        } else {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .overlay {
                    if !marks.isEmpty { MomentMarksCanvas(marks: marks) }
                }
        }
    }
}

/// The marks over a video filling this view as the viewer shows it (centered, cropped); `picture` is its shown size.
struct MomentMarksOverVideo: View {
    let marks: MomentMarks
    let picture: CGSize?

    var body: some View {
        GeometryReader { geo in
            if let picture, !marks.isEmpty {
                let fill = MomentMarks.fill(picture, in: geo.size)
                MomentMarksCanvas(marks: marks)
                    .frame(width: fill.width, height: fill.height)
                    .position(x: fill.midX, y: fill.midY)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
