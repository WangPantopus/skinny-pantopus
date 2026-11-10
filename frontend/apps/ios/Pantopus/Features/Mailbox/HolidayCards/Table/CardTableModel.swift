//
//  CardTableModel.swift
//  Pantopus
//
//  The state of the card on the table (launch key `card_table`): which way up
//  the mail is, how far it's been pulled, and the springs that move it. It
//  lives above the screen, because a fold of the iPhone Duo rebuilds views and
//  nothing may reset. Nothing here touches the server, so Look it over and Sent
//  play the same moment without marking anything read.
//

import QuartzCore
import SwiftUI
import UIKit

/// What's on the table.
struct CardTableContent: Equatable {
    let design: String
    let number: Int?
    let caption: String
    let paper: String?
    /// The cloth's colour (hex).
    let table: String?
    let slug: String?
    let year: Int
    /// The day it was mailed ("OCT 30") for the postmarks.
    let mailedOn: String?
    let note: String
    let fromName: String
    let toName: String
    var sealed: Bool
    /// When the seal lifts: an instant, or a day (`YYYY-MM-DD`).
    let sealedUntil: String?
    /// "in 56 days", "tomorrow" or "today".
    var sealedInDays: String
    /// How many days until it opens, for "Not yet."
    var sealedDayCount: Int

    var firstName: String {
        HolidayCardWords.firstName(fromName)
    }
}

/// One thing that moves: where it is, how fast, where it's headed, and its stiffness and damping.
struct CardTableSpring: Equatable {
    var x: Double
    var v: Double = 0
    var t: Double
    let k: Double
    let c: Double

    init(_ x: Double = 0, k: Double, c: Double) {
        self.x = x
        t = x
        self.k = k
        self.c = c
    }

    mutating func jump(to value: Double) {
        x = value
        t = value
        v = 0
    }

    /// Moves it along; false once it has settled.
    mutating func advance(step: Double, count: Int) -> Bool {
        for _ in 0..<count {
            let acceleration = k * (t - x) - c * v
            v += acceleration * step
            x += v * step
        }
        if abs(t - x) > 0.0006 || abs(v) > 0.0006 { return true }
        x = t
        v = 0
        return false
    }
}

/// Everything that moves, together: one change per frame for the screen to draw.
struct CardTableSprings: Equatable {
    /// The envelope turning over: 0 address side, 180 flap side.
    var envelope = CardTableSpring(k: 95, c: 15)
    /// 0 shut, 0.3 flap open, 1 card out.
    var pull = CardTableSpring(k: 70, c: 16)
    /// The card laid down in front of the envelope.
    var lay = CardTableSpring(k: 62, c: 12.5)
    /// The card turning over.
    var card = CardTableSpring(k: 88, c: 13.5)
    /// The light.
    var lightX = CardTableSpring(k: 40, c: 11)
    var lightY = CardTableSpring(k: 40, c: 11)
    /// The envelope arriving on the table: 1 still above it.
    var drop = CardTableSpring(1, k: 58, c: 11.5)
    /// The folded card opening across the Duo's hinge.
    var spread = CardTableSpring(k: 62, c: 12.5)
}

@MainActor
@Observable
final class CardTableModel {
    /// What's on the table.
    enum Step: Equatable {
        /// The address side.
        case front
        /// The flap side, shut.
        case back
        /// The flap up, the top of the card in the V.
        case flap
        /// The card on its way out.
        case pulling
        /// The card in front, the envelope behind it.
        case out
    }

    nonisolated static let flapOpen = 0.3

    private(set) var content: CardTableContent
    var springs = CardTableSprings()
    var step: Step = .front
    /// The seal has broken.
    var cracked = false
    /// Tapping the table hides or shows the controls.
    var controlsHidden = false
    var menuOpen = false
    var toast: String?
    /// The art and the card's picture, kept here so a fold's new screen has them at once.
    private(set) var art: CardTableArt?
    private(set) var picture: UIImage?
    /// Art and picture are ready and the mail has arrived.
    private(set) var isReady = false
    private(set) var fold: CardTableFold = .single

    var turnedOnce = false
    var envelopeTurnedOnce = false
    var heldOnce = false
    /// "Send {first name} a card" (plan Part 3), set by the reader's page once the server says a card can go to them.
    var sendBack: CardTableMenuItem?
    /// The quiet buttons may come (Send {first name} a card, or step 5's): the buttons keep room for them from the
    /// start, so the card doesn't move.
    var reservesSecondary = false

    // Sealing a card by hand (plan Part 2, CardTableSending.swift); nil while reading one.
    var sending: CardTableSending?
    var sendingSetup: CardTableSendingSetup?
    /// The wax seal shows: always on a card being read; on one being sent, once it's pressed home.
    var sealShown = true
    /// The stamp head pressing the seal, 0 to 1 over 0.6 s.
    var sealPress = 0.0
    /// The address side being written on, 0 to 1 (`CardTableAddress`).
    var addressing = 1.0
    /// Step 5's words, main button and quiet buttons, once it's sent.
    var goneWords: String?
    var gonePrimary = "Done"
    var goneButtons: [CardTableMenuItem] = []
    /// Step 5's Take it back asks first.
    var asksTakeBack = false
    /// Why the seal didn't take, in place of "Press and hold to seal it." until the next press.
    var sealRefusal: String?
    /// Step 5's Share for a card by link: the words and the link, for the system share sheet.
    var linkShareText: String?
    @ObservationIgnored var sealHeld = false
    @ObservationIgnored var sinceTick = 0.0
    @ObservationIgnored var addressedAt = 0.0

    @ObservationIgnored var drag: CardTableDrag?
    @ObservationIgnored private let startsOnTable: Bool
    @ObservationIgnored private let ticker = CardTableTicker()
    @ObservationIgnored private let motion = CardTableMotion()
    @ObservationIgnored private var lastFrame: CFTimeInterval = 0
    @ObservationIgnored var lastTouch: CFTimeInterval = 0
    @ObservationIgnored private var isShowing = false
    @ObservationIgnored private var isPaused = false
    @ObservationIgnored private var hasTilt = false
    @ObservationIgnored var toastTask: Task<Void, Never>?
    @ObservationIgnored var takeOutTask: Task<Void, Never>?
    @ObservationIgnored var reduceMotion = false
    @ObservationIgnored var lowPower = false
    /// Tests the moment from a harness: no drift, so a picture of it holds still.
    @ObservationIgnored var driftEnabled = true
    /// Called when the seal cracks, the card lands, and so on.
    @ObservationIgnored let haptics = CardTableHaptics()

    /// - Parameter startsOnTable: it's been opened before, so the card is already out.
    init(content: CardTableContent, startsOnTable: Bool) {
        self.content = content
        self.startsOnTable = startsOnTable && !content.sealed
        ticker.onTick = { [weak self] in self?.frame(at: $0) }
    }

    /// The server's newer answer: the seal may have lifted, or the note come.
    func update(content: CardTableContent) {
        guard content != self.content else { return }
        self.content = content
    }

    // MARK: Showing

    /// Loads the art and the card's picture before the envelope arrives.
    func prepare() async {
        guard !isReady else { return }
        // The cloth shows as soon as there's art; the picture has a little time to come first.
        art = await CardTableArt.load()
        picture = await CardTablePicture.load(content.design)
        begin()
    }

    /// The art and picture are loaded: the mail comes down onto the table (or it's already lying there).
    func begin() {
        guard !isReady else { return }
        isReady = true
        if startsOnTable {
            springs.envelope.jump(to: 180)
            springs.pull.jump(to: 1)
            springs.lay.jump(to: 1)
            springs.drop.jump(to: 0)
            // Being sealed: note side up, and no seal on the envelope yet.
            if sending != nil { springs.card.jump(to: 180) }
            cracked = sending == nil
            step = .out
            applyFold(animated: false)
        } else {
            restart(animated: true)
        }
        wake()
    }

    /// Back to the start, for the first open and "Open it again". It touches nothing on the server.
    func restart(animated: Bool) {
        springs.envelope.jump(to: 0)
        springs.pull.jump(to: 0)
        springs.lay.jump(to: 0)
        springs.card.jump(to: 0)
        springs.spread.jump(to: 0)
        step = .front
        cracked = false
        menuOpen = false
        controlsHidden = false
        takeOutTask?.cancel()
        springs.drop.jump(to: animated && !reduceMotion ? 1 : 0)
        springs.drop.t = 0
        wake()
    }

    /// The screen showed or left, or something came up over it: the clock and the sensor run only while it shows.
    func setShowing(_ showing: Bool) {
        isShowing = showing
        refreshRunning()
    }

    func setPaused(_ paused: Bool) {
        isPaused = paused
        refreshRunning()
    }

    /// Share is up. Kept here because a fold rebuilds the screen: the sheet comes back up, and the mail holds still under it.
    var isSharing = false {
        didSet { refreshRunning() }
    }

    func refreshRunning() {
        guard isShowing, !isPaused, !isSharing else {
            ticker.stop()
            motion.stop()
            return
        }
        if reduceMotion || lowPower {
            motion.stop()
            hasTilt = false
        } else {
            motion.start { [weak self] sideways, forward in self?.tilt(sideways: sideways, forward: forward) }
        }
        if reduceMotion {
            heldOnce = true
            springs.lightX.jump(to: 0)
            springs.lightY.jump(to: 0)
        }
        wake()
    }

    private func tilt(sideways: Double, forward: Double) {
        hasTilt = true
        heldOnce = true
        let x = min(1.1, max(-1.1, sideways / 22))
        let y = min(1.1, max(-1.1, (forward - 45) / 22))
        guard abs(x - springs.lightX.t) > 0.002 || abs(y - springs.lightY.t) > 0.002 else { return }
        springs.lightX.t = x
        springs.lightY.t = y
        wake()
    }

    // MARK: The fold

    /// The screen's reading of how the Duo is held.
    func setFold(_ fold: CardTableFold) {
        guard fold != self.fold else { return }
        let wasSpread = self.fold.isSpread
        self.fold = fold
        // Closing the phone goes back to the picture side.
        if wasSpread, !fold.isSpread {
            springs.card.jump(to: 0)
            springs.spread.jump(to: 0)
        }
        applyFold(animated: !wasSpread)
        wake()
    }

    /// Out of the envelope on an open Duo, the folded card opens across the hinge.
    func applyFold(animated: Bool) {
        let target: Double = fold.isSpread && step == .out ? 1 : 0
        if fold.isSpread, step == .out {
            springs.card.jump(to: 0)
        }
        if animated, !reduceMotion {
            springs.spread.t = target
        } else {
            springs.spread.jump(to: target)
        }
    }

    /// Tells the clock something moved.
    func wake() {
        guard isShowing, !isPaused, !isSharing else { return }
        if !ticker.isRunning { lastFrame = CACurrentMediaTime() }
        ticker.start()
    }

    #if DEBUG
    func debugStep(_ name: String, pull: Double?) {
        switch name {
        case "front":
            step = .front
        case "back":
            springs.envelope.jump(to: 180)
            step = .back
        case "flapmid", "flap", "rising":
            springs.envelope.jump(to: 180)
            springs.pull.jump(to: pull ?? (name == "flap" ? Self.flapOpen : (name == "rising" ? 0.6 : 0.17)))
            step = .flap
            cracked = true
        case "out", "outback":
            springs.envelope.jump(to: 180)
            springs.pull.jump(to: 1)
            springs.lay.jump(to: 1)
            if name == "outback" {
                springs.card.jump(to: 180)
                turnedOnce = true
            }
            step = .out
            cracked = true
            applyFold(animated: false)
        default:
            break
        }
        wake()
    }
    #endif

    func didCardLand() {
        step = .out
        springs.pull.jump(to: 1)
        springs.lay.t = 1
        haptics.tap(.medium)
        applyFold(animated: true)
    }

    // MARK: The clock

    private var drifts: Bool {
        driftEnabled && !reduceMotion && !lowPower && !hasTilt
    }

    private func frame(at now: CFTimeInterval) {
        let elapsed = min(0.05, now - lastFrame)
        lastFrame = now
        var next = springs
        // Idle, with no sensor: the light drifts by itself, slowly, so the paper is alive without a hand on it.
        if drifts, drag == nil, now - lastTouch > 2.6 {
            next.lightX.t = sin(now / 2.9) * 0.62
            next.lightY.t = sin(now / 4.1 + 1) * 0.5
        }
        let count = max(1, Int((elapsed / 0.006).rounded(.up)))
        let slice = elapsed / Double(count)
        var moving = false
        let mode = drag?.mode
        if mode != .envelope, next.envelope.advance(step: slice, count: count) { moving = true }
        if mode != .pull, next.pull.advance(step: slice, count: count) { moving = true }
        if next.lay.advance(step: slice, count: count) { moving = true }
        if mode != .turn, next.card.advance(step: slice, count: count) { moving = true }
        if next.lightX.advance(step: slice, count: count) { moving = true }
        if next.lightY.advance(step: slice, count: count) { moving = true }
        if next.drop.advance(step: slice, count: count) { moving = true }
        if next.spread.advance(step: slice, count: count) { moving = true }
        springs = next
        if sending != nil, advanceSending(elapsed: elapsed) { moving = true }
        // Once it has cleared the envelope, the card is laid down in front of it.
        if step == .pulling, springs.pull.x > 0.985 {
            didCardLand()
            moving = true
        }
        if !moving, drag == nil, !drifts { ticker.stop() }
    }
}

#if DEBUG
extension CardTableModel {
    /// For testing: jumps straight to any moment, as the sample's `go` does.
    func debugGo(_ name: String, pull: Double? = nil, tx: Double = 0, ty: Double = 0) {
        driftEnabled = false
        springs.drop.jump(to: 0)
        springs.lightX.jump(to: tx)
        springs.lightY.jump(to: ty)
        springs.envelope.jump(to: 0)
        springs.pull.jump(to: 0)
        springs.lay.jump(to: 0)
        springs.card.jump(to: 0)
        debugStep(name, pull: pull)
    }
}
#endif
