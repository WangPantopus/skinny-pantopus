//
//  CardTableModel+Actions.swift
//  Pantopus
//
//  What the buttons and taps do to the mail (launch key `card_table`).
//

import QuartzCore

extension CardTableModel {
    /// The button at the bottom does what the finger can do.
    func primary() {
        if sending != nil {
            sendingPrimary()
            return
        }
        lastTouch = CACurrentMediaTime()
        switch step {
        case .front:
            if reduceMotion {
                springs.envelope.jump(to: 180)
                step = .back
                envelopeTurnedOnce = true
            } else {
                turnEnvelopeToFlap()
            }
        case .back:
            if content.sealed {
                resist()
            } else if reduceMotion {
                springs.pull.jump(to: 1)
                springs.lay.jump(to: 1)
                step = .out
                crack()
                applyFold(animated: false)
            } else {
                openFlap()
                takeOutTask?.cancel()
                takeOutTask = Task { @MainActor [weak self] in
                    try? await Task.sleep(nanoseconds: 680_000_000)
                    guard let self, !Task.isCancelled, step == .flap else { return }
                    takeOut()
                }
            }
        case .flap:
            takeOut()
        case .pulling:
            break
        case .out:
            turnCard()
        }
    }

    func turnEnvelopeToFlap() {
        let sign: Double = springs.envelope.t < 0 ? -1 : (springs.envelope.t > 0 ? 1 : -1)
        springs.envelope.t = 180 * sign
        envelopeTurnedOnce = true
        step = .back
        haptics.tap(.light)
        wake()
    }

    func crack() {
        guard !cracked else { return }
        cracked = true
        haptics.tap(.firm)
    }

    /// Reverence: one slow glint crosses the gold lining once it's in view (plan Part 7): the flap left open, or the
    /// card laid down below it. Once per card.
    func startGlint() {
        guard mood == .reverence, moodMoves, springs.glint.t == 0 else { return }
        springs.glint.jump(to: 0)
        springs.glint.t = 1
        wake()
    }

    func openFlap() {
        guard !content.sealed else {
            resist()
            return
        }
        crack()
        springs.pull.t = Self.flapOpen
        step = .flap
        startGlint()
        wake()
    }

    /// A sealed flap lifts a few degrees and springs back.
    func resist() {
        springs.pull.t = 0
        springs.pull.v = 1.1
        showToast(notYet)
        haptics.tap(.refuse)
        wake()
    }

    func takeOut() {
        crack()
        springs.pull.t = 1
        step = .pulling
        wake()
    }

    func turnCard(direction: Double = -1) {
        guard !fold.isSpread else { return }
        springs.card.t = ((springs.card.t / 180).rounded() + (direction < 0 ? -1 : 1)) * 180
        if reduceMotion { springs.card.jump(to: springs.card.t) }
        turnedOnce = true
        haptics.tap(.light)
        wake()
    }

    func showToast(_ text: String) {
        toast = text
        toastTask?.cancel()
        toastTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 2_600_000_000)
            guard !Task.isCancelled else { return }
            self?.toast = nil
        }
    }
}
