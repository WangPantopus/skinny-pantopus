//
//  MomentsStudioWholeTouches.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 5, piece A on the iPhone (`MomentsStudioWhole`): the fingers on the Studio's first screen.
//  They drive Resize's own engine through the composer model; only this glue is the Studio's.
//

import SwiftUI
import UIKit

/// The fingers on the first screen's picture: UIKit's pan, pinch and rotation all at once, as in Resize, so a pinch can
/// move the picture too; a press held still lifts a cutout; a tap lets go of the picked one. Points are read in the
/// window, against `canvas` in the window, so the picture's box changing under the fingers (whole → canvas) moves
/// nothing.
struct MomentsStudioWholeTouches: UIViewRepresentable {
    let model: MomentsComposerModel
    let canvas: CGRect
    /// A press held still at a point of this view's box (0 to 1 across and down), and its end; a tap.
    let onHold: (CGPoint) -> Void
    let onHoldEnd: () -> Void
    let onTap: () -> Void

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
        let fingers = context.coordinator
        (fingers.model, fingers.canvas) = (model, canvas)
        (fingers.onHold, fingers.onHoldEnd, fingers.onTap) = (onHold, onHoldEnd, onTap)
    }

    static func dismantleUIView(_: UIView, coordinator: Fingers) {
        coordinator.letGo()
    }

    @MainActor
    final class Fingers: NSObject, UIGestureRecognizerDelegate {
        var model: MomentsComposerModel?
        var canvas: CGRect = .zero
        var onHold: ((CGPoint) -> Void)?
        var onHoldEnd: (() -> Void)?
        var onTap: (() -> Void)?
        private var active: Set<ObjectIdentifier> = []
        /// Where the pan was last, in the window, and how many fingers it followed then.
        private var last: CGPoint?
        private var fingers = 0
        private weak var hold: UILongPressGestureRecognizer?

        func attach(to view: UIView) {
            let pan = UIPanGestureRecognizer(target: self, action: #selector(panned))
            pan.maximumNumberOfTouches = 2
            let pinch = UIPinchGestureRecognizer(target: self, action: #selector(pinched))
            let rotation = UIRotationGestureRecognizer(target: self, action: #selector(rotated))
            let hold = UILongPressGestureRecognizer(target: self, action: #selector(held))
            hold.minimumPressDuration = 0.5
            hold.allowableMovement = 10
            let tap = UITapGestureRecognizer(target: self, action: #selector(tapped))
            for recognizer in [pan, pinch, rotation, hold, tap] as [UIGestureRecognizer] {
                recognizer.delegate = self
                view.addGestureRecognizer(recognizer)
            }
            self.hold = hold
        }

        func gestureRecognizer(_: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith _: UIGestureRecognizer) -> Bool {
            true
        }

        /// A press that lifted a cutout doesn't then move the picture.
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard recognizer is UIPanGestureRecognizer, let hold else { return true }
            return hold.state != .began && hold.state != .changed
        }

        @objc private func panned(_ pan: UIPanGestureRecognizer) {
            handle(pan) {
                let point = pan.location(in: nil)
                defer { last = point }
                guard pan.numberOfTouches == fingers, let last else {
                    fingers = pan.numberOfTouches
                    return
                }
                let width = max(canvas.width, 1)
                step(move: CGVector(dx: (point.x - last.x) / width, dy: (point.y - last.y) / width), at: point)
            }
        }

        @objc private func pinched(_ pinch: UIPinchGestureRecognizer) {
            handle(pinch) {
                let scale = pinch.scale
                pinch.scale = 1
                guard pinch.numberOfTouches >= 2 else { return }
                step(scale: scale, at: pinch.location(in: nil))
            }
        }

        @objc private func rotated(_ rotation: UIRotationGestureRecognizer) {
            handle(rotation) {
                let turn = rotation.rotation * 180 / .pi
                rotation.rotation = 0
                guard rotation.numberOfTouches >= 2 else { return }
                step(turn: turn, at: rotation.location(in: nil))
            }
        }

        @objc private func held(_ hold: UILongPressGestureRecognizer) {
            guard let view = hold.view, view.bounds.width > 0, view.bounds.height > 0 else { return }
            switch hold.state {
            case .began:
                let point = hold.location(in: view)
                onHold?(CGPoint(x: point.x / view.bounds.width, y: point.y / view.bounds.height))
            case .ended, .cancelled, .failed:
                onHoldEnd?()
            default:
                break
            }
        }

        @objc private func tapped() {
            onTap?()
        }

        private func handle(_ recognizer: UIGestureRecognizer, _ apply: () -> Void) {
            if recognizer.state == .began { track(recognizer) }
            if [.began, .changed, .ended].contains(recognizer.state) { apply() }
            if recognizer.state != .began { track(recognizer) }
        }

        private func step(move: CGVector = .zero, scale: CGFloat = 1, turn: CGFloat = 0, at point: CGPoint) {
            guard canvas.width > 0 else { return }
            let anchor = CGPoint(x: (point.x - canvas.minX) / canvas.width, y: (point.y - canvas.minY) / canvas.width)
            model?.studioWholeStep(move: move, scale: scale, turn: turn, around: anchor)
        }

        private func track(_ recognizer: UIGestureRecognizer) {
            let id = ObjectIdentifier(recognizer)
            switch recognizer.state {
            case .began:
                if active.isEmpty { model?.studioWholeBegin() }
                active.insert(id)
                if let pan = recognizer as? UIPanGestureRecognizer {
                    (fingers, last) = (pan.numberOfTouches, pan.location(in: nil))
                }
            case .ended, .cancelled, .failed:
                if active.remove(id) != nil, active.isEmpty {
                    last = nil
                    model?.studioWholeEnd()
                }
            default:
                break
            }
        }

        func letGo() {
            guard !active.isEmpty else { return }
            active.removeAll()
            model?.studioWholeEnd()
        }
    }
}
