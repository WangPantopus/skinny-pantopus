//
//  MomentPlacement.swift
//  Pantopus
//
//  Resize on a Moment's photo (founder, 2026-11-21): where the picture sits
//  on a 9:16 canvas once the author has dragged, pinched or twisted it. Three
//  values and nothing else: its width as a share of the canvas's width, its
//  middle in canvas coordinates, and its turn. At cover the picture just
//  covers the canvas, which is the picture as taken, so a picture is placed
//  only while its placement differs from cover; a placed picture goes up as
//  the canvas, with a background where the picture doesn't reach and the
//  marks in the canvas's coordinates. Android keeps the same model.
//

import CoreGraphics
import Foundation

struct MomentPlacement: Equatable {
    /// The picture's width as a share of the canvas's width, before turning.
    var width: CGFloat
    /// The picture's middle, in canvas coordinates (0 to 1 across and down).
    var center: CGPoint
    /// Degrees clockwise, kept in (-180, 180].
    var turn: CGFloat

    /// The canvas's shape, width over height.
    static let canvas: CGFloat = 9.0 / 16.0
    /// The canvas as it goes up, in pixels.
    static let pixels = CGSize(width: 1152, height: 2048)
    /// The picture's width: at least a quarter of the canvas's width, whatever its shape, so a wide picture can show
    /// whole inside the part every phone shows; at most four times cover's.
    static let smallest: CGFloat = 0.25
    static let largest: CGFloat = 4
    /// Sticking: the turn to a quarter turn within 3 degrees, the middle's x and y to the canvas's middle within 0.015.
    static let stickDegrees: CGFloat = 3
    static let stickCenter: CGFloat = 0.015

    /// Just covering the canvas: as tall as it with the sides trimmed for a picture at least as wide as 9:16, as wide as
    /// it with the top and bottom trimmed for a taller one.
    static func cover(aspect: CGFloat) -> MomentPlacement {
        MomentPlacement(width: coverWidth(aspect: aspect), center: CGPoint(x: 0.5, y: 0.5), turn: 0)
    }

    static func coverWidth(aspect: CGFloat) -> CGFloat {
        max(1, aspect / canvas)
    }

    /// Cover for a picture `aspect` wide: as taken. A pinch back is never exactly cover; a copy of the picture redrawn at
    /// 2048 px can differ from it in the fourth decimal of its shape.
    func isCover(aspect: CGFloat) -> Bool {
        let cover = Self.coverWidth(aspect: aspect)
        return abs(width - cover) <= cover * 0.001 && center == CGPoint(x: 0.5, y: 0.5) && turn == 0
    }

    /// Held to the limits: the width between a quarter of the canvas's and four times cover's, the middle on the canvas,
    /// the turn in (-180, 180].
    func held(aspect: CGFloat) -> MomentPlacement {
        let cover = Self.coverWidth(aspect: aspect)
        return MomentPlacement(
            width: min(max(width, Self.smallest), cover * Self.largest),
            center: CGPoint(x: min(max(center.x, 0), 1), y: min(max(center.y, 0), 1)),
            turn: Self.normalized(turn)
        )
    }

    /// With sticking applied: a quarter turn, the canvas's middle.
    var stuck: MomentPlacement {
        var stuck = self
        if let quarter = Self.quarter(near: turn) { stuck.turn = quarter }
        if abs(center.x - 0.5) <= Self.stickCenter { stuck.center.x = 0.5 }
        if abs(center.y - 0.5) <= Self.stickCenter { stuck.center.y = 0.5 }
        return stuck
    }

    /// What has caught: the turn on a quarter turn, the middle's x, its y.
    var caught: [Bool] {
        [Self.quarter(near: turn) != nil, abs(center.x - 0.5) <= Self.stickCenter, abs(center.y - 0.5) <= Self.stickCenter]
    }

    static func normalized(_ degrees: CGFloat) -> CGFloat {
        var turn = degrees.truncatingRemainder(dividingBy: 360)
        if turn <= -180 { turn += 360 }
        if turn > 180 { turn -= 360 }
        return turn
    }

    private static func quarter(near turn: CGFloat) -> CGFloat? {
        let quarter = (turn / 90).rounded() * 90
        guard abs(turn - quarter) <= stickDegrees else { return nil }
        return normalized(quarter)
    }

    // MARK: - Where the picture lands

    /// The picture's size on a canvas `size` big (before turning), for a picture `aspect` wide.
    func pictureSize(aspect: CGFloat, on size: CGSize) -> CGSize {
        let pictureWidth = width * size.width
        return CGSize(width: pictureWidth, height: pictureWidth / max(aspect, 0.01))
    }

    /// The picture's middle on a canvas `size` big.
    func pictureCenter(on size: CGSize) -> CGPoint {
        CGPoint(x: center.x * size.width, y: center.y * size.height)
    }
}

// MARK: - Marks between the two states

extension MomentMarks {
    /// The marks moved from a picture `aspect` wide, as taken, to the canvas, staying over what the picture shows at
    /// cover. A picture at least as wide as the canvas spreads them across (and their widths with them), a taller one
    /// down. Labels are then held to the canvas's rules by the editor; nothing is dropped, and a line's points may land
    /// off the canvas, where they are kept and not drawn.
    func placed(aspect: CGFloat) -> MomentMarks {
        scaled(by: Self.stretch(aspect: aspect), aspect: aspect)
    }

    /// The other way: from the canvas back to the picture as taken (Reset).
    func taken(aspect: CGFloat) -> MomentMarks {
        scaled(by: 1 / Self.stretch(aspect: aspect), aspect: aspect)
    }

    private static func stretch(aspect: CGFloat) -> CGFloat {
        aspect >= MomentPlacement.canvas ? aspect / MomentPlacement.canvas : MomentPlacement.canvas / max(aspect, 0.01)
    }

    private func scaled(by factor: CGFloat, aspect: CGFloat) -> MomentMarks {
        let across = aspect >= MomentPlacement.canvas
        func move(_ point: CGPoint) -> CGPoint {
            across
                ? CGPoint(x: 0.5 + (point.x - 0.5) * factor, y: point.y)
                : CGPoint(x: point.x, y: 0.5 + (point.y - 0.5) * factor)
        }
        // A share of the width grows only where the width does.
        let widths = across ? factor : 1
        var moved = self
        moved.strokes = strokes.map { stroke in
            var stroke = stroke
            stroke.points = stroke.points.map(move)
            stroke.width *= widths
            return stroke
        }
        moved.labels = labels.map { label in
            var label = label
            label.center = move(label.center)
            label.size *= widths
            return label
        }
        return moved
    }
}
