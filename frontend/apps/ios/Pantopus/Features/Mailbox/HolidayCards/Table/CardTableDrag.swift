//
//  CardTableDrag.swift
//  Pantopus
//
//  The finger on the table (launch key `card_table`). One pull does it all:
//  flap, then card. A swipe turns the mail. Press and hold on the card, then
//  move: the light follows. Every gesture also has a button.
//

import QuartzCore
import SwiftUI

/// A finger on the table.
struct CardTableDrag {
    enum Mode {
        /// `pan`: moving around the enlarged card; `pinch`: a second finger came, so this one does nothing.
        case envelope, pull, turn, tilt, pan, pinch, none
    }

    let startX: CGFloat
    let startY: CGFloat
    let startTime: CFTimeInterval
    var lastX: CGFloat
    var lastY: CGFloat
    var lastTime: CFTimeInterval
    /// Points per second.
    var velocityX: CGFloat = 0
    var velocityY: CGFloat = 0
    var mode: Mode?
    var modeStartX: CGFloat = 0
    var modeStartY: CGFloat = 0
    let envelopeAtStart: Double
    let pullAtStart: Double
    let cardAtStart: Double
    var zoomOffsetAtStart: CGSize = .zero
    var holdTimer: Task<Void, Never>?
}

extension CardTableModel {
    /// The finger came down or moved, in the table's coordinates.
    func fingerMoved(to point: CGPoint, layout: CardTableLayout) {
        if sending != nil {
            sendingFingerMoved(to: point, layout: layout)
            return
        }
        let now = CACurrentMediaTime()
        lastTouch = now
        guard var finger = drag else {
            fingerDown(at: point, time: now)
            return
        }
        let elapsed = max(0.001, now - finger.lastTime)
        finger.velocityX += ((point.x - finger.lastX) / elapsed - finger.velocityX) * 0.5
        finger.velocityY += ((point.y - finger.lastY) / elapsed - finger.velocityY) * 0.5
        finger.lastX = point.x
        finger.lastY = point.y
        finger.lastTime = now
        let dx = point.x - finger.startX
        let dy = point.y - finger.startY
        if finger.mode == nil, hypot(dx, dy) > 8 {
            finger.holdTimer?.cancel()
            let horizontal = abs(dx) > abs(dy)
            switch step {
            case .front:
                finger.mode = horizontal ? .envelope : CardTableDrag.Mode.none
            case .back, .flap:
                if !horizontal, dy < 0 {
                    finger.mode = .pull
                } else {
                    finger.mode = horizontal && step == .back ? .envelope : CardTableDrag.Mode.none
                }
            case .out:
                // Enlarged, a finger moves around the card instead of turning it (plan 6.1).
                if isZoomed {
                    finger.mode = .pan
                    finger.zoomOffsetAtStart = zoomOffset
                } else {
                    finger.mode = fold.isSpread ? .tilt : (horizontal ? .turn : .tilt)
                }
            case .pulling:
                finger.mode = CardTableDrag.Mode.none
            }
            finger.modeStartX = point.x
            finger.modeStartY = point.y
        }
        drag = finger
        follow(finger, to: point, layout: layout)
    }

    private func fingerDown(at point: CGPoint, time: CFTimeInterval) {
        menuOpen = false
        var finger = CardTableDrag(
            startX: point.x,
            startY: point.y,
            startTime: time,
            lastX: point.x,
            lastY: point.y,
            lastTime: time,
            envelopeAtStart: springs.envelope.x,
            pullAtStart: springs.pull.x,
            cardAtStart: springs.card.x
        )
        // Held still for a moment on the card, the finger moves the light instead.
        finger.holdTimer = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 240_000_000)
            guard let self, !Task.isCancelled, drag?.mode == nil, step == .out, !reduceMotion else { return }
            drag?.mode = .tilt
            heldOnce = true
            haptics.tap(.soft)
        }
        drag = finger
        wake()
    }

    /// What the finger is doing to the mail right now.
    private func follow(_ finger: CardTableDrag, to point: CGPoint, layout: CardTableLayout) {
        // Moving around an enlarged card is the finger's own movement, so it follows even with Reduce Motion.
        if finger.mode == .pan {
            let moved = CGSize(width: point.x - finger.modeStartX, height: point.y - finger.modeStartY)
            pan(from: finger.zoomOffsetAtStart, by: moved, layout: layout)
            return
        }
        // With Reduce Motion nothing follows the finger: on lifting it, a swipe does what the button does.
        guard !reduceMotion else { return }
        switch finger.mode {
        case .envelope:
            let angle = finger.envelopeAtStart + (point.x - finger.modeStartX) / (layout.envelopeWidth * 0.8) * 180
            springs.envelope.x = angle
            springs.envelope.t = angle
            springs.envelope.v = 0
        case .pull:
            var pull = finger.pullAtStart + (finger.modeStartY - point.y) / (layout.height * 0.36)
            if content.sealed { pull = min(0.04, pull * 0.12) }
            pull = min(1, max(0, pull))
            springs.pull.x = pull
            springs.pull.t = pull
            springs.pull.v = 0
            if !content.sealed, pull > 0.03 { crack() }
        case .turn:
            let angle = finger.cardAtStart + (point.x - finger.modeStartX) / (layout.cardWidth * 0.86) * 180
            springs.card.x = angle
            springs.card.t = angle
            springs.card.v = 0
        case .tilt:
            springs.lightX.t = min(1, max(-1, point.x / layout.screen.width * 2 - 1)) * 1.1
            springs.lightY.t = min(1, max(-1, point.y / layout.screen.height * 2 - 1)) * 1.1
        case .pan, .pinch, .none?, nil:
            break
        }
    }

    /// The finger lifted: a tap, or where the flick sends the mail.
    func fingerLifted(at point: CGPoint, layout: CardTableLayout, isOnCard: Bool) {
        if sending != nil {
            sendingFingerLifted(at: point, layout: layout)
            return
        }
        guard let finger = drag else { return }
        drag = nil
        finger.holdTimer?.cancel()
        let now = CACurrentMediaTime()
        lastTouch = now
        if finger.mode == nil, now - finger.startTime < 0.32 {
            tap(isOnCard: isOnCard, at: point, layout: layout)
            return
        }
        if reduceMotion {
            swipedWithReduceMotion(finger, to: point)
            return
        }
        switch finger.mode {
        case .envelope: settleEnvelope(finger, layout: layout)
        case .pull: settlePull(finger, layout: layout)
        case .turn: settleCard(finger, layout: layout)
        case .tilt, .pan, .pinch, .none?, nil: break
        }
        wake()
    }

    private func settleEnvelope(_ finger: CardTableDrag, layout: CardTableLayout) {
        let flick = finger.velocityX / (layout.envelopeWidth * 0.8) * 180 * 0.22
        let aim = ((springs.envelope.x + flick) / 180).rounded() * 180
        springs.envelope.t = aim
        springs.envelope.v = flick * 1.2
        if cos(aim * .pi / 180) < 0 {
            if step != .back { haptics.tap(.light) }
            step = .back
            envelopeTurnedOnce = true
        } else {
            step = .front
        }
    }

    /// Past .54 it goes all the way; between .14 and .54 it rests with the flap open; below that it closes.
    private func settlePull(_ finger: CardTableDrag, layout: CardTableLayout) {
        let flick = -finger.velocityY / (layout.height * 0.36) * 0.22
        let aim = springs.pull.x + flick
        if content.sealed {
            resist()
        } else if aim > 0.54 {
            takeOut()
            springs.pull.v = flick
        } else if aim > 0.14 {
            springs.pull.t = Self.flapOpen
            step = .flap
            startGlint()
        } else {
            springs.pull.t = 0
            step = .back
        }
    }

    private func settleCard(_ finger: CardTableDrag, layout: CardTableLayout) {
        let flick = finger.velocityX / (layout.cardWidth * 0.86) * 180 * 0.22
        let aim = ((springs.card.x + flick) / 180).rounded() * 180
        springs.card.t = aim
        springs.card.v = flick * 1.1
        if abs(aim - finger.cardAtStart) > 1 {
            turnedOnce = true
            haptics.tap(.light)
        }
    }

    /// The finger's gone without lifting (the system took the touch): the mail settles where it is.
    func fingerCancelled(layout: CardTableLayout) {
        guard let finger = drag else { return }
        fingerLifted(at: CGPoint(x: finger.lastX, y: finger.lastY), layout: layout, isOnCard: false)
    }

    private func swipedWithReduceMotion(_ finger: CardTableDrag, to point: CGPoint) {
        guard hypot(point.x - finger.startX, point.y - finger.startY) > 24 else { return }
        switch finger.mode {
        case .envelope:
            if step == .front {
                primary()
            } else {
                springs.envelope.jump(to: 0)
                step = .front
            }
        case .pull:
            if content.sealed { resist() } else { primary() }
        case .turn:
            turnCard()
        case .tilt, .pan, .pinch, .none?, nil:
            break
        }
    }

    private func tap(isOnCard: Bool, at point: CGPoint, layout: CardTableLayout) {
        switch step {
        case .front, .back:
            primary()
        case .flap:
            takeOut()
        case .pulling:
            break
        case .out:
            if isOnCard, !fold.isSpread {
                tapCard(at: point, layout: layout)
            } else {
                controlsHidden.toggle()
            }
        }
    }
}
