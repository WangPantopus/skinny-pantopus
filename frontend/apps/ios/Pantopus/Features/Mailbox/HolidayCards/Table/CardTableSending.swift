//
//  CardTableSending.swift
//  Pantopus
//
//  Seal it by hand (plan Part 2, launch key `card_table`): after Look it over
//  the screen becomes the table, the card lying note side up with its open
//  envelope behind it, as the other person will find it. The receiving moment
//  runs backwards: the card goes in (`lay` 1 → 0, then `pull` 1 → 0.3), the
//  flap shuts (`pull` → 0), a press and hold seals it, and the seal is the
//  send. Then the envelope turns over, is addressed, stamped and postmarked,
//  and slides off the table.
//

import QuartzCore
import SwiftUI

/// Where the sealing is.
enum CardTableSending: Equatable {
    /// 1. The card note side up, the open envelope behind it.
    case ready
    /// On its way into the envelope.
    case goingIn
    /// 2. Inside, its top edge showing in the V.
    case inside
    /// The flap coming down.
    case closing
    /// 3. The flap shut; a soft ring where the seal goes. Press and hold to seal it.
    case shut
    /// The seal is on and the card is on its way to the server.
    case sealing
    /// 4. The envelope turns over by itself: the name, the stamp, the postmark.
    case addressing
    /// 5. Off the table.
    case gone
}

/// What sending needs from the send flow.
struct CardTableSendingSetup {
    /// Who it's for, first name ("Nora"), for "For Nora."
    let toFirstName: String
    /// Cards going at once (a list): the moment plays once, with a stack of envelopes.
    let count: Int
    /// The gold "Do not open until Christmas" lands last.
    let sealedForChristmas: Bool
    /// Sends the card at the seal, with the draft's request ID.
    let seal: @MainActor () async -> CardTableSealAnswer
    /// Done (✕ too, once it's sent).
    let onDone: @MainActor () -> Void
}

/// What came of the seal.
enum CardTableSealAnswer {
    /// Sent: the words for step 5, and its quiet buttons (Take it back, Share this card).
    case sent(words: String, primary: String, buttons: [CardTableMenuItem])
    /// The seal doesn't take: it lifts off, the flap stays shut, and this says why (nil when the flow shows it).
    case refused(String?)
}

extension CardTableModel {
    /// Sets the table for sealing: the card note side up on its open envelope, no seal yet.
    func beginSending(_ setup: CardTableSendingSetup) {
        sendingSetup = setup
        sending = .ready
        sealShown = false
        sealPress = 0
        addressing = 0
        turnedOnce = true
        heldOnce = true
        // Step 5's quiet buttons: room for them from the start.
        reservesSecondary = true
    }

    /// The button does what the hand can do.
    func sendingPrimary() {
        lastTouch = CACurrentMediaTime()
        switch sending {
        case .ready:
            if reduceMotion { sealAllAtOnce() } else { putIn() }
        case .inside:
            closeFlap()
        case .shut:
            // "Seal it" holds the seal down for them.
            sealRefusal = nil
            sealHeld = true
            wake()
        case .gone:
            sendingSetup?.onDone()
        case .goingIn, .closing, .sealing, .addressing, nil:
            break
        }
    }

    func putIn() {
        guard sending == .ready else { return }
        sending = .goingIn
        // Any step but `.out` folds the Duo's two pages back into one card first.
        step = .flap
        applyFold(animated: true)
        springs.lay.t = 0
        haptics.tap(.light)
        wake()
    }

    func closeFlap() {
        guard sending == .inside else { return }
        sending = .closing
        springs.pull.t = 0
        haptics.tap(.light)
        wake()
    }

    /// Reduce Motion: "Seal and send" does all of it; the steps swap without moving.
    private func sealAllAtOnce() {
        springs.spread.jump(to: 0)
        springs.lay.jump(to: 0)
        springs.pull.jump(to: 0)
        springs.card.jump(to: 180)
        step = .back
        sending = .shut
        seal()
    }

    /// The seal is pressed home: it's on, and the card goes. Letting go before this does nothing.
    func seal() {
        guard sending == .shut, let setup = sendingSetup else { return }
        sending = .sealing
        sealHeld = false
        sealPress = 0
        sealShown = true
        haptics.tap(.firm)
        wake()
        let sealedAt = CACurrentMediaTime()
        Task { @MainActor [weak self] in
            let answer = await setup.seal()
            // The seal stays in sight at least 0.8 s, however fast the server answers (web's timing).
            if case .sent = answer, self?.reduceMotion == false {
                let left = 0.8 - (CACurrentMediaTime() - sealedAt)
                if left > 0 { try? await Task.sleep(nanoseconds: UInt64(left * 1_000_000_000)) }
            }
            self?.sealAnswered(answer)
        }
    }

    private func sealAnswered(_ answer: CardTableSealAnswer) {
        switch answer {
        case let .sent(words, primary, buttons):
            goneWords = words
            gonePrimary = primary
            goneButtons = buttons
            step = .front
            addressedAt = 0
            if reduceMotion {
                // Addressed all at once, and it stays on the table; step 5 comes after 1.2 s.
                springs.envelope.jump(to: 360)
                addressing = 1
                sending = .addressing
                Task { @MainActor [weak self] in
                    try? await Task.sleep(nanoseconds: 1_200_000_000)
                    self?.sending = .gone
                }
            } else {
                // It turns over by itself, address side up.
                springs.envelope.t = 360
                addressing = 0
                sending = .addressing
            }
        case let .refused(message):
            // The seal doesn't take: it lifts off, the flap stays shut, and the server's words take the place of
            // "Press and hold to seal it." until the next press.
            sealShown = false
            sending = .shut
            sealRefusal = message
            haptics.tap(.refuse)
        }
        wake()
    }

    // MARK: The clock

    /// Moves the sealing along each frame; true while something is still happening.
    func advanceSending(elapsed: Double) -> Bool {
        switch sending {
        case .goingIn:
            // Picked up first; once it's clear of the table it slides down into the V.
            if springs.lay.x < 0.04, springs.spread.x < 0.04, springs.pull.t > Self.flapOpen {
                springs.pull.t = Self.flapOpen
            }
            if springs.pull.t <= Self.flapOpen, springs.pull.x < Self.flapOpen + 0.012 {
                sending = .inside
                haptics.tap(.soft)
            }
            return true
        case .closing:
            if springs.pull.x < 0.01 {
                springs.pull.jump(to: 0)
                step = .back
                sending = .shut
                haptics.tap(.light)
            }
            return true
        case .shut:
            return advanceSealPress(elapsed: elapsed)
        case .addressing:
            return reduceMotion ? false : advanceAddress(elapsed: elapsed)
        case .ready, .inside, .sealing, .gone, nil:
            return false
        }
    }

    /// While a finger (or "Seal it") holds, the stamp head's shadow grows and the ticks come closer together.
    private func advanceSealPress(elapsed: Double) -> Bool {
        if sealHeld {
            sealPress = min(1, sealPress + elapsed / 0.6)
            sinceTick += elapsed
            if sinceTick > 0.17 - 0.12 * sealPress {
                sinceTick = 0
                haptics.tap(.soft)
            }
            if sealPress >= 1 { seal() }
            return true
        }
        guard sealPress > 0 else { return false }
        sealPress = max(0, sealPress - elapsed / 0.25)
        return true
    }

    /// From the start of the turn: the name written left to right, the stamp landing, the postmark's thump (and the
    /// gold seal last when it's sealed until Christmas); 0.9 s after the last mark it slides off the table.
    private func advanceAddress(elapsed: Double) -> Bool {
        let before = addressedAt
        addressedAt += elapsed
        addressing = min(1, addressedAt / CardTableAddress.duration)
        func landed(_ window: (Double, Double)) -> Bool {
            before < window.1 && addressedAt >= window.1
        }
        if landed(CardTableAddress.stamp) { haptics.tap(.medium) }
        if landed(CardTableAddress.postmark) { haptics.tap(.firm) }
        let sealedForChristmas = sendingSetup?.sealedForChristmas == true
        if sealedForChristmas, landed(CardTableAddress.gold) { haptics.tap(.medium) }
        let last = sealedForChristmas ? CardTableAddress.gold.1 : CardTableAddress.postmark.1
        if addressedAt >= last + 0.9 {
            springs.drop.t = 1
            sending = .gone
        }
        return true
    }

    // MARK: The finger

    /// Up pushes the card into the envelope; down pulls the flap shut; a hold on the envelope seals it.
    func sendingFingerMoved(to point: CGPoint, layout: CardTableLayout) {
        let now = CACurrentMediaTime()
        lastTouch = now
        guard var finger = drag else {
            drag = CardTableDrag(
                startX: point.x,
                startY: point.y,
                startTime: now,
                lastX: point.x,
                lastY: point.y,
                lastTime: now,
                envelopeAtStart: springs.envelope.x,
                pullAtStart: springs.pull.x,
                cardAtStart: springs.card.x
            )
            // A press anywhere on the table seals it (the buttons are their own).
            if sending == .shut {
                sealRefusal = nil
                sealHeld = true
                sinceTick = 1
            }
            wake()
            return
        }
        let elapsed = max(0.001, now - finger.lastTime)
        finger.velocityY += ((point.y - finger.lastY) / elapsed - finger.velocityY) * 0.5
        finger.lastX = point.x
        finger.lastY = point.y
        finger.lastTime = now
        let dx = point.x - finger.startX
        let dy = point.y - finger.startY
        if finger.mode == nil, hypot(dx, dy) > 8 {
            // Moving lets go of the seal.
            if sending == .shut { sealHeld = false }
            let vertical = abs(dy) > abs(dx)
            finger.mode = vertical && (sending == .ready || sending == .inside) ? .pull : CardTableDrag.Mode.none
            finger.modeStartY = point.y
            if finger.mode == .pull, sending == .ready {
                springs.spread.t = 0
            }
        }
        drag = finger
        guard finger.mode == .pull, !reduceMotion else { return }
        let travel = (finger.modeStartY - point.y) / (layout.height * 0.36)
        if sending == .ready {
            setPush(min(1, max(0, travel)))
        } else if sending == .inside {
            let pull = min(Self.flapOpen, max(0, Self.flapOpen + travel))
            springs.pull.x = pull
            springs.pull.t = pull
            springs.pull.v = 0
        }
    }

    func sendingFingerLifted(at point: CGPoint, layout: CardTableLayout) {
        guard let finger = drag else { return }
        drag = nil
        sealHeld = false
        lastTouch = CACurrentMediaTime()
        guard finger.mode == .pull else {
            wake()
            return
        }
        if reduceMotion {
            if abs(point.y - finger.startY) > 24 { sendingPrimary() }
            return
        }
        let flick = -finger.velocityY / (layout.height * 0.36) * 0.22
        if sending == .ready {
            let push = (finger.modeStartY - point.y) / (layout.height * 0.36)
            if push + flick > 0.35 {
                putIn()
            } else {
                springs.lay.t = 1
                springs.pull.t = 1
                applyFold(animated: true)
            }
        } else if sending == .inside {
            if springs.pull.x + flick < 0.15 { closeFlap() } else { springs.pull.t = Self.flapOpen }
        }
        wake()
    }

    /// The finger pushing the card in, 0 to 1: first it's picked up off the table (`lay`), then it slides into the V.
    private func setPush(_ push: Double) {
        let lay = 1 - min(1, push / 0.45)
        let pull = 1 - (1 - Self.flapOpen) * max(0, (push - 0.5) / 0.5)
        springs.lay.x = lay
        springs.lay.t = lay
        springs.lay.v = 0
        springs.pull.x = pull
        springs.pull.t = pull
        springs.pull.v = 0
    }
}

/// When things land on the address side, in seconds from the start of the turn (web's timing, MCSRV seal-timing).
enum CardTableAddress {
    /// `reveal` 0 to 1 runs over this long.
    static let duration = 2.4
    static let name = (0.7, 1.4)
    static let stamp = (1.3, 1.6)
    static let postmark = (1.74, 1.98)
    static let gold = (2.12, 2.4)

    /// How far along `window` the address side is, 0 to 1, at `reveal`.
    static func progress(_ reveal: Double, _ window: (Double, Double)) -> Double {
        min(1, max(0, (reveal * duration - window.0) / (window.1 - window.0)))
    }
}
