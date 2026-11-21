//
//  MomentsMarksEditor+Resize.swift
//  Pantopus
//
//  Resize (founder, 2026-11-21): the 9:16 canvas fills the editor's frame as
//  a picture does in Text and Draw, with the picture on it. One finger drags
//  the picture; two pinch and twist it together, about the point between
//  them. While it moves, the part every phone shows is outlined. The marks
//  stay drawn over it and can't be touched here. Reset puts the picture back
//  as taken. VoiceOver moves, sizes and turns it with actions.
//

import SwiftUI
import UIKit

extension MomentsMarksEditor {
    /// On the phone Reset sits on the strip under the picture, never across its bottom edge; in the Duo poses, where the
    /// picture reaches the bottom, it stays inside the picture under the hint.
    var resetOnStrip: Bool {
        duo.pose == .phone
    }

    /// The hint, and Reset under it in the Duo poses. On the phone the hint ends `aboveEdge` points higher, inside the
    /// picture, clear of the strip where Reset is.
    func resizeFooter(width: CGFloat, aboveEdge: CGFloat) -> some View {
        MomentsResizeFooter(marking: marking, withReset: !resetOnStrip)
            .frame(width: width)
            .padding(.bottom, resetOnStrip ? aboveEdge : 0)
    }

    /// The phone's Reset: 8 pt under the picture's bottom edge, on the strip, in the middle across.
    func stripReset(below frame: CGRect, width: CGFloat) -> some View {
        MomentsResizeReset(marking: marking)
            .frame(width: width)
            .offset(y: frame.maxY + Spacing.s2)
    }
}

/// "Pinch to resize. Twist to turn. Drag to move." until the first gesture in this visit, over Reset when it's here.
/// Its own view: it follows the picture's state, the rest of the editor doesn't need to.
private struct MomentsResizeFooter: View {
    let marking: MomentsMarking
    let withReset: Bool

    var body: some View {
        VStack(spacing: 14) {
            Text("Pinch to resize. Twist to turn. Drag to move.")
                .scaledFont(13, weight: .medium)
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .shadow(color: .black.opacity(0.6), radius: 2, x: 0, y: 1)
                // Its room is kept, so Reset doesn't jump when it goes.
                .opacity(marking.resizeTouched ? 0 : 1)
                .accessibilityHidden(true)
            if withReset { MomentsResizeReset(marking: marking) }
        }
    }
}

/// Reset, off while the picture is as taken.
private struct MomentsResizeReset: View {
    let marking: MomentsMarking
    /// Reset's icon grows with its word.
    @ScaledMetric(relativeTo: .subheadline) private var iconSize: CGFloat = 16

    var body: some View {
        let asTaken = marking.editingPlacement == nil
        Button { marking.resetPlacement() } label: {
            HStack(spacing: 6) {
                Icon(.rotateCcw, size: iconSize, strokeWidth: 2.4, color: .white)
                Text("Reset").scaledFont(15, weight: .semibold)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 18)
            .padding(.vertical, Spacing.s1)
            .frame(minHeight: 44)
            .background(Capsule().fill(Color.black.opacity(0.42)))
            .overlay(Capsule().strokeBorder(Color.white.opacity(0.4), lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(asTaken)
        .opacity(asTaken ? 0.5 : 1)
        .accessibilityIdentifier("moments.resize.reset")
    }
}

/// Resize's picture: the canvas filling `size` (centered, cropped, as the viewer shows it) with the picture at its
/// placement, the marks over it (over the canvas once the picture is placed, over the picture at cover while it's as
/// taken), the outline of what every phone shows while it moves, and the fingers moving it.
struct MomentsResizeArea: View {
    let marking: MomentsMarking
    let image: UIImage
    let size: CGSize

    var body: some View {
        let canvas = MomentMarks.fill(MomentPlacement.pixels, in: size)
        let marks = marksFrame(canvas)
        ZStack {
            MomentPlacedCanvas(image: image, placement: marking.shownPlacement, backdrop: marking.backdrop)
                .frame(width: canvas.width, height: canvas.height)
                .position(x: canvas.midX, y: canvas.midY)
            MomentMarksCanvas(marks: marking.editing, aspect: marking.aspect)
                .frame(width: marks.width, height: marks.height)
                .position(x: marks.midX, y: marks.midY)
            if marking.resizeMoving { outline(canvas) }
        }
        .frame(width: size.width, height: size.height)
        .clipped()
        .overlay { MomentsResizeTouches(marking: marking, canvas: canvas) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("The photo you're posting")
        .accessibilityActions { spokenActions }
        .accessibilityIdentifier("moments.resize.picture")
    }

    /// Where the marks are drawn: the canvas, or the picture at cover on it while it's as taken.
    private func marksFrame(_ canvas: CGRect) -> CGRect {
        guard marking.editingPlacement == nil else { return canvas }
        let picture = MomentPlacement.cover(aspect: marking.pictureAspect).pictureSize(aspect: marking.pictureAspect, on: canvas.size)
        return CGRect(
            x: canvas.midX - picture.width / 2,
            y: canvas.midY - picture.height / 2,
            width: picture.width,
            height: picture.height
        )
    }

    /// The part every phone shows: as wide as the narrowest viewer frame shows the canvas, as tall as the widest one
    /// does (0.762 x 0.893 of it), centered. A thin solid white line over a dark one, so it shows on light pictures and
    /// dark ones, and isn't taken for the dashed line where labels may start.
    private func outline(_ canvas: CGRect) -> some View {
        let width = min(1, MomentMarks.narrowestFrame / MomentPlacement.canvas) * canvas.width
        let height = min(1, MomentPlacement.canvas / MomentMarks.widestFrame) * canvas.height
        let shape = Rectangle()
        return ZStack {
            shape.stroke(Color.black.opacity(0.4), lineWidth: 1)
                .offset(y: 1)
            shape.stroke(Color.white.opacity(0.9), lineWidth: 1)
        }
        .frame(width: width, height: height)
        .position(x: canvas.midX, y: canvas.midY)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private var spokenActions: some View {
        Button("Make larger") { marking.resizePicture(by: 1.2) }
        Button("Make smaller") { marking.resizePicture(by: 1 / 1.2) }
        Button("Turn left") { marking.turnPicture(by: -15) }
        Button("Turn right") { marking.turnPicture(by: 15) }
        Button("Move up") { marking.movePicture(dx: 0, dy: -0.05) }
        Button("Move down") { marking.movePicture(dx: 0, dy: 0.05) }
        Button("Move left") { marking.movePicture(dx: -0.05, dy: 0) }
        Button("Move right") { marking.movePicture(dx: 0.05, dy: 0) }
        Button("Reset") { marking.resetPlacement() }
    }
}

/// The fingers on Resize's picture, through UIKit's own pan, pinch and rotation, all at once: the pan follows the point
/// between two fingers, so a pinch can move the picture too. `canvas` is where the canvas lies in this view's points.
private struct MomentsResizeTouches: UIViewRepresentable {
    let marking: MomentsMarking
    let canvas: CGRect

    func makeCoordinator() -> Fingers {
        Fingers()
    }

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .clear
        context.coordinator.attach(to: view)
        return view
    }

    func updateUIView(_: UIView, context: Context) {
        context.coordinator.marking = marking
        context.coordinator.canvas = canvas
    }

    /// A fold builds the editor again mid-gesture: the gesture ends.
    static func dismantleUIView(_: UIView, coordinator: Fingers) {
        coordinator.letGo()
    }

    @MainActor
    final class Fingers: NSObject, UIGestureRecognizerDelegate {
        var marking: MomentsMarking?
        var canvas: CGRect = .zero
        /// The gestures under way: the picture moves from the first one's start to the last one's end.
        private var active: Set<ObjectIdentifier> = []
        /// How many fingers the pan last followed: when one comes or goes, the point between them jumps.
        private var fingers = 0

        func attach(to view: UIView) {
            let pan = UIPanGestureRecognizer(target: self, action: #selector(panned))
            pan.maximumNumberOfTouches = 2
            let pinch = UIPinchGestureRecognizer(target: self, action: #selector(pinched))
            let rotation = UIRotationGestureRecognizer(target: self, action: #selector(rotated))
            for recognizer in [pan, pinch, rotation] as [UIGestureRecognizer] {
                recognizer.delegate = self
                view.addGestureRecognizer(recognizer)
            }
        }

        func gestureRecognizer(_: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith _: UIGestureRecognizer) -> Bool {
            true
        }

        /// Each takes what its recognizer reports since the last call, from the call that begins it (which already carries
        /// the first movement) to the one that ends it, then sets it back to nothing.
        @objc private func panned(_ pan: UIPanGestureRecognizer) {
            handle(pan) { view in
                let moved = pan.translation(in: view)
                pan.setTranslation(.zero, in: view)
                guard pan.numberOfTouches == fingers else {
                    fingers = pan.numberOfTouches
                    return
                }
                step(move: CGVector(dx: moved.x / max(canvas.width, 1), dy: moved.y / max(canvas.width, 1)), at: pan.location(in: view))
            }
        }

        @objc private func pinched(_ pinch: UIPinchGestureRecognizer) {
            handle(pinch) { view in
                let scale = pinch.scale
                pinch.scale = 1
                // One finger left of two: no point between them to scale about.
                guard pinch.numberOfTouches >= 2 else { return }
                step(scale: scale, at: pinch.location(in: view))
            }
        }

        @objc private func rotated(_ rotation: UIRotationGestureRecognizer) {
            handle(rotation) { view in
                let turn = rotation.rotation * 180 / .pi
                rotation.rotation = 0
                guard rotation.numberOfTouches >= 2 else { return }
                step(turn: turn, at: rotation.location(in: view))
            }
        }

        private func handle(_ recognizer: UIGestureRecognizer, _ apply: (UIView) -> Void) {
            if recognizer.state == .began { track(recognizer) }
            if [.began, .changed, .ended].contains(recognizer.state), let view = recognizer.view { apply(view) }
            if recognizer.state != .began { track(recognizer) }
        }

        private func step(move: CGVector = .zero, scale: CGFloat = 1, turn: CGFloat = 0, at point: CGPoint) {
            guard canvas.width > 0 else { return }
            let anchor = CGPoint(x: (point.x - canvas.minX) / canvas.width, y: (point.y - canvas.minY) / canvas.width)
            marking?.move(by: move, scale: scale, turn: turn, around: anchor)
        }

        private func track(_ recognizer: UIGestureRecognizer) {
            let id = ObjectIdentifier(recognizer)
            switch recognizer.state {
            case .began:
                if active.isEmpty { marking?.beginMoving() }
                active.insert(id)
                if let pan = recognizer as? UIPanGestureRecognizer { fingers = pan.numberOfTouches }
            case .ended, .cancelled, .failed:
                if active.remove(id) != nil, active.isEmpty { marking?.endMoving() }
            default:
                break
            }
        }

        func letGo() {
            guard !active.isEmpty else { return }
            active.removeAll()
            marking?.endMoving()
        }
    }
}
