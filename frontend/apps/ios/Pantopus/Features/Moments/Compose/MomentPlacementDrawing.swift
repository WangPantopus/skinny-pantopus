//
//  MomentPlacementDrawing.swift
//  Pantopus
//
//  A placed photo drawn on its 9:16 canvas: a top-to-bottom blend of two
//  colours from the picture where it doesn't reach, the picture at its
//  placement, then the marks. The upload is the canvas at 1152 x 2048, drawn
//  off the main thread from the best copy kept and handed to the usual photo
//  export. The editor and the Post screen lay the same picture out with the
//  same numbers (`MomentPlacement.pictureSize`, `pictureCenter`), so what the
//  author sees is what goes up.
//

import SwiftUI
import UIKit

extension MomentPlacement {
    /// The background where the picture doesn't cover the canvas: from the average colour of the upright picture's top
    /// third, before any turn, to its bottom third's.
    struct Backdrop: Equatable {
        let top: UIColor
        let bottom: UIColor

        /// Until the picture's own colours are read.
        static let dark = Backdrop(top: UIColor(white: 0.067, alpha: 1), bottom: UIColor(white: 0.067, alpha: 1))
    }
}

enum MomentPlacementDrawing {
    /// The picture's two colours, read from a copy 24 px square (top and bottom eight rows).
    static func backdrop(of image: UIImage) -> MomentPlacement.Backdrop {
        let side = 24
        let space = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil,
            width: side,
            height: side,
            bitsPerComponent: 8,
            bytesPerRow: side * 4,
            space: space,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return .dark }
        let square = CGRect(x: 0, y: 0, width: side, height: side)
        context.setFillColor(UIColor.black.cgColor)
        context.fill(square)
        context.interpolationQuality = .medium
        // Upright, top row first.
        context.translateBy(x: 0, y: CGFloat(side))
        context.scaleBy(x: 1, y: -1)
        UIGraphicsPushContext(context)
        image.draw(in: square)
        UIGraphicsPopContext()
        guard let data = context.data else { return .dark }
        let bytes = data.bindMemory(to: UInt8.self, capacity: side * side * 4)
        func average(_ rows: Range<Int>) -> UIColor {
            var sums: [CGFloat] = [0, 0, 0]
            for row in rows {
                for column in 0..<side {
                    let index = (row * side + column) * 4
                    for channel in 0..<3 {
                        sums[channel] += CGFloat(bytes[index + channel])
                    }
                }
            }
            let count = CGFloat(rows.count * side) * 255
            // Read from an sRGB bitmap, so an sRGB colour.
            return UIColor(cgColor: CGColor(srgbRed: sums[0] / count, green: sums[1] / count, blue: sums[2] / count, alpha: 1))
        }
        return MomentPlacement.Backdrop(top: average(0..<side / 3), bottom: average(side - side / 3..<side))
    }

    /// Draws the canvas, `size` big, in `context` (origin at its top-left corner): the background, then `image` at
    /// `placement`. Nothing is drawn past the canvas's edges.
    static func draw(
        _ image: UIImage,
        at placement: MomentPlacement,
        backdrop: MomentPlacement.Backdrop,
        in context: CGContext,
        size: CGSize
    ) {
        context.saveGState()
        defer { context.restoreGState() }
        context.clip(to: CGRect(origin: .zero, size: size))
        let space = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        if let gradient = CGGradient(
            colorsSpace: space,
            colors: [backdrop.top.cgColor, backdrop.bottom.cgColor] as CFArray,
            locations: [0, 1]
        ) {
            context.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
        }
        let picture = placement.pictureSize(aspect: image.size.width / max(image.size.height, 1), on: size)
        let middle = placement.pictureCenter(on: size)
        context.saveGState()
        context.translateBy(x: middle.x, y: middle.y)
        context.rotate(by: placement.turn * .pi / 180)
        context.interpolationQuality = .high
        UIGraphicsPushContext(context)
        image.draw(in: CGRect(x: -picture.width / 2, y: -picture.height / 2, width: picture.width, height: picture.height))
        UIGraphicsPopContext()
        context.restoreGState()
    }

    /// The canvas as it goes up: 1152 x 2048, scale 1, opaque, with `marks` drawn over it in its coordinates.
    static func flatten(
        _ image: UIImage,
        at placement: MomentPlacement,
        backdrop: MomentPlacement.Backdrop,
        marks: MomentMarks
    ) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: MomentPlacement.pixels, format: format).image { renderer in
            draw(image, at: placement, backdrop: backdrop, in: renderer.cgContext, size: MomentPlacement.pixels)
            MomentMarksDrawing.draw(marks, in: renderer.cgContext, size: MomentPlacement.pixels, aspect: MomentPlacement.canvas)
        }
    }

    /// The placed photo with its marks, made ready to post in `folder` (the usual JPEG), off the main thread. The
    /// colours are read here when the editor hadn't read them yet.
    static func export(
        _ base: UIImage,
        at placement: MomentPlacement,
        backdrop: MomentPlacement.Backdrop?,
        _ marks: MomentMarks,
        into folder: URL
    ) async throws -> MomentPreparedMedia {
        try await Task.detached(priority: .userInitiated) {
            let colors = backdrop ?? Self.backdrop(of: base)
            return try MomentsMediaExport.photo(flatten(base, at: placement, backdrop: colors, marks: marks), into: folder)
        }.value
    }
}

/// The canvas with the picture at its placement, filling this view's frame (which has the canvas's shape).
struct MomentPlacedCanvas: View {
    let image: UIImage
    let placement: MomentPlacement
    let backdrop: MomentPlacement.Backdrop?

    var body: some View {
        GeometryReader { geo in
            let colors = backdrop ?? .dark
            let picture = placement.pictureSize(aspect: image.size.width / max(image.size.height, 1), on: geo.size)
            ZStack(alignment: .topLeading) {
                LinearGradient(colors: [Color(uiColor: colors.top), Color(uiColor: colors.bottom)], startPoint: .top, endPoint: .bottom)
                Image(uiImage: image)
                    .resizable()
                    .interpolation(.high)
                    .frame(width: picture.width, height: picture.height)
                    .rotationEffect(.degrees(placement.turn))
                    .position(placement.pictureCenter(on: geo.size))
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }
}

/// A placed photo as the viewer shows it: the canvas filling this view (centered, cropped), with the marks over it.
struct MomentsPlacedPhoto: View {
    let image: UIImage
    let placement: MomentPlacement
    let backdrop: MomentPlacement.Backdrop?
    let marks: MomentMarks

    var body: some View {
        GeometryReader { geo in
            let canvas = MomentMarks.fill(MomentPlacement.pixels, in: geo.size)
            MomentPlacedCanvas(image: image, placement: placement, backdrop: backdrop)
                .overlay {
                    if !marks.isEmpty { MomentMarksCanvas(marks: marks, aspect: MomentPlacement.canvas) }
                }
                .frame(width: canvas.width, height: canvas.height)
                .offset(x: canvas.minX, y: canvas.minY)
        }
        .clipped()
        // One element, so the label the Post screen gives it is read.
        .accessibilityElement(children: .ignore)
    }
}
