//
//  MomentsMarking+Resize.swift
//  Pantopus
//
//  Resize (founder, 2026-11-21): in the marks editor's third mode one finger
//  drags the picture, two pinch and twist it together, and Reset puts it
//  back. The picture's placement is held to its limits and sticks to quarter
//  turns and the canvas's middle with a light tick. The first change away
//  from cover moves the marks onto the canvas, over what the picture showed
//  at cover, and Reset moves them back; they never move with the picture.
//

import SwiftUI
import UIKit

extension MomentsMarking {
    /// Where the picture is in the editor: its placement, or cover while it's as taken.
    var shownPlacement: MomentPlacement {
        editingPlacement ?? .cover(aspect: pictureAspect)
    }

    /// Reads the photo's two colours for the background, once per picture, off the main thread.
    func sampleBackdrop(_ image: UIImage) {
        guard backdrop == nil, sampling == nil else { return }
        sampling = Task { [weak self] in
            let colors = await Task.detached(priority: .userInitiated) { MomentPlacementDrawing.backdrop(of: image) }.value
            guard !Task.isCancelled, let self else { return }
            backdrop = colors
        }
    }

    /// The picture placed at `next`; at cover it's as taken again. When it changes state the marks move to the new
    /// state's coordinates, staying over what the picture shows at cover, and its labels are held to the new shape's
    /// rules as after any move. Back to as taken in a visit that began as taken, the marks are the visit's own again,
    /// exactly: marks can't change in Resize, and the arithmetic back isn't exact (nor does it undo a label the canvas's
    /// box held in).
    func place(_ next: MomentPlacement) {
        let placed = next.isCover(aspect: pictureAspect) ? nil : next
        guard (placed == nil) != (editingPlacement == nil) else {
            editingPlacement = placed
            return
        }
        editingPlacement = placed
        if placed == nil, placement == nil {
            moveMarks(marks)
            return
        }
        var moved = placed == nil ? editing.taken(aspect: pictureAspect) : editing.placed(aspect: pictureAspect)
        moved.labels = moved.labels.map(clamped)
        moveMarks(moved)
    }

    // MARK: - Fingers

    /// A finger came down on the picture: the hint goes and the part every phone shows is outlined.
    func beginMoving() {
        gesture = shownPlacement
        resizeTouched = true
        resizeMoving = true
    }

    /// One step of the fingers: `move` in canvas widths, then `scale` and `turn` (degrees clockwise) about `anchor`, the
    /// point between the fingers in canvas widths from the canvas's top-left corner, so what's under them stays there.
    func move(by move: CGVector, scale: CGFloat, turn: CGFloat, around anchor: CGPoint) {
        guard let from = gesture else { return }
        let cover = MomentPlacement.coverWidth(aspect: pictureAspect)
        let width = min(max(from.width * scale, MomentPlacement.smallest), cover * MomentPlacement.largest)
        let grown = width / max(from.width, 0.0001)
        let angle = turn * .pi / 180
        // The middle in canvas widths, so a turn keeps its shape.
        let offset = CGPoint(
            x: (from.center.x - anchor.x) * grown,
            y: (from.center.y / MomentPlacement.canvas - anchor.y) * grown
        )
        let middle = CGPoint(
            x: anchor.x + offset.x * cos(angle) - offset.y * sin(angle) + move.dx,
            y: anchor.y + offset.x * sin(angle) + offset.y * cos(angle) + move.dy
        )
        let next = MomentPlacement(
            width: width,
            center: CGPoint(x: middle.x, y: middle.y * MomentPlacement.canvas),
            turn: from.turn + turn
        ).held(aspect: pictureAspect)
        gesture = next
        // A light tick when the turn or the middle catches.
        if zip(from.caught, next.caught).contains(where: { !$0 && $1 }) {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
        place(next.stuck)
    }

    /// The fingers lifted.
    func endMoving() {
        gesture = nil
        resizeMoving = false
    }

    // MARK: - VoiceOver and Reset

    /// VoiceOver's Make larger and Make smaller, about the picture's own middle.
    func resizePicture(by factor: CGFloat) {
        var next = shownPlacement
        next.width *= factor
        step(next)
    }

    /// VoiceOver's Turn left and Turn right.
    func turnPicture(by degrees: CGFloat) {
        var next = shownPlacement
        next.turn += degrees
        step(next)
    }

    /// VoiceOver's moves: a share of the canvas across or down.
    func movePicture(dx: CGFloat, dy: CGFloat) {
        var next = shownPlacement
        next.center = CGPoint(x: next.center.x + dx, y: next.center.y + dy)
        step(next)
    }

    private func step(_ next: MomentPlacement) {
        resizeTouched = true
        place(next.held(aspect: pictureAspect).stuck)
    }

    /// Reset: back to cover, which is as taken.
    func resetPlacement() {
        gesture = nil
        place(.cover(aspect: pictureAspect))
    }
}

extension MomentsComposerModel {
    /// Resize is offered on a photo (on a video from step R2), and off while a Post is going, as Text and Draw are.
    var offersResize: Bool {
        if case .photo = draft { return true }
        return false
    }
}
